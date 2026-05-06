import React, { useState } from 'react';
import { Layout, Card, Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import ReportViewer from '@/components/report/ReportViewer';
import DownloadButton from '@/components/report/DownloadButton';
import { EvaluationResult } from '@/types/assessment';
import { getLevelLabel } from '@/utils/constants';

const { Content } = Layout;

const ReportPage: React.FC = () => {
  const navigate = useNavigate();

  const [mockReport] = useState<EvaluationResult>({
    total_score: 82.5,
    total_level: '良好',
    dimensions: {
      logical_thinking: {
        display_name: '逻辑思维',
        description: '逻辑推理与分析能力',
        algorithm: '基于语言模式和推理结构分析',
        score: 85,
        level: '优秀',
        narrative: '候选人在回答问题时展现出清晰的逻辑结构...',
        simple_narrative: '逻辑思维能力强',
        evidence_chain: [],
        positive_factors: ['结构化表达', '因果推理清晰'],
        negative_factors: [],
        confidence: '高',
        matched_indicators: '8/10',
        stats: {}
      },
      stress_resilience: {
        display_name: '压力韧性',
        description: '面对压力的应对能力',
        algorithm: '基于面部紧张度和语音稳定性',
        score: 78,
        level: '良好',
        narrative: '在高压问题下保持相对稳定...',
        simple_narrative: '抗压能力良好',
        evidence_chain: [],
        positive_factors: ['情绪稳定'],
        negative_factors: ['轻微紧张'],
        confidence: '中',
        matched_indicators: '7/10',
        stats: {}
      },
      communication_fluency: {
        display_name: '沟通流畅度',
        description: '语言表达的流畅程度',
        algorithm: '基于语音节奏和停顿分析',
        score: 82,
        level: '优秀',
        narrative: '语言表达流畅自然...',
        simple_narrative: '沟通能力优秀',
        evidence_chain: [],
        positive_factors: ['语速适中', '停顿合理'],
        negative_factors: [],
        confidence: '高',
        matched_indicators: '9/10',
        stats: {}
      },
      confidence_level: {
        display_name: '自信水平',
        description: '表现出的自信程度',
        algorithm: '基于肢体语言和语调分析',
        score: 80,
        level: '良好',
        narrative: '整体表现自信...',
        simple_narrative: '自信心良好',
        evidence_chain: [],
        positive_factors: ['眼神接触良好'],
        negative_factors: [],
        confidence: '中',
        matched_indicators: '7/10',
        stats: {}
      },
      cognitive_efficiency: {
        display_name: '认知效率',
        description: '信息处理和问题解决效率',
        algorithm: '基于反应时间和回答质量',
        score: 75,
        level: '良好',
        narrative: '问题响应及时...',
        simple_narrative: '认知效率良好',
        evidence_chain: [],
        positive_factors: ['反应迅速'],
        negative_factors: ['复杂问题需要更多时间'],
        confidence: '中',
        matched_indicators: '6/10',
        stats: {}
      }
    },
    summary_narrative: '候选人整体表现良好，在逻辑思维和沟通方面表现突出...',
    model_metadata: {
      version: '1.0.0',
      timestamp: new Date().toISOString()
    }
  });

  return (
    <Content style={{ padding: '24px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button onClick={() => navigate(-1)}>← 返回列表</Button>
          <h2 style={{ margin: 0 }}>评估报告</h2>
          <DownloadButton />
        </div>

        <Card style={{ marginBottom: '24px' }}>
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <div style={{ fontSize: '48px', fontWeight: 'bold', color: '#2E86AB', marginBottom: '8px' }}>
              {mockReport.total_score}
            </div>
            <div style={{ fontSize: '24px', color: '#666', marginBottom: '8px' }}>
              综合评分: {getLevelLabel(mockReport.total_score)}
            </div>
            <div style={{ color: '#999' }}>
              评估时间: {new Date(mockReport.model_metadata.timestamp).toLocaleString('zh-CN')}
            </div>
          </div>
        </Card>

        <ReportViewer report={mockReport} />
      </div>
    </Content>
  );
};

export default ReportPage;
