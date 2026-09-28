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

  const stopRecording = useCallback((): Blob | null => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);

      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      chunksRef.current = [];
      return blob;
    }
    return null;
  }, []);

  return {
    isRecording,
    startRecording,
    stopRecording
  };
};
