import React, { useEffect, useState } from 'react';
import {
  Layout, Card, Tabs, Input, Button, Space, Typography, Tag, message, Alert,
  Popconfirm, Upload, Spin, Divider
} from 'antd';
import {
  PlusOutlined, SaveOutlined, UploadOutlined, DeleteOutlined, CheckCircleOutlined,
  CopyOutlined, ReloadOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { API_BASE_URL } from '@/utils/constants';

const { Content } = Layout;
const { Text, Title, Paragraph } = Typography;

/**
 * 题库管理 —— 每个模块可以存**多套**题库，选一套"当前生效"。
 *
 * 2026-10-26 使用者原话：「题库为什么是按题目修改？这样不就只能用一份题库了吗」。
 * 所以这里不是"改一份题库"，是"管理多套、切换当前"。存储与接口见 `question_bank.py`：
 *   GET    /api/question-bank/<module>                 全部题库 + 当前生效的那套
 *   POST   /api/question-bank/<module>/banks           新建一套
 *   PUT    /api/question-bank/<module>/banks/<id>      改某一套
 *   DELETE /api/question-bank/<module>/banks/<id>      删某一套
 *   POST   /api/question-bank/<module>/active          {id} 设为当前；null = 内置默认
 *
 * 语音服务在**每开新一场**时读"当前生效"的那套 ⟹ 切换后下一场生效，不用重启。
 */

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

const MODULE_TABS = [
  { key: 'interview', label: '面试题库' },
  { key: 'research', label: '科研题库' }
];

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
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const apply = (d: BankData, prefer?: Selection) => {
    setData(d);
    const sel: Selection = prefer ?? (d.active_id ?? 'default');
    setSelected(sel);
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
    axios.get(`${API_BASE_URL}/api/question-bank/${m}`)
      .then((r) => apply(r.data as BankData))
      .catch((e) => message.error(e?.response?.data?.error || e?.message || '读取题库失败'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(module); }, [module]);

  const select = (id: Selection) => {
    if (!data) return;
    setSelected(id);
    if (id === 'default') {
      setDraft({ name: '内置默认题库', questions: data.defaults.map((q) => ({ ...q })) });
    } else if (id === 'new') {
      setDraft({ name: '', questions: [{ question: '', reference_answer: '' }] });
    } else {
      const b = data.banks.find((x) => x.id === id);
      setDraft(b ? { name: b.name, questions: b.questions.map((q) => ({ ...q })) }
        : { name: '', questions: [] });
    }
  };

  const setRows = (fn: (prev: QItem[]) => QItem[]) => {
    setDraft((prev) => ({ ...prev, questions: fn(prev.questions) }));
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
        const r = await axios.post(`${API_BASE_URL}/api/question-bank/${module}/banks`,
          { name: draft.name, questions });
        const created = r.data as BankData;
        const newId = created.banks[created.banks.length - 1]?.id;
        apply(created, newId);
        message.success(`已新建「${draft.name || '题库'}」—— 点「设为当前」让下一场用它`);
      } else if (selected !== 'default') {
        const r = await axios.put(`${API_BASE_URL}/api/question-bank/${module}/banks/${selected}`,
          { name: draft.name, questions });
        apply(r.data as BankData, selected);
        message.success('已保存');
      }
    } catch (e: any) {
      message.error(e?.response?.data?.error || e?.message || '保存失败', 0);
    } finally {
      setSaving(false);
    }
  };

  const makeActive = async (id: string | null) => {
    try {
      const r = await axios.post(`${API_BASE_URL}/api/question-bank/${module}/active`, { id });
      apply(r.data as BankData, id ?? 'default');
      message.success(id ? '已设为当前 —— 下一场评估生效' : '已切回内置默认题库');
    } catch (e: any) {
      message.error(e?.response?.data?.error || e?.message || '切换失败');
    }
  };

  const remove = async (id: string) => {
    try {
      const r = await axios.delete(`${API_BASE_URL}/api/question-bank/${module}/banks/${id}`);
      apply(r.data as BankData);
      message.success('已删除这套题库');
    } catch (e: any) {
      message.error(e?.response?.data?.error || e?.message || '删除失败');
    }
  };

  const onFile = async (file: File) => {
    try {
      const items = await parseBankFile(file, module);
      if (!items.length) throw new Error('文件里没有解析到题目');
      const name = file.name.replace(/\.(json|csv)$/i, '');
      const r = await axios.post(`${API_BASE_URL}/api/question-bank/${module}/banks`,
        { name, questions: items });
      const created = r.data as BankData;
      const newId = created.banks[created.banks.length - 1]?.id;
      apply(created, newId);
      message.success(`已导入「${name}」（${items.length} 题）—— 点「设为当前」让下一场用它`);
    } catch (e: any) {
      message.error(e?.response?.data?.error || e?.message || '导入失败', 0);
    }
    return false;
  };

  const isActive = (id: string | null) => (data?.active_id ?? null) === id;
  const editingNew = selected === 'new';
  const editingDefault = selected === 'default';
  const selectedBank = !editingNew && !editingDefault && data
    ? data.banks.find((b) => b.id === selected) : null;
  const activeName = data?.active_id
    ? (data.banks.find((b) => b.id === data.active_id)?.name ?? '自定义题库')
    : '内置默认题库';

  return (
    <Content style={{ padding: '24px' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ marginBottom: 18 }}>
          <Title level={1} style={{ margin: 0, fontSize: 'var(--ax-display-md-size)' }}>
            题库
          </Title>
          <Paragraph type="secondary" style={{ margin: '6px 0 0' }}>
            两个模块各自可以存<strong>多套</strong>题库；选一套设为「当前」，下一场评估就用它。
            参考答案可选，目前只存不用。
          </Paragraph>
        </div>

        <Space size={12} style={{ marginBottom: 14, flexWrap: 'wrap' }}>
          <Text type="secondary">示例题库（含参考答案）：</Text>
          <a href={`${API_BASE_URL}/api/question-bank/sample/interview`}>面试题库（8 题）</a>
          <a href={`${API_BASE_URL}/api/question-bank/sample/research`}>科研题库（8 题）</a>
        </Space>

        <Card>
          <Tabs
            activeKey={module}
            onChange={(k) => setModule(k as Module)}
            items={MODULE_TABS}
            tabBarExtraContent={(
              <Space wrap>
                <Upload
                  accept=".json,.csv"
                  showUploadList={false}
                  beforeUpload={(file) => { void onFile(file as File); return false; }}
                >
                  <Button icon={<UploadOutlined />}>导入题库文件</Button>
                </Upload>
                <Button icon={<PlusOutlined />} onClick={() => select('new')}>新建空白题库</Button>
              </Space>
            )}
          />

          {loading && <Spin tip="读取题库…"><div style={{ height: 120 }} /></Spin>}

          {!loading && data && (
            <>
              <Alert
                type={data.active_id ? 'success' : 'info'}
                showIcon
                style={{ marginBottom: 14 }}
                message={<>当前生效：<strong>{activeName}</strong>（共 {data.active.questions.length} 题）</>}
                description="下一场面试/科研评估会用它。已录完的场次不受影响。"
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
                  {isActive(null) && <Tag color="gold" style={{ marginLeft: 8 }}>当前</Tag>}
                </Button>
                {data.banks.map((b) => (
                  <Button
                    key={b.id}
                    type={selected === b.id ? 'primary' : 'default'}
                    onClick={() => select(b.id)}
                  >
                    {b.name}（{b.questions.length} 题）
                    {isActive(b.id) && <Tag color="gold" style={{ marginLeft: 8 }}>当前</Tag>}
                  </Button>
                ))}
                {data.banks.length === 0 && (
                  <Text type="secondary">还没有自定义题库 —— 点右上角「导入题库文件」或「新建空白题库」。</Text>
                )}
              </Space>

              <Card
                size="small"
                title={
                  editingNew ? '新建题库'
                    : editingDefault ? '内置默认题库（只读）'
                      : `编辑：${selectedBank?.name ?? draft.name}`
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
                        description="只删这一套题库，不影响其它套，也不影响已录完的场次。"
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
                    value={draft.name}
                    placeholder="题库名（例如：2026 秋招面试题）"
                    maxLength={80}
                    style={{ marginBottom: 12 }}
                    onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
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
                        value={q.question}
                        readOnly={editingDefault}
                        autoSize={{ minRows: 1, maxRows: 4 }}
                        placeholder="题干（必填）"
                        onChange={(e) => setRows((prev) =>
                          prev.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)))}
                      />
                      <Input.TextArea
                        value={q.reference_answer}
                        readOnly={editingDefault}
                        autoSize={{ minRows: 1, maxRows: 5 }}
                        placeholder="参考答案（可选；目前只存不用）"
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
    </Content>
  );
};

export default QuestionBankPage;
