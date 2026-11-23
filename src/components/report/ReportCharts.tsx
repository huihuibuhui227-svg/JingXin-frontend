import React from 'react';
import { Card, Tag } from 'antd';
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
