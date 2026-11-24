import React, { useCallback, useEffect, useState } from 'react';
import { Button, Row, Col, Space, Tag } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { dashboardApi, SystemHealthResponse } from '@/services/api';
import { recordingsApi } from '@/services/recordingsApi';

const fmtBytes = (n: number): string => {
  if (!n) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
};

const REPORT_FILE_RE = /(?:HengCai_Evidence_Report|Research_Assessment_Report).*\.html$/i;

const SERVICE_META: Array<{ key: string; label: string; port: string }> = [
  { key: 'panel', label: '总控与报告', port: ':5000' },
  { key: 'face', label: '面部仪器', port: ':8000' },
  { key: 'voice', label: '语音与转写', port: ':8001' },
  { key: 'gesture', label: '上肢体态仪器', port: ':8002' },
];

const ARCH_LAYERS = [
  {
    step: '01 · 仪器采集',
    title: '多模态真 3D 视觉与声学提取',
    desc: '同步采集面部 478 点三维姿态与 52 项面部动作系数、RTMW 上肢双手骨骼、Praat 声学与神经 VAD 语音转写。',
  },
  {
    step: '02 · 特征校准与动力学',
    title: '姿态去偏与时序动力学建模',
    desc: '融合平滑滤波与头部姿态残差校准，计算 41 项行为指标、SPARC 上肢平滑度及 pycatch22 时序动力学特征。',
  },
  {
    step: '03 · 可解释模型裁判',
    title: '不打分阶段切分与不确定性核验',
    desc: '基于隐马尔可夫模型与变点检测划分连续行为阶段，并以保形预测核验三档证据支持度、生成白盒特征归因，绝不给出总分或主观品格推断。',
  },
];

const WORKSPACE_LINKS = [
  { to: '/interview', title: '面试行为采集', desc: '按题库顺序作答，同步记录画面、语音与答题时间窗' },
  { to: '/research', title: '科研行为采集', desc: '面向科研汇报与课题问答场景的多模态行为记录' },
  { to: '/analysis', title: '实时监测台', desc: '实时查看三路服务状态、画面帧率、麦克风音量与信号曲线' },
  { to: '/reports', title: '报告中心', desc: '查看各场次行为证据报告，支持在线明细核对与单文件下载' },
  { to: '/recordings', title: '录制素材库', desc: '按场次管理原始录像、逐帧画面抽查与回收站恢复' },
  { to: '/export', title: '数据导出与原表', desc: '导出面部、手势、语音三份原始 CSV 台账、转写文本与趋势图' },
  { to: '/question-bank', title: '题库管理', desc: '管理多套面试与科研题库，支持导入导出与关键词快速检索' },
];

