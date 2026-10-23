/**
 * **L1 指标全表** —— 一场会话算出来的每一条指标,包括**没算出来的那些**。
 *
 * ## 为什么这张表必须存在
 *
 * 报告页在此之前只渲染两样:过了证据门的**旧槽**(7/14)和逐维度的缺口文字。
 * 而 L1 实际每场产出 38 条指标 —— 后端一直在发 `l1.indicators`,
 * 前端**取了从没渲染**。后果是读者看到"7/14 通过",却看不到那 31 条没通过的
 * 分别是什么、卡在哪。
 *
 * ## 三条呈现纪律
 *
 * 1. **没算出来的必须与算出来的并列**,不许折叠、不许过滤掉。
 *    缺口码(`gap`)翻成人话,并且**区分"没采到"与"没有这个量"** ——
 *    这两种情况的补救动作完全不同(去补采集 vs 去补产出方)。
 * 2. **值一律右对齐 + `tabular-nums`**,小数位数按量级自适应:
 *    比率 0.5480 与速率 41.519 同表时不至于一个挤成一行、一个留白一片。
 * 3. **公式随行展示**(展开行),因为本仓每一条指标的阈值来源与口径限制
 *    都写在公式串里 —— 例如文本三条都写着"全场混音(含面试官)"。
 *    不展示公式,读者会把"全场话语"当成"考生话语"。
 */
import React, { useMemo } from 'react';
import { Card, Empty, Table, Tag, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { EvaluationResult, L1IndicatorRow } from '@/types/assessment';

/** 模态键 → 中文名。`timebase` 用的是**模态键**(face/gesture/voice),
 *  与下面按**族首字母**(F/G/V/T)索引的 `FAMILY_LABEL` 不是同一套键 —— 别混用。 */
const MODALITY_LABEL: Record<string, string> = {
  face: '面部',
  gesture: '手势',
  voice: '语音',
};

/** 族首字母 → 模态名。`F1_smile` 的 `F` 就是面部。 */
const FAMILY_LABEL: Record<string, string> = {
  F: '面部',
  G: '手势',
  V: '语音',
  T: '文本',
};

/**
 * 缺口码 → 人话。
 *
 * ⚠️ 这里的措辞是**给读报告的人**看的,不是给开发看的:要能直接回答
 * "这条为什么没有数、我该去补什么"。所以每条都写成"缺什么",不是"错误码是什么"。
 */
const GAP_LABEL: Record<string, { text: string; hint: string; tone: 'warn' | 'error' | 'muted' }> = {
  modality_missing: {
    text: '整场没这个模态',
    hint: '这一场没有对应日志(例如没录到脸)。补救:查采集。',
    tone: 'error',
  },
  column_empty: {
    text: '上游没采这一列',
    hint: '日志在,但这一列全场 0 个非空值。补救:查产出方,不是查采集。',
    tone: 'error',
  },
  no_samples: {
    text: '窗口内无观测',
    hint: '日志和列都在,但这个窗口里一条有效观测都没有。',
    tone: 'warn',
  },
  not_stored: {
    text: '上游只存了聚合量',
    hint: '这一层的粒度上游没落盘。补救:补产出方或补缓存。',
    tone: 'warn',
  },
  time_unusable: {
    text: '时间轴不可重建',
    hint: '墙钟与帧时间对不上,按时间切窗口会切错。',
    tone: 'error',
  },
  window_none: {
    text: '没有可用回答窗口',
    hint: '缺 `ask_end` 一类边界事件,切不出"第几题"的窗口。',
    tone: 'warn',
  },
  uncalibrated: {
    text: '缺阈值 τ',
    hint: '构念成立,但"多大幅才算一次"还没有可辩护的来源。',
    tone: 'muted',
  },
};

const TONE_STYLE: Record<string, React.CSSProperties> = {
  warn: { color: 'var(--ax-warning)', background: 'var(--ax-warning-soft)', borderColor: 'var(--ax-warning-soft)' },
  error: { color: 'var(--ax-error)', background: 'var(--ax-error-soft)', borderColor: 'var(--ax-error-soft)' },
  muted: { color: 'var(--ax-text-secondary)', background: 'var(--ax-parchment)', borderColor: 'var(--ax-hairline)' },
};

/**
 * 值格式化:小数位数**按量级**选,而不是一律 `toFixed(2)`。
 *
 * 同表里有 0.5480(占比)、41.519(次/分)、22.8675(半音/秒)、0.0067986(帧占比),
 * 一律两位会把小量级全部显示成 0.01/0.00 —— 那是**把测量结果抹平**。
 */
const fmtValue = (v: number | null): string => {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 1000) return v.toFixed(0);
  if (a >= 1) return v.toFixed(3);
  if (a >= 0.001) return v.toFixed(4);
  return v.toExponential(2);
};

