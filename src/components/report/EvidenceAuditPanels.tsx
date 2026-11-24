import React from 'react';
import { Alert, Collapse, Space, Table, Tag, Typography } from 'antd';
import type {
  BlendshapeCalibrationConstruct,
  EvaluationResult,
  FaceDualInstrumentPair,
  FeatureLayerV2Highlight,
  SecondInstrumentRow,
} from '@/types/assessment';

const { Text } = Typography;

const TIER_TONE: Record<string, React.CSSProperties> = {
  T1: { color: '#0b5d2e', background: '#edf7f0', borderColor: '#bfe3cb' },
  T2a: { color: '#0a4a8f', background: '#eef5fc', borderColor: '#c2dcf5' },
  T2b: { color: '#0a4a8f', background: '#eef5fc', borderColor: '#c2dcf5' },
  T3a: { color: '#7a4a05', background: '#fdf6e9', borderColor: '#eed39e' },
  T3b: { color: '#5c5c61', background: '#f5f5f7', borderColor: '#e0e0e0' },
};

const AGREEMENT_TONE: Record<string, React.CSSProperties> = {
  高度一致: TIER_TONE.T1,
  中度一致: TIER_TONE.T2a,
  分歧较大: TIER_TONE.T3a,
  通道未激活: TIER_TONE.T3b,
};

const CALIBRATION_ELIGIBILITY_TONE: Record<string, React.CSSProperties> = {
  已校准可融合: TIER_TONE.T1,
  辅助对照: TIER_TONE.T2a,
  待3D重采验证: TIER_TONE.T3a,
};

const POSE_MODE_BADGE: Record<string, { label: string; style: React.CSSProperties }> = {
  '3d_matrix': { label: '三维姿态矩阵校准', style: TIER_TONE.T1 },
  '2d_legacy': { label: '二维姿态代理校准', style: TIER_TONE.T3a },
  unavailable: { label: '无姿态参照', style: TIER_TONE.T3b },
};

const V2_TRACK_LABEL: Record<string, string> = {
  face_kinematics: '面部运动学',
  voice_dynamics: '语音动力学',
  gesture_smoothness: '上肢平滑度',
  catch22_dynamics: '多通道时序',
};

const fmtHighlightValue = (v: number | null, unit: string): string => {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
  if (unit === '比例') return `${(v * 100).toFixed(1)}%`;
  const abs = Math.abs(v);
  const numStr = abs >= 100 ? v.toFixed(1) : abs >= 1 ? v.toFixed(2) : v.toFixed(3);
  return unit ? `${numStr} ${unit}` : numStr;
};

/**
 * Layer 2 深度查账手风琴面板（默认折叠，一键展开）：
 * 1. 参数来源三级登记（T1 / T2 / T3）；
 * 2. 治理台账（封停 L0 与主动拒绝 L1 指标及解封条件）；
 * 3. 自监督采集信号质检参考（纯 CPU 毫秒级，绝不参与评定）；
 * 4. 第二仪器对照附录（52 项 Blendshape 独立参考）。
 */
