import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Layout, Card, Select, Button, Checkbox, Space, Typography, message,
  Alert, Spin, Tag, Divider, Empty
} from 'antd';
import {
  DownloadOutlined, LineChartOutlined, FileTextOutlined, ReloadOutlined
} from '@ant-design/icons';
import { API_BASE_URL } from '@/utils/constants';

const { Content } = Layout;
const { Text, Title, Paragraph } = Typography;

/**
 * 数据导出与图表 —— 把采集下来的**原始表**直接交给复核/分析的人。
 *
 * 报告层只印过了证据门的指标；换算法、自查、写论文都要原件。这一页提供：
 *   · 三份 CSV 原样下载（面部 / 手势 / 语音）
 *   · 语音转写导出（TXT 人读 / CSV 题干+回答 / JSON 原始）
 *   · 按模块画图（服务端 matplotlib 出 PNG，前端只负责挑模块）
 *
 * ⚠️ 图只画盘上真实存在的列；某一场没数据就显示服务端给的原因，不补零。
 */

interface ExportLog {
  key: string;
  label: string;
  file: string;
  exists: boolean;
  bytes: number;
  rows: number;
}

interface ExportSession {
  sid: string;
  name?: string | null;
  student_id?: string | null;
  department?: string | null;
  serial?: string | null;
  modified: number;
  has_video: boolean;
  video_bytes: number;
  frames: { face: number; gesture: number };
}

interface ExportFiles {
  session_id: string;
  dir_name: string;
  logs: ExportLog[];
  transcript: {
    exists: boolean;
    n_segments: number;
    n_chars: number | null;
    recorded_at: string | null;
    preview: string;
    bytes: number;
  };
  questions: number;
  charts: string[];
  subject?: { name?: string; student_id?: string; department?: string; serial?: string };
}

const MODULE_OPTIONS = [
  { value: 'face', label: '面部表情' },
  { value: 'gesture', label: '手势与体态' },
  { value: 'voice', label: '语音' }
];

const fmtBytes = (n: number): string => {
  if (!n) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
};

const api = (sid: string, path: string): string =>
  `${API_BASE_URL}/api/export/${encodeURIComponent(sid)}${path}`;

