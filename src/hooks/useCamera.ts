import { useState, useRef, useCallback, useEffect } from 'react';

interface UseCameraProps {
  onFrame?: (frame: Blob) => void;
  frameRate?: number;
  /** M2.6:本场**原生音视频**录完时回调一次(整场一个 blob,交给调用方上传)。
   *  在 `stopCapture` 之后、`MediaRecorder.onstop` 里触发 —— 不是 `stopCapture`
   *  同步返回时(那时最后一块分片还没吐出来)。
   *
   *  ⚠️ **返回 promise 有契约意义**:录像在整场里只活在内存中,所以本 hook 会挂一个
   *  `beforeunload` 拦截(刷新/关页就把整场录像永久丢了)。那个拦截**一直留到你返回的
   *  promise 落定**为止 —— blob 到手不等于存下了。做上传的调用方请把上传的 promise
   *  return 出来;不 return 的话拦截会在 `onstop` 时立刻撤掉,上传期间就没人拦。 */
  onVideoReady?: (video: Blob) => void | Promise<void>;
  /** 采集**降级**了(不是彻底失败)—— 例如只要到摄像头没要到麦克风、
   *  原生录像中途出错。退化本身可以接受,但**必须说出来**:这一场留下的素材
   *  与"正常那一场"不是一回事,不能让它长得一样。 */
  onDegraded?: (reason: string) => void;
  /** 受试者**只同意音频** ⟹ **根本不打开摄像头**:请求 `{audio, video:false}`,
   *  不抽帧、不产生任何画面。face / gesture 两个模态因此完全没有数据。
   *
   *  ⚠️ 这是**选出来的模式,不是降级** —— 所以它**不报 `onDegraded`**。
   *     报横幅会让人以为出了故障,而这是征询的结果。
   *  ⚠️ 原生录像仍然开:得到一份**只有音轨**的 webm。逐题回答那条路
   *     (`useAudioRecorder` → `/answer_audio`)另有一份音频;这一份是为了
   *     `/analysis`(它没有逐题回答)。 */
  audioOnly?: boolean;
  /** 选定的设备。`null`/不传 = 让浏览器自己挑(老行为)。
   *  ⚠️ 只在**开始时**生效:录到一半换设备要重开整条流。 */
  videoDeviceId?: string | null;
  audioDeviceId?: string | null;
}

/** 本场原生录像的容器。**写死**是定的设计(spec §5.4 / 裁定 R5):
 *  R5 在 Windows Edge 153 上实测这一串是 `audio:live, video:live`、回放有画有声,
 *  所以不退回「另存一路 audio.webm」。别改成 `video/webm` 裸串 —— 那会让浏览器
 *  自己挑编码,而下游要的是确定的 vp8+opus。 */
const VIDEO_MIME = 'video/webm;codecs=vp8,opus';

