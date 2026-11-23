import React, { useEffect, useRef, useState } from 'react';
import {
  Layout, Card, Input, Button, Space, Typography, Tag, message, Alert,
  Popconfirm, Divider, Modal, Segmented
} from 'antd';
import {
  PlusOutlined, SaveOutlined, UploadOutlined, DeleteOutlined, CheckCircleOutlined,
  CopyOutlined, ReloadOutlined, LockOutlined, UnlockOutlined, SearchOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { API_BASE_URL } from '@/utils/constants';
import { dashboardApi, QuestionSearchResponse } from '@/services/api';
import { getAdminToken, recordingsApi } from '@/services/recordingsApi';
import Loading from '@/components/common/Loading';

const { Content } = Layout;
const { Text, Title, Paragraph } = Typography;

type Module = 'interview' | 'research';

interface QItem { question: string; reference_answer: string }
interface BankInfo { id: string; name: string; updated_at: string | null; questions: QItem[] }
interface BankData {
  module: string;
  module_label: string;
  active_id: string | null;
  source: 'custom' | 'default';
  banks: BankInfo[];
  active: { id: string | null; name: string; updated_at: string | null; questions: QItem[] };
  defaults: QItem[];
}

type Selection = string | 'default' | 'new';

const authHeaders = (): Record<string, string> => {
  const token = getAdminToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else { quoted = false; }
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
};

const normItem = (raw: any): QItem => {
  if (typeof raw === 'string') return { question: raw.trim(), reference_answer: '' };
  return {
    question: String(raw?.question ?? raw?.题目 ?? raw?.题干 ?? '').trim(),
    reference_answer: String(raw?.reference_answer ?? raw?.参考答案 ?? raw?.reference ?? '').trim()
  };
};

const parseBankFile = async (file: File, module: Module): Promise<QItem[]> => {
  const text = await file.text();
  if (/\.json$/i.test(file.name)) {
    const j = JSON.parse(text);
    let arr: any[] = [];
    if (Array.isArray(j)) arr = j;
    else if (Array.isArray(j?.questions)) arr = j.questions;
    else if (Array.isArray(j?.[module]?.questions)) arr = j[module].questions;
    else throw new Error('JSON 里没找到题目数组（支持数组 / {questions:[]}）');
    return arr.map(normItem).filter((q) => q.question);
  }
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const head = rows[0].map((c) => c.trim().toLowerCase());
  const hasHeader = head.some((c) =>
    ['question', 'reference_answer', '题目', '题干', '参考答案'].includes(c));
  return (hasHeader ? rows.slice(1) : rows)
    .map((r) => ({
      question: String(r[0] ?? '').trim(),
      reference_answer: String(r[1] ?? '').trim()
    }))
    .filter((q) => q.question);
};

const QuestionBankPage: React.FC = () => {
  const [module, setModule] = useState<Module>('interview');
  const [data, setData] = useState<BankData | null>(null);
  const [selected, setSelected] = useState<Selection>('default');
  const [draft, setDraft] = useState<{ name: string; questions: QItem[] }>({ name: '', questions: [] });
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [isAdmin, setIsAdmin] = useState(!!getAdminToken());
  const [loginOpen, setLoginOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<QuestionSearchResponse | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const apply = (d: BankData, prefer?: Selection) => {
    setData(d);
    const sel: Selection = prefer ?? (d.active_id ?? 'default');
    setSelected(sel);
    setDirty(false);
    if (sel === 'default') {
      setDraft({ name: '内置默认题库', questions: d.defaults.map((q) => ({ ...q })) });
    } else if (sel !== 'new') {
      const b = d.banks.find((x) => x.id === sel);
      setDraft(b ? { name: b.name, questions: b.questions.map((q) => ({ ...q })) }
        : { name: '', questions: [] });
    }
  };

  const load = (m: Module) => {
    setLoading(true);
    setSearchResult(null);
    axios.get(`${API_BASE_URL}/api/question-bank/${m}`, { headers: authHeaders() })
      .then((r) => apply(r.data as BankData))
      .catch((e) => message.error(e?.response?.data?.error || e?.message || '读取题库失败'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(module); }, [module]);

  const guardUnsaved = (proceed: () => void) => {
    if (!dirty || selected === 'default') {
      proceed();
      return;
    }
    Modal.confirm({
      title: '当前题库有未保存的修改',
      content: '切换后未保存的编辑内容会丢失，确定要离开吗？',
      okText: '放弃修改并切换',
      cancelText: '留在这里',
      okButtonProps: { danger: true },
      onOk: () => {
        setDirty(false);
        proceed();
      },
    });
  };

  const handleModuleChange = (next: Module) => {
    if (next === module) return;
    guardUnsaved(() => setModule(next));
  };

  const select = (id: Selection) => {
    if (!data) return;
    guardUnsaved(() => {
      setSelected(id);
      setDirty(false);
      if (id === 'default') {
        setDraft({ name: '内置默认题库', questions: data.defaults.map((q) => ({ ...q })) });
      } else if (id === 'new') {
        setDraft({ name: '', questions: [{ question: '', reference_answer: '' }] });
      } else {
        const b = data.banks.find((x) => x.id === id);
        setDraft(b ? { name: b.name, questions: b.questions.map((q) => ({ ...q })) }
          : { name: '', questions: [] });
      }
    });
  };

  const setRows = (fn: (prev: QItem[]) => QItem[]) => {
    setDirty(true);
    setDraft((prev) => ({ ...prev, questions: fn(prev.questions) }));
  };

  const handleAuthError = (e: any, fallbackMsg: string): boolean => {
    const status = e?.response?.status;
    if (status === 401) {
      setIsAdmin(false);
      setLoginError('编辑、导入、删除或切换生效题库需要管理员权限，请先验证管理员密码。');
      setLoginOpen(true);
      return true;
    }
    if (status === 503) {
      message.error(e?.response?.data?.error || '服务端尚未配置管理员密码');
      return true;
    }
    message.error(e?.response?.data?.error || e?.message || fallbackMsg);
    return false;
  };

  const doLogin = async () => {
    setLoggingIn(true);
    setLoginError(null);
    try {
      await recordingsApi.login(password);
      setIsAdmin(true);
      setLoginOpen(false);
      setPassword('');
      message.success('管理员验证通过，现在可编辑并切换题库');
    } catch (e: any) {
      const status = e?.response?.status;
      const detail = e?.response?.data?.error;
      setLoginError(
        status === 503 ? `服务端还没配管理员密码：${detail}`
          : status === 401 ? '密码不对'
            : detail || e?.message || '登录失败'
      );
    } finally {
      setLoggingIn(false);
    }
  };

  const doLogout = () => {
    recordingsApi.logout();
    setIsAdmin(false);
    message.info('已退出管理员编辑态');
  };

  const clean = () => draft.questions
    .map((q) => ({ question: q.question.trim(), reference_answer: (q.reference_answer || '').trim() }))
    .filter((q) => q.question);

  const save = async () => {
    const questions = clean();
    if (!questions.length) { message.error('至少要有一道题'); return; }
    setSaving(true);
    try {
      if (selected === 'new') {
        const r = await axios.post(
          `${API_BASE_URL}/api/question-bank/${module}/banks`,
          { name: draft.name, questions },
          { headers: authHeaders() }
        );
        const created = r.data as BankData;
        const newId = created.banks[created.banks.length - 1]?.id;
        apply(created, newId);
        message.success(`已新建「${draft.name || '题库'}」—— 点「设为当前」让下一场使用它`);
      } else if (selected !== 'default') {
        const r = await axios.put(
          `${API_BASE_URL}/api/question-bank/${module}/banks/${selected}`,
          { name: draft.name, questions },
          { headers: authHeaders() }
        );
        apply(r.data as BankData, selected);
        message.success('已保存');
      }
    } catch (e: any) {
      handleAuthError(e, '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const makeActive = async (id: string | null) => {
    try {
      const r = await axios.post(
        `${API_BASE_URL}/api/question-bank/${module}/active`,
        { id },
        { headers: authHeaders() }
      );
      apply(r.data as BankData, id ?? 'default');
      message.success(id ? '已设为当前生效 —— 下一场评估启用' : '已切回内置默认题库');
    } catch (e: any) {
      handleAuthError(e, '切换失败');
    }
  };

  const remove = async (id: string) => {
    try {
      const r = await axios.delete(
        `${API_BASE_URL}/api/question-bank/${module}/banks/${id}`,
        { headers: authHeaders() }
      );
      apply(r.data as BankData);
      message.success('已删除这套题库');
    } catch (e: any) {
      handleAuthError(e, '删除失败');
    }
  };

  const onFile = async (file: File) => {
    try {
      const items = await parseBankFile(file, module);
      if (!items.length) throw new Error('文件里没有解析到题目');
      const name = file.name.replace(/\.(json|csv)$/i, '');
      const r = await axios.post(
        `${API_BASE_URL}/api/question-bank/${module}/banks`,
        { name, questions: items },
        { headers: authHeaders() }
      );
      const created = r.data as BankData;
      const newId = created.banks[created.banks.length - 1]?.id;
      apply(created, newId);
      message.success(`已导入「${name}」（${items.length} 题）—— 点「设为当前」让下一场使用它`);
    } catch (e: any) {
      handleAuthError(e, '导入失败');
    }
  };

  const runSearch = async () => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResult(null);
      return;
    }
    setSearching(true);
    try {
      const res = await dashboardApi.searchQuestionBank({ module, query: q, top_k: 5, use_llm: false });
      setSearchResult(res);
    } catch (e: any) {
      message.error(e?.response?.data?.error || e?.message || '题库检索失败');
    } finally {
      setSearching(false);
    }
  };

  const isActive = (id: string | null) => (data?.active_id ?? null) === id;
  const editingNew = selected === 'new';
  const editingDefault = selected === 'default';
  const selectedBank = !editingNew && !editingDefault && data
    ? data.banks.find((b) => b.id === selected) : null;
  const activeName = data?.active_id
    ? (data.banks.find((b) => b.id === data.active_id)?.name ?? '自定义题库')
    : '内置默认题库';

  const activePillStyle = (isSelected: boolean): React.CSSProperties => ({
    marginLeft: 8,
    padding: '1px 6px',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
    background: isSelected ? '#FFFFFF' : 'var(--ax-success-soft)',
    color: isSelected ? '#1F453A' : 'var(--ax-success)',
  });

  return (
    <Content style={{ padding: '24px' }}>
      <div style={{ maxWidth: 1060, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
          <div style={{ flex: '1 1 560px' }}>
            <Title level={1} style={{ margin: 0, fontSize: 'var(--ax-display-md-size)' }}>
              题库管理
            </Title>
            <Paragraph type="secondary" style={{ margin: '6px 0 0' }}>
              面试与科研两个模块可各自管理<strong>多套</strong>题库；设为「当前生效」后，下一场采集即时启用。参考答案仅用于存档展示，不参与自动评分。
            </Paragraph>
          </div>
          {isAdmin ? (
            <Button icon={<UnlockOutlined />} onClick={doLogout}>退出管理员</Button>
          ) : (
            <Button type="primary" icon={<LockOutlined />} onClick={() => { setLoginError(null); setLoginOpen(true); }}>
              管理员解锁编辑
            </Button>
          )}
        </div>

        <Space size={12} style={{ marginBottom: 14, flexWrap: 'wrap' }}>
          <Text type="secondary">下载示例题库模板（JSON）：</Text>
          <a href={`${API_BASE_URL}/api/question-bank/sample/interview`}>面试题库模板（8 题）</a>
          <a href={`${API_BASE_URL}/api/question-bank/sample/research`}>科研题库模板（8 题）</a>
        </Space>

        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <Segmented
              aria-label="切换题库模块"
              value={module}
              onChange={(val) => handleModuleChange(val as Module)}
              options={[
                { label: '面试题库', value: 'interview' },
                { label: '科研题库', value: 'research' },
              ]}
            />
            <Space wrap>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.csv"
                aria-label="选择要导入的题库文件"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) void onFile(file);
                }}
              />
              <Button icon={<UploadOutlined />} onClick={() => fileInputRef.current?.click()}>
                导入题库文件
              </Button>
              <Button icon={<PlusOutlined />} onClick={() => select('new')}>
                新建空白题库
              </Button>
            </Space>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <Input
              aria-label="检索题库关键词或研究主题"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onPressEnter={() => void runSearch()}
              placeholder="输入关键词快速检索当前模块全部题库（例如：实验设计、复现、算法瓶颈…）"
              prefix={<SearchOutlined style={{ color: 'var(--ax-text-secondary)' }} />}
              allowClear
              style={{ flex: '1 1 280px' }}
            />
            <Button loading={searching} onClick={() => void runSearch()}>
              快速检索
            </Button>
          </div>

          {searchResult && (
            <div style={{
              marginBottom: 16, padding: '12px 14px', borderRadius: 8,
              background: 'var(--ax-canvas)', border: '1px solid var(--ax-hairline)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                <Text strong>
                  检索结果（命中 {searchResult.hits.length} / {searchResult.total_candidates} 题 · {searchResult.latency_ms} ms）
                </Text>
                <Button size="small" type="link" onClick={() => setSearchResult(null)}>收起结果</Button>
              </div>
              {searchResult.hits.length === 0 ? (
                <Text type="secondary">未命中相关题目，可尝试更换关键词。</Text>
              ) : (
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  {searchResult.hits.map((h) => (
                    <div
                      key={`${h.bank_id}-${h.index}`}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12,
                        padding: '8px 10px', borderRadius: 6, background: 'var(--ax-surface)',
                        border: '1px solid var(--ax-hairline)'
                      }}
                    >
                      <div>
                        <Space size={6} wrap style={{ marginBottom: 4 }}>
                          <Tag color={h.is_active ? 'green' : 'default'}>{h.bank_name}</Tag>
                          <Text type="secondary" style={{ fontSize: 12 }}>第 {h.index + 1} 题</Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>匹配度 {Math.round(h.similarity * 100)}%</Text>
                        </Space>
                        <div style={{ fontSize: 13 }}>{h.question}</div>
                      </div>
                      <Button
                        size="small"
                        onClick={() => select(h.bank_id === 'default' ? 'default' : h.bank_id)}
                      >
                        定位套题
                      </Button>
                    </div>
                  ))}
                </Space>
              )}
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ax-text-secondary)' }}>
                {searchResult.watermark}
              </div>
            </div>
          )}

          {loading && <Loading tip="正在读取题库…" />}

          {!loading && data && (
            <>
              <Alert
                type={data.active_id ? 'success' : 'info'}
                showIcon
                style={{ marginBottom: 14 }}
                message={<>当前生效：<strong>{activeName}</strong>（共 {data.active.questions.length} 题）</>}
                description="下一场面试/科研采集将自动加载该套题目，已完成的场次记录不受影响。"
              />

              <Divider orientation="left" style={{ margin: '6px 0 12px' }}>
                <Text type="secondary">题库列表</Text>
              </Divider>
              <Space wrap size={[10, 10]} style={{ marginBottom: 18 }}>
                <Button
                  type={selected === 'default' ? 'primary' : 'default'}
                  onClick={() => select('default')}
                >
                  内置默认题库（{data.defaults.length} 题）
                  {isActive(null) && <span style={activePillStyle(selected === 'default')}>当前生效</span>}
                </Button>
                {data.banks.map((b) => (
                  <Button
                    key={b.id}
                    type={selected === b.id ? 'primary' : 'default'}
                    onClick={() => select(b.id)}
                  >
                    {b.name}（{b.questions.length} 题）
                    {isActive(b.id) && <span style={activePillStyle(selected === b.id)}>当前生效</span>}
                  </Button>
                ))}
                {data.banks.length === 0 && (
                  <Text type="secondary">暂无自定义题库，可点击右上方「导入题库文件」或「新建空白题库」。</Text>
                )}
              </Space>

              <Card
                size="small"
                title={
                  editingNew ? '新建题库'
                    : editingDefault ? '内置默认题库（只读）'
                      : `编辑：${selectedBank?.name ?? draft.name}${dirty ? '（未保存）' : ''}`
                }
                extra={(
                  <Space wrap>
                    {!editingNew && !isActive(editingDefault ? null : (selected as string)) && (
                      <Button size="small" icon={<CheckCircleOutlined />}
                        onClick={() => makeActive(editingDefault ? null : (selected as string))}>
                        设为当前
                      </Button>
                    )}
                    {editingDefault && (
                      <Button size="small" icon={<CopyOutlined />}
                        onClick={() => {
                          setSelected('new');
                          setDirty(true);
                          setDraft({
                            name: '内置默认题库 副本',
                            questions: data.defaults.map((q) => ({ ...q }))
                          });
                        }}>
                        复制为新题库
                      </Button>
                    )}
                    {selectedBank && (
                      <Popconfirm
                        title={`删除「${selectedBank.name}」？`}
                        description="仅删除该自定义套题，不影响其它套题及已录完场次。"
                        okText="删除" cancelText="取消" okButtonProps={{ danger: true }}
                        onConfirm={() => remove(selectedBank.id)}
                      >
                        <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
                      </Popconfirm>
                    )}
                  </Space>
                )}
              >
                {!editingDefault && (
                  <Input
                    aria-label="题库名称"
                    value={draft.name}
                    placeholder="题库名称（例如：2027 挑战杯模拟答辩题库）"
                    maxLength={80}
                    style={{ marginBottom: 12 }}
                    onChange={(e) => {
                      setDirty(true);
                      setDraft((prev) => ({ ...prev, name: e.target.value }));
                    }}
                  />
                )}

                <Space direction="vertical" size={10} style={{ width: '100%' }}>
                  {(editingDefault ? data.defaults : draft.questions).map((q, i) => (
                    <Card
                      key={i}
                      size="small"
                      title={<Text strong>第 {i + 1} 题</Text>}
                      extra={!editingDefault && (
                        <Button
                          type="link" danger size="small" icon={<DeleteOutlined />}
                          onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                        >
                          删除
                        </Button>
                      )}
                    >
                      <Input.TextArea
                        aria-label={`第 ${i + 1} 题题干`}
                        value={q.question}
                        readOnly={editingDefault}
                        autoSize={{ minRows: 1, maxRows: 4 }}
                        placeholder="题干（必填）"
                        onChange={(e) => setRows((prev) =>
                          prev.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)))}
                      />
                      <Input.TextArea
                        aria-label={`第 ${i + 1} 题参考要点`}
                        value={q.reference_answer}
                        readOnly={editingDefault}
                        autoSize={{ minRows: 1, maxRows: 5 }}
                        placeholder="参考要点（可选；仅用于存档，不参与自动评分）"
                        style={{ marginTop: 8 }}
                        onChange={(e) => setRows((prev) =>
                          prev.map((x, j) => (j === i ? { ...x, reference_answer: e.target.value } : x)))}
                      />
                    </Card>
                  ))}
                </Space>

                {!editingDefault && (
                  <Space style={{ marginTop: 12 }} wrap>
                    <Button icon={<PlusOutlined />}
                      onClick={() => setRows((prev) => [...prev, { question: '', reference_answer: '' }])}>
                      添加一题
                    </Button>
                    <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={save}>
                      {editingNew ? '创建题库' : '保存这套题库'}
                    </Button>
                    {editingNew && (
                      <Button icon={<ReloadOutlined />} onClick={() => select(data.active_id ?? 'default')}>
                        取消
                      </Button>
                    )}
                  </Space>
                )}
              </Card>
            </>
          )}
        </Card>
      </div>

      <Modal
        title="管理员身份验证"
        open={loginOpen}
        onOk={doLogin}
        confirmLoading={loggingIn}
        okText="验证并解锁"
        cancelText="取消"
        onCancel={() => { setLoginOpen(false); setPassword(''); }}
      >
        <Input.Password
          aria-label="管理员密码"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onPressEnter={doLogin}
          placeholder="请输入管理员密码"
          autoFocus
        />
        {loginError && <Alert style={{ marginTop: 12 }} type="error" showIcon message={loginError} />}
      </Modal>
    </Content>
  );
};

export default QuestionBankPage;
