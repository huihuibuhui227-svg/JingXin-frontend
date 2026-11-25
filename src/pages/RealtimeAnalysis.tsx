import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Layout, Row, Col, Card, Alert, Button, Tag, Space, Progress, message } from 'antd';
import { ReloadOutlined, VideoCameraOutlined, InteractionOutlined, AudioOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useCamera } from '@/hooks/useCamera';
import { useSessionRecording } from '@/hooks/useSessionRecording';
import { dashboardApi, faceApi, gestureApi, voiceApi, getSessionId, SystemHealthResponse } from '@/services/api';
import { useAssessmentStore } from '@/store/assessmentStore';
import CameraView from '@/components/assessment/CameraView';
import PreflightGate from '@/components/assessment/PreflightGate';
import {
  AbandonConfirmModal, ConsentModal, DegradedBanner, LabelErrorBanner, LabelModal,
  SaveGateModal, StopConfirmModal,
} from '@/components/recording/RecordingDialogs';
import type { ConsentMode } from '@/components/recording/RecordingDialogs';
import DevicePicker, { useDeviceSelection } from '@/components/recording/DevicePicker';
import { createAnalysisHealth } from '@/utils/analysisHealth';

const { Content } = Layout;

const SEND_EVERY_NTH_FRAME = 5;

interface TelemetryPoint {
  time: string;
  faceOk: number;
  au12: number;
  au4: number;
  jitter: number | null;
}

