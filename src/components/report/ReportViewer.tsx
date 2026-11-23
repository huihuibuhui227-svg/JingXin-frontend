import React from 'react';
import { Card, Collapse, Empty, Space, Table, Tag, Tooltip } from 'antd';
import { EvaluationResult, EvidenceItem } from '@/types/assessment';
import L1IndicatorTable from './L1IndicatorTable';
import { DimensionCoverageChart, DispersionSmallMultiples } from './ReportCharts';
import EvidenceAuditPanels from './EvidenceAuditPanels';

const DIMENSION_ORDER: (keyof EvaluationResult['dimensions'])[] = [
  'logical_thinking',
  'stress_resilience',
  'communication_fluency',
  'confidence_level',
  'cognitive_efficiency',
];

const fmtNumber = (v: number | null | undefined): string => {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 1000) return v.toFixed(0);
  if (a >= 10) return v.toFixed(2);
  if (a >= 0.01) return v.toFixed(3);
  return v.toFixed(4);
};

const CONF_STYLE: Record<string, React.CSSProperties> = {
  高: { color: '#0b5d2e', background: '#edf7f0', borderColor: '#bfe3cb' },
  中: { color: '#0a4a8f', background: '#eef5fc', borderColor: '#c2dcf5' },
  低: { color: '#7a4a05', background: '#fdf6e9', borderColor: '#eed39e' },
  不足: { color: '#9e1f1f', background: '#fdf0f0', borderColor: '#f2c2c2' },
};

export interface ReportViewerProps {
  report: EvaluationResult;
}

