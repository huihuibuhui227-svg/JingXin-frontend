import React, { useCallback, useEffect, useState } from 'react';
import { Button, Drawer, Space, Tag } from 'antd';
import {
  ArrowRightOutlined,
  BookOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import {
  dashboardApi,
  sceneProfilesApi,
  SceneProfileDescriptor,
  SystemHealthResponse,
} from '@/services/api';
import { recordingsApi } from '@/services/recordingsApi';
import { DesignThemeId } from '@/theme/designThemes';
import { useDesignTheme } from '@/theme/ThemeContext';

const fmtBytes = (n: number): string => {
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const idx = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** idx).toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
};

const REPORT_FILE_RE = /(?:HengCai_Evidence_Report|Research_Assessment_Report).*\.html$/i;

type ScenarioStageId = 'research_interview' | 'ai_metacognition' | 'longitudinal_followup';

interface ScenarioStageSpec {
  id: ScenarioStageId;
  index: string;
  worldId: DesignThemeId;
  worldBadge: string;
  dotColor: string;
  hubRoute: string;
  defaultName: string;
  defaultWeight: string;
  defaultDesc: string;
  defaultTheory: string;
}

const SCENARIO_STAGES: ScenarioStageSpec[] = [
  {
    id: 'research_interview',
    index: '01',
    worldId: 'linear',
    worldBadge: 'Linear · 深邃曜石暗仪',
    dotColor: '#5e6ad2',
    hubRoute: '/hub/research',
    defaultName: '研思循证 · 科研行为过程分析',
    defaultWeight: '核心科研场景',
    defaultDesc:
      '面向课题组汇报、复试答辩与科研训练的过程性行为证据分析工作台，同步记录表达节律、体态稳定性与多场纵向变化。',
    defaultTheory: '社会信号处理与过程性表现循证框架',
  },
  {
    id: 'ai_metacognition',
    index: '02',
    worldId: 'claude',
    worldBadge: 'Claude · 温润象牙编校',
    dotColor: '#a34f33',
    hubRoute: '/hub/metacognition',
    defaultName: '元智审辨 · AI 元能力与职业实训',
    defaultWeight: 'AI 审辨与求职实训',
    defaultDesc:
      '将岗位能力需求拆解为可观测行为线索与主动封停项，联动「阅读 AI 回答 → 指出漏洞 → 口头修正」三阶段审辨实训。',
    defaultTheory: '自我调节学习与人机协同元认知校准模型',
  },
  {
    id: 'longitudinal_followup',
    index: '03',
    worldId: 'oura',
    worldBadge: 'Oura · 森绿亚麻时序',
    dotColor: '#224228',
    hubRoute: '/hub/followup',
    defaultName: '时序观微 · 匿名个体纵向随访',
    defaultWeight: '匿名纵向研究 · 非医疗',
    defaultDesc:
      '以匿名随访编号与本人首访基线为自我参照，在零原始影像与零原声落盘保护模式下追踪个体内变化趋势。',
    defaultTheory: '个体特异纵向跟踪与稳健过程监控方法',
  },
];

const DIAGNOSTIC_CHANNELS: Array<{ key: string; label: string; capability: string }> = [
  { key: 'panel', label: '总控与报告生成通道', capability: '结构化报告归档与文本解读' },
  { key: 'face', label: '面部视觉观测通道', capability: '三维面部网格与动作幅度采样' },
  { key: 'voice', label: '语音声学与转写通道', capability: '语音韵律提取与本地转写' },
  { key: 'gesture', label: '上肢体态观测通道', capability: '双手与肩臂姿态稳定性采样' },
];

