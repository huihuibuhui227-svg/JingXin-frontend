import React, { useState, useEffect, useRef } from 'react';
import { Layout, message, Progress } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useCamera } from '@/hooks/useCamera';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useAssessment } from '@/hooks/useAssessment';
import { useAssessmentStore } from '@/store/assessmentStore';
import { faceApi } from '@/services/api';
import CameraView from '@/components/assessment/CameraView';
import RealtimeMetrics from '@/components/assessment/RealtimeMetrics';
import QuestionCard from '@/components/assessment/QuestionCard';
import AnswerInput from '@/components/assessment/AnswerInput';
import Loading from '@/components/common/Loading';

const { Content } = Layout;

const ResearchAssessment: React.FC = () => {
  const navigate = useNavigate();
  const [started, setStarted] = useState(false);
  const frameCountRef = useRef(0);

  const { realtimeMetrics } = useAssessmentStore();
  const { videoRef, canvasRef, startCamera, stopCamera, startCapture, stopCapture } = useCamera({
    onFrame: async (frame) => {
      // 每30帧发送一次分析请求，避免频繁调用后端
      frameCountRef.current += 1;
      if (frameCountRef.current % 30 !== 0) return;

      try {
        // 并行发送面部分析
        faceApi.analyzeImage(frame).then(result => {
          console.log('📊 面部分析结果:', result);
        }).catch(err => {
          console.warn('⚠️ 面部分析失败:', err.message);
        });
      } catch (error) {
        console.error('❌ 帧处理错误:', error);
      }
    }
  });

  const { isRecording, startRecording, stopRecording } = useAudioRecorder({
    onAudioData: async () => {
      try {
        message.success('语音数据已采集');
      } catch (error) {
        message.error('语音处理失败');
      }
    }
  });

  const {
    loading,
    currentQuestion,
    currentQuestionIndex,
    start,
    submitAnswer,
    playQuestion
  } = useAssessment('research');

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  // 评估开始后启动视频帧捕获
  useEffect(() => {
    if (started) {
      startCapture();
    } else {
      stopCapture();
    }
  }, [started, startCapture, stopCapture]);

  const handleStart = async () => {
    const success = await start();
    if (success) {
      setStarted(true);
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
    return <Loading fullScreen tip="正在启动科研评估..." />;
  }

  if (!started) {
    return (
      <Content style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h1>科研能力评估</h1>
          <p style={{ fontSize: '16px', color: '#666', marginBottom: '40px' }}>
            系统将评估您的科研思维能力，包括逻辑推理、问题分析、创新思维等维度
          </p>
          <button
            onClick={handleStart}
            style={{
              padding: '12px 48px',
              fontSize: '18px',
              background: '#52c41a',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            开始评估
          </button>
        </div>
      </Content>
    );
  }

  return (
    <Content style={{ padding: '24px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>科研评估进行中</h2>
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
          isRecording={isRecording}
          onStartRecording={startRecording}
          onStopRecording={stopRecording}
        />
      </div>
    </Content>
  );
};

export default ResearchAssessment;

