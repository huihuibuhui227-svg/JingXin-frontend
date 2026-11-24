import React from 'react';
import { Card, Space, Tag } from 'antd';
import type { DimensionKey, EvaluationResult } from '@/types/assessment';

const DIMENSION_ORDER: DimensionKey[] = [
  'logical_thinking',
  'stress_resilience',
  'communication_fluency',
  'confidence_level',
  'cognitive_efficiency',
];

const CONF_COLOR: Record<string, string> = {
  高: '#0b5d2e',
  中: '#0066cc',
  低: '#7a4a05',
  不足: '#9e1f1f',
  无: '#5c5c61',
};

const CONF_BG: Record<string, string> = {
  高: '#edf7f0',
  中: '#eef5fc',
  低: '#fdf6e9',
  不足: '#fdf0f0',
  无: '#f5f5f7',
};

const fmtNum = (v: number): string => {
  if (!Number.isFinite(v)) return '—';
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 100) return v.toFixed(1);
  if (a >= 1) return v.toFixed(2);
  if (a >= 0.01) return v.toFixed(3);
  return v.toFixed(4);
};

/** 维度证据覆盖与最弱证据置信度横向条形图（纯 SVG，零评分）。 */
export const DimensionCoverageChart: React.FC<{ report: EvaluationResult }> = ({ report }) => {
  const items = DIMENSION_ORDER.map((k) => {
    const dim = report.dimensions?.[k];
    if (!dim) return null;
    const parts = (dim.matched_indicators || '0/0').split('/').map((s) => Number(s.trim()));
    const passed = Number.isFinite(parts[0]) ? parts[0] : 0;
    const total = Number.isFinite(parts[1]) && parts[1] > 0 ? parts[1] : 0;
    const ratio = total > 0 ? Math.min(1, Math.max(0, passed / total)) : 0;
    return {
      key: k,
      name: dim.display_name,
      passed,
      total,
      ratio,
      confidence: dim.confidence || '不足',
    };
  }).filter((x): x is NonNullable<typeof x> => x !== null);

  if (items.length === 0) return null;

  return (
    <Card
      size="small"
      title="五项行为维度覆盖与可信度"
      style={{ marginBottom: 20 }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.map((it) => {
          const fill = CONF_COLOR[it.confidence] || '#0066cc';
          const bg = CONF_BG[it.confidence] || '#f5f5f7';
          return (
            <div
              key={it.key}
              style={{
                display: 'grid',
                gridTemplateColumns: '150px 1fr 140px',
                gap: 12,
                alignItems: 'center',
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ax-ink)' }}>{it.name}</div>
              <svg
                viewBox="0 0 320 14"
                style={{ width: '100%', height: 14, display: 'block' }}
                role="img"
                aria-label={`${it.name} 覆盖 ${it.passed} / ${it.total}`}
              >
                <rect x="0" y="2" width="320" height="10" rx="5" fill="#ebedf0" />
                <rect
                  x="0"
                  y="2"
                  width={Math.max(it.passed > 0 ? 12 : 0, Math.round(it.ratio * 320))}
                  height="10"
                  rx="5"
                  fill={fill}
                />
              </svg>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--ax-ink)' }}>
                  {it.passed}/{it.total}
                </span>
                <Tag
                  style={{
                    margin: 0,
                    color: fill,
                    background: bg,
                    borderColor: 'transparent',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {it.confidence}
                </Tag>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

const REGIME_STATES = [
  { key: 'steady_speaking', label: '平稳陈述态', color: '#2563eb' },
  { key: 'active_expressive', label: '活跃表达态', color: '#15803d' },
  { key: 'pause_thinking', label: '静默停顿态', color: '#b45309' },
  { key: 'low_signal', label: '信号受限态', color: '#9ca3af' },
] as const;

const REGIME_COLOR_MAP: Record<string, string> = {
  steady_speaking: '#2563eb',
  active_expressive: '#15803d',
  pause_thinking: '#b45309',
  low_signal: '#9ca3af',
};

const MACRO_COLOR_BY_KEY: Record<string, string> = {
  steady: '#2563eb',
  active: '#15803d',
  pause: '#b45309',
  low_signal: '#9ca3af',
};

const STAGE_BADGE_TONE: Record<string, React.CSSProperties> = {
  stage_1_verified: {
    color: 'var(--ax-success)',
    background: 'var(--ax-success-soft)',
    borderColor: 'var(--ax-success-border)',
  },
  stage_2_review: {
    color: 'var(--ax-warning)',
    background: 'var(--ax-warning-soft)',
    borderColor: 'var(--ax-warning-border)',
  },
  stage_3_limited: {
    color: 'var(--ax-error)',
    background: 'var(--ax-error-soft)',
    borderColor: 'var(--ax-error-border)',
  },
};

const fmtMinSec = (sec: number): string => {
  if (!Number.isFinite(sec) || sec <= 0) return '0:00';
  const whole = Math.round(sec);
  const mins = Math.floor(whole / 60);
  const rem = whole % 60;
  return `${mins}:${String(rem).padStart(2, '0')}`;
};

/** 第三层可解释模型裁判面板：保形证据核验阶段、白盒特征归因与 HMM+PELT 宏观阶段时间轴。 */
export const RefereeStagePanel: React.FC<{ report: EvaluationResult }> = ({ report }) => {
  const refMl = report.l1?.referee_ml;
  const clipUid = React.useId().replace(/:/g, '');
  if (!refMl || !refMl.available) return null;

  const eg = refMl.evidence_gate;
  const segData = refMl.stage_segmentation;
  const macroStages = Array.isArray(segData?.macro_stages) ? segData.macro_stages : [];
  const changePoints = Array.isArray(segData?.change_points) ? segData.change_points : [];
  const hasMacroTimeline = Boolean(segData?.available && macroStages.length > 0);

  const stageTone = STAGE_BADGE_TONE[eg.stage_code] ?? {
    color: 'var(--ax-text-secondary)',
    background: 'var(--ax-parchment)',
    borderColor: 'var(--ax-hairline)',
  };

  const conformalLabels = Array.isArray(eg.conformal_set_labels) ? eg.conformal_set_labels : [];
  const targetPct = Math.round((eg.target_coverage || 0.9) * 100);
  const coverageText =
    typeof eg.empirical_cv_coverage === 'number' && Number.isFinite(eg.empirical_cv_coverage)
      ? `理论保证 ≥${targetPct}%，交叉验证实证覆盖率 ${(eg.empirical_cv_coverage * 100).toFixed(1)}%`
      : `理论保证 ≥${targetPct}%`;

  const topAttrs = (Array.isArray(eg.attributions) ? eg.attributions : [])
    .slice()
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, 6);
  const maxAbsAttr = Math.max(0.001, ...topAttrs.map((a) => Math.abs(a.contribution)));

  const attrTopPad = 16;
  const attrRowH = 28;
  const attrHeight = attrTopPad + topAttrs.length * attrRowH + 6;
  const attrTrackLeft = 186;
  const attrTrackRight = 566;
  const attrZeroX = 376;
  const attrHalfMax = 182;

  const maxStageEnd = macroStages.reduce((acc, s) => Math.max(acc, s.end_sec), 0);
  const spanSec = Math.max(segData?.total_duration_sec || 0, maxStageEnd, 0.001);
  const macroClipId = `referee-macro-clip-${clipUid}`;

  const stageSummaryByKey = new Map<string, { label: string; color: string; ratio: number }>();
  for (const s of macroStages) {
    const prev = stageSummaryByKey.get(s.stage);
    const fill = REGIME_COLOR_MAP[s.stage] || MACRO_COLOR_BY_KEY[s.color_key] || '#64748b';
    const ratio = prev ? prev.ratio + (s.ratio || 0) : (s.ratio || 0);
    stageSummaryByKey.set(s.stage, { label: s.label, color: fill, ratio });
  }
  const annotatedStage = macroStages.find((s) => Boolean(s.annotation));

  return (
    <Card
      size="small"
      style={{ marginBottom: 20 }}
      title={
        <Space wrap size={8}>
          <span>证据核验阶段与宏观行为分段</span>
          <Tag style={{ margin: 0, fontWeight: 600, ...stageTone }}>
            {eg.stage_label}
          </Tag>
          <Tag
            style={{
              margin: 0,
              color: 'var(--ax-info)',
              background: 'var(--ax-info-soft)',
              borderColor: 'var(--ax-info-border)',
              fontWeight: 600,
            }}
          >
            不打分核验
          </Tag>
          {(eg.uncertainty_escalated || eg.ood_anomaly_flag) && (
            <Tag
              style={{
                margin: 0,
                color: 'var(--ax-warning)',
                background: 'var(--ax-warning-soft)',
                borderColor: 'var(--ax-warning-border)',
                fontWeight: 600,
              }}
            >
              需人工复核
            </Tag>
          )}
        </Space>
      }
    >
      {/* 保形证据门控摘要与状态条 */}
      {eg.summary_plain && (
        <p style={{ margin: '0 0 10px', fontSize: 13.5, color: 'var(--ax-ink)', lineHeight: 1.55 }}>
          {eg.summary_plain}
        </p>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: topAttrs.length > 0 ? 14 : 0 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 10px',
            borderRadius: 'var(--ax-rounded-pill)',
            background: 'var(--ax-parchment)',
            border: '1px solid var(--ax-hairline)',
            fontSize: 12.5,
            color: 'var(--ax-ink)',
          }}
        >
          <span style={{ color: 'var(--ax-text-secondary)' }}>Conformal 集合：</span>
          <strong>{conformalLabels.length > 0 ? conformalLabels.join(' / ') : '暂无'}</strong>
        </span>

        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '3px 10px',
            borderRadius: 'var(--ax-rounded-pill)',
            background: 'var(--ax-parchment)',
            border: '1px solid var(--ax-hairline)',
            fontSize: 12.5,
            color: 'var(--ax-ink)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {coverageText}
        </span>

        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '3px 10px',
            borderRadius: 'var(--ax-rounded-pill)',
            background: eg.ood_anomaly_flag ? 'var(--ax-warning-soft)' : 'var(--ax-parchment)',
            border: `1px solid ${eg.ood_anomaly_flag ? 'var(--ax-warning-border)' : 'var(--ax-hairline)'}`,
            fontSize: 12.5,
            fontWeight: eg.ood_anomaly_flag ? 600 : 400,
            color: eg.ood_anomaly_flag ? 'var(--ax-warning)' : 'var(--ax-ink)',
          }}
        >
          异常分布：{eg.ood_anomaly_flag ? '已检出偏离' : '未见异常'}
        </span>
      </div>

      {/* 纯 SVG 白盒加性特征归因横向条形图 */}
      {topAttrs.length > 0 && (
        <div style={{ marginBottom: hasMacroTimeline ? 16 : 0 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 8,
              marginBottom: 6,
              fontSize: 12.5,
              color: 'var(--ax-text-secondary)',
            }}
          >
            <span style={{ fontWeight: 600, color: 'var(--ax-ink)' }}>
              证据支持度主要贡献因子
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: 2, background: '#b45309', display: 'inline-block' }} />
                待补强
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: 2, background: '#15803d', display: 'inline-block' }} />
                正向支撑
              </span>
            </span>
          </div>

          <svg
            viewBox={`0 0 680 ${attrHeight}`}
            style={{ width: '100%', height: 'auto', display: 'block' }}
            role="img"
            aria-label={`白盒证据归因横向柱图，展示前 ${topAttrs.length} 项贡献因子`}
          >
            <text
              x={attrZeroX}
              y={11}
              textAnchor="middle"
              fontSize="11"
              fill="#5c5c61"
              style={{ fontFamily: 'var(--ax-font-mono)' }}
            >
              0
            </text>
            <line
              x1={attrZeroX}
              y1={attrTopPad - 2}
              x2={attrZeroX}
              y2={attrTopPad + topAttrs.length * attrRowH - 2}
              stroke="#9ca3af"
              strokeWidth="1.25"
            />
            {topAttrs.map((item, idx) => {
              const cy = attrTopPad + idx * attrRowH + attrRowH / 2;
              const barY = cy - 7;
              const isPos = item.direction === '正向支撑' || (item.direction !== '待补强' && item.contribution >= 0);
              const mag = Math.abs(item.contribution);
              const barW = mag === 0 ? 2 : Math.max(6, (mag / maxAbsAttr) * attrHalfMax);
              const barX = isPos ? attrZeroX : attrZeroX - barW;
              const fill = isPos ? '#15803d' : '#b45309';

              return (
                <g key={item.feature_key}>
                  <title>
                    {`${item.label} · 实测 ${item.value_display} · ${item.direction} · 归因 ${item.contribution >= 0 ? '+' : ''}${item.contribution.toFixed(3)}`}
                  </title>
                  <text
                    x={4}
                    y={cy + 4.5}
                    fontSize="13"
                    fill="var(--ax-ink)"
                  >
                    {item.label}
                  </text>
                  <rect
                    x={attrTrackLeft}
                    y={barY}
                    width={attrTrackRight - attrTrackLeft}
                    height={14}
                    rx={3}
                    fill="#f3f4f6"
                  />
                  <rect
                    x={barX}
                    y={barY}
                    width={barW}
                    height={14}
                    rx={3}
                    fill={fill}
                  />
                  <text
                    x={676}
                    y={cy + 4.5}
                    textAnchor="end"
                    fontSize="12.5"
                    fill="var(--ax-ink)"
                    style={{
                      fontFamily: 'var(--ax-font-mono)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {item.value_display}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}

      {/* HMM + PELT 宏观行为阶段切分与转折点 */}
      {hasMacroTimeline && (
        <div style={{ borderTop: '1px solid var(--ax-divider-soft)', paddingTop: 14 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 8,
              marginBottom: 8,
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ax-ink)' }}>
              宏观行为阶段切分与转折点
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <span
                style={{
                  padding: '2px 10px',
                  borderRadius: 'var(--ax-rounded-pill)',
                  background: 'var(--ax-parchment)',
                  border: '1px solid var(--ax-hairline)',
                  fontSize: 12,
                  color: 'var(--ax-ink)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                共 {macroStages.length} 段
              </span>
              <span
                style={{
                  padding: '2px 10px',
                  borderRadius: 'var(--ax-rounded-pill)',
                  background: 'var(--ax-parchment)',
                  border: '1px solid var(--ax-hairline)',
                  fontSize: 12,
                  color: 'var(--ax-ink)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                平均驻留 {segData.mean_dwell_sec.toFixed(1)} 秒
              </span>
              {typeof segData.flicker_reduction_pct === 'number' &&
                Number.isFinite(segData.flicker_reduction_pct) &&
                segData.flicker_reduction_pct >= 0 && (
                  <span
                    style={{
                      padding: '2px 10px',
                      borderRadius: 'var(--ax-rounded-pill)',
                      background: 'var(--ax-info-soft)',
                      border: '1px solid var(--ax-info-border)',
                      fontSize: 12,
                      color: 'var(--ax-info)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    较逐窗识别减少 {segData.flicker_reduction_pct.toFixed(0)}% 抖动切换
                  </span>
                )}
            </div>
          </div>

          {segData.summary_plain && (
            <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--ax-text-secondary)', lineHeight: 1.55 }}>
              {segData.summary_plain}
            </p>
          )}

          <svg
            viewBox="0 0 800 44"
            style={{ width: '100%', height: 44, display: 'block' }}
            role="img"
            aria-label={`宏观行为阶段时间轴，共 ${macroStages.length} 段、${changePoints.length} 处转折点`}
          >
            <defs>
              <clipPath id={macroClipId}>
                <rect x="0" y="12" width="800" height="24" rx="5" />
              </clipPath>
            </defs>
            <g clipPath={`url(#${macroClipId})`}>
              <rect x="0" y="12" width="800" height="24" fill="#ebedf0" />
              {macroStages.map((seg, idx) => {
                const start = Math.max(0, Math.min(spanSec, seg.start_sec));
                const end = Math.max(start, Math.min(spanSec, seg.end_sec));
                const xRaw = (start / spanSec) * 800;
                const wRaw = ((end - start) / spanSec) * 800;
                const x = Math.min(xRaw, 798.5);
                const w = Math.max(1.5, Math.min(wRaw, 800 - x));
                const fill = REGIME_COLOR_MAP[seg.stage] || MACRO_COLOR_BY_KEY[seg.color_key] || '#64748b';
                return (
                  <rect
                    key={`${seg.stage}-${idx}`}
                    x={x}
                    y={12}
                    width={w}
                    height={24}
                    fill={fill}
                  >
                    <title>
                      {`${seg.label}${seg.annotation ? ` · ${seg.annotation}` : ''} ${seg.start_sec.toFixed(1)}s–${seg.end_sec.toFixed(1)}s`}
                    </title>
                  </rect>
                );
              })}
            </g>

            {changePoints.map((cp, idx) => {
              const cx = Math.max(6, Math.min(794, (cp.time_sec / spanSec) * 800));
              return (
                <g key={`cp-${idx}-${cp.time_sec}`}>
                  <title>{`${cp.time_sec.toFixed(1)}s · ${cp.cue_summary}`}</title>
                  <line
                    x1={cx}
                    y1={12}
                    x2={cx}
                    y2={36}
                    stroke="#ffffff"
                    strokeWidth="3"
                    strokeOpacity="0.8"
                  />
                  <line
                    x1={cx}
                    y1={11}
                    x2={cx}
                    y2={37}
                    stroke="#dc2626"
                    strokeWidth="1.6"
                  />
                  <polygon
                    points={`${cx},3 ${cx + 4.5},7.5 ${cx},12 ${cx - 4.5},7.5`}
                    fill="#dc2626"
                  />
                </g>
              );
            })}
          </svg>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 4,
              fontSize: 11.5,
              fontFamily: 'var(--ax-font-mono)',
              fontVariantNumeric: 'tabular-nums',
              color: 'var(--ax-text-secondary)',
            }}
          >
            <span>0:00</span>
            <span>{fmtMinSec(spanSec / 2)}</span>
            <span>{fmtMinSec(spanSec)}</span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            {Array.from(stageSummaryByKey.entries()).map(([stageKey, info]) => (
              <span
                key={stageKey}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '3px 10px',
                  borderRadius: 'var(--ax-rounded-pill)',
                  background: 'var(--ax-parchment)',
                  border: '1px solid var(--ax-hairline)',
                  fontSize: 12.5,
                  color: 'var(--ax-ink)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: 3,
                    background: info.color,
                    flexShrink: 0,
                  }}
                />
                <span>{info.label}</span>
                <strong>{Math.round(info.ratio * 100)}%</strong>
              </span>
            ))}
            {annotatedStage?.annotation && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '3px 10px',
                  borderRadius: 'var(--ax-rounded-pill)',
                  background: 'var(--ax-info-soft)',
                  border: '1px solid var(--ax-info-border)',
                  fontSize: 12.5,
                  color: 'var(--ax-info)',
                }}
              >
                首段标记：{annotatedStage.annotation}
              </span>
            )}
          </div>

          {changePoints.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {changePoints.map((cp, idx) => (
                <span
                  key={`chip-${idx}-${cp.time_sec}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '2px 10px',
                    borderRadius: 'var(--ax-rounded-pill)',
                    background: 'var(--ax-error-soft)',
                    border: '1px solid var(--ax-error-border)',
                    fontSize: 12,
                    color: 'var(--ax-error)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 6,
                      height: 6,
                      transform: 'rotate(45deg)',
                      background: '#dc2626',
                      display: 'inline-block',
                      flexShrink: 0,
                    }}
                  />
                  {`${cp.time_sec.toFixed(0)}s 转折：${cp.cue_summary}`}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {refMl.disclaimer && (
        <div
          style={{
            marginTop: 10,
            fontSize: 12,
            color: 'var(--ax-text-secondary)',
            lineHeight: 1.5,
          }}
        >
          {refMl.disclaimer}
        </div>
      )}
    </Card>
  );
};

/** 整场行为节奏无监督分段纯 SVG 时间轴（只读提示，不参与任何汇总）。 */
export const BehaviorRegimeTimeline: React.FC<{ report: EvaluationResult }> = ({ report }) => {
  const br = report.l1?.behavior_regimes;
  const clipUid = React.useId().replace(/:/g, '');
  if (!br) return null;

  const segments = Array.isArray(br.segments) ? br.segments : [];
  const hasTimeline = br.available && segments.length > 0 && br.total_duration_sec > 0;
  const maxSegEnd = segments.reduce((acc, s) => Math.max(acc, s.end_sec), 0);
  const spanSec = Math.max(br.total_duration_sec || 0, maxSegEnd, 0.001);
  const clipId = `regime-clip-${clipUid}`;

  const agreement = br.model_metrics?.state_agreement_mean;
  const inferMs = typeof br.inference_ms === 'number'
    ? br.inference_ms
    : br.model_metrics?.inference_ms;
  const metricParts: string[] = [];
  if (br.model_used !== false && typeof agreement === 'number' && Number.isFinite(agreement)) {
    metricParts.push(`无监督模型跨场验证一致率 ${(agreement * 100).toFixed(1)}%`);
  }
  if (typeof inferMs === 'number' && Number.isFinite(inferMs)) {
    metricParts.push(`本场纯 CPU 耗时 ${inferMs.toFixed(1)} ms`);
  }

  return (
    <Card
      size="small"
      style={{ marginBottom: 20 }}
      title={
        <Space wrap size={8}>
          <span>整场行为节奏时间轴</span>
          <Tag
            style={{
              margin: 0,
              color: br.available ? 'var(--ax-info)' : 'var(--ax-text-secondary)',
              background: br.available ? 'var(--ax-info-soft)' : 'var(--ax-parchment)',
              borderColor: br.available ? 'var(--ax-info-border)' : 'var(--ax-hairline)',
              fontWeight: 600,
            }}
          >
            {br.available ? `${segments.length} 个连续时段` : '样本不足'}
          </Tag>
        </Space>
      }
    >
      {br.summary_plain && (
        <p style={{ margin: '0 0 12px', fontSize: 13.5, color: 'var(--ax-ink)', lineHeight: 1.55 }}>
          {br.summary_plain}
        </p>
      )}

      {hasTimeline && (
        <div>
          <svg
            viewBox="0 0 800 32"
            style={{ width: '100%', height: 32, display: 'block' }}
            role="img"
            aria-label={`整场行为节奏时间轴，共 ${segments.length} 个连续时段`}
          >
            <defs>
              <clipPath id={clipId}>
                <rect x="0" y="0" width="800" height="32" rx="6" />
              </clipPath>
            </defs>
            <g clipPath={`url(#${clipId})`}>
              <rect x="0" y="0" width="800" height="32" fill="#ebedf0" />
              {segments.map((seg, idx) => {
                const start = Math.max(0, Math.min(spanSec, seg.start_sec));
                const end = Math.max(start, Math.min(spanSec, seg.end_sec));
                const xRaw = (start / spanSec) * 800;
                const wRaw = ((end - start) / spanSec) * 800;
                const x = Math.min(xRaw, 798.5);
                const w = Math.max(1.5, Math.min(wRaw, 800 - x));
                const fill = REGIME_COLOR_MAP[seg.state] || '#64748b';
                return (
                  <rect
                    key={`${seg.state}-${idx}`}
                    x={x}
                    y={0}
                    width={w}
                    height={32}
                    fill={fill}
                  >
                    <title>{`${seg.label} ${seg.start_sec.toFixed(0)}s–${seg.end_sec.toFixed(0)}s`}</title>
                  </rect>
                );
              })}
            </g>
          </svg>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 5,
              fontSize: 11.5,
              fontFamily: 'var(--ax-font-mono)',
              fontVariantNumeric: 'tabular-nums',
              color: 'var(--ax-text-secondary)',
            }}
          >
            <span>0:00</span>
            <span>{fmtMinSec(spanSec / 2)}</span>
            <span>{fmtMinSec(spanSec)}</span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            {REGIME_STATES.map((st) => {
              const label = br.state_meta?.[st.key]?.label || st.label;
              const ratio = br.state_ratios?.[st.key] ?? 0;
              const pct = Math.round(ratio * 100);
              return (
                <span
                  key={st.key}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '3px 10px',
                    borderRadius: 'var(--ax-rounded-pill)',
                    background: 'var(--ax-parchment)',
                    border: '1px solid var(--ax-hairline)',
                    fontSize: 12.5,
                    color: 'var(--ax-ink)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: 3,
                      background: st.color,
                      flexShrink: 0,
                    }}
                  />
                  <span>{label}</span>
                  <strong>{pct}%</strong>
                </span>
              );
            })}
          </div>

          {metricParts.length > 0 && (
            <div
              style={{
                marginTop: 8,
                fontSize: 12,
                color: 'var(--ax-text-secondary)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {metricParts.join(' · ')}
            </div>
          )}
        </div>
      )}

      {br.disclaimer && (
        <div
          style={{
            marginTop: hasTimeline ? 8 : 0,
            fontSize: 12,
            color: 'var(--ax-text-secondary)',
            lineHeight: 1.5,
          }}
        >
          {br.disclaimer}
        </div>
      )}
    </Card>
  );
};

/** 逐题离散度小倍数范围图（与离线单文件 HTML 同口径，中文指标名，平直行显式标注）。 */
export const DispersionSmallMultiples: React.FC<{ report: EvaluationResult }> = ({ report }) => {
  const disp = report.l1?.dispersion;
  const meta = report.l1?.indicator_meta ?? {};
  if (!disp || Object.keys(disp).length === 0) return null;

  const rows = Object.entries(disp)
    .map(([name, v]) => ({
      name,
      label: meta[name]?.label || name,
      ...v,
      flat: Math.abs(v.max - v.min) < 1e-9,
    }))
    .sort((a, b) => b.iqr - a.iqr)
    .slice(0, 12);

  return (
    <Card
      size="small"
      title={`各题表现波动范围 · 共 ${Object.keys(disp).length} 项指标`}
      style={{ marginBottom: 20 }}
    >
      <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--ax-text-secondary)' }}>
        {report.l1?.dispersion_note || '展示本场不同题目之间的数值变化范围，不可跨场次直接相减。'}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map((r) => {
          const span = Math.max(r.max - r.min, 1e-9);
          const pos = (val: number) => 12 + ((val - r.min) / span) * 236;
          const q1 = Math.max(r.min, r.median - r.iqr / 2);
          const q3 = Math.min(r.max, r.median + r.iqr / 2);
          const medX = r.flat ? 130 : pos(r.median);
          const q1X = r.flat ? 126 : pos(q1);
          const q3X = r.flat ? 134 : pos(q3);

          return (
            <div
              key={r.name}
              style={{
                display: 'grid',
                gridTemplateColumns: '175px 1fr 220px',
                gap: 12,
                alignItems: 'center',
                padding: '4px 0',
                borderBottom: '1px solid var(--ax-divider-soft)',
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ax-ink)' }}>{r.label}</div>
                <div style={{ fontSize: 11.5, color: 'var(--ax-text-secondary)' }}>{r.n_questions} 题</div>
              </div>
              {r.flat ? (
                <div style={{ fontSize: 12, color: 'var(--ax-text-secondary)' }}>
                  各题数值相同：{fmtNum(r.median)}
                </div>
              ) : (
                <svg
                  viewBox="0 0 260 22"
                  style={{ width: '100%', height: 22, display: 'block' }}
                  role="img"
                  aria-label={`${r.label} 范围 ${fmtNum(r.min)} 到 ${fmtNum(r.max)}，中位 ${fmtNum(r.median)}`}
                >
                  <line x1="12" y1="11" x2="248" y2="11" stroke="#c5cad3" strokeWidth="2" />
                  <line x1="12" y1="6" x2="12" y2="16" stroke="#8c939d" strokeWidth="1.5" />
                  <line x1="248" y1="6" x2="248" y2="16" stroke="#8c939d" strokeWidth="1.5" />
                  <rect
                    x={q1X}
                    y="6"
                    width={Math.max(4, q3X - q1X)}
                    height="10"
                    rx="3"
                    fill="#c2dcf5"
                    stroke="#0066cc"
                    strokeWidth="1"
                  />
                  <circle cx={medX} cy="11" r="4" fill="#0066cc" />
                </svg>
              )}
              <div
                style={{
                  fontSize: 12,
                  textAlign: 'right',
                  fontVariantNumeric: 'tabular-nums',
                  color: 'var(--ax-text-secondary)',
                }}
              >
                中位 <strong style={{ color: 'var(--ax-ink)' }}>{fmtNum(r.median)}</strong> · 区间 [{fmtNum(r.min)}, {fmtNum(r.max)}]
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};
