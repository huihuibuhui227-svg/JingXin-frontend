import React from 'react';
import Plot from 'react-plotly.js';
import { EvidenceItem } from '@/types/assessment';

interface EvidenceBarProps {
  evidenceChain: EvidenceItem[];
  title?: string;
}

const EvidenceBar: React.FC<EvidenceBarProps> = ({
  evidenceChain,
  title = '证据链分析'
}) => {
  const features = evidenceChain.map(item => item.human_name);
  const scores = evidenceChain.map(item => item.normalized_score);
  const colors = evidenceChain.map(item => {
    if (item.status === '强支撑') return '#52c41a';
    if (item.status === '弱支撑') return '#faad14';
    return '#d9d9d9';
  });

  return (
    <Plot
      data={[
        {
          type: 'bar',
          x: scores,
          y: features,
          orientation: 'h',
          marker: {
            color: colors
          },
          text: scores.map(s => `${Math.round(s)}`),
          textposition: 'outside'
        }
      ]}
      layout={{
        title: {
          text: title,
          font: { size: 18 }
        },
        xaxis: {
          title: '标准化分数',
          range: [0, 100]
        },
        yaxis: {
          automargin: true
        },
        height: 400,
        margin: { l: 150 }
      }}
      config={{ responsive: true }}
    />
  );
};

export default EvidenceBar;
