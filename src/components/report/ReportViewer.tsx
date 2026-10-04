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

  return (
    <div>
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
