import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Button, Card, Col, Empty, Input, Layout, Row, Select, Space, Tag, Typography, message,
} from 'antd';
import { PlusOutlined, SafetyCertificateOutlined, VideoCameraOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import {
  dashboardApi,
  longitudinalApi,
  LongitudinalSubject,
  LongitudinalTrajectoryResponse,
  PrivacyConsentMode,
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

const FollowupPage: React.FC = () => {
  const navigate = useNavigate();

  const [subjects, setSubjects] = useState<LongitudinalSubject[]>([]);
  const [complianceNote, setComplianceNote] = useState(
    '非医疗器械 · 本模块仅计算匿名编号多次采录的客观声学与三维运动学指标变化轨迹，绝不跨人对照或输出任何健康状态结论。'
  );
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [trajectory, setTrajectory] = useState<LongitudinalTrajectoryResponse | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingTraj, setLoadingTraj] = useState(false);

  const [newCode, setNewCode] = useState('');
  const [newNote, setNewNote] = useState('');
  const [creating, setCreating] = useState(false);

  const [sessionOptions, setSessionOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [attachSid, setAttachSid] = useState('');
  const [attachLabel, setAttachLabel] = useState('');
  const [attachPrivacy, setAttachPrivacy] = useState<PrivacyConsentMode>('anonymous_kinematics_only');
  const [attaching, setAttaching] = useState(false);

  const loadTrajectory = useCallback(async (code: string) => {
    setLoadingTraj(true);
    try {
      const res = await longitudinalApi.getTrajectory(code);
      setTrajectory(res);
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || '读取随访轨迹失败');
      setTrajectory(null);
    } finally {
      setLoadingTraj(false);
    }
  }, []);

  const loadSubjects = useCallback(async (preferCode?: string) => {
    setLoadingList(true);
    try {
      const res = await longitudinalApi.listSubjects();
      setSubjects(res.subjects || []);
      if (res.compliance_note) setComplianceNote(res.compliance_note);
      const nextCode = preferCode || selectedCode || res.subjects?.[0]?.subject_code || null;
      setSelectedCode(nextCode);
      if (nextCode && (res.subjects || []).some((s) => s.subject_code === nextCode)) {
        void loadTrajectory(nextCode);
      } else {
        setTrajectory(null);
      }
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || '读取随访档案失败');
    } finally {
      setLoadingList(false);
    }
  }, [selectedCode, loadTrajectory]);

  useEffect(() => {
    void loadSubjects();
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
      })
      .catch(() => {});
  }, []);

  const handleCreateSubject = async () => {
    const code = newCode.trim();
    if (!code) {
      message.warning('请输入匿名随访编号（如 SUBJ-001）');
      return;
    }
    setCreating(true);
    try {
      await longitudinalApi.upsertSubject({
        subject_code: code,
        scene_profile: 'longitudinal_followup',
        alias_note: newNote.trim(),
        consent_mode: 'anonymous_kinematics_only',
      });
      message.success(`匿名随访档案 ${code} 已建档`);
      setNewCode('');
      setNewNote('');
      await loadSubjects(code);
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || '建档失败');
    } finally {
      setCreating(false);
    }
  };

  const handleAttachVisit = async () => {
    if (!selectedCode) return;
    const sid = attachSid.trim();
    if (!sid) {
      message.warning('请选择或输入要绑定的会话 session_id');
      return;
    }
    setAttaching(true);
    try {
      await longitudinalApi.attachVisit(selectedCode, {
        session_id: sid,
        visit_label: attachLabel.trim(),
        privacy_mode: attachPrivacy,
      });
      message.success(`已将会话 ${sid} 挂入 ${selectedCode} 随访序列`);
      setAttachSid('');
      setAttachLabel('');
      await loadSubjects(selectedCode);
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || '绑定访次失败');
    } finally {
      setAttaching(false);
    }
  };

  return (
    <Content className="ax-workbench" style={{ padding: '24px' }}>
      <div style={{ maxWidth: 'var(--ax-content-max)', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14, marginBottom: 18 }}>
          <div>
            <Tag style={{ marginBottom: 8, color: 'var(--ax-primary)', background: 'var(--ax-info-soft)', borderColor: 'var(--ax-info-border)', fontWeight: 600 }}>
              基地三 · 长周期行为随访中心（10% 前瞻预留 · 非医疗红线）
            </Tag>
            <Title level={1} style={{ margin: 0, fontSize: 28 }}>
              匿名受试编号个体内长周期纵向跟踪
            </Title>
            <Paragraph type="secondary" style={{ margin: '6px 0 0', maxWidth: 820 }}>
              默认锁死零原始影像原声落盘隐私模式（仅存匿名三维姿态矩阵与声学标量日志），以本人首访（t0）作为自我参考基线观测时间变化。
            </Paragraph>
          </div>
          <Button
            type="primary"
            className="ax-btn--pill"
            icon={<VideoCameraOutlined />}
            onClick={() =>
              navigate(selectedCode ? `/followup/capture?subject=${encodeURIComponent(selectedCode)}` : '/followup/capture')
            }
          >
            发起本次匿名无影像采录
          </Button>
        </div>

        <Alert
          type="warning"
          showIcon
          icon={<SafetyCertificateOutlined />}
          style={{ marginBottom: 20 }}
          message="非医疗器械合规声明"
          description={complianceNote}
        />

        <Row gutter={[20, 20]}>
          <Col xs={24} lg={8}>
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <Card className="ax-card" title="新建匿名随访档案">
                <Space direction="vertical" size={10} style={{ width: '100%' }}>
                  <Input
                    aria-label="输入匿名随访编号"
                    placeholder="匿名编号（如 SUBJ-001，2-48位字母数字）"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                  />
                  <Input
                    aria-label="输入匿名分组备注"
                    placeholder="分组或对照备注（可选，禁填姓名/隐私）"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                  />
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    loading={creating}
                    onClick={() => void handleCreateSubject()}
                  >
                    创建匿名随访编号
                  </Button>
                </Space>
              </Card>

              <Card className="ax-card" title={`匿名随访序列（${subjects.length} 组）`} loading={loadingList}>
                {subjects.length === 0 ? (
                  <Empty description="暂无匿名随访档案，请在上方新建" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {subjects.map((subj) => {
                      const active = selectedCode === subj.subject_code;
                      return (
                        <button
                          key={subj.subject_code}
                          type="button"
                          onClick={() => {
                            setSelectedCode(subj.subject_code);
                            void loadTrajectory(subj.subject_code);
                          }}
                          style={{
                            textAlign: 'left',
                            padding: '10px 12px',
                            borderRadius: 'var(--ax-rounded-md)',
                            background: active ? 'var(--ax-info-soft)' : 'var(--ax-parchment)',
                            border: active ? '1px solid var(--ax-info-border)' : '1px solid var(--ax-hairline)',
                            cursor: 'pointer',
                            fontFamily: 'var(--ax-font-text)',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text strong>{subj.subject_code}</Text>
                            <Tag style={{ margin: 0 }}>{subj.visits?.length || 0} 次随访</Tag>
                          </div>
                          {subj.alias_note && (
                            <div style={{ fontSize: 12.5, color: 'var(--ax-text-secondary)', marginTop: 4 }}>
                              {subj.alias_note}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </Card>
            </Space>
          </Col>

          <Col xs={24} lg={16}>
            {!selectedCode ? (
              <Card className="ax-card">
                <Empty description="请在左侧选择或新建一个匿名随访档案查看纵向轨迹" />
              </Card>
            ) : (
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Card
                  className="ax-card"
                  title={`档案 ${selectedCode} · 挂接实测访次`}
                  extra={
                    <Button
                      size="small"
                      type="primary"
                      onClick={() => navigate(`/followup/capture?subject=${encodeURIComponent(selectedCode)}`)}
                    >
                      为此编号新增采录 ›
                    </Button>
                  }
                >
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                    <Select
                      aria-label="选择已采录会话编号"
                      showSearch
                      allowClear
                      placeholder="从已有会话挑选或手动填入 session_id"
                      value={sessionOptions.some((o) => o.value === attachSid) ? attachSid : undefined}
                      onChange={(val) => setAttachSid(val || '')}
                      options={sessionOptions}
                      style={{ minWidth: 220, flex: '1 1 200px' }}
                    />
                    <Input
                      aria-label="输入会话编号"
                      placeholder="session_id"
                      value={attachSid}
                      onChange={(e) => setAttachSid(e.target.value)}
                      style={{ width: 190 }}
                    />
                    <Input
                      aria-label="输入访次名称"
                      placeholder="访次标签（如 第2周复测）"
                      value={attachLabel}
                      onChange={(e) => setAttachLabel(e.target.value)}
                      style={{ width: 170 }}
                    />
                    <Select
                      aria-label="选择隐私留存模式"
                      value={attachPrivacy}
                      onChange={(val) => setAttachPrivacy(val)}
                      style={{ width: 185 }}
                      options={[
                        { label: '仅匿名特征（推荐）', value: 'anonymous_kinematics_only' },
                        { label: '仅采声音', value: 'audio_only' },
                        { label: '全模态留存', value: 'full' },
                      ]}
                    />
                    <Button type="primary" loading={attaching} onClick={() => void handleAttachVisit()}>
                      挂入序列
                    </Button>
                  </div>
                </Card>

                {trajectory && trajectory.review_alerts.length > 0 && (
                  <Alert
                    type="warning"
                    showIcon
                    message="第三层分布偏离与保形不确定人工复核提示"
                    description={
                      <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                        {trajectory.review_alerts.map((a) => <li key={a}>{a}</li>)}
                      </ul>
                    }
                  />
                )}

                {loadingTraj ? (
                  <Card className="ax-card" loading />
                ) : trajectory ? (
                  <LongitudinalTrajectorySvg
                    series={trajectory.series}
                    comparable={trajectory.comparable}
                    defVersions={trajectory.def_versions}
                    comparabilityNotes={trajectory.comparability_notes}
                  />
                ) : null}
              </Space>
            )}
          </Col>
        </Row>
      </div>
    </Content>
  );
};

export default FollowupPage;
