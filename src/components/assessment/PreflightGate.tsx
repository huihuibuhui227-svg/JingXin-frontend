import React, { useEffect, useRef, useState } from 'react';
import { Modal, Button, Space, Alert, Progress } from 'antd';
import {
  CheckCircleFilled, CloseCircleFilled, LoadingOutlined, VideoCameraOutlined
} from '@ant-design/icons';
import { FACE_API_URL, GESTURE_API_URL } from '@/utils/constants';

/**
 * 开录前的设备自检（面部 + 手部 + 麦克风实时音量条 + 连续 2 帧防抖）。
 * 探针带 `?probe=1`，后端不落帧、不写 CSV，不污染本场素材。
 */

const FACE_MIN_SCALE = 0.20;
const REQUIRED_PASS_STREAK = 2;

type FaceState = 'checking' | 'ok' | 'missing' | 'far' | 'error';

interface ProbeStatus {
  face: FaceState;
  faceScale: number | null;
  left: boolean;
  right: boolean;
  mic: boolean;
  passStreak: number;
  error?: string;
}

interface Props {
  open: boolean;
  videoRef: React.RefObject<HTMLVideoElement>;
  actionLabel?: string;
  onReady: () => void;
  onCancel: () => void;
}

const initial: ProbeStatus = {
  face: 'checking', faceScale: null, left: false, right: false, mic: false, passStreak: 0,
};

const grabJpeg = (video: HTMLVideoElement, canvas: HTMLCanvasElement): Promise<Blob | null> =>
  new Promise((resolve) => {
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    const scale = Math.min(1, 640 / w);
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) { resolve(null); return; }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.85);
  });

const postProbe = async (url: string, blob: Blob) => {
  const fd = new FormData();
  fd.append('file', blob, 'frame.jpg');
  const r = await fetch(url, { method: 'POST', body: fd });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body?.detail || `服务返回 ${r.status}`);
  return body;
};