const fmtCount = (n: number): string => (Number.isFinite(n) ? n.toLocaleString('zh-CN') : '—');

/** 置信度 → 颜色。**只给"高/中/低"上色**,「无」保持灰 —— 它不是"差",是"没有"。 */
const CONF_TONE: Record<string, React.CSSProperties> = {
  高: { color: 'var(--ax-success)', background: 'var(--ax-success-soft)', borderColor: 'var(--ax-success-soft)' },
  中: { color: 'var(--ax-ink)', background: 'var(--ax-parchment)', borderColor: 'var(--ax-hairline)' },
  低: { color: 'var(--ax-warning)', background: 'var(--ax-warning-soft)', borderColor: 'var(--ax-warning-soft)' },
  无: { color: 'var(--ax-text-secondary)', background: 'var(--ax-pearl)', borderColor: 'var(--ax-hairline)' },
};

/** 秒 → `h:mm:ss` / `m:ss`。用于"观察窗口"那一行。 */
const fmtSpan = (sec: number): string => {
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
               : `${m}:${String(ss).padStart(2, '0')}`;
};

/** 去掉后端文案里的 markdown 强调记号 —— 纯文本界面里 `**` 与反引号是噪音。
 *  后端的字符串同时供 HTML 报告使用,所以不去改源串,只在显示时剥掉。 */
