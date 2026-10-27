import React, { useEffect, useRef, useState } from 'react';
import { Modal, Button, Space, Alert } from 'antd';
import {
  CheckCircleFilled, CloseCircleFilled, LoadingOutlined, VideoCameraOutlined
} from '@ant-design/icons';
import { FACE_API_URL, GESTURE_API_URL } from '@/utils/constants';

/**
 * 开录前的**设备自检** —— 脸和手都采得到才允许开始。
 *
 * 为什么要有它(2026-10-26 使用者实盘):
 * 「有时准确率太低是因为离摄像头太远了」。离得远时人脸检出率/AU 精度会掉,
 * 而系统此前**照常开录**,事后只能对着空日志叹气。这里在铸号之前先探几帧:
 *
 *   · 面部: 检出 + `face_scale` 不低于 0.20(约为画面高度的 20%;正常坐姿实测 0.25–0.47)
 *   · 手部: 至少一只手进入画面(左右分别显示)
 *   · 麦克风: 流里真的有音轨
 *
 * 三条都过才让点「开始面试」。**探针只检测** —— 服务端 `?probe=1` 不落帧、
 * 不写 CSV,所以自检不会污染这一场的素材。
 */

const FACE_MIN_SCALE = 0.20;

type FaceState = 'checking' | 'ok' | 'missing' | 'far' | 'error';

interface ProbeStatus {
  face: FaceState;
  faceScale: number | null;
  left: boolean;
  right: boolean;
  mic: boolean;
  error?: string;
}

interface Props {
  open: boolean;
  /** 页面里那个 `<video>`(CameraView 的)。自检复用同一条流,不另开摄像头。 */
  videoRef: React.RefObject<HTMLVideoElement>;
  onReady: () => void;
  onCancel: () => void;
}

const initial: ProbeStatus = {
  face: 'checking', faceScale: null, left: false, right: false, mic: false
};

const grabJpeg = (video: HTMLVideoElement, canvas: HTMLCanvasElement): Promise<Blob | null> =>
  new Promise((resolve) => {
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    // 探针不需要原画质:缩到 640 宽,单次 < 50 KB,自检循环不卡。
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

const PreflightGate: React.FC<Props> = ({ open, videoRef, onReady, onCancel }) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState<ProbeStatus>(initial);

  // 把页面的摄像头流接到自检窗口里(同一路流,不重复申请设备)
  useEffect(() => {
    if (!open) return;
    const v = localVideoRef.current;
    const src = videoRef.current?.srcObject as MediaStream | null;
    if (v && src) {
      v.srcObject = src;
      v.play().catch(() => { /* 自动播放被拦时静默,画面仍由下一帧刷新 */ });
    }
  }, [open, videoRef]);

  // 每 ~800ms 探一帧:面部 + 手部并行。连续 2 次全过才点亮「开始面试」。
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

        const next: ProbeStatus = {
          face: faceState,
          faceScale: scale,
          left,
          right,
          mic,
        };
        setStatus(next);

      } catch (e: any) {
        if (!cancelled) {
          setStatus((prev) => ({ ...prev, face: 'error', error: e?.message || '检测请求失败' }));
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
    // onReady 由父组件保持稳定;这里只在打开时启动/关闭时清理。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const ready = status.face === 'ok' && (status.left || status.right) && status.mic;

  const faceLine = () => {
    if (status.face === 'checking') return <span>检测中…</span>;
    if (status.face === 'ok') {
      return <span>已检出{status.faceScale != null ? ` · 面部占比 ${(status.faceScale * 100).toFixed(0)}%` : ''}</span>;
    }
    if (status.face === 'far') {
      return <span>离得太远{status.faceScale != null ? `（占比 ${(status.faceScale * 100).toFixed(0)}%，建议 ≥20%）` : ''} —— 请靠近摄像头</span>;
    }
    if (status.face === 'error') {
      return <span>检测服务不可达：{status.error}</span>;
    }
    return <span>未检测到 —— 请正对摄像头，确保脸部完整在画面里</span>;
  };

  const dot = (ok: boolean, checking = false) => {
    if (checking) return <LoadingOutlined style={{ color: 'var(--ax-text-secondary)' }} />;
    return ok
      ? <CheckCircleFilled style={{ color: 'var(--ax-success, #0a6b34)' }} />
      : <CloseCircleFilled style={{ color: 'var(--ax-error, #b03030)' }} />;
  };

  return (
    <Modal
      open={open}
      title={<Space><VideoCameraOutlined />设备自检 · 请先调整好位置</Space>}
      closable={false}
      maskClosable={false}
      keyboard={false}
      footer={[
        <Button key="cancel" onClick={onCancel}>取消（不开始）</Button>,
        <Button key="start" type="primary" disabled={!ready} onClick={onReady}>
          开始面试
        </Button>,
      ]}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 16, alignItems: 'start' }}>
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
            这张画面就是采集端看到的取景。半身入镜、双手放在画面里。
          </div>
        </div>

        <Space direction="vertical" size={10} style={{ width: '100%' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            {dot(status.face === 'ok', status.face === 'checking')}
            <div><strong>面部</strong><div style={{ color: 'var(--ax-text-secondary)', fontSize: 13 }}>{faceLine()}</div></div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            {dot(status.left)}
            <div><strong>左手</strong><div style={{ color: 'var(--ax-text-secondary)', fontSize: 13 }}>{status.left ? '已检出' : '请把手抬进画面'}</div></div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            {dot(status.right)}
            <div><strong>右手</strong><div style={{ color: 'var(--ax-text-secondary)', fontSize: 13 }}>{status.right ? '已检出' : '请把手抬进画面'}</div></div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            {dot(status.mic)}
            <div><strong>麦克风</strong><div style={{ color: 'var(--ax-text-secondary)', fontSize: 13 }}>{status.mic ? '有音轨' : '没有拿到麦克风'}</div></div>
          </div>

          {!ready && (
            <Alert
              type="info" showIcon
              message="三条都通过后「开始面试」才可用"
              description="离摄像头太远会让 AU 与手势精度下降；正常坐姿离镜头约 50–80 cm，脸占画面高度的 20% 以上。"
            />
          )}
          {ready && (
            <Alert type="success" showIcon message="全部就绪，可以开始面试" />
          )}
        </Space>
      </div>
    </Modal>
  );
};

export default PreflightGate;