const PreflightGate: React.FC<Props> = ({
  open,
  videoRef,
  actionLabel = '开始采集',
  onReady,
  onCancel,
}) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState<ProbeStatus>(initial);
  const [micLevel, setMicLevel] = useState(0);

  // 把摄像头流接到弹窗预览，同时挂载 Web Audio Analyser 读取真实麦克风音量条
  useEffect(() => {
    if (!open) return;
    const v = localVideoRef.current;
    const src = videoRef.current?.srcObject as MediaStream | null;
    if (v && src) {
      v.srcObject = src;
      v.play().catch(() => { /* 自动播放策略拦截时由下一帧刷新 */ });
    }

    let audioCtx: AudioContext | null = null;
    let rafId = 0;
    if (src && src.getAudioTracks().length > 0 && typeof AudioContext !== 'undefined') {
      try {
        audioCtx = new AudioContext();
        const source = audioCtx.createMediaStreamSource(src);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        const buf = new Uint8Array(analyser.frequencyBinCount);
        const pump = () => {
          analyser.getByteTimeDomainData(buf);
          let sumSq = 0;
          for (let i = 0; i < buf.length; i += 1) {
            const norm = (buf[i] - 128) / 128;
            sumSq += norm * norm;
          }
          const rms = Math.sqrt(sumSq / buf.length);
          setMicLevel(Math.min(100, Math.round(rms * 280)));
          rafId = requestAnimationFrame(pump);
        };
        rafId = requestAnimationFrame(pump);
      } catch {
        setMicLevel(0);
      }
    }

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (audioCtx) void audioCtx.close().catch(() => {});
      setMicLevel(0);
    };
  }, [open, videoRef]);

  // 每 800ms 探一帧，连续 2 帧全部通过才解锁开始按钮（防单帧误判）
  useEffect(() => {
    if (!open) return;
    if (!canvasRef.current) canvasRef.current = document.createElement('canvas');
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let busy = false;

    const tick = async () => {
      if (cancelled || busy) return;
      const v = videoRef.current;
      const canvas = canvasRef.current;
      if (!v || !canvas || v.readyState < 2 || !v.videoWidth) {
        timer = setTimeout(tick, 500);
        return;
      }
      busy = true;
      try {
        const blob = await grabJpeg(v, canvas);
        if (!blob) throw new Error('抓帧失败');
        const [face, gest] = await Promise.all([
          postProbe(`${FACE_API_URL}/analyze?probe=1`, blob),
          postProbe(`${GESTURE_API_URL}/analyze?probe=1`, blob),
        ]);
        if (cancelled) return;

        const scale = face?.result?.face_scale ?? null;
        let faceState: FaceState;
        if (face?.status === 'success') {
          faceState = scale !== null && scale < FACE_MIN_SCALE ? 'far' : 'ok';
        } else {
          faceState = 'missing';
        }
        const left = gest?.result?.hand?.left?.is_valid === true;
        const right = gest?.result?.hand?.right?.is_valid === true;
        const stream = v.srcObject as MediaStream | null;
        const mic = !!stream?.getAudioTracks().some((t) => t.readyState === 'live');
        const framePass = faceState === 'ok' && (left || right) && mic;

        setStatus((prev) => ({
          face: faceState,
          faceScale: scale,
          left,
          right,
          mic,
          passStreak: framePass ? Math.min(REQUIRED_PASS_STREAK, prev.passStreak + 1) : 0,
        }));
      } catch (e: any) {
        if (!cancelled) {
          setStatus((prev) => ({
            ...prev,
            face: 'error',
            passStreak: 0,
            error: e?.message || '检测请求失败',
          }));
        }
      } finally {
        busy = false;
        if (!cancelled) timer = setTimeout(tick, 800);
      }
    };

    setStatus(initial);
    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const ready = status.passStreak >= REQUIRED_PASS_STREAK;

  const faceLine = () => {
    if (status.face === 'checking') return <span>检测中…</span>;
    if (status.face === 'ok') {
      return <span>已检出{status.faceScale != null ? ` · 面部占比 ${(status.faceScale * 100).toFixed(0)}%` : ''}</span>;
    }
    if (status.face === 'far') {
      return <span>距离偏远{status.faceScale != null ? `（占比 ${(status.faceScale * 100).toFixed(0)}%，建议 ≥20%）` : ''} —— 请靠近摄像头</span>;
    }
    if (status.face === 'error') {
      return <span>检测服务不可达：{status.error}</span>;
    }
    return <span>未检测到 —— 请正对摄像头，确保脸部完整在画面内</span>;
  };

  const dot = (ok: boolean, checking = false) => {
    if (checking) return <LoadingOutlined style={{ color: 'var(--ax-text-secondary)' }} />;
    return ok
      ? <CheckCircleFilled style={{ color: 'var(--ax-success)' }} />
      : <CloseCircleFilled style={{ color: 'var(--ax-error)' }} />;
  };

  return (
    <Modal
      open={open}
      width={720}
      title={<Space><VideoCameraOutlined />开录前设备自检 · 请先确认取景与收音</Space>}
      closable={false}
      maskClosable={false}
      keyboard={false}
      footer={[
        <Button key="cancel" onClick={onCancel}>取消（不开始）</Button>,
        <Button key="start" type="primary" disabled={!ready} onClick={onReady}>
          {actionLabel}
        </Button>,
      ]}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 18, alignItems: 'start' }}>
        <div>
          <video
            ref={localVideoRef}
            muted
            playsInline
            style={{
              width: '100%', aspectRatio: '4 / 3', background: '#000',
              borderRadius: 12, objectFit: 'cover', transform: 'scaleX(-1)'
            }}
          />
          <div style={{ fontSize: 12, color: 'var(--ax-text-secondary)', marginTop: 6 }}>
            实时画面即为仪器端所见取景。请保持上半身居中、至少一只手进入画面。
          </div>
        </div>

        <Space direction="vertical" size={10} style={{ width: '100%' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            {dot(status.face === 'ok', status.face === 'checking')}
            <div><strong>面部取景</strong><div style={{ color: 'var(--ax-text-secondary)', fontSize: 13 }}>{faceLine()}</div></div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            {dot(status.left)}
            <div><strong>左手检出</strong><div style={{ color: 'var(--ax-text-secondary)', fontSize: 13 }}>{status.left ? '已检出' : '请把手抬进取景范围'}</div></div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            {dot(status.right)}
            <div><strong>右手检出</strong><div style={{ color: 'var(--ax-text-secondary)', fontSize: 13 }}>{status.right ? '已检出' : '请把手抬进取景范围'}</div></div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            {dot(status.mic)}
            <div style={{ flex: 1 }}>
              <strong>麦克风音轨</strong>
              <div style={{ color: 'var(--ax-text-secondary)', fontSize: 13 }}>
                {status.mic ? '音轨在线（请试说一句话核对电平）' : '未获取到麦克风音轨'}
              </div>
              {status.mic && (
                <Progress
                  percent={micLevel}
                  showInfo={false}
                  size="small"
                  strokeColor="var(--ax-primary)"
                  style={{ marginTop: 4 }}
                />
              )}
            </div>
          </div>

          {!ready && (
            <Alert
              type="info" showIcon
              message={`需连续 ${REQUIRED_PASS_STREAK} 帧全项通过才解锁（当前 ${status.passStreak}/${REQUIRED_PASS_STREAK}）`}
              description="距离镜头约 50–80 cm、面部占画面高度 ≥ 20%，可显著提升动作单元与视线采集质量。"
            />
          )}
          {ready && (
            <Alert type="success" showIcon message={`连续 ${REQUIRED_PASS_STREAK} 帧自检通过，可以${actionLabel}`} />
          )}
        </Space>
      </div>
    </Modal>
  );
};

export default PreflightGate;
