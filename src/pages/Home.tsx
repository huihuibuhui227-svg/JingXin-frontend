import React, { useCallback, useEffect, useState } from 'react';
import { Button, Row, Col, Space, Tag } from 'antd';
import {
  ReloadOutlined,
  VideoCameraOutlined,
  ExperimentOutlined,
  LineChartOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  DatabaseOutlined,
  BookOutlined,
  BarChartOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  SwapOutlined,
  ApiOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import {
  dashboardApi,
  sceneProfilesApi,
  SceneProfileDescriptor,
  SystemHealthResponse,
} from '@/services/api';
import { recordingsApi } from '@/services/recordingsApi';

const fmtBytes = (n: number): string => {
  if (!n) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
};

const REPORT_FILE_RE = /(?:HengCai_Evidence_Report|Research_Assessment_Report).*\.html$/i;

const FALLBACK_BASES: Array<{
  id: string;
  name: string;
  weight_label: string;
  description: string;
  compliance_banner: string;
  primaryRoute: string;
  primaryText: string;
  secondaryActions: Array<{ to: string; label: string }>;
  icon: React.ReactNode;
}> = [
  {
    id: 'research_interview',
    name: '科研过程分析中心',
    weight_label: '60% 主线',
    description: '面向课题组汇报、复试答辩与科研训练的过程性多模态行为证据中心，支持跨场次纵向对比与保形人工复核闭环。',
    compliance_banner: '复用 41 项 L1 客观指标与白盒证据门，绝不出具总分或划档结论。',
    primaryRoute: '/research',
    primaryText: '科研采录',
    secondaryActions: [
      { to: '/interview', label: '面试采录' },
      { to: '/compare', label: '多场对比' },
    ],
    icon: <ExperimentOutlined />,
  },
  {
    id: 'ai_metacognition',
    name: 'AI 元能力与求职实训中心',
    weight_label: '30% 拓展',
    description: '接入标准 JSON-RPC 2.0 岗位 MCP 桥接服务，将 JD 拆解为可观测行为线索与封停硬技能，联动三阶段 AI 审辨实训。',
    compliance_banner: '仅核查岗位行为证据覆盖与待补录缺口，不出具契合度分数。',
    primaryRoute: '/career-mcp',
    primaryText: '岗位 MCP 中心',
    secondaryActions: [{ to: '/metacognition', label: 'AI 审辨实训' }],
    icon: <RobotOutlined />,
  },
  {
    id: 'longitudinal_followup',
    name: '长周期行为随访中心',
    weight_label: '10% 前瞻预留 · 非医疗',
    description: '以匿名随访编号与个体内首访基线为锚，启用零原始影像原声落盘隐私挡位，跟踪客观节律与三维头姿角速度变化。',
    compliance_banner: '非医疗科研观测 · 严格禁跨人对照与任何身心状态推断。',
    primaryRoute: '/followup',
    primaryText: '匿名随访档案',
    secondaryActions: [{ to: '/followup/capture', label: '匿名无影像采录' }],
    icon: <SafetyCertificateOutlined />,
  },
];

const SERVICE_META: Array<{ key: string; label: string; port: string }> = [
  { key: 'panel', label: '总控与报告', port: ':5000' },
  { key: 'face', label: '面部仪器', port: ':8000' },
  { key: 'voice', label: '语音与转写', port: ':8001' },
  { key: 'gesture', label: '上肢体态仪器', port: ':8002' },
];

const getEngineBadge = (
  key: string,
  st?: SystemHealthResponse['services'][string]
): string | null => {
  if (!st || !st.ok) return null;
  if (key === 'face' && st.landmarker_3d_matrix) {
    return `3D 矩阵 · ${st.blendshapes_count ?? 52} 系数`;
  }
  if (key === 'voice' && st.live_pitch_backend) {
    return st.live_vad_backend === 'rms_threshold'
      ? 'Parselmouth · RMS VAD'
      : 'Parselmouth · Silero VAD';
  }
  if (key === 'gesture' && st.backend === 'rtmw') {
    return 'RTMW 133 点';
  }
  if (key === 'panel') {
    return '证据门 · Qwen2.5-14B';
  }
  return null;
};

const ARCH_LAYERS = [
  {
    step: '01 · 仪器采集',
    title: '多模态真 3D 视觉与声学提取',
    desc: '同步采集面部 478 点三维姿态与 52 项面部动作系数、RTMW 上肢双手骨骼、Praat 声学与神经 VAD 语音转写。',
    spec: '478 点 + 52 系数 + 133 关节',
  },
  {
    step: '02 · 特征校准与动力学',
    title: '姿态去偏与时序动力学建模',
    desc: '融合平滑滤波与头部姿态残差校准，计算 41 项行为指标、SPARC 上肢平滑度及 pycatch22 时序动力学特征。',
    spec: '41 项指标 + pycatch22 + SPARC',
  },
  {
    step: '03 · 可解释模型裁判',
    title: '不打分阶段切分与不确定性核验',
    desc: '基于隐马尔可夫模型与变点检测划分连续行为阶段，并以保形预测核验三档证据支持度、生成白盒特征归因，绝不给出总分或主观品格推断。',
    spec: 'HMM+PELT + Split Conformal',
  },
];

const WORKSPACE_LINKS: Array<{
  to: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
}> = [
  {
    to: '/interview',
    title: '面试行为采集',
    desc: '按题库顺序作答，同步记录画面、语音与答题时间窗',
    icon: <VideoCameraOutlined />,
  },
  {
    to: '/research',
    title: '科研行为采集',
    desc: '面向科研汇报与课题问答场景的多模态行为记录',
    icon: <ExperimentOutlined />,
  },
  {
    to: '/analysis',
    title: '实时监测台',
    desc: '实时查看三路服务状态、画面帧率、麦克风音量与信号曲线',
    icon: <LineChartOutlined />,
  },
  {
    to: '/reports',
    title: '报告中心',
    desc: '查看各场次行为证据报告，支持在线明细核对与单文件下载',
    icon: <FileTextOutlined />,
  },
  {
    to: '/recordings',
    title: '录制素材库',
    desc: '按场次管理原始录像、逐帧画面抽查与回收站恢复',
    icon: <FolderOpenOutlined />,
  },
  {
    to: '/export',
    title: '数据导出与原表',
    desc: '导出面部、手势、语音三份原始 CSV 台账、转写文本与趋势图',
    icon: <DatabaseOutlined />,
  },
  {
    to: '/question-bank',
    title: '题库管理',
    desc: '管理多套面试与科研题库，支持导入导出与关键词快速检索',
    icon: <BookOutlined />,
  },
  {
    to: '/benchmarks',
    title: '科研基准',
    desc: '跨语料多模态验证、3D 姿态校准效果与算力基准对比',
    icon: <BarChartOutlined />,
  },
  {
    to: '/career-mcp',
    title: '岗位 MCP 中心',
    desc: '标准 JSON-RPC 2.0 岗位画像检索、JD 拆解与零打分证据缺口核查',
    icon: <ApiOutlined />,
  },
  {
    to: '/metacognition',
    title: 'AI 审辨实训',
    desc: '阅读 AI 回答 → 指出漏洞 → 口头修正三阶段实训与规则化标记提取',
    icon: <RobotOutlined />,
  },
  {
    to: '/followup',
    title: '长周期随访档案',
    desc: '匿名受试编号多访次纵向追踪（t0 基线对照与跨版本不可比守卫）',
    icon: <SafetyCertificateOutlined />,
  },
  {
    to: '/compare',
    title: '多场纵向对比',
    desc: '对同一受试者多次科研/面试场次进行同代次并排对比与分布检查',
    icon: <SwapOutlined />,
  },
];

const Home: React.FC = () => {
  const navigate = useNavigate();

  const [health, setHealth] = useState<SystemHealthResponse | null>(null);
  const [reportCount, setReportCount] = useState<number | null>(null);
  const [recStats, setRecStats] = useState<{ n: number; bytes: number } | null>(null);
  const [cal3dCount, setCal3dCount] = useState<number | null>(null);
  const [profiles, setProfiles] = useState<SceneProfileDescriptor[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErrors, setLoadErrors] = useState<string[]>([]);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    const errs: string[] = [];

    const [healthRes, reportsRes, recsRes, benchRes, profRes] = await Promise.allSettled([
      dashboardApi.getSystemHealth(),
      dashboardApi.getFiles('reports'),
      recordingsApi.list(),
      dashboardApi.getResearchBenchmarks(),
      sceneProfilesApi.list(),
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

    if (benchRes.status === 'fulfilled') {
      const n3d = benchRes.value?.blendshape_calibration?.corpus_summary?.pose_mode_counts?.['3d_matrix'];
      setCal3dCount(typeof n3d === 'number' ? n3d : null);
    } else {
      setCal3dCount(null);
    }

    if (profRes.status === 'fulfilled' && Array.isArray(profRes.value?.profiles)) {
      setProfiles(profRes.value.profiles);
    }

    setLoadErrors(errs);
    setLoading(false);
  }, []);

  const heroSpecs = [
    '41 项客观行为指标',
    cal3dCount !== null ? `${cal3dCount} 场真 3D 姿态校准` : '真 3D 姿态残差校准',
    '保形置信覆盖 ≥ 90%',
    '零评分零临床推断',
  ];

  const profileById = profiles.reduce<Record<string, SceneProfileDescriptor>>((acc, p) => {
    acc[p.id] = p;
    return acc;
  }, {});

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
            衡才智析 · 多模态行为证据分析系统
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

          <div
            style={{
              marginTop: 24,
              display: 'flex',
              justifyContent: 'center',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            {heroSpecs.map((spec) => (
              <span
                key={spec}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '5px 14px',
                  borderRadius: 'var(--ax-rounded-pill)',
                  background: 'var(--ax-parchment)',
                  border: '1px solid var(--ax-hairline)',
                  color: 'var(--ax-text-secondary)',
                  fontSize: 12.5,
                  fontWeight: 400,
                  lineHeight: 1.4,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {spec}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ══ Tile 1.5 · 一核三基地 场景应用中心 ═══════════════════════════════════ */}
      <section className="ax-tile ax-tile--parchment" aria-label="一核三基地应用场景">
        <div className="ax-tile__inner">
          <div style={{ marginBottom: 22 }}>
            <h2
              className="ax-display-md"
              style={{ fontSize: 26, margin: 0, color: 'var(--ax-ink)' }}
            >
              一核三基地 · 声明式场景切换架构
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: 14.5, color: 'var(--ax-text-secondary)' }}>
              共享同一套真 3D 多模态采录与不打分白盒裁判内核，按场景档案开关指标扩展、隐私落盘挡位与主动封停条目。
            </p>
          </div>

          <Row gutter={[20, 20]}>
            {FALLBACK_BASES.map((base) => {
              const live = profileById[base.id];
              const name = live?.name || base.name;
              const weight = live?.weight_label || base.weight_label;
              const desc = live?.description || base.description;
              const banner = live?.compliance_banner || base.compliance_banner;
              return (
                <Col xs={24} lg={8} key={base.id}>
                  <div
                    className="ax-card"
                    style={{
                      background: 'var(--ax-canvas)',
                      border: '1px solid var(--ax-hairline)',
                      borderRadius: 'var(--ax-rounded-lg)',
                      padding: 22,
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: 16,
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <span
                          aria-hidden="true"
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 'var(--ax-rounded-md)',
                            background: 'var(--ax-info-soft)',
                            border: '1px solid var(--ax-info-border)',
                            color: 'var(--ax-primary)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 16,
                          }}
                        >
                          {base.icon}
                        </span>
                        <Tag
                          style={{
                            margin: 0,
                            color: 'var(--ax-primary)',
                            background: 'var(--ax-info-soft)',
                            borderColor: 'var(--ax-info-border)',
                            fontWeight: 600,
                          }}
                        >
                          {weight}
                        </Tag>
                      </div>

                      <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 600, color: 'var(--ax-ink)' }}>
                        {name}
                      </h3>
                      <p style={{ margin: '0 0 12px', fontSize: 13.5, lineHeight: 1.65, color: 'var(--ax-text-secondary)' }}>
                        {desc}
                      </p>
                      <div
                        style={{
                          fontSize: 12.5,
                          lineHeight: 1.55,
                          color: 'var(--ax-info)',
                          background: 'var(--ax-parchment)',
                          border: '1px solid var(--ax-hairline)',
                          borderRadius: 'var(--ax-rounded-sm)',
                          padding: '8px 10px',
                        }}
                      >
                        {banner}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      <Button
                        type="primary"
                        className="ax-btn--pill"
                        size="small"
                        onClick={() => navigate(base.primaryRoute)}
                      >
                        {base.primaryText}
                      </Button>
                      {base.secondaryActions.map((act) => (
                        <Button
                          key={act.to}
                          className="ax-btn--pill"
                          size="small"
                          onClick={() => navigate(act.to)}
                        >
                          {act.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </Col>
              );
            })}
          </Row>
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
              const engineBadge = !loading ? getEngineBadge(svc.key, st) : null;
              return (
                <Col xs={12} md={6} key={svc.key}>
                  <div
                    style={{
                      background: 'var(--ax-tile-3)',
                      border: '1px solid rgba(255,255,255,0.16)',
                      borderRadius: 'var(--ax-rounded-md)',
                      padding: '14px 16px',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
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
                          color: 'rgba(255,255,255,0.72)',
                        }}
                      >
                        {svc.port}
                        {svc.key === 'voice' && st?.asr_reachable !== undefined
                          ? ` · FunASR ${st.asr_reachable ? '在线' : '离线'}`
                          : ''}
                      </div>
                    </div>
                    {engineBadge && (
                      <div style={{ marginTop: 10 }}>
                        <span
                          style={{
                            display: 'inline-block',
                            fontSize: 11.5,
                            fontWeight: 600,
                            color: '#a8d5ff',
                            background: 'rgba(41, 151, 255, 0.16)',
                            border: '1px solid rgba(41, 151, 255, 0.38)',
                            borderRadius: 'var(--ax-rounded-xs)',
                            padding: '2px 8px',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {engineBadge}
                        </span>
                      </div>
                    )}
                  </div>
                </Col>
              );
            })}
          </Row>

          {/* 三列对称盘上实况与科研基准入口 */}
          <Row gutter={[20, 20]}>
            <Col xs={24} md={8}>
              <button
                type="button"
                className="ax-press ax-card--dark-interactive"
                onClick={() => navigate('/reports')}
                style={{
                  width: '100%',
                  height: '100%',
                  textAlign: 'left',
                  background: 'var(--ax-tile-3)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  borderRadius: 'var(--ax-rounded-lg)',
                  padding: 'var(--ax-space-lg)',
                  cursor: 'pointer',
                  color: 'var(--ax-on-dark)',
                  fontFamily: 'var(--ax-font-text)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: 'var(--ax-caption-size)', color: 'var(--ax-body-muted)' }}>
                    盘上行为证据报告
                  </div>
                  <div className="ax-display-lg" style={{ marginTop: 8, fontSize: 38, color: '#ffffff', fontVariantNumeric: 'tabular-nums' }}>
                    {reportCount === null ? (loading ? '…' : '未读到') : reportCount}
                    {reportCount !== null && (
                      <span style={{ fontSize: 16, fontWeight: 400, marginLeft: 8, color: 'var(--ax-body-muted)' }}>
                        份
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ marginTop: 12, fontSize: 13, color: 'var(--ax-primary-on-dark)' }}>
                  {reportCount === null
                    ? loading
                      ? '正在读取报告目录…'
                      : '点击前往报告中心重试 ›'
                    : '进入报告中心查看与离线下载 ›'}
                </div>
              </button>
            </Col>

            <Col xs={24} md={8}>
              <button
                type="button"
                className="ax-press ax-card--dark-interactive"
                onClick={() => navigate('/recordings')}
                style={{
                  width: '100%',
                  height: '100%',
                  textAlign: 'left',
                  background: 'var(--ax-tile-3)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  borderRadius: 'var(--ax-rounded-lg)',
                  padding: 'var(--ax-space-lg)',
                  cursor: 'pointer',
                  color: 'var(--ax-on-dark)',
                  fontFamily: 'var(--ax-font-text)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: 'var(--ax-caption-size)', color: 'var(--ax-body-muted)' }}>
                    本地录制素材库
                  </div>
                  <div className="ax-display-lg" style={{ marginTop: 8, fontSize: 38, color: '#ffffff', fontVariantNumeric: 'tabular-nums' }}>
                    {recStats === null ? (loading ? '…' : '未读到') : recStats.n}
                    {recStats !== null && (
                      <span style={{ fontSize: 16, fontWeight: 400, marginLeft: 8, color: 'var(--ax-body-muted)' }}>
                        场
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ marginTop: 12, fontSize: 13, color: 'var(--ax-primary-on-dark)' }}>
                  {recStats
                    ? `原生音视频合计 ${fmtBytes(recStats.bytes)} · 浏览回放与留存管理 ›`
                    : loading
                      ? '正在读取素材库…'
                      : '点击前往录制素材页重试 ›'}
                </div>
              </button>
            </Col>

            <Col xs={24} md={8}>
              <button
                type="button"
                className="ax-press ax-card--dark-interactive"
                onClick={() => navigate('/benchmarks')}
                style={{
                  width: '100%',
                  height: '100%',
                  textAlign: 'left',
                  background: 'var(--ax-tile-3)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  borderRadius: 'var(--ax-rounded-lg)',
                  padding: 'var(--ax-space-lg)',
                  cursor: 'pointer',
                  color: 'var(--ax-on-dark)',
                  fontFamily: 'var(--ax-font-text)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: 'var(--ax-caption-size)', color: 'var(--ax-body-muted)' }}>
                    科研方法学验证
                  </div>
                  <div className="ax-display-lg" style={{ marginTop: 8, fontSize: 38, color: '#ffffff', fontVariantNumeric: 'tabular-nums' }}>
                    4
                    <span style={{ fontSize: 16, fontWeight: 400, marginLeft: 8, color: 'var(--ax-body-muted)' }}>
                      项基准
                    </span>
                  </div>
                </div>
                <div style={{ marginTop: 12, fontSize: 13, color: 'var(--ax-primary-on-dark)' }}>
                  {cal3dCount !== null
                    ? `${cal3dCount} 场真 3D 样本校准 · 4 项国际/跨语料基准 ›`
                    : '4 大国际/跨语料基准 · 实时数据对比 ›'}
                </div>
              </button>
            </Col>
          </Row>
        </div>
      </section>

      {/* ══ Tile 3 · 浅色 —— 三层白盒架构与全部工作台入口 ═════════════════════ */}
      <section className="ax-tile ax-tile--light">
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
                    background: 'var(--ax-parchment)',
                    border: '1px solid var(--ax-hairline)',
                    borderRadius: 'var(--ax-rounded-lg)',
                    padding: '22px',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
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
                  <div style={{ marginTop: 16 }}>
                    <span
                      style={{
                        display: 'inline-block',
                        fontFamily: 'var(--ax-font-mono)',
                        fontSize: 12,
                        fontWeight: 400,
                        color: 'var(--ax-info)',
                        background: 'var(--ax-canvas)',
                        border: '1px solid var(--ax-hairline)',
                        borderRadius: 'var(--ax-rounded-xs)',
                        padding: '4px 10px',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {layer.spec}
                    </span>
                  </div>
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
              <Col xs={24} sm={12} lg={6} key={item.to}>
                <button
                  type="button"
                  className="ax-press ax-card ax-card--interactive"
                  onClick={() => navigate(item.to)}
                  style={{
                    width: '100%',
                    height: '100%',
                    textAlign: 'left',
                    background: 'var(--ax-canvas)',
                    border: '1px solid var(--ax-hairline)',
                    borderRadius: 'var(--ax-rounded-lg)',
                    padding: '18px',
                    cursor: 'pointer',
                    fontFamily: 'var(--ax-font-text)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div
                      aria-hidden="true"
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 'var(--ax-rounded-md)',
                        background: 'var(--ax-info-soft)',
                        border: '1px solid var(--ax-info-border)',
                        color: 'var(--ax-primary)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 17,
                        marginBottom: 12,
                      }}
                    >
                      {item.icon}
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ax-ink)' }}>
                      {item.title}
                    </div>
                    <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.55, color: 'var(--ax-text-secondary)' }}>
                      {item.desc}
                    </div>
                  </div>
                  <div style={{ marginTop: 14, fontSize: 13, fontWeight: 600, color: 'var(--ax-primary)' }}>
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
