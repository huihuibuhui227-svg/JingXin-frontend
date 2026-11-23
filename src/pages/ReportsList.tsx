import React, { useState, useEffect, useMemo } from 'react';
import { Layout, Table, Button, Empty, Typography, Alert, Space, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import {
  FileTextOutlined, EyeOutlined, BarChartOutlined, DownloadOutlined, AuditOutlined,
} from '@ant-design/icons';
import { dashboardApi } from '@/services/api';
import Loading from '@/components/common/Loading';

const { Content } = Layout;
const { Text } = Typography;

interface ReportItem {
  name: string;
  display_name?: string;
  url: string;
  session_id?: string | null;
  mtime?: number;
  redacted?: boolean;
}

interface ReportRow {
  key: string;
  name: string;
  url: string;
  sessionId: string | null;
  redacted: boolean;
  kind: string;
  subject: string | null;
  ts: number | null;
  tsText: string;
}

const REPORT_FILE_RE = /(?:HengCai_Evidence_Report|Research_Assessment_Report).*\.html$/i;

const parseKind = (filename: string): string => {
  if (/^HengCai_Evidence_Report/i.test(filename)) return '行为证据披露报告';
  if (/^research_/i.test(filename)) return '科研行为证据报告';
  if (/^interview_/i.test(filename)) return '面试行为证据报告';
  return '行为证据报告';
};

const parseSubject = (filename: string): string | null => {
  const segs = filename.replace(/\.html?$/i, '').split('-');
  if (segs.length < 2) return null;
  const last = segs[segs.length - 1].trim();
  let tail = last;
  if (/^[0-9a-f]{4}$/i.test(last)) {
    if (segs.length < 3) return null;
    tail = segs[segs.length - 2].trim();
  }
  return tail || null;
};

const parseTimestamp = (filename: string): { ts: number | null; text: string } => {
  const m = filename.match(/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
  if (!m) return { ts: null, text: '' };
  const [, y, mo, d, h, mi, s] = m;
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
    dashboardApi.getFiles('reports')
      .then((files: ReportItem[]) => {
        const htmlReports = (Array.isArray(files) ? files : []).filter((f) =>
          REPORT_FILE_RE.test(f?.name || '')
        );
        setReports(htmlReports);
      })
      .catch((err) => {
        console.error('获取报告列表失败:', err);
        setLoadError(err?.message || '请求失败');
      })
      .finally(() => setLoading(false));
  }, []);

  const rows: ReportRow[] = useMemo(() => {
    return reports
      .map((item) => {
        const name = item.display_name || item.name;
        const { ts, text } = parseTimestamp(name);
        return {
          key: `${name}-${item.url}`,
          name,
          url: item.url,
          sessionId: item.session_id ?? null,
          redacted: item.redacted === true,
          kind: parseKind(name),
          subject: parseSubject(name),
          ts: ts ?? (typeof item.mtime === 'number' ? item.mtime * 1000 : null),
          tsText: text || (typeof item.mtime === 'number' ? new Date(item.mtime * 1000).toLocaleString('zh-CN') : ''),
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
      title: '行为证据报告',
      dataIndex: 'kind',
      key: 'kind',
      render: (kind: string, row) => (
        <Space size={8} align="start">
          <FileTextOutlined style={{ color: 'var(--ax-primary)', marginTop: 4 }} />
          <div>
            <Space size={6} wrap>
              <Button
                type="link"
                style={{ padding: 0, height: 'auto', fontWeight: 600 }}
                onClick={() => (row.sessionId ? navigate(`/report/${row.sessionId}`) : window.open(row.url, '_blank'))}
              >
                {kind}{row.subject ? ` · ${row.subject}` : ''}
              </Button>
              {row.redacted && (
                <Tag style={{ margin: 0, fontSize: 11 }}>演示脱敏</Tag>
              )}
              {row.sessionId && (
                <Tag style={{ margin: 0, fontSize: 11, fontFamily: 'var(--ax-font-mono)' }}>
                  {row.sessionId}
                </Tag>
              )}
            </Space>
            <div style={{
              fontFamily: 'var(--ax-font-mono)',
              fontSize: 11.5,
              color: 'var(--ax-text-secondary)',
              wordBreak: 'break-all',
              marginTop: 2,
            }}>
              {row.name}
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: '生成时间',
      dataIndex: 'ts',
      key: 'ts',
      width: 200,
      sorter: (a, b) => (a.ts ?? -1) - (b.ts ?? -1),
      defaultSortOrder: 'descend',
      render: (_: unknown, row) =>
        row.tsText || <Text type="secondary">时间未识别</Text>,
    },
    {
      title: '操作',
      key: 'action',
      width: 270,
      render: (_: unknown, row) => (
        <Space size={12} wrap>
          {row.sessionId && (
            <Button
              type="link"
              size="small"
              icon={<AuditOutlined />}
              style={{ paddingInline: 0, fontWeight: 600 }}
              onClick={() => navigate(`/report/${row.sessionId}`)}
            >
              结构化查账
            </Button>
          )}
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            style={{ paddingInline: 0 }}
            onClick={() => window.open(row.url, '_blank')}
          >
            查看
          </Button>
          <a
            href={row.url}
            download={row.name}
            title={`下载 ${row.name}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              whiteSpace: 'nowrap',
              fontSize: 14,
              color: 'var(--ax-primary)',
            }}
          >
            <DownloadOutlined />
            下载
          </a>
        </Space>
      ),
    },
  ];

  if (loading) {
    return (
      <Content style={{ padding: 'var(--ax-space-lg)' }}>
        <Loading tip="正在加载报告中心..." />
      </Content>
    );
  }

  return (
    <Content style={{ padding: 'var(--ax-space-lg)' }}>
      <div style={{ maxWidth: 'var(--ax-workbench-max)', margin: '0 auto' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 'var(--ax-space-md)',
          }}
        >
          <div>
            <Typography.Title level={1} style={{ margin: 0, fontSize: 'var(--ax-display-md-size)' }}>
              报告中心
            </Typography.Title>
            {!loadError && (
              <Text style={{ color: 'var(--ax-text-secondary)', fontSize: 14 }}>
                共 {rows.length} 份行为证据报告 · 点击「结构化查账」进入交互审计，或点行尾「下载」保存离线单文件 HTML
              </Text>
            )}
          </div>
          <Button
            type="primary"
            icon={<BarChartOutlined />}
            onClick={() => navigate('/report/latest')}
          >
            最新结构化报告
          </Button>
        </div>

        {loadError ? (
          <Alert
            type="error"
            showIcon
            message="报告列表未能读取"
            description={`请确认总控面板服务已启动。错误详情：${loadError}`}
            action={
              <Button size="small" onClick={() => window.location.reload()}>
                重试
              </Button>
            }
          />
        ) : rows.length > 0 ? (
          <Table<ReportRow>
            columns={columns}
            dataSource={rows}
            size="middle"
            scroll={{ x: 760 }}
            pagination={rows.length > 20 ? { pageSize: 20, showSizeChanger: false } : false}
          />
        ) : (
          <Empty description="暂无历史行为证据报告" image={Empty.PRESENTED_IMAGE_SIMPLE}>
            <Button type="primary" onClick={() => navigate('/interview')}>
              开始采集
            </Button>
          </Empty>
        )}
      </div>
    </Content>
  );
};

export default ReportsList;
