
import React from 'react';
import { Layout, Card, List, Button, Empty } from 'antd';
import { useNavigate } from 'react-router-dom';
import { FileTextOutlined, EyeOutlined } from '@ant-design/icons';

const { Content } = Layout;

interface ReportItem {
  id: string;
  title: string;
  date: string;
  score: number;
  type: 'interview' | 'research';
}

const ReportsList: React.FC = () => {
  const navigate = useNavigate();
  const [reports] = React.useState<ReportItem[]>([]);

  const handleStartAssessment = () => {
    // 在新标签页打开后端总控平台
    window.open('http://127.0.0.1:5000', '_blank');
  };

  return (
    <Content style={{ padding: '24px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <h2 style={{ marginBottom: '24px' }}>📝 历史报告</h2>

        {reports.length > 0 ? (
          <List
            grid={{ gutter: 16, xs: 1, sm: 2, md: 3 }}
            dataSource={reports}
            renderItem={(item) => (
              <List.Item>
                <Card
                  hoverable
                  actions={[
                    <Button
                      type="link"
                      icon={<EyeOutlined />}
                      onClick={() => navigate(`/report/${item.id}`)}
                    >
                      查看
                    </Button>
                  ]}
                >
                  <Card.Meta
                    avatar={<FileTextOutlined style={{ fontSize: '24px', color: '#1890ff' }} />}
                    title={item.title}
                    description={
                      <div>
                        <div>{item.date}</div>
                        <div style={{ marginTop: '8px', color: '#2E86AB', fontWeight: 'bold' }}>
                          评分: {item.score}
                        </div>
                      </div>
                    }
                  />
                </Card>
              </List.Item>
            )}
          />
        ) : (
          <Empty
            description="暂无历史报告"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button type="primary" onClick={handleStartAssessment}>
              开始评估
            </Button>
          </Empty>
        )}
      </div>
    </Content>
  );
};

export default ReportsList;

