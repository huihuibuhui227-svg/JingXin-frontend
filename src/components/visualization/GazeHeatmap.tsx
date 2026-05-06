import React from 'react';
import Plot from 'react-plotly.js';

interface GazeDataPoint {
  x: number;
  y: number;
  timestamp: string;
}

interface GazeHeatmapProps {
  gazeData: GazeDataPoint[];
  title?: string;
}

const GazeHeatmap: React.FC<GazeHeatmapProps> = ({
  gazeData,
  title = '眼动热力图'
}) => {
  const xValues = gazeData.map(point => point.x);
  const yValues = gazeData.map(point => point.y);

  return (
    <Plot
      data={[
        {
          type: 'heatmap',
          x: xValues,
          y: yValues,
          colorscale: 'Hot',
          showscale: true
        },
        {
          type: 'scatter',
          x: xValues,
          y: yValues,
          mode: 'lines+markers',
          line: {
            color: 'rgba(46, 134, 171, 0.6)',
            width: 2
          },
          marker: {
            size: 4,
            color: '#2E86AB'
          },
          name: '眼动轨迹'
        }
      ]}
      layout={{
        title: {
          text: title,
          font: { size: 18 }
        },
        xaxis: {
          title: 'X坐标',
          scaleanchor: 'y',
          scaleratio: 1
        },
        yaxis: {
          title: 'Y坐标'
        },
        height: 500
      }}
      config={{ responsive: true }}
    />
  );
};

export default GazeHeatmap;