const DataExportPage: React.FC = () => {
  const [sessions, setSessions] = useState<ExportSession[]>([]);
  const [sid, setSid] = useState<string>('');
  const [files, setFiles] = useState<ExportFiles | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [modules, setModules] = useState<string[]>(['face', 'gesture', 'voice']);
  const [charts, setCharts] = useState<Record<string, { url?: string; error?: string; loading?: boolean }>>({});
  const urlsRef = useRef<string[]>([]);

  /** 释放上一批 blob URL，别让翻页/重画把内存攒住。 */
  const clearChartUrls = () => {
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    urlsRef.current = [];
  };

  useEffect(() => {
    // 会话列表**带个人信息**（姓名/学号/院系/场次）—— 只有一串 sid 的列表没法按人对号。
    fetch(`${API_BASE_URL}/api/export/sessions`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body?.error || `读取失败(${r.status})`);
        const list: ExportSession[] = (body.sessions || [])
          .sort((a: ExportSession, b: ExportSession) => b.modified - a.modified);
        setSessions(list);
        if (list.length) setSid(list[0].sid);
      })
      .catch((e) => message.error(e?.message || '读不到会话列表'))
      .finally(() => setLoadingSessions(false));
    return () => clearChartUrls();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!sid) return;
    setLoadingFiles(true);
    setFiles(null);
    fetch(api(sid, '/files'))
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body?.error || `读取失败(${r.status})`);
        setFiles(body as ExportFiles);
      })
      .catch((e) => message.error(e?.message || '读取这一场的数据失败'))
      .finally(() => setLoadingFiles(false));
  }, [sid]);

  const loadCharts = async () => {
    if (!sid) return;
    clearChartUrls();
    const next: Record<string, { url?: string; error?: string; loading?: boolean }> = {};
    modules.forEach((m) => { next[m] = { loading: true }; });
    setCharts(next);

    await Promise.all(modules.map(async (m) => {
      try {
        const r = await fetch(api(sid, `/chart?module=${m}&t=${Date.now()}`));
        if (!r.ok) {
          let msg = `生成失败(${r.status})`;
          try { const j = await r.json(); msg = j?.error || msg; } catch { /* 非 JSON */ }
          throw new Error(msg);
        }
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        urlsRef.current.push(url);
        setCharts((prev) => ({ ...prev, [m]: { url } }));
      } catch (e: any) {
        setCharts((prev) => ({ ...prev, [m]: { error: e?.message || '生成失败' } }));
      }
    }));
  };

  // 换会话 / 换模块后**自动重画**（演示时少点一次是点一次）
  useEffect(() => {
    if (files) void loadCharts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, modules.join(',')]);

  const sessionOptions = useMemo(() => sessions.map((s) => {
    // 有标注就用「姓名 · 场次」，没有才退回会话号 —— 一眼能认出是谁。
    const who = s.name ? [s.name, s.serial].filter(Boolean).join(' · ') : s.sid;
    return {
      value: s.sid,
      label: `${who} · ${new Date(s.modified * 1000).toLocaleString('zh-CN')}`
    };
  }), [sessions]);

  const current = sessions.find((s) => s.sid === sid);

  return (
    <Content style={{ padding: '24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ marginBottom: 20 }}>
          <Title level={1} style={{ margin: 0, fontSize: 'var(--ax-display-md-size)' }}>
            数据导出与图表
          </Title>
          <Paragraph type="secondary" style={{ margin: '6px 0 0' }}>
            采集时的原始表与语音转写都在这里 —— 报告只印过了证据门的指标，复核与换算法用这些原件。
          </Paragraph>
        </div>

        <Card size="small" style={{ marginBottom: 20 }}>
          <Space wrap size={16} align="center">
            <Text strong>会话</Text>
            <Select
              showSearch
              loading={loadingSessions}
              value={sid || undefined}
              onChange={setSid}
              options={sessionOptions}
              optionFilterProp="label"
              style={{ width: 460 }}
              placeholder="选一场录制"
            />
            {current && (
              <Text type="secondary">
                录像 {fmtBytes(current.video_bytes)} · 帧 {current.frames.face + current.frames.gesture}
              </Text>
            )}
          </Space>
          {/* 这一场是谁的（与报告头同一份 label.json）。只有会话号时，导出的东西没法对号。 */}
          {files && (
            <div style={{ marginTop: 10, fontSize: 13, color: 'var(--ax-text-secondary)' }}>
              {files.subject && Object.keys(files.subject).length > 0 ? (
                <Space wrap size={16}>
                  <span>被测者 <strong style={{ color: 'var(--ax-ink)' }}>{files.subject.name || '—'}</strong></span>
                  {files.subject.student_id && <span>学号 {files.subject.student_id}</span>}
                  {files.subject.department && <span>院系 {files.subject.department}</span>}
                  {files.subject.serial && <span>场次 {files.subject.serial}</span>}
                </Space>
              ) : (
                <span>被测者：未标注（录制时没有填写姓名 / 学号 / 院系）</span>
              )}
            </div>
          )}
        </Card>

        {loadingFiles && <Spin tip="读取这一场的数据…"><div style={{ height: 120 }} /></Spin>}

        {files && (
          <Space direction="vertical" size={20} style={{ width: '100%' }}>
            <Card
              size="small"
              title={<Space><FileTextOutlined />数据表（CSV，原样下载）</Space>}
            >
              <Space wrap size={[12, 12]}>
                {files.logs.filter((l) => l.exists).map((l) => (
                  <Button
                    key={l.key}
                    href={api(sid, `/csv/${l.key}`)}
                    icon={<DownloadOutlined />}
                  >
                    {l.label}
                    <Text type="secondary" style={{ marginLeft: 8, fontWeight: 400 }}>
                      {fmtBytes(l.bytes)} · {l.rows} 行
                    </Text>
                  </Button>
                ))}
                {files.logs.every((l) => !l.exists) && (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="这一场没有 CSV 日志" />
                )}
              </Space>
            </Card>

            <Card
              size="small"
              title={<Space><FileTextOutlined />语音识别（转写）</Space>}
              extra={files.transcript.exists ? (
                <Text type="secondary">
                  {files.transcript.n_segments} 段 · {files.transcript.n_chars ?? '—'} 字
                </Text>
              ) : null}
            >
              {!files.transcript.exists ? (
                <Alert type="info" showIcon
                  message="这一场没有转写"
                  description="只有提交过语音回答的场次才会有 transcript.json（实时分析页那条路不提交回答）。" />
              ) : (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Space wrap>
                    <Button type="primary" icon={<DownloadOutlined />}
                      href={api(sid, '/transcript?format=txt')}>
                      下载 TXT（人读）
                    </Button>
                    <Button icon={<DownloadOutlined />}
                      href={api(sid, '/transcript?format=csv')}>
                      下载 CSV（题干 + 回答）
                    </Button>
                    <Button icon={<DownloadOutlined />}
                      href={api(sid, '/transcript?format=json')}>
                      下载 JSON（原始）
                    </Button>
                  </Space>
                  <Alert
                    type="warning" showIcon
                    message="转写由 FunASR 自动生成，未经人工校对"
                    description="标点、数字可能有误；做关键词/文本分析前建议先人工抽查一遍。"
                  />
                  {files.transcript.preview && (
                    <div style={{
                      background: 'var(--ax-bg-secondary, #f7f7f7)', borderRadius: 8,
                      padding: '10px 14px', fontSize: 13, color: 'var(--ax-text-secondary)'
                    }}>
                      {files.transcript.preview}…
                    </div>
                  )}
                </Space>
              )}
            </Card>

            <Card
              size="small"
              title={<Space><LineChartOutlined />图表（按模块，数据直接来自上面的 CSV）</Space>}
              extra={<Button size="small" icon={<ReloadOutlined />} onClick={() => void loadCharts()}>重新生成</Button>}
            >
              <Space wrap size={16} style={{ marginBottom: 14 }}>
                <Text type="secondary">模块</Text>
                <Checkbox.Group
                  options={MODULE_OPTIONS}
                  value={modules}
                  onChange={(v) => setModules(v as string[])}
                />
              </Space>

              {modules.length === 0 && (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="至少选一个模块" />
              )}

              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                {modules.map((m) => {
                  const c = charts[m] || {};
                  const label = MODULE_OPTIONS.find((o) => o.value === m)?.label ?? m;
                  return (
                    <div key={m}>
                      <Space style={{ marginBottom: 8 }} wrap>
                        <Tag color="blue">{label}</Tag>
                        {c.url && (
                          <Button size="small" icon={<DownloadOutlined />}
                            href={api(sid, `/chart?module=${m}`)}>
                            下载 PNG
                          </Button>
                        )}
                      </Space>
                      {c.loading && <Spin><div style={{ height: 160 }} /></Spin>}
                      {c.error && (
                        <Alert type="info" showIcon message={`${label}：没有可画的数据`}
                          description={c.error} />
                      )}
                      {c.url && (
                        <img
                          src={c.url}
                          alt={`${sid} ${label} 图表`}
                          style={{ width: '100%', border: '1px solid #eee', borderRadius: 8 }}
                        />
                      )}
                      <Divider style={{ margin: '12px 0 0' }} />
                    </div>
                  );
                })}
              </Space>
            </Card>
          </Space>
        )}
      </div>
    </Content>
  );
};

export default DataExportPage;
