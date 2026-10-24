import { useState, useRef, useCallback } from 'react';

interface UseAudioRecorderProps {
  onAudioData?: (audioBlob: Blob) => void;
  /** 用户在设备选择里挑的麦克风。`null` = 让浏览器自己挑。
   *  ⚠️ 走 ref 而不是依赖:`startRecording` 是 `useCallback(…, [])`,把设备放进
   *     依赖会让它的身份每次渲染都变。 */
  deviceId?: string | null;
}

export const useAudioRecorder = ({ onAudioData, deviceId = null }: UseAudioRecorderProps = {}) => {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const deviceIdRef = useRef(deviceId);
  deviceIdRef.current = deviceId;

  const startRecording = useCallback(async () => {
    try {
      const selected = deviceIdRef.current;
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: selected ? { deviceId: { exact: selected } } : true
      });

      const mediaRecorder = new MediaRecorder(audioStream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
          if (onAudioData) {
            onAudioData(event.data);
          }
        }
      };

      mediaRecorder.start(1000);
      setIsRecording(true);

      return true;
    } catch (error) {
      console.error('录音启动失败:', error);
      return false;
    }
  }, [onAudioData]);

  /**
   * 停止录音,返回**完整**的音频 Blob。
   *
   * ⚠️ 为什么是 `Promise` 而不是直接返回 `Blob`:`MediaRecorder.stop()` 是**异步**的
   * —— 规范里它先排一个最终的 `dataavailable`,再发 `stop`。原先这里三行全是同步的
   * (`rec.stop()` → `new Blob(chunksRef.current)` → `chunksRef.current = []`),
   * 于是**最终那一块永远赶不上这次拼接**。
   *
   * 实测(2026-10-25,同一段 2.82 秒录音):走 `stop()` 收尾只拿到 30904 字节 /
   * 2.34 秒,少掉的那 0.48 秒正是尾巴。而尾巴丢了**不报错**:ASR 照样识别、
   * 界面照样报成功,只是最后一个字没了。
   *
   * 现在等 `stop` 事件到了才拼。调用方必须 `await`(见 `AnswerInput` 里
   * `handleStopRecording`)—— 不 await 就会把 `[object Promise]` 当成音频发出去。
   * 钉子:`src/hooks/__tests__/useCamera.silent-failures.test.mjs`。
   */
  const stopRecording = useCallback((): Promise<Blob | null> => {
    const rec = mediaRecorderRef.current;
    if (!rec) return Promise.resolve(null);
    mediaRecorderRef.current = null;

    return new Promise<Blob>((resolve) => {
      rec.addEventListener('stop', () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        chunksRef.current = [];
        resolve(blob);
      });
      rec.stop();
      rec.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    });
  }, []);

  return {
    isRecording,
    startRecording,
    stopRecording
  };
};
