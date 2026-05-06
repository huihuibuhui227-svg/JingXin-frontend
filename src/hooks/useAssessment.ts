import { useState, useCallback } from 'react';
import { message } from 'antd';
import { voiceApi, dashboardApi } from '@/services/api';
import { useAssessmentStore } from '@/store/assessmentStore';

export const useAssessment = (type: 'interview' | 'research') => {
  const [loading, setLoading] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [started, setStarted] = useState(false);

  const { addAnswer, currentQuestionIndex } = useAssessmentStore();

  const start = useCallback(async () => {
    setLoading(true);
    try {
      console.log('🚀 开始启动多模态服务...');

      // 1. 通过Flask总控启动FACE和GESTURE模块
      const facePromise = dashboardApi.runModule('face').catch(err => {
        console.warn('⚠️ FACE模块启动失败:', err.message);
        return null;
      });

      const gesturePromise = dashboardApi.runModule('gesture').catch(err => {
        console.warn('⚠️ GESTURE模块启动失败:', err.message);
        return null;
      });

      // 2. 直接调用FastAPI启动VOICE服务
      const voiceApiService = type === 'interview' ? voiceApi.interview : voiceApi.research;
      const voicePromise = voiceApiService.start();

      // 3. 等待所有服务启动完成
      const [faceResult, gestureResult, voiceResult] = await Promise.allSettled([
        facePromise,
        gesturePromise,
        voicePromise
      ]);

      // 4. 处理VOICE服务结果（必须成功）
      if (voiceResult.status === 'fulfilled') {
        setCurrentQuestion(voiceResult.value.question);
        console.log('✅ VOICE服务启动成功');
      } else {
        console.error('❌ VOICE服务启动失败:', voiceResult.reason);
        throw new Error('语音服务启动失败');
      }

      // 5. 显示其他服务的启动状态
      const services = ['语音'];
      if (faceResult.status === 'fulfilled' && faceResult.value) {
        services.push('面部');
        console.log('✅ FACE服务启动成功:', faceResult.value.message);
      }
      if (gestureResult.status === 'fulfilled' && gestureResult.value) {
        services.push('手势');
        console.log('✅ GESTURE服务启动成功:', gestureResult.value.message);
      }

      message.success(`${type === 'interview' ? '面试' : '科研评估'}已开始 - 已启动: ${services.join(', ')}分析`);
      setStarted(true);
      return true;
    } catch (error: any) {
      console.error('❌ 启动失败:', error);
      message.error(error.message || '启动失败，请检查后端服务是否正常运行');
      return false;
    } finally {
      setLoading(false);
    }
  }, [type]);

  const submitAnswer = useCallback(async (answer: string, audioFile?: File) => {
    try {
      const api = type === 'interview' ? voiceApi.interview : voiceApi.research;

      // 如果有音频文件，使用音频提交接口
      if (audioFile) {
        await api.submitAudioAnswer(audioFile);
      } else {
        // 否则使用文本提交接口
        await api.submitAnswer(answer);
      }

      addAnswer({
        question: currentQuestion,
        answer,
        timestamp: new Date(),
        audioFile
      });

      const nextResult = await api.getQuestion();
      if (nextResult.question) {
        setCurrentQuestion(nextResult.question);
        return { hasNext: true };
      } else {
        message.success('评估已完成');
        return { hasNext: false };
      }
    } catch (error) {
      console.error('提交回答失败:', error);
      message.error('提交回答失败');
      return { hasNext: true, error: true };
    }
  }, [type, currentQuestion, addAnswer]);

  const playQuestion = useCallback(async () => {
    try {
      await voiceApi.textToSpeech(currentQuestion);
    } catch (error) {
      console.error('播放问题失败:', error);
      message.error('播放失败');
    }
  }, [currentQuestion]);

  const getEvaluation = useCallback(async () => {
    try {
      const api = type === 'interview' ? voiceApi.interview : voiceApi.research;
      const result = await api.getEvaluation();
      return result;
    } catch (error) {
      console.error('获取评估结果失败:', error);
      message.error('获取评估结果失败');
      return null;
    }
  }, [type]);

  return {
    loading,
    currentQuestion,
    started,
    currentQuestionIndex,
    start,
    submitAnswer,
    playQuestion,
    getEvaluation
  };
};

