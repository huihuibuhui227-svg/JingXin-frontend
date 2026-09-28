import React, { useEffect, useState } from 'react';
import { Button, Card, Row, Col, Typography, Statistic, Skeleton } from 'antd';
import { useNavigate } from 'react-router-dom';
import { VideoCameraOutlined, ExperimentOutlined, FileTextOutlined, PlaySquareOutlined } from '@ant-design/icons';
import { dashboardApi } from '@/services/api';
import { recordingsApi } from '@/services/recordingsApi';

const { Title, Paragraph } = Typography;

const fmtBytes = (n: number): string => {
  if (!n) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
};

const Home: React.FC = () => {
  const navigate = useNavigate();

  // ⚠️ 这里**不去显示"暂无"当作终态**:拿不到就说拿不到。此前这一块是写死的
  //    「暂无历史报告，开始一次评估吧！」—— 于是"盘上其实有 48 份报告"和
  //    "真的一份都没有"在页面上长得一模一样（正是本仓在杀的形态）。
  const [reportCount, setReportCount] = useState<number | null>(null);
  const [recStats, setRecStats] = useState<{ n: number; bytes: number } | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    dashboardApi.getFiles('reports')
      .then((files: Array<{ name: string }>) =>
        setReportCount(files.filter((f) => /Assessment_Report.*\.html$/i.test(f.name)).length))
      .catch(() => setLoadError(true));
    recordingsApi.list()
      .then((r) => setRecStats({ n: r.recordings.length, bytes: r.total_video_bytes }))
      .catch(() => setLoadError(true));
  }, []);

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
          📂 历史
        </Title>
        {loadError && (
          <Paragraph type="warning">
            有一项目录没读到（后端没起？）—— 下面的数字可能不完整。
          </Paragraph>
        )}
        <Row gutter={[24, 24]}>
          <Col xs={24} md={12}>
            <Card hoverable onClick={() => navigate('/reports')}>
              <Statistic
                title="📝 历史报告"
                prefix={<FileTextOutlined />}
                value={reportCount ?? '—'}
                suffix="份"
              />
              <Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
                {reportCount === null
                  ? '读取中…'
                  : reportCount === 0
                    ? '还没有生成过报告 —— 报告不会自动生成，要手动跑一次。'
                    : '点击查看全部 →'}
              </Paragraph>
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card hoverable onClick={() => navigate('/recordings')}>
              {recStats === null ? (
                <Skeleton active paragraph={{ rows: 1 }} title={{ width: '40%' }} />
              ) : (
                <>
                  <Statistic
                    title="🎥 历史录制素材"
                    prefix={<PlaySquareOutlined />}
                    value={recStats.n}
                    suffix="场"
                  />
                  <Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
                    原生录像合计 {fmtBytes(recStats.bytes)} · 点击浏览回放与删除 →
                  </Paragraph>
                </>
              )}
            </Card>
          </Col>
        </Row>
      </div>
    </div>
  );
};

export default Home;
