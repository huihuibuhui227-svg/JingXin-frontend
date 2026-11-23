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

const fmtMinSec = (sec: number): string => {
  if (!Number.isFinite(sec) || sec <= 0) return '0:00';
  const whole = Math.round(sec);
  const mins = Math.floor(whole / 60);
  const rem = whole % 60;
  return `${mins}:${String(rem).padStart(2, '0')}`;
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
