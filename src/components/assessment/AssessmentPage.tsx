import React, { useState, useEffect, useRef } from 'react';
import { Layout, Progress } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useCamera } from '@/hooks/useCamera';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useAssessment } from '@/hooks/useAssessment';
import { useAssessmentStore } from '@/store/assessmentStore';
import { faceApi, gestureApi, voiceApi } from '@/services/api';
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
    frameRate: 5
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
    if (started) {
      console.log('🔄 started 变为 true，准备启动摄像头和捕获...');

      startCamera().then(() => {
        console.log('✅ 摄像头启动完成，等待视频元素就绪...');

        const timer = setTimeout(() => {
          console.log('⏰ 延迟结束，调用 startCapture');
          startCapture();
        }, 500);

        return () => {
          console.log('🧹 清理定时器');
          clearTimeout(timer);
        };
      });
    } else {
      stopCapture();
    }
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
