import React, { useState, useEffect, useRef } from 'react';
import { Layout, Progress, Alert, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useCamera } from '@/hooks/useCamera';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useAssessment } from '@/hooks/useAssessment';
import { useSessionRecording } from '@/hooks/useSessionRecording';
import { useAssessmentStore } from '@/store/assessmentStore';
import { faceApi, gestureApi, voiceApi, getSessionId } from '@/services/api';
import CameraView from '@/components/assessment/CameraView';
import RealtimeMetrics from '@/components/assessment/RealtimeMetrics';
import QuestionCard from '@/components/assessment/QuestionCard';
import AnswerInput from '@/components/assessment/AnswerInput';
import Loading from '@/components/common/Loading';
import {
  AbandonConfirmModal, DegradedBanner, LabelErrorBanner, LabelModal, SaveGateModal,
  StopConfirmModal,
} from '@/components/recording/RecordingDialogs';

const { Content } = Layout;

interface AssessmentConfig {
  type: 'interview' | 'research';
  title: string;
  subtitle: string;
  inProgressTitle: string;
  startButtonText: string;
  startButtonColor: string;
  loadingTip: string;
}

const CONFIG: Record<'interview' | 'research', AssessmentConfig> = {
  interview: {
    type: 'interview',
    title: '面试评估',
    subtitle: '系统将进行多维度分析，包括面部表情、手势姿态、语音内容等',
    inProgressTitle: '面试评估进行中',
    startButtonText: '开始面试',
    startButtonColor: '#1890ff',
    loadingTip: '正在启动面试...',
  },
  research: {
    type: 'research',
    title: '科研能力评估',
    subtitle: '系统将评估您的科研思维能力，包括逻辑推理、问题分析、创新思维等维度',
    inProgressTitle: '科研评估进行中',
    startButtonText: '开始评估',
    startButtonColor: '#52c41a',
    loadingTip: '正在启动科研评估...',
  },
};

interface AssessmentPageProps {
  assessmentType: 'interview' | 'research';
}