const EvidenceAuditPanels: React.FC<{ report: EvaluationResult }> = ({ report }) => {
  const l1 = report.l1;
  if (!l1) return null;

  const pp = l1.parameter_provenance;
  const gov = l1.governance_ledger as any;
  const sq = l1.signal_quality_audit as any;
  const secondInst = l1.second_instrument_appendix;
  const dualInst = l1.face_dual_instrument;
  const bsCal = l1.blendshape_calibration;
  const fv2 = l1.feature_layer_v2;
  const blockedWarns = Array.isArray(l1.blocked_dependency_warnings) ? l1.blocked_dependency_warnings : [];

  const items = [];

  if (pp) {
    items.push({
      key: 'params',
      label: (
        <Space wrap size={8}>
          <strong>测量阈值与参数出处</strong>
          <Tag style={{ margin: 0 }}>共 {pp.n_total} 项</Tag>
          <Tag style={{ margin: 0, ...TIER_TONE.T3a }}>经验阈值 {pp.n_provisional} 项</Tag>
        </Space>
      ),
      children: (
        <div>
          <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--ax-text-secondary)' }}>
            {pp.summary_plain}
          </p>
          <Table
            rowKey="param_id"
            size="small"
            pagination={{ pageSize: 8, showSizeChanger: false }}
            dataSource={Array.isArray(pp.registry) ? pp.registry : []}
            scroll={{ x: 760 }}
            columns={[
              {
                title: '参数名称',
                dataIndex: 'label',
                width: 190,
                render: (t: string, r: any) => (
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{t}</div>
                    <div style={{ fontSize: 11, fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-secondary)' }}>
                      {r.param_id}
                    </div>
                  </div>
                ),
              },
              {
                title: '取值',
                dataIndex: 'value',
                width: 96,
                render: (v: any, r: any) => (
                  <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                    {String(v)}{r.unit ? ` ${r.unit}` : ''}
                  </span>
                ),
              },
              {
                title: '分级',
                dataIndex: 'sub_tier',
                width: 82,
                render: (tier: string) => (
                  <Tag style={{ margin: 0, ...(TIER_TONE[tier] ?? {}) }}>{tier}</Tag>
                ),
              },
              {
                title: '来源依据与升级条件',
                dataIndex: 'provenance',
                render: (prov: string, r: any) => (
                  <div style={{ fontSize: 12.5, lineHeight: 1.55 }}>
                    <div>{prov}</div>
                    <div style={{ color: 'var(--ax-text-secondary)', marginTop: 2 }}>
                      升级条件：{r.upgrade_condition}
                    </div>
                  </div>
                ),
              },
            ]}
          />
        </div>
      ),
    });
  }

  if (gov) {
    const l0Blocked: any[] = Array.isArray(gov.l0_blocked) ? gov.l0_blocked : [];
    const l1Retired: any[] = Array.isArray(gov.retired_redundant)
      ? gov.retired_redundant
      : (Array.isArray(gov.l1_retired) ? gov.l1_retired : []);
    const quarantineActive: any[] = Array.isArray(gov.quarantine_active) ? gov.quarantine_active : [];

    items.push({
      key: 'governance',
      label: (
        <Space wrap size={8}>
          <strong>停用与剔除指标清单</strong>
          <Tag style={{ margin: 0 }}>底层停用 {l0Blocked.length} 项</Tag>
          <Tag style={{ margin: 0 }}>剔除冗余 {l1Retired.length} 项</Tag>
          {quarantineActive.length > 0 && (
            <Tag style={{ margin: 0 }}>旧版隔离 {quarantineActive.length} 项</Tag>
          )}
        </Space>
      ),
      children: (
        <Space direction="vertical" size={14} style={{ width: '100%' }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ax-text-secondary)' }}>
            {gov.summary_plain}
          </p>
          {blockedWarns.length > 0 && (
            <Alert
              type="warning"
              showIcon
              message={`检测到 ${blockedWarns.length} 条指标存在已封停底层列依赖提示`}
              description={blockedWarns.map((w: any) => w.note_plain || w.warning).filter(Boolean).join('；')}
            />
          )}
          {l1Retired.length > 0 && (
            <div>
              <Text strong style={{ display: 'block', marginBottom: 6 }}>主动拒绝与退役的冗余/不可测指标</Text>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: 'var(--ax-text-secondary)' }}>
                {l1Retired.map((r: any, idx: number) => (
                  <li key={r.id || r.name || idx} style={{ marginBottom: 4 }}>
                    <strong style={{ color: 'var(--ax-ink)' }}>{r.label || r.id || r.name}</strong>：{r.reason_plain || r.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {l0Blocked.length > 0 && (
            <div>
              <Text strong style={{ display: 'block', marginBottom: 6 }}>显式封停的 L0 底层字段及解封前置条件</Text>
              <Table
                rowKey={(r: any, idx?: number) => `${r.id || r.column || 'l0'}-${idx ?? 0}`}
                size="small"
                pagination={false}
                dataSource={l0Blocked}
                scroll={{ x: 640 }}
                columns={[
                  {
                    title: '封停项',
                    dataIndex: 'label',
                    width: 190,
                    render: (lbl: string, r: any) => (
                      <div>
                        <div style={{ fontWeight: 600 }}>{lbl || r.column || r.id || '未命名字段'}</div>
                        {r.column && (
                          <div style={{ fontSize: 11, fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-secondary)' }}>
                            {r.modality ? `${r.modality}.${r.column}` : r.column}
                          </div>
                        )}
                      </div>
                    ),
                  },
                  {
                    title: '封停原因',
                    dataIndex: 'reason_plain',
                    render: (v: string, r: any) => v || r.reason || '—',
                  },
                  {
                    title: '解封前置条件',
                    dataIndex: 'unblock_human',
                    width: 240,
                    render: (v: string, r: any) => v || r.unblock_condition || '—',
                  },
                ]}
              />
            </div>
          )}
        </Space>
      ),
    });
  }

  if (sq) {
    const flagged: any[] = Array.isArray(sq.flagged_windows) ? sq.flagged_windows : [];
    items.push({
      key: 'signal-quality',
      label: (
        <Space wrap size={8}>
          <strong>采集画面与信号质量检查</strong>
          {sq.usable_window_ratio != null && (
            <Tag
              style={{
                margin: 0,
                ...(sq.usable_window_ratio >= 0.8 ? TIER_TONE.T1 : TIER_TONE.T3a),
              }}
            >
              信号可用率 {(sq.usable_window_ratio * 100).toFixed(1)}%
            </Tag>
          )}
        </Space>
      ),
      children: (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            message={sq.summary_plain}
            description={sq.disclaimer}
          />
          {sq.cv_metrics && (
            <div style={{ fontSize: 12.5, color: 'var(--ax-text-secondary)' }}>
              离线验证口径：{sq.cv_metrics.model_type} · {sq.cv_metrics.cv_scheme}（{sq.cv_metrics.n_sessions} 场 / {sq.cv_metrics.n_windows_total} 个时间窗），
              ROC-AUC {sq.cv_metrics.cv_roc_auc_mean ?? '—'} · F1 {sq.cv_metrics.cv_f1_mean ?? '—'} ·
              本次纯 CPU 推理耗时 {sq.inference_ms ?? '—'} ms。
            </div>
          )}
          {flagged.length > 0 && (
            <Table
              rowKey="window_index"
              size="small"
              pagination={false}
              dataSource={flagged}
              columns={[
                { title: '帧区间', render: (_: any, r: any) => `第 ${r.start_row + 1}–${r.end_row} 帧`, width: 130 },
                { title: '信号可用概率', dataIndex: 'usability_prob', width: 120, render: (v: number) => `${(v * 100).toFixed(1)}%` },
                { title: '物理异常提示', dataIndex: 'hints', render: (hs: string[]) => (Array.isArray(hs) ? hs.join('；') : String(hs || '')) },
              ]}
            />
          )}
        </Space>
      ),
    });
  }

  if (secondInst?.available || dualInst?.available || bsCal?.available) {
    const appendixRows: SecondInstrumentRow[] = Array.isArray(secondInst?.rows)
      ? secondInst.rows
      : (Array.isArray(secondInst?.items) ? secondInst.items : []);
    const hasPartA = Boolean(secondInst?.available && appendixRows.length > 0);
    const hasPartB = Boolean(dualInst?.available && Array.isArray(dualInst.pairs) && dualInst.pairs.length > 0);
    const hasPartC = Boolean(bsCal?.available);
    const calConstructs = Array.isArray(bsCal?.constructs) ? bsCal.constructs : [];
    const poseBadge = bsCal ? (POSE_MODE_BADGE[bsCal.pose_mode] ?? POSE_MODE_BADGE.unavailable) : POSE_MODE_BADGE.unavailable;

    items.push({
      key: 'second-instrument',
      label: (
        <Space wrap size={8}>
          <strong>面部模型系数对照表</strong>
          <Tag style={{ margin: 0 }}>52 项回归系数独立参考</Tag>
        </Space>
      ),
      children: (
        <div style={{ fontSize: 13, color: 'var(--ax-text-secondary)' }}>
          {secondInst?.available && (
            <p style={{ marginTop: 0 }}>
              {secondInst.disclaimer || secondInst.summary_plain || '以下读数来自 FaceLandmarker 52 项回归系数，独立于主几何代理指标。'}
            </p>
          )}
          {hasPartA && (
            <Table<SecondInstrumentRow>
              rowKey={(r, idx) => r.name || String(idx ?? 0)}
              size="small"
              pagination={false}
              scroll={{ x: 640 }}
              dataSource={appendixRows}
              columns={[
                {
                  title: '对照项',
                  dataIndex: 'label',
                  width: 150,
                  render: (v: string, r) => (
                    <strong style={{ color: 'var(--ax-ink)' }}>{v || r.name}</strong>
                  ),
                },
                {
                  title: '实测值',
                  dataIndex: 'value',
                  width: 140,
                  align: 'right' as const,
                  render: (v: number | null | undefined, r) => (
                    <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--ax-ink)' }}>
                      {typeof v === 'number' && Number.isFinite(v)
                        ? `${v.toFixed(3)}${r.unit ? ` ${r.unit}` : ''}`
                        : '—'}
                    </span>
                  ),
                },
                {
                  title: '有效样本',
                  dataIndex: 'n_valid',
                  width: 96,
                  align: 'right' as const,
                  render: (v: number | undefined) => (
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {typeof v === 'number' && Number.isFinite(v) ? v.toLocaleString('zh-CN') : '—'}
                    </span>
                  ),
                },
                {
                  title: '口径说明',
                  dataIndex: 'comparable_note',
                  render: (v: string | undefined) => (
                    <span style={{ fontSize: 12.5, color: 'var(--ax-text-secondary)' }}>{v || '—'}</span>
                  ),
                },
              ]}
            />
          )}

          {hasPartB && dualInst && (
            <div style={{ marginTop: hasPartA ? 16 : 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ax-ink)', marginBottom: 4 }}>
                双仪器逐构念一致性核对
              </div>
              {dualInst.summary_plain && (
                <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--ax-text-secondary)' }}>
                  {dualInst.summary_plain}
                </p>
              )}
              <Table<FaceDualInstrumentPair>
                rowKey="construct"
                size="small"
                pagination={false}
                scroll={{ x: 640 }}
                dataSource={dualInst.pairs}
                columns={[
                  {
                    title: '行为构念',
                    dataIndex: 'label',
                    width: 170,
                    render: (v: string, r) => (
                      <strong style={{ color: 'var(--ax-ink)' }}>{v || r.construct}</strong>
                    ),
                  },
                  {
                    title: '一致等级',
                    dataIndex: 'agreement_level',
                    width: 115,
                    render: (lvl: string) => (
                      <Tag style={{ margin: 0, ...(AGREEMENT_TONE[lvl] ?? AGREEMENT_TONE['通道未激活']) }}>
                        {lvl}
                      </Tag>
                    ),
                  },
                  {
                    title: '逐帧秩相关',
                    dataIndex: 'spearman_rho',
                    width: 115,
                    align: 'right' as const,
                    render: (v: number | null) => (
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {typeof v === 'number' && Number.isFinite(v) ? v.toFixed(3) : '—'}
                      </span>
                    ),
                  },
                  {
                    title: '变化趋势相关',
                    dataIndex: 'delta_spearman_rho',
                    width: 120,
                    align: 'right' as const,
                    render: (v: number | null) => (
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {typeof v === 'number' && Number.isFinite(v) ? v.toFixed(3) : '—'}
                      </span>
                    ),
                  },
                  {
                    title: '有效帧',
                    dataIndex: 'n_valid',
                    width: 96,
                    align: 'right' as const,
                    render: (v: number) => (
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {typeof v === 'number' && Number.isFinite(v) ? v.toLocaleString('zh-CN') : '—'}
                      </span>
                    ),
                  },
                ]}
              />
              {dualInst.au15_pitch_diagnostic?.available && (
                <div
                  style={{
                    marginTop: 10,
                    padding: '8px 12px',
                    borderRadius: 'var(--ax-rounded-sm)',
                    background: 'var(--ax-parchment)',
                    border: '1px solid var(--ax-hairline)',
                    fontSize: 12.5,
                    color: 'var(--ax-text-secondary)',
                    lineHeight: 1.55,
                  }}
                >
                  {dualInst.au15_pitch_diagnostic.diagnostic_note}
                </div>
              )}
            </div>
          )}

          {hasPartC && bsCal && (
            <div style={{ marginTop: hasPartA || hasPartB ? 16 : 0 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 8,
                  marginBottom: 6,
                }}
              >
                <Space wrap size={8}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--ax-ink)' }}>
                    Part C · 时序平滑与头部姿态校准对照
                  </span>
                  <Tag style={{ margin: 0, ...poseBadge.style }}>{poseBadge.label}</Tag>
                </Space>
                <span style={{ fontSize: 12.5, fontVariantNumeric: 'tabular-nums', color: 'var(--ax-text-secondary)' }}>
                  有效帧 {bsCal.n_clean_frames.toLocaleString('zh-CN')} / {bsCal.n_raw_frames.toLocaleString('zh-CN')}
                  {typeof bsCal.quality_pass_rate === 'number' && Number.isFinite(bsCal.quality_pass_rate)
                    ? ` · 通过率 ${(bsCal.quality_pass_rate * 100).toFixed(1)}%`
                    : ''}
                </span>
              </div>

              {bsCal.summary_plain && (
                <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--ax-text-secondary)', lineHeight: 1.55 }}>
                  {bsCal.summary_plain}
                </p>
              )}

              {calConstructs.length > 0 && (
                <Table<BlendshapeCalibrationConstruct>
                  rowKey="key"
                  size="small"
                  pagination={false}
                  scroll={{ x: 720 }}
                  dataSource={calConstructs}
                  columns={[
                    {
                      title: '面部动作',
                      dataIndex: 'label',
                      width: 240,
                      render: (v: string, r) => (
                        <div>
                          <strong style={{ color: 'var(--ax-ink)' }}>{v || r.key}</strong>
                          {r.note && (
                            <div style={{ fontSize: 12, color: 'var(--ax-text-secondary)', marginTop: 2, lineHeight: 1.45 }}>
                              {r.note}
                            </div>
                          )}
                        </div>
                      ),
                    },
                    {
                      title: '校准前一致度',
                      dataIndex: 'raw_rho',
                      width: 112,
                      align: 'right' as const,
                      render: (v: number | null) => (
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {typeof v === 'number' && Number.isFinite(v) ? v.toFixed(3) : '—'}
                        </span>
                      ),
                    },
                    {
                      title: '校准后一致度',
                      dataIndex: 'calibrated_rho',
                      width: 112,
                      align: 'right' as const,
                      render: (v: number | null) => (
                        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--ax-ink)' }}>
                          {typeof v === 'number' && Number.isFinite(v) ? v.toFixed(3) : '—'}
                        </span>
                      ),
                    },
                    {
                      title: '提升幅值',
                      dataIndex: 'rho_delta',
                      width: 100,
                      align: 'right' as const,
                      render: (v: number | null) => (
                        <span
                          style={{
                            fontVariantNumeric: 'tabular-nums',
                            fontWeight: typeof v === 'number' && v > 0 ? 600 : 400,
                            color: typeof v === 'number' && v > 0 ? 'var(--ax-success)' : 'var(--ax-text-secondary)',
                          }}
                        >
                          {typeof v === 'number' && Number.isFinite(v) ? `${v > 0 ? '+' : ''}${v.toFixed(3)}` : '—'}
                        </span>
                      ),
                    },
                    {
                      title: '头姿解释占比',
                      dataIndex: 'pose_r2',
                      width: 112,
                      align: 'right' as const,
                      render: (v: number | null) => (
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {typeof v === 'number' && Number.isFinite(v) ? `${(v * 100).toFixed(1)}%` : '—'}
                        </span>
                      ),
                    },
                    {
                      title: '融合判定',
                      dataIndex: 'eligibility',
                      width: 128,
                      render: (el: string) => (
                        <Tag style={{ margin: 0, ...(CALIBRATION_ELIGIBILITY_TONE[el] ?? TIER_TONE.T3a) }}>
                          {el}
                        </Tag>
                      ),
                    },
                  ]}
                />
              )}

              {bsCal.disclaimer && (
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ax-text-secondary)', lineHeight: 1.5 }}>
                  {bsCal.disclaimer}
                </div>
              )}
            </div>
          )}
        </div>
      ),
    });
  }

  if (fv2?.available) {
    const highlights: FeatureLayerV2Highlight[] = Array.isArray(fv2.highlights) ? fv2.highlights : [];
    const fwTags: string[] = Array.isArray(fv2.framework_tags) ? fv2.framework_tags : [];
    const nStreams = fv2.tracks?.catch22_dynamics?.n_streams ?? 0;

    items.push({
      key: 'feature-layer-v2',
      label: (
        <Space wrap size={8}>
          <strong>第二层动力学特征明细</strong>
          <Tag style={{ margin: 0, ...TIER_TONE.T2a }}>{highlights.length} 项动力学指标</Tag>
        </Space>
      ),
      children: (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {fwTags.length > 0 && (
            <Space wrap size={6}>
              {fwTags.map((tag) => (
                <Tag key={tag} style={{ margin: 0, ...TIER_TONE.T2a }}>
                  {tag}
                </Tag>
              ))}
            </Space>
          )}

          {fv2.summary_plain && (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--ax-text-secondary)', lineHeight: 1.6 }}>
              {fv2.summary_plain}
            </p>
          )}

          {highlights.length > 0 && (
            <Table<FeatureLayerV2Highlight>
              rowKey="key"
              size="small"
              pagination={false}
              scroll={{ x: 640 }}
              dataSource={highlights}
              columns={[
                {
                  title: '指标名称',
                  dataIndex: 'label',
                  width: 190,
                  render: (v: string, r) => (
                    <strong style={{ color: 'var(--ax-ink)' }}>{v || r.key}</strong>
                  ),
                },
                {
                  title: '实测读数',
                  dataIndex: 'value',
                  width: 150,
                  align: 'right' as const,
                  render: (v: number | null, r) => (
                    <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--ax-ink)' }}>
                      {fmtHighlightValue(v, r.unit)}
                    </span>
                  ),
                },
                {
                  title: '来源通道',
                  dataIndex: 'track',
                  width: 130,
                  render: (track: string) => (
                    <Tag style={{ margin: 0, ...TIER_TONE.T3b }}>
                      {V2_TRACK_LABEL[track] || track}
                    </Tag>
                  ),
                },
                {
                  title: '说明',
                  dataIndex: 'note',
                  render: (v: string) => (
                    <span style={{ fontSize: 12.5, color: 'var(--ax-text-secondary)', lineHeight: 1.5 }}>
                      {v || '—'}
                    </span>
                  ),
                },
              ]}
            />
          )}

          {(nStreams > 0 || typeof fv2.inference_ms === 'number') && (
            <div style={{ fontSize: 12, color: 'var(--ax-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
              {nStreams > 0 ? `已提取 ${nStreams} 条多通道时间序列动力学特征` : '已完成多通道动力学计算'}
              {typeof fv2.inference_ms === 'number' && Number.isFinite(fv2.inference_ms)
                ? ` · 耗时 ${fv2.inference_ms.toFixed(1)} ms`
                : ''}
            </div>
          )}
        </Space>
      ),
    });
  }

  if (items.length === 0) return null;

  return (
    <div style={{ marginBottom: 24 }}>
      <Collapse items={items} />
    </div>
  );
};

export default EvidenceAuditPanels;
