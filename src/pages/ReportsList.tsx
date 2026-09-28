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
    // ⚠️ 请求的是 `reports`(面板对 **output 根目录** 的别名),不是 `report_frontend`:
    //    报告就直接写在 `data/output/` 根下,而后者是个**不存在**的子目录 ——
    //    面板原先回 403「不允许访问该目录」,列表因此**永远是空的**
    //    (2026-09-26 实测:使用者反复报"报告列表承接不成功")。
    // ⚠️ 根目录下还混着别的模块的产物(radar_chart_*.html / evidence_*.html,实测 518 个)
    //    ⟹ 只列真正的报告文件,否则"历史报告"里会混进几百张证据图。
    dashboardApi.getFiles('reports')
      .then((files: ReportItem[]) => {
        const htmlReports = files.filter(f => /Assessment_Report.*\.html$/i.test(f.name));
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
            // 2026-09-27 修:原先写死 `http://127.0.0.1:5000` —— 部署到服务器后,
            // 从别的电脑点这个按钮打开的是**那台电脑自己**的 5000 端口。
            // 改成走应用内的报告页(`/report/latest`),它自己按当前 host 找后端。
            onClick={() => navigate('/report/latest')}
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