const AssessmentPage: React.FC<AssessmentPageProps> = ({ assessmentType }) => {
  const config = CONFIG[assessmentType];
  const navigate = useNavigate();
  const [started, setStarted] = useState(false);
  // 本场**已结束**(答完最后一题,或使用者主动停止)。它与 `started` 分开:
  // `started` 管"摄像头开没开",这个管"这一场还能不能继续答"。
  const [ended, setEnded] = useState(false);
  const [confirmStopOpen, setConfirmStopOpen] = useState(false);
  // 本场 session_id(服务端铸的)。显示出来是为了**录完要知道跑报告时给哪个 id**。
  const [sid, setSid] = useState<string | null>(null);
  // 停录后确认"这一场没有原生录像可存"(见下面那个 effect)。
  const [nothingToSave, setNothingToSave] = useState(false);
  const frameCountRef = useRef(0);

  const { realtimeMetrics, updateRealtimeMetrics, resetAssessment } = useAssessmentStore();

  // ⚠️ 顺序有讲究:`useAssessment` 必须在前(下面要拿它的 `start`),而
  //    `useCamera` 必须在 `useSessionRecording` 之后(它要 `submitVideo`)。
  const {
    loading,
    currentQuestion,
    currentQuestionIndex,
    // 进度分母:服务端在 /interview/start 给的 total_questions(0 = 还不知道,不显示分母)
    totalQuestions: questionTotal,
    start,
    submitAnswer,
    playQuestion
  } = useAssessment(config.type);

  /**
   * 标注 / 保存门禁 / 降级 —— 与 `/analysis` **同一套**(同一个 hook,一处定义)。
   *
   * 改之前这一页的做法:点「开始面试」就直接铸号开录,答完最后一题 **1.5 秒后
   * 自动跳走**,而录像是在卸载时才上传的 —— **存没存下,当场没人知道**。
   * 9-28 那场 2.1 GB 的丢失事故里,有一场 7.3 分钟的录像就是这么没的。
   */
  const recording = useSessionRecording({
    // 铸号发生在**标注确定之后**:标注弹窗先收集,确定后才 `start()`
    // (它铸号 + 拿题)。取消 = 盘上干干净净,不留空壳目录。
    onPrepareSession: async () => {
      const ok = await start();
      if (!ok) {
        // `useAssessment.start()` 已经喊过具体原因了,这里不重复喊。
        message.error('这一场没有开始 —— 会话没有铸成,采不到任何素材', 0);
        return false;
      }
      return true;
    },
    onRecordStart: () => {
      frameCountRef.current = 0;
      setEnded(false);
      // 把服务端刚铸的号显示出来:录完要拿它去跑报告,而"报告里什么都没有"
      // 往往就是这个号对不上。它只活在 api.ts 的模块变量里,页面不显示就无从查起。
      setSid(getSessionId());
      setTimeout(() => setStarted(true), 100);
    },
  });

  const { videoRef, canvasRef, startCamera, stopCamera, startCapture, stopCapture } = useCamera({
    onFrame: async (frame) => {
      frameCountRef.current += 1;
      if (frameCountRef.current % 5 !== 0) return;

      try {
        console.log('📤 发送第', frameCountRef.current, '帧到后端分析...');

        Promise.allSettled([
          faceApi.analyzeImage(frame).then(result => {
            console.log('📊 面部分析结果:', result);

            if (result.status === 'success' && result.result) {
              updateRealtimeMetrics({
                face: {
                  emotion: result.result.emotion?.primary_emotion || 'neutral',
                  au_features: {
                    au_1: result.result.au_features?.au1_inner_brow_raise,
                    au_4: result.result.au_features?.au4_frown,
                    au_6: result.result.au_features?.au6_cheek_raise,
                    au_12: result.result.au_features?.au12_smile,
                  },
                  focus_score: result.result.focus_score || 0,
                  tension_score: result.result.tension?.tension_score || 0,
                  symmetry_score: result.result.au_features?.symmetry_score || 0,
                  gaze_stability: 1 - (result.result.au_features?.gaze_deviation || 0),
                  eye_contact_ratio: 1 - (result.result.au_features?.gaze_deviation || 0),
                }
              });
            }
          }).catch(err => {
            console.warn('⚠️ 面部分析失败:', err.message);
          }),

          gestureApi.analyzeGesture(frame).then(result => {
            console.log('🙌 手势分析结果:', result);

            if (result.status === 'success' && result.result) {
              // ⚠️ 一并把"这次到底有没有测到"传上去。服务端在没检测到姿态时会把分
              //    **填成 50.0**(gesture_analysis/api/app.py 的 shoulder/arm/hand 三处),
              //    所以面板光看数量分不出"测到 50 分"与"什么都没测到"。
              // 手部平均分只有在**检测到手**的时候才是个测量值:
              const hands = result.result.detected_hands || 0;
              const hand = result.result.hand;
              const jitter = hand?.left?.jitter !== undefined
                ? (hand.left.jitter + (hand.right?.jitter || 0)) / 2
                : undefined;   // 没测到就**不给值**:填 0 会被面板渲染成"100% 稳定"
              updateRealtimeMetrics({
                gesture: {
                  detected_hands: hands,
                  hand_score: hand?.average_score || 0,
                  shoulder_score: result.result.shoulder?.shoulder_score || 0,
                  left_arm_score: result.result.arm?.left?.arm_score || 0,
                  right_arm_score: result.result.arm?.right?.arm_score || 0,
                  jitter,
                  hand_valid: hands > 0,
                  shoulder_valid: result.result.shoulder?.is_valid === true,
                  left_arm_valid: result.result.arm?.left?.is_valid === true,
                  right_arm_valid: result.result.arm?.right?.is_valid === true,
                }
              });
            }
          }).catch(err => {
            console.warn('⚠️ 手势分析失败:', err.message);
          })
        ]).then(() => {
          console.log('✅ 本轮分析完成');
        });
      } catch (error) {
        console.error('❌ 帧处理错误:', error);
      }
    },
    frameRate: 5,

    // M2.6:整场**原生音视频**录完 → 上传留存(spec §5.3/§5.4)。一场一个 `camera.webm`。
    // 触发点在 `useCamera.stopCapture` 里(走 ref,卸载清理那条路也到得了)——
    // 挂到 `stopCamera` 的 `if (stream)` 里会**静默丢录像**,理由见 useCamera 顶部注释。
    onVideoReady: (video) => {
      // ⚠️ **必须 return 这个 promise**。改之前这一页在这里只弹了个 8 秒 toast,
      //    然后 handleSubmitAnswer 1.5 秒后就把页面**跳走**了 —— 上传还没落定人已经
      //    在报告页了,存没存下无从得知。现在它交给保存门禁:promise 只在**留存确认**
      //    (或使用者明确放弃)之后才落定,落定前 `useCamera` 的刷新拦截一直挂着。
      return recording.submitVideo(video);
    },

    // 降级不是失败,但**必须让面试官当场知道** —— 这一场留下的素材与"正常那一场"
    // 不是一回事(camera.webm 没声音 / 可能不完整),事后只看文件是看不出来的。
    // 改之前这里只有 `message.warning(reason, 8)`:8 秒后溜走,而"这一场算不算数"
    // 是转过头还要再看一眼的问题 ⟹ 交给常驻横幅。
    onDegraded: recording.addDegraded,
  });

  const { isRecording, startRecording, stopRecording } = useAudioRecorder({
    onAudioData: async (audioBlob) => {
      // ⚠️ 这里原先还塞了 fluency 80 / pitch_variation 0.5 / pause_duration 0.2 /
      // speech_ratio 0.8 —— 那四个是**写死的常数**,不是测出来的;只有 energy 是由
      // 音频字节数真算的。本项目正在做的事就是"让系统输出的每一句话都有依据",
      // 所以只报真有的:energy(算得出)+ voiceActive(音频确实到了)。
      // 其余四个要等真的声学分析接上来,不能先编一个数把面板填满。
      updateRealtimeMetrics({
        voice: {
          energy: Math.min(audioBlob.size / 32768, 1),
          voiceActive: true,
        }
      });
    }
  });

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  useEffect(() => {
    if (!started) {
      stopCapture();
      return;
    }

    console.log('🔄 started 变为 true，准备启动摄像头和捕获...');
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    startCamera().then((ok) => {
      if (cancelled) return;
      if (!ok) {
        // ⚠️ 原先**不看**这个返回值,于是"摄像头没打开"会静默进一场什么都不采的会话:
        //    没有帧、没有原生录像,而界面一切正常 —— 直到收尾对账才发现。
        // duration 0 = 不自动消失。这是**整场作废**的条件,比"降级"严重得多,
        // 反倒不该像降级那样几秒后自己溜走(之前两者时长正好是反的)。
        message.error('摄像头/麦克风没有打开 —— 这一场采不到任何画面与原生视频', 0);
        return;
      }
      console.log('✅ 摄像头启动完成，等待视频元素就绪...');
      timer = setTimeout(() => {
        console.log('⏰ 延迟结束，调用 startCapture');
        startCapture();
      }, 500);
    });

    // ⚠️ 这段 cleanup 原先写在 `.then()` **里面**并 return,于是被丢掉了(effect 本身
    //    返回 undefined ⟹ 没有任何清理)。卸载时那个 500ms 定时器照旧触发,在已卸载的
    //    组件上开出一个永不 clear 的 setInterval,继续往 face/gesture 发已完成场次的帧。
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [started]);

  /** 点「开始面试」→ **先弹标注窗**,不是直接开录。
   *  标注的全部意义就是把这一场与别的场次分开;不填标注的一场在盘上是个裸 sid,
   *  事后认不出是谁 —— 等于白采。所以「取消 = 不开始」。 */
  const handleStart = () => {
    recording.openLabelModal(true);
  };

  /** 结束本场:停帧捕获 → 触发原生录像收尾上传 → 交给保存门禁。
   *  **从这里开始页面不再可交互**,直到素材确认落盘(或使用者明确放弃)。 */
  const endSession = () => {
    setConfirmStopOpen(false);
    setEnded(true);
    setNothingToSave(false);
    stopCapture();
    message.info('本场已停止录制 —— 正在保存原生录像');
  };

  /**
   * **兜底出口**:停录之后门禁迟迟不开,说明这一场**根本没有原生录像可存**。
   *
   * 为什么会有这条路:`useCamera` 在"一个分片都没录到"时**故意不调** `onVideoReady`
   * (不编一份 0 字节的空录像出来),于是保存门禁永远不会开 —— 而本页在 `ended`
   * 之后把答题框和按钮都禁用了 ⟹ **停在一条没有出口的路上,且不说为什么**。
   * 那正是本仓在杀的那类静默失效,所以这里必须自己给出解释和出口。
   */
  useEffect(() => {
    if (!ended || recording.saveState !== 'idle') return;
    const t = setTimeout(() => setNothingToSave(true), 1500);
    return () => clearTimeout(t);
  }, [ended, recording.saveState]);

  const handleSubmitAnswer = async (answer: string, audioFile?: File) => {
    const result = await submitAnswer(answer, audioFile);
    if (!result.hasNext && !result.error) {
      // ⚠️ 改之前这里是 `setTimeout(() => navigate('/reports'), 1500)`。
      //    跳走之后录像才在卸载时上传,而**存没存下当场没人知道**。
      //    现在停在保存门禁上,确认了才放行 —— 这也是使用者 9-28 的裁定。
      endSession();
    }
  };

  /** 换下一场:**把上一场留在页面与 store 里的东西全部清干净**。
   *
   *  ⚠️ `resetAssessment()` 是**必须**的,不是清理癖好:store 的
   *     `currentQuestionIndex` / `answers` / `realtimeMetrics` 都按"一个页面只做一场"
   *     写的,连做两场时**不归零** —— `useAssessment` 的注释已经点名过这个反模式
   *     (「同一个页面里连做两场时它从 10 接着数,不是本场第几题」)。
   *     它的 `resetAssessment` 此前在仓库里**零调用方** = 死代码,这里就是它等的那个调用方。
   *
   *  ⚠️ 只在**换场**时调,**不能**在「去看报告」时调:`evaluationResult` 在 persist
   *     白名单里,报告页靠它短路。
   */
  const handleNextSession = () => {
    recording.reset();
    resetAssessment();
    stopCamera();
    frameCountRef.current = 0;
    setNothingToSave(false);
    setSid(null);
    setEnded(false);
    setStarted(false);
  };

  const handleSpeechToText = async (audioBlob: Blob): Promise<string> => {
    try {
      console.log('🎤 开始语音识别，音频大小:', audioBlob.size, 'bytes');
      console.log('🎤 音频类型:', audioBlob.type);

      const audioFile = new File([audioBlob], 'answer.wav', {
        type: 'audio/webm',
        lastModified: Date.now()
      });

      console.log('🎤 调用 ASR API...');

      // `record: false` —— 这一遍是**预览**(填输入框给面试官看/改),不是回答。
      // 提交时同一份音频还会走 `/interview/answer_audio`,那一条才是账本上的回答;
      // 不标这一下,同一句话会在 transcript.json 里存两遍(2026-09-26 实测)。
      const result = await voiceApi.speechToText(audioFile, { record: false });

      console.log('✅ 语音识别原始结果:', JSON.stringify(result, null, 2));

      const recognizedText = result.text || result.recognized_text || result.result || '';
      console.log('✅ 提取的文本:', recognizedText);

      return recognizedText;
    } catch (error: any) {
      console.error('❌ 语音识别失败:', error);
      console.error('❌ 错误详情:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });

      console.warn('⚠️ 使用模拟文本（后端 ASR 未就绪）');
      return '[语音识别服务暂时不可用，请手动输入]';
    }
  };

  if (loading) {
    return <Loading fullScreen tip={config.loadingTip} />;
  }

  if (!started) {
    return (
      <Content style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h1>{config.title}</h1>
          <p style={{ fontSize: '16px', color: '#666', marginBottom: '40px' }}>
            {config.subtitle}
          </p>
          <button
            onClick={handleStart}
            style={{
              padding: '12px 48px',
              fontSize: '18px',
              background: config.startButtonColor,
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            {config.startButtonText}
          </button>
          <p style={{ marginTop: '20px', fontSize: '13px', color: '#999' }}>
            点开始之后会先请你填本场标注(谁、哪个院系)—— 填完才开录。
            没标注的一场事后认不出是谁,等于白采。
          </p>
        </div>

        <LabelModal
          open={recording.labelModalOpen}
          thenRecord={recording.labelThenRecord}
          fields={recording.labelFields}
          onChange={recording.setLabelFields}
          onOk={recording.submitLabel}
          onCancel={() => recording.setLabelModalOpen(false)}
          saving={recording.savingLabel}
          sid={null}
          error={recording.labelError}
        />
      </Content>
    );
  }

  const busy = recording.saveState !== 'idle' || ended;

  return (
    <Content style={{ padding: '24px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <DegradedBanner reasons={recording.degraded} />
        <LabelErrorBanner error={recording.labelError} />

        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0 }}>{config.inProgressTitle}</h2>
            {/* 本场 session_id 必须看得见:录完要拿它去跑报告(报告按 id 取每个模态的
                日志),而"报告里什么都没有"往往就是这个号对不上。 */}
            <div style={{ fontSize: '13px', marginTop: '4px', color: sid ? '#52c41a' : '#999' }}>
              {sid ? `本场 session_id：${sid}` : '尚未铸到会话号'}
            </div>
            {recording.savedLabel && (
              <div style={{ fontSize: '13px', marginTop: '4px', color: '#1890ff' }}>
                本场标注：{recording.savedLabel}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* ⚠️ 这里原先写 `currentQuestionIndex / 10`,而标题那处写 `currentIndex + 1`
                —— 同一个数一处加一、一处没加,**永远差 1**(使用者 2026-09-26 当场看到
                「我这边 7/10、那边 6/10」)。分母 10 也是写死的,题库只有 8 题,进度条
                永远到不了 100%。现在两处同源,分母由服务端在 /interview/start 给出。 */}
            <Progress
              percent={questionTotal > 0
                ? Math.round(((currentQuestionIndex + 1) / questionTotal) * 100)
                : 0}
              format={() => (questionTotal > 0
                ? `进度 ${currentQuestionIndex + 1}/${questionTotal}`
                : `进度 ${currentQuestionIndex + 1}`)}
              style={{ width: '300px' }}
            />
            <button
              onClick={() => setConfirmStopOpen(true)}
              disabled={busy}
              title={busy ? '本场已经结束或正在保存' : undefined}
              style={{
                padding: '8px 20px', fontSize: '14px', borderRadius: '6px',
                background: busy ? '#d9d9d9' : '#ff4d4f', color: '#fff',
                border: 'none', cursor: busy ? 'not-allowed' : 'pointer'
              }}
            >
              ⏹ 停止录制
            </button>
          </div>
        </div>

        {ended && !nothingToSave && (
          <p style={{ color: '#666', marginTop: '-12px', marginBottom: '16px' }}>
            本场已结束 —— 等原生录像确认留存之后才能开始下一场。
          </p>
        )}

        {/* 兜底出口。`useCamera` 在没有原生分片时**故意不调** onVideoReady(不编一份
            空录像),于是门禁不会开 —— 若不给出口,这一页就停在没有解释的死路上。 */}
        {nothingToSave && (
          <Alert
            type="warning" showIcon style={{ marginBottom: 16 }}
            message="本场已结束，但没有原生录像可留存"
            description={
              <div>
                <p style={{ margin: '0 0 10px' }}>
                  帧与日志照常落了盘,但**这一场没有 `camera.webm`** ——
                  摄像头可能没起来,或这条流在中途就断了。原因见下面的降级告警。
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => navigate('/reports')}
                    style={{ padding: '6px 20px', background: '#fff', color: '#1890ff', border: '1px solid #1890ff', borderRadius: '6px', cursor: 'pointer' }}>
                    去看报告
                  </button>
                  <button onClick={handleNextSession}
                    style={{ padding: '6px 20px', background: '#52c41a', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                    录下一场
                  </button>
                </div>
              </div>
            }
          />
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
          <CameraView
            videoRef={videoRef}
            canvasRef={canvasRef}
            title="实时视频"
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <QuestionCard
              question={currentQuestion}
              currentIndex={currentQuestionIndex}
              totalQuestions={questionTotal}
              onPlayAudio={playQuestion}
            />

            <RealtimeMetrics metrics={realtimeMetrics} />
          </div>
        </div>

        <AnswerInput
          onSubmit={handleSubmitAnswer}
          onSpeechToText={handleSpeechToText}
          isRecording={isRecording}
          onStartRecording={startRecording}
          onStopRecording={stopRecording}
          disabled={busy}
        />
      </div>

      <StopConfirmModal
        open={confirmStopOpen}
        onOk={endSession}
        onCancel={() => setConfirmStopOpen(false)}
        label={recording.savedLabel}
        sid={sid}
      />

      {/* 保存门禁:`saved` 时额外给两个出口 —— 这一页录完一场通常还要录下一场。 */}
      <SaveGateModal
        saveState={recording.saveState}
        savedInfo={recording.savedInfo}
        saveError={recording.saveError}
        onRetry={recording.retryUpload}
        onAbandon={() => recording.setConfirmAbandonOpen(true)}
        onClose={() => recording.reset()}
        hideDefaultOk
        extraActions={
          <>
            <button onClick={() => navigate('/reports')}
              style={{ padding: '6px 20px', background: '#fff', color: '#1890ff', border: '1px solid #1890ff', borderRadius: '6px', cursor: 'pointer' }}>
              去看报告
            </button>
            <button onClick={handleNextSession}
              style={{ padding: '6px 20px', background: '#52c41a', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
              录下一场
            </button>
          </>
        }
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

export default AssessmentPage;
