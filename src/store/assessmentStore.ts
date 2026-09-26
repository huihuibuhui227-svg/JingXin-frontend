import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { RealtimeMetrics, AnswerRecord, EvaluationResult } from '@/types/assessment';

interface AssessmentState {
  scenario: 'interview' | 'research' | null;
  currentQuestionIndex: number;
  /** 本场题库共几题 —— **由服务端给**(`/interview/start` 的 `total_questions`)。
   *  消费者拿它当进度分母。前端自己**没有**这个数:`setQuestions` 是死代码、
   *  从未被调用,所以此前面板写死了 10,而真题库是 8 题(进度条永远到不了 100%)。
   *  0 表示"还不知道"——此时不要显示分母,别编一个。 */
  totalQuestions: number;
  questions: string[];
  answers: AnswerRecord[];
  realtimeMetrics: RealtimeMetrics;
  evaluationResult: EvaluationResult | null;
  reportUrl: string | null;

  setScenario: (scenario: 'interview' | 'research') => void;
  setTotalQuestions: (total: number) => void;
  setQuestions: (questions: string[]) => void;
  addAnswer: (answer: AnswerRecord) => void;
  updateRealtimeMetrics: (metrics: Partial<RealtimeMetrics>) => void;
  setEvaluationResult: (result: EvaluationResult) => void;
  setReportUrl: (url: string) => void;
  resetAssessment: () => void;
}

export const useAssessmentStore = create<AssessmentState>()(
  persist(
    (set) => ({
      scenario: null,
      currentQuestionIndex: 0,
      totalQuestions: 0,
      questions: [],
      answers: [],
      realtimeMetrics: {},
      evaluationResult: null,
      reportUrl: null,

      setScenario: (scenario) => set({ scenario }),

      setTotalQuestions: (total) => set({ totalQuestions: total }),

      setQuestions: (questions) => set({
        questions,
        currentQuestionIndex: 0
      }),

      addAnswer: (answer) => set((state) => ({
        answers: [...state.answers, answer],
        currentQuestionIndex: state.currentQuestionIndex + 1
      })),

      updateRealtimeMetrics: (metrics) => set((state) => ({
        realtimeMetrics: { ...state.realtimeMetrics, ...metrics }
      })),

      setEvaluationResult: (result) => set({ evaluationResult: result }),

      setReportUrl: (url) => set({ reportUrl: url }),

      resetAssessment: () => set({
        scenario: null,
        currentQuestionIndex: 0,
        totalQuestions: 0,
        questions: [],
        answers: [],
        realtimeMetrics: {},
        evaluationResult: null,
        reportUrl: null
      })
    }),
    {
      name: 'assessment-storage',
      partialize: (state) => ({
        answers: state.answers,
        evaluationResult: state.evaluationResult
      })
    }
  )
);
