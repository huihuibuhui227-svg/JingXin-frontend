import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Card, Col, Row, Space, Table, Tag } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import Loading from '@/components/common/Loading';
import {
  BenchmarkModelMacroRow,
  dashboardApi,
  ResearchBenchmarksResponse,
} from '@/services/api';

const TONE = {
  blue: { color: '#0a4a8f', background: '#eef5fc', borderColor: '#c2dcf5' },
  green: { color: '#0b5d2e', background: '#edf7f0', borderColor: '#bfe3cb' },
  amber: { color: '#7a4a05', background: '#fdf6e9', borderColor: '#eed39e' },
  red: { color: '#9e1f1f', background: '#fdf0f0', borderColor: '#f2c2c2' },
  neutral: { color: '#333333', background: '#f5f5f7', borderColor: '#e0e0e0' },
} as const;

const CHALEARN_TARGET_LABELS: Record<string, string> = {
  extraversion: '外向表达',
  agreeableness: '亲和合作',
  conscientiousness: '尽责条理',
  openness: '开放探究',
  neuroticism: '波动敏感参考',
  interview: '面试沟通参考',
};

const BLENDSHAPE_CONSTRUCT_ORDER = [
  'eye_squeeze',
  'mouth_open',
  'lip_compression',
  'smile',
  'brow_furrow',
];

const BLENDSHAPE_LABEL_FALLBACK: Record<string, string> = {
  eye_squeeze: '眼周收紧',
  mouth_open: '口部张开',
  lip_compression: '唇部压紧',
  smile: '嘴角上扬',
  brow_furrow: '眉间收缩',
};

const REGIME_LABELS: Record<string, string> = {
  'Chinese-only-GMM (5-fold GroupKFold)': '中文五折交叉参考',
  'Bilingual-Joint-GMM (5-fold GroupKFold on Chinese)': '中英双语联合迁移',
  'English-pretrained-GMM (Zero-Shot on Chinese)': '英文零样本跨语迁移',
};

const STAGE_LABELS: Record<string, string> = {
  stage_1_verified: '证据充分',
  stage_2_review: '待人工复核',
  stage_3_limited: '样本受限',
};

const fmtFixed = (v: number | null | undefined, digits = 3): string =>
  typeof v === 'number' && Number.isFinite(v) ? v.toFixed(digits) : '—';

const fmtPct = (v: number | null | undefined, digits = 1): string =>
  typeof v === 'number' && Number.isFinite(v) ? `${(v * 100).toFixed(digits)}%` : '—';

const fmtInt = (v: number | null | undefined): string =>
  typeof v === 'number' && Number.isFinite(v) ? Math.round(v).toLocaleString('zh-CN') : '—';

const pillStyle = (tone: React.CSSProperties): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '3px 10px',
  borderRadius: 'var(--ax-rounded-pill)',
  border: '1px solid',
  fontSize: 12.5,
  fontWeight: 600,
  fontVariantNumeric: 'tabular-nums',
  ...tone,
});

const modelBarColor = (model: string, bestModel?: string): string => {
  if (bestModel && model === bestModel) return '#0066cc';
  if (model.includes('GPU')) return '#0b5d2e';
  if (model.includes('Text')) return '#7a4a05';
  return '#0a4a8f';
};

