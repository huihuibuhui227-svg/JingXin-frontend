import React, { useState, useEffect, useRef } from 'react';
import { Layout, Row, Col, Card, Alert, message } from 'antd';
import { useCamera } from '@/hooks/useCamera';
import { faceApi, gestureApi, sessionApi, voiceApi, getSessionId } from '@/services/api';
import { useAssessmentStore } from '@/store/assessmentStore';
import RadarChart from '@/components/visualization/RadarChart';
import TimelineChart from '@/components/visualization/TimelineChart';
import CameraView from '@/components/assessment/CameraView';

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
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [timelineData, setTimelineData] = useState<Array<{ timestamp: string; value: number; metric: string }>>([]);
  // 本场 session_id(服务端铸的)。显示出来是为了**:录完要知道跑报告时该给哪个 id** ——
  // 此前它只活在模块变量里,页面上看不见,而"报告里什么都没有"往往就是这个号对不上。
  const [sid, setSid] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  // 采集**降级**的凭证。见 onDegraded:要被留在页面上,不只是弹一下。
  const [degraded, setDegraded] = useState<string[]>([]);

  const { realtimeMetrics, updateRealtimeMetrics } = useAssessmentStore();
  const { videoRef, canvasRef, startCamera, stopCamera, startCapture, stopCapture } = useCamera({
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
      return sessionApi.uploadMedia(video)
        .then((result) => {
          if (result?.stored === false) {
            // 服务端**明说没存下**(留存被关 / 中途写失败)—— 不许当成功。
            console.error('❌ 原生录像没有被留存:', result.reason);
            message.error(`本场原生录像没存下：${result.reason}`, 0);
          } else {
            console.log('✅ 原生录像已留存:', result);
            message.success('本场原生录像已留存');
          }
        })
        .catch((error) => {
          // 没有会话 id / 网络断 ⟹ 整场录像没留成。这是**不可逆**的损失,必须说出来,
          // 不能只进 console(本项目在杀的静默失效)。
          console.error('❌ 原生录像上传失败:', error?.response?.data ?? error);
          const detail = error?.response?.data?.detail;
          message.error(
            detail
              ? `本场原生录像没有留存：${detail}`
              : '本场原生录像上传失败 —— 这一场的原生视频没有留存',
            0
          );
        });
    },

    // 降级不是失败,但**必须让录的人当场知道** —— 这一场留下的素材与"正常那一场"
    // 不是一回事,事后只看文件是看不出来的(交接日志 §7.4 第 3 条)。
    // 两处都要:toast 是当场看见,**横幅是留在页面上的凭证**(8 秒后溜走的提示
    // 等于没有凭证 —— 转过头就分不清这场算不算数)。
    onDegraded: (reason) => {
      console.warn('⚠️ 采集降级:', reason);
      setDegraded((prev) => (prev.includes(reason) ? prev : [...prev, reason]));
      message.warning(reason, 8);
    }
  });

  // ★ 铸号:进页面时向服务端要一个 session_id(M2:服务端铸号是**唯一来源**)。
  //
  // 不起会话会怎样(这一页此前的状态):face / gesture 的请求不带 session_id
  // ⟹ 全部落进 `NONE` 桶 ⟹ 报告侧整体排除 NONE ⟹ **录了等于没录**。
  // (交接日志 §7.2 限制 ③;NONE 桶涨到 514 行就是这个形态攒出来的。)
  //
  // ⚠️ **只铸一次**。StrictMode 下 effect 会跑两遍,而"中途重铸"会把一场的数据劈成
  //    两场 —— 三份日志按 id 分文件,报告只看其中一场。交接日志 §6 实测踩过:
  //    `..._afb2`(299 帧)之后手滑重开得到 `..._e70e`(5 帧空壳),看报告时看到的是后者。
  // ⚠️ 把 promise 存进 ref,`开始监控` 要 `await` 它 —— 否则号还在飞的路上就开始发帧了,
  //    那几帧照样落 NONE。**"号先到、帧后发"要由顺序保证,不能靠祈祷。**
  const mintRef = useRef<Promise<void> | null>(null);
  // 失败原文另存一份 ref:`handleStartMonitoring` 里要把它念出来,而那里的闭包是
  // **点击那一刻**的渲染 —— 铸号刚刚失败时 state 还没传过去,读 state 会读到 null。
  const sessionErrorRef = useRef<string | null>(null);
  useEffect(() => {
    if (mintRef.current) return;
    mintRef.current = voiceApi.interview.start()
      .then(() => {
        const id = getSessionId();
        setSid(id);
        if (!id) {
          // 服务端回了 200 但没有 id —— 不编一个出来(编了只会把数据写进 NONE 桶)。
          throw new Error('服务端没有返回 session_id');
        }
        console.log('🆔 本场会话已开始:', id);
      })
      .catch((error) => {
        const why = error?.response?.data?.detail || error?.message || '未知错误';
        console.error('❌ 会话铸号失败:', error?.response?.data ?? error);
        sessionErrorRef.current = why;
        setSessionError(why);
      });
  }, []);

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

  const handleStartMonitoring = async () => {
    // 1) 先把号等回来。号没到就开始发帧 ⟹ 那几帧落 NONE 桶(报告侧整体排除)。
    if (mintRef.current) await mintRef.current;
    if (!getSessionId()) {
      // 不编一个 id —— 编了只会把数据写进 NONE 桶:看着成功、其实什么都没有。
      // 这是**整场作废**的条件(比"降级"严重),所以 duration 0 = 不自动消失。
      message.error(
        `会话没有铸成,这一场会录不进任何一场(报告侧排除 NONE 桶)：${sessionErrorRef.current ?? '语音服务未响应'}`,
        0
      );
      return;
    }

    setIsMonitoring(true);
    message.success('开始实时监控');

    // 2) 摄像头没打开就别装作开始了。⚠️ 此前**不看**这个返回值 ⟹ 摄像头/麦克风
    //    没打开时界面一切正常,却一帧都没有、也没有原生录像 —— 直到事后对账才发现。
    //    (与 `AssessmentPage` 同一处置;这是**整场作废**,所以不自动消失。)
    const ok = await startCamera();
    if (!ok) {
      setIsMonitoring(false);
      message.error('摄像头/麦克风没有打开 —— 这一场采不到任何画面与原生视频', 0);
      return;
    }
    setTimeout(() => {
      startCapture();
    }, 500);
  };

  const handleStopMonitoring = () => {
    setIsMonitoring(false);
    stopCapture();
    message.info('已停止监控');
  };

  return (
    <Content style={{ padding: '24px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0 }}>实时分析</h2>
            {/* 本场 session_id 必须看得见:录完要拿它去跑报告(报告按 id 取每个模态的日志),
                而它此前只活在 api.ts 的模块变量里 —— 页面上看不见,对不上号时无从查起。 */}
            <div style={{ fontSize: '13px', marginTop: '4px', color: sid ? '#52c41a' : '#999' }}>
              {sid ? `本场 session_id：${sid}` : sessionError ? `未铸到会话：${sessionError}` : '正在铸会话号…'}
            </div>
          </div>
          <button
            onClick={isMonitoring ? handleStopMonitoring : handleStartMonitoring}
            style={{
              padding: '8px 24px',
              fontSize: '14px',
              background: isMonitoring ? '#ff4d4f' : '#1890ff',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            {isMonitoring ? '停止监控' : '开始监控'}
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
        {degraded.length > 0 && (
          <Alert
            type="warning" showIcon style={{ marginBottom: '16px' }}
            message="本场采集有降级 —— 这一场的素材与「正常那一场」不是一回事"
            description={
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                {degraded.map((reason) => <li key={reason}>{reason}</li>)}
              </ul>
            }
          />
        )}

        {/* 视频流 */}
        {isMonitoring && (
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
                  {isMonitoring ? '等待数据...' : '点击"开始监控"'}
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
                  {isMonitoring ? '等待数据...' : '点击"开始监控"'}
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
    </Content>
  );
};

export default RealtimeAnalysis;

