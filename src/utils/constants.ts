/**
 * 衡才智析 · 多模态行为证据披露系统 — 运行时服务地址与品牌常量。
 *
 * 默认与当前页面同主机、同协议，仅切换端口：
 *   · 页面 http://<host>:5173  → 后端 http://<host>:5000/8000/8001/8002
 *   · 页面 https://<host>:5173 → 后端 https://<host>:5000/8000/8001/8002
 *
 * 若后端部署在独立主机，可通过构建/运行时环境变量显式覆盖：
 *   VITE_API_BASE_URL / VITE_FACE_API_URL / VITE_VOICE_API_URL / VITE_GESTURE_API_URL
 */
const LOC = typeof window !== 'undefined' ? window.location : null;
const HOST = LOC?.hostname || 'localhost';
const SCHEME = LOC?.protocol || 'http:';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || `${SCHEME}//${HOST}:5000`;
export const FACE_API_URL = import.meta.env.VITE_FACE_API_URL || `${SCHEME}//${HOST}:8000`;
export const GESTURE_API_URL = import.meta.env.VITE_GESTURE_API_URL || `${SCHEME}//${HOST}:8002`;
export const VOICE_API_URL = import.meta.env.VITE_VOICE_API_URL || `${SCHEME}//${HOST}:8001`;

export const BRAND_NAME = '衡才智析';
export const BRAND_SUBTITLE = '多模态行为证据披露系统';
export const BRAND_FULL_TITLE = '衡才智析 · 多模态行为证据披露系统';
export const BRAND_SLOGAN = '不给分，只给证据与缺口';
export const BRAND_PRINCIPLE = '仪器可以是黑盒，裁判必须是白盒';

export const SCENARIOS = {
  INTERVIEW: 'interview',
  RESEARCH: 'research'
} as const;
