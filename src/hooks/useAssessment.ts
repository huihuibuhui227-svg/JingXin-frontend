import { useState, useCallback } from 'react';
import { message } from 'antd';
import { voiceApi, dashboardApi } from '@/services/api';
import { useAssessmentStore } from '@/store/assessmentStore';
import { speakText } from '@/utils/speech';

export const useAssessment = (type: 'interview' | 'research') => {
  const [loading, setLoading] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [started, setStarted] = useState(false);

  const { addAnswer, currentQuestionIndex } = useAssessmentStore();

  const start = useCallback(async () => {
    setLoading(true);
    try {
      console.log('🚀 开始启动多模态服务...');

      const facePromise = dashboardApi.runModule('face').catch(err => {
        console.warn('⚠️ FACE模块启动失败:', err.message);
        return null;
      });

      const gesturePromise = dashboardApi.runModule('gesture').catch(err => {
        console.warn('⚠️ GESTURE模块启动失败:', err.message);
        return null;
      });

      const voiceApiService = type === 'interview' ? voiceApi.interview : voiceApi.research;
      const voicePromise = voiceApiService.start();

      const [faceResult, gestureResult, voiceResult] = await Promise.allSettled([
        facePromise,
        gesturePromise,
        voicePromise
      ]);

      if (voiceResult.status === 'fulfilled') {
        setCurrentQuestion(voiceResult.value.question);
        console.log('✅ VOICE服务启动成功');
      } else {
        console.error('❌ VOICE服务启动失败:', voiceResult.reason);
        throw new Error('语音服务启动失败');
      }

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

      if (audioFile) {
        await api.submitAudioAnswer(audioFile);
      }
      if (answer.trim()) {
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
      }

      // ★ 这里**刻意不**往 store 里塞一个合成的 evaluationResult。
      // 那个 store 会持久化(partialize 含 evaluationResult),而 ReportPage 有
      // "store 有结果就不问服务端"的短路 —— 塞一个 total_score: 0 / dimensions: {} 的
      // 合成结果进去,真实报告就**永远不会被取**,而且刷新后仍在。
      // 正确路径:报告页自己去 /api/report/structured 取(M2.1 已让该端点自报场次);
      // 也不在这里 fire-and-forget 调 runModule('report') —— 那正是账本跟进项 22
      // 要收口的东西,而它的失败只进 console.warn 属于本项目在杀的静默失效。
      message.success('评估已完成');
      return { hasNext: false };
    } catch (error) {
      console.error('提交回答失败:', error);
      message.error('提交回答失败');
      return { hasNext: true, error: true };
    }
  }, [type, currentQuestion, addAnswer]);

  const playQuestion = useCallback(async () => {
    try {
      await speakText(currentQuestion);
    } catch (error) {
      console.error('播放问题失败:', error);
      message.error('播放失败，请检查浏览器语音设置');
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
