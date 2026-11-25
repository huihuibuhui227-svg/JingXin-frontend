import React, { useEffect, useState } from 'react';
import { ArrowRightOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import ModuleSubnav from '@/components/common/ModuleSubnav';
import {
  sceneProfilesApi,
  SceneProfileDescriptor,
  SceneProfileTheoreticalFoundation,
} from '@/services/api';

const FALLBACK_FOUNDATION: Required<SceneProfileTheoreticalFoundation> = {
  framework: '个体特异纵向科学范式与稳健趋势监控（Idiographic N-of-1 & Robust EWMA Control）',
  core_principle:
    '以个体首次有效记录作为自我参照基线，结合中位绝对偏差、四分位参考带与指数平滑趋势识别阶段性变化，严格禁止跨个体横向比较。',
  key_constructs: ['个人首访基线偏移', '四分位稳健参考带', '平滑趋势估计', '采录口径代次隔离'],
  references: [
    'Molenaar (2004), A Manifesto on Psychology as Idiographic Science, Measurement',
    'Montgomery (2020), Introduction to Statistical Quality Control (EWMA Monitoring)',
    'Leys et al. (2013), Detecting Outliers: Robust Scale Estimators around the Median, JESP',
  ],
};

const FALLBACK_COMPLIANCE =
  '非医疗科研观测模块 · 绝不做跨人对照或任何健康定性推断，严禁输出临床诊断或标准化常模排名。';

const FALLBACK_BLOCKED = [
  {
    key: 'cross_person_norm',
    label: '跨个体常模对比与百分位排名',
    reason: '不同个体的基线特征不可直接横向相减或排序。',
  },
  {
    key: 'clinical_inference',
    label: '健康状态定性或临床结论推断',
    reason: '本系统不具备医疗器械属性，严禁输出任何临床或健康定性结论。',
  },
];

const RHYTHM_STEPS = [
  {
    index: '01',
    title: '匿名编号建档',
    desc: '以脱敏随访编号组织多次观测序列，不采集姓名、学工号等身份线索。',
  },
  {
    index: '02',
    title: '首访确立个人基线',
    desc: '以同一匿名编号的首次有效记录（t0）作为自我参照原点，不套用跨人常模。',
  },
  {
    index: '03',
    title: '同代次平滑观测',
    desc: '在统一采录口径下计算四分位区间与 EWMA 趋势，遇到缺失项保持断线绝不补零。',
  },
];

const FollowupHubPage: React.FC = () => {
  const navigate = useNavigate();
  const [liveProfile, setLiveProfile] = useState<SceneProfileDescriptor | null>(null);

  useEffect(() => {
    let active = true;
    sceneProfilesApi
      .get('longitudinal_followup')
      .then((res) => {
        if (active && res?.profile) {
          setLiveProfile(res.profile);
        }
      })
      .catch(() => {
        // 离线时静默回退至本地内置档案说明
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
  const complianceText = liveProfile?.compliance_banner || FALLBACK_COMPLIANCE;
  const blockedItems =
    liveProfile?.explicit_blocked_overrides && liveProfile.explicit_blocked_overrides.length > 0
      ? liveProfile.explicit_blocked_overrides
      : FALLBACK_BLOCKED;
  const heroBody =
    liveProfile?.description ||
    '在零原始影像与零原声落盘的匿名隐私保护模式下，所有视频与语音流仅在内存中提炼语速节律与三维头姿标量。每一次随访都只与同一匿名编号下的本人首访基线温和对照，绝不跨人比较。';

  return (
    <main style={{ background: 'var(--ax-canvas)', color: 'var(--ax-ink)' }}>
      <style>{`
        .ax-oura-hero-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
          gap: 44px;
          align-items: center;
        }
        .ax-oura-dual-cards {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 24px;
        }
        .ax-oura-rhythm-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 28px;
        }
        .ax-oura-science-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
          gap: 32px;
          align-items: start;
        }
        .ax-oura-surface-card {
          transition: border-color 180ms ease, transform 180ms ease;
        }
        .ax-oura-surface-card:hover {
          border-color: #224228;
          transform: translateY(-2px);
        }
        @media (max-width: 900px) {
          .ax-oura-hero-grid,
          .ax-oura-dual-cards,
          .ax-oura-rhythm-grid,
          .ax-oura-science-grid {
            grid-template-columns: 1fr;
            gap: 24px;
          }
        }
      `}</style>

      <ModuleSubnav
        world="oura"
        moduleTitle="03 / 时序观微"
        items={[
          { to: '/hub/followup', label: '场景概览' },
          { to: '/followup', label: '匿名随访档案' },
          { to: '/followup/capture', label: '无影像匿名采录' },
        ]}
      />

      {/* Signature Oura Deep Forest Hero Band */}
      <section
        aria-label="时序观微纵览"
        style={{
          background: '#224228',
          color: '#f7f1e8',
          padding: '52px 24px',
        }}
      >
        <div style={{ maxWidth: 1120, margin: '0 auto' }} className="ax-oura-hero-grid">
          <div>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '5px 14px',
                borderRadius: 9999,
                background: 'rgba(206, 212, 184, 0.16)',
                border: '1px solid rgba(206, 212, 184, 0.28)',
                color: '#ced4b8',
                fontFamily: 'var(--ax-font-text)',
                fontSize: 12.5,
                fontWeight: 500,
                letterSpacing: '0.03em',
                marginBottom: 20,
              }}
            >
              匿名个体纵向观测 · 非医疗研究模块
            </span>

            <h1
              style={{
                margin: 0,
                fontFamily: 'var(--ax-font-display)',
                fontWeight: 300,
                fontSize: 'clamp(32px, 3.8vw, 42px)',
                lineHeight: 1.16,
                letterSpacing: '-0.01em',
                color: '#f7f1e8',
              }}
            >
              时序观微 · 与自己的首访基线温和对话
            </h1>

            <p
              style={{
                margin: '20px 0 30px',
                fontFamily: 'var(--ax-font-text)',
                fontSize: 16.5,
                lineHeight: 1.75,
                color: '#e9ebe3',
                maxWidth: 590,
              }}
            >
              {heroBody}
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => navigate('/followup')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  height: 44,
                  padding: '0 24px',
                  borderRadius: 9999,
                  border: 'none',
                  background: '#2264ca',
                  color: '#ffffff',
                  fontFamily: 'var(--ax-font-text)',
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <span>查看匿名随访档案</span>
                <ArrowRightOutlined style={{ fontSize: 13 }} />
              </button>

              <button
                type="button"
                onClick={() => navigate('/followup/capture')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  height: 44,
                  padding: '0 22px',
                  borderRadius: 9999,
                  border: '1px solid #ced4b8',
                  background: 'transparent',
                  color: '#f7f1e8',
                  fontFamily: 'var(--ax-font-text)',
                  fontSize: 15,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                <span>发起无影像采录</span>
              </button>
            </div>
          </div>

          {/* Quiet Stylized Organic Baseline Curve SVG */}
          <div
            aria-hidden="true"
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(206, 212, 184, 0.22)',
              borderRadius: 24,
              padding: '24px 22px 18px',
            }}
          >
            <svg viewBox="0 0 380 210" style={{ width: '100%', height: 'auto', display: 'block' }}>
              {/* Soft sage reference ribbon */}
              <path
                d="M 18 76 C 95 66, 175 84, 255 72 C 305 64, 338 70, 362 66 L 362 138 C 332 142, 295 134, 255 140 C 175 152, 95 132, 18 144 Z"
                fill="rgba(132, 150, 113, 0.26)"
              />
              {/* Personal baseline horizon */}
              <line
                x1="18"
                y1="108"
                x2="362"
                y2="108"
                stroke="#ced4b8"
                strokeWidth="1.2"
                strokeDasharray="5 5"
                opacity="0.6"
              />
              {/* Gentle sage observation trace */}
              <path
                d="M 24 118 C 76 132, 118 82, 176 96 C 228 108, 274 128, 356 88"
                fill="none"
                stroke="#849671"
                strokeWidth="2"
                strokeLinecap="round"
                opacity="0.9"
              />
              {/* Warm gold smooth trend curve */}
              <path
                d="M 24 108 C 92 106, 148 92, 206 102 C 266 112, 312 96, 356 92"
                fill="none"
                stroke="#ddbe78"
                strokeWidth="2.6"
                strokeLinecap="round"
              />
              {/* Quiet anchor points without fake values */}
              {[
                { cx: 24, cy: 108 },
                { cx: 106, cy: 100 },
                { cx: 192, cy: 98 },
                { cx: 276, cy: 106 },
                { cx: 356, cy: 92 },
              ].map((pt, idx) => (
                <circle
                  key={idx}
                  cx={pt.cx}
                  cy={pt.cy}
                  r={4.2}
                  fill="#ddbe78"
                  stroke="#224228"
                  strokeWidth={2}
                />
              ))}
            </svg>
            <div
              style={{
                marginTop: 10,
                fontSize: 12.5,
                color: '#ced4b8',
                textAlign: 'center',
                letterSpacing: '0.02em',
              }}
            >
              个人首访基线与稳健参考区间示意 · 仅个体内对照
            </div>
          </div>
        </div>
      </section>

      {/* Warm Linen Dual Organic Surface Cards */}
      <section
        aria-label="匿名随访核心功能"
        style={{
          background: '#f7f1e8',
          padding: '52px 24px 32px',
        }}
      >
        <div style={{ maxWidth: 1120, margin: '0 auto' }} className="ax-oura-dual-cards">
          <button
            type="button"
            onClick={() => navigate('/followup')}
            className="ax-oura-surface-card"
            style={{
              textAlign: 'left',
              background: '#ffffff',
              border: '1px solid #e1dcd3',
              borderRadius: 16,
              padding: '32px 30px',
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
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.09em',
                  color: '#4a5e4b',
                  marginBottom: 10,
                }}
              >
                N-OF-1 ARCHIVE & EWMA
              </div>
              <h2
                style={{
                  margin: '0 0 12px',
                  fontFamily: 'var(--ax-font-display)',
                  fontWeight: 400,
                  fontSize: 26,
                  lineHeight: 1.25,
                  color: '#1c1b1a',
                }}
              >
                匿名随访档案与轨迹
              </h2>
              <p
                style={{
                  margin: 0,
                  fontFamily: 'var(--ax-font-text)',
                  fontSize: 15,
                  lineHeight: 1.72,
                  color: '#4a4741',
                }}
              >
                维护匿名随访编号并挂接多期复测记录，以本人首访基线（t0）及个人四分位区间（P25–P75）为参照，观察 EWMA 平滑趋势与同代次变化轨迹。
              </p>
            </div>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 14.5,
                fontWeight: 600,
                color: '#224228',
              }}
            >
              <span>打开匿名随访档案</span>
              <ArrowRightOutlined style={{ fontSize: 12 }} />
            </span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/followup/capture')}
            className="ax-oura-surface-card"
            style={{
              textAlign: 'left',
              background: '#ffffff',
              border: '1px solid #e1dcd3',
              borderRadius: 16,
              padding: '32px 30px',
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
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.09em',
                  color: '#6b443d',
                  marginBottom: 10,
                }}
              >
                ANONYMOUS KINEMATICS ONLY
              </div>
              <h2
                style={{
                  margin: '0 0 12px',
                  fontFamily: 'var(--ax-font-display)',
                  fontWeight: 400,
                  fontSize: 26,
                  lineHeight: 1.25,
                  color: '#1c1b1a',
                }}
              >
                零原始影像内存采录
              </h2>
              <p
                style={{
                  margin: 0,
                  fontFamily: 'var(--ax-font-text)',
                  fontSize: 15,
                  lineHeight: 1.72,
                  color: '#4a4741',
                }}
              >
                默认锁定最高隐私保护挡位（anonymous_kinematics_only）：仅在内存实时抽取三维姿态与声学标量指标，原始人脸画面与录音文件零落盘。
              </p>
            </div>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 14.5,
                fontWeight: 600,
                color: '#224228',
              }}
            >
              <span>前往无影像采录</span>
              <ArrowRightOutlined style={{ fontSize: 12 }} />
            </span>
          </button>
        </div>
      </section>

      {/* Calm 3-Column Rhythm Strip */}
      <section
        aria-label="纵向随访三步节律"
        style={{
          background: '#f7f1e8',
          padding: '24px 24px 44px',
        }}
      >
        <div
          style={{
            maxWidth: 1120,
            margin: '0 auto',
            paddingTop: 28,
            borderTop: '1px solid #e1dcd3',
          }}
          className="ax-oura-rhythm-grid"
        >
          {RHYTHM_STEPS.map((step) => (
            <div key={step.index}>
              <div
                style={{
                  fontFamily: 'var(--ax-font-display)',
                  fontWeight: 300,
                  fontSize: 28,
                  lineHeight: 1.1,
                  color: '#4a5e4b',
                  marginBottom: 8,
                }}
              >
                {step.index}
              </div>
              <div
                style={{
                  fontFamily: 'var(--ax-font-text)',
                  fontSize: 16,
                  fontWeight: 600,
                  color: '#1c1b1a',
                  marginBottom: 6,
                }}
              >
                {step.title}
              </div>
              <p
                style={{
                  margin: 0,
                  fontFamily: 'var(--ax-font-text)',
                  fontSize: 14,
                  lineHeight: 1.65,
                  color: '#5b5851',
                }}
              >
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Warm Stone Privacy & Science Footer Section */}
      <section
        aria-label="科学范式与非医疗合规声明"
        style={{
          background: '#f0e9dd',
          borderTop: '1px solid #e1dcd3',
          padding: '44px 24px 64px',
        }}
      >
        <div style={{ maxWidth: 1120, margin: '0 auto' }} className="ax-oura-science-grid">
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.09em',
                color: '#4a4741',
                marginBottom: 8,
              }}
            >
              SCIENTIFIC FOUNDATION
            </div>
            <h3
              style={{
                margin: '0 0 10px',
                fontFamily: 'var(--ax-font-display)',
                fontWeight: 400,
                fontSize: 22,
                color: '#1c1b1a',
              }}
            >
              {framework}
            </h3>
            <p
              style={{
                margin: '0 0 16px',
                fontSize: 14.5,
                lineHeight: 1.72,
                color: '#4a4741',
              }}
            >
              {corePrinciple}
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
              {constructs.map((c) => (
                <span
                  key={c}
                  style={{
                    padding: '4px 14px',
                    borderRadius: 9999,
                    background: '#ffffff',
                    border: '1px solid #e1dcd3',
                    color: '#224228',
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
                color: '#5b5851',
              }}
            >
              {references.map((ref) => (
                <li key={ref}>{ref}</li>
              ))}
            </ul>
          </div>

          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e1dcd3',
              borderRadius: 16,
              padding: '24px 24px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <SafetyCertificateOutlined style={{ color: '#224228', fontSize: 16 }} />
              <span style={{ fontSize: 15, fontWeight: 600, color: '#1c1b1a' }}>
                隐私保护与非医疗边界红线
              </span>
            </div>

            <p
              style={{
                margin: '0 0 14px',
                fontSize: 13.5,
                lineHeight: 1.68,
                color: '#4a4741',
              }}
            >
              {complianceText} 绝不做跨人对照或任何健康定性推断。
            </p>

            <div style={{ display: 'grid', gap: 10 }}>
              {blockedItems.map((item) => (
                <div
                  key={item.key}
                  style={{
                    background: 'var(--ax-parchment)',
                    border: '1px solid var(--ax-hairline)',
                    borderLeft: '3px solid var(--ax-b3)',
                    borderRadius: 12,
                    padding: '11px 14px',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ax-ink)' }}>
                    隐私边界 · {item.label}
                  </div>
                  <div style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--ax-text-secondary)', marginTop: 3 }}>
                    {item.reason}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default FollowupHubPage;
