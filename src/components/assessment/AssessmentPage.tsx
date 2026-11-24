import React, { useState, useEffect, useRef } from 'react';
import { Layout, Progress, Alert, Button, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useCamera } from '@/hooks/useCamera';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useAssessment, AssessmentScenarioType } from '@/hooks/useAssessment';
import { useSessionRecording } from '@/hooks/useSessionRecording';
import { useAssessmentStore } from '@/store/assessmentStore';
import { faceApi, gestureApi, voiceApi, getSessionId, setPrivacyMode } from '@/services/api';
import CameraView from '@/components/assessment/CameraView';
import RealtimeMetrics from '@/components/assessment/RealtimeMetrics';
import QuestionCard from '@/components/assessment/QuestionCard';
import AnswerInput from '@/components/assessment/AnswerInput';
import Loading from '@/components/common/Loading';
import {
  AbandonConfirmModal, ConsentModal, DegradedBanner, LabelErrorBanner, LabelModal,
  SaveGateModal, StopConfirmModal,
} from '@/components/recording/RecordingDialogs';
import type { ConsentMode } from '@/components/recording/RecordingDialogs';
import DevicePicker, { useDeviceSelection } from '@/components/recording/DevicePicker';
import PreflightGate from '@/components/assessment/PreflightGate';
import { createAnalysisHealth } from '@/utils/analysisHealth';

const { Content } = Layout;

interface AssessmentConfig {
  type: AssessmentScenarioType;
  badge: string;
  title: string;
  subtitle: string;
  inProgressTitle: string;
  startButtonText: string;
  startButtonColor: string;
  loadingTip: string;
}

const CONFIG: Record<AssessmentScenarioType, AssessmentConfig> = {
  interview: {
    type: 'interview',
    badge: '面试过程观测 · 基地一',
    title: '面试行为采集与观测',
    subtitle: '按题库顺序完成问答，同步记录面部动作、上肢姿态与语音转写，结束后自动生成行为证据报告。',
    inProgressTitle: '面试采集进行中',
    startButtonText: '开始面试采集',
    startButtonColor: 'var(--ax-primary)',
    loadingTip: '正在启动面试采集会话...',
  },
  research: {
    type: 'research',
    badge: '科研过程观测 · 基地一（60% 主线）',
    title: '科研行为采集与观测',
    subtitle: '记录科研汇报与课题问答过程中的多模态行为数据与语音转写，结束后自动生成行为证据报告。',
    inProgressTitle: '科研采集进行中',
    startButtonText: '开始科研采集',
    startButtonColor: 'var(--ax-primary)',
    loadingTip: '正在启动科研采集会话...',
  },
  metacognition: {
    type: 'metacognition',
    badge: 'AI 元能力三阶段审辨实训 · 基地二（30% 拓展）',
    title: 'AI 元能力与求职审辨实训',
    subtitle: '围绕「阅读 AI 回答 → 审辨找错 → 阐述修正」三阶段结构完成作答，提取连接质疑标记与复核锚点证据。',
    inProgressTitle: 'AI 元能力审辨实训中',
    startButtonText: '开始审辨实训',
    startButtonColor: 'var(--ax-primary)',
    loadingTip: '正在启动 AI 元能力审辨实训会话...',
  },
  followup: {
    type: 'followup',
    badge: '非医疗长周期科研随访 · 基地三（10% 前瞻）',
    title: '匿名无影像行为随访采录',
    subtitle: '默认仅在内存提取匿名三维姿态与声学标量，零原始图像及原声落盘，仅作个体内首访基线对比。',
    inProgressTitle: '匿名随访采录进行中',
    startButtonText: '开始匿名随访采录',
    startButtonColor: 'var(--ax-primary)',
    loadingTip: '正在启动匿名随访会话...',
  },
};

export interface AssessmentTaskBanner {
  positionTitle?: string;
  prompt?: string;
  stages?: Array<{ label: string; tip: string }>;
}

interface AssessmentPageProps {
  assessmentType: AssessmentScenarioType;
  defaultPrivacyMode?: ConsentMode;
  complianceBanner?: string;
  initialTaskBanner?: AssessmentTaskBanner | null;
  reportSceneProfile?: string;
}

