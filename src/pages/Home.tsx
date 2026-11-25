import React, { useCallback, useEffect, useState } from 'react';
import { Button, Col, Drawer, Row, Space, Tag } from 'antd';
import {
  ArrowRightOutlined,
  BarChartOutlined,
  BookOutlined,
  CheckCircleOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  ReloadOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  SwapOutlined,
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

interface PortalMeta {
  id: 'research_interview' | 'ai_metacognition' | 'longitudinal_followup';
  cardClass: string;
  accent: string;
  soft: string;
  border: string;
  hubRoute: string;
  ctaLabel: string;
  defaultName: string;
  defaultEnglish: string;
  defaultWeight: string;
  defaultDesc: string;
  defaultTheory: string;
  icon: React.ReactNode;
}

const PORTAL_BASES: PortalMeta[] = [
  {
    id: 'research_interview',
    cardClass: 'ax-portal-card ax-portal-card--b1',
    accent: 'var(--ax-b1)',
    soft: 'var(--ax-b1-soft)',
    border: 'var(--ax-b1-border)',
    hubRoute: '/hub/research',
    ctaLabel: '进入研思循证 ›',
    defaultName: '研思循证 · 科研行为过程分析',
    defaultEnglish: 'Research Process Evidence',
    defaultWeight: '核心科研场景',
    defaultDesc:
      '面向课题组汇报、复试答辩与科研训练的过程性行为证据分析工作台，同步记录表达节律、体态稳定性与多场纵向变化。',
    defaultTheory: '社会信号处理与过程性表现循证框架',
    icon: <ExperimentOutlined />,
  },
  {
    id: 'ai_metacognition',
    cardClass: 'ax-portal-card ax-portal-card--b2',
    accent: 'var(--ax-b2)',
    soft: 'var(--ax-b2-soft)',
    border: 'var(--ax-b2-border)',
    hubRoute: '/hub/metacognition',
    ctaLabel: '进入元智审辨 ›',
    defaultName: '元智审辨 · AI 元能力与职业实训',
    defaultEnglish: 'AI Metacognition & Career',
    defaultWeight: 'AI 审辨与求职实训',
    defaultDesc:
      '将岗位能力需求拆解为可观测行为线索与主动封停项，联动「阅读 AI 回答 → 指出漏洞 → 口头修正」三阶段审辨实训。',
    defaultTheory: '自我调节学习与人机协同元认知校准模型',
    icon: <RobotOutlined />,
  },
  {
    id: 'longitudinal_followup',
    cardClass: 'ax-portal-card ax-portal-card--b3',
    accent: 'var(--ax-b3)',
    soft: 'var(--ax-b3-soft)',
    border: 'var(--ax-b3-border)',
    hubRoute: '/hub/followup',
    ctaLabel: '进入时序观微 ›',
    defaultName: '时序观微 · 匿名个体纵向随访',
    defaultEnglish: 'Idiographic Longitudinal',
    defaultWeight: '匿名纵向研究 · 非医疗',
    defaultDesc:
      '以匿名随访编号与本人首访基线为自我参照，在零原始影像与零原声落盘保护模式下追踪个体内变化趋势。',
    defaultTheory: '个体特异纵向跟踪与稳健过程监控方法',
    icon: <SafetyCertificateOutlined />,
  },
];

const DIAGNOSTIC_CHANNELS: Array<{ key: string; label: string; capability: string }> = [
  { key: 'panel', label: '总控与报告生成通道', capability: '结构化报告归档与文本解读' },
  { key: 'face', label: '面部视觉观测通道', capability: '三维面部网格与动作幅度采样' },
  { key: 'voice', label: '语音声学与转写通道', capability: '语音韵律提取与本地转写' },
  { key: 'gesture', label: '上肢体态观测通道', capability: '双手与肩臂姿态稳定性采样' },
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
  const [diagOpen, setDiagOpen] = useState(false);

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
      errs.push('系统通道状态检查未响应');
    }

    if (reportsRes.status === 'fulfilled' && Array.isArray(reportsRes.value)) {
      setReportCount(
        reportsRes.value.filter((f: { name?: string }) => REPORT_FILE_RE.test(f?.name || '')).length
      );
    } else {
      setReportCount(null);
      errs.push('报告归档目录暂未读到');
    }

    if (recsRes.status === 'fulfilled') {
      setRecStats({
        n: recsRes.value.recordings.length,
        bytes: recsRes.value.total_video_bytes,
      });
    } else {
      setRecStats(null);
      errs.push('录制素材目录暂未读到');
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

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const profileById = profiles.reduce<Record<string, SceneProfileDescriptor>>((acc, p) => {
    acc[p.id] = p;
    return acc;
  }, {});

  const readyChannelCount = DIAGNOSTIC_CHANNELS.filter((c) => health?.services?.[c.key]?.ok === true).length;
  const allChannelsReady = !loading && readyChannelCount === DIAGNOSTIC_CHANNELS.length;

  const statusPillText = loading
    ? '正在核对采集通道与归档状态…'
    : allChannelsReady
      ? `系统采集通道已就绪 · 已归档 ${reportCount ?? 0} 份报告`
      : `已就绪 ${readyChannelCount} / ${DIAGNOSTIC_CHANNELS.length} 条采集通道 · 已归档 ${reportCount ?? '—'} 份报告`;

  const scrollToPortals = () => {
    const el = document.getElementById('portal-bases');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      navigate('/hub/research');
    }
  };

  return (
    <main>
      {/* ══ Tile 1 · 居中舒朗 Hero ═══════════════════════════════════════════════ */}
      <section className="ax-tile ax-tile--light" style={{ paddingTop: 48, paddingBottom: 40 }}>
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
            不给分，只给客观行为证据
          </h1>

          <p
            className="ax-lead"
            style={{
              margin: '18px auto 0',
              maxWidth: 740,
              color: 'var(--ax-text-secondary)',
              fontSize: 20,
              lineHeight: 1.6,
            }}
          >
            同步记录科研汇报、AI 元能力实训与匿名纵向随访中的真实语音、面部与姿态过程线索 —— 逐项说明实测依据与采样缺口，不做综合评分或临床判断。
          </p>

          <div style={{ marginTop: 32 }}>
            <Button
              type="primary"
              className="ax-btn--pill"
              size="large"
              onClick={scrollToPortals}
              style={{ paddingInline: 28, fontSize: 16 }}
            >
              选择应用场景开始 ›
            </Button>
          </div>

          <div style={{ marginTop: 22, display: 'flex', justifyContent: 'center' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: 10,
                padding: '6px 14px',
                borderRadius: 'var(--ax-rounded-pill)',
                background: 'var(--ax-parchment)',
                border: '1px solid var(--ax-hairline)',
                fontSize: 13,
                color: 'var(--ax-text-secondary)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: loading ? '#8e8e93' : allChannelsReady ? 'var(--ax-success)' : 'var(--ax-warning)',
                  display: 'inline-block',
                }}
              />
              <span>{statusPillText}</span>
              <button
                type="button"
                onClick={() => setDiagOpen(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '0 2px',
                  cursor: 'pointer',
                  fontFamily: 'var(--ax-font-text)',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--ax-primary)',
                }}
              >
                查看运行状态
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ══ Tile 2 · 三大场景门户入口（米灰底 + 3px 顶线强调色卡片） ═════════ */}
      <section
        id="portal-bases"
        className="ax-tile ax-tile--parchment"
        aria-label="三大应用场景门户"
        style={{ paddingTop: 44, paddingBottom: 52 }}
      >
        <div className="ax-tile__inner">
          <div style={{ marginBottom: 28 }}>
            <h2
              className="ax-display-md"
              style={{ fontSize: 28, margin: 0, color: 'var(--ax-ink)' }}
            >
              三大应用场景
            </h2>
            <p style={{ margin: '8px 0 0', fontSize: 15, color: 'var(--ax-text-secondary)' }}>
              选择对应研究或实训场景，进入专属工作台开展同步采录、岗位对照或纵向轨迹分析。
            </p>
          </div>

          <Row gutter={[28, 28]}>
            {PORTAL_BASES.map((base) => {
              const live = profileById[base.id];
              const name = live?.name || base.defaultName;
              const englishTag = live?.english_tag || base.defaultEnglish;
              const weight = live?.weight_label || base.defaultWeight;
              const desc = live?.description || base.defaultDesc;
              const theory = live?.theoretical_foundation?.framework || base.defaultTheory;
              const targetRoute = live?.route_base || base.hubRoute;

              return (
                <Col xs={24} lg={8} key={base.id}>
                  <div className={base.cardClass}>
                    <div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 10,
                          marginBottom: 16,
                        }}
                      >
                        <span
                          aria-hidden="true"
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 'var(--ax-rounded-md)',
                            background: base.soft,
                            border: `1px solid ${base.border}`,
                            color: base.accent,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 18,
                          }}
                        >
                          {base.icon}
                        </span>
                        <Tag
                          style={{
                            margin: 0,
                            color: base.accent,
                            background: base.soft,
                            borderColor: base.border,
                            fontWeight: 600,
                          }}
                        >
                          {weight}
                        </Tag>
                      </div>

                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--ax-text-secondary)',
                          marginBottom: 4,
                        }}
                      >
                        {englishTag}
                      </div>

                      <h3
                        style={{
                          margin: '0 0 12px',
                          fontSize: 20,
                          fontWeight: 600,
                          lineHeight: 1.35,
                          color: 'var(--ax-ink)',
                        }}
                      >
                        {name}
                      </h3>

                      <p
                        style={{
                          margin: '0 0 16px',
                          fontSize: 14.5,
                          lineHeight: 1.7,
                          color: 'var(--ax-text-secondary)',
                        }}
                      >
                        {desc}
                      </p>

                      <div
                        style={{
                          fontSize: 12.5,
                          lineHeight: 1.55,
                          color: base.accent,
                          background: base.soft,
                          border: `1px solid ${base.border}`,
                          borderRadius: 'var(--ax-rounded-sm)',
                          padding: '8px 12px',
                        }}
                      >
                        理论依据：{theory}
                      </div>
                    </div>

                    <div>
                      <Button
                        type="primary"
                        className="ax-btn--pill"
                        onClick={() => navigate(targetRoute)}
                        style={{
                          width: '100%',
                          background: base.accent,
                          borderColor: base.accent,
                          color: '#ffffff',
                          fontWeight: 600,
                        }}
                      >
                        {base.ctaLabel}
                      </Button>
                    </div>
                  </div>
                </Col>
              );
            })}
          </Row>
        </div>
      </section>

      {/* ══ Tile 3 · 共享报告与工具栏（紧凑 4 列） ═════════════════════════════ */}
      <section className="ax-tile ax-tile--light" style={{ paddingTop: 56, paddingBottom: 64 }}>
        <div className="ax-tile__inner">
          <div style={{ marginBottom: 22 }}>
            <h2
              className="ax-display-md"
              style={{ fontSize: 24, margin: 0, color: 'var(--ax-ink)' }}
            >
              共享报告与工具栏
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: 14.5, color: 'var(--ax-text-secondary)' }}>
              跨场景统一查阅已归档报告、管理题库素材与方法学验证数据。
            </p>
          </div>

          <Row gutter={[20, 20]}>
            <Col xs={24} sm={12} lg={6}>
              <div
                className="ax-card"
                style={{
                  padding: '22px 20px',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 14,
                }}
              >
                <div>
                  <span
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
                    <FileTextOutlined />
                  </span>
                  <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 600, color: 'var(--ax-ink)' }}>
                    报告中心
                  </h3>
                  <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: 'var(--ax-text-secondary)' }}>
                    浏览各场次可读行为报告、切换受众视角并导出离线文件。
                  </p>
                </div>
                <Space size={12}>
                  <Button type="link" style={{ padding: 0, fontWeight: 600 }} onClick={() => navigate('/reports')}>
                    全部报告 ›
                  </Button>
                  <Button type="link" style={{ padding: 0 }} onClick={() => navigate('/report/latest')}>
                    最新一份 ›
                  </Button>
                </Space>
              </div>
            </Col>

            <Col xs={24} sm={12} lg={6}>
              <div
                className="ax-card"
                style={{
                  padding: '22px 20px',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 14,
                }}
              >
                <div>
                  <span
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
                    <SwapOutlined />
                  </span>
                  <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 600, color: 'var(--ax-ink)' }}>
                    多场纵向对比
                  </h3>
                  <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: 'var(--ax-text-secondary)' }}>
                    对同一参与者多次汇报场次进行同代次并排对照与趋势核查。
                  </p>
                </div>
                <div>
                  <Button type="link" style={{ padding: 0, fontWeight: 600 }} onClick={() => navigate('/compare')}>
                    进入对比工作台 ›
                  </Button>
                </div>
              </div>
            </Col>

            <Col xs={24} sm={12} lg={6}>
              <div
                className="ax-card"
                style={{
                  padding: '22px 20px',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 14,
                }}
              >
                <div>
                  <span
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
                    <FolderOpenOutlined />
                  </span>
                  <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 600, color: 'var(--ax-ink)' }}>
                    题库与录制管理
                  </h3>
                  <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: 'var(--ax-text-secondary)' }}>
                    管理多套问答题目、浏览场次录像与逐帧抽查或导出原表。
                  </p>
                </div>
                <Space size={12}>
                  <Button type="link" style={{ padding: 0, fontWeight: 600 }} onClick={() => navigate('/recordings')}>
                    录制素材 ›
                  </Button>
                  <Button type="link" style={{ padding: 0 }} onClick={() => navigate('/question-bank')}>
                    题库管理 ›
                  </Button>
                </Space>
              </div>
            </Col>

            <Col xs={24} sm={12} lg={6}>
              <div
                className="ax-card"
                style={{
                  padding: '22px 20px',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 14,
                }}
              >
                <div>
                  <span
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
                    <BarChartOutlined />
                  </span>
                  <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 600, color: 'var(--ax-ink)' }}>
                    方法与科研基准
                  </h3>
                  <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: 'var(--ax-text-secondary)' }}>
                    查看跨语料一致性验证、三维姿态校准效果与参考基准指标。
                  </p>
                </div>
                <div>
                  <Button type="link" style={{ padding: 0, fontWeight: 600 }} onClick={() => navigate('/benchmarks')}>
                    查看科研基准 ›
                  </Button>
                </div>
              </div>
            </Col>
          </Row>
        </div>
      </section>

      {/* ══ 运行状态与通道诊断抽屉（操作员按需打开，默认门户零工程术语） ════════ */}
      <Drawer
        title="系统运行与采录通道状态"
        open={diagOpen}
        onClose={() => setDiagOpen(false)}
        width={480}
        extra={
          <Button
            size="small"
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={() => void loadOverview()}
          >
            刷新
          </Button>
        }
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          {loadErrors.length > 0 && (
            <div
              role="alert"
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--ax-rounded-sm)',
                background: 'var(--ax-warning-soft)',
                border: '1px solid var(--ax-warning-border)',
                color: 'var(--ax-warning)',
                fontSize: 13,
              }}
            >
              部分状态未读到：{loadErrors.join('；')}
            </div>
          )}

          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ax-ink)', marginBottom: 10 }}>
              采录与分析通道就绪情况
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {DIAGNOSTIC_CHANNELS.map((ch) => {
                const st = health?.services?.[ch.key];
                const ok = st?.ok === true;
                const degraded = st?.status === 'degraded';
                const statusText = loading
                  ? '检测中…'
                  : ok
                    ? `已就绪 (${st.latency_ms} ms)`
                    : degraded
                      ? '部分功能受限'
                      : '未连接';
                return (
                  <div
                    key={ch.key}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 'var(--ax-rounded-md)',
                      background: 'var(--ax-parchment)',
                      border: '1px solid var(--ax-hairline)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ax-ink)' }}>{ch.label}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--ax-text-secondary)', marginTop: 2 }}>
                        {ch.capability}
                      </div>
                    </div>
                    <Tag
                      icon={ok ? <CheckCircleOutlined /> : undefined}
                      style={{
                        margin: 0,
                        fontWeight: 600,
                        color: ok ? 'var(--ax-success)' : degraded ? 'var(--ax-warning)' : 'var(--ax-error)',
                        background: ok
                          ? 'var(--ax-success-soft)'
                          : degraded
                            ? 'var(--ax-warning-soft)'
                            : 'var(--ax-error-soft)',
                        borderColor: ok
                          ? 'var(--ax-success-border)'
                          : degraded
                            ? 'var(--ax-warning-border)'
                            : 'var(--ax-error-border)',
                      }}
                    >
                      {statusText}
                    </Tag>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ax-ink)', marginBottom: 10 }}>
              本地归档与数据概览
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--ax-rounded-md)',
                  background: 'var(--ax-canvas)',
                  border: '1px solid var(--ax-hairline)',
                }}
              >
                <div style={{ fontSize: 12, color: 'var(--ax-text-secondary)' }}>已归档行为报告</div>
                <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--ax-ink)', marginTop: 4 }}>
                  {reportCount === null ? '—' : `${reportCount} 份`}
                </div>
              </div>
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--ax-rounded-md)',
                  background: 'var(--ax-canvas)',
                  border: '1px solid var(--ax-hairline)',
                }}
              >
                <div style={{ fontSize: 12, color: 'var(--ax-text-secondary)' }}>本地录制素材</div>
                <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--ax-ink)', marginTop: 4 }}>
                  {recStats ? `${recStats.n} 场` : '—'}
                </div>
                {recStats && (
                  <div style={{ fontSize: 11.5, color: 'var(--ax-text-secondary)', marginTop: 2 }}>
                    占用空间 {fmtBytes(recStats.bytes)}
                  </div>
                )}
              </div>
            </div>
            {cal3dCount !== null && (
              <div style={{ fontSize: 12.5, color: 'var(--ax-text-secondary)', marginTop: 10 }}>
                已完成 {cal3dCount} 场三维头部姿态参考样本校准。
              </div>
            )}
          </div>

          <Space wrap>
            <Button icon={<ArrowRightOutlined />} onClick={() => { setDiagOpen(false); navigate('/analysis'); }}>
              前往实时监测台
            </Button>
            <Button icon={<BookOutlined />} onClick={() => { setDiagOpen(false); navigate('/export'); }}>
              前往数据导出
            </Button>
          </Space>
        </Space>
      </Drawer>
    </main>
  );
};

export default Home;
