import { useState, useRef, useCallback } from 'react';

interface UseCameraProps {
  onFrame?: (frame: Blob) => void;
  frameRate?: number;
}

export const useCamera = ({ onFrame, frameRate = 1 }: UseCameraProps = {}) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRecordingRef = useRef(false);
  const captureStartedRef = useRef(false);

  const startCamera = useCallback(async () => {
    try {
      console.log('📷 请求摄像头权限...');
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: false
      });

      console.log('✅ 获得摄像头权限，流ID:', mediaStream.id);
      setStream(mediaStream);

      if (videoRef.current) {
        console.log('📺 video 元素存在，设置 srcObject');
        videoRef.current.srcObject = mediaStream;

        // 添加事件监听器来调试
        videoRef.current.onloadedmetadata = () => {
          console.log('📊 视频元数据加载完成, 尺寸:', videoRef.current?.videoWidth, 'x', videoRef.current?.videoHeight);
        };

        videoRef.current.onplay = () => {
          console.log('▶️ 视频开始播放');
        };

        console.log('📹 摄像头已启动，等待视频加载...');
        return true;
      } else {
        console.error('❌ videoRef.current 为 null');
      }

      return true;
    } catch (error) {
      console.error('❌ 摄像头启动失败:', error);
      return false;
    }
  }, []);

  const startCapture = useCallback(() => {
    console.log('🎬 startCapture 被调用');
    console.log('  - canvasRef.current:', !!canvasRef.current);
    console.log('  - videoRef.current:', !!videoRef.current);
    console.log('  - captureStartedRef.current:', captureStartedRef.current);

    if (!canvasRef.current || !videoRef.current) {
      console.warn('⚠️ Canvas 或 Video 元素未就绪');
      return;
    }

    // 防止重复启动
    if (captureStartedRef.current) {
      console.warn('⚠️ 视频帧捕获已在运行，跳过');
      return;
    }

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      console.error('❌ 无法获取 Canvas 上下文');
      return;
    }

    console.log('🔍 检查视频状态, readyState:', video.readyState, '(0=无数据, 1=元数据, 2=当前帧, 3=未来数据, 4=足够数据)');
    console.log('  - video.videoWidth:', video.videoWidth);
    console.log('  - video.videoHeight:', video.videoHeight);
    console.log('  - video.srcObject:', video.srcObject ? '已设置' : '未设置');

    // 如果视频未就绪，等待它
    if (video.readyState < video.HAVE_ENOUGH_DATA) {
      console.warn('⚠️ 视频数据未就绪，设置监听器等待...');

      const handleCanPlay = () => {
        console.log('✅ canplay 事件触发, readyState:', video.readyState);
        video.removeEventListener('canplay', handleCanPlay);
        video.removeEventListener('loadeddata', handleLoadedData);
        beginCapture(canvas, video, ctx);
      };

      const handleLoadedData = () => {
        console.log('✅ loadeddata 事件触发, readyState:', video.readyState);
        video.removeEventListener('canplay', handleCanPlay);
        video.removeEventListener('loadeddata', handleLoadedData);
        beginCapture(canvas, video, ctx);
      };

      video.addEventListener('canplay', handleCanPlay, { once: true });
      video.addEventListener('loadeddata', handleLoadedData, { once: true });

      // 设置超时，防止无限等待
      setTimeout(() => {
        if (!captureStartedRef.current) {
          console.warn('⚠️ 视频加载超时 (3秒)，强制开始捕获');
          console.log('  - 当前 readyState:', video.readyState);
          video.removeEventListener('canplay', handleCanPlay);
          video.removeEventListener('loadeddata', handleLoadedData);
          beginCapture(canvas, video, ctx);
        }
      }, 3000);

      return;
    }

    console.log('✅ 视频已就绪，立即开始捕获');
    beginCapture(canvas, video, ctx);
  }, [frameRate, onFrame]);

  const beginCapture = useCallback((canvas: HTMLCanvasElement, video: HTMLVideoElement, ctx: CanvasRenderingContext2D) => {
    if (captureStartedRef.current) {
      console.warn('⚠️ beginCapture 被重复调用，跳过');
      return;
    }

    captureStartedRef.current = true;
    isRecordingRef.current = true;
    setIsRecording(true);

    console.log('📹 开始视频帧捕获，帧率:', frameRate, 'fps');
    console.log('  - Canvas 尺寸:', canvas.width, 'x', canvas.height);
    console.log('  - Video 尺寸:', video.videoWidth, 'x', video.videoHeight);

    let frameCount = 0;
    intervalRef.current = setInterval(() => {
      if (!isRecordingRef.current) return;

      if (video.readyState < video.HAVE_ENOUGH_DATA) {
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      canvas.toBlob((blob) => {
        if (blob && onFrame) {
          frameCount++;
          if (frameCount % 10 === 0) {
            console.log('📸 已发送', frameCount, '帧，Blob 大小:', blob.size, 'bytes');
          }
          onFrame(blob);
        }
      }, 'image/jpeg', 0.8);
    }, 1000 / frameRate);
  }, [frameRate, onFrame]);

  const stopCapture = useCallback(() => {
    console.log('⏹️ stopCapture 被调用');
    captureStartedRef.current = false;
    isRecordingRef.current = false;
    setIsRecording(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      console.log('⏹️ 停止视频帧捕获');
    }
  }, []);

  const stopCamera = useCallback(() => {
    console.log('🛑 stopCamera 被调用');
    stopCapture();
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      console.log('🛑 摄像头流已停止');
    }
  }, [stream, stopCapture]);

  return {
    stream,
    isRecording,
    videoRef,
    canvasRef,
    startCamera,
    startCapture,
    stopCapture,
    stopCamera
  };
};