const AssessmentPage: React.FC<AssessmentPageProps> = ({
  assessmentType,
  defaultPrivacyMode = 'full',
  complianceBanner,
  initialTaskBanner,
  reportSceneProfile,
}) => {
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
  // 本场征询结果。**这里是 UI 的依据** —— `audio_only` 时摄像头根本不打开。
  // 真正落盘的依据是服务端 `label.json` 里的那一份(经 `setLabel` 带上送的)。
  const [consent, setConsent] = useState<ConsentMode | null>(defaultPrivacyMode);
  const { selection: devices, update: setDevices } = useDeviceSelection();
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
  // 设备自检回调走 ref:它在 useCamera 之前就要交给 hook,而 startCamera 在 hook 之后才有。
  const onBeforeRecordRef = useRef<((mode: ConsentMode) => Promise<boolean>) | null>(null);
  const recording = useSessionRecording({
    // 开录前的**设备自检**(脸 + 手 + 麦都采得到)。铸号在它之后 —— 没过就什么都不留。
    onBeforeRecord: (mode) => onBeforeRecordRef.current?.(mode) ?? true,
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
    onRecordStart: (mode) => {
      setConsent(mode);
      frameCountRef.current = 0;
      setEnded(false);
      // 把服务端刚铸的号显示出来:录完要拿它去跑报告,而"报告里什么都没有"
      // 往往就是这个号对不上。它只活在 api.ts 的模块变量里,页面不显示就无从查起。
      setSid(getSessionId());
      setTimeout(() => setStarted(true), 100);
    },
  });

  const { videoRef, canvasRef, startCamera, stopCamera, startCapture, stopCapture } = useCamera({
    // 受试者只同意声音 ⟹ **摄像头根本不打开**(不是"开了不存" —— `media/face/*.jpg`
    // 是逐帧落盘的正脸照,所以"不录肖像"必须意味着不开摄像头)。
    audioOnly: consent === 'audio_only',
    videoDeviceId: devices.videoDeviceId,
    audioDeviceId: devices.audioDeviceId,
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
                  detected: true,
                  face_scale: result.result.face_scale ?? null,
                  au_features: {
                    au_1: result.result.au_features?.au1_inner_brow_raise,
                    au_4: result.result.au_features?.au4_frown,
                    au_6: result.result.au_features?.au6_cheek_raise,
                    au_12: result.result.au_features?.au12_smile,
                  },
                  head_yaw: result.result.au_features?.head_yaw,
                  head_pitch: result.result.au_features?.head_pitch,
                  avg_ear: result.result.au_features?.avg_ear,
                  blink_rate_per_min: result.result.au_features?.blink_rate_per_min,
                }
              });
            }
          }).then(() => analysisHealthRef.current.ok()).catch(err => {
            console.warn('⚠️ 面部分析失败:', err.message);
            analysisHealthRef.current.fail('面部');
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
          }).then(() => analysisHealthRef.current.ok()).catch(err => {
            console.warn('⚠️ 手势分析失败:', err.message);
            analysisHealthRef.current.fail('手势');
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
    onVideoReady: consent === 'anonymous_kinematics_only'
      ? undefined
      : (video) => recording.submitVideo(video),

    // 降级不是失败,但**必须让面试官当场知道** —— 这一场留下的素材与"正常那一场"
    // 不是一回事(camera.webm 没声音 / 可能不完整),事后只看文件是看不出来的。
    // 改之前这里只有 `message.warning(reason, 8)`:8 秒后溜走,而"这一场算不算数"
    // 是转过头还要再看一眼的问题 ⟹ 交给常驻横幅。
    onDegraded: recording.addDegraded,
  });

  // 帧分析连续失败的判据。`onFrame` 里那两句 `.catch(console.warn)` 只进控制台,
  // 于是后端挂了 ⟹ 面板显示上一帧成功时的值 ⟹ 看起来一切正常而这一场一行日志没有。
  const analysisHealthRef = useRef(createAnalysisHealth(recording.addDegraded));

  const { isRecording, startRecording, stopRecording } = useAudioRecorder({
    deviceId: devices.audioDeviceId,
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

  // ── 开录前的设备自检(2026-10-26)─────────────────────────────────────────
  // 离摄像头太远 ⟹ 人脸检出率与 AU 精度会掉,而系统此前照常开录。现在:
  // 征询确定后、**铸号之前**先开相机探几帧;脸/手/麦没全过就不铸号(盘上什么都不留)。
  const [preflightOpen, setPreflightOpen] = useState(false);
  const preflightResolveRef = useRef<((ok: boolean) => void) | null>(null);

  onBeforeRecordRef.current = async (mode: ConsentMode) => {
    setConsent(mode);
    setPrivacyMode(mode);
    if (mode === 'audio_only') return true;      // 只采声音:不开摄像头,没有画面可检
    const ok = await startCamera();
    if (!ok) {
      message.error('摄像头/麦克风没有打开 —— 无法进行设备自检', 0);
      return false;
    }
    return new Promise<boolean>((resolve) => {
      preflightResolveRef.current = resolve;
      setPreflightOpen(true);
    });
  };

  const finishPreflight = (ok: boolean) => {
    setPreflightOpen(false);
    preflightResolveRef.current?.(ok);
    preflightResolveRef.current = null;
    if (!ok) stopCamera();     // 没过就把相机放掉,回到"还没开始"
  };

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
    if (consent === 'anonymous_kinematics_only') {
      stopCamera();
    } else {
      stopCapture();
    }
    // 停完就**问留存 / 不留存** —— 不是自动上传,也不是自动丢。
    // (`beginChoice` 会等在 `idle` 上,所以没有原生录像时也照常问:盘上还有帧和日志。)
    setTimeout(() => recording.beginChoice(), 300);
    message.info('本场已停止录制 —— 请确认本场怎么处理');
  };

  /**
   * **兜底出口**:停录之后门禁迟迟不开,说明这一场**根本没有原生录像可存**。
   *
   * 为什么会有这条路:`useCamera` 在"一个分片都没录到"时**故意不调** `onVideoReady`
   * (不编一份 0 字节的空录像出来),于是保存门禁永远不会开 —— 而本页在 `ended`
   * 之后把答题框和按钮都禁用了 ⟹ **停在一条没有出口的路上,且不说为什么**。
   * 那正是本仓在杀的那类静默失效,所以这里必须自己给出解释和出口。
   */
  // 「本场已结束」但**连选择都没弹出来**(极少:`beginChoice` 没赶上)—— 给个出口。
  useEffect(() => {
    if (!ended || recording.saveState !== 'idle') { setNothingToSave(false); return; }
    const t = setTimeout(() => setNothingToSave(true), 2000);
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
    setConsent(defaultPrivacyMode);
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
      const detail = error?.response?.data?.detail || error?.message || '语音识别服务当前不可达，请改用文字输入';
      console.error('❌ 语音识别失败:', detail);
      throw new Error(detail);
    }
  };

  const reportRouteOf = (targetSid: string | null) => {
    const base = targetSid ? `/report/${targetSid}` : '/reports';
    const sp = reportSceneProfile
      ?? (assessmentType === 'metacognition'
        ? 'ai_metacognition'
        : assessmentType === 'followup'
          ? 'longitudinal_followup'
          : undefined);
    return targetSid && sp ? `${base}?scene_profile=${encodeURIComponent(sp)}` : base;
  };

  if (loading) {
    return <Loading fullScreen tip={config.loadingTip} />;
  }

  if (!started) {
    return (
      <Content className="ax-workbench" style={{ padding: '36px 24px 56px' }}>
        <div
          className="ax-card"
          style={{
            maxWidth: 780,
            margin: '28px auto',
            padding: '36px 32px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              display: 'inline-block',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--ax-primary)',
              background: 'var(--ax-info-soft)',
              border: '1px solid var(--ax-info-border)',
              borderRadius: 'var(--ax-rounded-pill)',
              padding: '4px 14px',
              marginBottom: 16,
            }}
          >
            {config.badge}
          </div>

          <h1
            className="ax-display-md"
            style={{
              margin: '0 auto',
              fontSize: 32,
              fontWeight: 600,
              color: 'var(--ax-ink)',
            }}
          >
            {config.title}
          </h1>
          <p
            style={{
              margin: '12px auto 0',
              maxWidth: 620,
              fontSize: 16,
              lineHeight: 1.6,
              color: 'var(--ax-text-secondary)',
            }}
          >
            {config.subtitle}
          </p>

          {complianceBanner && (
            <Alert
              type="info"
              showIcon
              style={{ marginTop: 18, textAlign: 'left' }}
              message={complianceBanner}
            />
          )}

          {initialTaskBanner?.prompt && (
            <Alert
              type="info"
              showIcon
              style={{ marginTop: 16, textAlign: 'left' }}
              message={
                initialTaskBanner.positionTitle
                  ? `联动自岗位 MCP：${initialTaskBanner.positionTitle}`
                  : '三阶段 AI 审辨实训指引'
              }
              description={
                <div>
                  <div style={{ marginBottom: 6 }}>{initialTaskBanner.prompt}</div>
                  {initialTaskBanner.stages && initialTaskBanner.stages.length > 0 && (
                    <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 12.5 }}>
                      {initialTaskBanner.stages.map((st) => (
                        <li key={st.label}><strong>{st.label}：</strong>{st.tip}</li>
                      ))}
                    </ul>
                  )}
                </div>
              }
            />
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 14,
              marginTop: 28,
              textAlign: 'left',
            }}
          >
            {[
              {
                step: '01 · 身份确认与知情同意',
                desc: '支持匿名或实名标注，明确采录模态与隐私边界',
              },
              {
                step: '02 · 音视频设备自检',
                desc: '实时探测摄像头人脸检出率与麦克风输入电平',
              },
              {
                step: '03 · 逐题作答与自动报告',
                desc: '结束后自动对齐三路流生成行为证据披露报告',
              },
            ].map((item) => (
              <div
                key={item.step}
                style={{
                  background: 'var(--ax-parchment)',
                  border: '1px solid var(--ax-hairline)',
                  borderRadius: 'var(--ax-rounded-md)',
                  padding: '14px 16px',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ax-ink)' }}>
                  {item.step}
                </div>
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 12.5,
                    lineHeight: 1.5,
                    color: 'var(--ax-text-secondary)',
                  }}
                >
                  {item.desc}
                </div>
              </div>
            ))}
          </div>

          <p style={{ marginTop: 22, marginBottom: 0, fontSize: 13, color: 'var(--ax-text-secondary)' }}>
            全流程本地离线处理，逐帧采样率与设备状态全程可视。
          </p>

          <div style={{ marginTop: 24 }}>
            <Button
              type="primary"
              size="large"
              className="ax-btn--pill"
              loading={loading}
              onClick={handleStart}
              style={{ minWidth: 200, fontSize: 16, fontWeight: 400 }}
            >
              {config.startButtonText}
            </Button>
          </div>
        </div>

        {/* 开录前也要有一个 <video>:设备自检要从它抓帧。隐藏起来不占版面 ——
            用户看到的取景画面在自检窗里(同一路流)。 */}
        <video ref={videoRef} autoPlay muted playsInline style={{ display: 'none' }} />

        <PreflightGate
          open={preflightOpen}
          videoRef={videoRef}
          actionLabel={config.startButtonText}
          onReady={() => finishPreflight(true)}
          onCancel={() => finishPreflight(false)}
        />

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

        {/* 肖像 / 音频权的征询。**每场都弹** —— 每个受试者单独同意。
            ⚠️ 它在**铸号之前**,所以「不同意」= 盘上连目录都不会建。 */}
        <ConsentModal
          open={recording.consentModalOpen}
          onOk={recording.confirmConsent}
          onDecline={recording.declineConsent}
          label={recording.savedLabel}
          saving={recording.savingLabel}
          defaultMode={defaultPrivacyMode}
          devicePicker={
            <DevicePicker value={devices} onChange={setDevices} />
          }
        />
      </Content>
    );
  }

  const busy = recording.saveState !== 'idle' || ended;

  return (
    <Content style={{ padding: '24px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {complianceBanner && (
          <Alert
            type="info" showIcon style={{ marginBottom: 12 }}
            message={complianceBanner}
          />
        )}
        {consent === 'audio_only' && (
          <Alert
            type="info" showIcon style={{ marginBottom: 16 }}
            message="本场只采声音 —— 摄像头没有被打开"
            description="这是征询时选定的范围,不是故障。面部与手势两个维度本场没有数据,
              报告里会如实标注「未采集」。"
          />
        )}
        {consent === 'anonymous_kinematics_only' && (
          <Alert
            type="success" showIcon style={{ marginBottom: 16 }}
            message="匿名无影像隐私模式运行中 —— 原始图像、原声与原生录像均零落盘"
            description="系统仅在内存提取三维面部姿态矩阵、上肢运动轨迹与声学特征标量日志，不写回任何可识别影像原件。"
          />
        )}
        {initialTaskBanner?.prompt && (
          <Alert
            type="info" showIcon style={{ marginBottom: 16 }}
            message={
              initialTaskBanner.positionTitle
                ? `当前实训关联岗位：${initialTaskBanner.positionTitle}（阅读 AI 回答 → 指出漏洞 → 口头修正）`
                : '三阶段 AI 审辨实训提示（阅读 AI 回答 → 指出漏洞 → 口头修正）'
            }
            description={initialTaskBanner.prompt}
          />
        )}
        <DegradedBanner reasons={recording.degraded} />
        <LabelErrorBanner error={recording.labelError} />

        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 'var(--ax-display-md-size)', fontWeight: 600 }}>{config.inProgressTitle}</h1>
            {/* 本场 session_id 必须看得见:录完要拿它去跑报告(报告按 id 取每个模态的
                日志),而"报告里什么都没有"往往就是这个号对不上。 */}
            <div style={{ fontSize: '13px', marginTop: '4px', color: sid ? 'var(--ax-success)' : 'var(--ax-text-secondary)' }}>
              {sid ? `本场 session_id：${sid}` : '尚未铸到会话号'}
            </div>
            {recording.savedLabel && (
              <div style={{ fontSize: '13px', marginTop: '4px', color: 'var(--ax-primary)' }}>
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
                background: busy ? 'var(--ax-hairline)' : 'var(--ax-error)', color: '#fff',
                border: 'none', cursor: busy ? 'not-allowed' : 'pointer'
              }}
            >
              ⏹ 停止录制
            </button>
          </div>
        </div>

        {ended && !nothingToSave && (
          <p style={{ color: 'var(--ax-text-secondary)', marginTop: '-12px', marginBottom: '16px' }}>
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
                  帧与日志照常落了盘，但<strong>这一场没有原生录像文件</strong> ——
                  摄像头可能未启动，或音视频流在中途中断。原因见页面顶部的降级告警。
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => navigate(reportRouteOf(sid))}
                    style={{ padding: '6px 20px', background: '#fff', color: 'var(--ax-primary)', border: '1px solid var(--ax-primary)', borderRadius: '6px', cursor: 'pointer' }}>
                    去看本场报告
                  </button>
                  <button onClick={handleNextSession}
                    style={{ padding: '6px 20px', background: 'var(--ax-success)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
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
        onKeep={recording.chooseKeep}
        onDiscard={recording.chooseDiscard}
        onRetry={recording.retryLast}
        onAbandon={() => recording.setConfirmAbandonOpen(true)}
        onClose={() => recording.reset()}
        consentMode={consent}
        hideDefaultOk
        extraActions={
          <>
            <button onClick={() => navigate(reportRouteOf(sid))}
              style={{ padding: '6px 20px', background: '#fff', color: 'var(--ax-primary)', border: '1px solid var(--ax-primary)', borderRadius: '6px', cursor: 'pointer' }}>
              去看本场报告
            </button>
            <button onClick={handleNextSession}
              style={{ padding: '6px 20px', background: 'var(--ax-success)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
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