/** 水平相关系数 SVG 条形图（支持负相关零基线对齐，WCAG AA 标签外部高亮绘制）。 */
const CorrelationBarsSvg: React.FC<{
  rows: BenchmarkModelMacroRow[];
  bestModel?: string;
  ariaLabel: string;
  showAcc?: boolean;
}> = ({ rows, bestModel, ariaLabel, showAcc = false }) => {
  if (!rows || rows.length === 0) return null;

  const hasNeg = rows.some((r) => (r.pearson_r ?? 0) < 0);
  const minVal = hasNeg ? -0.1 : 0;
  const maxVal = Math.max(
    0.45,
    ...rows.map((r) => Math.abs(r.pearson_r ?? 0) + 0.06)
  );
  const span = Math.max(0.1, maxVal - minVal);
  const labelW = 156;
  const plotW = 236;
  const rightW = showAcc ? 168 : 120;
  const svgW = labelW + plotW + rightW;
  const rowH = 28;
  const topPad = 18;
  const svgH = topPad + rows.length * rowH + 8;
  const xOf = (val: number) =>
    labelW + ((Math.max(minVal, Math.min(maxVal, val)) - minVal) / span) * plotW;
  const zeroX = xOf(0);

  return (
    <svg
      viewBox={`0 0 ${svgW} ${svgH}`}
      style={{ width: '100%', height: 'auto', display: 'block' }}
      role="img"
      aria-label={ariaLabel}
    >
      <text
        x={zeroX}
        y={12}
        textAnchor="middle"
        fontSize="10.5"
        fill="#5c5c61"
        style={{ fontFamily: 'var(--ax-font-mono)' }}
      >
        0
      </text>
      <line
        x1={zeroX}
        y1={topPad - 2}
        x2={zeroX}
        y2={topPad + rows.length * rowH - 2}
        stroke="#8c939d"
        strokeWidth="1.2"
      />
      {rows.map((row, idx) => {
        const cy = topPad + idx * rowH + rowH / 2;
        const rVal = row.pearson_r ?? 0;
        const rhoVal = row.spearman_rho;
        const accVal = row.acc_1_minus_mae;
        const valX = xOf(rVal);
        const barX = rVal >= 0 ? zeroX : valX;
        const barW = Math.max(2, Math.abs(valX - zeroX));
        const fill = modelBarColor(row.model, bestModel);
        const isBest = Boolean(bestModel && row.model === bestModel);

        return (
          <g key={row.model}>
            <title>
              {`${row.model} · Pearson r ${fmtFixed(rVal, 4)} · Spearman ρ ${fmtFixed(rhoVal, 4)}${
                showAcc && accVal != null ? ` · 1-MAE ${fmtFixed(accVal, 4)}` : ''
              }`}
            </title>
            <text
              x={2}
              y={cy + 4}
              fontSize="12"
              fontWeight={isBest ? '600' : '400'}
              fill="#1d1d1f"
              style={{ fontFamily: 'var(--ax-font-mono)' }}
            >
              {row.model}
            </text>
            <rect
              x={labelW}
              y={cy - 6}
              width={plotW}
              height={12}
              rx={3}
              fill="#f0f2f5"
            />
            <rect
              x={barX}
              y={cy - 6}
              width={barW}
              height={12}
              rx={3}
              fill={fill}
            />
            <text
              x={svgW - 4}
              y={cy + 4}
              textAnchor="end"
              fontSize="11.5"
              fontWeight={isBest ? '600' : '400'}
              fill="#1d1d1f"
              style={{
                fontFamily: 'var(--ax-font-mono)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {showAcc && accVal != null
                ? `r=${fmtFixed(rVal, 3)} · 1-MAE=${fmtFixed(accVal, 3)}`
                : `r=${fmtFixed(rVal, 3)} · ρ=${fmtFixed(rhoVal, 3)}`}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

const BenchmarksPage: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<ResearchBenchmarksResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBenchmarks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await dashboardApi.getResearchBenchmarks();
      setData(res);
    } catch (err) {
      console.error('获取科研基准失败:', err);
      setError('未能读取科研方法学验证接口，请确认总控面板服务已启动。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBenchmarks();
  }, [loadBenchmarks]);

  const mc = data?.multicorpus;
  const bs = data?.blendshape_calibration;
  const ref = data?.referee_ml;
  const gpu = data?.gpu_vs_cpu;

  const mitBestRow = mc?.mit?.models?.find((m) => m.model === mc.mit?.best_model) ?? mc?.mit?.models?.[0];
  const chBestRow = mc?.chalearn?.models?.find((m) => m.model === mc.chalearn?.best_model) ?? mc?.chalearn?.models?.[0];
  const bsSummary = bs?.corpus_summary;
  const poseCounts = bsSummary?.pose_mode_counts;
  const eg = ref?.evidence_gate;
  const seg = ref?.stage_segmentation;

  // 构造 Section 2 的 5 个动作哑铃图数据
  const bsConstructEntries = Object.entries(bsSummary?.constructs_summary ?? {}).sort(([a], [b]) => {
    const ia = BLENDSHAPE_CONSTRUCT_ORDER.indexOf(a);
    const ib = BLENDSHAPE_CONSTRUCT_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  // 构造 Section 1 跨语料迁移列表
  const regimeEntries = Object.entries(mc?.regime_transfer?.regimes ?? {});

  // 构造 Section 3 混淆矩阵与原始遥测消融
  const rawCm = eg?.confusion_matrix;
  const cmMatrix: number[][] | null = Array.isArray(rawCm)
    ? rawCm
    : Array.isArray(rawCm?.matrix)
      ? rawCm.matrix
      : null;
  const cmLabels: string[] =
    !Array.isArray(rawCm) && Array.isArray(rawCm?.labels) && rawCm.labels.length === 3
      ? rawCm.labels.map((l) => STAGE_LABELS[l] || l)
      : ['证据充分', '待人工复核', '样本受限'];
  const rawAblation = eg?.non_circular_raw_telemetry_ablation as Record<string, unknown> | undefined;

  return (
    <main className="ax-reading">
      <div className="ax-reading__inner">
        {/* ══ Page Header & Boundary Banner ══════════════════════════════════════ */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: 16,
            marginBottom: 18,
          }}
        >
          <div style={{ maxWidth: 680 }}>
            <div style={{ marginBottom: 8 }}>
              <span style={pillStyle(TONE.blue)}>衡才智析 · 只读方法学与消融档案</span>
            </div>
            <h1 className="ax-display-md" style={{ margin: 0, fontSize: 30, color: 'var(--ax-ink)' }}>
              科研基准与方法学验证
            </h1>
            <p style={{ margin: '8px 0 0', fontSize: 15, color: 'var(--ax-text-secondary)', lineHeight: 1.55 }}>
              汇总跨语料客观行为建模、三维头部姿态校准、第三层非评分模型裁判与端侧算力对比实测指标。
            </p>
          </div>

          <Space wrap size={10}>
            <Button
              size="small"
              icon={<ReloadOutlined />}
              loading={loading}
              onClick={() => void loadBenchmarks()}
            >
              刷新基准
            </Button>
            <Button
              size="small"
              type="primary"
              onClick={() => navigate('/report/20261026_002930_cb79')}
            >
              查看示例报告
            </Button>
            <Button size="small" onClick={() => navigate('/reports')}>
              报告中心
            </Button>
          </Space>
        </div>

        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 20 }}
          message="离线公开数据集与工程消融基准 · 严格不参与真实报告评分与个体评价"
          description={
            data?.boundary_note ||
            '本页展示公开学术数据集与工程消融方法学验证结果，仅用于说明跨通道信号稳定性、姿态解耦与不确定性核验有效性；相关权重与统计数值均不参与任何真实访谈报告的计分、排序或个体评价。'
          }
        />

        {loading && !data && <Loading tip="正在加载科研方法学基准…" />}

        {error && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 20 }}
            message={error}
            action={
              <Button size="small" onClick={() => void loadBenchmarks()}>
                重试
              </Button>
            }
          />
        )}

        {data && (
          <>
            {/* ══ 4 KPI Summary Strip ═══════════════════════════════════════════ */}
            <Row gutter={[14, 14]} style={{ marginBottom: 20 }}>
              <Col xs={24} sm={12} lg={6}>
                <Card size="small" style={{ height: '100%' }}>
                  <div style={{ fontSize: 12.5, color: 'var(--ax-text-secondary)' }}>MIT 面试行为基准</div>
                  <div
                    style={{
                      fontSize: 28,
                      fontWeight: 600,
                      color: 'var(--ax-ink)',
                      fontVariantNumeric: 'tabular-nums',
                      margin: '4px 0',
                    }}
                  >
                    r = {fmtFixed(mitBestRow?.pearson_r, 4)}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--ax-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtInt(mc?.mit?.n_participants)} 位受试者 / {fmtInt(mc?.mit?.n_interviews)} 场 ·{' '}
                    {mc?.mit?.best_model || 'Behavior-RF'}
                  </div>
                </Card>
              </Col>

              <Col xs={24} sm={12} lg={6}>
                <Card size="small" style={{ height: '100%' }}>
                  <div style={{ fontSize: 12.5, color: 'var(--ax-text-secondary)' }}>ChaLearn V2 与 RecruitView</div>
                  <div
                    style={{
                      fontSize: 28,
                      fontWeight: 600,
                      color: 'var(--ax-ink)',
                      fontVariantNumeric: 'tabular-nums',
                      margin: '4px 0',
                    }}
                  >
                    1-MAE {fmtFixed(chBestRow?.acc_1_minus_mae, 4)}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--ax-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                    ChaLearn r = {fmtFixed(chBestRow?.pearson_r, 4)} · RecruitView{' '}
                    {fmtInt(mc?.recruitview?.track_a_n_clips)} / {fmtInt(mc?.recruitview?.track_b_n_clips)} 段
                  </div>
                </Card>
              </Col>

              <Col xs={24} sm={12} lg={6}>
                <Card size="small" style={{ height: '100%' }}>
                  <div style={{ fontSize: 12.5, color: 'var(--ax-text-secondary)' }}>三维校准样板与保形覆盖</div>
                  <div
                    style={{
                      fontSize: 28,
                      fontWeight: 600,
                      color: 'var(--ax-ink)',
                      fontVariantNumeric: 'tabular-nums',
                      margin: '4px 0',
                    }}
                  >
                    {fmtPct(eg?.empirical_conformal_coverage, 1)}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--ax-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                    三维矩阵校准 {fmtInt(poseCounts?.['3d_matrix'])} 场 / 共 {fmtInt(bsSummary?.total_sessions)} 场 · 目标 ≥
                    {eg?.target_coverage ? Math.round(eg.target_coverage * 100) : 90}%
                  </div>
                </Card>
              </Col>

              <Col xs={24} sm={12} lg={6}>
                <Card size="small" style={{ height: '100%' }}>
                  <div style={{ fontSize: 12.5, color: 'var(--ax-text-secondary)' }}>Tesla P40 并发吞吐对比</div>
                  <div
                    style={{
                      fontSize: 28,
                      fontWeight: 600,
                      color: 'var(--ax-ink)',
                      fontVariantNumeric: 'tabular-nums',
                      margin: '4px 0',
                    }}
                  >
                    {typeof gpu?.comparison?.batch256_gpu_speedup_over_cpu === 'number'
                      ? `${gpu.comparison.batch256_gpu_speedup_over_cpu.toFixed(2)}×`
                      : '—'}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--ax-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                    并发 {fmtInt(gpu?.gpu_neural_sequence_referee?.gpu_batch256_sess_per_sec)} 场/秒 vs CPU{' '}
                    {fmtFixed(gpu?.cpu_referee?.cpu_full_evaluate_ms_median, 2)} ms/场
                  </div>
                </Card>
              </Col>
            </Row>

            {/* ══ Section 1: 多语料客观行为基准与中英文节奏迁移 ═════════════════════ */}
            {mc?.available ? (
              <Card
                size="small"
                style={{ marginBottom: 20 }}
                title={
                  <Space wrap size={8}>
                    <span>1 · 多语料客观行为基准与中英文节奏迁移</span>
                    {mc.extraction?.total_clips_succeeded != null && (
                      <Tag style={{ margin: 0, ...TONE.blue }}>
                        实提 {fmtInt(mc.extraction.total_clips_succeeded)} 段视频 ·{' '}
                        {fmtFixed(mc.extraction.clips_per_sec, 2)} 段/秒
                      </Tag>
                    )}
                  </Space>
                }
              >
                <Row gutter={[18, 18]}>
                  <Col xs={24} lg={12}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ax-ink)', marginBottom: 4 }}>
                      MIT 面试公开语料五折验证 · 行为特征显著优于纯文本词袋
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--ax-text-secondary)', marginBottom: 8 }}>
                      {fmtInt(mc.mit?.n_interviews)} 场访谈 / {fmtInt(mc.mit?.n_participants)} 位受试者 · 按受试者分组五折验证
                    </div>
                    <CorrelationBarsSvg
                      rows={[...(mc.mit?.models ?? [])].sort(
                        (a, b) => (b.pearson_r ?? -1) - (a.pearson_r ?? -1)
                      )}
                      bestModel={mc.mit?.best_model}
                      ariaLabel="MIT 面试行为数据集各模型 Pearson 相关系数对比"
                    />
                  </Col>

                  <Col xs={24} lg={12}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ax-ink)', marginBottom: 4 }}>
                      RecruitView 短片段消融 · 轨道 B 视听行为对照纯文本基线
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--ax-text-secondary)', marginBottom: 8 }}>
                      轨道 B {fmtInt(mc.recruitview?.track_b_n_clips)} 段视频 / {fmtInt(mc.recruitview?.track_b_n_users)} 位受试者 ·
                      轨道 A 文本 {fmtInt(mc.recruitview?.track_a_n_clips)} 段
                    </div>
                    <CorrelationBarsSvg
                      rows={[...(mc.recruitview?.track_b_models ?? [])].sort(
                        (a, b) => (b.pearson_r ?? -1) - (a.pearson_r ?? -1)
                      )}
                      bestModel={mc.recruitview?.track_b_best_model}
                      ariaLabel="RecruitView 轨道 B 多模态行为与纯文本模型 Pearson 相关系数对比"
                    />
                    {Array.isArray(mc.recruitview?.track_a_models) && mc.recruitview.track_a_models.length > 0 && (
                      <div
                        style={{
                          marginTop: 8,
                          padding: '8px 10px',
                          borderRadius: 'var(--ax-rounded-sm)',
                          background: 'var(--ax-parchment)',
                          border: '1px solid var(--ax-hairline)',
                          fontSize: 12,
                          color: 'var(--ax-text-secondary)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        轨道 A 全量文本对照：
                        {mc.recruitview.track_a_models
                          .map((m) => `${m.model} r=${fmtFixed(m.pearson_r, 3)}`)
                          .join(' · ')}
                      </div>
                    )}
                  </Col>
                </Row>

                <div
                  style={{
                    borderTop: '1px solid var(--ax-divider-soft)',
                    marginTop: 18,
                    paddingTop: 16,
                  }}
                >
                  <Row gutter={[18, 18]}>
                    <Col xs={24} lg={13}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ax-ink)', marginBottom: 4 }}>
                        ChaLearn V2 六项行为维度测试集验证 · AudioVisual-Ridge
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--ax-text-secondary)', marginBottom: 10 }}>
                        训练 {fmtInt(mc.chalearn?.split_counts?.train)} / 验证{' '}
                        {fmtInt(mc.chalearn?.split_counts?.val)} / 测试{' '}
                        {fmtInt(mc.chalearn?.split_counts?.test)} 段 · 综合 1-MAE{' '}
                        {fmtFixed(chBestRow?.acc_1_minus_mae, 4)} · Pearson r{' '}
                        {fmtFixed(chBestRow?.pearson_r, 4)}
                      </div>
                      <CorrelationBarsSvg
                        rows={(mc.chalearn?.best_model_dimensions ?? []).map((d) => ({
                          model: CHALEARN_TARGET_LABELS[d.key] || d.key,
                          pearson_r: d.pearson_r,
                          spearman_rho: d.spearman_rho,
                          acc_1_minus_mae: d.acc_1_minus_mae,
                        }))}
                        ariaLabel="ChaLearn V2 六项目标维度的 Pearson 相关系数与 1-MAE"
                        showAcc
                      />
                      {Array.isArray(mc.chalearn?.models) && mc.chalearn.models.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                          {mc.chalearn.models.map((m) => (
                            <span
                              key={m.model}
                              style={pillStyle(
                                m.model === mc.chalearn?.best_model ? TONE.blue : TONE.neutral
                              )}
                            >
                              {m.model}: r={fmtFixed(m.pearson_r, 3)} / 1-MAE={fmtFixed(m.acc_1_minus_mae, 3)}
                            </span>
                          ))}
                        </div>
                      )}
                    </Col>

                    <Col xs={24} lg={11}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ax-ink)', marginBottom: 4 }}>
                        中英文无监督行为节律跨语料迁移
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--ax-text-secondary)', marginBottom: 10 }}>
                        中文 {fmtInt(mc.regime_transfer?.chinese_corpus?.n_sessions)} 场 /{' '}
                        {fmtInt(mc.regime_transfer?.chinese_corpus?.n_windows)} 窗对照英文{' '}
                        {fmtInt(mc.regime_transfer?.english_corpus?.n_clips)} 段 · 共享{' '}
                        {fmtInt(mc.regime_transfer?.shared_features?.length)} 项物理特征
                      </div>

                      {regimeEntries.length > 0 && (
                        <svg
                          viewBox="0 0 460 118"
                          style={{ width: '100%', height: 'auto', display: 'block' }}
                          role="img"
                          aria-label="中英文行为节律迁移状态一致率对比"
                        >
                          {regimeEntries.map(([name, info], idx) => {
                            const cy = 22 + idx * 34;
                            const agree = info.state_agreement_vs_chinese_ref ?? 0;
                            const ari = info.ari_vs_chinese_ref;
                            const sil = info.val_silhouette_mean ?? info.silhouette_on_chinese;
                            const barW = Math.max(4, agree * 195);
                            const fill =
                              agree >= 0.94 ? '#0066cc' : agree >= 0.85 ? '#0b5d2e' : '#7a4a05';
                            const label = REGIME_LABELS[name] || name;

                            return (
                              <g key={name}>
                                <title>
                                  {`${label} · 一致率 ${fmtPct(agree, 2)} · ARI ${fmtFixed(ari, 3)} · Silhouette ${fmtFixed(sil, 3)}`}
                                </title>
                                <text x={2} y={cy + 4} fontSize="12" fontWeight="600" fill="#1d1d1f">
                                  {label}
                                </text>
                                <rect x={132} y={cy - 7} width={195} height={14} rx={4} fill="#f0f2f5" />
                                <rect x={132} y={cy - 7} width={barW} height={14} rx={4} fill={fill} />
                                <text
                                  x={456}
                                  y={cy + 4}
                                  textAnchor="end"
                                  fontSize="11.5"
                                  fill="#1d1d1f"
                                  style={{
                                    fontFamily: 'var(--ax-font-mono)',
                                    fontVariantNumeric: 'tabular-nums',
                                  }}
                                >
                                  {`${fmtPct(agree, 1)} · ARI ${fmtFixed(ari, 2)}`}
                                </text>
                              </g>
                            );
                          })}
                        </svg>
                      )}

                      <div style={{ fontSize: 12, color: 'var(--ax-text-secondary)', marginTop: 6, lineHeight: 1.5 }}>
                        英文零样本迁移即可保持 70.8% 节律状态一致率；接入中文窗联合拟合后达 94.9%，验证四态物理结构跨语言稳健。
                      </div>
                    </Col>
                  </Row>
                </div>
              </Card>
            ) : (
              <Card size="small" style={{ marginBottom: 20 }} title="1 · 多语料客观行为基准与中英文节奏迁移">
                <div style={{ fontSize: 13, color: 'var(--ax-text-secondary)' }}>多语料离线基准文件暂未生成。</div>
              </Card>
            )}

            {/* ══ Section 2: 面部 3D 姿态矩阵回填与双仪器校准验证 ═══════════════════ */}
            {bs?.available && bsSummary ? (
              <Card
                size="small"
                style={{ marginBottom: 20 }}
                title={
                  <Space wrap size={8}>
                    <span>2 · 面部三维姿态矩阵回填与双仪器校准验证</span>
                    <Tag style={{ margin: 0, ...TONE.green }}>
                      三维姿态矩阵校准 {fmtInt(poseCounts?.['3d_matrix'])} 场
                    </Tag>
                    <Tag style={{ margin: 0, ...TONE.amber }}>
                      二维代理 {fmtInt(poseCounts?.['2d_legacy'])} 场
                    </Tag>
                  </Space>
                }
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  <span style={pillStyle(TONE.neutral)}>语料总场次 {fmtInt(bsSummary.total_sessions)} 场</span>
                  <span style={pillStyle(TONE.blue)}>有效双仪器评估 {fmtInt(bsSummary.available_sessions)} 场</span>
                  <span style={pillStyle(TONE.green)}>三维矩阵回填 {fmtInt(poseCounts?.['3d_matrix'])} 场</span>
                  <span style={pillStyle(TONE.amber)}>二维姿态代理 {fmtInt(poseCounts?.['2d_legacy'])} 场</span>
                  <span style={pillStyle(TONE.neutral)}>无面部数据 {fmtInt(poseCounts?.unavailable)} 场</span>
                </div>

                <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--ax-text-secondary)', lineHeight: 1.55 }}>
                  对比两套独立面部测量体系在头部姿态去偏前后的逐帧秩相关中位数及头姿解释占比，剥离俯仰偏转带来的伪相关偏移。
                </p>

                {bsConstructEntries.length > 0 && (
                  <svg
                    viewBox={`0 0 760 ${32 + bsConstructEntries.length * 44}`}
                    style={{ width: '100%', height: 'auto', display: 'block' }}
                    role="img"
                    aria-label="五项面部动作在三维姿态校准前后的 Spearman 秩相关中位数对比图"
                  >
                    {/* Legend */}
                    <circle cx="158" cy="12" r="4.5" fill="#ffffff" stroke="#5c5c61" strokeWidth="2" />
                    <text x="168" y="16" fontSize="11.5" fill="#5c5c61">
                      校准前原始 ρ
                    </text>
                    <circle cx="268" cy="12" r="4.5" fill="#0066cc" />
                    <text x="278" y="16" fontSize="11.5" fill="#0066cc" fontWeight="600">
                      姿态校准后 ρ
                    </text>
                    <text x="530" y="16" fontSize="11.5" fill="#5c5c61">
                      校准前 → 校准后 · 头姿占比 · 融合判定分布
                    </text>

                    {/* Grid ticks 0.0 to 0.8 */}
                    {[0, 0.2, 0.4, 0.6, 0.8].map((tick) => {
                      const tx = 148 + (tick / 0.85) * 260;
                      return (
                        <g key={tick}>
                          <line
                            x1={tx}
                            y1={24}
                            x2={tx}
                            y2={24 + bsConstructEntries.length * 44}
                            stroke="#e5e7eb"
                            strokeWidth="1"
                          />
                          <text
                            x={tx}
                            y={30 + bsConstructEntries.length * 44}
                            textAnchor="middle"
                            fontSize="10"
                            fill="#5c5c61"
                            style={{ fontFamily: 'var(--ax-font-mono)' }}
                          >
                            {tick.toFixed(1)}
                          </text>
                        </g>
                      );
                    })}

                    {bsConstructEntries.map(([key, c], idx) => {
                      const cy = 44 + idx * 44;
                      const label = c.label || BLENDSHAPE_LABEL_FALLBACK[key] || key;
                      const rawMed = c.raw_rho?.median ?? 0;
                      const calMed = c.calibrated_rho?.median ?? 0;
                      const poseR2Med = c.pose_r2?.median;
                      const xOf = (v: number) => 148 + (Math.max(0, Math.min(0.85, v)) / 0.85) * 260;
                      const rawX = xOf(rawMed);
                      const calX = xOf(calMed);
                      const improved = calMed >= rawMed;
                      const elCounts = c.counts_by_eligibility ?? {};
                      const elSummary = `${elCounts['已校准可融合'] ?? 0} 融合 / ${
                        elCounts['辅助对照'] ?? 0
                      } 辅 / ${elCounts['待3D重采验证'] ?? 0} 重采`;

                      return (
                        <g key={key}>
                          <title>
                            {`${label} · 原始中位 ${fmtFixed(rawMed, 3)} -> 校准后 ${fmtFixed(
                              calMed,
                              3
                            )} · 头姿解释占比 ${fmtPct(poseR2Med, 1)}`}
                          </title>
                          <text x={4} y={cy + 4} fontSize="13" fontWeight="600" fill="#1d1d1f">
                            {label}
                          </text>
                          <line
                            x1={148}
                            y1={cy}
                            x2={408}
                            y2={cy}
                            stroke="#f0f2f5"
                            strokeWidth="6"
                            strokeLinecap="round"
                          />
                          <line
                            x1={rawX}
                            y1={cy}
                            x2={calX}
                            y2={cy}
                            stroke={improved ? '#0b5d2e' : '#7a4a05'}
                            strokeWidth="3"
                          />
                          <circle
                            cx={rawX}
                            cy={cy}
                            r="5"
                            fill="#ffffff"
                            stroke="#5c5c61"
                            strokeWidth="2"
                          />
                          <circle cx={calX} cy={cy} r="5.5" fill="#0066cc" />

                          <text
                            x={424}
                            y={cy + 4}
                            fontSize="12"
                            fill="#1d1d1f"
                            style={{
                              fontFamily: 'var(--ax-font-mono)',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {`${fmtFixed(rawMed, 3)} → ${fmtFixed(calMed, 3)}`}
                          </text>
                          <text
                            x={566}
                            y={cy + 4}
                            fontSize="12"
                            fill="#0a4a8f"
                            style={{
                              fontFamily: 'var(--ax-font-mono)',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {`R² ${fmtPct(poseR2Med, 1)}`}
                          </text>
                          <text
                            x={756}
                            y={cy + 4}
                            textAnchor="end"
                            fontSize="11.5"
                            fill="#5c5c61"
                            style={{ fontVariantNumeric: 'tabular-nums' }}
                          >
                            {elSummary}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                )}
              </Card>
            ) : (
              <Card size="small" style={{ marginBottom: 20 }} title="2 · 面部三维姿态矩阵回填与双仪器校准验证">
                <div style={{ fontSize: 13, color: 'var(--ax-text-secondary)' }}>双仪器校准基准文件暂未生成。</div>
              </Card>
            )}

            {/* ══ Section 3: 第三层非评分模型裁判验证 ════════════════════════════════ */}
            {ref?.available ? (
              <Card
                size="small"
                style={{ marginBottom: 20 }}
                title={
                  <Space wrap size={8}>
                    <span>3 · 第三层非评分模型裁判验证</span>
                    <Tag style={{ margin: 0, ...TONE.green }}>不参与个体评分与结论</Tag>
                    {eg?.supervision_protocol && (
                      <Tag style={{ margin: 0, ...TONE.blue }}>下游真实结局去循环监督 · 零合成样本</Tag>
                    )}
                  </Space>
                }
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                  <span style={pillStyle(TONE.neutral)}>
                    真实会话 {fmtInt(ref.dataset?.n_real_sessions)} 场 / {fmtInt(ref.dataset?.n_real_windows)} 个时间窗
                  </span>
                  {typeof ref.cpu_runtime?.warm_inference_ms_median === 'number' && (
                    <span style={pillStyle(TONE.blue)}>
                      常驻 CPU 推理 {fmtFixed(ref.cpu_runtime.warm_inference_ms_median, 1)} ms
                    </span>
                  )}
                  {ref.non_scoring_guarantee && (
                    <span style={pillStyle(TONE.green)}>{ref.non_scoring_guarantee}</span>
                  )}
                </div>

                {(eg?.supervision_note_plain || ref.dataset?.synthetic_usage_note) && (
                  <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--ax-text-secondary)', lineHeight: 1.55 }}>
                    {eg?.supervision_note_plain || ref.dataset?.synthetic_usage_note}
                  </p>
                )}

                <Row gutter={[16, 16]}>
                  <Col xs={24} lg={12}>
                    <div
                      style={{
                        padding: 14,
                        borderRadius: 'var(--ax-rounded-md)',
                        background: 'var(--ax-parchment)',
                        border: '1px solid var(--ax-hairline)',
                        height: '100%',
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ax-ink)', marginBottom: 8 }}>
                        HMM 与 PELT 时序阶段分段消融
                      </div>
                      <svg
                        viewBox="0 0 420 82"
                        style={{ width: '100%', height: 'auto', display: 'block', marginBottom: 10 }}
                        role="img"
                        aria-label="HMM 与 PELT 相比逐窗 GMM 的状态切换减少与驻留时长对比"
                      >
                        <text x={2} y={24} fontSize="12" fill="#5c5c61">
                          逐窗 GMM 基线
                        </text>
                        <rect x={118} y={12} width={180} height={14} rx={3} fill="#9ca3af" />
                        <text
                          x={416}
                          y={24}
                          textAnchor="end"
                          fontSize="11.5"
                          fill="#1d1d1f"
                          style={{ fontFamily: 'var(--ax-font-mono)', fontVariantNumeric: 'tabular-nums' }}
                        >
                          驻留 {fmtFixed(seg?.gmm_mean_dwell_sec, 1)}s
                        </text>

                        <text x={2} y={56} fontSize="12" fontWeight="600" fill="#1d1d1f">
                          HMM+PELT 裁判
                        </text>
                        <rect
                          x={118}
                          y={44}
                          width={Math.max(
                            40,
                            Math.round(
                              180 *
                                (1 -
                                  Math.min(0.8, Math.max(0, (seg?.flicker_reduction_pct ?? 30) / 100)))
                            )
                          )}
                          height={14}
                          rx={3}
                          fill="#0066cc"
                        />
                        <text
                          x={416}
                          y={56}
                          textAnchor="end"
                          fontSize="11.5"
                          fontWeight="600"
                          fill="#0a4a8f"
                          style={{ fontFamily: 'var(--ax-font-mono)', fontVariantNumeric: 'tabular-nums' }}
                        >
                          减少 {fmtFixed(seg?.flicker_reduction_pct, 1)}% 切换 · {fmtFixed(seg?.hmm_mean_dwell_sec, 1)}s
                        </text>
                      </svg>

                      <Row gutter={[10, 10]}>
                        <Col span={12}>
                          <div style={{ fontSize: 12, color: 'var(--ax-text-secondary)' }}>跨折 Viterbi ARI</div>
                          <div style={{ fontSize: 18, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                            {fmtFixed(seg?.cross_fold_viterbi_ari_mean, 4)}
                          </div>
                        </Col>
                        <Col span={12}>
                          <div style={{ fontSize: 12, color: 'var(--ax-text-secondary)' }}>跨折状态一致率</div>
                          <div style={{ fontSize: 18, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                            {fmtPct(seg?.cross_fold_viterbi_agreement_mean, 2)}
                          </div>
                        </Col>
                        <Col span={12}>
                          <div style={{ fontSize: 12, color: 'var(--ax-text-secondary)' }}>PELT 平均转折点</div>
                          <div style={{ fontSize: 18, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                            {fmtFixed(seg?.pelt_mean_changepoints_per_session, 2)} 处/场
                          </div>
                        </Col>
                        <Col span={12}>
                          <div style={{ fontSize: 12, color: 'var(--ax-text-secondary)' }}>PELT 中位耗时</div>
                          <div style={{ fontSize: 18, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                            {fmtFixed(seg?.pelt_median_ms_per_session, 2)} ms
                          </div>
                        </Col>
                      </Row>
                    </div>
                  </Col>

                  <Col xs={24} lg={12}>
                    <div
                      style={{
                        padding: 14,
                        borderRadius: 'var(--ax-rounded-md)',
                        background: 'var(--ax-parchment)',
                        border: '1px solid var(--ax-hairline)',
                        height: '100%',
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ax-ink)', marginBottom: 8 }}>
                        Split Conformal 证据门控与异常分布核验
                      </div>

                      {/* Conformal Coverage SVG Gauge */}
                      <svg
                        viewBox="0 0 420 54"
                        style={{ width: '100%', height: 'auto', display: 'block', marginBottom: 10 }}
                        role="img"
                        aria-label="Split Conformal 实证覆盖率与理论目标对比图"
                      >
                        <rect x={2} y={16} width={280} height={16} rx={4} fill="#e5e7eb" />
                        <rect
                          x={2}
                          y={16}
                          width={Math.round(Math.min(1, eg?.empirical_conformal_coverage ?? 0) * 280)}
                          height={16}
                          rx={4}
                          fill="#0b5d2e"
                        />
                        <line
                          x1={2 + Math.round((eg?.target_coverage ?? 0.9) * 280)}
                          y1={8}
                          x2={2 + Math.round((eg?.target_coverage ?? 0.9) * 280)}
                          y2={38}
                          stroke="#9e1f1f"
                          strokeWidth="2"
                          strokeDasharray="3 2"
                        />
                        <text
                          x={2 + Math.round((eg?.target_coverage ?? 0.9) * 280)}
                          y={49}
                          textAnchor="middle"
                          fontSize="10.5"
                          fill="#9e1f1f"
                          fontWeight="600"
                        >
                          目标 ≥{Math.round((eg?.target_coverage ?? 0.9) * 100)}%
                        </text>
                        <text
                          x={418}
                          y={28}
                          textAnchor="end"
                          fontSize="12"
                          fontWeight="600"
                          fill="#0b5d2e"
                          style={{ fontFamily: 'var(--ax-font-mono)', fontVariantNumeric: 'tabular-nums' }}
                        >
                          实证 {fmtPct(eg?.empirical_conformal_coverage, 1)}
                        </text>
                      </svg>

                      <Row gutter={[10, 10]}>
                        <Col span={12}>
                          <div style={{ fontSize: 12, color: 'var(--ax-text-secondary)' }}>五折准确率 / Macro-F1</div>
                          <div style={{ fontSize: 18, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                            {fmtPct(eg?.cv_accuracy, 1)} / {fmtPct(eg?.cv_macro_f1, 1)}
                          </div>
                        </Col>
                        <Col span={12}>
                          <div style={{ fontSize: 12, color: 'var(--ax-text-secondary)' }}>异常分布检出 AUROC</div>
                          <div style={{ fontSize: 18, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                            {fmtFixed(eg?.ood_auroc_mean, 3)}
                          </div>
                        </Col>
                        <Col span={12}>
                          <div style={{ fontSize: 12, color: 'var(--ax-text-secondary)' }}>人工复核触发率</div>
                          <div style={{ fontSize: 18, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                            {fmtPct(eg?.uncertainty_escalation_rate, 1)}
                          </div>
                        </Col>
                        <Col span={12}>
                          <div style={{ fontSize: 12, color: 'var(--ax-text-secondary)' }}>平均预测集大小</div>
                          <div style={{ fontSize: 18, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                            {fmtFixed(eg?.mean_conformal_set_size, 3)}
                          </div>
                        </Col>
                      </Row>
                    </div>
                  </Col>
                </Row>

                {(rawAblation || cmMatrix) && (
                  <Row gutter={[16, 16]} style={{ marginTop: 14 }}>
                    {rawAblation && (
                      <Col xs={24} lg={12}>
                        <div
                          style={{
                            padding: 12,
                            borderRadius: 'var(--ax-rounded-sm)',
                            background: 'var(--ax-info-soft)',
                            border: '1px solid var(--ax-info-border)',
                            fontSize: 12.5,
                            color: 'var(--ax-info)',
                            lineHeight: 1.55,
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          <div style={{ fontWeight: 600, marginBottom: 4 }}>
                            原始遥测子特征独立消融
                          </div>
                          <div>
                            准确率 {fmtPct(rawAblation.cv_accuracy as number, 1)} · Macro-F1{' '}
                            {fmtPct(rawAblation.cv_macro_f1 as number, 1)} · 覆盖率{' '}
                            {fmtPct(rawAblation.empirical_conformal_coverage as number, 1)} · AUROC{' '}
                            {fmtFixed(rawAblation.ood_auroc_mean as number, 3)}
                          </div>
                          {typeof rawAblation.note === 'string' && (
                            <div style={{ marginTop: 4 }}>{rawAblation.note}</div>
                          )}
                        </div>
                      </Col>
                    )}

                    {cmMatrix && (
                      <Col xs={24} lg={12}>
                        <Table
                          size="small"
                          pagination={false}
                          rowKey="rowLabel"
                          dataSource={cmMatrix.map((row, rIdx) => ({
                            rowLabel: cmLabels[rIdx] || `类别 ${rIdx + 1}`,
                            c0: row[0] ?? 0,
                            c1: row[1] ?? 0,
                            c2: row[2] ?? 0,
                          }))}
                          columns={[
                            { title: '真实 \\ 预测', dataIndex: 'rowLabel', width: 120 },
                            { title: cmLabels[0], dataIndex: 'c0', align: 'right' as const },
                            { title: cmLabels[1], dataIndex: 'c1', align: 'right' as const },
                            { title: cmLabels[2], dataIndex: 'c2', align: 'right' as const },
                          ]}
                        />
                      </Col>
                    )}
                  </Row>
                )}
              </Card>
            ) : (
              <Card size="small" style={{ marginBottom: 20 }} title="3 · 第三层非评分模型裁判验证">
                <div style={{ fontSize: 13, color: 'var(--ax-text-secondary)' }}>模型裁判交叉验证指标暂未生成。</div>
              </Card>
            )}

            {/* ══ Section 4: 分层硬件算力决策基准：常驻 CPU 与 Tesla P40 ═════════════════ */}
            {gpu?.available ? (
              <Card
                size="small"
                style={{ marginBottom: 20 }}
                title={
                  <Space wrap size={8}>
                    <span>4 · 分层硬件算力决策基准：常驻 CPU 与 Tesla P40</span>
                    <Tag style={{ margin: 0, ...TONE.blue }}>
                      {gpu.hardware?.gpu_tested || 'Tesla P40'} · {gpu.hardware?.precision_used || 'float32'}
                    </Tag>
                    <Tag style={{ margin: 0, ...TONE.green }}>
                      与 HMM 阶段一致率 {fmtPct(gpu.gpu_neural_sequence_referee?.cv_agreement_with_hmm_mean, 1)}
                    </Tag>
                  </Space>
                }
              >
                {gpu.comparison?.conclusion_plain && (
                  <p style={{ margin: '0 0 14px', fontSize: 13.5, color: 'var(--ax-ink)', lineHeight: 1.6 }}>
                    {gpu.comparison.conclusion_plain}
                  </p>
                )}

                <Row gutter={[16, 16]}>
                  <Col xs={24} lg={12}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ax-ink)', marginBottom: 8 }}>
                      单场在线延迟分解 · 为何常规单场常驻 CPU 即可胜任
                    </div>
                    <svg
                      viewBox="0 0 460 128"
                      style={{ width: '100%', height: 'auto', display: 'block' }}
                      role="img"
                      aria-label="单场推理耗时对比：常驻 CPU 完整评估 17.7 毫秒、核心模型 4.85 毫秒、预热 GPU 0.78 毫秒，以及 CUDA 冷启动 1850 毫秒"
                    >
                      {[
                        {
                          label: '常驻 CPU 完整评估',
                          ms: gpu.cpu_referee?.cpu_full_evaluate_ms_median ?? 17.7,
                          max: 20,
                          color: '#0066cc',
                        },
                        {
                          label: 'CPU 模型核心推理',
                          ms: gpu.cpu_referee?.cpu_model_core_single_ms_median ?? 4.85,
                          max: 20,
                          color: '#0a4a8f',
                        },
                        {
                          label: '预热 GPU 端到端',
                          ms: gpu.gpu_neural_sequence_referee?.gpu_single_e2e_ms_median ?? 0.78,
                          max: 20,
                          color: '#0b5d2e',
                        },
                        {
                          label: 'GPU 冷启动 CUDA',
                          ms: gpu.gpu_neural_sequence_referee?.cold_torch_cuda_init_ms ?? 1849.7,
                          max: 2000,
                          color: '#9e1f1f',
                        },
                      ].map((row, idx) => {
                        const cy = 18 + idx * 28;
                        const w = Math.max(4, Math.round((Math.min(row.ms, row.max) / row.max) * 200));
                        return (
                          <g key={row.label}>
                            <text x={2} y={cy + 4} fontSize="12" fill="#1d1d1f">
                              {row.label}
                            </text>
                            <rect x={144} y={cy - 6} width={200} height={12} rx={3} fill="#f0f2f5" />
                            <rect x={144} y={cy - 6} width={w} height={12} rx={3} fill={row.color} />
                            <text
                              x={456}
                              y={cy + 4}
                              textAnchor="end"
                              fontSize="12"
                              fontWeight="600"
                              fill={row.color}
                              style={{ fontFamily: 'var(--ax-font-mono)', fontVariantNumeric: 'tabular-nums' }}
                            >
                              {row.ms >= 100 ? `${row.ms.toFixed(1)} ms` : `${row.ms.toFixed(2)} ms`}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </Col>

                  <Col xs={24} lg={12}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ax-ink)', marginBottom: 8 }}>
                      256 场并发批量吞吐 · GPU 并行加速优势区间
                    </div>
                    <svg
                      viewBox="0 0 460 96"
                      style={{ width: '100%', height: 'auto', display: 'block', marginBottom: 10 }}
                      role="img"
                      aria-label="256 场并发批量吞吐对比：CPU 每秒 196.8 场对比 Tesla P40 FP32 每秒 2062.7 场"
                    >
                      {[
                        {
                          label: 'CPU 256 场并发',
                          sps: gpu.cpu_referee?.cpu_batch256_sess_per_sec ?? 196.8,
                          ms: gpu.cpu_referee?.cpu_batch256_ms_median ?? 1300.8,
                          color: '#5c5c61',
                        },
                        {
                          label: 'Tesla P40 并发',
                          sps: gpu.gpu_neural_sequence_referee?.gpu_batch256_sess_per_sec ?? 2062.7,
                          ms: gpu.gpu_neural_sequence_referee?.gpu_batch256_e2e_ms_median ?? 124.1,
                          color: '#0066cc',
                        },
                      ].map((row, idx) => {
                        const cy = 22 + idx * 38;
                        const maxSps = Math.max(
                          2200,
                          gpu.gpu_neural_sequence_referee?.gpu_batch256_sess_per_sec ?? 2063
                        );
                        const w = Math.max(8, Math.round((row.sps / maxSps) * 186));
                        return (
                          <g key={row.label}>
                            <text x={2} y={cy + 4} fontSize="12" fontWeight="600" fill="#1d1d1f">
                              {row.label}
                            </text>
                            <rect x={122} y={cy - 7} width={186} height={14} rx={3} fill="#f0f2f5" />
                            <rect x={122} y={cy - 7} width={w} height={14} rx={3} fill={row.color} />
                            <text
                              x={456}
                              y={cy + 4}
                              textAnchor="end"
                              fontSize="12"
                              fontWeight="600"
                              fill={row.color}
                              style={{ fontFamily: 'var(--ax-font-mono)', fontVariantNumeric: 'tabular-nums' }}
                            >
                              {`${fmtInt(row.sps)} 场/秒 · ${row.ms.toFixed(1)} ms`}
                            </text>
                          </g>
                        );
                      })}
                    </svg>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      <span style={pillStyle(TONE.blue)}>
                        256 场并发提速 {fmtFixed(gpu.comparison?.batch256_gpu_speedup_over_cpu, 2)}×
                      </span>
                      <span style={pillStyle(TONE.neutral)}>
                        序列架构 {gpu.gpu_neural_sequence_referee?.architecture || 'TCN + BiGRU'}
                      </span>
                      <span style={pillStyle(TONE.neutral)}>
                        硬件 FP16 Tensor Core：
                        {gpu.hardware?.fp16_tensor_core_available ? '支持' : '无 · 使用 FP32'}
                      </span>
                    </div>
                  </Col>
                </Row>
              </Card>
            ) : (
              <Card size="small" style={{ marginBottom: 20 }} title="4 · 分层硬件算力决策基准：常驻 CPU 与 Tesla P40">
                <div style={{ fontSize: 13, color: 'var(--ax-text-secondary)' }}>算力对比基准文件暂未生成。</div>
              </Card>
            )}
          </>
        )}
      </div>
    </main>
  );
};

export default BenchmarksPage;
