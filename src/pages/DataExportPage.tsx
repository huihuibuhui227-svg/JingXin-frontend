import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Layout, Card, Select, Button, Checkbox, Space, Typography, message,
  Alert, Tag, Divider, Empty, Modal, Input
} from 'antd';
import {
  BarChartOutlined, DownloadOutlined, LineChartOutlined, FileTextOutlined,
  LockOutlined, ReloadOutlined, UnlockOutlined
} from '@ant-design/icons';
import { API_BASE_URL } from '@/utils/constants';
import { getAdminToken, recordingsApi } from '@/services/recordingsApi';
import Loading from '@/components/common/Loading';

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
  { value: 'face', label: '面部观测' },
  { value: 'gesture', label: '手势与体态' },
  { value: 'voice', label: '语音韵律' }
];

const fmtBytes = (n: number): string => {
  if (!n) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
};

const api = (sid: string, path: string): string =>
  `${API_BASE_URL}/api/export/${encodeURIComponent(sid)}${path}`;

/**
 * 鉴权头。**与素材页同一份 token**(`sessionStorage` 里的 `jx_admin_token`)——
 * 两页共用一次登录,不各存一份。
 */
const authHeaders = (): Record<string, string> => {
  const token = getAdminToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/**
 * 给**下载链接**用的 URL:token 走 query。
 *
 * `<a href download>` 与 `<img src>` 发不了自定义头(浏览器限制,不是选择)——
 * 服务端对这三条(csv / transcript / chart)开了 `allow_query=True`,与素材页的
 * `/video`、`/file` 同一口径、同一代价(token 会进浏览器历史与访问日志)。
 * ⚠️ 分隔符要看 URL 里**已经有没有** `?` —— 一律用 `?` 会让 `?format=txt?token=…`
 *    里的 token 收不到(素材页踩过一次,这里同样防着)。
 */
const downloadUrl = (url: string): string => {
  const token = getAdminToken();
  if (!token) return url;
  return `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
};

const DataExportPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedSid = searchParams.get('sid') || '';

  const [sessions, setSessions] = useState<ExportSession[]>([]);
  const [sid, setSid] = useState<string>(requestedSid);
  const [files, setFiles] = useState<ExportFiles | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [needLogin, setNeedLogin] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [modules, setModules] = useState<string[]>(['face', 'gesture', 'voice']);
  const [charts, setCharts] = useState<Record<string, { url?: string; error?: string; loading?: boolean }>>({});
  const urlsRef = useRef<string[]>([]);

  const clearChartUrls = () => {
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    urlsRef.current = [];
  };

  const applySessionList = (list: ExportSession[]) => {
    setSessions(list);
    if (!list.length) return;
    setSid((prev) => {
      if (prev && list.some((s) => s.sid === prev)) return prev;
      if (requestedSid && list.some((s) => s.sid === requestedSid)) return requestedSid;
      return list[0].sid;
    });
  };

  useEffect(() => {
    setLoadingSessions(true);
    fetch(`${API_BASE_URL}/api/export/sessions`, { headers: authHeaders() })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (r.status === 401) { setNeedLogin(true); return; }
        if (!r.ok) throw new Error(body?.error || `读取失败(${r.status})`);
        setNeedLogin(false);
        const list: ExportSession[] = (body.sessions || [])
          .sort((a: ExportSession, b: ExportSession) => b.modified - a.modified);
        applySessionList(list);
      })
      .catch((e) => message.error(e?.message || '读不到会话列表'))
      .finally(() => setLoadingSessions(false));
    return () => clearChartUrls();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!sid || needLogin) return;
    setLoadingFiles(true);
    setFiles(null);
    fetch(api(sid, '/files'), { headers: authHeaders() })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (r.status === 401) { setNeedLogin(true); return; }
        if (!r.ok) throw new Error(body?.error || `读取失败(${r.status})`);
        setFiles(body as ExportFiles);
      })
      .catch((e) => message.error(e?.message || '读取这一场的数据失败'))
      .finally(() => setLoadingFiles(false));
  }, [sid, needLogin]);

  const reloadAll = async () => {
    setLoadingSessions(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/export/sessions`, { headers: authHeaders() });
      const body = await r.json().catch(() => ({}));
      if (r.status === 401) { setNeedLogin(true); return; }
      if (!r.ok) throw new Error(body?.error || `读取失败(${r.status})`);
      setNeedLogin(false);
      const list: ExportSession[] = (body.sessions || [])
        .sort((a: ExportSession, b: ExportSession) => b.modified - a.modified);
      applySessionList(list);
    } catch (e: any) {
      message.error(e?.message || '读不到会话列表');
    } finally {
      setLoadingSessions(false);
    }
  };

  const doLogout = () => {
    recordingsApi.logout();
    clearChartUrls();
    setSessions([]);
    setFiles(null);
    setCharts({});
    setNeedLogin(true);
    message.info('已退出管理员视图');
  };

  const doLogin = async () => {
    setLoggingIn(true);
    setLoginError(null);
    try {
      await recordingsApi.login(password);
      setLoginOpen(false);
      setPassword('');
      message.success('已进入管理员视图');
      await reloadAll();
    } catch (e: any) {
      // 503 与 401 要分开说:前者是"这台机器没配密码",后者才是"密码不对"。
      const status = e?.response?.status;
      const detail = e?.response?.data?.error;
      setLoginError(
        status === 503 ? `服务端还没配管理员密码：${detail}`
          : status === 401 ? '密码不对'
            : detail || e?.message || '登录失败');
    } finally {
      setLoggingIn(false);
    }
  };

  const loadCharts = async () => {
    if (!sid) return;
    clearChartUrls();
    const next: Record<string, { url?: string; error?: string; loading?: boolean }> = {};
    modules.forEach((m) => { next[m] = { loading: true }; });
    setCharts(next);

    await Promise.all(modules.map(async (m) => {
      try {
        const r = await fetch(api(sid, `/chart?module=${m}&t=${Date.now()}`),
          { headers: authHeaders() });
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

  const isAdmin = !needLogin && !!getAdminToken();

  return (
    <Content style={{ padding: '24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
          <div>
            <Title level={1} style={{ margin: 0, fontSize: 'var(--ax-display-md-size)' }}>
              数据导出与原表复核
            </Title>
            <Paragraph type="secondary" style={{ margin: '6px 0 0' }}>
              导出三路采集原始行为台账（CSV）、语音转写及按模块趋势图；报告页展示的是经过白盒证据门筛选后的结构化证据，科研复核与再分析可使用此处原件。
            </Paragraph>
          </div>
          <Space wrap>
            {sid && !needLogin && (
              <Button icon={<BarChartOutlined />} onClick={() => navigate(`/report/${encodeURIComponent(sid)}`)}>
                查看结构化报告
              </Button>
            )}
            {isAdmin ? (
              <Button icon={<UnlockOutlined />} onClick={doLogout}>退出管理员</Button>
            ) : needLogin ? (
              <Button type="primary" icon={<LockOutlined />} onClick={() => { setLoginError(null); setLoginOpen(true); }}>
                管理员登录
              </Button>
            ) : null}
          </Space>
        </div>

        {needLogin && (
          <Alert
            type="warning" showIcon style={{ marginBottom: 16 }}
            message="本页需验证管理员身份"
            description="原始数据导出包含受试者身份标注、语音转写全文与原始行为台账，与录制素材页共享同一服务端鉴权通道。"
            action={<Button size="small" type="primary" onClick={() => { setLoginError(null); setLoginOpen(true); }}>输入密码</Button>}
          />
        )}

        <Card size="small" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
            <label htmlFor="export-session-select" style={{ fontWeight: 600, color: 'var(--ax-ink)' }}>
              选择会话
            </label>
            <Select
              id="export-session-select"
              aria-label="选择导出会话"
              showSearch
              loading={loadingSessions}
              disabled={needLogin}
              value={sid || undefined}
              onChange={(next) => {
                setSid(next);
                setSearchParams({ sid: next }, { replace: true });
              }}
              options={sessionOptions}
              optionFilterProp="label"
              style={{ minWidth: 280, maxWidth: 480, flex: '1 1 320px' }}
              placeholder={needLogin ? '请先验证管理员身份' : '请选择一场录制'}
            />
            {current && (
              <Text type="secondary">
                录像 {fmtBytes(current.video_bytes)} · 抽帧 {current.frames.face + current.frames.gesture} 张
              </Text>
            )}
          </div>
          {files && (
            <div style={{ marginTop: 10, fontSize: 13, color: 'var(--ax-text-secondary)' }}>
              {files.subject && Object.keys(files.subject).length > 0 ? (
                <Space wrap size={16}>
                  <span>受试者 <strong style={{ color: 'var(--ax-ink)' }}>{files.subject.name || '—'}</strong></span>
                  {files.subject.student_id && <span>学号 {files.subject.student_id}</span>}
                  {files.subject.department && <span>院系 {files.subject.department}</span>}
                  {files.subject.serial && <span>场次 {files.subject.serial}</span>}
                </Space>
              ) : (
                <span>受试者：未标注（录制时未填写姓名 / 学号 / 院系）</span>
              )}
            </div>
          )}
        </Card>

        {loadingFiles && <Loading tip="正在读取本场原始数据…" />}

        {files && (
          <Space direction="vertical" size={20} style={{ width: '100%' }}>
            <Card
              size="small"
              title={<Space><FileTextOutlined />原始行为台账（CSV 原样下载）</Space>}
            >
              <Space wrap size={[12, 12]}>
                {files.logs.filter((l) => l.exists).map((l) => (
                  <Button
                    key={l.key}
                    href={downloadUrl(api(sid, `/csv/${l.key}`))}
                    icon={<DownloadOutlined />}
                  >
                    {l.label}
                    <Text type="secondary" style={{ marginLeft: 8, fontWeight: 400 }}>
                      {fmtBytes(l.bytes)} · {l.rows} 行
                    </Text>
                  </Button>
                ))}
                {files.logs.every((l) => !l.exists) && (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="本场暂无 CSV 原始日志" />
                )}
              </Space>
            </Card>

            <Card
              size="small"
              title={<Space><FileTextOutlined />语音识别转写</Space>}
              extra={files.transcript.exists ? (
                <Text type="secondary">
                  {files.transcript.n_segments} 段 · {files.transcript.n_chars ?? '—'} 字
                </Text>
              ) : null}
            >
              {!files.transcript.exists ? (
                <Alert type="info" showIcon
                  message="本场未生成语音转写"
                  description="仅提交过语音问答的场次会生成语音转写记录（实时监测模式不提交问答）。" />
              ) : (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Space wrap>
                    <Button type="primary" icon={<DownloadOutlined />}
                      href={downloadUrl(api(sid, '/transcript?format=txt'))}>
                      下载 TXT（阅读版）
                    </Button>
                    <Button icon={<DownloadOutlined />}
                      href={downloadUrl(api(sid, '/transcript?format=csv'))}>
                      下载 CSV（题干 + 回答）
                    </Button>
                    <Button icon={<DownloadOutlined />}
                      href={downloadUrl(api(sid, '/transcript?format=json'))}>
                      下载 JSON（结构化原件）
                    </Button>
                  </Space>
                  <Alert
                    type="warning" showIcon
                    message="转写文本由本地 FunASR 自动生成，未经人工校对"
                    description="标点与专有名词可能存在识别误差；用于研究分析前建议结合音频抽检复核。"
                  />
                  {files.transcript.preview && (
                    <div style={{
                      background: 'var(--ax-canvas)', borderRadius: 8,
                      border: '1px solid var(--ax-hairline)',
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
              title={<Space><LineChartOutlined />原始台账趋势图（按模态绘制）</Space>}
              extra={<Button size="small" icon={<ReloadOutlined />} onClick={() => void loadCharts()}>重新生成</Button>}
            >
              <Space wrap size={16} style={{ marginBottom: 14 }}>
                <Text type="secondary">模态筛选</Text>
                <Checkbox.Group
                  options={MODULE_OPTIONS}
                  value={modules}
                  onChange={(v) => setModules(v as string[])}
                />
              </Space>

              {modules.length === 0 && (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请至少选择一个模态" />
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
                            href={downloadUrl(api(sid, `/chart?module=${m}`))}>
                            下载 PNG
                          </Button>
                        )}
                      </Space>
                      {c.loading && <Loading tip={`正在绘制${label}趋势图…`} />}
                      {c.error && (
                        <Alert type="info" showIcon message={`${label}：无可绘制数据`}
                          description={c.error} />
                      )}
                      {c.url && (
                        <img
                          src={c.url}
                          alt={`${sid} ${label} 趋势图`}
                          style={{ width: '100%', border: '1px solid var(--ax-hairline)', borderRadius: 8 }}
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

      <Modal
        title="管理员身份验证"
        open={loginOpen}
        onOk={doLogin}
        confirmLoading={loggingIn}
        okText="进入"
        cancelText="取消"
        onCancel={() => { setLoginOpen(false); setPassword(''); }}
      >
        <Input.Password
          aria-label="管理员密码"
          value={password} onChange={(e) => setPassword(e.target.value)}
          onPressEnter={doLogin} placeholder="请输入管理员密码" autoFocus
        />
        {loginError && <Alert style={{ marginTop: 12 }} type="error" showIcon message={loginError} />}
      </Modal>
    </Content>
  );
};

export default DataExportPage;
