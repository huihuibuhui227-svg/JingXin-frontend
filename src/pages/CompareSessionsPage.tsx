import React, { useEffect, useState } from 'react';
import {
  Alert, Button, Card, Empty, Input, Layout, Segmented, Select, Space, Table, Tag, Typography, message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { SwapOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import {
  dashboardApi,
  longitudinalApi,
  LongitudinalTrajectoryResponse,
  LongitudinalVisitSummary,
} from '@/services/api';
import LongitudinalTrajectorySvg from '@/components/report/LongitudinalTrajectorySvg';

const { Content } = Layout;
const { Title, Paragraph, Text } = Typography;

const extractSidFromReportItem = (item: any): string | null => {
  if (item?.session_id && /^\d{8}_\d{6}_[0-9a-f]{4}$/i.test(String(item.session_id))) {
    return String(item.session_id);
  }
  const m = String(item?.name || '').match(/(\d{8}_\d{6}_[0-9a-f]{4})/i);
  return m ? m[1] : null;
};

const CompareSessionsPage: React.FC = () => {
  const navigate = useNavigate();

  const [sessionOptions, setSessionOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [manualInput, setManualInput] = useState('');
  const [sceneProfile, setSceneProfile] = useState<string>('research_interview');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LongitudinalTrajectoryResponse | null>(null);

  useEffect(() => {
    dashboardApi.getFiles('reports')
      .then((files: any[]) => {
        const seen = new Set<string>();
        const opts: Array<{ label: string; value: string }> = [];
        for (const f of Array.isArray(files) ? files : []) {
          const sid = extractSidFromReportItem(f);
          if (sid && !seen.has(sid)) {
            seen.add(sid);
            opts.push({ label: `${sid}${f?.display_name ? ` · ${f.display_name}` : ''}`, value: sid });
          }
        }
        setSessionOptions(opts);
        if (opts.length >= 2) {
          setSelectedIds([opts[1].value, opts[0].value]);
        }
      })
      .catch(() => {});
  }, []);

  const runCompare = async () => {
    const manual = manualInput
      .split(/[,，\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const merged = Array.from(new Set([...selectedIds, ...manual]));
    if (merged.length < 2) {
      message.warning('请至少选择或输入 2 个采录场次编号进行纵向对比');
      return;
    }
    setLoading(true);
    try {
      const res = await longitudinalApi.compareSessions(merged, sceneProfile);
      setResult(res);
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || '多场次对比失败');
    } finally {
      setLoading(false);
    }
  };

  const columns: ColumnsType<LongitudinalVisitSummary> = [
    {
      title: '对比场次',
      dataIndex: 'visit_label',
      key: 'visit_label',
      render: (v: string, r) => (
        <Space size={6}>
          <Tag style={{ margin: 0 }}>{v}</Tag>
          <code style={{ fontSize: 12 }}>{r.session_id}</code>
        </Space>
      ),
    },
    {
      title: '采录口径版本',
      dataIndex: 'def_version',
      key: 'def_version',
      render: (ver: string) => (
        <Tag>
          {ver === 'capture:gen1'
            ? '第一代采录口径'
            : ver === 'capture:gen2'
              ? '第二代三维采录口径'
              : ver}
        </Tag>
      ),
    },
    {
      title: '姿态口径',
      dataIndex: 'pose_mode',
      key: 'pose_mode',
      render: (m: string) => (
        <Tag
          style={
            m === '3d_matrix'
              ? { color: 'var(--ax-success)', background: 'var(--ax-success-soft)', borderColor: 'var(--ax-success-border)' }
              : undefined
          }
        >
          {m === '3d_matrix' ? '真 3D 矩阵' : m === '2d_legacy' ? '2D 历史代换' : '未得'}
        </Tag>
      ),
    },
    {
      title: '可测量覆盖与上限',
      key: 'coverage',
      render: (_, r) => (
        <span>
          {r.coverage_passed} / {r.coverage_slots} · 上限 {r.confidence_cap}
        </span>
      ),
    },
    {
      title: '模型裁判核验阶段',
      dataIndex: 'referee_stage_label',
      key: 'referee_stage_label',
      render: (lbl: string, r) => (
        <Space size={4}>
          <Tag color={r.uncertainty_escalated ? 'warning' : 'default'}>{lbl}</Tag>
          {r.ood_anomaly_flag && <Tag color="error">分布偏离</Tag>}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, r) => (
        <Button
          size="small"
          type="link"
          onClick={() => navigate(`/report/${r.session_id}?scene_profile=${encodeURIComponent(sceneProfile)}`)}
        >
          打开详细报告 ›
        </Button>
      ),
    },
  ];

  return (
    <Content className="ax-workbench" style={{ padding: '24px' }}>
      <div style={{ maxWidth: 'var(--ax-content-max)', margin: '0 auto' }}>
        <div style={{ marginBottom: 18 }}>
          <Tag style={{ marginBottom: 8, color: 'var(--ax-b1)', background: 'var(--ax-b1-soft)', borderColor: 'var(--ax-b1-border)', fontWeight: 600 }}>
            研思循证 · 多场次纵向对照工作台
          </Tag>
          <Title level={1} style={{ margin: 0, fontSize: 28 }}>
            研思循证 · 跨场次变化对照与可比性核查
          </Title>
          <Paragraph type="secondary" style={{ margin: '6px 0 0', maxWidth: 820 }}>
            并行核对同一参与者多次汇报场次的变化情况；系统严格隔离第一代采录口径与第二代三维采录口径，遇缺失项保持断线绝不补零，亦不给出数值总分。
          </Paragraph>
        </div>

        <Card className="ax-card" style={{ marginBottom: 20 }}>
          <Space direction="vertical" size={14} style={{ width: '100%' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              <Text strong>对照场景口径：</Text>
              <Segmented
                aria-label="选择场景对比档案"
                value={sceneProfile}
                onChange={(v) => setSceneProfile(String(v))}
                options={[
                  { label: '研思循证', value: 'research_interview' },
                  { label: '元智审辨', value: 'ai_metacognition' },
                  { label: '时序观微', value: 'longitudinal_followup' },
                ]}
              />
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              <Select
                mode="multiple"
                aria-label="多选历史采录场次进行对比"
                placeholder="选择 2 至 6 个历史采录场次（按先后次序）"
                value={selectedIds}
                onChange={setSelectedIds}
                options={sessionOptions}
                style={{ minWidth: 320, flex: '1 1 320px' }}
              />
              <Input
                aria-label="补充输入采录场次编号"
                placeholder="追加手动采录场次编号（逗号分隔）"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                style={{ maxWidth: 260 }}
              />
              <Button
                type="primary"
                className="ax-btn--pill"
                icon={<SwapOutlined />}
                loading={loading}
                onClick={() => void runCompare()}
              >
                执行多场纵向对照
              </Button>
            </div>
          </Space>
        </Card>

        {!result ? (
          <Card className="ax-card">
            <Empty description="请选择至少两个会话并点击「执行多场纵向对照」" />
          </Card>
        ) : (
          <Space direction="vertical" size={20} style={{ width: '100%' }}>
            {result.review_alerts.length > 0 && (
              <Alert
                type="warning"
                showIcon
                message="人工复核提示"
                description={result.review_alerts.join('；')}
              />
            )}

            <Card className="ax-card" title={`场次参数与可比性并排总览（共 ${result.n_visits} 场）`}>
              <Table
                size="small"
                rowKey={(r) => `${r.visit_order}-${r.session_id}`}
                columns={columns}
                dataSource={result.visits}
                pagination={false}
                scroll={{ x: 760 }}
              />
            </Card>

            <LongitudinalTrajectorySvg
              series={result.series}
              comparable={result.comparable}
              defVersions={result.def_versions}
              comparabilityNotes={result.comparability_notes}
              methodology={result.methodology}
            />
          </Space>
        )}
      </div>
    </Content>
  );
};

export default CompareSessionsPage;
