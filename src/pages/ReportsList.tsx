import React, { useState, useEffect } from 'react';
import { Layout, Card, List, Button, Empty, Spin } from 'antd';
import { useNavigate } from 'react-router-dom';
import { FileTextOutlined, EyeOutlined, BarChartOutlined } from '@ant-design/icons';
import { dashboardApi } from '@/services/api';

const { Content } = Layout;

interface ReportItem {
  name: string;
  url: string;
}

const ReportsList: React.FC = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardApi.getFiles('report_frontend')
      .then((files: ReportItem[]) => {
        const htmlReports = files.filter(f => f.name.endsWith('.html'));
        setReports(htmlReports);
      })
      .catch(err => {
        console.error('获取报告列表失败:', err);
      })
      .finally(() => setLoading(false));
  }, []);

  const parseDate = (filename: string): string => {
    const match = filename.match(/(\d{8})_(\d{6})/);
    if (match) {
      const date = match[1];
      const time = match[2];
      return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)} ${time.slice(0, 2)}:${time.slice(2, 4)}:${time.slice(4, 6)}`;
    }
    return '';
  };

  const parseTitle = (filename: string): string => {
    return filename.replace(/\.html$/, '').replace(/_/g, ' ');
  };

  if (loading) {
    return (
      <Content style={{ padding: '24px', textAlign: 'center' }}>
        <Spin tip="加载报告列表..." />
      </Content>
    );
  }

  return (
    <Content style={{ padding: '24px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2>📝 历史报告</h2>
          <Button
            type="primary"
            icon={<BarChartOutlined />}
            onClick={() => window.open('http://127.0.0.1:5000', '_blank')}
          >
            最新结构化报告
          </Button>
        </div>

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
                      onClick={() => window.open(item.url, '_blank')}
                    >
                      查看
                    </Button>
                  ]}
                >
                  <Card.Meta
                    avatar={<FileTextOutlined style={{ fontSize: '24px', color: '#1890ff' }} />}
                    title={parseTitle(item.name)}
                    description={parseDate(item.name) || '未知日期'}
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
            <Button type="primary" onClick={() => navigate('/')}>
              开始评估
            </Button>
          </Empty>
        )}
      </div>
    </Content>
  );
};

export default ReportsList;
