import React, { useState, useEffect, useMemo } from 'react';
import { Layout, Table, Button, Empty, Spin, Typography, Alert, Space } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import { FileTextOutlined, EyeOutlined, BarChartOutlined } from '@ant-design/icons';
import { dashboardApi } from '@/services/api';

const { Content } = Layout;
const { Text } = Typography;

interface ReportItem {
  name: string;
  url: string;
}

/** 一行报告的结构化形态（由文件名解析而来）。 */
interface ReportRow {
  key: string;
  name: string;
  url: string;
  kind: string; // 「科研评估报告」/「面试评估报告」…
  ts: number | null; // 毫秒时间戳，用于排序；解析失败为 null
  tsText: string; // 展示用「2026-09-28 23:25:20」，解析失败为空串
}

/**
 * 从文件名解析出类型。
 *
 * 文件名形如 `Research_Assessment_Report_20260928_232520.html`。
 * 此前标题直接是 `name.replace(/_/g,' ')`，于是中文界面上显示一串英文机器名
 * （`Research Assessment Report 20260928 232520`）——既不是给人看的，
 * 还把日期重复了一遍（下面一行已经有格式化好的时间）。
 */
const parseKind = (filename: string): string => {
  if (/^research_/i.test(filename)) return '科研评估报告';
  if (/^interview_/i.test(filename)) return '面试评估报告';
  return '评估报告';
};

/** 解析 `20260928_232520` 为时间戳与展示文本。解析不出来就返回 null（不编造日期）。 */
const parseTimestamp = (filename: string): { ts: number | null; text: string } => {
  const m = filename.match(/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
  if (!m) return { ts: null, text: '' };
  const [, y, mo, d, h, mi, s] = m;
  // ⚠️ 用本地时间构造（与文件名记录的口径一致）。`Date.parse('2026-09-28 23:25:20')`
  //    在各浏览器行为不一致，所以显式拆开传参。
  const date = new Date(+y, +mo - 1, +d, +h, +mi, +s);
  const ts = date.getTime();
  if (Number.isNaN(ts)) return { ts: null, text: '' };
  return { ts, text: `${y}-${mo}-${d} ${h}:${mi}:${s}` };
};

const ReportsList: React.FC = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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
        // ⚠️ 此前这里只 `console.error` 就把错误吞了，于是**请求失败**和
        //    **真的没有报告**在页面上长得一模一样（都显示「暂无历史报告」）。
        //    这正是本仓在杀的形态：拿不到就说拿不到，不要装作"没有"。
        //    Home.tsx 已经这么做了，这里此前没有对齐。
        console.error('获取报告列表失败:', err);
        setLoadError(err?.message || '请求失败');
      })
      .finally(() => setLoading(false));
  }, []);

  // 按时间倒序（新的在前）。解析不出时间的排在最后 —— 不用 0 冒充，
  // 否则它们会混在"最新"那一头。
  const rows: ReportRow[] = useMemo(() => {
    return reports
      .map((item) => {
        const { ts, text } = parseTimestamp(item.name);
        return {
          key: item.name,
          name: item.name,
          url: item.url,
          kind: parseKind(item.name),
          ts,
          tsText: text
        };
      })
      .sort((a, b) => {
        if (a.ts === null && b.ts === null) return a.name.localeCompare(b.name);
        if (a.ts === null) return 1;
        if (b.ts === null) return -1;
        return b.ts - a.ts;
      });
  }, [reports]);

  const columns: ColumnsType<ReportRow> = [
    {
      title: '报告',
      dataIndex: 'kind',
      key: 'kind',
      render: (kind: string, row) => (
        <Space size={8}>
          <FileTextOutlined style={{ color: 'var(--ax-primary)' }} />
          <a onClick={() => window.open(row.url, '_blank')}>{kind}</a>
        </Space>
      )
    },
    {
      title: '生成时间',
      dataIndex: 'ts',
      key: 'ts',
      width: 220,
      sorter: (a, b) => (a.ts ?? -1) - (b.ts ?? -1),
      defaultSortOrder: 'descend',
      render: (_: unknown, row) =>
        row.tsText || <Text type="secondary">时间未识别</Text>
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: unknown, row) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          style={{ paddingInline: 0 }}
          onClick={() => window.open(row.url, '_blank')}
        >
          查看
        </Button>
      )
    }
  ];

  if (loading) {
    return (
      <Content style={{ padding: 'var(--ax-space-lg)', textAlign: 'center' }}>
        <Spin tip="加载报告列表..." />
      </Content>
    );
  }

  return (
    <Content style={{ padding: 'var(--ax-space-lg)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 'var(--ax-space-md)'
          }}
        >
          <div>
            {/* level={1} 是语义要求（page-has-heading-one），视觉压回 h3 大小 */}
            <Typography.Title level={1} style={{ margin: 0, fontSize: 'var(--ax-display-md-size)' }}>
              历史报告
            </Typography.Title>
            {!loadError && (
              <Text type="secondary">
                共 {rows.length} 份
              </Text>
            )}
          </div>
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

        {loadError ? (
          <Alert
            type="error"
            showIcon
            message="报告列表没读出来"
            description={
              <>
                后端可能没起，或面板拒绝了这次请求。这不是「没有报告」。
                <br />
                错误：{loadError}
              </>
            }
            action={
              <Button size="small" onClick={() => window.location.reload()}>
                重试
              </Button>
            }
          />
        ) : rows.length > 0 ? (
          /*
            从「卡片网格 + 每张卡底部一整条操作栏」换成表格。
            原来的写法里，antd 的 `Card.actions` 会给**每张卡**渲染一整行页脚，
            里面只有一个「查看」——11 份报告就是 11 条几乎一样的横条，
            真正有信息量的只有小字。表格可以让类型/时间/操作对齐成列，
            扫读成本低得多，而且时间列自带排序。
          */
          <Table<ReportRow>
            columns={columns}
            dataSource={rows}
            size="middle"
            pagination={rows.length > 20 ? { pageSize: 20, showSizeChanger: false } : false}
          />
        ) : (
          <Empty description="暂无历史报告" image={Empty.PRESENTED_IMAGE_SIMPLE}>
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
