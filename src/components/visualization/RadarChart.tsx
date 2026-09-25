import React from 'react';
import Plot from 'react-plotly.js';

interface RadarChartProps {
  dimensions: {
    logical_thinking: number;
    stress_resilience: number;
    communication_fluency: number;
    confidence_level: number;
    cognitive_efficiency: number;
  };
  title?: string;
}

const RadarChart: React.FC<RadarChartProps> = ({
  dimensions,
  title = '科研能力五维模型'
}) => {
  const categories = [
    '逻辑思维',
    '压力韧性',
    '沟通流畅度',
    '自信水平',
    '认知效率',
    '逻辑思维'
  ];

  const scores = [
    dimensions.logical_thinking,
    dimensions.stress_resilience,
    dimensions.communication_fluency,
    dimensions.confidence_level,
    dimensions.cognitive_efficiency,
    dimensions.logical_thinking
  ];

  // ⚠️ 这里原本还有第二条 `scatterpolar`:`r: [60,60,60,60,60,60]`、`name: '常模基准'` ——
  // **五个维度全是写死的 60,而本系统没有任何常模样本**。把它画成"基准"是让读者以为
  // 存在人群参照(spec §5.5:没有真实常模就不给位置)。2026-09-25 删除。

  return (
    <Plot
      data={[
        {
          type: 'scatterpolar',
          r: scores,
          theta: categories,
          fill: 'toself',
          name: '候选人得分',
          line: { color: '#2E86AB' },
          fillcolor: 'rgba(46, 134, 171, 0.4)'
        }
      ]}
      layout={{
        title: {
          text: title,
          font: { size: 18 }
        },
        polar: {
          radialaxis: {
            visible: true,
            range: [0, 100]
          }
        },
        height: 500,
        showlegend: true
      }}
      config={{ responsive: true }}
    />
  );
};

export default RadarChart;