const Home: React.FC = () => {
  const navigate = useNavigate();

  const [health, setHealth] = useState<SystemHealthResponse | null>(null);
  const [reportCount, setReportCount] = useState<number | null>(null);
  const [recStats, setRecStats] = useState<{ n: number; bytes: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadErrors, setLoadErrors] = useState<string[]>([]);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    const errs: string[] = [];

    const [healthRes, reportsRes, recsRes] = await Promise.allSettled([
      dashboardApi.getSystemHealth(),
      dashboardApi.getFiles('reports'),
      recordingsApi.list(),
    ]);

    if (healthRes.status === 'fulfilled') {
      setHealth(healthRes.value);
    } else {
      setHealth(null);
      errs.push('服务健康检查不可达');
    }

    if (reportsRes.status === 'fulfilled' && Array.isArray(reportsRes.value)) {
      setReportCount(
        reportsRes.value.filter((f: { name?: string }) => REPORT_FILE_RE.test(f?.name || '')).length
      );
    } else {
      setReportCount(null);
      errs.push('报告目录未读到');
    }

    if (recsRes.status === 'fulfilled') {
      setRecStats({
        n: recsRes.value.recordings.length,
        bytes: recsRes.value.total_video_bytes,
      });
    } else {
      setRecStats(null);
      errs.push('录制素材目录未读到');
    }

    setLoadErrors(errs);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  return (
    <main>
      {/* ══ Tile 1 · 浅色 Hero ═══════════════════════════════════════════════ */}
      <section className="ax-tile ax-tile--light">
        <div className="ax-tile__inner" style={{ textAlign: 'center' }}>
          <div
            style={{
              display: 'inline-block',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--ax-primary)',
              background: 'var(--ax-info-soft)',
              border: '1px solid var(--ax-info-border)',
              borderRadius: 'var(--ax-rounded-pill)',
              padding: '4px 14px',
              marginBottom: 18,
            }}
          >
            衡才智析 · 多模态行为证据披露系统
          </div>

          <h1
            className="ax-display-lg"
            style={{ margin: '0 auto', maxWidth: 820, color: 'var(--ax-ink)' }}
          >
            不给分，只给证据与缺口
          </h1>

          <p
            className="ax-lead"
            style={{
              margin: '18px auto 0',
              maxWidth: 780,
              color: 'var(--ax-text-secondary)',
              fontSize: 21,
              lineHeight: 1.5,
            }}
          >
            仪器负责真实物理采样，模型负责可解释时序分段与证据门控 —— 不计算任何个人得分，逐项披露实测读数、样本覆盖与证据缺口。
          </p>

          <Space size={14} style={{ marginTop: 32 }} wrap>
            <Button
              type="primary"
              className="ax-btn--pill"
              size="large"
              onClick={() => navigate('/interview')}
            >
              开始面试采集
            </Button>
            <Button
              className="ax-btn--pill ax-btn--ghost"
              size="large"
              onClick={() => navigate('/report/latest')}
            >
              查看最新证据报告
            </Button>
            <Button
              className="ax-btn--pill"
              size="large"
              onClick={() => navigate('/analysis')}
            >
              进入实时监测台
            </Button>
          </Space>
        </div>
      </section>

      {/* ══ Tile 2 · 深色 —— 实时服务就绪状态与盘上实况 ═══════════════════════ */}
      <section className="ax-tile ax-tile--dark">
        <div className="ax-tile__inner">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
              marginBottom: 24,
            }}
          >
            <div>
              <h2
                className="ax-display-md"
                style={{ fontSize: 24, margin: 0, color: 'var(--ax-on-dark)' }}
              >
                实时系统就绪状态与盘上实况
              </h2>
              <p
                style={{
                  margin: '6px 0 0',
                  color: 'var(--ax-body-muted)',
                  fontSize: 'var(--ax-caption-size)',
                }}
              >
                实时检测四路本地服务与磁盘存档状态
              </p>
            </div>
            <Button
              size="small"
              icon={<ReloadOutlined />}
              loading={loading}
              onClick={() => void loadOverview()}
              style={{
                background: 'transparent',
                color: '#ffffff',
                borderColor: 'rgba(255,255,255,0.35)',
              }}
            >
              刷新状态
            </Button>
          </div>

          {loadErrors.length > 0 && (
            <div
              role="alert"
              style={{
                marginBottom: 20,
                padding: '10px 14px',
                borderRadius: 'var(--ax-rounded-sm)',
                background: 'rgba(255, 120, 117, 0.14)',
                border: '1px solid rgba(255, 159, 159, 0.45)',
                color: '#ffd6d6',
                fontSize: 13,
              }}
            >
              部分状态未读到：{loadErrors.join('；')}（请确认本地后端服务已启动）。
            </div>
          )}

          {/* 四路服务实时状态灯 */}
          <Row gutter={[14, 14]} style={{ marginBottom: 24 }}>
            {SERVICE_META.map((svc) => {
              const st = health?.services?.[svc.key];
              const ok = st?.ok === true;
              const statusText = loading
                ? '检测中…'
                : !st
                  ? '离线 / 不可达'
                  : ok
                    ? `就绪 · ${st.latency_ms} ms`
                    : st.status === 'degraded'
                      ? '降级（ASR 未就绪）'
                      : '离线';
              const dotColor = loading ? '#999999' : ok ? '#4cd964' : st?.status === 'degraded' ? '#ffd60a' : '#ff6961';
              return (
                <Col xs={12} md={6} key={svc.key}>
                  <div
                    style={{
                      background: 'var(--ax-tile-3)',
                      border: '1px solid rgba(255,255,255,0.16)',
                      borderRadius: 'var(--ax-rounded-md)',
                      padding: '14px 16px',
                      height: '100%',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#ffffff' }}>
                        {svc.label}
                      </span>
                      <span
                        aria-hidden="true"
                        style={{
                          width: 9,
                          height: 9,
                          borderRadius: '50%',
                          background: dotColor,
                          display: 'inline-block',
                          flexShrink: 0,
                        }}
                      />
                    </div>
                    <div style={{ marginTop: 6, fontSize: 12, color: 'var(--ax-body-muted)' }}>
                      {statusText}
                    </div>
                    <div
                      style={{
                        marginTop: 4,
                        fontSize: 11,
                        fontFamily: 'var(--ax-font-mono)',
                        color: 'rgba(255,255,255,0.65)',
                      }}
                    >
                      {svc.port}
                      {svc.key === 'voice' && st?.asr_reachable !== undefined
                        ? ` · FunASR ${st.asr_reachable ? '在线' : '离线'}`
                        : ''}
                    </div>
                  </div>
                </Col>
              );
            })}
          </Row>

          {/* 两张真实盘上统计卡片 */}
          <Row gutter={[20, 20]}>
            <Col xs={24} md={12}>
              <button
                type="button"
                className="ax-press"
                onClick={() => navigate('/reports')}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: 'var(--ax-tile-3)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  borderRadius: 'var(--ax-rounded-lg)',
                  padding: 'var(--ax-space-lg)',
                  cursor: 'pointer',
                  color: 'var(--ax-on-dark)',
                  fontFamily: 'var(--ax-font-text)',
                }}
              >
                <div style={{ fontSize: 'var(--ax-caption-size)', color: 'var(--ax-body-muted)' }}>
                  盘上行为证据报告
                </div>
                <div className="ax-display-lg" style={{ marginTop: 8, fontSize: 38, color: '#ffffff' }}>
                  {reportCount === null ? (loading ? '…' : '未读到') : reportCount}
                  {reportCount !== null && (
                    <span style={{ fontSize: 16, fontWeight: 400, marginLeft: 8, color: 'var(--ax-body-muted)' }}>
                      份
                    </span>
                  )}
                </div>
                <div style={{ marginTop: 10, fontSize: 13, color: 'var(--ax-primary-on-dark)' }}>
                  {reportCount === null
                    ? loading
                      ? '正在读取报告目录…'
                      : '点击前往报告中心重试 ›'
                    : '进入报告中心查看与离线下载 ›'}
                </div>
              </button>
            </Col>

            <Col xs={24} md={12}>
              <button
                type="button"
                className="ax-press"
                onClick={() => navigate('/recordings')}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: 'var(--ax-tile-3)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  borderRadius: 'var(--ax-rounded-lg)',
                  padding: 'var(--ax-space-lg)',
                  cursor: 'pointer',
                  color: 'var(--ax-on-dark)',
                  fontFamily: 'var(--ax-font-text)',
                }}
              >
                <div style={{ fontSize: 'var(--ax-caption-size)', color: 'var(--ax-body-muted)' }}>
                  本地录制素材库
                </div>
                <div className="ax-display-lg" style={{ marginTop: 8, fontSize: 38, color: '#ffffff' }}>
                  {recStats === null ? (loading ? '…' : '未读到') : recStats.n}
                  {recStats !== null && (
                    <span style={{ fontSize: 16, fontWeight: 400, marginLeft: 8, color: 'var(--ax-body-muted)' }}>
                      场
                    </span>
                  )}
                </div>
                <div style={{ marginTop: 10, fontSize: 13, color: 'var(--ax-primary-on-dark)' }}>
                  {recStats
                    ? `原生音视频合计 ${fmtBytes(recStats.bytes)} · 浏览回放与留存管理 ›`
                    : loading
                      ? '正在读取素材库…'
                      : '点击前往录制素材页重试 ›'}
                </div>
              </button>
            </Col>
          </Row>
        </div>
      </section>

      {/* ══ Tile 3 · 米灰 —— 三层白盒架构与全部工作台入口 ═════════════════════ */}
      <section className="ax-tile ax-tile--parchment">
        <div className="ax-tile__inner">
          <div style={{ marginBottom: 24 }}>
            <h2
              className="ax-display-md"
              style={{ fontSize: 26, margin: 0, color: 'var(--ax-ink)' }}
            >
              三层透明测量架构
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--ax-text-secondary)' }}>
              每一项读数都可从原始录制帧/音频追溯至计算公式、参数分级与仪器来源，不做情绪或临床诊断。
            </p>
          </div>

          <Row gutter={[20, 20]} style={{ marginBottom: 40 }}>
            {ARCH_LAYERS.map((layer) => (
              <Col xs={24} md={8} key={layer.step}>
                <div
                  style={{
                    background: 'var(--ax-canvas)',
                    border: '1px solid var(--ax-hairline)',
                    borderRadius: 'var(--ax-rounded-lg)',
                    padding: '22px',
                    height: '100%',
                  }}
                >
                  <Tag
                    style={{
                      marginBottom: 10,
                      color: 'var(--ax-primary)',
                      background: 'var(--ax-info-soft)',
                      borderColor: 'var(--ax-info-border)',
                      fontWeight: 600,
                    }}
                  >
                    {layer.step}
                  </Tag>
                  <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 600, color: 'var(--ax-ink)' }}>
                    {layer.title}
                  </h3>
                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: 'var(--ax-text-secondary)' }}>
                    {layer.desc}
                  </p>
                </div>
              </Col>
            ))}
          </Row>

          <div style={{ marginBottom: 18 }}>
            <h2
              className="ax-display-md"
              style={{ fontSize: 22, margin: 0, color: 'var(--ax-ink)' }}
            >
              全功能工作台入口
            </h2>
          </div>

          <Row gutter={[16, 16]}>
            {WORKSPACE_LINKS.map((item) => (
              <Col xs={24} sm={12} md={8} key={item.to}>
                <button
                  type="button"
                  className="ax-press"
                  onClick={() => navigate(item.to)}
                  style={{
                    width: '100%',
                    height: '100%',
                    textAlign: 'left',
                    background: 'var(--ax-canvas)',
                    border: '1px solid var(--ax-hairline)',
                    borderRadius: 'var(--ax-rounded-md)',
                    padding: '16px 18px',
                    cursor: 'pointer',
                    fontFamily: 'var(--ax-font-text)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ax-ink)' }}>
                      {item.title}
                    </div>
                    <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.55, color: 'var(--ax-text-secondary)' }}>
                      {item.desc}
                    </div>
                  </div>
                  <div style={{ marginTop: 12, fontSize: 13, fontWeight: 600, color: 'var(--ax-primary)' }}>
                    进入 ›
                  </div>
                </button>
              </Col>
            ))}
          </Row>
        </div>
      </section>
    </main>
  );
};

export default Home;
