/// <reference types="vite/client" />

/**
 * 本仓用到的 Vite 环境变量(构建/启动时注入,见 `src/utils/constants.ts`)。
 *
 * 它们**都是可选的** —— 不设就按「跟页面同源的主机 + 各自端口」自动推断,
 * 那正是绝大多数情况(本地开发、把整套部署在服务器上)。
 * 只有后端不在同一台机器上时,才需要显式设。
 */
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_FACE_API_URL?: string;
  readonly VITE_GESTURE_API_URL?: string;
  readonly VITE_VOICE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
