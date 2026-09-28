import axios from 'axios';
import { API_BASE_URL, FACE_API_URL, GESTURE_API_URL, VOICE_API_URL } from '@/utils/constants';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000
});

// ── 会话 id:由**服务端铸造**(M2) ──────────────────────────────────────
//
// 为什么不自己造 UUID(2026-09-24 之前的做法,已废弃):
//   后端三个模块要靠同一个 id 归堆,而**报告侧的加载器只认服务端铸号的形态**
//   (`YYYYMMDD_HHMMSS_xxxx`)。前端自己造 UUID 的话,face/gesture 的日志文件名
//   永远匹配不上那个正则 —— 报告端**根本看不到它们**。实测:这是报告恒为
//   「本次观测覆盖 0 / 20」的根因之一。
//
// 生命周期:
//   * 调 `/interview/start` **之前**为空 —— 此时发帧会落进 `NONE` 桶(报告头会点出来);
//   * `interview.start()` 拿到服务端返回的 id 后填上,face / gesture / voice 全部共用它。
let sessionId: string | null = null;

// 清掉旧版本残留在 localStorage 里的 UUID —— 不清的话老用户会一直用旧值,id 永远对不上
localStorage.removeItem('assessment_session_id');
localStorage.removeItem('face_session_id');

export const getSessionId = (): string | null => sessionId;

export const setSessionId = (id: string | null): void => {
  sessionId = id;
  console.log('🆔 本场 session_id:', id ?? '(尚未开始会话 —— 发帧会落进 NONE 桶)');
};

/** 给 URL 追一个 session_id 参数;**还没开始会话时不追**(而不是带上一个编出来的 id)。
 *  `override` 用于"要读的/要跑的不是当前这场"的调用(报告页可以指定另一场);
 *  缺省(传 `undefined`)就是当前这场。 */
const withSession = (url: string, override: string | null = sessionId): string =>
  override ? `${url}${url.includes('?') ? '&' : '?'}session_id=${override}` : url;

export const faceApi = {
  analyzeImage: async (file: Blob | File) => {
    const formData = new FormData();

    // 如果是 Blob，转换为 File
    const fileToUpload = file instanceof File ? file : new File([file], 'frame.jpg', {
      type: 'image/jpeg',
      lastModified: Date.now()
    });

    formData.append('file', fileToUpload);

    // session_id 由 withSession 拼(还没开始会话时不带)—— fps 固定 30
    const response = await axios.post(
      withSession(`${FACE_API_URL}/analyze?fps=30`),
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' }
      }
    );

    return response.data;
  }
};


export const gestureApi = {
  analyzeGesture: async (file: Blob | File) => {
    const formData = new FormData();

    // 如果是 Blob，转换为 File
    const fileToUpload = file instanceof File ? file : new File([file], 'frame.jpg', {
      type: 'image/jpeg',
      lastModified: Date.now()
    });

    formData.append('file', fileToUpload);

    const response = await axios.post(
      withSession(`${GESTURE_API_URL}/analyze`),
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );

    return response.data;
  },

  resetAnalyzers: async () => {
    // 带 id 才是"重置**这场**" —— 不带的话后端走的是"清掉所有会话"那条路
    const response = await axios.post(withSession(`${GESTURE_API_URL}/reset`));
    return response.data;
  }
};