const ReportViewer: React.FC<ReportViewerProps> = ({ report }) => {
  const vanished = report.vanished_dimensions ?? [];
  const l1 = report.l1;
  const zeroNotes = l1?.zero_explanations ?? {};
  const instLabels = l1?.instruments?.labels ?? {};
  const dimRegistry = l1?.dimension_registry ?? {};

  return (
    <div>
      {/* ══ Layer 1：10 秒看懂 —— 可视化总览 + 分维度客观证据与缺口 ══════════ */}
      <DimensionCoverageChart report={report} />
      <DispersionSmallMultiples report={report} />

      {vanished.length > 0 && (
        <Card title="整维未出（当前采集方案不含对应可测量）" style={{ marginBottom: 20 }}>
          <p style={{ color: 'var(--ax-text-secondary)', marginTop: 0, fontSize: 14 }}>
            下列维度<strong>不是本场漏采</strong>，而是当前仪器方案不测量该构念。
          </p>
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            {vanished.map((v) => (
              <li key={v.key} style={{ marginBottom: 8 }}>
                <strong>{v.display_name}</strong>
                <Tag style={{ marginLeft: 8 }}>{v.n_slots} 项</Tag>
                <div style={{ color: 'var(--ax-text-secondary)', marginTop: 4, fontSize: 13 }}>
                  {v.dropped
                    .map((d) => `${d.human_name ?? d.slot}：本层不测这一条 —— ${d.plain_reason ?? d.reason}`)
                    .join('；')}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {DIMENSION_ORDER.map((key) => {
        const dim = report.dimensions?.[key];
        if (!dim) return null;
        const gaps = dim.evidence_gaps ?? [];
        const notMeasured = dim.evidence_gaps_not_measured ?? [];
        const chain = dim.evidence_chain ?? [];
        const reg = dimRegistry[key];

        return (
          <Card
            key={key}
            size="small"
            style={{ marginBottom: 16 }}
            title={
              <Space wrap size={8}>
                <span style={{ fontSize: 16, fontWeight: 600 }}>{dim.display_name}</span>
                <Tag style={{ margin: 0 }}>通过 {dim.matched_indicators}</Tag>
                <Tag style={{ margin: 0, ...(CONF_STYLE[dim.confidence] ?? {}) }}>
                  置信度 {dim.confidence}
                </Tag>
              </Space>
            }
          >
            <div style={{ color: 'var(--ax-text-secondary)', marginTop: 0, marginBottom: 12, fontSize: 13.5 }}>
              <div>{(reg as any)?.user_summary || reg?.disclaimer || dim.description}</div>
              {(reg as any)?.literature_anchor && (
                <div style={{ fontSize: 12, marginTop: 3, color: 'var(--ax-ink-muted-80)' }}>
                  理论线索参考：{(reg as any).literature_anchor}
                </div>
              )}
            </div>

            {chain.length > 0 ? (
              <Table<EvidenceItem>
                rowKey="feature"
                size="small"
                pagination={false}
                dataSource={chain}
                scroll={{ x: 640 }}
                style={{ marginBottom: gaps.length > 0 || notMeasured.length > 0 ? 12 : 0 }}
                columns={[
                  {
                    title: '观测指标',
                    dataIndex: 'human_name',
                    width: 210,
                    render: (name: string) => <strong style={{ color: 'var(--ax-ink)' }}>{name}</strong>,
                  },
                  {
                    title: '本场实测值',
                    dataIndex: 'raw_value',
                    width: 170,
                    align: 'right',
                    render: (val: number, row) => {
                      const zNote = zeroNotes[row.feature];
                      return (
                        <div style={{ fontVariantNumeric: 'tabular-nums' }}>
                          <strong>{fmtNumber(val)}</strong>
                          {zNote && (
                            <Tooltip title={zNote}>
                              <Tag style={{ marginLeft: 6, fontSize: 11 }}>零值说明</Tag>
                            </Tooltip>
                          )}
                        </div>
                      );
                    },
                  },
                  {
                    title: '有效样本',
                    dataIndex: 'n_valid',
                    width: 110,
                    align: 'right',
                    render: (n: number) => (
                      <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ax-text-secondary)' }}>
                        {Number.isFinite(n) ? n.toLocaleString('zh-CN') : '—'}
                      </span>
                    ),
                  },
                  {
                    title: '仪器来源',
                    dataIndex: 'instruments',
                    render: (insts?: string[]) =>
                      Array.isArray(insts) && insts.length > 0 ? (
                        <Space size={4} wrap>
                          {insts.map((inst) => (
                            <Tag key={inst} style={{ margin: 0, fontSize: 12 }}>
                              {instLabels[inst] || inst}
                            </Tag>
                          ))}
                        </Space>
                      ) : (
                        <span style={{ color: 'var(--ax-text-secondary)', fontSize: 12 }}>—</span>
                      ),
                  },
                ]}
              />
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="本维度当前无通过审查的客观指标"
                style={{ margin: '8px 0 12px' }}
              />
            )}

            {gaps.length > 0 && (
              <div
                style={{
                  marginTop: 8,
                  padding: '8px 12px',
                  borderRadius: 'var(--ax-rounded-sm)',
                  background: 'var(--ax-warning-soft)',
                  border: '1px solid var(--ax-warning-border)',
                  fontSize: 13,
                }}
              >
                <div style={{ fontWeight: 600, color: 'var(--ax-warning)', marginBottom: 4 }}>
                  本场未获取到的指标
                </div>
                <ul style={{ paddingLeft: 18, margin: 0, color: 'var(--ax-ink-muted-80)' }}>
                  {gaps.map((g, i) => (
                    <li key={i}>{g}</li>
                  ))}
                </ul>
              </div>
            )}

            {notMeasured.length > 0 && (
              <div
                style={{
                  marginTop: 8,
                  padding: '8px 12px',
                  borderRadius: 'var(--ax-rounded-sm)',
                  background: 'var(--ax-parchment)',
                  border: '1px solid var(--ax-hairline)',
                  fontSize: 13,
                }}
              >
                <div style={{ fontWeight: 600, color: 'var(--ax-text-secondary)', marginBottom: 4 }}>
                  当前采集方案不测量的项目
                </div>
                <ul style={{ paddingLeft: 18, margin: 0, color: 'var(--ax-text-secondary)' }}>
                  {notMeasured.map((g, i) => (
                    <li key={i}>{g}</li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        );
      })}

      {/* ══ Layer 2：一键查账 ══ */}
      {l1 && (
        <div style={{ marginTop: 24, marginBottom: 16 }}>
          <Collapse
            items={[
              {
                key: 'l1-full-table',
                label: (
                  <Space wrap size={8}>
                    <strong>全部 {l1.n_total} 项行为指标明细 · 已测出 {l1.n_measured} 项</strong>
                    <Tag style={{ margin: 0 }}>点击查看计算方式与未出值原因</Tag>
                  </Space>
                ),
                children: <L1IndicatorTable l1={l1} />,
              },
            ]}
          />
        </div>
      )}

      <EvidenceAuditPanels report={report} />
    </div>
  );
};

export default ReportViewer;
