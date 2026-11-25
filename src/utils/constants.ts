/**
 * 衡才智析 · 多模态行为证据分析系统 — 运行时服务地址与品牌常量。
 *
 * 默认走同源相对路径（由 Vite dev / preview 统一在服务端本地 127.0.0.1 反代至
 * :5000 / :8000 / :8001 / :8002）：
 *   · 浏览器只需连通 `:5173` 单一端口（Tailscale HTTPS 或 SSH 仅转发 5173 均可全通）
 *   · 彻底规避客户端代理拦截 8000/8001/8002/5000 跨端口请求及跨域 OPTIONS 预检延迟
 *
 * 若后端部署在独立主机，可通过构建/运行时环境变量显式覆盖：
 *   VITE_API_BASE_URL / VITE_FACE_API_URL / VITE_VOICE_API_URL / VITE_GESTURE_API_URL
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
export const FACE_API_URL = import.meta.env.VITE_FACE_API_URL || '/_svc/face';
export const GESTURE_API_URL = import.meta.env.VITE_GESTURE_API_URL || '/_svc/gesture';
export const VOICE_API_URL = import.meta.env.VITE_VOICE_API_URL || '/_svc/voice';

export const BRAND_NAME = '衡才智析';
export const BRAND_SUBTITLE = '多模态行为证据分析系统';
export const BRAND_FULL_TITLE = '衡才智析 · 多模态行为证据分析系统';
export const BRAND_SLOGAN = '不给分，只给证据与缺口';
export const BRAND_PRINCIPLE = '过程证据可追溯，缺口边界显式披露';

export const SCENARIOS = {
  INTERVIEW: 'interview',
  RESEARCH: 'research',
  METACOGNITION: 'metacognition',
  FOLLOWUP: 'followup',
} as const;
