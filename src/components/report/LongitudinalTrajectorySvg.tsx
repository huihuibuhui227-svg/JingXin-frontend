import React, { useMemo, useState } from 'react';
import { Alert, Card, Empty, Segmented, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { LongitudinalMetricSeries } from '@/services/api';

const { Text } = Typography;

interface Props {
  series: LongitudinalMetricSeries[];
  comparable: boolean;
  defVersions: string[];
  comparabilityNotes: string[];
}

const SVG_W = 760;
const SVG_H = 240;
const PAD_L = 56;
const PAD_R = 28;
const PAD_T = 24;
const PAD_B = 42;

const fmtVal = (v: number | null | undefined): string => {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—（缺口）';
  if (Math.abs(v) >= 100) return v.toFixed(1);
  if (Math.abs(v) >= 1) return v.toFixed(2);
  return v.toFixed(3);
};

const LongitudinalTrajectorySvg: React.FC<Props> = ({
  series,
  comparable,
  defVersions,
  comparabilityNotes,
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
    }
    const { p25, p75, t0_baseline } = activeSeries.summary;
    if (typeof p25 === 'number' && Number.isFinite(p25)) nums.push(p25);
    if (typeof p75 === 'number' && Number.isFinite(p75)) nums.push(p75);
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
    if (comparable) {
      let currentRun: string[] = [];
      pts.forEach((p, idx) => {
        if (typeof p.value === 'number' && Number.isFinite(p.value)) {
          currentRun.push(`${xOf(idx).toFixed(1)},${yOf(p.value).toFixed(1)}`);
        } else {
          if (currentRun.length >= 2) segments.push(currentRun.join(' '));
          currentRun = [];
        }
      });
      if (currentRun.length >= 2) segments.push(currentRun.join(' '));
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
      plotW,
      plotH,
      t0Y: typeof t0_baseline === 'number' && Number.isFinite(t0_baseline) ? yOf(t0_baseline) : null,
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
      title: '会话号',
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

  return (
    <Card className="ax-card">
      <Space direction="vertical" size={14} style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <Text strong style={{ fontSize: 16 }}>个体内客观动力学变化轨迹（t0 首访自身基线锚定）</Text>
            <div style={{ fontSize: 12.5, color: 'var(--ax-text-secondary)', marginTop: 2 }}>
              涉及采集版本：{defVersions.length ? defVersions.join(' / ') : '暂未识别版本'} · 遇缺失项保持断线绝不补零
            </div>
          </div>
          {comparable ? (
            <Tag style={{ color: 'var(--ax-success)', background: 'var(--ax-success-soft)', borderColor: 'var(--ax-success-border)' }}>
              同代次口径可比 · 允许折线连续拟合
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
              <Tag>中位数：{fmtVal(activeSeries.summary.median)}</Tag>
              <Tag>P25–P75 四分位带：{fmtVal(activeSeries.summary.p25)} ~ {fmtVal(activeSeries.summary.p75)}</Tag>
            </Space>

            <div
              style={{
                background: 'var(--ax-parchment)',
                border: '1px solid var(--ax-hairline)',
                borderRadius: 'var(--ax-rounded-md)',
                padding: '12px 10px 6px',
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

                {/* P25–P75 中间半数参考带 */}
                {chartGeom.p25Y !== null && chartGeom.p75Y !== null && (
                  <rect
                    x={PAD_L}
                    y={Math.min(chartGeom.p75Y, chartGeom.p25Y)}
                    width={chartGeom.plotW}
                    height={Math.max(2, Math.abs(chartGeom.p25Y - chartGeom.p75Y))}
                    fill="rgba(0, 102, 204, 0.10)"
                  />
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

                {/* 仅在同代次可比且非空连续段上绘制折线 */}
                {chartGeom.segments.map((ptsStr, idx) => (
                  <polyline
                    key={idx}
                    fill="none"
                    stroke="#0066cc"
                    strokeWidth={2.5}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    points={ptsStr}
                  />
                ))}

                {/* 访次采样点（实测点实心蓝点，缺口点空心红圈） */}
                {chartGeom.pts.map((p, idx) => {
                  const cx = chartGeom.xOf(idx);
                  const hasVal = typeof p.value === 'number' && Number.isFinite(p.value);
                  const cy = hasVal ? chartGeom.yOf(p.value as number) : SVG_H - PAD_B - 10;
                  return (
                    <g key={p.session_id + idx}>
                      {hasVal ? (
                        <>
                          <circle cx={cx} cy={cy} r={5} fill="#0066cc" stroke="#ffffff" strokeWidth={2} />
                          <text
                            x={cx}
                            y={Math.max(14, cy - 10)}
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
            </div>

            <Table
              size="small"
              rowKey={(r) => `${r.visit_order}-${r.session_id}`}
              columns={columns}
              dataSource={activeSeries.points}
              pagination={false}
              scroll={{ x: 680 }}
            />
          </>
        )}
      </Space>
    </Card>
  );
};

export default LongitudinalTrajectorySvg;
