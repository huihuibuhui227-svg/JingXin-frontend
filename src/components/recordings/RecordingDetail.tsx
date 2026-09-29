import React, { useCallback, useEffect, useState } from 'react';
import { Drawer, Descriptions, Tabs, Button, Spin, Alert, Pagination, Empty, Space, Tag, Image, Typography } from 'antd';
import { BarChartOutlined, DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import { recordingsApi, RecordingDetail as Detail } from '@/services/recordingsApi';
import { API_BASE_URL } from '@/utils/constants';

const fmtBytes = (n: number): string => {
  if (!n) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
};

const PER_PAGE = 24;

/**
 * 一场的明细。刻意做成抽屉而不是独立路由:翻场次时**不该丢掉列表的上下文**
 * (滚动位置、筛的日志、以及"我在看第几场")。
 */
const RecordingDetail: React.FC<{ sid: string | null; onClose: () => void }> = ({ sid, onClose }) => {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modality, setModality] = useState<'face' | 'gesture'>('face');
  const [page, setPage] = useState(1);
  const [frames, setFrames] = useState<{ total: number; frames: string[] }>({ total: 0, frames: [] });
  const [framesLoading, setFramesLoading] = useState(false);
  // 「生成报告」。报告**从来不会自动生成**,必须有人按一下 —— 而没人会想到去面板
  // 里按。所以按钮放在这一页:看素材的地方就是想起来"这场怎么没有报告"的地方。
  const [generating, setGenerating] = useState(false);
  const [genMsg, setGenMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!sid) return;
    setLoading(true);
    setError(null);
    setDetail(null);
    setPage(1);
    recordingsApi.detail(sid)
      .then(setDetail)
      .catch((e) => setError(e?.response?.data?.error || e?.message || '读不到这一场'))
      .finally(() => setLoading(false));
  }, [sid]);

  useEffect(() => {
    if (!sid) return;
    setFramesLoading(true);
    recordingsApi.frames(sid, modality, page, PER_PAGE)
      .then((r) => setFrames({ total: r.total, frames: r.frames }))
      .catch(() => setFrames({ total: 0, frames: [] }))
      .finally(() => setFramesLoading(false));
  }, [sid, modality, page]);

  const label = detail?.label;

  const refreshDetail = useCallback(() => {
    if (!sid) return;
    recordingsApi.detail(sid).then(setDetail).catch(() => { /* 详情刷新失败不覆盖已有内容 */ });
  }, [sid]);

  /** 跑一次报告生成,轮询到结束。
   *  ⚠️ 走的是**盘上那条批处理**(`report_generator --session-id`),不是
   *     `report_live` —— 后者读的是服务进程内存里的数据,事后跑不了。 */
  const generateReport = async () => {
    if (!sid) return;
    setGenerating(true);
    setGenMsg('正在生成…');
    try {
      const t = await recordingsApi.generateReport(sid);
      const taskId = t?.task_id;
      if (!taskId) throw new Error(t?.message || '服务端没有返回 task_id');
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        const st = await recordingsApi.taskStatus(taskId);
        if (st.status === 'completed') { setGenMsg('已生成'); refreshDetail(); break; }
        if (st.status === 'failed') throw new Error(st.error || '生成失败');
        // `status` 还是 running —— 继续等
      }
    } catch (e: any) {
      setGenMsg(e?.response?.data?.detail || e?.message || '生成失败');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Drawer
      open={!!sid}
      onClose={onClose}
      width={760}
      title={label?.name ? `${label.name} · ${sid}` : sid}
      destroyOnClose
    >
      {loading && <Spin tip="读取中..." />}
      {error && <Alert type="error" showIcon message={error} />}
      {detail && (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* ⚠️ 降级要放在**最上面**。留存账本此前没有任何消费方(§8.1-5),
              于是"降级过的那一场"与"正常那场"在盘上长得一模一样 —— 这一页是
              它第一个消费方,那它就必须显眼,而不是塞在折叠区里。 */}
          {detail.degraded > 0 && (
            <Alert
              type="warning"
              showIcon
              message={`本场留存有 ${detail.degraded} 处降级 —— 素材可能不完整`}
              description={<ul style={{ margin: 0, paddingLeft: 18 }}>
                {(detail.degraded_reasons || []).map((r, i) => <li key={i}>{r}</li>)}
              </ul>}
            />
          )}

          <Descriptions size="small" column={2} bordered>
            <Descriptions.Item label="场次">{detail.sid}</Descriptions.Item>
            <Descriptions.Item label="目录">{detail.dir_name || '—'}</Descriptions.Item>
            <Descriptions.Item label="录像">
              {detail.has_video ? fmtBytes(detail.video_bytes) : <Tag>没有原生录像</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label="整场体积">{fmtBytes(detail.bytes_total)}</Descriptions.Item>
            <Descriptions.Item label="帧">
              face {detail.frames.face} · gesture {detail.frames.gesture}
            </Descriptions.Item>
            <Descriptions.Item label="标注">
              {label
                ? [label.serial, label.student_id, label.department].filter(Boolean).join(' · ') || '（只填了姓名）'
                : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="征询">
              {label?.consent === 'audio_only'
                ? <Tag color="blue">只同意声音 —— 摄像头未打开</Tag>
                : label?.consent === 'full'
                  ? <Tag color="green">全部同意(影像 + 声音)</Tag>
                  : <Tag>未记录(征询上线之前的场次)</Tag>}
            </Descriptions.Item>
          </Descriptions>

          {detail.has_video ? (
            <div>
              {/* ⚠️ `src` 里带 token 是**没办法**(`<video>` 发不了请求头,见 recordingsApi
                  的说明)。首次打开某一場时服务端要现做预览件,会等几秒 —— 所以说出来,
                  免得看起来像卡住了。 */}
              <video
                controls
                preload="metadata"
                style={{ width: '100%', maxHeight: 420, background: '#000' }}
                src={recordingsApi.videoUrl(detail.sid)}
              />
              <div style={{ marginTop: 6, color: 'var(--ax-text-secondary)', fontSize: 12 }}>
                {detail.preview_ready
                  ? '已备好索引 —— 进度条可以拖。'
                  : '首次打开要先做一份带索引的预览件（几秒），之后就能拖了；这份原始录像一个字节都不会被改动。'}
              </div>
            </div>
          ) : (
            <Empty description="这一场没有原生录像（只有帧或什么都没有）" />
          )}

          <Tabs
            items={[
              {
                key: 'frames',
                label: `逐帧抽查（${detail.frames.face + detail.frames.gesture}）`,
                children: (
                  <div>
                    <Space style={{ marginBottom: 12 }}>
                      <Button size="small" type={modality === 'face' ? 'primary' : 'default'}
                        onClick={() => { setModality('face'); setPage(1); }}>
                        face {detail.frames.face}
                      </Button>
                      <Button size="small" type={modality === 'gesture' ? 'primary' : 'default'}
                        onClick={() => { setModality('gesture'); setPage(1); }}>
                        gesture {detail.frames.gesture}
                      </Button>
                      <span style={{ color: 'var(--ax-text-secondary)', fontSize: 12 }}>
                        画面冻住时这里会看到连续多张一模一样 —— 正是 §8.2.5 那个检查
                      </span>
                    </Space>
                    {framesLoading ? <Spin /> : frames.frames.length === 0 ? (
                      <Empty description="这一场这个模态没有帧" />
                    ) : (
                      <Image.PreviewGroup>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
                          {frames.frames.map((f) => (
                            <Image
                              key={f}
                              src={recordingsApi.fileUrl(detail.sid, `media/${modality}/${f}`)}
                              style={{ aspectRatio: '4/3', objectFit: 'cover' }}
                              alt={f}
                            />
                          ))}
                        </div>
                      </Image.PreviewGroup>
                    )}
                    <Pagination
                      style={{ marginTop: 12, textAlign: 'center' }}
                      size="small" current={page} pageSize={PER_PAGE} total={frames.total}
                      showSizeChanger={false} onChange={setPage}
                    />
                  </div>
                ),
              },
              {
                key: 'files',
                label: `文件（${detail.files.length}）`,
                children: detail.files.length === 0 ? <Empty description="没有可下载的文件" /> : (
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {detail.files.map((f) => (
                      <div key={f} style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{f}</span>
                        {/* `<a download>` 同样发不了请求头 ⟹ 一样走 URL 里的 token。 */}
                        <Button size="small" icon={<DownloadOutlined />}
                          href={recordingsApi.fileUrl(detail.sid, f)} download>
                          下载
                        </Button>
                      </div>
                    ))}
                  </Space>
                ),
              },
              {
                key: 'reports',
                label: `报告（${detail.reports.length}）`,
                children: detail.reports.length === 0 ? (
                  // ⚠️ 报告**不自动生成**(§8.2.4)。说清楚"没有"是因为没跑过,
                  //    而不是因为这一场没有数据 —— 并**当场给一个按钮**。
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Alert
                      type="info" showIcon
                      message="这一场还没有报告"
                      description="报告不会自动生成。点下面的按钮跑一次(按本场 session_id 从盘上的日志算)。"
                    />
                    <Button type="primary" icon={<BarChartOutlined />}
                      loading={generating} onClick={generateReport}>
                      生成报告
                    </Button>
                    {genMsg && <Typography.Text type="secondary">{genMsg}</Typography.Text>}
                  </Space>
                ) : (
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {detail.reports.map((r) => (
                      <div key={r.name} style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.name}</span>
                        {/* ⚠️ 必须是**面板的绝对地址**：`/output/...` 相对路径会被解析到
                            前端自己那个端口(5173)上,而那台机器上没有这个路由 ⟹ 404。 */}
                        <Button size="small" icon={<ReloadOutlined />}
                          href={`${API_BASE_URL}/output/${r.name}`} target="_blank" rel="noreferrer">
                          打开
                        </Button>
                      </div>
                    ))}
                    <Space>
                      <Button icon={<BarChartOutlined />} loading={generating} onClick={generateReport}>
                        再生成一份
                      </Button>
                      {genMsg && <Typography.Text type="secondary">{genMsg}</Typography.Text>}
                    </Space>
                    {detail.reports.length > 1 && (
                      <span style={{ color: 'var(--ax-text-secondary)', fontSize: 12 }}>
                        同一场跑过多次就会有多个报告（报告名里是**生成时刻**，不含 session_id）
                      </span>
                    )}
                  </Space>
                ),
              },
            ]}
          />
        </Space>
      )}
    </Drawer>
  );
};

export default RecordingDetail;