/** 轻量原生 SVG 实时信号折线图（替代 1.15 MB Plotly，零额外依赖）。 */
const SignalSparkline: React.FC<{
  points: TelemetryPoint[];
  accessor: (p: TelemetryPoint) => number | null;
  color: string;
  title: string;
  unit?: string;
  maxY?: number;
}> = ({ points, accessor, color, title, unit = '', maxY = 1 }) => {
  const valid = points
    .map((p, idx) => ({ idx, val: accessor(p), time: p.time }))
    .filter((d): d is { idx: number; val: number; time: string } => d.val !== null && Number.isFinite(d.val));
  const latest = valid.length ? valid[valid.length - 1].val : null;
  const W = 420;
  const H = 120;
  const pad = 16;
  const topVal = Math.max(maxY, ...valid.map((d) => d.val), 0.1);
  const pathD = valid
    .map((d, i) => {
      const x = points.length <= 1 ? pad : pad + (d.idx / (points.length - 1)) * (W - pad * 2);
      const y = H - pad - (Math.max(0, d.val) / topVal) * (H - pad * 2);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <div
      style={{
        padding: '14px 16px',
        background: 'var(--ax-parchment)',
        borderRadius: 'var(--ax-rounded-md)',
        border: '1px solid var(--ax-divider-soft)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ax-ink)' }}>{title}</span>
        <span style={{ fontSize: 16, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color }}>
          {latest === null ? '—' : `${latest.toFixed(3)}${unit}`}
        </span>
      </div>
      {valid.length >= 2 ? (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 110, display: 'block' }} role="img" aria-label={title}>
          <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="#d4d4d8" strokeWidth="1" />
          <line x1={pad} y1={pad} x2={W - pad} y2={pad} stroke="#e5e5ea" strokeDasharray="3 3" strokeWidth="1" />
          <path d={pathD} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      ) : (
        <div
          style={{
            position: 'relative',
            height: 110,
            borderRadius: 'var(--ax-rounded-xs)',
            overflow: 'hidden',
          }}
        >
          <svg
            viewBox={`0 0 ${W} ${H}`}
            aria-hidden="true"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
          >
            {[0.25, 0.5, 0.75].map((ratio) => {
              const x = pad + ratio * (W - pad * 2);
              return (
                <line
                  key={`vx-${ratio}`}
                  x1={x}
                  y1={pad}
                  x2={x}
                  y2={H - pad}
                  stroke="#e5e7eb"
                  strokeDasharray="3 3"
                  strokeWidth="1"
                />
              );
            })}
            {[pad, H / 2].map((y, idx) => (
              <line
                key={`hy-${idx}`}
                x1={pad}
                y1={y}
                x2={W - pad}
                y2={y}
                stroke="#e5e7eb"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
            ))}
            <line x1={pad} y1={pad} x2={pad} y2={H - pad} stroke="#d4d4d8" strokeWidth="1" />
            <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="#d4d4d8" strokeWidth="1" />
          </svg>
          <div
            style={{
              position: 'relative',
              zIndex: 1,
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 12px',
              textAlign: 'center',
              fontSize: 12.5,
              color: 'var(--ax-text-secondary)',
            }}
          >
            <span
              style={{
                background: 'rgba(245, 245, 247, 0.92)',
                padding: '4px 10px',
                borderRadius: 'var(--ax-rounded-xs)',
              }}
            >
              开始录制后将实时绘制采样曲线（至少需 2 个采样点）
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

const RealtimeAnalysis: React.FC = () => {
  const navigate = useNavigate();
  const frameCountRef = useRef(0);
  const sentStatsRef = useRef({ sent: 0, faceHit: 0, gestHit: 0, startTs: 0 });
  const [isRecording, setIsRecording] = useState(false);
  const [telemetry, setTelemetry] = useState<TelemetryPoint[]>([]);
  const [captureStats, setCaptureStats] = useState({ sent: 0, faceHit: 0, gestHit: 0, fps: 0, lastFaceStatus: 'idle' as string });
  const [micLevel, setMicLevel] = useState(0);
  const [sid, setSid] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [confirmStopOpen, setConfirmStopOpen] = useState(false);
  const [consent, setConsent] = useState<ConsentMode | null>(null);
  const [health, setHealth] = useState<SystemHealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const { selection: devices, update: setDevices } = useDeviceSelection();

  const refreshHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      setHealth(await dashboardApi.getSystemHealth());
    } catch {
      setHealth(null);
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshHealth();
  }, [refreshHealth]);

  const onBeforeRecordRef = useRef<((mode: ConsentMode) => Promise<boolean>) | null>(null);
  const recording = useSessionRecording({
    onBeforeRecord: (mode) => onBeforeRecordRef.current?.(mode) ?? true,
    onPrepareSession: async () => {
      setSessionError(null);
      try {
        await voiceApi.interview.start();
        const id = getSessionId();
        if (!id) throw new Error('未能生成采录编号');
        setSid(id);
        return true;
      } catch (error: any) {
        const why = error?.response?.data?.detail || error?.message || '未知错误';
        setSessionError(why);
        message.error(`未能生成采录编号（未开始录制）：${why}`, 0);
        return false;
      }
    },
    onRecordStart: (mode) => {
      setConsent(mode);
      void beginRecording();
    },
  });

  const { realtimeMetrics, updateRealtimeMetrics } = useAssessmentStore();
  const { videoRef, canvasRef, startCamera, stopCamera, startCapture, stopCapture } = useCamera({
    audioOnly: consent === 'audio_only',
    videoDeviceId: devices.videoDeviceId,
    audioDeviceId: devices.audioDeviceId,
    onFrame: async (frame) => {
      frameCountRef.current += 1;
      if (frameCountRef.current % SEND_EVERY_NTH_FRAME !== 0) return;

      const now = Date.now();
      if (!sentStatsRef.current.startTs) sentStatsRef.current.startTs = now;
      sentStatsRef.current.sent += 1;
      const elapsedSec = Math.max(0.5, (now - sentStatsRef.current.startTs) / 1000);

      let faceOk = 0;
      let au12 = 0;
      let au4 = 0;
      let jitterVal: number | null = null;
      let lastFaceStatus = 'no_face';

      await Promise.allSettled([
        faceApi.analyzeImage(frame).then((result) => {
          analysisHealthRef.current.ok();
          lastFaceStatus = result.status || 'unknown';
          if (result.status === 'success' && result.result) {
            faceOk = 1;
            sentStatsRef.current.faceHit += 1;
            au12 = Number(result.result.au_features?.au12_smile ?? 0);
            au4 = Number(result.result.au_features?.au4_frown ?? 0);
            updateRealtimeMetrics({
              face: {
                detected: true,
                face_scale: result.result.face_scale ?? null,
                au_features: {
                  au_1: result.result.au_features?.au1_inner_brow_raise,
                  au_4: au4,
                  au_6: result.result.au_features?.au6_cheek_raise,
                  au_12: au12,
                },
                head_yaw: result.result.au_features?.head_yaw,
                head_pitch: result.result.au_features?.head_pitch,
                avg_ear: result.result.au_features?.avg_ear,
                blink_rate_per_min: result.result.au_features?.blink_rate_per_min,
              },
            });
          }
        }).catch(err => {
          console.error('面部视觉通道分析失败:', err);
          lastFaceStatus = 'error';
          analysisHealthRef.current.fail('面部视觉通道');
        }),

        gestureApi.analyzeGesture(frame).then((result) => {
          analysisHealthRef.current.ok();
          if (result.status === 'success' && result.result) {
            const hands = result.result.detected_hands || 0;
            const hand = result.result.hand;
            if (hands > 0 || result.result.shoulder?.is_valid === true) {
              sentStatsRef.current.gestHit += 1;
            }
            if (hands > 0 && hand?.left?.jitter !== undefined) {
              jitterVal = (hand.left.jitter + (hand.right?.jitter || 0)) / 2;
            }
            updateRealtimeMetrics({
              gesture: {
                detected_hands: hands,
                hand_score: hand?.average_score || 0,
                shoulder_score: result.result.shoulder?.shoulder_score || 0,
                left_arm_score: result.result.arm?.left?.arm_score || 0,
                right_arm_score: result.result.arm?.right?.arm_score || 0,
                jitter: jitterVal ?? undefined,
                hand_valid: hands > 0,
                shoulder_valid: result.result.shoulder?.is_valid === true,
              },
            });
          }
        }).catch(err => {
          console.error('上肢体态通道分析失败:', err);
          analysisHealthRef.current.fail('上肢体态通道');
        }),
      ]);

      const d = new Date();
      const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
      setTelemetry((prev) => [...prev, { time: timeStr, faceOk, au12, au4, jitter: jitterVal }].slice(-24));
      setCaptureStats({
        sent: sentStatsRef.current.sent,
        faceHit: sentStatsRef.current.faceHit,
        gestHit: sentStatsRef.current.gestHit,
        fps: Number((sentStatsRef.current.sent / elapsedSec).toFixed(2)),
        lastFaceStatus,
      });
    },
    frameRate: 5,
    onVideoReady: (video) => recording.submitVideo(video),
    onDegraded: recording.addDegraded,
  });

  const analysisHealthRef = useRef(createAnalysisHealth(recording.addDegraded));
  const [preflightOpen, setPreflightOpen] = useState(false);
  const preflightResolveRef = useRef<((ok: boolean) => void) | null>(null);

  onBeforeRecordRef.current = async (mode: ConsentMode) => {
    if (mode === 'audio_only') return true;
    const ok = await startCamera();
    if (!ok) {
      message.error('摄像头/麦克风未能打开，无法进行设备自检', 0);
      return false;
    }
    return new Promise<boolean>((resolve) => {
      preflightResolveRef.current = resolve;
      setPreflightOpen(true);
    });
  };

  const finishPreflight = (ok: boolean) => {
    setPreflightOpen(false);
    preflightResolveRef.current?.(ok);
    preflightResolveRef.current = null;
    if (!ok) stopCamera();
  };

  // 录制期间驱动 Web Audio 实时音量条
  useEffect(() => {
    if (!isRecording) { setMicLevel(0); return; }
    const src = videoRef.current?.srcObject as MediaStream | null;
    if (!src || src.getAudioTracks().length === 0 || typeof AudioContext === 'undefined') return;
    let ctx: AudioContext | null = null;
    let raf = 0;
    try {
      ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(src).connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      const loop = () => {
        analyser.getByteTimeDomainData(buf);
        let sq = 0;
        for (let i = 0; i < buf.length; i += 1) {
          const v = (buf[i] - 128) / 128;
          sq += v * v;
        }
        setMicLevel(Math.min(100, Math.round(Math.sqrt(sq / buf.length) * 280)));
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    } catch {
      setMicLevel(0);
    }
    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (ctx) void ctx.close().catch(() => {});
    };
  }, [isRecording, videoRef]);

  const beginRecording = async () => {
    setIsRecording(true);
    message.success('实时监测与录制已启动');
    const ok = await startCamera();
    if (!ok) {
      setIsRecording(false);
      message.error('摄像头/麦克风未能打开 —— 本场采不到画面与原生视频', 0);
      return;
    }
    setTimeout(() => startCapture(), 450);
  };

  const handleStartRecording = () => {
    if (recording.saveState !== 'idle') {
      message.warning('上一场录像尚未确认留存，请先处理完毕再开下一场', 0);
      return;
    }
    frameCountRef.current = 0;
    sentStatsRef.current = { sent: 0, faceHit: 0, gestHit: 0, startTs: 0 };
    setTelemetry([]);
    setCaptureStats({ sent: 0, faceHit: 0, gestHit: 0, fps: 0, lastFaceStatus: 'idle' });
    recording.reset();
    recording.openLabelModal(true);
  };

  const confirmStopRecording = () => {
    setConfirmStopOpen(false);
    setIsRecording(false);
    stopCapture();
    setTimeout(() => recording.beginChoice(), 300);
    message.info('已停止录制 —— 请确认是否留存本场素材');
  };

  useEffect(() => () => { stopCamera(); stopCapture(); }, []);

  const faceCoveragePct = captureStats.sent > 0 ? Math.round((captureStats.faceHit / captureStats.sent) * 100) : 0;
  const gestCoveragePct = captureStats.sent > 0 ? Math.round((captureStats.gestHit / captureStats.sent) * 100) : 0;

  const faceSvc = health?.services?.face;
  const gestureSvc = health?.services?.gesture;
  const voiceSvc = health?.services?.voice;
  const captureCapabilityBar = health
    ? [
        faceSvc?.landmarker_3d_matrix
          ? `面部 478 网格 · ${faceSvc.blendshapes_count ?? 52} 项动作系数 · 三维姿态`
          : '面部 478 网格',
        gestureSvc?.backend === 'rtmw'
          ? '上肢体态 133 点骨骼'
          : '上肢双手与肩臂姿态',
        voiceSvc?.live_pitch_backend === 'parselmouth'
          ? (voiceSvc.live_vad_backend === 'rms_threshold'
            ? '语音声学基频提取'
            : '语音声学与活动检测')
          : '语音转写与基频提取',
      ].join(' · ')
    : null;

  return (
    <Content className="ax-workbench" style={{ padding: '24px 24px 48px' }}>
      <div style={{ maxWidth: 'var(--ax-workbench-max)', margin: '0 auto' }}>
        <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 'var(--ax-display-md-size)', fontWeight: 600 }}>
              三模态实时监测台
            </h1>
            <div style={{ fontSize: 13, marginTop: 4, color: sid ? 'var(--ax-success)' : 'var(--ax-text-secondary)' }}>
              {sid
                ? `本场采录编号：${sid}`
                : sessionError
                  ? `未能生成采录编号：${sessionError}`
                  : '查看三路采集通道状态、画面帧率、人脸检出率与麦克风实时音量'}
            </div>
            {(recording.savedLabel || sid) && (
              <div style={{ fontSize: 13, marginTop: 4, color: 'var(--ax-primary)' }}>
                {recording.savedLabel ? (
                  <>
                    本场标注：{recording.savedLabel}{' '}
                    <Button type="link" size="small" style={{ paddingInline: 4 }} onClick={() => recording.openLabelModal(false)}>
                      修改标注
                    </Button>
                  </>
                ) : (
                  <>
                    本场未标注{' '}
                    <Button type="link" size="small" style={{ paddingInline: 4 }} onClick={() => recording.openLabelModal(false)}>
                      补充标注
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>

          <Space>
            <Button icon={<ReloadOutlined />} loading={healthLoading} onClick={() => void refreshHealth()}>
              复检仪器状态
            </Button>
            <Button
              type="primary"
              danger={isRecording}
              disabled={!isRecording && recording.saveState !== 'idle'}
              onClick={isRecording ? () => setConfirmStopOpen(true) : handleStartRecording}
            >
              {isRecording
                ? '停止监测录制'
                : recording.saveState === 'saving'
                  ? '正在保存…'
                  : recording.saveState === 'failed'
                    ? '先处理上一场'
                    : '开始监测与录制'}
            </Button>
          </Space>
        </div>

        {/* 三模态后端仪器在线健康灯 */}
        <Card size="small" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
            <Space wrap size={10}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ax-ink)' }}>采录通道健康度：</span>
              {[
                { key: 'face', label: '面部视觉通道', icon: <VideoCameraOutlined /> },
                { key: 'gesture', label: '上肢体态通道', icon: <InteractionOutlined /> },
                { key: 'voice', label: '语音声学通道', icon: <AudioOutlined /> },
              ].map((s) => {
                const st = health?.services?.[s.key];
                const ok = st?.ok === true;
                return (
                  <Tag
                    key={s.key}
                    icon={s.icon}
                    style={{
                      color: ok ? 'var(--ax-success)' : 'var(--ax-error)',
                      background: ok ? 'var(--ax-success-soft)' : 'var(--ax-error-soft)',
                      borderColor: ok ? 'var(--ax-success-border)' : 'var(--ax-error-border)',
                    }}
                  >
                    {s.label} {ok ? `在线 (${st.latency_ms}ms)` : st?.status === 'degraded' ? '语音转写离线' : '离线'}
                  </Tag>
                );
              })}
            </Space>
            {sid && !isRecording && (
              <Button size="small" type="link" onClick={() => navigate(`/report/${sid}`)}>
                前往本场行为证据报告 ›
              </Button>
            )}
          </div>
          {captureCapabilityBar && (
            <div
              style={{
                marginTop: 8,
                paddingTop: 8,
                borderTop: '1px solid var(--ax-divider-soft)',
                fontSize: 12.5,
                color: 'var(--ax-text-secondary)',
                lineHeight: 1.5,
              }}
            >
              当前通道能力：{captureCapabilityBar}
            </div>
          )}
        </Card>

        {sessionError && (
          <Alert
            type="error" showIcon style={{ marginBottom: 16 }}
            message="本场未能生成采录编号，不会纳入正式报告"
            description={sessionError}
          />
        )}
        <LabelErrorBanner error={recording.labelError} />
        {consent === 'audio_only' && (
          <Alert
            type="info" showIcon style={{ marginBottom: 16 }}
            message="本场为仅声音模式 —— 摄像头未打开"
            description="面部与上肢模态将如实记录为未采集。"
          />
        )}
        {isRecording && captureStats.lastFaceStatus === 'no_face' && (
          <Alert
            type="warning" showIcon style={{ marginBottom: 16 }}
            message="最近一帧未检测到人脸"
            description="请调整坐姿或光照条件，确保人脸正对镜头且无遮挡。"
          />
        )}
        <DegradedBanner reasons={recording.degraded} />

        {/* 隐藏自检 video，开录前用于 PreflightGate */}
        {!isRecording && <video ref={videoRef} autoPlay muted playsInline style={{ display: 'none' }} />}

        {isRecording && (
          <Row gutter={[20, 20]} style={{ marginBottom: 20 }}>
            <Col xs={24} lg={14}>
              <CameraView videoRef={videoRef} canvasRef={canvasRef} title="实时采集取景画面" />
            </Col>
            <Col xs={24} lg={10}>
              <Card title="实时采集质量健康度" size="small" style={{ height: '100%' }}>
                <Space direction="vertical" size={14} style={{ width: '100%' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span>面部有效帧覆盖率</span>
                      <strong>{faceCoveragePct}%（{captureStats.faceHit}/{captureStats.sent}）</strong>
                    </div>
                    <Progress percent={faceCoveragePct} showInfo={false} strokeColor={faceCoveragePct >= 70 ? 'var(--ax-success)' : 'var(--ax-warning)'} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span>上肢/体态有效帧覆盖率</span>
                      <strong>{gestCoveragePct}%（{captureStats.gestHit}/{captureStats.sent}）</strong>
                    </div>
                    <Progress percent={gestCoveragePct} showInfo={false} strokeColor="var(--ax-primary)" />
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span>麦克风实时输入电平</span>
                      <strong>{micLevel}%</strong>
                    </div>
                    <Progress percent={micLevel} showInfo={false} strokeColor="var(--ax-success)" />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div style={{ padding: '10px 12px', background: 'var(--ax-parchment)', borderRadius: 8 }}>
                      <div style={{ fontSize: 12, color: 'var(--ax-text-secondary)' }}>实际采样帧率</div>
                      <div style={{ fontSize: 20, fontWeight: 600 }}>{captureStats.fps} FPS</div>
                    </div>
                    <div style={{ padding: '10px 12px', background: 'var(--ax-parchment)', borderRadius: 8 }}>
                      <div style={{ fontSize: 12, color: 'var(--ax-text-secondary)' }}>当前检出手部</div>
                      <div style={{ fontSize: 20, fontWeight: 600 }}>
                        {realtimeMetrics.gesture ? `${realtimeMetrics.gesture.detected_hands} 只` : '—'}
                      </div>
                    </div>
                  </div>
                </Space>
              </Card>
            </Col>
          </Row>
        )}

        {/* 物理传感量实时曲线 */}
        <Card className="ax-card" title="实时信号曲线 · 最近 24 次采样" style={{ marginBottom: 20 }}>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <SignalSparkline
                points={telemetry}
                accessor={(p) => p.au12}
                color="#0066cc"
                title="嘴角上扬幅度"
                maxY={1}
              />
            </Col>
            <Col xs={24} md={8}>
              <SignalSparkline
                points={telemetry}
                accessor={(p) => p.au4}
                color="#0b5d2e"
                title="眉间收缩幅度"
                maxY={1}
              />
            </Col>
            <Col xs={24} md={8}>
              <SignalSparkline
                points={telemetry}
                accessor={(p) => p.jitter}
                color="#7a4a05"
                title="手部动作幅度"
                maxY={0.3}
              />
            </Col>
          </Row>
        </Card>

        {!isRecording && (
          <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
            {[
              {
                key: 'face',
                name: '面部视觉通道',
                icon: <VideoCameraOutlined style={{ color: 'var(--ax-primary)' }} />,
                spec: '478 点三维网格 + 52 项表情系数',
                detail: faceSvc?.landmarker_3d_matrix
                  ? '三维头部姿态校准已启用'
                  : '面部关键点与动作幅度提取',
                svc: faceSvc,
              },
              {
                key: 'gesture',
                name: '上肢体态通道',
                icon: <InteractionOutlined style={{ color: 'var(--ax-primary)' }} />,
                spec: '133 点上肢骨骼 + 双手姿态',
                detail: gestureSvc?.backend === 'rtmw'
                  ? '全身与双手关键点已就绪'
                  : '肩臂与双手稳定性实时提取',
                svc: gestureSvc,
              },
              {
                key: 'voice',
                name: '语音声学通道',
                icon: <AudioOutlined style={{ color: 'var(--ax-primary)' }} />,
                spec: '声学韵律提取 + 语音活动检测 + 转写',
                detail: voiceSvc?.asr_reachable
                  ? '本地离线语音识别引擎在线'
                  : '等待本地语音识别引擎连接',
                svc: voiceSvc,
              },
            ].map((ch) => {
              const ok = ch.svc?.ok === true;
              const degraded = ch.svc?.status === 'degraded';
              const badgeColor = ok
                ? 'var(--ax-success)'
                : degraded
                  ? 'var(--ax-warning)'
                  : 'var(--ax-error)';
              const badgeBg = ok
                ? 'var(--ax-success-soft)'
                : degraded
                  ? 'var(--ax-warning-soft)'
                  : 'var(--ax-error-soft)';
              const badgeBorder = ok
                ? 'var(--ax-success-border)'
                : degraded
                  ? 'var(--ax-warning-border)'
                  : 'var(--ax-error-border)';
              const stateLabel = healthLoading
                ? '检测中'
                : ok
                  ? `在线 · ${ch.svc?.latency_ms ?? 0} ms`
                  : degraded
                    ? '降级'
                    : '离线';
              return (
                <Col xs={24} md={8} key={ch.key}>
                  <Card size="small" className="ax-card" style={{ height: '100%' }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          aria-hidden="true"
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: 'var(--ax-rounded-sm)',
                            background: 'var(--ax-info-soft)',
                            border: '1px solid var(--ax-info-border)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 15,
                          }}
                        >
                          {ch.icon}
                        </span>
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ax-ink)' }}>
                          {ch.name}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: badgeColor,
                          background: badgeBg,
                          border: `1px solid ${badgeBorder}`,
                          borderRadius: 'var(--ax-rounded-pill)',
                          padding: '2px 10px',
                          fontVariantNumeric: 'tabular-nums',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {stateLabel}
                      </span>
                    </div>
                    <div
                      style={{
                        marginTop: 10,
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--ax-ink)',
                      }}
                    >
                      {ch.spec}
                    </div>
                    <div
                      style={{
                        marginTop: 4,
                        fontSize: 12,
                        color: 'var(--ax-text-secondary)',
                      }}
                    >
                      {ch.detail}
                    </div>
                  </Card>
                </Col>
              );
            })}
          </Row>
        )}
      </div>

      <PreflightGate
        open={preflightOpen}
        videoRef={videoRef}
        actionLabel="开始监测录制"
        onReady={() => finishPreflight(true)}
        onCancel={() => finishPreflight(false)}
      />

      <LabelModal
        open={recording.labelModalOpen}
        thenRecord={recording.labelThenRecord}
        fields={recording.labelFields}
        onChange={recording.setLabelFields}
        onOk={recording.submitLabel}
        onCancel={() => recording.setLabelModalOpen(false)}
        saving={recording.savingLabel}
        sid={sid}
        error={recording.labelError}
      />

      <ConsentModal
        open={recording.consentModalOpen}
        onOk={recording.confirmConsent}
        onDecline={recording.declineConsent}
        label={recording.savedLabel}
        saving={recording.savingLabel}
        devicePicker={<DevicePicker value={devices} onChange={setDevices} />}
      />

      <StopConfirmModal
        open={confirmStopOpen}
        onOk={confirmStopRecording}
        onCancel={() => setConfirmStopOpen(false)}
        label={recording.savedLabel}
        sid={sid}
      />

      <SaveGateModal
        saveState={recording.saveState}
        savedInfo={recording.savedInfo}
        saveError={recording.saveError}
        onKeep={recording.chooseKeep}
        onDiscard={recording.chooseDiscard}
        onRetry={recording.retryLast}
        onAbandon={() => recording.setConfirmAbandonOpen(true)}
        onClose={() => recording.reset()}
        extraActions={
          sid ? (
            <Button type="primary" onClick={() => { recording.reset(); navigate(`/report/${sid}`); }}>
              查看本场证据报告
            </Button>
          ) : undefined
        }
      />

      <AbandonConfirmModal
        open={recording.confirmAbandonOpen}
        onOk={recording.abandonUpload}
        onCancel={() => recording.setConfirmAbandonOpen(false)}
        label={recording.savedLabel}
        sid={sid}
      />
    </Content>
  );
};

export default RealtimeAnalysis;
