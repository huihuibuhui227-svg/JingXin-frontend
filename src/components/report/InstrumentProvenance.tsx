/**
 * **仪器来源** —— 每条 L1 指标到底由哪一套"仪器"产出,以及这份报告的整体构成。
 *
 * ## 为什么这块卡片必须存在
 *
 * 本系统的面部测量**同时存在两套仪器**:
 *   · `geometric`(几何代理):手写的关键点比率(`au4_frown = 眉内距 ÷ 眼距` …);
 *   · `blendshape`(模型系数):FaceLandmarker 回归出的 52 列系数(`bs_mouthSmileLeft` …)。
 *
 * 离线实测(32 场 / 389 条)显示二者的秩一致性**因构念而异**:12 个构念里只有 1 个
 * 达 ρ ≥ 0.7 ⟹ 两套数**不可混用**,报告必须逐条标明出处。
 *
 * 后端 `report_frontend/instrument_provenance.py` 早已能算出这件事,但接入前
 * 全仓报告层对 `instrument|仪器` **零命中** —— 字段躺在载荷里,页面上一个字都没有。
 * 那块卡片就是那个出口:后端 HTML 报告有同一块(`#instrument-disclosure`),
 * 这里是**同一份载荷的另一个出口**,口径必须一致。
 *
 * ## 三条呈现纪律(与后端一一对应)
 *
 * 1. **数字全部来自载荷**(`l1.instruments`),前端**不自己数**。前端数一遍,
 *    两个出口的数迟早不同 —— 而这份报告对外要说的那句话正是"已披露仪器来源"。
 * 2. **「未登记」不是一种仪器**,是披露缺口。所以它**单独配色 + 虚线框**,
 *    并配一句 `unknown_note`(文案由载荷给),还点出**缺哪几列**
 *    (`unmapped_columns`)—— 只说"N 条未登记"读者无从下手。
 * 3. **载荷没带这一块时明说"没带"**,不编一个"0 条":旧载荷(以及 store 里缓存的
 *    老结果)本来就没有这个字段,印 0 会被读成"披露了,结果是零"。
 *
 * ## 类型为什么写在这里
 *
 * `src/types/assessment.ts` 不在本次改动范围内,而这块载荷字段是新增的。
 * 这里就地声明**只用于本组件**的结构类型(取值与后端 `l1_report._instrument_block()`
 * 逐键对齐),并在 `ReportPage` 里做一次显式断言 —— 断言处写了为什么。
 * 等 `assessment.ts` 允许改动时,这三个类型应当整体搬进去,不要让两张类型表分叉。
 */
