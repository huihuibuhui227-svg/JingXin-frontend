import { useState, useRef, useCallback } from 'react';

interface UseAudioRecorderProps {
  onAudioData?: (audioBlob: Blob) => void;
}

export const useAudioRecorder = ({ onAudioData }: UseAudioRecorderProps = {}) => {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: true
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
