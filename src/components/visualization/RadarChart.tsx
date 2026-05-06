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

  const baselines = [60, 60, 60, 60, 60, 60];

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
        },
        {
          type: 'scatterpolar',
          r: baselines,
          theta: categories,
          fill: 'none',
          name: '常模基准',
          line: { color: '#6c757d', dash: 'dot' }
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
