/**
 * 报告页的**依据呈现** —— 与后端 HTML 报告(`report_generator.py`)同源,spec §5.4 / §5.6。
 *
 * ⚠️ 2026-10-03 改正。这个组件此前渲染三样**不该出现在报告里**的东西:
 *
 * 1. **五维点分雷达图**:`<RadarChart dimensions={…score…} />` 把五个维度的
 *    **复合点分**画成"能力模型"。那是未标定标尺上的点分(spec §5.4/§5.6 禁止),
 *    而**同一页的 `ReportPage` 早已改成"覆盖事实 + 依据"**并写着
 *    「本系统**不产出对候选人的评分与评级**」—— 两处自相矛盾。
 *    ⟹ 已删。逐指标的依据改从 `coverage.passed_slots` 取(那批数据后端一直在发,
 *    而页面此前只用了 `n_passed`/`n_slots`,**取了从没渲染**)。
 *
 * 2. **`dimensions.*.narrative`**:后端**已随 spec §5.4 删掉这个字段**
 *    (`report_generator.py` 有明确注释),前端还在渲染它 ⟹ 那三张卡片一直是**空的**。
 *    ⟹ 已删,换成该维度自己的 `display_name`(不再由前端硬编码一套名字 ——
 *    此前前端写的是「情绪状态与抗压能力」这类,与后端的「情境行为稳定性」是两套)
 *    与**证据缺口**。
 *
 * 3. **假眼动数据**:`<GazeHeatmap gazeData={[{x:100,y:150},{x:200,y:180}]} />`
 *    —— 两个**硬编码的点**,挂在「眼动热力图与轨迹」标题下。那是**编造的数据**,
 *    本仓最不能出的东西。⟹ 已删;载荷里也没有逐帧视线轨迹,拿不到就不画。
 *
 * 现在呈现的只有两件事,都可以逐条回溯到会话自己的测量:
 *   · **本次过了证据门的指标**:原始值 + 本场会话内观测区间 + 有效样本量 + 置信度;
 *   · **逐维度的证据缺口**:该维度为什么薄(未采集到 / 会话内无变化 / 本轮停用 / 尚无产出方)。
 */
import React from 'react';
import { Card, Empty, Tag } from 'antd';
import { EvaluationResult } from '@/types/assessment';
import L1IndicatorTable from './L1IndicatorTable';

/** 固定顺序只为版面稳定;名字一律用载荷里的 `display_name`。 */
const DIMENSION_ORDER: (keyof EvaluationResult['dimensions'])[] = [
  'logical_thinking',
  'stress_resilience',
  'communication_fluency',
  'confidence_level',
  'cognitive_efficiency',
];

/** 观测区间形如 `[下界, 上界]`;取不到时后端给空数组 —— 那就如实说"未取到",不编一个数。 */
const intervalText = (iv?: number[]): string =>
  Array.isArray(iv) && iv.length === 2 ? `[${iv[0]}, ${iv[1]}]` : '未取到';

export interface ReportViewerProps {
  report: EvaluationResult;
}

