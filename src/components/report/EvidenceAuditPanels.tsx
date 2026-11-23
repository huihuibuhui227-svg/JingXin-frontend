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
  const gov = l1.governance_ledger as any;
  const sq = l1.signal_quality_audit as any;
  const secondInst = l1.second_instrument_appendix as any;
  const blockedWarns = Array.isArray(l1.blocked_dependency_warnings) ? l1.blocked_dependency_warnings : [];

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
          <strong>测量治理台账：显式封停与主动拒绝清单</strong>
          <Tag style={{ margin: 0 }}>封停 L0 {l0Blocked.length} 项</Tag>
          <Tag style={{ margin: 0 }}>主动拒绝/退役 {l1Retired.length} 项</Tag>
          {quarantineActive.length > 0 && (
            <Tag style={{ margin: 0 }}>隔离旧代理 {quarantineActive.length} 项</Tag>
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

  if (secondInst?.available) {
    const appendixRows: any[] = Array.isArray(secondInst.rows)
      ? secondInst.rows
      : (Array.isArray(secondInst.items) ? secondInst.items : []);
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
          <p style={{ marginTop: 0 }}>{secondInst.disclaimer || secondInst.summary_plain || '以下读数来自 FaceLandmarker 52 项回归系数，独立于主几何代理指标。'}</p>
          {appendixRows.length > 0 && (
            <Table
              rowKey={(r: any, idx?: number) => r.name || r.indicator || String(idx ?? 0)}
              size="small"
              pagination={false}
              dataSource={appendixRows}
              columns={[
                { title: '对照项', dataIndex: 'label', render: (v: string, r: any) => v || r.name || r.indicator },
                { title: '读数', dataIndex: 'value', width: 120, render: (v: number | null) => (typeof v === 'number' ? v.toFixed(3) : '—') },
                { title: '有效样本', dataIndex: 'n_valid', width: 100, render: (v: any) => v ?? '—' },
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
