import React from 'react';
import { Button, Card, Row, Col, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { VideoCameraOutlined, ExperimentOutlined, FileTextOutlined } from '@ant-design/icons';

const { Title, Paragraph } = Typography;

const Home: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 24px' }}>
      <div style={{ textAlign: 'center', marginBottom: '60px' }}>
        <Title level={1} style={{ color: '#2E86AB', marginBottom: '16px' }}>
          🎯 JingXin 多模态评估系统
        </Title>
        <Paragraph style={{ fontSize: '18px', color: '#666' }}>
          AI驱动的智能面试与科研能力评估平台
        </Paragraph>
        <Paragraph style={{ fontSize: '16px', color: '#999' }}>
          通过面部表情、手势姿态、语音内容和眼动轨迹的多维度分析，提供全面客观的评估报告
        </Paragraph>
      </div>

      <Row gutter={[24, 24]} style={{ marginBottom: '60px' }}>
        <Col xs={24} md={12}>
          <Card
            hoverable
            style={{ height: '100%' }}
            cover={
              <div style={{
                height: '200px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '80px'
              }}>
                📹
              </div>
            }
          >
            <Card.Meta
              title="面试评估"
              description="适用于企业招聘、人才选拔等场景，全面评估候选人的综合素质"
            />
            <div style={{ marginTop: '20px' }}>
              <Button
                type="primary"
                size="large"
                icon={<VideoCameraOutlined />}
                onClick={() => navigate('/interview')}
                block
              >
                开始面试评估
              </Button>
            </div>
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card
            hoverable
            style={{ height: '100%' }}
            cover={
              <div style={{
                height: '200px',
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '80px'
              }}>
                🔬
              </div>
            }
          >
            <Card.Meta
              title="科研评估"
              description="适用于研究生入学、科研项目选拔等学术场景"
            />
            <div style={{ marginTop: '20px' }}>
              <Button
                type="primary"
                size="large"
                icon={<ExperimentOutlined />}
                onClick={() => navigate('/research')}
                block
              >
                开始科研评估
              </Button>
            </div>
          </Card>
        </Col>
      </Row>

      <div style={{ marginBottom: '40px' }}>
        <Title level={2} style={{ marginBottom: '24px' }}>
          📊 核心特性
        </Title>
        <Row gutter={[24, 24]}>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎭</div>
                <Title level={4}>多模态融合</Title>
                <Paragraph>整合视觉、听觉、行为等多维度数据</Paragraph>
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚡</div>
                <Title level={4}>实时反馈</Title>
                <Paragraph>毫秒级数据处理与即时结果展示</Paragraph>
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📈</div>
                <Title level={4}>量化评估</Title>
                <Paragraph>五大维度精准评估科研能力</Paragraph>
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
                <Title level={4}>可视化报告</Title>
                <Paragraph>自动生成交互式HTML评估报告</Paragraph>
              </div>
            </Card>
          </Col>
        </Row>
      </div>

      <div>
        <Title level={2} style={{ marginBottom: '24px' }}>
          📝 历史报告
        </Title>
        <Card>
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            <FileTextOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
            <Paragraph>暂无历史报告，开始一次评估吧！</Paragraph>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Home;
