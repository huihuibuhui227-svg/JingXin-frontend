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

const InterviewAssessment: React.FC = () => {
  const navigate = useNavigate();
  const [started, setStarted] = useState(false);
  const frameCountRef = useRef(0);

  const { realtimeMetrics, updateRealtimeMetrics } = useAssessmentStore();
  const { videoRef, canvasRef, startCamera, stopCamera, startCapture, stopCapture } = useCamera({
    onFrame: async (frame) => {
      // 每5帧发送一次分析请求（约每秒1次，如果frameRate=5）
      frameCountRef.current += 1;
      if (frameCountRef.current % 5 !== 0) return;

      try {
        console.log('📤 发送第', frameCountRef.current, '帧到后端分析...');

        // 并行发送面部分析和手势分析（都使用 FormData）
        Promise.allSettled([
          // 面部分析
          faceApi.analyzeImage(frame).then(result => {
            console.log('📊 面部分析结果:', result);

            // 更新面部指标
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

          // 手势分析（直接使用 frame Blob，无需转换 Base64）
          gestureApi.analyzeGesture(frame).then(result => {
            console.log('🙌 手势分析结果:', result);

            // 更新手势指标
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
      // 这里可以实时处理音频数据（可选）
      console.log('🎤 收到音频数据块:', audioBlob.size, 'bytes');
    }
  });

  const {
    loading,
    currentQuestion,
    currentQuestionIndex,
    start,
    submitAnswer,
    playQuestion
  } = useAssessment('interview');

  useEffect(() => {
    // 不在这里启动摄像头，等到 started 为 true 时再启动
    return () => {
      stopCamera();
    };
  }, []);

  // 面试开始后启动摄像头和视频帧捕获
  useEffect(() => {
    if (started) {
      console.log('🔄 started 变为 true，准备启动摄像头和捕获...');

      // 先启动摄像头
      startCamera().then(() => {
        console.log('✅ 摄像头启动完成，等待视频元素就绪...');

        // 延迟一点再启动捕获，确保视频元素已经完全渲染和加载
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
      // 等待一小段时间，确保视频元素已经挂载并加载数据
      setTimeout(() => {
        setStarted(true);
      }, 100);
    }
  };

  // 语音转文字处理函数
  const handleSpeechToText = async (audioBlob: Blob): Promise<string> => {
    try {
      console.log('🎤 开始语音识别，音频大小:', audioBlob.size, 'bytes');
      console.log('🎤 音频类型:', audioBlob.type);

      // 将 Blob 转换为 File
      const audioFile = new File([audioBlob], 'answer.wav', {
        type: 'audio/webm',
        lastModified: Date.now()
      });

      console.log('🎤 调用 ASR API...');

      // 调用后端 ASR 接口
      const result = await voiceApi.speechToText(audioFile);

      console.log('✅ 语音识别原始结果:', JSON.stringify(result, null, 2));

      // 根据后端返回格式提取文本
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

      // ⚠️ 临时方案：后端失败时返回提示文本
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
    return <Loading fullScreen tip="正在启动面试..." />;
  }

  if (!started) {
    return (
      <Content style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h1>面试评估</h1>
          <p style={{ fontSize: '16px', color: '#666', marginBottom: '40px' }}>
            系统将进行多维度分析，包括面部表情、手势姿态、语音内容等
          </p>
          <button
            onClick={handleStart}
            style={{
              padding: '12px 48px',
              fontSize: '18px',
              background: '#1890ff',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            开始面试
          </button>
        </div>
      </Content>
    );
  }

  return (
    <Content style={{ padding: '24px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>面试评估进行中</h2>
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

export default InterviewAssessment;