const UTILITY_COLUMNS: Array<{
  code: string;
  title: string;
  desc: string;
  links: Array<{ label: string; to: string; primary?: boolean }>;
}> = [
  {
    code: '01 / 报告中心',
    title: '可读行为证据报告',
    desc: '浏览各场次行为证据报告、切换受众视角并导出离线文件。',
    links: [
      { label: '全部报告 ›', to: '/reports', primary: true },
      { label: '最新一份 ›', to: '/report/latest' },
    ],
  },
  {
    code: '02 / 多场纵向对比',
    title: '同代次趋势核查',
    desc: '对同一参与者多次汇报场次进行同代次并排对照与轨迹核查。',
    links: [{ label: '进入对比工作台 ›', to: '/compare', primary: true }],
  },
  {
    code: '03 / 录制素材与题库',
    title: '场次素材与题目管理',
    desc: '管理多套问答题目、浏览场次录像与逐帧抽查或导出原表。',
    links: [
      { label: '录制素材 ›', to: '/recordings', primary: true },
      { label: '题库管理 ›', to: '/question-bank' },
    ],
  },
  {
    code: '04 / 方法验证与科研基准',
    title: '方法学校验档案',
    desc: '查看跨语料一致性验证、三维姿态校准效果与参考基准指标。',
    links: [{ label: '查看科研基准 ›', to: '/benchmarks', primary: true }],
  },
];

const TELEMETRY_CELL_STYLE: React.CSSProperties = {
  background: 'var(--ax-surface)',
  padding: '24px 22px',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  gap: 12,
};

