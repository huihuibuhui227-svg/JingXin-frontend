import React from 'react';
import Plot from '@/utils/plotlyBundle';

interface TimelineDataPoint {
  timestamp: string;
  value: number;
  metric?: string;
}

interface TimelineChartProps {
  data: TimelineDataPoint[];
  title?: string;
  metricName?: string;
}

const TimelineChart: React.FC<TimelineChartProps> = ({
  data,
  title = '时间线分析',
  metricName = '指标值'
}) => {
  const timestamps = data.map(point => point.timestamp);
  const values = data.map(point => point.value);

  return (
    <Plot
      data={[
        {
          type: 'scatter',
          x: timestamps,
          y: values,
          mode: 'lines+markers',
          line: {
            color: '#4d6bfe',
            width: 3,
            shape: 'spline'
          },
          marker: {
            size: 8,
            color: '#4d6bfe'
          },
          name: metricName,
          fill: 'tozeroy',
          fillcolor: 'rgba(77, 107, 254, 0.1)'
        }
      ]}
      layout={{
        title: {
          text: title,
          font: { size: 18 }
        },
        xaxis: {
          title: '时间',
          tickangle: -45
        },
        yaxis: {
          title: metricName,
          range: [0, 1]
        },
        height: 400,
        margin: { b: 80 }
      }}
      config={{ responsive: true }}
    />
  );
};

export default TimelineChart;