import React, { useMemo } from 'react';
import { Alert, Card, Collapse, Empty, Table, Tag, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';

/** 仪器名 —— 与 `instrument_provenance.INSTRUMENTS` 同序同名。 */
export type InstrumentName = 'blendshape' | 'geometric' | 'audio' | 'text' | 'unknown';

/** 后端 `l1.instruments`(汇总块)。键集与 `l1_report._instrument_block()` 一致。 */
export interface InstrumentSummary {
  n_indicators: number;
  counts: Partial<Record<InstrumentName, number>>;
  /** 页脚那一句。**由后端 `format_footer()` 拼**,前端不拼 —— 两处拼法早晚不一致。 */
  footer: string;
  /** 仪器名 → 中文标签。前端没有、也不该有第二张标签表。 */
  labels: Record<string, string>;
  /** 固定顺序。不按键遍历 `counts`(JS 的对象键序会让界面顺序随输入抖动)。 */
  order: InstrumentName[];
  n_multi: number;
  unmapped_columns: string[];
  unknown_note: string;
  multi_note: string;
}

/** 一条指标的仪器。后端是**单值/多值二选一**(`instrument` XOR `instruments`)。 */
export interface InstrumentRow {
  name: string;
  family?: string;
  instrument?: string;
  instruments?: string[];
}

/** `l1` 段里本组件关心的两处。 */
export interface L1WithInstruments {
  indicators?: InstrumentRow[];
  instruments?: InstrumentSummary;
  indicator_meta?: Record<string, { label?: string; family?: string; unit?: string }>;
}

/** 仪器 → 标签配色。`unknown` 与其它四个**不同形**(虚线 + 警示色):
 *  它是缺口,排成同款灰标签就会被当成第三套仪器读过去。 */
const TAG_TONE: Record<string, React.CSSProperties> = {
  blendshape: {
    color: 'var(--ax-primary)',
    background: 'transparent',
    borderColor: 'var(--ax-primary)',
  },
  geometric: {
    color: 'var(--ax-ink)',
    background: 'var(--ax-parchment)',
    borderColor: 'var(--ax-hairline)',
  },
  audio: {
    color: 'var(--ax-ink)',
    background: 'var(--ax-parchment)',
    borderColor: 'var(--ax-hairline)',
  },
  text: {
    color: 'var(--ax-ink)',
    background: 'var(--ax-parchment)',
    borderColor: 'var(--ax-hairline)',
  },
  unknown: {
    color: 'var(--ax-warning)',
    background: 'var(--ax-warning-soft)',
    borderColor: 'var(--ax-warning)',
    borderStyle: 'dashed',
  },
};

/**
 * 一条指标 → 仪器名列表。**`instruments_of()` 的 JS 孪生**。
 *
 * 后端有唯一访问器(`instrument_provenance.instruments_of`),json 里没有函数可调用
 * ⟹ 前端只能认那两个键。这里把"二选一"的判断**收在一处**,组件里不许再各判一次。
 * 返回 `null` 表示**载荷没给**(≠ `['unknown']`:后者是披露了但登记表里查不到)。
 */
export const instrumentsOf = (row: InstrumentRow | null | undefined): string[] | null => {
  if (!row) return null;
  if (Array.isArray(row.instruments) && row.instruments.length > 0) return row.instruments;
  if (typeof row.instrument === 'string' && row.instrument) return [row.instrument];
  return null;
};

/** 仪器名列表 → 标签串(`未登记` 用括号标出来,免得与真仪器混读)。 */
const labelOf = (name: string, labels: Record<string, string>): string =>
  labels[name] ?? name; // 没登记标签就露英文键 —— 宁可露英文,也不许吞掉这一条

export interface InstrumentProvenanceProps {
  /** `report.l1`(**含**后端新增的 `instruments` 块)。 */
  l1?: L1WithInstruments;
}

const InstrumentProvenance: React.FC<InstrumentProvenanceProps> = ({ l1 }) => {
  const summary = l1?.instruments;
  const labels = summary?.labels ?? {};
  const order = summary?.order ?? [];
  const rows = l1?.indicators ?? [];
  const indicatorMeta = l1?.indicator_meta ?? {};

  /** 只列**带得出仪器**的行:38 条里每一条都该有,一条都没有就整块不逞强。 */
  const tableRows = useMemo(
    () => rows.filter((r) => instrumentsOf(r) !== null),
    [rows],
  );

  const nUnknown = summary?.counts?.unknown ?? 0;
  const nBlendshape = summary?.counts?.blendshape ?? 0;

  const columns: ColumnsType<InstrumentRow> = [
    {
      title: '指标',
      dataIndex: 'name',
      key: 'name',
      width: 300,
      render: (_: unknown, r) => {
        const cn = indicatorMeta[r.name]?.label;
        return (
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{cn || r.name}</div>
            <div style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 11.5, color: 'var(--ax-text-secondary)', marginTop: 2 }}>
              {r.name}{r.family ? ` · ${r.family}` : ''}
            </div>
          </div>
        );
      },
    },
    {
      title: '仪器来源',
      key: 'instruments',
      render: (_: unknown, r) => {
        const names = instrumentsOf(r) ?? [];
        return (
          <>
            {names.map((n) => (
              <Tooltip
                key={n}
                title={
                  n === 'unknown'
                    ? '披露缺口：这条指标的依赖列还没归到任何一路仪器上（不是另一种仪器）'
                    : `${labelOf(n, labels)}（${n}）`
                }
              >
                <Tag style={{ margin: '0 6px 0 0', ...(TAG_TONE[n] ?? {}) }}>
                  {labelOf(n, labels)}
                </Tag>
              </Tooltip>
            ))}
          </>
        );
      },
    },
  ];

  return (
    <Card
      title={
        <span>
          仪器来源
          {summary && (
            <Tag style={{ marginLeft: 8 }}>{summary.n_indicators} 条指标</Tag>
          )}
          {summary && nUnknown > 0 && (
            <Tag style={{ marginLeft: 4, ...(TAG_TONE.unknown ?? {}) }}>
              未登记 {nUnknown}
            </Tag>
          )}
        </span>
      }
      style={{ marginBottom: 24 }}
      data-testid="instrument-provenance"
    >
      {!summary ? (
        <div style={{ color: 'var(--ax-text-secondary)' }}>
          这份载荷<strong>没有带仪器来源字段</strong>（旧载荷 / 缓存里的旧结果）。
          报告页不拿别的东西顶替它 —— 那不是"没有仪器"，是"这一份没说"。
        </div>
      ) : (
        <>
          <p style={{ color: 'var(--ax-text-secondary)', marginTop: 0, fontSize: 13 }}>
            本系统的面部测量同时存在两套仪器：手写的关键点几何代理（
            <code>geometric</code>），与 FaceLandmarker 回归出的 52 列系数（
            <code>blendshape</code>）。离线实测（32 场 / 389 条）里，12 个构念只有 1 个
            达到秩一致性 ρ ≥ 0.7，<strong>因此两套数不可混用</strong>，
            这里逐条标出每个数出自哪一套。这一节只做披露，不改任何一个值。
          </p>

          {/* 汇总:一枚一枚的小标签。顺序按载荷的 `order`,不按键遍历。 */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '10px 0 10px' }}>
            {order.map((n) => (
              <Tag key={n} style={{ margin: 0, ...(TAG_TONE[n] ?? {}) }}>
                {labelOf(n, labels)} {summary.counts[n] ?? 0}
              </Tag>
            ))}
          </div>

          {/* 页脚那句话由载荷给（后端 `format_footer()`），前端不拼。 */}
          <div
            style={{
              fontSize: 13.5,
              marginBottom: 10,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {summary.footer}
          </div>

          {summary.n_multi > 0 && (
            <p style={{ color: 'var(--ax-text-secondary)', fontSize: 13 }}>{summary.multi_note}</p>
          )}

          {nBlendshape === 0 && (
            <p style={{ color: 'var(--ax-text-secondary)', fontSize: 13 }}>
              注意这份报告里<strong>没有一条</strong>面部指标来自模型系数
              （52 列 blendshape 全部只采集、没有参与任何一条 L1 指标）——
              这句话本身也是要披露的内容。
            </p>
          )}

          {/* 「未登记」单独立一段:它是缺口,不是仪器。缺哪几列一并点出来。 */}
          {nUnknown > 0 && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 12 }}
              message={`${nUnknown} 条指标标着「未登记」`}
              description={
                <>
                  {summary.unknown_note}
                  {summary.unmapped_columns.length > 0 && (
                    <div style={{ marginTop: 4 }}>
                      缺的是这几列：
                      {summary.unmapped_columns.map((c) => (
                        <code key={c} style={{ marginLeft: 6, fontSize: 12 }}>
                          {c}
                        </code>
                      ))}
                    </div>
                  )}
                </>
              }
            />
          )}

          {tableRows.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="载荷里的指标一条都没带仪器字段（不是「没有仪器」：是这一份没标）"
            />
          ) : (
            <Collapse
              ghost
              style={{ marginTop: 4 }}
              items={[
                {
                  key: 'instrument-detail-table',
                  label: (
                    <span style={{ fontWeight: 600, fontSize: 13 }}>
                      展开 {tableRows.length} 条行为指标逐项仪器来源明细
                    </span>
                  ),
                  children: (
                    <Table<InstrumentRow>
                      rowKey="name"
                      size="small"
                      columns={columns}
                      dataSource={tableRows}
                      pagination={false}
                      scroll={{ x: 520 }}
                    />
                  ),
                },
              ]}
            />
          )}
        </>
      )}
    </Card>
  );
};

export default InstrumentProvenance;
