import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layout, Table, Button, Tag, Space, Modal, Input, Alert, message, Tooltip, Typography,
} from 'antd';
import {
  LockOutlined, UnlockOutlined, DeleteOutlined, PlayCircleOutlined, WarningOutlined, BarChartOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  recordingsApi, RecordingSummary, getAdminToken,
} from '@/services/recordingsApi';
import RecordingDetail from '@/components/recordings/RecordingDetail';

const { Content } = Layout;
const { Paragraph, Text } = Typography;

const fmtBytes = (n: number): string => {
  if (!n) return '—';
  const u = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
};

const fmtTime = (sec: number): string => {
  const d = new Date(sec * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/**
 * 录制素材浏览。
 *
 * ── 这一页的**形状**是被两件事逼出来的 ──────────────────────────────────
 *
 * ① **未授权的视图里没有身份字段,而且这件事由服务端保证。** 目录名现在是
 *    `<序号>-<姓名>-<学号>-<院系>__<sid>`,所以"列个目录"本身就是在列受试者名单。
 *    前端这里**不做任何隐藏** —— 没登录时对象里压根没有那些键。别在前端加
 *    "if (admin) 才显示"式的隐藏:那只是把接口裸奔伪装成受保护。
 *
 * ② **删除只能是"移进回收站"**,而且要抄一遍 sid。2026-09-28 刚丢过 2.1 GB,
 *    原始素材没有第二次机会。
 */
const RecordingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<Awaited<ReturnType<typeof recordingsApi.list>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [admin, setAdmin] = useState(!!getAdminToken());
  const [loginOpen, setLoginOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const [detailSid, setDetailSid] = useState<string | null>(null);

  const [trashTarget, setTrashTarget] = useState<RecordingSummary | null>(null);
  const [trashing, setTrashing] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const r = await recordingsApi.list();
      setData(r);
      setAdmin(r.admin);
    } catch (e: any) {
      setListError(e?.response?.data?.error || e?.message || '列表读不出来');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const doLogin = async () => {
    setLoggingIn(true);
    setLoginError(null);
    try {
      await recordingsApi.login(password);
      setLoginOpen(false);
      setPassword('');
      message.success('已进入管理员视图');
      await reload();
    } catch (e: any) {
      // ⚠️ 503 与 401 要分开说:前者是"这台机器没配密码",后者才是"密码不对"。
      //    混成一句"登录失败"会把人带去改密码,而真因是环境变量没设。
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

  const doLogout = async () => {
    recordingsApi.logout();
    setAdmin(false);
    await reload();
  };

  const doTrash = async () => {
    if (!trashTarget) return;
    setTrashing(true);
    try {
      // ⚠️ 前端把 sid 自动填上 —— 服务端那道校验**留着**(接口契约不变)。
      //    抄写门槛挡的是手快,而这一步已经改成移进回收站(可救)
      //    —— 门槛的收益不值它的麻烦(使用者 2026-09-28 裁定)。
      const r = await recordingsApi.trash(trashTarget.sid, trashTarget.sid);
      message.success(`已移到回收站：${r.moved_to}`);
      setTrashTarget(null);
      await reload();
    } catch (e: any) {
      message.error(e?.response?.data?.error || e?.message || '移动失败');
    } finally {
      setTrashing(false);
    }
  };

  const columns: ColumnsType<RecordingSummary> = [
    {
      title: '时间', dataIndex: 'modified', width: 150,
      render: (v: number) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtTime(v)}</span>,
      sorter: (a, b) => a.modified - b.modified,
      defaultSortOrder: 'descend',
    },
    {
      title: '场次', dataIndex: 'sid',
      render: (_: unknown, r: RecordingSummary) => (
        <Space direction="vertical" size={0}>
          <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.sid}</span>
          {/* 身份只在管理员视图里存在 —— 没登录时 `label` 这个键根本不在对象上。 */}
          {r.label?.name && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {[r.label.serial, r.label.name, r.label.student_id, r.label.department]
                .filter(Boolean).join(' · ')}
            </Text>
          )}
          {r.is_none_bucket && (
            <Tag color="orange">未归属场次（缺失会话号）</Tag>
          )}
        </Space>
      ),
    },
    {
      title: '录像', dataIndex: 'video_bytes', width: 110,
      render: (v: number, r) => (r.has_video
        ? <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtBytes(v)}</span>
        : <Tag>无</Tag>),
      sorter: (a, b) => a.video_bytes - b.video_bytes,
    },
    {
      title: '帧（面部/手势）', width: 125,
      render: (_: unknown, r) => (
        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
          {r.frames.face} / {r.frames.gesture}
        </span>
      ),
      sorter: (a, b) => (a.frames.face + a.frames.gesture) - (b.frames.face + b.frames.gesture),
    },
    {
      title: '报告', dataIndex: 'report_count', width: 85,
      render: (v: number) => (v > 0
        ? <Tag color="processing">{v} 份</Tag>
        : <Tooltip title="报告按需生成 —— 可点击「查账」实时查看结构化报告，或进详情生成离线 HTML"><Tag>未归档</Tag></Tooltip>),
      sorter: (a, b) => a.report_count - b.report_count,
    },
    {
      title: '留存状态', dataIndex: 'degraded', width: 95,
      render: (v: number) => (v > 0
        ? <Tooltip title="本场留存出现降级，素材可能不完整，请点「详情」查看具体原因。">
            <Tag icon={<WarningOutlined />} color="warning">{v} 处降级</Tag>
          </Tooltip>
        : <Tag color="success">正常</Tag>),
    },
    {
      title: '操作', width: 256, fixed: 'right',
      render: (_: unknown, r) => (
        <Space size={2} wrap={false}>
          {!r.is_none_bucket && (
            <Button
              size="small"
              type="link"
              style={{ padding: '0 6px' }}
              icon={<BarChartOutlined />}
              onClick={() => navigate(`/report/${encodeURIComponent(r.sid)}`)}
            >
              查账
            </Button>
          )}
          <Button size="small" type="link" style={{ padding: '0 6px' }} icon={<PlayCircleOutlined />}
            disabled={!admin} onClick={() => setDetailSid(r.sid)}>
            详情
          </Button>
          <Button size="small" type="link" style={{ padding: '0 6px' }} danger icon={<DeleteOutlined />}
            disabled={!admin} onClick={() => setTrashTarget(r)}>
            回收站
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Content style={{ padding: '24px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 16, flexWrap: 'wrap' }}>
          <div>
            <Typography.Title level={1} style={{ margin: 0, fontSize: "var(--ax-display-md-size)" }}>录制素材管理</Typography.Title>
            <Paragraph type="secondary" style={{ margin: '4px 0 0' }}>
              {data
                ? `${data.recordings.length} 场 · 录像合计 ${fmtBytes(data.total_video_bytes)} · 帧合计 ${data.total_frames}`
                : '正在读取录制台账…'}
              {data && data.trash_count > 0 && ` · 回收站中还有 ${data.trash_count} 场`}
            </Paragraph>
          </div>
          {admin ? (
            <Space direction="vertical" align="end" size={0}>
              <Button icon={<UnlockOutlined />} onClick={doLogout}>退出管理员</Button>
              <Text type="secondary" style={{ fontSize: 12 }}>当前标签页关闭后自动失效</Text>
            </Space>
          ) : (
            <Button type="primary" icon={<LockOutlined />} onClick={() => { setLoginError(null); setLoginOpen(true); }}>
              管理员视图
            </Button>
          )}
        </div>

        {!admin && (
          <Alert
            style={{ marginBottom: 16 }} type="info" showIcon
            message="当前为公开只读脱敏视图"
            description="仅展示场次编号、录像体积、抽帧数量与留存状态，可直接点击「查账」查看匿名化的结构化行为证据报告。姓名、学号、院系、原始录像回放、原始日志下载与移入回收站均在服务端执行管理员鉴权校验，未授权请求不会返回任何身份字段。"
          />
        )}
        {listError && <Alert style={{ marginBottom: 16 }} type="error" showIcon message={listError} />}

        <Table
          rowKey="sid"
          size="small"
          loading={loading}
          columns={columns}
          dataSource={data?.recordings ?? []}
          scroll={{ x: 1080 }}
          pagination={{ pageSize: 20, showSizeChanger: true }}
        />

        <RecordingDetail sid={detailSid} onClose={() => { setDetailSid(null); void reload(); }} />

        <Modal
          title="管理员身份验证"
          open={loginOpen}
          onOk={doLogin}
          confirmLoading={loggingIn}
          okText="进入管理员视图"
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

        <Modal
          title="移入回收站"
          open={!!trashTarget}
          onOk={doTrash}
          okText="确认移入回收站"
          okButtonProps={{ danger: true }}
          confirmLoading={trashing}
          cancelText="取消"
          onCancel={() => setTrashTarget(null)}
        >
          <Paragraph>
            本场素材将被移动至服务端隔离目录 <Text code>recordings/_回收站/&lt;时间戳&gt;__&lt;原名&gt;/</Text>，
            <Text strong>不会执行物理粉碎</Text>——误操作后可由管理员从磁盘恢复。
          </Paragraph>
          {trashTarget && (
            <Paragraph type="secondary" style={{ fontSize: 12 }}>
              {trashTarget.dir_name || trashTarget.sid} · 录像 {fmtBytes(trashTarget.video_bytes)}
              {' · '}帧 {trashTarget.frames.face + trashTarget.frames.gesture}
            </Paragraph>
          )}
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            因移入回收站可逆，确认后即直接归档隔离，无需手工抄写会话号。
          </Paragraph>
        </Modal>
      </div>
    </Content>
  );
};

export default RecordingsPage;
