import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Button, Card, Col, Drawer, Input, Layout, Row, Select, Space, Table, Tabs, Tag, Typography, message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ApiOutlined, ArrowRightOutlined, SearchOutlined, ToolOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import ModuleSubnav from '@/components/common/ModuleSubnav';
import {
  careerMcpApi,
  CareerPosition,
  CritiqueTaskResponse,
  dashboardApi,
  EvidenceAlignmentResponse,
  JdDecomposeResponse,
} from '@/services/api';

const { Content } = Layout;
const { Paragraph, Text } = Typography;

const INDICATOR_LABELS: Record<string, string> = {
  discourse_marker_rate: '连接词逻辑密度',
  answer_detail_chars_p50: '回答详实度',
  speech_rate: '语速',
  counter_premise_marker_rate: '前提质疑与边界标记密度',
  evidence_verification_marker_rate: '信息核验标记密度',
  revision_anchor_density: '修正方案锚点密度',
  metacognitive_regulation_balance: '三环调控覆盖度',
  pause_structure_entropy: '停顿分布结构熵',
  voiced_ratio: '有声占比',
  pitch_variability_per_sec: '基频变化活跃度',
  response_latency_sec: '首句响应时延',
  pause_duration_p50: '单次停顿中位时长',
  self_repair_rate: '口头自我修正率',
  lexical_diversity: '词汇丰富度',
  gaze_stability: '视线稳定性',
  gaze_dwell_p50: '视线驻留中位时长',
  gesture_activity_per_sec: '手势活动频率',
  hand_openness_p50: '手掌舒展中位度',
  smile_duration_p50: '微笑持续中位时长',
};

const labelOfIndicator = (key: string): string => INDICATOR_LABELS[key] || key;

const extractSidFromReportItem = (item: any): string | null => {
  if (item?.session_id && /^\d{8}_\d{6}_[0-9a-f]{4}$/i.test(String(item.session_id))) {
    return String(item.session_id);
  }
  const m = String(item?.name || '').match(/(\d{8}_\d{6}_[0-9a-f]{4})/i);
  return m ? m[1] : null;
};

