import React, { useMemo, useState } from 'react';
import { Alert, Card, Empty, Segmented, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { LongitudinalMetricSeries, LongitudinalTrajectoryResponse } from '@/services/api';

const { Text } = Typography;

interface Props {
  series: LongitudinalMetricSeries[];
  comparable: boolean;
  defVersions: string[];
  comparabilityNotes: string[];
  methodology?: LongitudinalTrajectoryResponse['methodology'];
}

const SVG_W = 760;
const SVG_H = 250;
const PAD_L = 56;
const PAD_R = 28;
const PAD_T = 26;
const PAD_B = 44;

const fmtVal = (v: number | null | undefined): string => {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—（缺口）';
  if (Math.abs(v) >= 100) return v.toFixed(1);
  if (Math.abs(v) >= 1) return v.toFixed(2);
  return v.toFixed(3);
};

const formatDefVersion = (ver: string): string => {
  if (ver === 'capture:gen1') return '第一代采录口径';
  if (ver === 'capture:gen2') return '第二代三维采录口径';
  return ver;
};

const DRIFT_STATUS_META: Record<string, { label: string; style?: React.CSSProperties; color?: string }> = {
  baseline: {
    label: '基线参考',
    style: { color: 'var(--ax-info)', background: 'var(--ax-info-soft)', borderColor: 'var(--ax-info-border)' },
  },
  基线参考: {
    label: '基线参考',
    style: { color: 'var(--ax-info)', background: 'var(--ax-info-soft)', borderColor: 'var(--ax-info-border)' },
  },
  within_band: {
    label: '个人稳定区间',
    style: { color: 'var(--ax-success)', background: 'var(--ax-success-soft)', borderColor: 'var(--ax-success-border)' },
  },
  个人稳定区间: {
    label: '个人稳定区间',
    style: { color: 'var(--ax-success)', background: 'var(--ax-success-soft)', borderColor: 'var(--ax-success-border)' },
  },
  mild_drift: {
    label: '轻度偏离·建议核查环境',
    color: 'warning',
  },
  '轻度偏离·建议核查环境': {
    label: '轻度偏离·建议核查环境',
    color: 'warning',
  },
  sustained_drift: {
    label: '持续偏移·建议人工复核',
    color: 'error',
  },
  '持续偏移·建议人工复核': {
    label: '持续偏移·建议人工复核',
    color: 'error',
  },
};

const isDriftFlagged = (status?: string): boolean => {
  if (!status) return false;
  return (
    status === 'mild_drift' ||
    status === 'sustained_drift' ||
    status.includes('偏离') ||
    status.includes('偏移')
  );
};

const LongitudinalTrajectorySvg: React.FC<Props> = ({
  series,
  comparable,
  defVersions,
  comparabilityNotes,
  methodology,
}) => {
  const [selectedKey, setSelectedKey] = useState<string>(() => series[0]?.key || 'voiced_ratio');

  const activeSeries = useMemo(() => {
    if (!series.length) return null;
    return series.find((s) => s.key === selectedKey) ?? series[0];
  }, [series, selectedKey]);

  const chartGeom = useMemo(() => {
    if (!activeSeries || activeSeries.points.length === 0) return null;
    const pts = activeSeries.points;
    const nums: number[] = [];
    for (const p of pts) {
      if (typeof p.value === 'number' && Number.isFinite(p.value)) nums.push(p.value);
      if (typeof p.ewma_value === 'number' && Number.isFinite(p.ewma_value)) nums.push(p.ewma_value);
    }
    const { p25, p75, median, t0_baseline } = activeSeries.summary;
    if (typeof p25 === 'number' && Number.isFinite(p25)) nums.push(p25);
    if (typeof p75 === 'number' && Number.isFinite(p75)) nums.push(p75);
    if (typeof median === 'number' && Number.isFinite(median)) nums.push(median);
    if (typeof t0_baseline === 'number' && Number.isFinite(t0_baseline)) nums.push(t0_baseline);

    let yMin = nums.length ? Math.min(...nums) : 0;
    let yMax = nums.length ? Math.max(...nums) : 1;
    if (Math.abs(yMax - yMin) < 1e-6) {
      const pad = Math.max(0.1, Math.abs(yMin) * 0.2 || 0.5);
      yMin -= pad;
      yMax += pad;
    } else {
      const span = yMax - yMin;
      yMin -= span * 0.16;
      yMax += span * 0.16;
    }

    const plotW = SVG_W - PAD_L - PAD_R;
    const plotH = SVG_H - PAD_T - PAD_B;
    const n = pts.length;
    const xOf = (idx: number) => (n <= 1 ? PAD_L + plotW / 2 : PAD_L + (idx / (n - 1)) * plotW);
    const yOf = (val: number) => PAD_T + ((yMax - val) / (yMax - yMin)) * plotH;

    // 连续有效段拆分：遇 null（缺口）或 !comparable 时绝不强制连线
    const segments: string[] = [];
    const ewmaSegments: string[] = [];
    if (comparable) {
      let currentRun: string[] = [];
      let currentEwmaRun: string[] = [];
      pts.forEach((p, idx) => {
        if (typeof p.value === 'number' && Number.isFinite(p.value)) {
          currentRun.push(`${xOf(idx).toFixed(1)},${yOf(p.value).toFixed(1)}`);
        } else {
          if (currentRun.length >= 2) segments.push(currentRun.join(' '));
          currentRun = [];
        }

        if (typeof p.ewma_value === 'number' && Number.isFinite(p.ewma_value)) {
          currentEwmaRun.push(`${xOf(idx).toFixed(1)},${yOf(p.ewma_value).toFixed(1)}`);
        } else {
          if (currentEwmaRun.length >= 2) ewmaSegments.push(currentEwmaRun.join(' '));
          currentEwmaRun = [];
        }
      });
      if (currentRun.length >= 2) segments.push(currentRun.join(' '));
      if (currentEwmaRun.length >= 2) ewmaSegments.push(currentEwmaRun.join(' '));
    }

    const yTicks = [yMax, (yMax + yMin) / 2, yMin];
    return {
      pts,
      yMin,
      yMax,
      yTicks,
      xOf,
      yOf,
      segments,
      ewmaSegments,
      plotW,
      plotH,
      t0Y: typeof t0_baseline === 'number' && Number.isFinite(t0_baseline) ? yOf(t0_baseline) : null,
      medianY: typeof median === 'number' && Number.isFinite(median) ? yOf(median) : null,
      p25Y: typeof p25 === 'number' && Number.isFinite(p25) ? yOf(p25) : null,
      p75Y: typeof p75 === 'number' && Number.isFinite(p75) ? yOf(p75) : null,
    };
  }, [activeSeries, comparable]);

  if (!series.length) {
    return (
      <Card size="small">
        <Empty description="暂无可展示的多访次时序指标" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </Card>
    );
  }

  const columns: ColumnsType<LongitudinalMetricSeries['points'][number]> = [
    {
      title: '访次',
      dataIndex: 'visit_label',
      key: 'visit_label',
      render: (v: string, row) => (
        <Space size={6}>
          <Tag style={{ margin: 0 }}>#{row.visit_order}</Tag>
          <span>{v}</span>
        </Space>
      ),
    },
    {
      title: '采录场次编号',
      dataIndex: 'session_id',
      key: 'session_id',
      render: (sid: string) => <code style={{ fontSize: 12 }}>{sid}</code>,
    },
    {
      title: `实测读数${activeSeries?.unit ? `（${activeSeries.unit}）` : ''}`,
      dataIndex: 'value',
      key: 'value',
      render: (v: number | null) => (
        <Text strong={v !== null} type={v === null ? 'secondary' : undefined}>
          {fmtVal(v)}
        </Text>
      ),
    },
    {
      title: '相对本人首访变化',
      dataIndex: 'delta_from_t0_pct',
      key: 'delta_from_t0_pct',
      render: (pct: number | null) => {
        if (pct === null || pct === undefined || !Number.isFinite(pct)) return '—';
        const sign = pct > 0 ? '+' : '';
        return `${sign}${pct.toFixed(2)}%`;
      },
    },
    {
      title: '趋势平滑与漂移状态',
      key: 'drift_status',
      render: (_, row) => {
        const meta = row.drift_status ? DRIFT_STATUS_META[row.drift_status] : undefined;
        return (
          <Space size={6} wrap>
            {typeof row.ewma_value === 'number' && Number.isFinite(row.ewma_value) && (
              <span style={{ fontSize: 12, color: 'var(--ax-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                平滑值 {fmtVal(row.ewma_value)}
              </span>
            )}
            {row.drift_status && (
              <Tag color={meta?.color} style={{ margin: 0, ...(meta?.style ?? {}) }}>
                {meta?.label ?? row.drift_status}
              </Tag>
            )}
          </Space>
        );
      },
    },
    {
      title: '置信与缺口说明',
      key: 'confidence_gap',
      render: (_, row) =>
        row.value === null ? (
          <Tag color="warning">缺口保留空值：{row.gap || '未采得'}</Tag>
        ) : (
          <Tag style={{ color: 'var(--ax-info)', background: 'var(--ax-info-soft)', borderColor: 'var(--ax-info-border)' }}>
            置信度：{row.confidence}
          </Tag>
        ),
    },
  ];

  const readableVersions = defVersions.map(formatDefVersion);

  return (
    <Card className="ax-card">
      <Space direction="vertical" size={14} style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <Text strong style={{ fontSize: 16 }}>个体内客观动力学变化轨迹（首访个人基线锚定）</Text>
            <div style={{ fontSize: 12.5, color: 'var(--ax-text-secondary)', marginTop: 2 }}>
              涉及采录口径：{readableVersions.length ? readableVersions.join(' / ') : '暂未识别口径'} · 遇缺失项保持断线绝不补零
            </div>
          </div>
          {comparable ? (
            <Tag style={{ color: 'var(--ax-success)', background: 'var(--ax-success-soft)', borderColor: 'var(--ax-success-border)' }}>
              同代次口径可比 · 允许连续轨迹拟合
            </Tag>
          ) : (
            <Tag color="warning">不可跨代混合拟合 · 仅作离散快照对照</Tag>
          )}
        </div>

        {!comparable && comparabilityNotes.length > 0 && (
          <Alert
            type="warning"
            showIcon
            message="跨版本可比性与断线守卫已触发（拒绝强制连线）"
            description={comparabilityNotes.join('；')}
          />
        )}

        <div style={{ overflowX: 'auto' }}>
          <Segmented
            aria-label="选择纵向对比指标"
            value={activeSeries?.key}
            onChange={(val) => setSelectedKey(String(val))}
            options={series.map((s) => ({ label: s.label, value: s.key }))}
          />
        </div>

        {activeSeries && chartGeom && (
          <>
            <Space wrap size={8}>
              <Tag>有效访次：{activeSeries.summary.n_valid_visits} / {activeSeries.points.length}</Tag>
              <Tag>首访基线 t0：{fmtVal(activeSeries.summary.t0_baseline)}</Tag>
              <Tag>个人中位数：{fmtVal(activeSeries.summary.median)}</Tag>
              <Tag>个人稳健参考带 (P25–P75)：{fmtVal(activeSeries.summary.p25)} ~ {fmtVal(activeSeries.summary.p75)}</Tag>
              {typeof activeSeries.summary.mad === 'number' && Number.isFinite(activeSeries.summary.mad) && (
                <Tag>稳健离散 (MAD)：{fmtVal(activeSeries.summary.mad)}</Tag>
              )}
              {typeof activeSeries.summary.ewma_latest === 'number' && Number.isFinite(activeSeries.summary.ewma_latest) && (
                <Tag style={{ color: 'var(--ax-b3)', background: 'var(--ax-b3-soft)', borderColor: 'var(--ax-b3-border)' }}>
                  EWMA 最新趋势：{fmtVal(activeSeries.summary.ewma_latest)}
                </Tag>
              )}
              {typeof activeSeries.summary.n_drift_flagged === 'number' && activeSeries.summary.n_drift_flagged > 0 && (
                <Tag color="warning">偏移提示：{activeSeries.summary.n_drift_flagged} 次</Tag>
              )}
            </Space>

            <div
              style={{
                background: 'var(--ax-parchment)',
                border: '1px solid var(--ax-hairline)',
                borderRadius: 'var(--ax-rounded-md)',
                padding: '12px 10px 8px',
              }}
            >
              <svg
                viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                style={{ width: '100%', height: 'auto', display: 'block' }}
                role="img"
                aria-label={`${activeSeries.label}个体内纵向轨迹图`}
              >
                {/* 背景水平辅助网格 */}
                {chartGeom.yTicks.map((tick, idx) => {
                  const y = chartGeom.yOf(tick);
                  return (
                    <g key={idx}>
                      <line
                        x1={PAD_L}
                        x2={SVG_W - PAD_R}
                        y1={y}
                        y2={y}
                        stroke="#e0e0e0"
                        strokeWidth={1}
                      />
                      <text
                        x={PAD_L - 8}
                        y={y + 4}
                        textAnchor="end"
                        fontSize={11}
                        fill="#5c5c61"
                      >
                        {Math.abs(tick) >= 100 ? tick.toFixed(0) : tick.toFixed(2)}
                      </text>
                    </g>
                  );
                })}

                {/* P25–P75 个人稳健参考带 */}
                {chartGeom.p25Y !== null && chartGeom.p75Y !== null && (
                  <rect
                    x={PAD_L}
                    y={Math.min(chartGeom.p75Y, chartGeom.p25Y)}
                    width={chartGeom.plotW}
                    height={Math.max(2, Math.abs(chartGeom.p25Y - chartGeom.p75Y))}
                    fill="rgba(0, 102, 204, 0.10)"
                  />
                )}

                {/* 个人中位数参考线 */}
                {chartGeom.medianY !== null && (
                  <g>
                    <line
                      x1={PAD_L}
                      x2={SVG_W - PAD_R}
                      y1={chartGeom.medianY}
                      y2={chartGeom.medianY}
                      stroke="#0b6e4f"
                      strokeDasharray="3 3"
                      strokeWidth={1.15}
                      opacity={0.75}
                    />
                    <text
                      x={PAD_L + 6}
                      y={chartGeom.medianY - 5}
                      textAnchor="start"
                      fontSize={10.5}
                      fill="#0b6e4f"
                    >
                      个人中位数
                    </text>
                  </g>
                )}

                {/* t0 首访自我基线虚线 */}
                {chartGeom.t0Y !== null && (
                  <g>
                    <line
                      x1={PAD_L}
                      x2={SVG_W - PAD_R}
                      y1={chartGeom.t0Y}
                      y2={chartGeom.t0Y}
                      stroke="#0066cc"
                      strokeDasharray="5 4"
                      strokeWidth={1.25}
                      opacity={0.7}
                    />
                    <text
                      x={SVG_W - PAD_R - 4}
                      y={chartGeom.t0Y - 5}
                      textAnchor="end"
                      fontSize={10.5}
                      fill="#0066cc"
                    >
                      t0 基线
                    </text>
                  </g>
                )}

                {/* 仅在同代次可比且非空连续段上绘制实测折线 */}
                {chartGeom.segments.map((ptsStr, idx) => (
                  <polyline
                    key={`raw-${idx}`}
                    fill="none"
                    stroke="#0066cc"
                    strokeWidth={2.5}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    points={ptsStr}
                  />
                ))}

                {/* EWMA 平滑趋势线（同代次可比且非空连续段，琥珀虚线） */}
                {chartGeom.ewmaSegments.map((ptsStr, idx) => (
                  <polyline
                    key={`ewma-${idx}`}
                    fill="none"
                    stroke="#b45309"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    points={ptsStr}
                  />
                ))}

                {/* 访次采样点（实测点实心蓝点，偏离提示加外圈，缺口点空心红圈） */}
                {chartGeom.pts.map((p, idx) => {
                  const cx = chartGeom.xOf(idx);
                  const hasVal = typeof p.value === 'number' && Number.isFinite(p.value);
                  const cy = hasVal ? chartGeom.yOf(p.value as number) : SVG_H - PAD_B - 10;
                  const flagged = isDriftFlagged(p.drift_status);
                  return (
                    <g key={p.session_id + idx}>
                      {hasVal ? (
                        <>
                          {flagged && (
                            <circle
                              cx={cx}
                              cy={cy}
                              r={8.5}
                              fill="none"
                              stroke="#b45309"
                              strokeWidth={1.6}
                              strokeDasharray="2 2"
                            />
                          )}
                          <circle
                            cx={cx}
                            cy={cy}
                            r={5}
                            fill={flagged ? '#b45309' : '#0066cc'}
                            stroke="#ffffff"
                            strokeWidth={2}
                          />
                          <text
                            x={cx}
                            y={Math.max(14, cy - 11)}
                            textAnchor="middle"
                            fontSize={11}
                            fontWeight={600}
                            fill="#1d1d1f"
                          >
                            {fmtVal(p.value)}
                          </text>
                        </>
                      ) : (
                        <>
                          <circle
                            cx={cx}
                            cy={cy}
                            r={5}
                            fill="#ffffff"
                            stroke="#9e1f1f"
                            strokeWidth={2}
                            strokeDasharray="2 2"
                          />
                          <text x={cx} y={cy - 9} textAnchor="middle" fontSize={10.5} fill="#9e1f1f">
                            缺口
                          </text>
                        </>
                      )}
                      <text
                        x={cx}
                        y={SVG_H - 16}
                        textAnchor="middle"
                        fontSize={11}
                        fill="#333333"
                      >
                        {p.visit_label}
                      </text>
                    </g>
                  );
                })}
              </svg>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '6px 18px',
                  padding: '6px 12px 2px',
                  fontSize: 12,
                  color: 'var(--ax-text-secondary)',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span aria-hidden="true" style={{ width: 16, height: 2.5, background: '#0066cc', display: 'inline-block' }} />
                  实测轨迹
                </span>
                {chartGeom.ewmaSegments.length > 0 && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span aria-hidden="true" style={{ width: 16, borderTop: '2px dashed #b45309', display: 'inline-block' }} />
                    EWMA 平滑趋势线
                  </span>
                )}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span aria-hidden="true" style={{ width: 14, height: 10, background: 'rgba(0, 102, 204, 0.14)', border: '1px solid rgba(0, 102, 204, 0.25)', display: 'inline-block' }} />
                  个人稳健参考带 (P25–P75)
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span aria-hidden="true" style={{ width: 14, borderTop: '1.5px dashed #0b6e4f', display: 'inline-block' }} />
                  个人中位数
                </span>
              </div>
            </div>

            {methodology && (
              <div
                style={{
                  fontSize: 12.5,
                  color: 'var(--ax-text-secondary)',
                  background: 'var(--ax-parchment)',
                  border: '1px solid var(--ax-hairline)',
                  borderRadius: 'var(--ax-rounded-sm)',
                  padding: '8px 12px',
                  lineHeight: 1.6,
                }}
              >
                {[methodology.paradigm, methodology.smoothing, methodology.robust_band]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            )}

            <Table
              size="small"
              rowKey={(r) => `${r.visit_order}-${r.session_id}`}
              columns={columns}
              dataSource={activeSeries.points}
              pagination={false}
              scroll={{ x: 760 }}
            />
          </>
        )}
      </Space>
    </Card>
  );
};

export default LongitudinalTrajectorySvg;