const ReportViewer: React.FC<ReportViewerProps> = ({ report }) => {
  const slots = report.coverage?.passed_slots ?? [];
  const vanished = report.vanished_dimensions ?? [];
  const l1 = report.l1;

  return (
    <div>
      {/*
        ★ 2026-10-18:整维消失必须**渲染**出来。
        L1 的构念对账发现 `行为表现活跃度` 的三个槽(手掌张开度 / 肩部放松度 /
        眼神接触)**没有同构念的 L1 指标** —— 不是"这一场没测到",是那个维度量的
        东西当前管线都不测。它因此不进 `dimensions`。
        不渲染的话报告会**悄悄少一块**,而少的那块恰好是"测不到的东西" ——
        那是最该说出来的部分。

        ⚠️ 2026-10-25:这里原来印的是 `d.slot` / `d.reason`,那是**审计细节**
        (内部槽键 + 内部指标名 + markdown 星号),读者一次撞上三样。
        后端 HTML 报告早已改走人话那层(`l1_mapper.slot_label` / `drop_reason`),
        报告页是同一个载荷的另一个出口,不该有两套口径。
        前端没有、也不该有槽名对照表 ⟹ 人话由载荷给(`human_name` /
        `plain_reason`)。字段缺席时**退回**内部字段:宁可露出英文,
        也不许把这一条吞掉。
        钉子:`__tests__/vanishedDimensions.test.mjs`。
      */}
      {vanished.length > 0 && (
        <Card title="整维未出（当前管线没有对应的可测量）" style={{ marginBottom: '24px' }}>
          <p style={{ color: 'var(--ax-text-secondary)', marginTop: 0 }}>
            下面这一维<strong>不是本场没测到</strong>,是它要量的东西当前管线都不测 ——
            再采一百次也不会有,别等它。
          </p>
          <ul style={{ paddingLeft: '20px', margin: 0 }}>
            {vanished.map((v) => (
              <li key={v.key} style={{ marginBottom: '8px' }}>
                <strong>{v.display_name}</strong>
                <Tag style={{ marginLeft: '8px' }}>{v.n_slots} 个槽</Tag>
                <div style={{ color: 'var(--ax-text-secondary)', marginTop: '4px' }}>
                  {v.dropped
                    .map((d) => `${d.human_name ?? d.slot}：本层不测这一条 —— ${d.plain_reason ?? d.reason}`)
                    .join('；')}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {/*
        ★ 2026-10-18:L1 全表**放在旧槽之前**。
        旧槽是"14 个历史槽里过了几个门",L1 全表才是这一场真正算出来的东西
        (38 条,含 4 条算不出来的及原因)。顺序反了的话,读者先看到 7/14
        会以为"只算了 7 条",而那 31 条被算出来的根本没露过面。
      */}
      {l1 && <L1IndicatorTable l1={l1} />}

      <Card title="本次观测通过证据门的指标" style={{ marginBottom: '24px' }}>
        {slots.length > 0 ? (
          <ul style={{ paddingLeft: '20px', margin: 0 }}>
            {slots.map((s) => (
              <li key={`${s.dimension}-${s.feature}`} style={{ marginBottom: '8px' }}>
                <strong>
                  {s.display_name} · {s.indicator}
                </strong>
                ：原始值 {s.raw_value}；本场会话内观测区间 {intervalText(s.observed_interval)}
                （与原始值同量纲）；有效样本量 {s.n_valid}
                <Tag style={{ marginLeft: '8px' }}>置信度 {s.confidence}</Tag>
              </li>
            ))}
          </ul>
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="本次会话没有指标通过证据门"
          />
        )}
      </Card>

      {DIMENSION_ORDER.map((key) => {
        const dim = report.dimensions?.[key];
        if (!dim) return null;
        const gaps = dim.evidence_gaps ?? [];
        return (
          <Card
            key={key}
            style={{ marginBottom: '16px' }}
            title={
              <span>
                {dim.display_name}
                <Tag style={{ marginLeft: '8px' }}>过门 {dim.matched_indicators}</Tag>
                <Tag>置信度 {dim.confidence}</Tag>
              </span>
            }
          >
            <p style={{ color: 'var(--ax-text-secondary)', marginTop: 0 }}>{dim.description}</p>
            {gaps.length > 0 ? (
              <>
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>证据缺口</div>
                <ul
                  style={{
                    paddingLeft: '20px',
                    margin: 0,
                    color: 'var(--ax-text-secondary)',
                  }}
                >
                  {gaps.map((g, i) => (
                    <li key={i}>{g}</li>
                  ))}
                </ul>
              </>
            ) : (
              <div style={{ color: 'var(--ax-text-secondary)' }}>本维度没有证据缺口。</div>
            )}
          </Card>
        );
      })}
    </div>
  );
};

export default ReportViewer;