const plain = (t: string): string => t.replace(/\*\*/g, '').replace(/`/g, '');

const numCell: React.CSSProperties = {
  fontVariantNumeric: 'tabular-nums',
  textAlign: 'right',
  whiteSpace: 'nowrap',
};

export interface L1IndicatorTableProps {
  l1: NonNullable<EvaluationResult['l1']>;
}

const L1IndicatorTable: React.FC<L1IndicatorTableProps> = ({ l1 }) => {
  const rows = l1.indicators ?? [];

  /**
   * 各族观察窗口 —— "两族看的不是同一段时间"的直接证据。
   *
   * 只比 `n_frames` 看不出来(王语桐 6968 vs 13585 反而像语音更多),
   * 必须比 `span_sec`(7427 vs 434.7)。三族一致时**不显示**,不加噪音。
   */
  const { windowRow, windowMismatch } = useMemo(() => {
    const tb = l1.timebase ?? {};
    const parts: string[] = [];
    const spans: number[] = [];
    (['face', 'gesture', 'voice'] as const).forEach((m) => {
      const x = tb[m];
      const sp = x?.span_sec;
      if (!x?.provided || typeof sp !== 'number' || !(sp > 0)) return;
      parts.push(`${MODALITY_LABEL[m]} ${fmtSpan(sp)}`);
      spans.push(sp);
    });
    if (parts.length < 2) return { windowRow: '', windowMismatch: false };
    const lo = Math.min(...spans);
    const hi = Math.max(...spans);
    return {
      windowRow: parts.join(' · '),
      windowMismatch: lo > 0 && hi / lo > 1.2,
    };
  }, [l1.timebase]);

  /** 族 → 计数,给表头的筛选器用。**不隐藏任何族** —— 哪怕整族不可出。 */
  const familyFilters = useMemo(() => {
    const seen = new Map<string, number>();
    rows.forEach((r) => {
      const k = (r.family || '?').charAt(0);
      seen.set(k, (seen.get(k) ?? 0) + 1);
    });
    return Array.from(seen.entries())
      .sort((a, b) => 'FGVT'.indexOf(a[0]) - 'FGVT'.indexOf(b[0]))
      .map(([k, n]) => ({ text: `${FAMILY_LABEL[k] ?? k}（${n}）`, value: k }));
  }, [rows]);

  const columns: ColumnsType<L1IndicatorRow> = [
    {
      title: '指标',
      dataIndex: 'name',
      key: 'name',
      fixed: 'left',
      width: 300,
      render: (_: unknown, r) => (
        <div>
          <div style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 12.5, color: 'var(--ax-ink)' }}>
            {r.name}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ax-text-secondary)', marginTop: 2 }}>
            {r.family}
          </div>
        </div>
      ),
    },
    {
      title: '模态',
      dataIndex: 'family',
      key: 'family',
      width: 80,
      filters: familyFilters,
      onFilter: (val, r) => (r.family || '?').charAt(0) === val,
      render: (fam: string) => FAMILY_LABEL[(fam || '?').charAt(0)] ?? '未知',
    },
    {
      title: '实测值',
      dataIndex: 'value',
      key: 'value',
      width: 110,
      align: 'right',
      sorter: (a, b) => (a.value ?? -Infinity) - (b.value ?? -Infinity),
      render: (v: number | null, r) => (
        <span style={{ ...numCell, color: v === null ? 'var(--ax-text-secondary)' : 'var(--ax-ink)' }}>
          {fmtValue(v)}
          {v !== null && r.unit ? (
            <span style={{ color: 'var(--ax-text-secondary)', fontSize: 11.5, marginLeft: 3 }}>
              {r.unit}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      title: '有效 / 总',
      dataIndex: 'n_valid',
      key: 'n_valid',
      width: 130,
      align: 'right',
      sorter: (a, b) => a.n_valid - b.n_valid,
      render: (_: unknown, r) => (
        <span style={numCell}>
          {fmtCount(r.n_valid)}
          <span style={{ color: 'var(--ax-text-secondary)' }}> / {fmtCount(r.n_total)}</span>
        </span>
      ),
    },
    {
      title: '置信度',
      dataIndex: 'confidence',
      key: 'confidence',
      width: 92,
      align: 'center',
      filters: ['高', '中', '低', '无'].map((c) => ({ text: c, value: c })),
      onFilter: (val, r) => r.confidence === val,
      render: (c: string) => (
        <Tag style={{ margin: 0, ...(CONF_TONE[c] ?? {}) }}>{c}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'gap',
      key: 'gap',
      width: 190,
      render: (gap: string | null) => {
        if (!gap) {
          return <Tag style={{ margin: 0, ...CONF_TONE['高'] }}>已测</Tag>;
        }
        const meta = GAP_LABEL[gap];
        if (!meta) {
          // 没登记的缺口码:原样显示。**不许**把它当成"已测",也不许吞掉。
          return <Tag style={{ margin: 0 }}>{gap}</Tag>;
        }
        return (
          <Tooltip title={meta.hint}>
            <Tag style={{ margin: 0, ...(TONE_STYLE[meta.tone] ?? {}) }}>{meta.text}</Tag>
          </Tooltip>
        );
      },
    },
  ];

  const nMeasured = l1.n_measured ?? rows.filter((r) => r.gap === null).length;
  const nTotal = l1.n_total ?? rows.length;
  const conf = l1.by_confidence ?? {};
  const gapCount = l1.by_gap ?? {};
  const gapEntries = Object.entries(gapCount).filter(([, n]) => n > 0);

  return (
    <Card
      title={
        <span>
          L1 指标全表
          <Tag style={{ marginLeft: 8 }}>
            {nMeasured} / {nTotal} 条出值
          </Tag>
          {(['高', '中', '低', '无'] as const).map((c) =>
            conf[c] ? (
              <Tag key={c} style={{ ...(CONF_TONE[c] ?? {}), marginLeft: 4 }}>
                {c} {conf[c]}
              </Tag>
            ) : null,
          )}
        </span>
      }
      style={{ marginBottom: 24 }}
    >
      {/*
        ★ 缺口汇总单独一行,并且**逐码说清"该去补什么"**。
        只给个总数("4 条不可出")等于什么都没说 —— 读者无法据此行动。
      */}
      {gapEntries.length > 0 && (
        <div style={{ marginBottom: 12, fontSize: 13, lineHeight: 1.7 }}>
          <span style={{ color: 'var(--ax-text-secondary)' }}>不可出的原因:</span>
          {gapEntries.map(([g, n]) => {
            const meta = GAP_LABEL[g];
            return (
              <Tooltip key={g} title={meta?.hint ?? '未登记的缺口码'}>
                <Tag style={{ marginLeft: 6, ...(meta ? TONE_STYLE[meta.tone] : {}) }}>
                  {meta?.text ?? g} × {n}
                </Tag>
              </Tooltip>
            );
          })}
        </div>
      )}

      {/*
        ★ 「为什么只有这么信」。置信度那一列只给了一个字(高/中/低),
        读者无从判断该不该用这个数。这里把每条的理由印出来 ——
        例如"整场只有一次测量 ⟹ 报不出跨样本一致性",那是素材限制,不是算错。
      */}
      {(l1.low_confidence_notes?.length ?? 0) > 0 && (
        <div style={{ marginBottom: 12, fontSize: 13, lineHeight: 1.75 }}>
          <div style={{ color: 'var(--ax-text-secondary)', marginBottom: 2 }}>
            置信度为「低」的原因（素材限制，不是算错）：
          </div>
          <ul style={{ paddingLeft: 20, margin: 0, color: 'var(--ax-ink-muted-80)' }}>
            {l1.low_confidence_notes!.map((note, i) => {
              // 后端拼的是半角冒号 `name:reason`;这里两种冒号都认,
              // 免得哪天后端换了全角就整条不再分行。
              const cut = note.search(/[：:]/);
              const name = cut > 0 ? note.slice(0, cut) : '';
              const body = cut > 0 ? note.slice(cut + 1) : note;
              return (
                <li key={i}>
                  {name && (
                    <span style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 12 }}>{name}</span>
                  )}
                  {name ? '：' : ''}
                  {plain(body)}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/*
        ★ 各族的**观察窗口**。

        这一行是"两族看的不是同一段时间"的直接证据。13 场里 12 场三族一致,
        王语桐一场是 面部/手势 2:03:47、语音 0:07:14(视频只剩最后一段)。
        只比 `n_frames` 看不出来(6968 vs 13585 反而像语音更多),
        必须比 `span_sec`。窗口不一致才显示,一致时不加噪音。
      */}
      {windowRow && (
        <div
          style={{
            marginBottom: 12,
            fontSize: 13,
            color: windowMismatch ? 'var(--ax-warning)' : 'var(--ax-text-secondary)',
            fontWeight: windowMismatch ? 600 : 400,
          }}
        >
          观察窗口：{windowRow}
          {windowMismatch && '（各族覆盖的时间段不同，跨族对比前先看这一行）'}
        </div>
      )}

      {/*
        ★ 会话级缺口 —— **这四条以前在界面上完全看不见**。

        `l1.gaps` 一直在载荷里、类型里也声明了,但没有任何组件渲染它。
        里面装的恰恰是最该先看到的话:"本场由 9 段录制拼接而成,V/T 只覆盖
        最后 7.2 分钟""本场没有提问台账,无法切成回答窗口"。
        表格再详细,读者不知道这些,就会把不同窗口的数当成同一件事。

        放在最上面而不是折叠里:这些是"这份报告能说什么"的前提。
      */}
      {(l1.gaps?.length ?? 0) > 0 && (
        <div
          style={{
            marginBottom: 12,
            padding: '8px 12px',
            fontSize: 13,
            lineHeight: 1.7,
            borderRadius: 'var(--ax-rounded-sm)',
            background: 'var(--ax-parchment)',
            borderLeft: '3px solid var(--ax-hairline)',
            color: 'var(--ax-text-secondary)',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 2, color: 'var(--ax-text-primary)' }}>
            本场报告的限制（素材层面，不是算错）
          </div>
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            {l1.gaps.map((g, i) => (
              <li key={i}>{plain(g)}</li>
            ))}
          </ul>
        </div>
      )}

      {/*
        ★ 与旧引擎报告对比时的**比较陷阱**。这 6 个槽保留了下来,但统计量换了
        (绝对量 → 相对本人基线的偏离;均值 → 中位数;单列 → 多列合计;
        presence-once → 出现次数)。名字相近,读者会自然相减 —— 而那个差没有含义。
        放在表格上方而不是折叠里:折叠的东西没人看,而这是"会用错数"的风险。
      */}
      {(l1.comparability_notes?.length ?? 0) > 0 && (
        <div
          style={{
            marginBottom: 12,
            padding: '8px 12px',
            fontSize: 13,
            lineHeight: 1.7,
            borderRadius: 'var(--ax-rounded-sm)',
            background: 'var(--ax-warning-soft)',
            color: 'var(--ax-warning)',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 2 }}>
            与旧引擎报告对比时注意：下列槽名相近，但统计量已更换，两边的数不可相减
          </div>
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            {l1.comparability_notes!.map((n, i) => (
              <li key={i}>{plain(n)}</li>
            ))}
          </ul>
        </div>
      )}

      {rows.length === 0 ? (
        // 区分"这一场没有指标"与"载荷里没这个字段" —— 前者是测量结果,后者是缺陷。
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            l1
              ? '这一场没有产出任何 L1 指标记录（不是加载失败：载荷里有 l1 段，但指标为空）'
              : '载荷里没有 l1 段'
          }
        />
      ) : (
        <Table<L1IndicatorRow>
          rowKey="name"
          size="small"
          columns={columns}
          dataSource={rows}
          pagination={false}
          scroll={{ x: 900 }}
          // 展开行放公式与依赖列:密度与可追溯性在这里兼得,不必挤进主表。
          expandable={{
            expandedRowRender: (r) => (
              <div style={{ fontSize: 12.5, lineHeight: 1.75, paddingLeft: 8 }}>
                <div>
                  <span style={{ color: 'var(--ax-text-secondary)' }}>公式：</span>
                  {r.formula}
                </div>
                <div>
                  <span style={{ color: 'var(--ax-text-secondary)' }}>依赖 L0：</span>
                  <span style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 12 }}>
                    {(r.required_l0 ?? []).join('、') || '—'}
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--ax-text-secondary)' }}>窗口：</span>
                  {r.window || '—'}
                </div>
              </div>
            ),
          }}
        />
      )}
    </Card>
  );
};

export default L1IndicatorTable;
