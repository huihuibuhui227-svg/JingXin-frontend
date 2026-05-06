
interface MediaCaptureOptions {
  videoWidth?: number;
  videoHeight?: number;
  frameRate?: number;
  onFrame?: (frame: Blob) => void;
  onAudioData?: (audioBlob: Blob) => void;
}

class MediaCaptureService {
  private videoStream: MediaStream | null = null;
  private audioStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private captureInterval: NodeJS.Timeout | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;

  async startVideo(options: MediaCaptureOptions = {}): Promise<boolean> {
    const { videoWidth = 1280, videoHeight = 720 } = options;

    try {
      this.videoStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: videoWidth },
          height: { ideal: videoHeight }
        },
        audio: false
      });
      return true;
    } catch (error) {
      console.error('视频采集失败:', error);
      return false;
    }
  }

  async startAudio(): Promise<boolean> {
    try {
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: true
      });
      return true;
    } catch (error) {
      console.error('音频采集失败:', error);
      return false;
    }
  }

  setVideoElement(element: HTMLVideoElement) {
    this.videoElement = element;
    if (this.videoStream && element) {
      element.srcObject = this.videoStream;
    }
  }

  setCanvasElement(element: HTMLCanvasElement) {
    this.canvasElement = element;
  }

  startFrameCapture(onFrame: (frame: Blob) => void, frameRate: number = 1) {
    if (!this.canvasElement || !this.videoElement) {
      console.error('Canvas或Video元素未设置');
      return;
    }

    const canvas = this.canvasElement;
    const video = this.videoElement;
    const ctx = canvas.getContext('2d');

    this.captureInterval = setInterval(() => {
      if (!video || !canvas || !ctx) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      canvas.toBlob((blob) => {
        if (blob) {
          onFrame(blob);
        }
      }, 'image/jpeg', 0.8);
    }, 1000 / frameRate);
  }

  stopFrameCapture() {
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
    }
  }

  startAudioRecording(onAudioData: (blob: Blob) => void, timeslice: number = 1000) {
    if (!this.audioStream) {
      console.error('音频流未初始化');
      return;
    }

    this.mediaRecorder = new MediaRecorder(this.audioStream, {
      mimeType: 'audio/webm;codecs=opus'
    });

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        onAudioData(event.data);
      }
    };

    this.mediaRecorder.start(timeslice);
  }

  stopAudioRecording(): Blob | null {
    if (!this.mediaRecorder) return null;

    this.mediaRecorder.stop();
    const blob = new Blob([], { type: 'audio/webm' });
    this.mediaRecorder = null;
    return blob;
  }

  stopAll() {
    this.stopFrameCapture();

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    if (this.videoStream) {
      this.videoStream.getTracks().forEach(track => track.stop());
      this.videoStream = null;
    }

    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
  }

  getVideoStream(): MediaStream | null {
    return this.videoStream;
  }

  getAudioStream(): MediaStream | null {
    return this.audioStream;
  }
}

export const mediaCaptureService = new MediaCaptureService();
