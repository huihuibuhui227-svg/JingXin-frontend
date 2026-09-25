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

  speechToText: async (audioFile: File) => {
    const formData = new FormData();
    formData.append('audio', audioFile);

    // 带 id:这次识别会累积进**该会话**的 transcript.json(不带则落 NONE,报告侧排除)
    const response = await axios.post(withSession(`${VOICE_API_URL}/asr`), formData, {
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

