import axios from 'axios';
import { API_BASE_URL } from '@/utils/constants';

/**
 * 素材浏览(服务端 `recordings_browser.py`)的前端契约点。
 *
 * ── 两条与别处不同的规矩,都是**被迫**的 ──────────────────────────────────
 *
 * ① **凭证存 `sessionStorage`,不存 `localStorage`。** 使用者选的是"关标签页就失效":
 *    这一页能看到受试者的脸和身份,共用电脑上留一份长期凭证等于没锁。
 *
 * ② **录像/帧/下载走 URL 里的 token,不走请求头。** `<video src>`、`<img src>`、
 *    `<a download>` 这三种取文件的方式**发不了自定义头** —— 那是浏览器的限制,
 *    不是选择。唯一的替代是把整份录像读成 blob 再 `createObjectURL`,那样内存顶不住
 *    (实测一场 170 MB)而且**拖拽与 Range 全废**,正好废掉这一页的意义。
 *    代价如实说:这条路上的 token 会进浏览器历史与服务端访问日志。所以服务端
 *    **只对 `/video` 与 `/file` 开这个口子**,其余端点一律只认请求头。
 */

const TOKEN_KEY = 'jx_admin_token';

/** `sessionStorage` 在隐私模式下会**抛**,不是返回 null —— 所以每次都要包起来。 */
export const getAdminToken = (): string | null => {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setAdminToken = (token: string | null): void => {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* 存不下就是"这次会话里没登录",不是崩溃 */
  }
};

const authHeaders = (): Record<string, string> => {
  const token = getAdminToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export interface RecordingFrames {
  face: number;
  gesture: number;
}

/** 未授权时服务端**只会给这些字段** —— 多出来的键不该出现在这里,这是刻意的。 */
export interface RecordingSummary {
  sid: string;
  is_none_bucket: boolean;
  has_video: boolean;
  video_bytes: number;
  frames: RecordingFrames;
  modified: number;
  degraded: number;
  /** 下面三个只有管理员视图才有 —— 它们带身份。 */
  dir_name?: string;
  label?: { name?: string; student_id?: string; department?: string; serial?: string } | null;
  degraded_reasons?: string[];
}

export interface RecordingList {
  recordings: RecordingSummary[];
  admin: boolean;
  total_video_bytes: number;
  total_frames: number;
  trash_count: number;
}

export interface RecordingDetail extends RecordingSummary {
  bytes_total: number;
  preview_ready: boolean;
  files: string[];
  reports: Array<{ name: string; modified: number }>;
}

/**
 * 媒体类 URL 带 token。**只给 `<video>` / `<img>` / `<a download>` 用** ——
 * 普通 JSON 请求请走下面的函数(那走请求头)。
 */
const withToken = (url: string): string => {
  const token = getAdminToken();
  return token ? `${url}?token=${encodeURIComponent(token)}` : url;
};

export const recordingsApi = {
  list: async (): Promise<RecordingList> => {
    const r = await axios.get(`${API_BASE_URL}/api/recordings`, { headers: authHeaders() });
    return r.data;
  },

  /** 成功 ⟹ 服务端发一个 12 小时的随机 token;失败会**抛**(调用方要给说法)。 */
  login: async (password: string): Promise<string> => {
    const r = await axios.post(`${API_BASE_URL}/api/admin/login`, { password });
    const token: string = r.data.token;
    setAdminToken(token);
    return token;
  },

  logout: (): void => setAdminToken(null),

  detail: async (sid: string): Promise<RecordingDetail> => {
    const r = await axios.get(`${API_BASE_URL}/api/recordings/${encodeURIComponent(sid)}`,
      { headers: authHeaders() });
    return r.data;
  },

  frames: async (sid: string, modality: 'face' | 'gesture', page: number, perPage = 24) => {
    const r = await axios.get(`${API_BASE_URL}/api/recordings/${encodeURIComponent(sid)}/frames`, {
      headers: authHeaders(),
      params: { modality, page, per_page: perPage },
    });
    return r.data as { modality: string; total: number; page: number; per_page: number; frames: string[] };
  },

  /** 移到回收站。`confirm` 必须是把这个 sid 原样抄一遍 —— 服务端会核。 */
  trash: async (sid: string, confirm: string) => {
    const r = await axios.post(
      `${API_BASE_URL}/api/recordings/${encodeURIComponent(sid)}/trash`,
      { confirm }, { headers: authHeaders() });
    return r.data as { moved_to: string; sid: string };
  },

  videoUrl: (sid: string): string =>
    withToken(`${API_BASE_URL}/api/recordings/${encodeURIComponent(sid)}/video`),

  fileUrl: (sid: string, name: string): string =>
    withToken(`${API_BASE_URL}/api/recordings/${encodeURIComponent(sid)}/file`
      + `?name=${encodeURIComponent(name)}`),
};