export const voiceApi = {
  textToSpeech: async (text: string) => {
    const response = await axios.post(`${VOICE_API_URL}/tts`, { text });
    return response.data;
  },

  /**
   * 语音识别(ASR)。
   *
   * ⚠️ **`record: false` = 这次识别是「预览」,不是「回答」** —— 服务端不会把它
   *    算进本场的 transcript.json(仍照常留存原始字节、照常回识别文本)。
   *    录音后先识别一遍显示给面试官看,提交时**同一份音频**再走
   *    `/interview/answer_audio`(权威的那条)⟹ 不标这一下,同一句话会在账本里
   *    存两遍(2026-09-26 实测:24 段 = 12 段 × 2,连时间戳都一样),而 M3 要用
   *    逐字时间戳算**语速/停顿/反应潜伏期** —— 翻倍是静默的。
   *    `record` 缺省 true:与从前逐字一致(纯 ASR 调用方不受影响)。
   */
  speechToText: async (audioFile: File, opts?: { record?: boolean }) => {
    const formData = new FormData();
    formData.append('audio', audioFile);

    const record = opts?.record !== false;
    // 带 id:这次识别会累积进**该会话**的 transcript.json(不带则落 NONE,报告侧排除)
    const response = await axios.post(
      withSession(`${VOICE_API_URL}/asr${record ? '' : '?record=false'}`), formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });

    return response.data;
  },

  interview: {
    start: async () => {
      const response = await axios.post(`${VOICE_API_URL}/interview/start`);
      // M2:服务端铸号是**唯一来源** —— 拿到就存下,face / gesture / voice 全部共用它。
      // (在此之前是前端自己造 UUID,导致 face/gesture 的日志报告端根本看不见。)
      setSessionId(response.data?.session_id ?? null);
      return response.data;
    },

    getQuestion: async () => {
      const response = await axios.get(`${VOICE_API_URL}/interview/question`);
      return response.data;
    },

    submitAnswer: async (answer: string) => {
      const response = await axios.post(`${VOICE_API_URL}/interview/answer`, {
        answer
      });
      return response.data;
    },

    submitAudioAnswer: async (audioFile: File) => {
      const formData = new FormData();
      formData.append('audio', audioFile);

      // ⚠️ 必须带 session_id。**不带的话回答会落进 `NONE` 桶,而报告侧整体排除 NONE**
      //    —— 也就是"录了、也识别了,但报告里什么都没有"。这条在 2026-09-24 之前
      //    一直是漏的(前端从来没给这个请求带过 id),是 M2 修的第二处。
      const response = await axios.post(
        withSession(`${VOICE_API_URL}/interview/answer_audio`),
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      return response.data;
    },

    getEvaluation: async () => {
      const response = await axios.get(`${VOICE_API_URL}/interview/evaluation`);
      return response.data;
    }
  },

  research: {
    start: async () => {
      const response = await axios.post(`${VOICE_API_URL}/research/start`);
      // M2.1(第 19 条):科研评估**自成一场** —— 服务端也铸号了,这里必须存下来。
      // 不存的话会走两条坏路:新页面直接做科研 → 回答落 NONE 桶;先面试再科研 →
      // 顺延上一场面试的号,科研回答的原句被写进面试会话的录制目录。
      setSessionId(response.data?.session_id ?? null);
      return response.data;
    },

    getQuestion: async () => {
      const response = await axios.get(`${VOICE_API_URL}/research/question`);
      return response.data;
    },

    submitAnswer: async (answer: string) => {
      const response = await axios.post(`${VOICE_API_URL}/research/answer`, {
        answer
      });
      return response.data;
    },

    submitAudioAnswer: async (audioFile: File) => {
      const formData = new FormData();
      formData.append('audio', audioFile);

      // 同 interview:不带 id 的话回答会落进 NONE 桶,报告侧整体排除
      const response = await axios.post(
        withSession(`${VOICE_API_URL}/research/answer_audio`),
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      return response.data;
    },

    getEvaluation: async () => {
      const response = await axios.get(`${VOICE_API_URL}/research/evaluation`);
      return response.data;
    }
  }
};

/** 会话级留存端点(voice :8001)要 `session_id`,而且它走的是**路径参数** ——
 *  别拿 `withSession` 拼(那个拼的是 `?session_id=`,是另外三个服务的形态)。 */
const requireSessionId = (what: string): string => {
  const sid = getSessionId();
  if (!sid) {
    // 不编一个 id:没有会话就**没有**可上报的对象,编一个只会把数据写进 NONE 桶
    // (报告侧整体排除 NONE)⟹ 看着成功、其实什么都没有。
    throw new Error(`尚未开始会话,无法${what}`);
  }
  return sid;
};

// ── M2.6:原始媒体留存 + 提问时刻(spec §5.3 / §5.6)──────────────────────
export const sessionApi = {
  /**
   * 上传本场**原生音视频**(`useCamera` 里 MediaRecorder 录的 `camera.webm`)。
   *
   * ⚠️ 刻意不用上面那个 `api` 实例:它 `timeout: 30000`,而整场录像按 R5 实测的
   *    码率(≈172 KB/s)可以有几百 MB —— 慢链路上 30 秒会把一次**合法**上传掐断,
   *    后果是这一场的原生录像整个没有。这里显式 `timeout: 0`(不设上限)。
   * ⚠️ 重复上传**覆盖**服务端同名文件,而账本各留一行(sha 各不同)⟹ 覆盖有据可查。
   */
  uploadMedia: async (video: Blob) => {
    const sid = requireSessionId('上传本场原生视频');
    const formData = new FormData();
    formData.append('file', video, 'camera.webm');   // 字段名必须是 file(spec §5.3)
    const response = await axios.post(
      `${VOICE_API_URL}/session/${sid}/media`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 0 }
    );
    return response.data;
  },

  /**
   * 记下本场的**标注**(场次序号 / 姓名 / 学号 / 院系)→ 服务端落 `label.json`。
   *
   * 为什么必须走服务端:标注得**存在服务器上** —— 换台电脑打开也查得到。那是
   * localStorage 顶不了的事(那是"在这台电脑上记得",不是"记下来了")。
   *
   * ⚠️ 服务端会回**拼好的** `label`,界面显示它,别在本地再拼一遍:
   *    拼法只允许有一处定义(`session_meta.compose_label`)。
   * ⚠️ 标注**不进** `session_id`:报告侧只认 `_log_{日期}_{时刻}[_4位hex]` 这个
   *    文件名形态,塞进去会让每份日志都匹配不上 ⟹ 报告一份都加载不到。
   *    所以它是**另存的一份**,不碰 id、不碰目录名。
   * ⚠️ 同一会话再调一次 = **覆盖**(打错一个字要能改)。
   */
  setLabel: async (fields: {
    serial: string; name: string; student_id: string; department: string;
    /** 本场征询结果。`"full"` = 全都同意;`"audio_only"` = 只同意声音。
     *  它随标注一起落 `label.json` —— 同意与否是**证据**,不能只活在页面状态里。
     *  ⚠️ 取值由服务端校验,未知值 400(不回落默认:把"没同意"当成"全同意"是
     *     最坏的方向)。 */
    consent?: 'full' | 'audio_only';
  }) => {
    const sid = requireSessionId('上报本场标注');
    const response = await axios.post(`${VOICE_API_URL}/session/${sid}/label`, fields);
    return response.data;
  },

  /**
   * 上报一道题的提问窗口 —— `response_latency` 只此一途(spec §3.9 / §5.6)。
   *
   * ⚠️ 时刻是**墙钟秒**。JS 的 `Date.now()` 是**毫秒**,直接发会被服务端的量程闸
   *    400 掉(`session_meta._validate_window`,容差 1 天),而那条报错就是冲着
   *    这个写的。**换算由调用方做**(`/1000`)。
   * ⚠️ `qid` 是**题目原文**:题库没有 id(见 `session_meta` 模块开头)。
   */
  reportQuestion: async (window: {
    qid: string; index: number; ask_start: number; ask_end: number;
  }) => {
    const sid = requireSessionId('上报提问时刻');
    const response = await axios.post(`${VOICE_API_URL}/session/${sid}/question`, {
      qid: window.qid,
      index: Math.trunc(window.index),   // 服务端要非负整数,且显式拒 bool
      ask_start: window.ask_start,
      ask_end: window.ask_end,
    });
    return response.data;
  },
};

export const dashboardApi = {
  // M2.1(第 18 条):写路径也要带 id —— 不带的话后端取"最新一场",而那可能是一场刚
  // `/interview/start` 出来、还没有任何数据的会话(实测报告页因此显示「暂无报告数据」)。
  runModule: async (module: 'face' | 'gesture' | 'voice' | 'report', sessionId?: string | null) => {
    const response = await axios.post(withSession(`${API_BASE_URL}/api/run/${module}`, sessionId));
    return response.data;
  },

  getFiles: async (folderName: string) => {
    const response = await axios.get(`${API_BASE_URL}/api/files/${folderName}`);
    return response.data;
  },

  // M2.1:读路径带 id;`sessionId` 缺省 = 当前这场,都没传才让后端取最新一场
  getStructuredReport: async (sessionId?: string | null) => {
    const response = await axios.get(withSession(`${API_BASE_URL}/api/report/structured`, sessionId));
    return response.data;
  },
};

export default api;