export const useCamera = ({
  onFrame, frameRate = 1, onVideoReady, onDegraded,
  audioOnly = false, videoDeviceId = null, audioDeviceId = null,
}: UseCameraProps = {}) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRecordingRef = useRef(false);
  const captureStartedRef = useRef(false);

  // M2.6:原生录像用的三件。**全部走 ref**,不走 state —— 原因是 `stopCapture`
  // 必须能被**卸载清理**调用(见 AssessmentPage 的 `useEffect(..., [])`),
  // 而那条路径上的闭包是首次渲染的版本:`stopCamera` 里 `if (stream)` 那句
  // 在卸载时 stream 恒为 null(既有形态),挂在那儿的收尾会**静默丢录像**。
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const onVideoReadyRef = useRef(onVideoReady);
  const onDegradedRef = useRef(onDegraded);
  // 模式与设备也走 ref:`startCamera` 是 `useCallback(…, [])`,把这三个放进依赖
  // 会让它的身份每次渲染都变,而调用方是在 effect 里按身份调它的。
  const startNativeRecorderRef = useRef<() => void>(() => {});
  const audioOnlyRef = useRef(audioOnly);
  const videoDeviceIdRef = useRef(videoDeviceId);
  const audioDeviceIdRef = useRef(audioDeviceId);
  // 录像是不是**我们主动**停的。见 `onstop` 里那段:不是主动停的,说明流在录制中途
  // 自己断了(摄像头被拔/被别的应用抢走),那份文件就是截断的,必须报出来。
  const stopRequestedRef = useRef(false);
  // 「刷新/关页会丢整场录像」的拦截句柄。见 onVideoReady 的契约说明。
  const beforeUnloadRef = useRef<((e: BeforeUnloadEvent) => void) | null>(null);

  const releaseBeforeUnload = useCallback(() => {
    if (!beforeUnloadRef.current) return;
    window.removeEventListener('beforeunload', beforeUnloadRef.current);
    beforeUnloadRef.current = null;
  }, []);
  useEffect(() => {
    onVideoReadyRef.current = onVideoReady;
    onDegradedRef.current = onDegraded;
    audioOnlyRef.current = audioOnly;
    videoDeviceIdRef.current = videoDeviceId;
    audioDeviceIdRef.current = audioDeviceId;
  });

  const startCamera = useCallback(async () => {
    try {
      console.log('📷 请求摄像头权限...');
      // M2.6(R5):`audio: false` → `true`。在这一路里**同时**取麦克风,
      // 于是同一个 mediaStream 上就能挂 MediaRecorder 录下原生音视频。
      // R5 实测:与 useAudioRecorder 另开的那一路麦克风**同时开不打架**,
      // 所以不必退回「另存一路 audio.webm」。
      // 选定的设备:给了就用 `exact` 钉死(用户在下拉框里明确选的那一个),
      // 没给就让浏览器自己挑。
      const aDev = audioDeviceIdRef.current;
      const vDev = videoDeviceIdRef.current;
      const audioConstraint: MediaTrackConstraints | boolean =
        aDev ? { deviceId: { exact: aDev } } : true;
      const videoConstraint: MediaTrackConstraints = {
        width: 1280, height: 720,
        ...(vDev ? { deviceId: { exact: vDev } } : {}),
      };

      let mediaStream: MediaStream;
      if (audioOnlyRef.current) {
        // **只采声音**:受试者只同意音频 ⟹ 摄像头**一个字节都不开**。
        // 这里的"退化"没有意义(没有画面可退),所以失败就是失败。
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: audioConstraint, video: false,
          });
        } catch (error) {
          console.error('❌ 只采声音模式:麦克风也没有拿到:', error);
          onDegradedRef.current?.('麦克风没有打开 —— 本场采不到任何声音');
          return false;
        }
        console.log('🎙️ 只采声音模式:摄像头未打开');
        streamRef.current = mediaStream;
        setStream(mediaStream);
        return true;
      }

      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraint,
          // 只在**真的有人要这份录像**时才要麦克风。`RealtimeAnalysis` 也用了本 hook
          // 而没有任何录像消费者 —— 在那种纯视觉页面上要麦克风是白要,
          // 还会让"拒麦克风"变成"连画面也没有"。
          audio: onVideoReadyRef.current ? audioConstraint : false
        });
      } catch (error) {
        // ⚠️ 退一步只取摄像头。这一步**不是可有可无的**:`{video, audio: true}` 是
        //    **一个**请求,麦克风被拒/不存在会把整个请求一起拒掉 ⟹ 连画面也没有:
        //    既没有 camera.webm,也没有喂给 face/gesture 的帧 —— 而界面照旧往下走,
        //    于是一场"看着正常"的会话什么都没采到。
        //    退化后的素材与正常那一场**不是一回事**,所以下面要报给调用方。
        console.warn('⚠️ 摄像头+麦克风一起取失败,退化为只要摄像头:', error);
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraint,
          audio: false
        });
        onDegradedRef.current?.(
          '只拿到了摄像头、没拿到麦克风 —— 本场 camera.webm 将没有声音,语音回答也可能不可用'
        );
      }

      console.log('✅ 获得摄像头权限，流ID:', mediaStream.id);
      streamRef.current = mediaStream;
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

    // 防止重复启动
    if (captureStartedRef.current) {
      console.warn('⚠️ 视频帧捕获已在运行，跳过');
      return;
    }

    // ── 只采声音:没有画面可抽 ────────────────────────────────────────────────
    // 这条路要**绕开 canvas/video 那两个 ref**:只采声音时页面上根本没有摄像头
    // 视图(`videoRef.current` 是 null),跟着老代码走会在上面那句直接 return ⟹
    // **原生录音永远不开** ⟹ "只录声音"最后什么都没录到,而且不报任何错。
    if ((streamRef.current?.getVideoTracks().length ?? 0) === 0) {
      console.log('🎙️ 本场没有视频轨(只采声音)—— 直接开原生录音,不抽帧');
      captureStartedRef.current = true;
      isRecordingRef.current = true;
      setIsRecording(true);
      // 间接引用:`startNativeRecorder` 在本函数**之后**才定义(TDZ)。
      startNativeRecorderRef.current();
      return;
    }

    if (!canvasRef.current || !videoRef.current) {
      console.warn('⚠️ Canvas 或 Video 元素未就绪');
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

  /** M2.6:在**同一个 mediaStream** 上挂 MediaRecorder,整场录一个原生音视频。
   *  与帧捕获同生共死(所以由 `beginCapture` 调用、由 `captureStartedRef` 把关),
   *  收尾统一在 `stopCapture`。 */
  const releaseStream = useCallback(() => {
    const mediaStream = streamRef.current;
    streamRef.current = null;
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      console.log('🛑 摄像头流已停止');
    }
    setStream(null);
  }, []);

  const startNativeRecorder = useCallback(() => {
    // 没人要这份录像就**别录**:`RealtimeAnalysis` 也用了本 hook 而**不传**
    // `onVideoReady`。在那种纯视觉页面上录像是净负担 —— 白要一次麦克风权限,
    // 还把每片 1 秒的分片在内存里攒到几百 MB,最后在 `onstop` 里被丢掉。
    if (!onVideoReadyRef.current) return;

    const mediaStream = streamRef.current;
    if (!mediaStream) {
      console.error('❌ 没有 mediaStream,原生录像无法开始 —— 本场将没有 camera.webm');
      return;
    }
    if (mediaRecorderRef.current) {
      console.warn('⚠️ 原生录像已在运行，跳过');
      return;
    }
    if (typeof MediaRecorder === 'undefined') {
      console.error('❌ 该浏览器没有 MediaRecorder —— 本场将没有 camera.webm');
      return;
    }

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(mediaStream, { mimeType: VIDEO_MIME });
    } catch (error) {
      // 不退回别的容器:设计把编码钉死在 vp8+opus。宁可这一场没有录像
      //(收尾对账会点出来),也不要一份编码不明的文件冒充"原始素材"。
      console.error(`❌ 无法以 ${VIDEO_MIME} 开录(本场将没有 camera.webm):`, error);
      return;
    }

    videoChunksRef.current = [];
    stopRequestedRef.current = false;
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) videoChunksRef.current.push(event.data);
    };
    recorder.onerror = (event) => {
      // 出错后 MediaRecorder 会照常走 `onstop`,于是**一份截断的录像**会被当成
      // 这一场的完整 camera.webm 上传(服务端还会回 stored:true + 一个 sha)。
      // 字节留着(半份好过没有),但**必须让这份文件不再是"看着完整"的**。
      // 规范把错误挂在**事件**上(`MediaRecorderErrorEvent.error`),`MediaRecorder` 上
      // 没有 `.error` 属性(旧版曾有,已移除)—— 而本仓的 TS DOM lib 里连那个事件类型
      // 都没有,所以按结构取一下,取不到就整份打出来。
      const detail = (event as unknown as { error?: unknown }).error;
      console.error('❌ 原生录像出错(本场录像可能不完整):', detail ?? event);
      onDegradedRef.current?.('原生录像中途出错 —— 存下的 camera.webm 可能不完整');
    };
    recorder.onstop = () => {
      mediaRecorderRef.current = null;
      // 不是我们叫停的 ⟹ 流在录制**中途**自己断了(摄像头被拔/被别的应用抢走)。
      // 这条路不一定先触发 `onerror`,所以单靠 `onerror` 抓不住它 ——
      // 而少了这一条,一份截断的录像会被原样记成"这一场的完整 camera.webm"。
      if (!stopRequestedRef.current) {
        console.error('❌ 原生录像不是在本场收尾时停下的 —— 存下的文件是**截断的**');
        onDegradedRef.current?.(
          '原生录像中途断了(摄像头被拔或被其他应用占用?)—— camera.webm 是截断的,不完整'
        );
      }
      const chunks = videoChunksRef.current;
      videoChunksRef.current = [];
      // 分片已经到手,这时才放掉摄像头轨道。反过来(先停轨道、再等 onstop)
      // 有丢掉结尾那一片的风险 —— 而那是**整场录像的结尾**。
      releaseStream();
      if (chunks.length === 0) {
        // 不造一个 0 字节的 blob 去上传 —— 服务端也会 400,而"看着像有、其实没有"
        // 正是本项目在杀的形态。
        console.warn('⚠️ 本场没有录到任何原生分片 —— 不上传(不编一份空录像出来)');
        // ⚠️ **必须报给调用方**。此前这里只有一行 console.warn,于是"这一场压根没有
        //    原生录像"这件事在界面上完全看不见 —— 而它正是本仓最贵的那类静默失效。
        //    调用方据此知道"门禁永远不会开",不然会停在一条没有出口的路上。
        onDegradedRef.current?.(
          '本场没有录到任何原生录像 —— 摄像头可能没起来,或这条流在中途就断了'
        );
        releaseBeforeUnload();     // 没有录像可丢,拦截就该撤
        return;
      }
      const video = new Blob(chunks, { type: 'video/webm' });
      console.log('🎥 原生录像收尾，大小:', video.size, 'bytes');

      // 拦截留到**上传落定**才撤:blob 到手 ≠ 存下了。所以调用方返回的 promise 在这里
      // 被接住(见 onVideoReady 的契约说明)。
      let pending: unknown;
      try {
        pending = onVideoReadyRef.current?.(video);
      } catch (error) {
        console.error('❌ 交棒给上传方时抛了:', error);
      }
      if (pending && typeof (pending as Promise<unknown>).then === 'function') {
        void (pending as Promise<unknown>).finally(releaseBeforeUnload);
      } else {
        console.warn('⚠️ onVideoReady 没有返回 promise —— 上传期间的刷新拦截已提前撤掉');
        releaseBeforeUnload();
      }
    };

    // ⚠️ `start()` **也会抛**(`NotSupportedError`:流的轨道已经全部结束 —— 摄像头
    //    被拔了/被别的应用抢了;`InvalidStateError`:已经 start 过)。所以必须:
    //    ① 包在 try 里;② **先 start 成功、再挂进 ref**。
    //    顺序反了会卡死:ref 指向一个从没启动过的 recorder ⟹ `stopCapture` 的
    //    `state !== 'inactive'` 判 false(它本来就是 inactive)⟹ `onstop` 永不触发
    //    ⟹ `releaseStream()` 永不执行 ⟹ **摄像头轨道一直开着**,而这一场也永远不上传。
    try {
      // 1 秒一片:MediaRecorder 只在 stop() **之后异步**吐最后一块 ——
      // 这也正是不能照抄 useAudioRecorder 那个"stop() 完就同步拼 blob"的原因
      // (那样会丢掉结尾那一片)。
      recorder.start(1000);
    } catch (error) {
      console.error('❌ 原生录像启动失败(本场将没有 camera.webm):', error);
      return;                     // ref 保持 null ⟹ 收尾那条路照常放掉轨道
    }
    mediaRecorderRef.current = recorder;
    console.log('🎥 原生录像已开始，容器:', VIDEO_MIME);

    // 从这一刻起,整场录像**只活在内存里** —— 一次 F5 就永久没了(spec 的"录完就补不回来"
    // 在这里是字面意思)。所以挂一个拦截,直到上传落定才撤(见 onstop)。
    if (!beforeUnloadRef.current) {
      const handler = (e: BeforeUnloadEvent) => {
        e.preventDefault();
        e.returnValue = '';   // 现代浏览器忽略自定义文案,但**必须**是非空值才会弹
        return '';
      };
      beforeUnloadRef.current = handler;
      window.addEventListener('beforeunload', handler);
      console.log('🛡️ 已挂「刷新会丢录像」拦截(上传落定后自动撤)');
    }
  }, [releaseStream, releaseBeforeUnload]);

  // 定义完就挂上,供上面 `startCapture` 的“只采声音”分支使用(见那里的 TDZ 说明)。
  startNativeRecorderRef.current = startNativeRecorder;

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

    startNativeRecorder();

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
  }, [frameRate, onFrame, startNativeRecorder]);

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

    // M2.6:原生录像也在这里收尾。**必须放在 stopCapture 而不是 stopCamera** ——
    // 卸载时只有这条路走得到(理由见文件上方 streamRef 那段注释)。
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      // 只 stop(),**不在这里拼 blob**:最后一块分片要等 onstop 才吐出来,
      // 拼 blob 与回调都在 onstop 里做。
      console.log('🎥 正在收尾原生录像...');
      stopRequestedRef.current = true;   // 标记"是主动停的",供 onstop 区分截断
      recorder.stop();
    }
  }, []);

  const stopCamera = useCallback(() => {
    console.log('🛑 stopCamera 被调用');
    stopCapture();
    // 有录像在收尾时,轨道由 `onstop` 里放(见那里的顺序说明);
    // 这里只处理"根本没在录像"的情形。
    // ⚠️ 判据用 `mediaRecorderRef` 而不是上面那个 `stream` state:卸载清理拿到的
    //    是首次渲染的闭包,那时 `stream` 恒为 null —— 用 state 判会走到"直接放轨道"
    //    那一支,把正在收尾的录像打断。(这也顺带修掉了"卸载时轨道其实没停"。)
    if (!mediaRecorderRef.current) {
      releaseStream();
    }
  }, [stopCapture, releaseStream]);

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

