export interface ApiResponse<T = any> {
  status: string;
  message?: string;
  data?: T;
}

export interface FileItem {
  name: string;
  url: string;
}

export interface InterviewStartResponse {
  status: string;
  question: string;
}

export interface QuestionResponse {
  question: string;
}

export interface EvaluationResponse {
  evaluation: {
    core_competency: { score: number; level: string };
    problem_solving: { score: number; level: string };
    teamwork: { score: number; level: string };
    communication: { score: number; level: string };
    emotional_stability: { score: number; level: string };
  };
  log_path: string;
}
