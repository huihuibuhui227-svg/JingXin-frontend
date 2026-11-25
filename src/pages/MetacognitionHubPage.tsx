import React, { useEffect, useState } from 'react';
import { ArrowRightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import ModuleSubnav from '@/components/common/ModuleSubnav';
import {
  sceneProfilesApi,
  SceneProfileDescriptor,
  SceneProfileTheoreticalFoundation,
} from '@/services/api';

const FALLBACK_FOUNDATION: Required<SceneProfileTheoreticalFoundation> = {
  framework: '自我调节学习与生成式 AI 元认知校准框架（Self-Regulated Learning & AI Metacognition）',
  core_principle:
    '围绕计划监控、核验判断与反思修正三环调控过程，客观统计审辨文本中的质疑边界标记、信息核验依据及多环节调控覆盖度。',
  key_constructs: ['质疑边界标记密度', '信息核验标记密度', '三环调控覆盖度', '结构化修正表达'],
  references: [
    'Zimmerman (2000), Attaining Self-Regulation: A Social Cognitive Perspective, Handbook of Self-Regulation',
    'Tankelevitch et al. (2024), The Metacognitive Demands and Opportunities of Generative AI, ACM CHI',
    'Schraw & Dennison (1994), Assessing Metacognitive Awareness, Contemporary Educational Psychology',
  ],
};

const FALLBACK_COMPLIANCE =
  '仅核查岗位行为证据覆盖情况与待补录缺口，不出具岗位匹配分数、排名或筛选建议。';

const FALLBACK_BLOCKED = [
  {
    key: 'job_fit_score',
    label: '岗位契合度打分与筛选结论',
    reason: '实训对比旨在定位表达与审辨证据缺口，不构成人岗筛选决策。',
  },
  {
    key: 'hard_skill_exam',
    label: '闭卷编码与专业硬技能替代评价',
    reason: '口头表达过程观测不可替代实际代码实现与专业工程考核。',
  },
];

const CRITIQUE_STAGES = [
  {
    step: '01',
    title: '阅读 AI 回答',
    detail: '识别看似流畅的假设与缺失前提',
  },
  {
    step: '02',
    title: '审辨定位漏洞',
    detail: '统计「前提质疑」与「信息核验」口头线索',
  },
  {
    step: '03',
    title: '口头阐述修正',
    detail: '观察方案修正锚点与三环调控完整度',
  },
];

const MetacognitionHubPage: React.FC = () => {
  const navigate = useNavigate();
  const [liveProfile, setLiveProfile] = useState<SceneProfileDescriptor | null>(null);

  useEffect(() => {
    let active = true;
    sceneProfilesApi
      .get('ai_metacognition')
      .then((res) => {
        if (active && res?.profile) {
          setLiveProfile(res.profile);
        }
      })
      .catch(() => {
        // 服务离线时静默回退至内置档案说明
      });
    return () => {
      active = false;
    };
  }, []);

  const foundation = liveProfile?.theoretical_foundation;
  const framework = foundation?.framework || FALLBACK_FOUNDATION.framework;
  const corePrinciple = foundation?.core_principle || FALLBACK_FOUNDATION.core_principle;
  const constructs =
    foundation?.key_constructs && foundation.key_constructs.length > 0
      ? foundation.key_constructs
      : FALLBACK_FOUNDATION.key_constructs;
  const references =
    foundation?.references && foundation.references.length > 0
      ? foundation.references
      : FALLBACK_FOUNDATION.references;
  const complianceBanner = liveProfile?.compliance_banner || FALLBACK_COMPLIANCE;
  const blockedItems =
    liveProfile?.explicit_blocked_overrides && liveProfile.explicit_blocked_overrides.length > 0
      ? liveProfile.explicit_blocked_overrides
      : FALLBACK_BLOCKED;
  const heroProse =
    liveProfile?.description ||
    '面对生成式 AI 的流畅陈述，真正决定专业判断质量的，是能否辨识隐含假设、核验证据出处并在表达中提出可执行的修正路径。这里将真实校招与科研助理岗位要求拆解为可观测行为线索，并与三阶段审辨实训自然衔接。';

  return (
    <main style={{ background: 'var(--ax-canvas)', color: 'var(--ax-ink)' }}>
      <style>{`
        .ax-claude-split {
          display: grid;
          grid-template-columns: minmax(0, 1.08fr) minmax(0, 1fr);
          gap: 44px;
          align-items: center;
        }
        .ax-claude-dual {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 24px;
        }
        .ax-claude-footer-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
          gap: 32px;
          align-items: start;
        }
        .ax-claude-studio-card {
          transition: border-color 160ms ease, transform 160ms ease;
        }
        .ax-claude-studio-card:hover {
          border-color: #cfc5b8;
          transform: translateY(-2px);
        }
        @media (max-width: 900px) {
          .ax-claude-split,
          .ax-claude-dual,
          .ax-claude-footer-grid {
            grid-template-columns: 1fr;
            gap: 24px;
          }
        }
      `}</style>

      <ModuleSubnav
        world="claude"
        moduleTitle="02 / 元智审辨"
        items={[
          { to: '/hub/metacognition', label: '场景概览' },
          { to: '/career-mcp', label: '岗位对照' },
          { to: '/metacognition', label: 'AI 审辨实训' },
        ]}
      />

      {/* Warm Ivory Editorial Split Hero */}
      <section
        aria-label="元智审辨场景概览"
        style={{
          background: 'var(--ax-canvas)',
          padding: '56px 24px 64px',
        }}
      >
        <div style={{ maxWidth: 1120, margin: '0 auto' }} className="ax-claude-split">
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 18,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  color: '#cc785c',
                  fontSize: 15,
                  lineHeight: 1,
                }}
              >
                ✦
              </span>
              <span
                style={{
                  fontFamily: 'var(--ax-font-text)',
                  fontSize: 13,
                  fontWeight: 500,
                  color: '#8d4026',
                  letterSpacing: '0.02em',
                }}
              >
                AI 元能力与职业实训
              </span>
            </div>

            <h1
              style={{
                margin: 0,
                fontFamily: 'var(--ax-font-display)',
                fontWeight: 400,
                fontSize: 'clamp(30px, 3.6vw, 40px)',
                lineHeight: 1.16,
                letterSpacing: '-0.02em',
                color: 'var(--ax-ink)',
              }}
            >
              元智审辨 · 让人机协同过程清晰可循
            </h1>

            <p
              style={{
                margin: '20px 0 28px',
                fontFamily: 'var(--ax-font-text)',
                fontSize: 16,
                lineHeight: 1.72,
                color: 'var(--ax-ink-muted-80)',
                maxWidth: 540,
              }}
            >
              {heroProse}
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => navigate('/career-mcp')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  height: 42,
                  padding: '0 20px',
                  borderRadius: 8,
                  border: '1px solid #a34f33',
                  background: '#a34f33',
                  color: '#ffffff',
                  fontFamily: 'var(--ax-font-text)',
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                <span>进入岗位能力对照</span>
                <ArrowRightOutlined style={{ fontSize: 12 }} />
              </button>

              <button
                type="button"
                onClick={() => navigate('/metacognition')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  height: 42,
                  padding: '0 20px',
                  borderRadius: 8,
                  border: '1px solid var(--ax-border-strong)',
                  background: 'var(--ax-canvas)',
                  color: 'var(--ax-ink)',
                  fontFamily: 'var(--ax-font-text)',
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                <span>进入 AI 审辨三阶段实训</span>
              </button>
            </div>
          </div>

          {/* Signature Anthropic Dark Charcoal Critique Showcase Panel */}
          <aside
            aria-label="三阶段审辨实训闭环展示"
            style={{
              background: '#181715',
              color: '#faf9f5',
              borderRadius: 12,
              padding: '26px 28px',
              border: '1px solid #2d2a26',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                paddingBottom: 14,
                borderBottom: '1px solid #2d2a26',
                marginBottom: 18,
              }}
            >
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: '#5db8a6',
                    display: 'inline-block',
                  }}
                />
                <span
                  style={{
                    fontFamily: 'var(--ax-font-mono)',
                    fontSize: 12,
                    color: '#d2cbc0',
                    letterSpacing: '0.04em',
                  }}
                >
                  METACOGNITIVE CRITIQUE · 3 STAGES
                </span>
              </div>
              <span
                style={{
                  fontFamily: 'var(--ax-font-text)',
                  fontSize: 12,
                  color: '#d2cbc0',
                }}
              >
                口头审辨实测
              </span>
            </div>

            <div style={{ display: 'grid', gap: 14 }}>
              {CRITIQUE_STAGES.map((stage, idx) => (
                <div
                  key={stage.step}
                  style={{
                    paddingBottom: idx < CRITIQUE_STAGES.length - 1 ? 14 : 0,
                    borderBottom: idx < CRITIQUE_STAGES.length - 1 ? '1px solid #252320' : 'none',
                    display: 'grid',
                    gridTemplateColumns: '34px minmax(0, 1fr)',
                    gap: 12,
                    alignItems: 'start',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--ax-font-mono)',
                      fontSize: 13,
                      fontWeight: 500,
                      color: '#e69d83',
                      paddingTop: 2,
                    }}
                  >
                    {stage.step}
                  </span>
                  <div>
                    <div
                      style={{
                        fontFamily: 'var(--ax-font-text)',
                        fontSize: 15.5,
                        fontWeight: 500,
                        color: '#faf9f5',
                        lineHeight: 1.4,
                      }}
                    >
                      {stage.title}
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--ax-font-text)',
                        fontSize: 13.5,
                        color: '#d2cbc0',
                        lineHeight: 1.55,
                        marginTop: 3,
                      }}
                    >
                      {stage.detail}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                marginTop: 20,
                background: '#1f1e1b',
                border: '1px solid #2d2a26',
                borderRadius: 8,
                padding: '12px 14px',
                fontSize: 13,
                lineHeight: 1.6,
                color: '#d2cbc0',
              }}
            >
              仅定位行为线索与证据缺口，不出具人岗匹配分值、评级划档或录用筛选结论。
            </div>
          </aside>
        </div>
      </section>

      {/* Warm Cream Dual Studio Cards Band */}
      <section
        aria-label="双工作台入口"
        style={{
          background: 'var(--ax-parchment)',
          borderTop: '1px solid var(--ax-hairline)',
          borderBottom: '1px solid var(--ax-hairline)',
          padding: '48px 24px',
        }}
      >
        <div style={{ maxWidth: 1120, margin: '0 auto' }} className="ax-claude-dual">
          <button
            type="button"
            onClick={() => navigate('/career-mcp')}
            className="ax-claude-studio-card"
            style={{
              textAlign: 'left',
              background: '#ffffff',
              border: '1px solid var(--ax-hairline)',
              borderRadius: 12,
              padding: '30px 32px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: 24,
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: 'var(--ax-font-mono)',
                  fontSize: 11.5,
                  letterSpacing: '0.08em',
                  color: '#8d4026',
                  marginBottom: 10,
                }}
              >
                01 · ROLE EVIDENCE ALIGNMENT
              </div>
              <h2
                style={{
                  margin: '0 0 10px',
                  fontFamily: 'var(--ax-font-display)',
                  fontWeight: 400,
                  fontSize: 24,
                  lineHeight: 1.25,
                  letterSpacing: '-0.01em',
                  color: 'var(--ax-ink)',
                }}
              >
                岗位能力画像与证据对照
              </h2>
              <p
                style={{
                  margin: 0,
                  fontFamily: 'var(--ax-font-text)',
                  fontSize: 14.5,
                  lineHeight: 1.7,
                  color: 'var(--ax-ink-muted-80)',
                }}
              >
                检索内置校招与科研助理岗位画像，或粘贴自定义岗位说明，将岗位要求拆解为可观测行为线索与待补录缺口，并明确封停需线下实操核验的硬技能。
              </p>
            </div>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontFamily: 'var(--ax-font-text)',
                fontSize: 14,
                fontWeight: 500,
                color: '#8d4026',
              }}
            >
              <span>打开岗位对照工作台</span>
              <ArrowRightOutlined style={{ fontSize: 12 }} />
            </span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/metacognition')}
            className="ax-claude-studio-card"
            style={{
              textAlign: 'left',
              background: '#efe9de',
              border: '1px solid var(--ax-hairline)',
              borderRadius: 12,
              padding: '30px 32px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: 24,
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: 'var(--ax-font-mono)',
                  fontSize: 11.5,
                  letterSpacing: '0.08em',
                  color: '#8d4026',
                  marginBottom: 10,
                }}
              >
                02 · THREE-STAGE CRITIQUE LOOP
              </div>
              <h2
                style={{
                  margin: '0 0 10px',
                  fontFamily: 'var(--ax-font-display)',
                  fontWeight: 400,
                  fontSize: 24,
                  lineHeight: 1.25,
                  letterSpacing: '-0.01em',
                  color: 'var(--ax-ink)',
                }}
              >
                AI 审辨三阶段实训
              </h2>
              <p
                style={{
                  margin: 0,
                  fontFamily: 'var(--ax-font-text)',
                  fontSize: 14.5,
                  lineHeight: 1.7,
                  color: 'var(--ax-ink-muted-80)',
                }}
              >
                围绕生成式 AI 输出开展「阅读回答 → 定位逻辑漏洞与前提假设 → 口头阐述修正」三阶段演练，自动追踪计划监控、核验判断与反思修正三环调控覆盖情况。
              </p>
            </div>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontFamily: 'var(--ax-font-text)',
                fontSize: 14,
                fontWeight: 500,
                color: '#8d4026',
              }}
            >
              <span>进入审辨实训采录</span>
              <ArrowRightOutlined style={{ fontSize: 12 }} />
            </span>
          </button>
        </div>
      </section>

      {/* Bottom Quiet Editorial Strip: Reports + Theory & Non-Scoring Boundary */}
      <section
        aria-label="实训报告与理论边界说明"
        style={{
          background: 'var(--ax-canvas)',
          padding: '44px 24px 72px',
        }}
      >
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              padding: '20px 24px',
              background: '#ffffff',
              border: '1px solid var(--ax-hairline)',
              borderRadius: 12,
              marginBottom: 36,
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: 'var(--ax-font-display)',
                  fontWeight: 400,
                  fontSize: 20,
                  color: 'var(--ax-ink)',
                }}
              >
                实训证据报告查看
              </div>
              <div
                style={{
                  fontFamily: 'var(--ax-font-text)',
                  fontSize: 14,
                  color: 'var(--ax-text-secondary)',
                  marginTop: 4,
                }}
              >
                打开历史行为证据披露报告并切换「元智审辨」视角，阅读人机审辨过程总结与追问提纲。
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/reports')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                height: 38,
                padding: '0 16px',
                borderRadius: 8,
                border: '1px solid var(--ax-border-strong)',
                background: 'var(--ax-canvas)',
                color: 'var(--ax-ink)',
                fontFamily: 'var(--ax-font-text)',
                fontSize: 13.5,
                fontWeight: 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <span>前往报告中心</span>
              <ArrowRightOutlined style={{ fontSize: 11 }} />
            </button>
          </div>

          <div className="ax-claude-footer-grid">
            <div>
              <div
                style={{
                  fontFamily: 'var(--ax-font-mono)',
                  fontSize: 11.5,
                  letterSpacing: '0.06em',
                  color: '#8d4026',
                  marginBottom: 8,
                }}
              >
                THEORY & CONSTRUCTS
              </div>
              <h3
                style={{
                  margin: '0 0 8px',
                  fontFamily: 'var(--ax-font-display)',
                  fontWeight: 400,
                  fontSize: 20,
                  color: 'var(--ax-ink)',
                }}
              >
                {framework}
              </h3>
              <p
                style={{
                  margin: '0 0 16px',
                  fontFamily: 'var(--ax-font-text)',
                  fontSize: 14,
                  lineHeight: 1.72,
                  color: 'var(--ax-text-secondary)',
                }}
              >
                {corePrinciple}
              </p>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
                {constructs.map((c) => (
                  <span
                    key={c}
                    style={{
                      padding: '4px 12px',
                      borderRadius: 9999,
                      background: '#efe9de',
                      border: '1px solid var(--ax-hairline)',
                      color: '#3d3d3a',
                      fontSize: 12.5,
                      fontWeight: 500,
                    }}
                  >
                    {c}
                  </span>
                ))}
              </div>

              <ul
                style={{
                  margin: 0,
                  paddingLeft: 18,
                  fontSize: 13,
                  lineHeight: 1.75,
                  color: 'var(--ax-text-secondary)',
                }}
              >
                {references.map((ref) => (
                  <li key={ref}>{ref}</li>
                ))}
              </ul>
            </div>

            <div
              style={{
                background: '#f5f0e8',
                border: '1px solid var(--ax-hairline)',
                borderRadius: 12,
                padding: '22px 24px',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--ax-font-mono)',
                  fontSize: 11.5,
                  letterSpacing: '0.06em',
                  color: '#8d4026',
                  marginBottom: 8,
                }}
              >
                NON-SCORING BOUNDARY
              </div>
              <h3
                style={{
                  margin: '0 0 8px',
                  fontFamily: 'var(--ax-font-display)',
                  fontWeight: 400,
                  fontSize: 18,
                  color: 'var(--ax-ink)',
                }}
              >
                非评分边界与主动封停说明
              </h3>
              <p
                style={{
                  margin: '0 0 14px',
                  fontSize: 13.5,
                  lineHeight: 1.65,
                  color: 'var(--ax-ink-muted-80)',
                }}
              >
                {complianceBanner}
              </p>

              <div style={{ display: 'grid', gap: 10 }}>
                {blockedItems.map((item) => (
                  <div
                    key={item.key}
                    style={{
                      background: 'var(--ax-canvas)',
                      border: '1px solid var(--ax-hairline)',
                      borderLeft: '3px solid #cc785c',
                      borderRadius: 8,
                      padding: '10px 14px',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#8d4026' }}>
                      主动封停边界 · {item.label}
                    </div>
                    <div
                      style={{
                        fontSize: 12.5,
                        lineHeight: 1.55,
                        color: 'var(--ax-text-secondary)',
                        marginTop: 3,
                      }}
                    >
                      {item.reason}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default MetacognitionHubPage;