const CareerMcpPage: React.FC = () => {
  const navigate = useNavigate();

  const [positions, setPositions] = useState<CareerPosition[]>([]);
  const [tracks, setTracks] = useState<string[]>([]);
  const [levels, setLevels] = useState<string[]>([]);
  const [keyword, setKeyword] = useState('');
  const [trackFilter, setTrackFilter] = useState('全部');
  const [levelFilter, setLevelFilter] = useState('全部');
  const [loadingPos, setLoadingPos] = useState(false);

  const [selectedPosition, setSelectedPosition] = useState<CareerPosition | null>(null);
  const [jdText, setJdText] = useState('');
  const [decomposing, setDecomposing] = useState(false);
  const [jdDecomposed, setJdDecomposed] = useState<JdDecomposeResponse | null>(null);

  const [sessionOptions, setSessionOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [sessionId, setSessionId] = useState('');
  const [aligning, setAligning] = useState(false);
  const [alignment, setAlignment] = useState<EvidenceAlignmentResponse | null>(null);
  const [practiceTask, setPracticeTask] = useState<CritiqueTaskResponse | null>(null);

  const [rpcOpen, setRpcOpen] = useState(false);
  const [rpcLoading, setRpcLoading] = useState(false);
  const [rpcRequestText, setRpcRequestText] = useState('');
  const [rpcResponseText, setRpcResponseText] = useState('');

  const fetchPositions = useCallback(async (kw = keyword, tr = trackFilter, lv = levelFilter) => {
    setLoadingPos(true);
    try {
      const res = await careerMcpApi.listPositions({ keyword: kw, track: tr, level: lv });
      setPositions(res.positions || []);
      setTracks(res.tracks || []);
      setLevels(res.levels || []);
      setSelectedPosition((prev) => {
        if (prev && res.positions.some((p) => p.position_id === prev.position_id)) return prev;
        return res.positions[0] ?? null;
      });
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || '读取岗位能力库失败');
    } finally {
      setLoadingPos(false);
    }
  }, [keyword, trackFilter, levelFilter]);

  useEffect(() => {
    void fetchPositions('', '全部', '全部');
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
        if (opts[0]) setSessionId((prev) => prev || opts[0].value);
      })
      .catch(() => {});
  }, []);

  const handleDecomposeJd = async () => {
    if (!jdText.trim()) {
      message.warning('请先粘贴或输入一段岗位职责（JD）文本');
      return;
    }
    setDecomposing(true);
    try {
      const res = await careerMcpApi.decomposeJd(jdText);
      setJdDecomposed(res);
      const taskRes = await careerMcpApi.generateTask({ jd_text: jdText });
      setPracticeTask(taskRes);
      message.success('已完成岗位可观测线索拆解与审辨题生成');
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || '岗位职责拆解失败');
    } finally {
      setDecomposing(false);
    }
  };

  const handleAlignEvidence = async () => {
    const sid = sessionId.trim();
    if (!sid) {
      message.warning('请先选择或输入一个采录场次编号');
      return;
    }
    setAligning(true);
    try {
      const res = await careerMcpApi.alignEvidence({
        session_id: sid,
        position_id: jdDecomposed ? '' : selectedPosition?.position_id || '',
        jd_text: jdDecomposed ? jdText : '',
      });
      setAlignment(res);
      if (res.next_practice_task) {
        setPracticeTask({ status: 'success', ...res.next_practice_task });
      }
      message.success('已完成行为证据与岗位要求对照');
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || '采录证据对照失败');
    } finally {
      setAligning(false);
    }
  };

  const launchMetacognitionTraining = async () => {
    let task = practiceTask;
    if (!task) {
      try {
        task = await careerMcpApi.generateTask({
          position_id: jdDecomposed ? '' : selectedPosition?.position_id || '',
          jd_text: jdDecomposed ? jdText : '',
        });
        setPracticeTask(task);
      } catch (err: any) {
        message.error(err?.response?.data?.message || '生成审辨实训题失败');
        return;
      }
    }
    navigate('/metacognition', {
      state: {
        taskBanner: {
          positionTitle: task.position_title,
          prompt: task.question_prompt,
          stages: task.stages?.map((s) => ({ label: s.label, tip: s.tip })) ?? [],
        },
      },
    });
  };

  const runRpcDemo = async (method: string, params: Record<string, unknown> = {}) => {
    const reqObj = { jsonrpc: '2.0', id: Date.now(), method, params };
    setRpcRequestText(JSON.stringify(reqObj, null, 2));
    setRpcLoading(true);
    try {
      const resp = await careerMcpApi.rpc(method, params, reqObj.id);
      setRpcResponseText(JSON.stringify(resp, null, 2));
    } catch (err: any) {
      setRpcResponseText(JSON.stringify({ error: err?.response?.data || err?.message }, null, 2));
    } finally {
      setRpcLoading(false);
    }
  };

  const alignColumns: ColumnsType<EvidenceAlignmentResponse['competency_alignments'][number]> = [
    {
      title: '可观测能力维度',
      dataIndex: 'label',
      key: 'label',
      render: (lbl: string, r) => (
        <div>
          <Space wrap size={6}>
            <Text strong>{lbl}</Text>
            {r.theoretical_construct && (
              <Tag
                style={{
                  margin: 0,
                  fontSize: 11.5,
                  color: 'var(--ax-b2)',
                  background: 'var(--ax-b2-soft)',
                  borderColor: 'var(--ax-b2-border)',
                }}
              >
                {r.theoretical_construct}
              </Tag>
            )}
          </Space>
          <div style={{ fontSize: 12, color: 'var(--ax-text-secondary)', marginTop: 4 }}>{r.critique_focus}</div>
        </div>
      ),
    },
    {
      title: '证据覆盖情况',
      dataIndex: 'coverage_status',
      key: 'coverage_status',
      width: 170,
      render: (status: string) => {
        const isStrong = status.includes('充分');
        const isMissing = status.includes('缺口');
        return (
          <Tag
            color={isMissing ? 'warning' : undefined}
            style={
              isStrong
                ? { color: 'var(--ax-success)', background: 'var(--ax-success-soft)', borderColor: 'var(--ax-success-border)' }
                : undefined
            }
          >
            {status}
          </Tag>
        );
      },
    },
    {
      title: '对应客观实测线索',
      dataIndex: 'evidences',
      key: 'evidences',
      render: (evs: EvidenceAlignmentResponse['competency_alignments'][number]['evidences']) => (
        <Space direction="vertical" size={4}>
          {evs.map((e) => (
            <div key={e.indicator} style={{ fontSize: 12.5 }}>
              <Text strong>{(e.label || labelOfIndicator(e.indicator)).replace(/\*\*/g, '')}</Text>：
              {e.value === null ? (
                <Text type="secondary">缺口（{e.gap || '未采得'}）</Text>
              ) : (
                <span>
                  {typeof e.value === 'number' ? e.value.toFixed(3) : e.value} {e.unit}（置信：{e.confidence}）
                </span>
              )}
            </div>
          ))}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ background: 'var(--ax-canvas)', minHeight: '100%' }}>
      <ModuleSubnav
        world="claude"
        moduleTitle="02 / 元智审辨"
        items={[
          { to: '/hub/metacognition', label: '场景概览' },
          { to: '/career-mcp', label: '岗位对照' },
          { to: '/metacognition', label: 'AI 审辨实训' },
        ]}
      />
      <Content style={{ background: 'var(--ax-canvas)', padding: '32px 24px 56px' }}>
        <div style={{ maxWidth: 'var(--ax-content-max)', margin: '0 auto' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: 18,
              paddingBottom: 22,
              marginBottom: 22,
              borderBottom: '1px solid var(--ax-hairline)',
            }}
          >
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span aria-hidden="true" style={{ color: '#cc785c', fontSize: 14, lineHeight: 1 }}>✦</span>
                <span
                  style={{
                    fontFamily: 'var(--ax-font-text)',
                    fontSize: 13,
                    fontWeight: 500,
                    color: '#8d4026',
                    letterSpacing: '0.02em',
                  }}
                >
                  元智审辨 · AI 元能力与职业实训
                </span>
              </div>
              <h1
                style={{
                  margin: 0,
                  fontFamily: 'var(--ax-font-display)',
                  fontWeight: 400,
                  fontSize: 'clamp(28px, 3vw, 34px)',
                  lineHeight: 1.2,
                  letterSpacing: '-0.02em',
                  color: 'var(--ax-ink)',
                }}
              >
                岗位能力画像与行为证据对照
              </h1>
              <Paragraph
                style={{
                  margin: '10px 0 0',
                  maxWidth: 760,
                  fontSize: 15.5,
                  lineHeight: 1.68,
                  color: 'var(--ax-ink-muted-80)',
                }}
              >
                连接校招或科研助理岗位画像与多模态实测证据，将岗位需求拆解为「可观测行为线索」与「主动封停硬技能缺口」，联动三阶段 AI 审辨实训。
              </Paragraph>
            </div>
            <Space wrap align="center" size={10}>
              <Button
                type="default"
                size="middle"
                icon={<ApiOutlined />}
                style={{
                  borderRadius: 8,
                  borderColor: 'var(--ax-border-strong)',
                  background: 'var(--ax-canvas)',
                  color: 'var(--ax-ink-muted-80)',
                }}
                onClick={() => { setRpcOpen(true); void runRpcDemo('tools/list'); }}
              >
                开发者接口验证
              </Button>
              <Button
                type="primary"
                icon={<ArrowRightOutlined />}
                style={{
                  background: '#a34f33',
                  borderColor: '#a34f33',
                  color: '#ffffff',
                  borderRadius: 8,
                  height: 40,
                  paddingInline: 18,
                  fontWeight: 500,
                }}
                onClick={() => void launchMetacognitionTraining()}
              >
                进入三阶段 AI 审辨实训
              </Button>
            </Space>
          </div>

          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 22, borderRadius: 10 }}
            message="严格遵循非筛选原则：岗位对照仅揭示已有行为证据覆盖与待补录缺口，不出具契合度分数、评级划档或筛选建议。"
          />

        <Row gutter={[20, 20]}>
          <Col xs={24} lg={11}>
            <Card className="ax-card" title="步骤 1 · 选择内置岗位或拆解自定义 JD">
              <Tabs
                defaultActiveKey="catalog"
                items={[
                  {
                    key: 'catalog',
                    label: `内置岗位库（${positions.length} 个）`,
                    children: (
                      <Space direction="vertical" size={12} style={{ width: '100%' }}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          <Input
                            aria-label="搜索岗位关键词"
                            placeholder="关键词：算法 / 科研 / 大模型…"
                            prefix={<SearchOutlined />}
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
                            onPressEnter={() => void fetchPositions(keyword, trackFilter, levelFilter)}
                            style={{ flex: '1 1 130px', minWidth: 130 }}
                          />
                          <Select
                            aria-label="筛选岗位赛道"
                            value={trackFilter}
                            onChange={(v) => { setTrackFilter(v); void fetchPositions(keyword, v, levelFilter); }}
                            style={{ width: 108 }}
                            options={[{ label: '全部赛道', value: '全部' }, ...tracks.map((t) => ({ label: t, value: t }))]}
                          />
                          <Select
                            aria-label="筛选岗位层级"
                            value={levelFilter}
                            onChange={(v) => { setLevelFilter(v); void fetchPositions(keyword, trackFilter, v); }}
                            style={{ width: 96 }}
                            options={[{ label: '全部层级', value: '全部' }, ...levels.map((l) => ({ label: l, value: l }))]}
                          />
                          <Button loading={loadingPos} onClick={() => void fetchPositions(keyword, trackFilter, levelFilter)}>
                            检索
                          </Button>
                        </div>

                        <div style={{ maxHeight: 380, overflowY: 'auto', display: 'grid', gap: 10 }}>
                          {positions.map((p) => {
                            const active = selectedPosition?.position_id === p.position_id && !jdDecomposed;
                            return (
                              <button
                                key={p.position_id}
                                type="button"
                                onClick={() => {
                                  setJdDecomposed(null);
                                  setSelectedPosition(p);
                                  setPracticeTask(null);
                                }}
                                style={{
                                  textAlign: 'left',
                                  background: active ? '#efe9de' : 'var(--ax-canvas)',
                                  border: active ? '1px solid #a34f33' : '1px solid var(--ax-hairline)',
                                  borderRadius: 8,
                                  padding: '12px 14px',
                                  cursor: 'pointer',
                                  fontFamily: 'var(--ax-font-text)',
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                  <Text strong>{p.title}</Text>
                                  <Space size={4}>
                                    <Tag style={{ margin: 0 }}>{p.track}</Tag>
                                    <Tag style={{ margin: 0 }}>{p.level}</Tag>
                                  </Space>
                                </div>
                                <div style={{ fontSize: 12.5, color: 'var(--ax-text-secondary)', marginTop: 4 }}>
                                  {p.jd_summary}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </Space>
                    ),
                  },
                  {
                    key: 'custom',
                    label: '自定义 JD 拆解',
                    children: (
                      <Space direction="vertical" size={12} style={{ width: '100%' }}>
                        <Input.TextArea
                          aria-label="粘贴自定义岗位 JD"
                          rows={6}
                          value={jdText}
                          onChange={(e) => setJdText(e.target.value)}
                          placeholder="粘贴任意校招或科研岗位职责，例如：要求能审辨大模型幻觉与统计口径偏差，完成结构化方案汇报，具备 Python 与 SQL 工程实现能力……"
                        />
                        <Button
                          type="primary"
                          loading={decomposing}
                          style={{ background: '#a34f33', borderColor: '#a34f33', color: '#ffffff', borderRadius: 8 }}
                          onClick={() => void handleDecomposeJd()}
                        >
                          拆解可观测行为线索
                        </Button>
                      </Space>
                    ),
                  },
                ]}
              />
            </Card>
          </Col>

          <Col xs={24} lg={13}>
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <Card
                className="ax-card"
                title={
                  jdDecomposed
                    ? '自定义职位解析：可观测行为要点与暂不直接观测项'
                    : `岗位画像：${selectedPosition?.title || '请选择岗位'}`
                }
              >
                {(() => {
                  const comps = jdDecomposed?.observable_competencies || selectedPosition?.observable_competencies || [];
                  const blocked = jdDecomposed?.blocked_hard_skills || selectedPosition?.blocked_hard_skills || [];
                  return (
                    <Space direction="vertical" size={12} style={{ width: '100%' }}>
                      <div>
                        <Text strong style={{ fontSize: 13 }}>可观测行为证据要求（{comps.length} 项）</Text>
                        <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>
                          {comps.map((c) => (
                            <div
                              key={c.key}
                              style={{
                                padding: '10px 12px',
                                background: 'var(--ax-parchment)',
                                border: '1px solid var(--ax-hairline)',
                                borderRadius: 'var(--ax-rounded-sm)',
                              }}
                            >
                              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--ax-ink)' }}>{c.label}</span>
                                {c.theoretical_construct && (
                                  <Tag
                                    style={{
                                      margin: 0,
                                      fontSize: 11.5,
                                      color: 'var(--ax-b2)',
                                      background: 'var(--ax-b2-soft)',
                                      borderColor: 'var(--ax-b2-border)',
                                    }}
                                  >
                                    {c.theoretical_construct}
                                  </Tag>
                                )}
                              </div>
                              {c.critique_focus && (
                                <div style={{ fontSize: 12.5, color: 'var(--ax-text-secondary)', marginTop: 4 }}>
                                  审辨聚焦：{c.critique_focus}
                                </div>
                              )}
                              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 6 }}>
                                <span style={{ fontSize: 12, color: 'var(--ax-text-secondary)' }}>关联观测量：</span>
                                {c.required_indicators.map((ind) => (
                                  <Tag
                                    key={ind}
                                    style={{
                                      margin: 0,
                                      fontSize: 12,
                                      color: 'var(--ax-info)',
                                      background: 'var(--ax-info-soft)',
                                      borderColor: 'var(--ax-info-border)',
                                    }}
                                  >
                                    {labelOfIndicator(ind)}
                                  </Tag>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <Text strong style={{ fontSize: 13 }}>需另行线下核验的硬技能（不通过单场行为观测评定）</Text>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                          {blocked.map((b) => (
                            <Tag key={b} color="warning" style={{ whiteSpace: 'normal' }}>
                              需另行核验：{b}
                            </Tag>
                          ))}
                        </div>
                      </div>
                    </Space>
                  );
                })()}
              </Card>

              <Card className="ax-card" title="步骤 2 · 将真实采录场次证据对齐至该岗位">
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Select
                      aria-label="选择或搜索采录场次编号"
                      showSearch
                      allowClear
                      optionFilterProp="label"
                      placeholder="选择已有采录场次（支持搜索编号或姓名）"
                      value={sessionId || undefined}
                      onChange={(val) => setSessionId(val || '')}
                      options={sessionOptions}
                      style={{ minWidth: 300, flex: '1 1 300px' }}
                    />
                    <Button
                      type="primary"
                      loading={aligning}
                      style={{ background: '#a34f33', borderColor: '#a34f33', color: '#ffffff', borderRadius: 8 }}
                      onClick={() => void handleAlignEvidence()}
                    >
                      执行证据缺口对照
                    </Button>
                  </div>

                  {alignment && (
                    <Space direction="vertical" size={12} style={{ width: '100%', marginTop: 6 }}>
                      <Alert
                        type="success"
                        showIcon
                        message={`${alignment.position_title} · 采录场次 ${alignment.session_id}`}
                        description={
                          <div>
                            <div>{alignment.non_scoring_statement}</div>
                            {(alignment.theory_framework || alignment.theoretical_construct) && (
                              <div style={{ marginTop: 4, fontSize: 12.5 }}>
                                理论框架：{alignment.theory_framework || alignment.theoretical_construct}
                              </div>
                            )}
                          </div>
                        }
                      />
                      <Space wrap size={8}>
                        <Tag style={{ color: 'var(--ax-success)', background: 'var(--ax-success-soft)', borderColor: 'var(--ax-success-border)' }}>
                          充分覆盖：{alignment.summary_counts.covered_strong} / {alignment.summary_counts.competencies_total}
                        </Tag>
                        <Tag>部分覆盖：{alignment.summary_counts.covered_partial}</Tag>
                        <Tag color="warning">待补录缺口：{alignment.summary_counts.missing_gap}</Tag>
                        <Tag>综合核验阶段：{alignment.referee_stage_summary.stage_label}</Tag>
                      </Space>
                      <Table
                        size="small"
                        rowKey="key"
                        columns={alignColumns}
                        dataSource={alignment.competency_alignments}
                        pagination={false}
                        scroll={{ x: 640 }}
                      />
                      <Button
                        type="primary"
                        icon={<ArrowRightOutlined />}
                        style={{
                          background: '#a34f33',
                          borderColor: '#a34f33',
                          color: '#ffffff',
                          borderRadius: 8,
                          height: 40,
                          paddingInline: 18,
                          fontWeight: 500,
                        }}
                        onClick={() => void launchMetacognitionTraining()}
                      >
                        携带推荐审辨题目进入实训采录 ›
                      </Button>
                    </Space>
                  )}
                </Space>
              </Card>
            </Space>
          </Col>
        </Row>

        <Drawer
          title={<Space><ToolOutlined />开发者接口验证面板</Space>}
          open={rpcOpen}
          onClose={() => setRpcOpen(false)}
          width={620}
        >
          <Space direction="vertical" size={14} style={{ width: '100%' }}>
            <Paragraph type="secondary" style={{ margin: 0, fontSize: 13 }}>
              供开发者调试外部协议接口（Model Context Protocol）的四个确定性工具调用与返回结构。
            </Paragraph>
            <Space wrap>
              <Button size="small" loading={rpcLoading} onClick={() => void runRpcDemo('initialize')}>
                initialize
              </Button>
              <Button size="small" loading={rpcLoading} onClick={() => void runRpcDemo('tools/list')}>
                tools/list
              </Button>
              <Button
                size="small"
                loading={rpcLoading}
                onClick={() =>
                  void runRpcDemo('tools/call', {
                    name: 'search_career_positions',
                    arguments: { keyword: '算法' },
                  })
                }
              >
                call · search_career_positions
              </Button>
              <Button
                size="small"
                loading={rpcLoading}
                onClick={() =>
                  void runRpcDemo('tools/call', {
                    name: 'generate_ai_critique_task',
                    arguments: { position_id: selectedPosition?.position_id || 'algo_llm_eval_01' },
                  })
                }
              >
                call · generate_ai_critique_task
              </Button>
            </Space>

            <div>
              <Text strong style={{ fontSize: 12.5 }}>请求消息体</Text>
              <pre
                style={{
                  marginTop: 6,
                  padding: '14px 16px',
                  background: '#181715',
                  color: '#faf9f5',
                  border: '1px solid #2d2a26',
                  borderRadius: 8,
                  fontFamily: 'var(--ax-font-mono)',
                  fontSize: 12.5,
                  lineHeight: 1.6,
                  overflowX: 'auto',
                }}
              >
                {rpcRequestText || '// 点击上方按钮测试接口请求'}
              </pre>
            </div>

            <div>
              <Text strong style={{ fontSize: 12.5 }}>返回响应体</Text>
              <pre
                style={{
                  marginTop: 6,
                  padding: '14px 16px',
                  background: 'var(--ax-parchment)',
                  color: 'var(--ax-ink)',
                  border: '1px solid var(--ax-hairline)',
                  borderRadius: 8,
                  fontFamily: 'var(--ax-font-mono)',
                  fontSize: 12.5,
                  lineHeight: 1.6,
                  maxHeight: 360,
                  overflow: 'auto',
                }}
              >
                {rpcResponseText || '// 等待服务端响应'}
              </pre>
            </div>
          </Space>
        </Drawer>
        </div>
      </Content>
    </div>
  );
};

export default CareerMcpPage;
