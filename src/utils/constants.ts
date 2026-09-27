// ── 后端地址:默认**跟页面同一台主机**,只换端口 ──────────────────────
//
// 2026-09-27 改。此前四个地址写死成 `http://localhost:xxxx`,后果:
// 把整套部署到服务器后,从**别的电脑**打开 `http://192.168.72.30:5173`,
// 浏览器里的 `localhost` 指的是**那台电脑自己**,不是服务器 ⟹ 一个后端都连不上。
//
// 现在按页面的 host 推断:从哪儿打开,就找那台机器上的服务。
//   · 本地开发   http://localhost:5173     → 后端 localhost:8000/8001/8002/5000
//   · 服务器部署 http://192.168.72.30:5173 → 后端 192.168.72.30:8000/8001/8002/5000
//
// 后端**不在同一台机器**时才需要显式覆盖(构建或启动时给环境变量):
//   VITE_VOICE_API_URL=http://10.0.0.9:8001 npm run dev
//
// ⚠️ 配套的后端一侧:**服务端的 CORS 白名单必须放行这个页面的 Origin**
//    (四个服务都读环境变量 `CORS_ORIGINS`)。改了地址但没改 CORS,
//    症状是浏览器控制台一片 CORS 报错、而服务端日志显示请求根本没到。
const HOST = (typeof window !== 'undefined' && window.location.hostname) || 'localhost';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || `http://${HOST}:5000`;
export const FACE_API_URL = import.meta.env.VITE_FACE_API_URL || `http://${HOST}:8000`;
export const GESTURE_API_URL = import.meta.env.VITE_GESTURE_API_URL || `http://${HOST}:8002`;
export const VOICE_API_URL = import.meta.env.VITE_VOICE_API_URL || `http://${HOST}:8001`;

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
