import axios from 'axios';
import { API_BASE_URL, FACE_API_URL, GESTURE_API_URL, VOICE_API_URL } from '@/utils/constants';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000
});

// 生成固定的 session_id，存储在 localStorage 中
const FACE_SESSION_ID = (() => {
  let sessionId = localStorage.getItem('face_session_id');
  if (!sessionId) {
    // 生成 UUID
    sessionId = crypto.randomUUID ? crypto.randomUUID() :
                'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
                  const r = Math.random() * 16 | 0;
                  const v = c === 'x' ? r : (r & 0x3 | 0x8);
                  return v.toString(16);
                });
    localStorage.setItem('face_session_id', sessionId);
  }
  console.log('🆔 Face Session ID:', sessionId);
  return sessionId;
})();

export const faceApi = {
  analyzeImage: async (file: Blob | File) => {
    const formData = new FormData();

    // 如果是 Blob，转换为 File
    const fileToUpload = file instanceof File ? file : new File([file], 'frame.jpg', {
      type: 'image/jpeg',
      lastModified: Date.now()
    });

    formData.append('file', fileToUpload);

    // 关键：在 URL 中传递 session_id 和 fps 参数
    const response = await axios.post(
      `${FACE_API_URL}/analyze?session_id=${FACE_SESSION_ID}&fps=30`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' }
      }
    );

    return response.data;
  }
};

// ... existing code ...

// ... existing code ...


export const gestureApi = {
  analyzeGesture: async (file: Blob | File) => {
    const formData = new FormData();

    // 如果是 Blob，转换为 File
    const fileToUpload = file instanceof File ? file : new File([file], 'frame.jpg', {
      type: 'image/jpeg',
      lastModified: Date.now()
    });

    formData.append('file', fileToUpload);

    const response = await axios.post(`${GESTURE_API_URL}/analyze`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });

    return response.data;
  },

  resetAnalyzers: async () => {
    const response = await axios.post(`${GESTURE_API_URL}/reset`);
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

    const response = await axios.post(`${VOICE_API_URL}/asr`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });

    return response.data;
  },

  interview: {
    start: async () => {
      const response = await axios.post(`${VOICE_API_URL}/interview/start`);
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

      const response = await axios.post(
        `${VOICE_API_URL}/interview/answer_audio`,
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

      const response = await axios.post(
        `${VOICE_API_URL}/research/answer_audio`,
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
  runModule: async (module: 'face' | 'gesture' | 'voice' | 'report') => {
    const response = await axios.post(`${API_BASE_URL}/api/run/${module}`);
    return response.data;
  },

  getFiles: async (folderName: string) => {
    const response = await axios.get(`${API_BASE_URL}/api/files/${folderName}`);
    return response.data;
  }
};


export default api;

