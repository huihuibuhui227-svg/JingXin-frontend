import React from 'react';
import { Alert, Collapse, Space, Table, Tag, Typography } from 'antd';
import type { EvaluationResult } from '@/types/assessment';

const { Text } = Typography;

const TIER_TONE: Record<string, React.CSSProperties> = {
  T1: { color: '#0b5d2e', background: '#edf7f0', borderColor: '#bfe3cb' },
  T2a: { color: '#0a4a8f', background: '#eef5fc', borderColor: '#c2dcf5' },
  T2b: { color: '#0a4a8f', background: '#eef5fc', borderColor: '#c2dcf5' },
  T3a: { color: '#7a4a05', background: '#fdf6e9', borderColor: '#eed39e' },
  T3b: { color: '#5c5c61', background: '#f5f5f7', borderColor: '#e0e0e0' },
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
  const gov = l1.governance_ledger;
  const sq = l1.signal_quality_audit;
  const secondInst = l1.second_instrument_appendix;
  const blockedWarns = l1.blocked_dependency_warnings ?? [];

  const items = [];

  if (pp) {
    items.push({
      key: 'params',
      label: (
        <Space wrap size={8}>
          <strong>参数来源三级登记（T1 / T2 / T3）</strong>
          <Tag style={{ margin: 0 }}>共 {pp.n_total} 项</Tag>
          <Tag style={{ margin: 0, ...TIER_TONE.T3a }}>未标定临时值 {pp.n_provisional} 项</Tag>
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
            dataSource={pp.registry}
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
    items.push({
      key: 'governance',
      label: (
        <Space wrap size={8}>
          <strong>测量治理台账：显式封停与主动拒绝清单</strong>
          <Tag style={{ margin: 0 }}>封停 L0 {gov.l0_blocked.length} 项</Tag>
          <Tag style={{ margin: 0 }}>主动拒绝 L1 {gov.l1_retired.length} 项</Tag>
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
              message={`检测到 ${blockedWarns.length} 条指标存在已封停底层列依赖告警`}
              description={blockedWarns.map((w) => w.warning).join('；')}
            />
          )}
          <div>
            <Text strong style={{ display: 'block', marginBottom: 6 }}>主动拒绝的冗余 L1 指标</Text>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: 'var(--ax-text-secondary)' }}>
              {gov.l1_retired.map((r) => (
                <li key={r.name} style={{ marginBottom: 4 }}>
                  <strong style={{ color: 'var(--ax-ink)' }}>{r.label || r.name}</strong>：{r.reason}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <Text strong style={{ display: 'block', marginBottom: 6 }}>显式封停的 L0 字段及解封条件</Text>
            <Table
              rowKey="column"
              size="small"
              pagination={false}
              dataSource={gov.l0_blocked}
              scroll={{ x: 640 }}
              columns={[
                { title: '封停项', dataIndex: 'column', width: 180 },
                { title: '封停原因', dataIndex: 'reason' },
                { title: '解封前置条件', dataIndex: 'unblock_condition', width: 220 },
              ]}
            />
          </div>
        </Space>
      ),
    });
  }

  if (sq) {
    items.push({
      key: 'signal-quality',
      label: (
        <Space wrap size={8}>
          <strong>采集信号质检参考（自监督纯 CPU 模型 · 不参与评定）</strong>
          {sq.usable_window_ratio != null && (
            <Tag
              style={{
                margin: 0,
                ...(sq.usable_window_ratio >= 0.8 ? TIER_TONE.T1 : TIER_TONE.T3a),
              }}
            >
              窗口可用率 {(sq.usable_window_ratio * 100).toFixed(1)}%
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
          {sq.flagged_windows.length > 0 && (
            <Table
              rowKey="window_index"
              size="small"
              pagination={false}
              dataSource={sq.flagged_windows}
              columns={[
                { title: '帧区间', render: (_: any, r: any) => `第 ${r.start_row + 1}–${r.end_row} 帧`, width: 130 },
                { title: '信号可用概率', dataIndex: 'usability_prob', width: 120, render: (v: number) => `${(v * 100).toFixed(1)}%` },
                { title: '物理异常提示', dataIndex: 'hints', render: (hs: string[]) => hs.join('；') },
              ]}
            />
          )}
        </Space>
      ),
    });
  }

  if (secondInst?.available) {
    items.push({
      key: 'second-instrument',
      label: (
        <Space wrap size={8}>
          <strong>第二仪器独立对照附录（52 项 Blendshape）</strong>
          <Tag style={{ margin: 0 }}>仅作独立对照，不混入主指标</Tag>
        </Space>
      ),
      children: (
        <div style={{ fontSize: 13, color: 'var(--ax-text-secondary)' }}>
          <p style={{ marginTop: 0 }}>{secondInst.summary_plain || '以下读数来自 FaceLandmarker 52 项回归系数，独立于主几何代理指标。'}</p>
          {Array.isArray(secondInst.items) && secondInst.items.length > 0 && (
            <Table
              rowKey="name"
              size="small"
              pagination={false}
              dataSource={secondInst.items}
              columns={[
                { title: '对照项', dataIndex: 'label', render: (v: string, r: any) => v || r.name },
                { title: '读数', dataIndex: 'value', width: 120, render: (v: number | null) => (typeof v === 'number' ? v.toFixed(3) : '—') },
                { title: '有效帧', dataIndex: 'n_valid', width: 100 },
              ]}
            />
          )}
        </div>
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
