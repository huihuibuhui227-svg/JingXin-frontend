
import React from 'react';
import { Card, Tabs } from 'antd';
import RadarChart from '@/components/visualization/RadarChart';
import EvidenceBar from '@/components/visualization/EvidenceBar';
import GazeHeatmap from '@/components/visualization/GazeHeatmap';
import { EvaluationResult } from '@/types/assessment';

const { TabPane } = Tabs;

interface ReportViewerProps {
  report: EvaluationResult;
}

const ReportViewer: React.FC<ReportViewerProps> = ({ report }) => {
  return (
    <div>
      <Card title="五维能力模型" style={{ marginBottom: '24px' }}>
        <RadarChart
          dimensions={{
            logical_thinking: report.dimensions.logical_thinking.score,
            stress_resilience: report.dimensions.stress_resilience.score,
            communication_fluency: report.dimensions.communication_fluency.score,
            confidence_level: report.dimensions.confidence_level.score,
            cognitive_efficiency: report.dimensions.cognitive_efficiency.score
          }}
        />
      </Card>

      <Tabs defaultActiveKey="1">
        <TabPane tab="深度分析报告" key="1">
          <Card style={{ marginBottom: '16px' }}>
            <h3>1. 情绪状态与抗压能力</h3>
            <p>{report.dimensions.stress_resilience.narrative}</p>
          </Card>
          <Card style={{ marginBottom: '16px' }}>
            <h3>2. 肢体语言与自信心</h3>
            <p>{report.dimensions.confidence_level.narrative}</p>
          </Card>
          <Card style={{ marginBottom: '16px' }}>
            <h3>3. 沟通表达能力</h3>
            <p>{report.dimensions.communication_fluency.narrative}</p>
          </Card>
        </TabPane>

        <TabPane tab="分维度证据链" key="2">
          <Card>
            <EvidenceBar
              evidenceChain={report.dimensions.logical_thinking.evidence_chain}
              title="逻辑思维证据链"
            />
          </Card>
        </TabPane>

        <TabPane tab="眼动行为分析" key="3">
          <Card>
            <GazeHeatmap
              gazeData={[
                { x: 100, y: 150, timestamp: '00:01' },
                { x: 200, y: 180, timestamp: '00:02' }
              ]}
              title="眼动热力图与轨迹"
            />
          </Card>
        </TabPane>
      </Tabs>
    </div>
  );
};

export default ReportViewer;
