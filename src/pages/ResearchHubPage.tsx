import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ModuleSubnav from '@/components/common/ModuleSubnav';
import { sceneProfilesApi, SceneProfileDescriptor } from '@/services/api';
import '@/styles/world-linear.css';

const SUBNAV_ITEMS = [
  { to: '/hub/research', label: '场景概览' },
  { to: '/research', label: '科研采录' },
  { to: '/interview', label: '模拟答辩' },
  { to: '/compare', label: '多场对比' },
];

const FALLBACK_DESC =
  '围绕科研汇报与答辩过程的多模态证据工作台，按作答时间窗同步记录语音韵律、三维面部几何与上肢姿态稳定性；只呈现实测覆盖与缺失原因，绝不出具评分或主观结论。';

const FALLBACK_FOUNDATION = {
  framework: '社会信号处理与过程性表现循证框架（Social Signal Processing & Process Evidence）',
  core_principle:
    '仅报告在真实作答时间窗内采得的行为指标与样本覆盖情况，明确披露每一项未测得原因，绝不产出综合评分或主观能力结论。',
  key_constructs: ['回答响应时延', '语速与停顿节律', '面部动作几何变化', '上肢姿态稳定性'],
  references: [
    'Vinciarelli et al. (2009), Social Signal Processing: Survey of an Emerging Domain, Image and Vision Computing',
    'Muralidhar et al. (2016), Behavioral Analysis of Structured Interviews, ACM ICMI',
    'Vovk et al. (2005), Algorithmic Learning in a Random World (Conformal Uncertainty)',
  ],
};

const FALLBACK_COMPLIANCE =
  '复用多模态客观行为指标与保形核验门控，绝不出具总分、划档或主观品格推断。';

const FALLBACK_BLOCKED: Array<{ key: string; label: string; reason: string }> = [
  {
    key: 'overall_score',
    label: '综合能力总分与等级划分',
    reason: '过程性采录不构成标准化常模测验，禁止输出总分或排序标签。',
  },
  {
    key: 'affect_diagnosis',
    label: '情绪或心理状态定性结论',
    reason: '声学与几何行为信号不等同于内在心理或临床诊断。',
  },
];

interface TelemetrySpecRow {
  label: string;
  spec: string;
  tag: string;
}

const TELEMETRY_ROWS: TelemetrySpecRow[] = [
  {
    label: '语音韵律窗口',
    spec: '对齐逐题作答起止边界，提取有效发声占比、语速与停顿分布',
    tag: 'WINDOW · 01',
  },
  {
    label: '三维面部几何',
    spec: '追踪头部偏转角与面部几何位移，缺乏真实三维矩阵时显式标记降级',
    tag: '3D MATRIX',
  },
  {
    label: '上肢姿态稳定',
    spec: '持续监测双肩基线与手势入画范围，遇遮挡保留空值且绝不补零',
    tag: 'GAP-SAFE',
  },
  {
    label: '保形不确定性核验',
    spec: '按覆盖率上限约束置信区间，样本分布偏离时自动升级人工复核',
    tag: 'CONFORMAL',
  },
];

