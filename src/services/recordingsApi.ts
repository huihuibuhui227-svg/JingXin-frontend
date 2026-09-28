import axios from 'axios';
import { API_BASE_URL, VOICE_API_URL } from '@/utils/constants';

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
  /** 有几份报告。**不是身份** ⟹ 未授权也给(哪几场还没出报告是排产问题)。 */
  report_count: number;
  /** 下面三个只有管理员视图才有 —— 它们带身份。 */
  dir_name?: string;
  label?: {
    name?: string; student_id?: string; department?: string; serial?: string;
    /** 本场征询结果。老场次没有这个键(征询功能之前录的)。 */
    consent?: 'full' | 'audio_only';
  } | null;
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
  if (!token) return url;
  // ⚠️ 分隔符要**看 URL 里已经有没有 `?`**。第一版一律用 `?`,而 `fileUrl` 自带
  //    `?name=…` ⟹ 拼出 `…?name=X?token=Y`:服务端把 name 读成 `X?token=Y`、
  //    而且**收不到 token**(第二个 `?` 不是分隔符)⟹ 401 ⟹ 逐帧图**一张都不显示**。
  //    而 `videoUrl` 没有前置 `?`,所以它是好的 —— 于是现场看起来是
  //    "视频能预览、帧看不到",像一个跟模态有关的问题,其实只是拼接。
  return `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
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

  /** 移到回收站。**可救** —— 素材页上「删除」走的永远是这条。 */
  trash: async (sid: string, confirm: string) => {
    const r = await axios.post(
      `${API_BASE_URL}/api/recordings/${encodeURIComponent(sid)}/trash`,
      { confirm }, { headers: authHeaders() });
    return r.data as { moved_to: string; sid: string };
  },

  /**
   * **真删**,没有回收站。只给「不留存 / 不同意录制」那一条路用。
   *
   * ⚠️ 与 `trash` 的分工是刻意的:那条是"翻旧素材时手滑",这条是"刚录完、明确
   *    说这是测试不要了"。语义不同 ⟹ 一个可救、一个不可救,由**明确的按钮**分开,
   *    而不是靠人记得点哪个。
   * ⚠️ 服务端删两处:场次目录 + `data/logs/` 里那三份 CSV。少删一处就会留下
   *    "有日志没素材"的半截状态。
   */
  purge: async (sid: string) => {
    const r = await axios.post(
      `${API_BASE_URL}/api/recordings/${encodeURIComponent(sid)}/purge`,
      { confirm: sid }, { headers: authHeaders() });
    return r.data as { purged: string; session_dir: string | null; logs: string[] };
  },

  /**
   * 跑报告生成。**走盘上那条批处理**(`report_generator --session-id`),
   * 不是 `report_live` —— 后者读的是服务进程内存里的数据,事后跑不了。
   * 返回 `task_id`,要轮询 `taskStatus`。
   */
  generateReport: async (sid: string) => {
    const r = await axios.post(`${API_BASE_URL}/api/run/report`, null,
      { headers: authHeaders(), params: { session_id: sid } });
    return r.data as { task_id: string; status: string; message?: string };
  },

  /**
   * **真删本场**,给录制页的「不留存 / 这是测试」那条路用。
   *
   * ⚠️ 它走的是**语音服务**(`VOICE_API_URL`),**不是**面板 —— 因为录制的时候没有
   *    管理员 token(那是素材页的东西,而且 token 在 sessionStorage 里按标签页隔离)。
   *    语音服务那条入口本来就没有密码,与它同组的 `/label`、`/question` 同一姿态。
   *    实现在服务端是**同一份**(`session_purge.purge_session`)。
   */
  discard: async (sid: string) => {
    const r = await axios.post(`${VOICE_API_URL}/session/${encodeURIComponent(sid)}/discard`);
    return r.data as { status: string; session_id: string; session_dir: string | null; logs: string[] };
  },

  taskStatus: async (taskId: string) => {
    const r = await axios.get(`${API_BASE_URL}/api/task/${encodeURIComponent(taskId)}`,
      { headers: authHeaders() });
    return r.data as { status: string; output?: string; error?: string };
  },

  videoUrl: (sid: string): string =>
    withToken(`${API_BASE_URL}/api/recordings/${encodeURIComponent(sid)}/video`),

  fileUrl: (sid: string, name: string): string =>
    withToken(`${API_BASE_URL}/api/recordings/${encodeURIComponent(sid)}/file`
      + `?name=${encodeURIComponent(name)}`),
};
