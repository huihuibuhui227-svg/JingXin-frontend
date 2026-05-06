export const API_BASE_URL = 'http://localhost:5000';
export const FACE_API_URL = 'http://localhost:8000';
export const GESTURE_API_URL = 'http://localhost:8002';
export const VOICE_API_URL = 'http://localhost:8001';

// ... existing code ...


export const SCENARIOS = {
  INTERVIEW: 'interview',
  RESEARCH: 'research'

} as const;

export const EMOTION_MAP: Record<string, string> = {
  happy: '开心',
  sad: '悲伤',
  angry: '愤怒',
  surprised: '惊讶',
  neutral: '平静',
  fearful: '恐惧',
  disgusted: '厌恶'
};

export const getLevelLabel = (score: number): string => {
  if (score >= 90) return '卓越';
  if (score >= 80) return '优秀';
  if (score >= 70) return '良好';
  if (score >= 60) return '合格';
  return '待提升';
};
