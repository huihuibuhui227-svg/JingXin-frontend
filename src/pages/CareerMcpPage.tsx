import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Button, Card, Col, Drawer, Input, Layout, Row, Select, Space, Table, Tabs, Tag, Typography, message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ApiOutlined, ArrowRightOutlined, SearchOutlined, ToolOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import {
  careerMcpApi,
  CareerPosition,
  CritiqueTaskResponse,
  dashboardApi,
  EvidenceAlignmentResponse,
  JdDecomposeResponse,
} from '@/services/api';

const { Content } = Layout;
const { Title, Paragraph, Text } = Typography;

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
      message.error(err?.response?.data?.message || err?.message || '读取岗位 MCP 目录失败');
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
      message.error(err?.response?.data?.message || err?.message || 'JD 拆解失败');
    } finally {
      setDecomposing(false);
    }
  };

  const handleAlignEvidence = async () => {
    const sid = sessionId.trim();
    if (!sid) {
      message.warning('请先选择或输入一个会话 session_id');
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
      message.error(err?.response?.data?.message || err?.message || '会话证据对照失败');
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
          <Text strong>{lbl}</Text>
          <div style={{ fontSize: 12, color: 'var(--ax-text-secondary)', marginTop: 2 }}>{r.critique_focus}</div>
        </div>
      ),
    },
    {
      title: '证据覆盖判定',
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
              <Text strong>{e.label.replace(/\*\*/g, '')}</Text>：
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
    <Content className="ax-workbench" style={{ padding: '24px' }}>
      <div style={{ maxWidth: 'var(--ax-content-max)', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14, marginBottom: 18 }}>
          <div>
            <Tag style={{ marginBottom: 8, color: 'var(--ax-primary)', background: 'var(--ax-info-soft)', borderColor: 'var(--ax-info-border)', fontWeight: 600 }}>
              基地二 · AI 元能力与求职实训中心（30% 拓展）
            </Tag>
            <Title level={1} style={{ margin: 0, fontSize: 28 }}>
              岗位搜索 · JD 拆解 · 标准 Career MCP 证据对照台
            </Title>
            <Paragraph type="secondary" style={{ margin: '6px 0 0', maxWidth: 800 }}>
              通过标准 JSON-RPC 2.0 MCP 服务连接校招/科研助理岗位画像与多模态实测内核，将岗位需求拆解为「可观测行为线索」与「主动封停硬技能缺口」，联动三阶段 AI 审辨实训。
            </Paragraph>
          </div>
          <Space wrap>
            <Button icon={<ApiOutlined />} onClick={() => { setRpcOpen(true); void runRpcDemo('tools/list'); }}>
              MCP 协议调试台
            </Button>
            <Button
              type="primary"
              className="ax-btn--pill"
              icon={<ArrowRightOutlined />}
              onClick={() => void launchMetacognitionTraining()}
            >
              进入三阶段 AI 审辨实训
            </Button>
          </Space>
        </div>

        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 20 }}
          message="严格遵循白盒非筛选规则：岗位对照仅揭示已有行为证据覆盖与待补录缺口，不出具契合度分数或筛选建议。"
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
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <Input
                            aria-label="搜索岗位关键词"
                            placeholder="关键词：算法 / 科研 / 大模型 / 数据…"
                            prefix={<SearchOutlined />}
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
                            onPressEnter={() => void fetchPositions(keyword, trackFilter, levelFilter)}
                            style={{ flex: '1 1 180px' }}
                          />
                          <Select
                            aria-label="筛选岗位赛道"
                            value={trackFilter}
                            onChange={(v) => { setTrackFilter(v); void fetchPositions(keyword, v, levelFilter); }}
                            style={{ width: 130 }}
                            options={[{ label: '全部赛道', value: '全部' }, ...tracks.map((t) => ({ label: t, value: t }))]}
                          />
                          <Select
                            aria-label="筛选岗位层级"
                            value={levelFilter}
                            onChange={(v) => { setLevelFilter(v); void fetchPositions(keyword, trackFilter, v); }}
                            style={{ width: 120 }}
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
                                  background: active ? 'var(--ax-info-soft)' : 'var(--ax-parchment)',
                                  border: active ? '1px solid var(--ax-info-border)' : '1px solid var(--ax-hairline)',
                                  borderRadius: 'var(--ax-rounded-md)',
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
                        <Button type="primary" loading={decomposing} onClick={() => void handleDecomposeJd()}>
                          调用 MCP 拆解可观测行为线索
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
                    ? '自定义 JD 拆解结果：可观测要求与主动封停硬技能'
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
                        <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                          {comps.map((c) => (
                            <div
                              key={c.key}
                              style={{
                                padding: '8px 12px',
                                background: 'var(--ax-parchment)',
                                border: '1px solid var(--ax-hairline)',
                                borderRadius: 'var(--ax-rounded-sm)',
                              }}
                            >
                              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{c.label}</div>
                              {c.critique_focus && (
                                <div style={{ fontSize: 12.5, color: 'var(--ax-text-secondary)', marginTop: 2 }}>
                                  审辨聚焦：{c.critique_focus}
                                </div>
                              )}
                              <div style={{ fontSize: 12, color: 'var(--ax-info)', marginTop: 4 }}>
                                关联指标：<code>{c.required_indicators.join(' · ')}</code>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <Text strong style={{ fontSize: 13 }}>主动封停项（单场采录不可直接观测的硬技能）</Text>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                          {blocked.map((b) => (
                            <Tag key={b} color="warning" style={{ whiteSpace: 'normal' }}>
                              主动封停：{b}
                            </Tag>
                          ))}
                        </div>
                      </div>
                    </Space>
                  );
                })()}
              </Card>

              <Card className="ax-card" title="步骤 2 · 将真实采录会话证据对齐至该岗位">
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Select
                      aria-label="选择已采录会话编号"
                      showSearch
                      allowClear
                      placeholder="选择已有会话，或在右侧输入"
                      value={sessionOptions.some((o) => o.value === sessionId) ? sessionId : undefined}
                      onChange={(val) => setSessionId(val || '')}
                      options={sessionOptions}
                      style={{ minWidth: 260, flex: '1 1 240px' }}
                    />
                    <Input
                      aria-label="手工输入 session_id"
                      value={sessionId}
                      onChange={(e) => setSessionId(e.target.value)}
                      placeholder="例如 20260927_212143_95a8"
                      style={{ maxWidth: 220 }}
                    />
                    <Button type="primary" loading={aligning} onClick={() => void handleAlignEvidence()}>
                      执行证据缺口对照
                    </Button>
                  </div>

                  {alignment && (
                    <Space direction="vertical" size={12} style={{ width: '100%', marginTop: 6 }}>
                      <Alert
                        type="success"
                        showIcon
                        message={`${alignment.position_title} · 会话 ${alignment.session_id}`}
                        description={alignment.non_scoring_statement}
                      />
                      <Space wrap size={8}>
                        <Tag style={{ color: 'var(--ax-success)', background: 'var(--ax-success-soft)', borderColor: 'var(--ax-success-border)' }}>
                          充分覆盖：{alignment.summary_counts.covered_strong} / {alignment.summary_counts.competencies_total}
                        </Tag>
                        <Tag>部分覆盖：{alignment.summary_counts.covered_partial}</Tag>
                        <Tag color="warning">待补录缺口：{alignment.summary_counts.missing_gap}</Tag>
                        <Tag>第三层裁判：{alignment.referee_stage_summary.stage_label}</Tag>
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
                        className="ax-btn--pill"
                        icon={<ArrowRightOutlined />}
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
          title={<Space><ToolOutlined />标准 MCP JSON-RPC 2.0 协议调用面板</Space>}
          open={rpcOpen}
          onClose={() => setRpcOpen(false)}
          width={620}
        >
          <Space direction="vertical" size={14} style={{ width: '100%' }}>
            <Paragraph type="secondary" style={{ margin: 0, fontSize: 13 }}>
              后端在 <code>POST /api/mcp/career</code> 及 stdio 模式暴露符合 Model Context Protocol 规范的 4 个确定性工具，支持任意合规客户端直接挂载。
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
              <Text strong style={{ fontSize: 12.5 }}>JSON-RPC Request</Text>
              <pre
                style={{
                  marginTop: 4,
                  padding: 12,
                  background: '#1d1d1f',
                  color: '#f5f5f7',
                  borderRadius: 8,
                  fontSize: 12,
                  overflowX: 'auto',
                }}
              >
                {rpcRequestText || '// 点击上方命令发送实时协议请求'}
              </pre>
            </div>

            <div>
              <Text strong style={{ fontSize: 12.5 }}>JSON-RPC Response</Text>
              <pre
                style={{
                  marginTop: 4,
                  padding: 12,
                  background: 'var(--ax-parchment)',
                  border: '1px solid var(--ax-hairline)',
                  borderRadius: 8,
                  fontSize: 12,
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
  );
};

export default CareerMcpPage;