const ResearchHubPage: React.FC = () => {
  const navigate = useNavigate();
  const [liveProfile, setLiveProfile] = useState<SceneProfileDescriptor | null>(null);

  useEffect(() => {
    let active = true;
    sceneProfilesApi
      .get('research_interview')
      .then((res) => {
        if (active && res?.profile) {
          setLiveProfile(res.profile);
        }
      })
      .catch(() => {
        // 离线或服务未启动时静默回退至本地内置档案规约
      });
    return () => {
      active = false;
    };
  }, []);

  const foundation = liveProfile?.theoretical_foundation;
  const displayDesc = liveProfile?.description || FALLBACK_DESC;
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
  const displayCompliance = liveProfile?.compliance_banner || FALLBACK_COMPLIANCE;
  const blockedItems =
    liveProfile?.explicit_blocked_overrides && liveProfile.explicit_blocked_overrides.length > 0
      ? liveProfile.explicit_blocked_overrides
      : FALLBACK_BLOCKED;

  return (
    <main className="ax-linear-hub">
      <ModuleSubnav world="linear" moduleTitle="01 / 研思循证" items={SUBNAV_ITEMS} />

      <div className="ax-linear-hub__inner">
        {/* 左对齐精密仪器顶栏 */}
        <header className="ax-linear-header">
          <div className="ax-linear-eyebrow">
            <span className="ax-linear-eyebrow__dot" aria-hidden="true" />
            <span>LINEAR INSTRUMENT · PROCESS EVIDENCE</span>
          </div>

          <h1 className="ax-linear-h1">研思循证 · 科研行为过程分析</h1>

          <p className="ax-linear-lead">{displayDesc}</p>

          <div className="ax-linear-cta-row">
            <button
              type="button"
              className="ax-linear-btn-primary"
              onClick={() => navigate('/research')}
            >
              开始科研采录
            </button>
            <button
              type="button"
              className="ax-linear-btn-secondary"
              onClick={() => navigate('/interview')}
            >
              模拟答辩采录
            </button>
            <button
              type="button"
              className="ax-linear-btn-ghost"
              onClick={() => navigate('/compare')}
            >
              多场纵向对比 ›
            </button>
          </div>
        </header>

        {/* 非对称 58 / 42 精密工作台栅格 */}
        <section className="ax-linear-bento" aria-label="核心采录与分析工作流">
          {/* 左侧 58% 主流板：同步多模态证据窗口规格 */}
          <article className="ax-linear-panel">
            <div>
              <div className="ax-linear-panel__meta">
                <span className="ax-linear-panel__index">01 · PRIMARY PIPELINE</span>
                <span className="ax-linear-status">
                  <span className="ax-linear-status__dot" aria-hidden="true" />
                  窗口同步就绪
                </span>
              </div>

              <h2 className="ax-linear-panel__title">核心采录流程 · 同步多模态证据窗口</h2>
              <p className="ax-linear-panel__desc">
                围绕课题进展与研究设计逐题作答，在真实作答时间窗内并行采录语音韵律、三维面部几何与上肢姿态，自动沉淀双层可溯源证据报告。
              </p>

              <div className="ax-linear-spec-list" role="list" aria-label="采录通道规格">
                {TELEMETRY_ROWS.map((row) => (
                  <div key={row.label} className="ax-linear-spec-row" role="listitem">
                    <span className="ax-linear-spec-name">{row.label}</span>
                    <span className="ax-linear-spec-detail">{row.spec}</span>
                    <span className="ax-linear-spec-tag">{row.tag}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="ax-linear-panel__footer">
              <span className="ax-linear-panel__footnote">
                严格按有效作答窗口计算覆盖率，缺口项保持空值不补零
              </span>
              <button
                type="button"
                className="ax-linear-btn-primary"
                onClick={() => navigate('/research')}
              >
                启动科研采录
              </button>
            </div>
          </article>

          {/* 右侧 42% 堆叠双工作台面板 */}
          <div className="ax-linear-stack">
            <article className="ax-linear-panel ax-linear-panel--interactive">
              <div>
                <div className="ax-linear-panel__meta">
                  <span className="ax-linear-panel__index">02 · STRUCTURED DEFENSE</span>
                </div>
                <h2 className="ax-linear-panel__title">答辩与结构化面试采录</h2>
                <p className="ax-linear-panel__desc">
                  面向学位答辩、课题汇报与复试结构化问答，按题号自动切分问答时间窗，并生成支持导师复核注记的结构化证据报告。
                </p>
              </div>
              <div style={{ marginTop: 18 }}>
                <button
                  type="button"
                  className="ax-linear-btn-secondary"
                  onClick={() => navigate('/interview')}
                >
                  模拟答辩采录 ›
                </button>
              </div>
            </article>

            <article className="ax-linear-panel ax-linear-panel--interactive">
              <div>
                <div className="ax-linear-panel__meta">
                  <span className="ax-linear-panel__index">03 · LONGITUDINAL DIFF</span>
                </div>
                <h2 className="ax-linear-panel__title">跨场次同口径纵向对比</h2>
                <p className="ax-linear-panel__desc">
                  并排比对同一参与者多次汇报的声学与姿态演变轨迹，自动隔离不同采录代次口径，遇缺口显式断线绝不强连。
                </p>
              </div>
              <div style={{ marginTop: 18 }}>
                <button
                  type="button"
                  className="ax-linear-btn-secondary"
                  onClick={() => navigate('/compare')}
                >
                  进入多场对比 ›
                </button>
              </div>
            </article>
          </div>
        </section>

        {/* 方法学与封停边界账本（Linear Changelog-row 细线列表风格） */}
        <section className="ax-linear-ledger" aria-label="方法学规约与主动封停边界">
          <div className="ax-linear-ledger__head">
            <h2 className="ax-linear-ledger__title">方法学规约与主动封停账本</h2>
            <span className="ax-linear-ledger__sub">PROTOCOL SPEC · NON-SCORING BOUNDARY</span>
          </div>

          <div className="ax-linear-ledger__box">
            {/* Row 1: 方法学基础 */}
            <div className="ax-linear-ledger__row">
              <div>
                <div className="ax-linear-ledger__key">方法学基础</div>
                <div className="ax-linear-ledger__code">FRAMEWORK &amp; PRINCIPLE</div>
              </div>
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ax-ink)' }}>
                  {framework}
                </div>
                <p
                  style={{
                    margin: '6px 0 0',
                    fontSize: 13.5,
                    lineHeight: 1.65,
                    color: 'var(--ax-ink-muted-80)',
                  }}
                >
                  {corePrinciple}
                </p>
                <p
                  style={{
                    margin: '6px 0 0',
                    fontSize: 12.5,
                    lineHeight: 1.6,
                    color: 'var(--ax-text-secondary)',
                  }}
                >
                  合规守则：{displayCompliance}
                </p>
              </div>
            </div>

            {/* Row 2: 主动封停边界 */}
            <div className="ax-linear-ledger__row">
              <div>
                <div className="ax-linear-ledger__key">主动封停边界</div>
                <div className="ax-linear-ledger__code">EXPLICIT BLOCKED OVERRIDES</div>
              </div>
              <div className="ax-linear-blocked-grid">
                {blockedItems.map((item) => (
                  <div key={item.key} className="ax-linear-blocked-item">
                    <div className="ax-linear-blocked-item__head">
                      <span className="ax-linear-blocked-item__label">{item.label}</span>
                      <span className="ax-linear-blocked-item__badge">PROTOCOL BLOCKED</span>
                    </div>
                    <div className="ax-linear-blocked-item__reason">{item.reason}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Row 3: 核心观测量 */}
            <div className="ax-linear-ledger__row">
              <div>
                <div className="ax-linear-ledger__key">核心观测量</div>
                <div className="ax-linear-ledger__code">KEY CONSTRUCTS</div>
              </div>
              <div className="ax-linear-chip-list">
                {constructs.map((construct) => (
                  <span key={construct} className="ax-linear-chip">
                    {construct}
                  </span>
                ))}
              </div>
            </div>

            {/* Row 4: 同行评审参考文献（可折叠） */}
            <div className="ax-linear-ledger__row">
              <div>
                <div className="ax-linear-ledger__key">同行评审参考文献</div>
                <div className="ax-linear-ledger__code">PEER-REVIEWED REFS</div>
              </div>
              <div>
                <details className="ax-linear-details">
                  <summary>查看 {references.length} 篇同行评审方法学参考文献</summary>
                  <ol className="ax-linear-ref-list">
                    {references.map((ref) => (
                      <li key={ref}>{ref}</li>
                    ))}
                  </ol>
                </details>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};

export default ResearchHubPage;