const GridCrosshair: React.FC<{ style?: React.CSSProperties; className?: string }> = ({
  style,
  className,
}) => (
  <svg
    aria-hidden="true"
    width="9"
    height="9"
    viewBox="0 0 9 9"
    fill="none"
    className={className}
    style={{
      position: 'absolute',
      pointerEvents: 'none',
      zIndex: 3,
      ...style,
    }}
  >
    <path d="M4.5 0V9M0 4.5H9" stroke="var(--ax-border-strong)" strokeWidth="1" />
  </svg>
);

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { setMode } = useDesignTheme();

  const [health, setHealth] = useState<SystemHealthResponse | null>(null);
  const [reportCount, setReportCount] = useState<number | null>(null);
  const [recStats, setRecStats] = useState<{ n: number; bytes: number } | null>(null);
  const [cal3dCount, setCal3dCount] = useState<number | null>(null);
  const [profiles, setProfiles] = useState<SceneProfileDescriptor[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErrors, setLoadErrors] = useState<string[]>([]);
  const [diagOpen, setDiagOpen] = useState(false);
  const [activeStage, setActiveStage] = useState<ScenarioStageId>('research_interview');

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

  const selectedStageSpec =
    SCENARIO_STAGES.find((stage) => stage.id === activeStage) ?? SCENARIO_STAGES[0];
  const selectedProfile = profileById[selectedStageSpec.id];
  const selectedName = selectedProfile?.name || selectedStageSpec.defaultName;
  const selectedDesc = selectedProfile?.description || selectedStageSpec.defaultDesc;
  const selectedTheory =
    selectedProfile?.theoretical_foundation?.framework || selectedStageSpec.defaultTheory;
  const selectedRoute = selectedProfile?.route_base || selectedStageSpec.hubRoute;

  const numericTelemetryCells = [
    {
      code: '01 · ARCHIVE',
      label: '已归档报告',
      value: reportCount ?? '—',
      suffix: '份',
      note: '可追溯证据归档',
    },
    {
      code: '02 · CALIBRATION',
      label: '真三维标定样本',
      value: cal3dCount ?? '—',
      suffix: '场',
      note: '姿态几何参照样本',
    },
    {
      code: '03 · STORAGE',
      label: '本地采录素材',
      value: recStats ? recStats.n : '—',
      suffix: `场 · ${recStats ? fmtBytes(recStats.bytes) : '—'}`,
      note: '按场次独立留存',
    },
  ];

  return (
    <main
      style={{
        background: 'var(--ax-parchment)',
        padding: '28px 20px 64px',
        minHeight: 'calc(100vh - var(--ax-nav-height))',
      }}
    >
      <style>{`
        .jx-portal-hero {
          display: grid;
          grid-template-columns: 62% 38%;
        }
        .jx-portal-hero-left {
          padding: 48px 40px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .jx-portal-hero-h1 {
          font-family: var(--ax-font-display);
          font-size: 42px;
          line-height: 1.12;
          letter-spacing: -0.03em;
          font-weight: 600;
          color: var(--ax-ink);
          margin: 14px 0 18px;
        }
        .jx-portal-telemetry {
          border-left: 1px solid var(--ax-hairline);
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: 1fr 1fr;
          gap: 1px;
          background: var(--ax-hairline);
        }
        .jx-portal-stage-grid {
          display: grid;
          grid-template-columns: 38% 62%;
        }
        .jx-portal-stage-list {
          border-right: 1px solid var(--ax-hairline);
          display: flex;
          flex-direction: column;
        }
        .jx-portal-stage-btn {
          transition: background-color 140ms ease;
        }
        .jx-portal-stage-btn:hover {
          background: var(--ax-surface-alt) !important;
        }
        .jx-portal-utility-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 1px;
          background: var(--ax-hairline);
        }
        .jx-crosshair-desktop {
          display: block;
        }
        @media (max-width: 960px) {
          .jx-portal-hero {
            grid-template-columns: 1fr;
          }
          .jx-portal-telemetry {
            border-left: none;
            border-top: 1px solid var(--ax-hairline);
          }
          .jx-portal-stage-grid {
            grid-template-columns: 1fr;
          }
          .jx-portal-stage-list {
            border-right: none;
            border-bottom: 1px solid var(--ax-hairline);
          }
          .jx-portal-utility-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .jx-crosshair-desktop {
            display: none;
          }
        }
        @media (max-width: 640px) {
          .jx-portal-hero-left {
            padding: 28px 20px;
          }
          .jx-portal-hero-h1 {
            font-size: 32px;
          }
          .jx-portal-utility-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div
        style={{
          maxWidth: 1180,
          margin: '0 auto',
          background: 'var(--ax-surface)',
          border: '1px solid var(--ax-hairline)',
          position: 'relative',
        }}
      >
        <GridCrosshair style={{ top: -5, left: -5 }} />
        <GridCrosshair style={{ top: -5, right: -5 }} />
        <GridCrosshair style={{ bottom: -5, left: -5 }} />
        <GridCrosshair style={{ bottom: -5, right: -5 }} />
        <GridCrosshair className="jx-crosshair-desktop" style={{ top: -5, left: 'calc(62% - 4px)' }} />

        {/* ══ Row 1 · Asymmetric Architectural Hero (62% / 38%) ═══════════════════ */}
        <section aria-label="系统概览与实时遥测" className="jx-portal-hero">
          <div className="jx-portal-hero-left">
            <div>
              <div
                style={{
                  fontFamily: 'var(--ax-font-mono)',
                  fontSize: 12,
                  lineHeight: 1.4,
                  letterSpacing: '0.03em',
                  color: 'var(--ax-text-secondary)',
                }}
              >
                00 / MULTIMODAL BEHAVIORAL EVIDENCE
              </div>

              <h1 className="jx-portal-hero-h1">不给分，只给客观行为证据</h1>

              <p
                style={{
                  margin: 0,
                  maxWidth: 600,
                  fontSize: 16,
                  lineHeight: 1.65,
                  color: 'var(--ax-ink-muted-80)',
                }}
              >
                同步采集科研汇报、AI 元能力审辨实训与匿名个体纵向随访中的语音、面部与上肢过程线索 —— 逐项披露采样覆盖率与信号缺口，不做综合评分或临床判断。
              </p>
            </div>

            <div style={{ marginTop: 32, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <button
                type="button"
                onClick={() => navigate('/hub/research')}
                style={{
                  height: 42,
                  padding: '0 20px',
                  borderRadius: 6,
                  background: 'var(--ax-primary)',
                  color: 'var(--ax-on-primary)',
                  border: '1px solid var(--ax-primary)',
                  fontFamily: 'var(--ax-font-text)',
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>进入核心科研场景</span>
                <span aria-hidden="true">→</span>
              </button>

              <button
                type="button"
                onClick={() => navigate('/reports')}
                style={{
                  height: 42,
                  padding: '0 20px',
                  borderRadius: 6,
                  background: 'var(--ax-surface)',
                  color: 'var(--ax-ink)',
                  border: '1px solid var(--ax-hairline)',
                  fontFamily: 'var(--ax-font-text)',
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
              >
                查阅历史报告
              </button>
            </div>
          </div>

          <div className="jx-portal-telemetry">
            {numericTelemetryCells.map((cell) => (
              <div key={cell.code} style={TELEMETRY_CELL_STYLE}>
                <div>
                  <div
                    style={{
                      fontFamily: 'var(--ax-font-mono)',
                      fontSize: 11,
                      color: 'var(--ax-text-secondary)',
                    }}
                  >
                    {cell.code}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: 'var(--ax-ink-muted-80)',
                      marginTop: 4,
                    }}
                  >
                    {cell.label}
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 28,
                      fontWeight: 600,
                      letterSpacing: '-0.03em',
                      color: 'var(--ax-ink)',
                      fontVariantNumeric: 'tabular-nums',
                      lineHeight: 1.15,
                    }}
                  >
                    {cell.value}
                    <span
                      style={{
                        fontSize: 12.5,
                        fontWeight: 400,
                        marginLeft: 5,
                        color: 'var(--ax-text-secondary)',
                      }}
                    >
                      {cell.suffix}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ax-text-secondary)', marginTop: 4 }}>
                    {cell.note}
                  </div>
                </div>
              </div>
            ))}

            {/* Cell D: 采集通道状态 */}
            <div style={TELEMETRY_CELL_STYLE}>
              <div>
                <div
                  style={{
                    fontFamily: 'var(--ax-font-mono)',
                    fontSize: 11,
                    color: 'var(--ax-text-secondary)',
                  }}
                >
                  04 · TELEMETRY
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--ax-ink-muted-80)',
                    marginTop: 4,
                  }}
                >
                  采集通道状态
                </div>
              </div>
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 18,
                    fontWeight: 600,
                    letterSpacing: '-0.02em',
                    color: 'var(--ax-ink)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      flexShrink: 0,
                      background: loading
                        ? 'var(--ax-text-secondary)'
                        : allChannelsReady
                          ? 'var(--ax-success)'
                          : 'var(--ax-warning)',
                    }}
                  />
                  <span>
                    {loading
                      ? '核对中…'
                      : `${readyChannelCount} / ${DIAGNOSTIC_CHANNELS.length} 就绪`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setDiagOpen(true)}
                  style={{
                    marginTop: 8,
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    fontFamily: 'var(--ax-font-text)',
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: 'var(--ax-ink)',
                    textDecoration: 'underline',
                    textUnderlineOffset: 3,
                  }}
                >
                  通道自检 ›
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ══ Row 2 · Interactive 3-World Live Switcher Stage ═════════════════════ */}
        <section
          aria-label="三场景实时切境舞台"
          style={{
            borderTop: '1px solid var(--ax-hairline)',
            position: 'relative',
          }}
        >
          <GridCrosshair style={{ top: -5, left: -5 }} />
          <GridCrosshair style={{ top: -5, right: -5 }} />

          <div
            style={{
              padding: '16px 28px',
              borderBottom: '1px solid var(--ax-hairline)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 10,
              background: 'var(--ax-parchment)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span
                style={{
                  fontFamily: 'var(--ax-font-mono)',
                  fontSize: 12,
                  color: 'var(--ax-text-secondary)',
                }}
              >
                01 — 03 / SCENARIO WORLDS
              </span>
              <h2
                style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 600,
                  color: 'var(--ax-ink)',
                  letterSpacing: '-0.01em',
                }}
              >
                三场景实时切境舞台
              </h2>
            </div>
            <span style={{ fontSize: 13, color: 'var(--ax-text-secondary)' }}>
              点击左侧场景切换专属大厂工作台预览，或直接进入该模块
            </span>
          </div>

          <div className="jx-portal-stage-grid">
            {/* Left Selector Column (38%) */}
            <div className="jx-portal-stage-list">
              {SCENARIO_STAGES.map((stage, idx) => {
                const live = profileById[stage.id];
                const isSelected = activeStage === stage.id;
                const stageName = live?.name || stage.defaultName;
                const stageWeight = live?.weight_label || stage.defaultWeight;
                const stageTheory = live?.theoretical_foundation?.framework || stage.defaultTheory;

                return (
                  <button
                    key={stage.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setActiveStage(stage.id)}
                    className="jx-portal-stage-btn"
                    style={{
                      position: 'relative',
                      width: '100%',
                      flex: 1,
                      padding: '22px 24px 22px 26px',
                      background: isSelected ? 'var(--ax-parchment)' : 'transparent',
                      border: 'none',
                      borderTop: idx === 0 ? 'none' : '1px solid var(--ax-hairline)',
                      borderLeft: isSelected
                        ? `3px solid ${stage.dotColor}`
                        : '3px solid transparent',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: 10,
                      fontFamily: 'var(--ax-font-text)',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                          marginBottom: 8,
                        }}
                      >
                        <span
                          style={{
                            fontFamily: 'var(--ax-font-mono)',
                            fontSize: 11.5,
                            color: 'var(--ax-text-secondary)',
                          }}
                        >
                          {stage.index} · {stage.id}
                        </span>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: 11.5,
                            fontWeight: 500,
                            color: 'var(--ax-ink-muted-80)',
                          }}
                        >
                          <span
                            aria-hidden="true"
                            style={{
                              width: 7,
                              height: 7,
                              borderRadius: '50%',
                              background: stage.dotColor,
                            }}
                          />
                          {stage.worldBadge}
                        </span>
                      </div>

                      <div
                        style={{
                          fontSize: 16.5,
                          fontWeight: 600,
                          color: 'var(--ax-ink)',
                          lineHeight: 1.35,
                          letterSpacing: '-0.015em',
                        }}
                      >
                        {stageName}
                      </div>

                      <div
                        style={{
                          fontSize: 12.5,
                          color: 'var(--ax-text-secondary)',
                          marginTop: 6,
                          lineHeight: 1.5,
                        }}
                      >
                        {stageWeight} · {stageTheory}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Right LIVE Preview Canvas (62%) */}
            <div
              style={{
                padding: '26px 28px',
                background: 'var(--ax-surface)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}
            >
              {activeStage === 'research_interview' && (
                <div
                  style={{
                    background: '#08090a',
                    border: '1px solid #23252a',
                    borderRadius: 8,
                    padding: '26px 26px 24px',
                    color: '#f7f8f8',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 18,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--ax-font-mono)',
                        fontSize: 11,
                        color: '#9ba1ae',
                        letterSpacing: '0.03em',
                      }}
                    >
                      01 / LINEAR · OBSIDIAN INSTRUMENT
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--ax-font-mono)',
                        fontSize: 11,
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: '#141516',
                        border: '1px solid #23252a',
                        color: '#d0d6e0',
                      }}
                    >
                      research_interview
                    </span>
                  </div>

                  <div>
                    <h3
                      style={{
                        margin: 0,
                        fontFamily:
                          "'Linear Display', 'Inter', system-ui, -apple-system, 'Noto Sans CJK SC', sans-serif",
                        fontSize: 22,
                        fontWeight: 600,
                        letterSpacing: '-0.02em',
                        color: '#f7f8f8',
                        lineHeight: 1.3,
                      }}
                    >
                      {selectedName}
                    </h3>
                    <p
                      style={{
                        margin: '10px 0 0',
                        fontSize: 13.5,
                        lineHeight: 1.65,
                        color: '#9ba1ae',
                      }}
                    >
                      理论依据：{selectedTheory}。{selectedDesc}
                    </p>
                  </div>

                  <div
                    style={{
                      background: '#0f1011',
                      border: '1px solid #23252a',
                      borderRadius: 6,
                      padding: 14,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: 'var(--ax-font-mono)',
                        fontSize: 10.5,
                        color: '#9ba1ae',
                        marginBottom: 10,
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>SYNCHRONIZED EVIDENCE CHANNELS</span>
                      <span>3 TRACKS ACTIVE</span>
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))',
                        gap: 10,
                      }}
                    >
                      {[
                        { tag: 'VOICE', color: '#9da7ff', title: '语音声学通道', sub: '语速节律与停顿分布' },
                        { tag: 'FACE-3D', color: '#4ade80', title: '面部动作通道', sub: '三维头部姿态与表情单元' },
                        { tag: 'POSE', color: '#d0d6e0', title: '上肢姿态通道', sub: '手势幅度与肩臂稳定性' },
                      ].map((track) => (
                        <div
                          key={track.tag}
                          style={{
                            background: '#141516',
                            border: '1px solid #23252a',
                            borderRadius: 5,
                            padding: '10px 12px',
                          }}
                        >
                          <div style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 10.5, color: track.color }}>
                            {track.tag}
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#f7f8f8', marginTop: 4 }}>
                            {track.title}
                          </div>
                          <div style={{ fontSize: 11.5, color: '#9ba1ae', marginTop: 3 }}>{track.sub}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 12,
                      paddingTop: 4,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                      <button
                        type="button"
                        onClick={() => navigate(selectedRoute)}
                        style={{
                          height: 38,
                          padding: '0 16px',
                          borderRadius: 6,
                          background: '#5e6ad2',
                          color: '#ffffff',
                          border: 'none',
                          fontSize: 13.5,
                          fontWeight: 500,
                          cursor: 'pointer',
                        }}
                      >
                        进入研思循证工作台 →
                      </button>

                      {[
                        { label: '科研采录 ›', to: '/research' },
                        { label: '答辩采录 ›', to: '/interview' },
                        { label: '多场对比 ›', to: '/compare' },
                      ].map((sub) => (
                        <button
                          key={sub.to}
                          type="button"
                          onClick={() => navigate(sub.to)}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: '4px 6px',
                            color: '#d0d6e0',
                            fontSize: 12.5,
                            cursor: 'pointer',
                          }}
                        >
                          {sub.label}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => setMode('linear', true)}
                      style={{
                        height: 34,
                        padding: '0 12px',
                        borderRadius: 6,
                        background: '#141516',
                        border: '1px solid #2d3038',
                        color: '#f7f8f8',
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                    >
                      切换全站为 Linear 预览
                    </button>
                  </div>
                </div>
              )}

              {activeStage === 'ai_metacognition' && (
                <div
                  style={{
                    background: '#faf9f5',
                    border: '1px solid #e6dfd8',
                    borderRadius: 12,
                    padding: '26px 26px 24px',
                    color: '#141413',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 18,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--ax-font-mono)',
                        fontSize: 11,
                        color: '#5e5c57',
                        letterSpacing: '0.03em',
                      }}
                    >
                      02 / CLAUDE · EDITORIAL STUDIO
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--ax-font-mono)',
                        fontSize: 11,
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: '#f5f0e8',
                        border: '1px solid #e6dfd8',
                        color: '#3d3d3a',
                      }}
                    >
                      ai_metacognition
                    </span>
                  </div>

                  <div>
                    <h3
                      style={{
                        margin: 0,
                        fontFamily: 'var(--ax-font-serif)',
                        fontSize: 24,
                        fontWeight: 400,
                        letterSpacing: '-0.02em',
                        color: '#141413',
                        lineHeight: 1.28,
                      }}
                    >
                      {selectedName}
                    </h3>
                    <p
                      style={{
                        margin: '10px 0 0',
                        fontSize: 14,
                        lineHeight: 1.7,
                        color: '#3d3d3a',
                      }}
                    >
                      理论依据：{selectedTheory}。{selectedDesc}
                    </p>
                  </div>

                  <div
                    style={{
                      background: '#181715',
                      borderRadius: 8,
                      padding: '16px 18px',
                      color: '#faf9f5',
                    }}
                  >
                    <div
                      style={{
                        fontFamily: 'var(--ax-font-mono)',
                        fontSize: 10.5,
                        color: '#e69d83',
                        marginBottom: 10,
                      }}
                    >
                      THREE-STAGE CRITIQUE WORKFLOW · 三阶段审辨流程
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                        gap: 10,
                      }}
                    >
                      {[
                        { step: '01 · 阅读 AI 回答', desc: '审视模型论据与隐含前提' },
                        { step: '02 · 指出漏洞', desc: '标注逻辑断点与主动封停项' },
                        { step: '03 · 口头修正', desc: '语音重述并核验反驳依据' },
                      ].map((stageItem) => (
                        <div
                          key={stageItem.step}
                          style={{
                            background: '#252320',
                            border: '1px solid #35322d',
                            borderRadius: 6,
                            padding: '10px 12px',
                          }}
                        >
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#faf9f5' }}>
                            {stageItem.step}
                          </div>
                          <div style={{ fontSize: 12, color: '#d2cbc0', marginTop: 4, lineHeight: 1.45 }}>
                            {stageItem.desc}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 12,
                      paddingTop: 4,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                      <button
                        type="button"
                        onClick={() => navigate(selectedRoute)}
                        style={{
                          height: 38,
                          padding: '0 18px',
                          borderRadius: 8,
                          background: '#a34f33',
                          color: '#ffffff',
                          border: 'none',
                          fontSize: 13.5,
                          fontWeight: 500,
                          cursor: 'pointer',
                        }}
                      >
                        进入元智审辨实训 →
                      </button>

                      {[
                        { label: '岗位对照 ›', to: '/career-mcp' },
                        { label: 'AI 审辨实训 ›', to: '/metacognition' },
                      ].map((sub) => (
                        <button
                          key={sub.to}
                          type="button"
                          onClick={() => navigate(sub.to)}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: '4px 6px',
                            color: '#8d4026',
                            fontSize: 13,
                            fontWeight: 500,
                            cursor: 'pointer',
                          }}
                        >
                          {sub.label}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => setMode('claude', true)}
                      style={{
                        height: 34,
                        padding: '0 12px',
                        borderRadius: 8,
                        background: '#ffffff',
                        border: '1px solid #cfc5b8',
                        color: '#141413',
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                    >
                      切换全站为 Claude 预览
                    </button>
                  </div>
                </div>
              )}

              {activeStage === 'longitudinal_followup' && (
                <div
                  style={{
                    background: '#f7f1e8',
                    border: '1px solid #e1dcd3',
                    borderRadius: 14,
                    overflow: 'hidden',
                    color: '#1c1b1a',
                  }}
                >
                  <div
                    style={{
                      background: '#224228',
                      padding: '18px 24px 20px',
                      color: '#f7f1e8',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 10,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'var(--ax-font-mono)',
                          fontSize: 11,
                          color: '#ced4b8',
                          letterSpacing: '0.03em',
                        }}
                      >
                        03 / OURA · IDIOGRAPHIC LONGITUDINAL
                      </span>
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 500,
                          padding: '2px 10px',
                          borderRadius: 9999,
                          background: 'rgba(247, 241, 232, 0.14)',
                          border: '1px solid rgba(206, 212, 184, 0.35)',
                          color: '#ffffff',
                        }}
                      >
                        零原始影像与零原声落盘 · 非医疗
                      </span>
                    </div>

                    <h3
                      style={{
                        margin: '10px 0 0',
                        fontFamily: 'var(--ax-font-serif)',
                        fontSize: 23,
                        fontWeight: 300,
                        color: '#ffffff',
                        lineHeight: 1.3,
                      }}
                    >
                      {selectedName}
                    </h3>
                  </div>

                  <div
                    style={{
                      padding: '20px 24px 24px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 16,
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: 13.5,
                        lineHeight: 1.65,
                        color: '#4a4741',
                      }}
                    >
                      理论依据：{selectedTheory}。{selectedDesc}
                    </p>

                    <div
                      style={{
                        background: '#ffffff',
                        border: '1px solid #e1dcd3',
                        borderRadius: 12,
                        padding: '12px 16px',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: 8,
                          fontSize: 11.5,
                          color: '#5b5851',
                        }}
                      >
                        <span style={{ fontWeight: 600, color: '#224228' }}>
                          个体自基线纵向轨迹示意（遇缺口显式断线）
                        </span>
                        <span style={{ fontFamily: 'var(--ax-font-mono)' }}>SELF-BASELINE</span>
                      </div>

                      <svg
                        aria-label="匿名个体纵向随访折线示意图：T3采样缺口处显式断线"
                        viewBox="0 0 420 76"
                        width="100%"
                        height="76"
                        style={{ display: 'block' }}
                      >
                        <rect x="16" y="24" width="388" height="28" rx="4" fill="#ced4b8" fillOpacity="0.32" />
                        <line x1="16" y1="38" x2="404" y2="38" stroke="#738762" strokeDasharray="3 3" strokeWidth="1" />

                        <path d="M 36 44 L 122 33" stroke="#224228" strokeWidth="2.2" fill="none" />
                        <circle cx="36" cy="44" r="4.5" fill="#224228" stroke="#ffffff" strokeWidth="1.5" />
                        <circle cx="122" cy="33" r="4.5" fill="#224228" stroke="#ffffff" strokeWidth="1.5" />

                        <circle cx="210" cy="38" r="4.5" fill="#ffffff" stroke="#8f5c0f" strokeWidth="1.8" strokeDasharray="2 2" />
                        <text x="210" y="66" textAnchor="middle" fontSize="10" fill="#8f5c0f">
                          T3 缺口断线
                        </text>

                        <path d="M 298 30 L 384 36" stroke="#224228" strokeWidth="2.2" fill="none" />
                        <circle cx="298" cy="30" r="4.5" fill="#224228" stroke="#ffffff" strokeWidth="1.5" />
                        <circle cx="384" cy="36" r="4.5" fill="#224228" stroke="#ffffff" strokeWidth="1.5" />

                        <text x="36" y="66" textAnchor="middle" fontSize="10" fill="#5b5851">
                          T1
                        </text>
                        <text x="122" y="66" textAnchor="middle" fontSize="10" fill="#5b5851">
                          T2
                        </text>
                        <text x="298" y="66" textAnchor="middle" fontSize="10" fill="#5b5851">
                          T4
                        </text>
                        <text x="384" y="66" textAnchor="middle" fontSize="10" fill="#5b5851">
                          T5
                        </text>
                      </svg>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 12,
                        paddingTop: 2,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                        <button
                          type="button"
                          onClick={() => navigate(selectedRoute)}
                          style={{
                            height: 38,
                            padding: '0 20px',
                            borderRadius: 9999,
                            background: '#2264ca',
                            color: '#ffffff',
                            border: 'none',
                            fontSize: 13.5,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          进入时序观微档案 →
                        </button>

                        {[
                          { label: '随访档案 ›', to: '/followup' },
                          { label: '无影像采录 ›', to: '/followup/capture' },
                        ].map((sub) => (
                          <button
                            key={sub.to}
                            type="button"
                            onClick={() => navigate(sub.to)}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: '4px 6px',
                              color: '#224228',
                              fontSize: 13,
                              fontWeight: 500,
                              cursor: 'pointer',
                            }}
                          >
                            {sub.label}
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => setMode('oura', true)}
                        style={{
                          height: 34,
                          padding: '0 14px',
                          borderRadius: 9999,
                          background: '#ffffff',
                          border: '1px solid #c8c1b5',
                          color: '#1c1b1a',
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: 'pointer',
                        }}
                      >
                        切换全站为 Oura 预览
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ══ Row 3 · 4-Column Architectural Utility Index Strip ═════════════════ */}
        <section
          aria-label="共享报告与工具索引"
          style={{
            borderTop: '1px solid var(--ax-hairline)',
            position: 'relative',
          }}
        >
          <GridCrosshair style={{ top: -5, left: -5 }} />
          <GridCrosshair style={{ top: -5, right: -5 }} />

          <div className="jx-portal-utility-grid">
            {UTILITY_COLUMNS.map((col) => (
              <div
                key={col.code}
                style={{
                  background: 'var(--ax-surface)',
                  padding: '24px 24px 26px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 16,
                }}
              >
                <div>
                  <div
                    style={{
                      fontFamily: 'var(--ax-font-mono)',
                      fontSize: 11.5,
                      color: 'var(--ax-text-secondary)',
                      marginBottom: 8,
                    }}
                  >
                    {col.code}
                  </div>
                  <h3
                    style={{
                      margin: '0 0 8px',
                      fontSize: 16.5,
                      fontWeight: 600,
                      color: 'var(--ax-ink)',
                    }}
                  >
                    {col.title}
                  </h3>
                  <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: 'var(--ax-ink-muted-80)' }}>
                    {col.desc}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                  {col.links.map((link) => (
                    <button
                      key={link.to}
                      type="button"
                      onClick={() => navigate(link.to)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: link.primary ? 600 : 500,
                        color: link.primary ? 'var(--ax-ink)' : 'var(--ax-text-secondary)',
                      }}
                    >
                      {link.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ══ 运行状态与通道诊断抽屉 ════════════════════════════════════════════ */}
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
            <Button
              icon={<ArrowRightOutlined />}
              onClick={() => {
                setDiagOpen(false);
                navigate('/analysis');
              }}
            >
              前往实时监测台
            </Button>
            <Button
              icon={<BookOutlined />}
              onClick={() => {
                setDiagOpen(false);
                navigate('/export');
              }}
            >
              前往数据导出
            </Button>
          </Space>
        </Space>
      </Drawer>
    </main>
  );
};

export default Home;
