import React, { useState, useEffect, useRef } from 'react';
import { Layout, Progress, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useCamera } from '@/hooks/useCamera';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useAssessment } from '@/hooks/useAssessment';
import { useAssessmentStore } from '@/store/assessmentStore';
import { faceApi, gestureApi, voiceApi, sessionApi } from '@/services/api';
import CameraView from '@/components/assessment/CameraView';
import RealtimeMetrics from '@/components/assessment/RealtimeMetrics';
import QuestionCard from '@/components/assessment/QuestionCard';
import AnswerInput from '@/components/assessment/AnswerInput';
import Loading from '@/components/common/Loading';

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
  const frameCountRef = useRef(0);

  const { realtimeMetrics, updateRealtimeMetrics } = useAssessmentStore();
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
              updateRealtimeMetrics({
                gesture: {
                  detected_hands: result.result.detected_hands || 0,
                  hand_score: result.result.hand?.average_score || 0,
                  shoulder_score: result.result.shoulder?.shoulder_score || 0,
                  left_arm_score: result.result.arm?.left?.arm_score || 0,
                  right_arm_score: result.result.arm?.right?.arm_score || 0,
                  jitter: result.result.hand?.left?.jitter !== undefined ?
                          (result.result.hand.left.jitter + (result.result.hand.right?.jitter || 0)) / 2 :
                          0,
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
      console.log('🎥 本场原生录像收尾，准备上传:', video.size, 'bytes');
      // ⚠️ **必须 return 这个 promise**:useCamera 拿它当"什么时候可以撤掉
      // 「刷新会丢录像」拦截"的信号。不 return 的话,上传还没发完拦截就撤了,
      // 那几秒里刷新 = 整场录像没了。
      return sessionApi.uploadMedia(video)
        .then((result) => {
          if (result?.stored === false) {
            // 服务端**明说没存下**(留存被关 / 中途写失败)—— 不许当成功。
            console.error('❌ 原生录像没有被留存:', result.reason);
            message.error(`本场原生录像没存下：${result.reason}`);
          } else {
            console.log('✅ 原生录像已留存:', result);
          }
        })
        .catch((error) => {
          // 没有会话 id / 网络断 ⟹ 整场录像没留成。这是**不可逆**的损失,要说出来,
          // 不能只进 console(本项目在杀的静默失效)。
          console.error('❌ 原生录像上传失败:', error?.response?.data ?? error);
          // 服务端的 detail 是有信息量的(413 会说清是多少字节撞了哪个上限),
          // 原先它只进 console、用户只看到一句泛泛的"失败"。
          const detail = error?.response?.data?.detail;
          message.error(
            detail
              ? `本场原生录像没有留存:${detail}`
              : '本场原生录像上传失败 —— 这一场的原生视频没有留存'
          );
        });
    },

    // 降级不是失败,但**必须让面试官当场知道** —— 这一场留下的素材与"正常那一场"
    // 不是一回事(camera.webm 没声音 / 可能不完整),事后只看文件是看不出来的。
    onDegraded: (reason) => {
      console.warn('⚠️ 采集降级:', reason);
      message.warning(reason, 8);
    }
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

  const {
    loading,
    currentQuestion,
    currentQuestionIndex,
    start,
    submitAnswer,
    playQuestion
  } = useAssessment(config.type);

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

  const handleStart = async () => {
    const success = await start();
    if (success) {
      setTimeout(() => {
        setStarted(true);
      }, 100);
    }
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

      const result = await voiceApi.speechToText(audioFile);

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

  const handleSubmitAnswer = async (answer: string, audioFile?: File) => {
    const result = await submitAnswer(answer, audioFile);
    if (!result.hasNext && !result.error) {
      setTimeout(() => {
        navigate('/reports');
      }, 1500);
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
        </div>
      </Content>
    );
  }

  return (
    <Content style={{ padding: '24px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>{config.inProgressTitle}</h2>
          <Progress
            percent={Math.round((currentQuestionIndex / 10) * 100)}
            format={() => `进度 ${currentQuestionIndex}/10`}
            style={{ width: '300px' }}
          />
        </div>

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
              totalQuestions={10}
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
        />
      </div>
    </Content>
  );
};

export default AssessmentPage;
