import React, { useState, useEffect, useRef } from 'react';
import { Layout, Row, Col, Card, Alert, message } from 'antd';
import { useCamera } from '@/hooks/useCamera';
import { useSessionRecording } from '@/hooks/useSessionRecording';
import { faceApi, gestureApi, voiceApi, getSessionId } from '@/services/api';
import { useAssessmentStore } from '@/store/assessmentStore';
import RadarChart from '@/components/visualization/RadarChart';
import TimelineChart from '@/components/visualization/TimelineChart';
import CameraView from '@/components/assessment/CameraView';
import {
  AbandonConfirmModal, ConsentModal, DegradedBanner, LabelErrorBanner, LabelModal,
  SaveGateModal, StopConfirmModal,
} from '@/components/recording/RecordingDialogs';
import type { ConsentMode } from '@/components/recording/RecordingDialogs';
import DevicePicker, { useDeviceSelection } from '@/components/recording/DevicePicker';

const { Content } = Layout;

const RADAR_LABELS = {
  logical_thinking: '面部专注度',
  stress_resilience: '紧张度',
  communication_fluency: '手势分',
  confidence_level: '面部对称性',
  cognitive_efficiency: '眼神稳定性',
} as const;

/** 抽帧之后还要再节流一层:每送一帧要发两个请求(face + gesture),
 *  而**两个端点各自是同步推理**,各自还要把那帧原始字节留存一份。
 *
 *  取 `5` 的依据只有一个:**与 `AssessmentPage` 相同**。那一页是正式评估那条路,
 *  也是本仓现有全部素材的来源;这一页此前用 `% 10`,在时钟上是
 *  `frameRate / 10`(配 `frameRate: 5` ⟹ 每 2 秒一帧),比正式那条慢一倍。
 *  没有依据把"记录"这条定得比"正式评估"那条还稀,所以就对齐它,不另取新数。
 *
 *  (实际到达率 **≤** 时钟值:视频未就绪的那些 tick 不发帧。真实值以服务端
 *   `measured_fps()` 为准,别在这里手写一个。) */
const SEND_EVERY_NTH_FRAME = 5;

