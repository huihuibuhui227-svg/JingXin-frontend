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

/**
 * 录完当场体检(`POST /session/{sid}/media` 的 `capture_health` 字段)。
 *
 * 为什么前端要管这件事:盘上实测有场次**文件里根本没有视频轨**却一路录到底,
 * 当时页面上没有任何提示 —— 白录一场,而原始素材不可再生。服务端只负责量、
 * 不负责喊;喊是这一层的事。
 *
 * ⚠️ `null` 值**不是**"没有" —— `has_video: null` 是"没量成"(没装 ffprobe /
 *    文件读不懂)。把"没量成"显示成"录坏了"会让人白重录一场,反之亦然。
 */
export interface CaptureHealth {
  status: 'ok' | 'warn' | 'unknown';
  has_video: boolean | null;
  has_audio: boolean | null;
  video_sec: number | null;
  audio_sec: number | null;
  av_ratio: number | null;
  mean_luma: number | null;
  codecs: string[];
  findings: string[];
}

