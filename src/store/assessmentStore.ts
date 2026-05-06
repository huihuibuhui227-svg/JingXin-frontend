import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { RealtimeMetrics, AnswerRecord, EvaluationResult } from '@/types/assessment';

interface AssessmentState {
  scenario: 'interview' | 'research' | null;
  currentQuestionIndex: number;
  questions: string[];
  answers: AnswerRecord[];
  realtimeMetrics: RealtimeMetrics;
  evaluationResult: EvaluationResult | null;
  reportUrl: string | null;

  setScenario: (scenario: 'interview' | 'research') => void;
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
      questions: [],
      answers: [],
      realtimeMetrics: {},
      evaluationResult: null,
      reportUrl: null,

      setScenario: (scenario) => set({ scenario }),

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