const RealtimeAnalysis: React.FC = () => {
  const frameCountRef = useRef(0);
  const [isRecording, setIsRecording] = useState(false);
  const [timelineData, setTimelineData] = useState<Array<{ timestamp: string; value: number; metric: string }>>([]);
  // 本场 session_id(服务端铸的)。显示出来是为了**:录完要知道跑报告时该给哪个 id** ——
  // 此前它只活在模块变量里,页面上看不见,而"报告里什么都没有"往往就是这个号对不上。
  const [sid, setSid] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [confirmStopOpen, setConfirmStopOpen] = useState(false);
  // 本场征询结果(`audio_only` ⟹ 摄像头根本不打开)。
  const [consent, setConsent] = useState<ConsentMode | null>(null);
  const { selection: devices, update: setDevices } = useDeviceSelection();

  /**
   * 标注 / 保存门禁 / 降级 —— **与 `/interview`、`/research` 同一套**
   * (`useSessionRecording`,一处定义)。
   *
   * ⚠️ **铸号挪到"标注确定之后"了。** 原先 `handleStartRecording` 是先铸号、
   *    再弹标注窗 ⟹ "点了开始又取消"会在盘上留一个**空壳场次目录**。9-28 实测
   *    留下过一个(有 `label.json`、没有 media),而它带着姓名/学号,比纯空壳
   *    更像一场真素材。现在取消 = 干净地什么都没发生。
   */
  const recording = useSessionRecording({
    onPrepareSession: async () => {
      setSessionError(null);
      try {
        // 服务端铸号是**唯一来源**(spec M2);不自己造 id。
        await voiceApi.interview.start();
        const id = getSessionId();
        if (!id) {
          // 服务端回了 200 但没有 id —— 不编一个出来(编了只会把数据写进 NONE 桶)。
          throw new Error('服务端没有返回 session_id');
        }
        setSid(id);
        console.log('🆔 本场会话已开始:', id);
        return true;
      } catch (error: any) {
        const why = error?.response?.data?.detail || error?.message || '未知错误';
        console.error('❌ 会话铸号失败:', error?.response?.data ?? error);
        setSessionError(why);
        // 不编一个 id —— 编了只会把数据写进 NONE 桶:看着成功、其实什么都没有。
        // 这是**整场作废**的条件(比"降级"严重),所以 duration 0 = 不自动消失。
        message.error(
          `会话没有铸成，这一场会录不进任何一场(报告侧排除 NONE 桶)：${why}`, 0);
        return false;
      }
    },
    // 惰性引用:`beginRecording` 在下面才定义(它要用 `useCamera` 的
    // startCamera / startCapture),而这个箭头只在"标注确定之后"才被调用 ——
    // 那时它早已初始化。直接写 `onRecordStart: beginRecording` 会撞上 TDZ。
    onRecordStart: (mode) => { setConsent(mode); void beginRecording(); },
  });

  const { realtimeMetrics, updateRealtimeMetrics } = useAssessmentStore();
  const { videoRef, canvasRef, startCamera, stopCamera, startCapture, stopCapture } = useCamera({
    // 只同意声音 ⟹ **摄像头根本不打开**(见 useCamera 的说明)。
    audioOnly: consent === 'audio_only',
    videoDeviceId: devices.videoDeviceId,
    audioDeviceId: devices.audioDeviceId,
    onFrame: async (frame) => {
      // 再节流一层(见 SEND_EVERY_NTH_FRAME 的说明)
      frameCountRef.current += 1;
      if (frameCountRef.current % SEND_EVERY_NTH_FRAME !== 0) return;

      try {
        console.log('📤 [实时监控] 发送第', frameCountRef.current, '帧...');

        Promise.allSettled([
          // 面部分析
          faceApi.analyzeImage(frame).then(result => {
            if (result.status === 'success' && result.result) {
              const focusScore = result.result.focus_score || 0;

              updateRealtimeMetrics({
                face: {
                  emotion: result.result.emotion?.primary_emotion || 'neutral',
                  au_features: {
                    au_1: result.result.au_features?.au1_inner_brow_raise,
                    au_4: result.result.au_features?.au4_frown,
                    au_6: result.result.au_features?.au6_cheek_raise,
                    au_12: result.result.au_features?.au12_smile,
                  },
                  focus_score: focusScore,
                  tension_score: result.result.tension?.tension_score || 0,
                  symmetry_score: result.result.au_features?.symmetry_score || 0,
                  gaze_stability: 1 - (result.result.au_features?.gaze_deviation || 0),
                  eye_contact_ratio: 1 - (result.result.au_features?.gaze_deviation || 0),
                }
              });

              // 更新时间线数据
              const now = new Date();
              const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

              setTimelineData(prev => {
                const newData = [...prev, { timestamp: timeStr, value: focusScore, metric: '专注度' }];
                // 只保留最近20个数据点
                return newData.slice(-20);
              });
            }
          }).catch(err => {
            console.warn('⚠️ 面部分析失败:', err.message);
          }),

          // 手势分析
          gestureApi.analyzeGesture(frame).then(result => {
            if (result.status === 'success' && result.result) {
              // 与 AssessmentPage 同一口径:一并把"这次到底有没有测到"传上去。
              // 服务端没检测到姿态时会把分**填成 50.0**,光看数量分不出真假。
              const hands = result.result.detected_hands || 0;
              const hand = result.result.hand;
              updateRealtimeMetrics({
                gesture: {
                  detected_hands: hands,
                  hand_score: hand?.average_score || 0,
                  shoulder_score: result.result.shoulder?.shoulder_score || 0,
                  left_arm_score: result.result.arm?.left?.arm_score || 0,
                  right_arm_score: result.result.arm?.right?.arm_score || 0,
                  // 没测到就**不给值**:填 0 会被下面渲染成"0.0%"(看着像测到了一个很小的抖动)
                  jitter: hand?.left?.jitter !== undefined
                    ? (hand.left.jitter + (hand.right?.jitter || 0)) / 2
                    : undefined,
                  hand_valid: hands > 0,
                  shoulder_valid: result.result.shoulder?.is_valid === true,
                }
              });
            }
          }).catch(err => {
            console.warn('⚠️ 手势分析失败:', err.message);
          })
        ]);
      } catch (error) {
        console.error('❌ 帧处理错误:', error);
      }
    },
    frameRate: 5,

    // M2.6:整场**原生音视频**录完 → 上传留存(spec §5.3/§5.4)。一场一个 `camera.webm`。
    // ⚠️ 此前这一页**没传**这个参数,而 `useCamera` 只在有它时才挂 `MediaRecorder`
    //    ⟹ 这一页录不出视频、录不出音频、也没有转写(交接日志 §7.2 限制 ①)。
    // ⚠️ 视频与音频在**同一条流**里(R5 实测 `audio:live, video:live`),一个 blob 两样都有。
    onVideoReady: (video) => {
      console.log('🎥 本场原生录像收尾，准备上传:', video.size, 'bytes');
      // ⚠️ **必须 return 这个 promise**:useCamera 拿它当"什么时候可以撤掉
      //    「刷新会丢录像」拦截"的信号。录像整场只活在内存里,blob 到手 ≠ 存下了 ——
      //    不 return 的话拦截在上传发出前就撤了,那几秒里刷新/关页 = 整场录像永久丢失。
      // ⚠️ 这个 promise **只在留存确认(或使用者明确放弃)之后才落定**:失败时它继续
      //    悬着,于是刷新拦截继续生效。理由与实现都在 `useSessionRecording` 里。
      return recording.submitVideo(video);
    },

    // 降级不是失败,但**必须让录的人当场知道** —— 这一场留下的素材与"正常那一场"
    // 不是一回事,事后只看文件是看不出来的(交接日志 §7.4 第 3 条)。
    // 两处都要:toast 是当场看见,**横幅是留在页面上的凭证**(8 秒后溜走的提示
    // 等于没有凭证 —— 转过头就分不清这场算不算数)。两样都在 hook 里。
    onDegraded: recording.addDegraded,
  });

  /** 真正开录。由标注弹窗的「确定」经 hook 调过来 —— 顺序是**先有标注、再开录**:
   *  弹出弹窗那一刻什么都还没采,取消就是干净地什么都没发生。 */
  const beginRecording = async () => {
    setIsRecording(true);
    message.success('开始录制');

    // 摄像头没打开就别装作开始了。⚠️ 此前**不看**这个返回值 ⟹ 摄像头/麦克风
    // 没打开时界面一切正常,却一帧都没有、也没有原生录像 —— 直到事后对账才发现。
    // (与 `AssessmentPage` 同一处置;这是**整场作废**,所以不自动消失。)
    const ok = await startCamera();
    if (!ok) {
      setIsRecording(false);
      message.error('摄像头/麦克风没有打开 —— 这一场采不到任何画面与原生视频', 0);
      return;
    }
    setTimeout(() => {
      startCapture();
    }, 500);
  };

  /** 点「开始录制」→ **先弹标注窗**。铸号由 hook 在"确定"之后调
   *  `onPrepareSession`(理由见那里的说明:取消不留空壳场次目录)。 */
  const handleStartRecording = () => {
    // 保存门禁:上一场的录像还没确认留存 ⟹ 不许开新的一场。
    // 使用者的裁定:素材没落定就不算"结束录制"。这条挡住的正是"上一场还在上传,
    // 手已经点到下一场去了、然后刷新"这类把两场一起搞丢的操作。
    if (recording.saveState !== 'idle') {
      message.warning('上一场的录像还没确认留存 —— 先把它处理掉再开下一场', 0);
      return;
    }
    // 把上一场留在页面上的东西清干净。不清的话:`frameCountRef` 会接着上一场数
    // (节流点错位)、时间线会串场、上一场的标注会挂在新场上。
    frameCountRef.current = 0;
    setTimelineData([]);
    recording.reset();
    recording.openLabelModal(true);
  };

  /** 停录的二次确认。停录不可逆 —— 录像整场只在内存里,`stopCapture` 之后
   *  立刻上传那一份,不能再往这一场里补录。 */
  const handleStopRecording = () => setConfirmStopOpen(true);

  const confirmStopRecording = () => {
    setConfirmStopOpen(false);
    setIsRecording(false);
    stopCapture();
    // 停完就**问留存 / 不留存** —— 不自动上传,也不自动丢。
    setTimeout(() => recording.beginChoice(), 300);
    message.info('已停止录制 —— 请确认本场怎么处理');
  };

  // 五维雷达:五个量**都测到了**才画。
  //
  // ⚠️ 此前每个量都带一个写死的默认值(`|| 0.75` / `|| 0.3` / `|| 80` / `|| 0.7`),
  //    于是一个量都没测到时也能画出一张漂亮的雷达图 —— 而那五个数全是编的。
  //    "没数据"在该页必须是"数据不足",不是一张好看的图。
  // 另:这五个输入(focus_score / tension_score / hand_score / symmetry_score /
  //    gaze_stability)在**报告层都已停用**,所以这张图只是实时粗看,不是报告口径 ——
  //    报告那五维要走证据门(见 report_frontend/research_mapper.py)。
  const face = realtimeMetrics.face;
  const gesture = realtimeMetrics.gesture;
  const radarInputs: Array<[keyof typeof RADAR_LABELS, number | undefined]> = [
    ['logical_thinking', face ? Math.round(face.focus_score * 100) : undefined],
    ['stress_resilience', face ? Math.round((1 - face.tension_score) * 100) : undefined],
    ['communication_fluency', gesture ? Math.round(gesture.hand_score) : undefined],
    ['confidence_level', face ? Math.round(face.symmetry_score * 100) : undefined],
    ['cognitive_efficiency', face ? Math.round(face.gaze_stability * 100) : undefined],
  ];
  const missingRadar = radarInputs.filter(([, v]) => v === undefined)
    .map(([k]) => RADAR_LABELS[k]);
  const radarData = Object.fromEntries(
    radarInputs.map(([k, v]) => [k, v ?? 0])
  ) as { logical_thinking: number; stress_resilience: number; communication_fluency: number;
         confidence_level: number; cognitive_efficiency: number };


  useEffect(() => {
    return () => {
      stopCamera();
      stopCapture();
    };
  }, []);


  return (
    <Content style={{ padding: '24px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0 }}>实时分析</h2>
            {/* 本场 session_id 必须看得见:录完要拿它去跑报告(报告按 id 取每个模态的日志),
                而它此前只活在 api.ts 的模块变量里 —— 页面上看不见,对不上号时无从查起。 */}
            <div style={{ fontSize: '13px', marginTop: '4px', color: sid ? '#52c41a' : '#999' }}>
              {sid ? `本场 session_id：${sid}`
                : sessionError ? `未铸到会话：${sessionError}`
                : '尚未开始会话(点「开始录制」时铸号)'}
            </div>
            {/* 本场标注显示**服务端回的那一个**(不是本地拼的)。旁边留一个「改标签」——
                端点本来就是 upsert,顺手防住"打错一个字就永久错了"。 */}
            {(recording.savedLabel || sid) && (
              <div style={{ fontSize: '13px', marginTop: '4px', color: recording.savedLabel ? '#1890ff' : '#999' }}>
                {recording.savedLabel
                  ? <>本场标注：{recording.savedLabel}{' '}
                      <a style={{ cursor: 'pointer' }} onClick={() => recording.openLabelModal(false)}>改标签</a>
                    </>
                  : <>本场还没有标注{' '}
                      <a style={{ cursor: 'pointer' }} onClick={() => recording.openLabelModal(false)}>去填</a>
                    </>}
              </div>
            )}
          </div>
          <button
            onClick={isRecording ? handleStopRecording : handleStartRecording}
            disabled={!isRecording && recording.saveState !== 'idle'}
            title={!isRecording && recording.saveState !== 'idle' ? '上一场的录像还没确认留存' : undefined}
            style={{
              padding: '8px 24px',
              fontSize: '14px',
              background: isRecording ? '#ff4d4f' : recording.saveState !== 'idle' ? '#d9d9d9' : '#1890ff',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: (!isRecording && recording.saveState !== 'idle') ? 'not-allowed' : 'pointer'
            }}
          >
            {isRecording ? '停止录制'
              : recording.saveState === 'saving' ? '正在保存…'
              : recording.saveState === 'failed' ? '先处理上一场'
              : '开始录制'}
          </button>
        </div>

        {/* 采集状态的两条**持久**告示。它们都必须留在页面上,不能只弹一个几秒后
            自己溜走的 toast —— 事后对着文件是看不出"这一场算不算数"的。 */}
        {sessionError && (
          <Alert
            type="error" showIcon style={{ marginBottom: '16px' }}
            message="本场没有会话号 —— 录下来的东西不属于任何一场"
            description={`报告侧整体排除 NONE 桶,所以这一场进不了报告。原因：${sessionError}`}
          />
        )}
        <LabelErrorBanner error={recording.labelError} />
        {consent === 'audio_only' && (
          <Alert
            type="info" showIcon style={{ marginBottom: 16 }}
            message="本场只采声音 —— 摄像头没有被打开"
            description="这是征询时选定的范围,不是故障。面部与手势两个维度本场没有数据。"
          />
        )}
        <DegradedBanner reasons={recording.degraded} />

        {/* 视频流 */}
        {isRecording && (
          <Row gutter={[24, 24]} style={{ marginBottom: '24px' }}>
            <Col span={24}>
              <CameraView
                videoRef={videoRef}
                canvasRef={canvasRef}
                title="实时视频流"
              />
            </Col>
          </Row>
        )}

        {/* 第一行：三个分析卡片 */}
        <Row gutter={[24, 24]} style={{ marginBottom: '24px' }}>
          <Col xs={24} md={8}>
            <Card title="面部表情分析" variant="borderless">
              {realtimeMetrics.face ? (
                <div style={{ padding: '16px' }}>
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>情绪状态</div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1890ff' }}>
                      {realtimeMetrics.face.emotion === 'happy' ? '😊 开心' :
                       realtimeMetrics.face.emotion === 'sad' ? '😢 悲伤' :
                       realtimeMetrics.face.emotion === 'angry' ? '😠 愤怒' :
                       realtimeMetrics.face.emotion === 'surprised' ? '😲 惊讶' :
                       realtimeMetrics.face.emotion === 'fearful' ? '😨 恐惧' :
                       realtimeMetrics.face.emotion === 'disgusted' ? '🤢 厌恶' :
                       '😐 中性'}
                    </div>
                  </div>

                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>专注度</div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#52c41a' }}>
                      {Math.round((realtimeMetrics.face.focus_score || 0) * 100)}%
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>紧张度</div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#ff4d4f' }}>
                      {Math.round((realtimeMetrics.face.tension_score || 0) * 100)}%
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
                  {isRecording ? '等待数据...' : '点击"开始录制"'}
                </div>
              )}
            </Card>
          </Col>

          <Col xs={24} md={8}>
            <Card title="手势姿态分析" variant="borderless">
              {realtimeMetrics.gesture ? (
                <div style={{ padding: '16px' }}>
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>检测到手部</div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1890ff' }}>
                      {realtimeMetrics.gesture.detected_hands} 只
                    </div>
                  </div>

                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>手部姿态评分</div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#52c41a' }}>
                      {realtimeMetrics.gesture.hand_score}/100
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>肩部稳定度</div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#faad14' }}>
                      {realtimeMetrics.gesture.shoulder_score}/100
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
                  {isRecording ? '等待数据...' : '点击"开始录制"'}
                </div>
              )}
            </Card>
          </Col>

          <Col xs={24} md={8}>
            <Card title="眼动轨迹热力图" variant="borderless">
              {/* ⚠️ 这里原先喂的是 `Math.random()` 造的 10 个点 —— 一张**完全编造**的
                  轨迹热力图。报告层早就按 spec §5.5 决定不生成眼动图(现有坐标支撑不了
                  "注视"这个构念),前端却在画随机点,两处自相矛盾。宁可空着。 */}
              <div style={{ height: '200px', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', color: '#999', textAlign: 'center',
                            padding: '0 24px' }}>
                待接入 —— 眼动图需要能支撑「注视」构念的坐标(现用的是画面坐标,是取景代理),
                报告层同样不出这张图
              </div>
            </Card>
          </Col>
        </Row>

        {/* 第二行：时间线和雷达图 */}
        <Row gutter={[24, 24]} style={{ marginBottom: '24px' }}>
          <Col xs={24} md={12}>
            <Card title="专注度变化趋势" variant="borderless">
              {timelineData.length > 0 ? (
                <TimelineChart
                  data={timelineData}
                  title="专注度实时曲线"
                  metricName="专注度"
                />
              ) : (
                <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
                  等待数据采集...
                </div>
              )}
            </Card>
          </Col>

          <Col xs={24} md={12}>
            <Card title="五维能力雷达图（实时粗看，非报告口径）" variant="borderless">
              {missingRadar.length === 0 ? (
                <RadarChart dimensions={radarData} />
              ) : (
                <div style={{ height: '300px', display: 'flex', alignItems: 'center',
                              justifyContent: 'center', color: '#999', textAlign: 'center',
                              padding: '0 24px' }}>
                  数据不足，暂不出图：还缺 {missingRadar.join('、')}
                </div>
              )}
            </Card>
          </Col>
        </Row>

        {/* 第三行：实时数据流 */}
        <Card title="实时数据流" variant="borderless">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
            <div style={{ padding: '16px', background: '#f0f5ff', borderRadius: '8px' }}>
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>AU12 (微笑)</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2E86AB' }}>
                {(realtimeMetrics.face?.au_features?.au_12 || 0).toFixed(2)}
              </div>
            </div>
            <div style={{ padding: '16px', background: '#fff1f0', borderRadius: '8px' }}>
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>紧张度</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ff4d4f' }}>
                {Math.round((realtimeMetrics.face?.tension_score || 0) * 100)}%
              </div>
            </div>
            <div style={{ padding: '16px', background: '#f6ffed', borderRadius: '8px' }}>
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>眼神稳定性</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#52c41a' }}>
                {Math.round((realtimeMetrics.face?.gaze_stability || 0) * 100)}%
              </div>
            </div>
            <div style={{ padding: '16px', background: '#fff7e6', borderRadius: '8px' }}>
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>动作抖动指数</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#faad14' }}>
                {/* 同 RealtimeMetrics:判 "这一帧有没有手",不是判"有没有值" —— 
                    服务端没检测到手时仍回 0.0,那道判据等于没判 */}
                {realtimeMetrics.gesture?.hand_valid && realtimeMetrics.gesture?.jitter !== undefined
                  ? `${(realtimeMetrics.gesture.jitter * 100).toFixed(1)}%`
                  : '未检出'}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* ── 四个弹窗全部来自 `RecordingDialogs`(与 `/interview`、`/research` 同一套)。
          此前它们在这一页里手写了一遍,而那套纪律现在要在三个页面成立 ——
          抄三遍的下场就是本仓反复栽过的"几处各自算一遍,然后静默分叉"。 */}
      <LabelModal
        open={recording.labelModalOpen}
        thenRecord={recording.labelThenRecord}
        fields={recording.labelFields}
        onChange={recording.setLabelFields}
        onOk={recording.submitLabel}
        onCancel={() => recording.setLabelModalOpen(false)}
        saving={recording.savingLabel}
        sid={sid}
        error={recording.labelError}
      />

      <ConsentModal
        open={recording.consentModalOpen}
        onOk={recording.confirmConsent}
        onDecline={recording.declineConsent}
        label={recording.savedLabel}
        saving={recording.savingLabel}
        devicePicker={<DevicePicker value={devices} onChange={setDevices} />}
      />

      <StopConfirmModal
        open={confirmStopOpen}
        onOk={confirmStopRecording}
        onCancel={() => setConfirmStopOpen(false)}
        label={recording.savedLabel}
        sid={sid}
      />

      <SaveGateModal
        saveState={recording.saveState}
        savedInfo={recording.savedInfo}
        saveError={recording.saveError}
        onKeep={recording.chooseKeep}
        onDiscard={recording.chooseDiscard}
        onRetry={recording.retryLast}
        onAbandon={() => recording.setConfirmAbandonOpen(true)}
        onClose={() => recording.reset()}
      />

      <AbandonConfirmModal
        open={recording.confirmAbandonOpen}
        onOk={recording.abandonUpload}
        onCancel={() => recording.setConfirmAbandonOpen(false)}
        label={recording.savedLabel}
        sid={sid}
      />
    </Content>
  );
};

export default RealtimeAnalysis;

