import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Drawer, Descriptions, Tabs, Button, Spin, Alert, Pagination, Empty, Space, Tag, Image, Typography } from 'antd';
import { BarChartOutlined, DownloadOutlined, ExportOutlined, ReloadOutlined } from '@ant-design/icons';
import { recordingsApi, RecordingDetail as Detail } from '@/services/recordingsApi';
import { API_BASE_URL } from '@/utils/constants';
import Loading from '@/components/common/Loading';

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
  const navigate = useNavigate();
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
      let done = false;
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        const st = await recordingsApi.taskStatus(taskId);
        // ⚠️ 服务端的任务状态只有 pending / running / **success** / **error**
        //    (app.py 的 run_script 落的就是这两个词)。此前这里等的是
        //    `completed`/`failed` —— 两个永远不成立的字符串,于是报告其实
        //    一两秒就生成好了,界面却空转到拨满 60 次(远端延迟下 ≈2 分钟),
        //    既不报"已生成",也不刷新报告列表。2026-10-26 实盘踩到。
        if (st.status === 'success') { setGenMsg('已生成'); refreshDetail(); done = true; break; }
        if (st.status === 'error') throw new Error(st.message || '生成失败');
        // `status` 还是 pending/running —— 继续等
      }
      // 拨满 60 次还没结束 = 超时。**不许**把界面留在"正在生成…"上(那正是
      // 这次修的那个观感);说清没等到,并把列表刷新一次再让人自己看。
      if (!done) {
        setGenMsg('还没跑完 —— 已刷新列表，稍后到「报告」页签查看');
        refreshDetail();
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
      width={780}
      title={label?.name ? `${label.name} · ${sid}` : sid}
      extra={detail ? (
        <Space size={8}>
          <Button
            size="small"
            type="primary"
            icon={<BarChartOutlined />}
            onClick={() => {
              onClose();
              navigate(`/report/${encodeURIComponent(detail.sid)}`);
            }}
          >
            结构化查账
          </Button>
          <Button
            size="small"
            icon={<ExportOutlined />}
            onClick={() => {
              onClose();
              navigate(`/export?sid=${encodeURIComponent(detail.sid)}`);
            }}
          >
            数据导出
          </Button>
        </Space>
      ) : null}
      destroyOnClose
    >
      {loading && <Loading tip="正在读取本场录制详情…" />}
      {error && <Alert type="error" showIcon message={error} />}
      {detail && (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
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
            <Descriptions.Item label="抽帧统计">
              面部 {detail.frames.face} 帧 · 手势 {detail.frames.gesture} 帧
            </Descriptions.Item>
            <Descriptions.Item label="标注">
              {label
                ? [label.serial, label.student_id, label.department].filter(Boolean).join(' · ') || '（只填了姓名）'
                : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="授权范围">
              {label?.consent === 'audio_only'
                ? <Tag color="blue">仅同意声音（摄像头未打开）</Tag>
                : label?.consent === 'full'
                  ? <Tag color="green">全部同意（影像 + 声音）</Tag>
                  : <Tag>未记录（授权模块上线前场次）</Tag>}
            </Descriptions.Item>
          </Descriptions>

          {detail.has_video ? (
            <div>
              <video
                controls
                preload="metadata"
                style={{ width: '100%', maxHeight: 420, background: '#000', borderRadius: 8 }}
                src={recordingsApi.videoUrl(detail.sid)}
              />
              <div style={{ marginTop: 6, color: 'var(--ax-text-secondary)', fontSize: 12 }}>
                {detail.preview_ready
                  ? '预览索引已就绪，可直接拖动进度条回查。'
                  : '首次打开将自动生成带时间索引的预览件（需等待数秒），原始录像文件不会被修改。'}
              </div>
            </div>
          ) : (
            <Empty description="本场未留存原生录像（仅含抽帧或行为日志）" />
          )}

          <Tabs
            items={[
              {
                key: 'frames',
                label: `逐帧抽查（${detail.frames.face + detail.frames.gesture}）`,
                children: (
                  <div>
                    <Space style={{ marginBottom: 12 }} wrap>
                      <Button size="small" type={modality === 'face' ? 'primary' : 'default'}
                        onClick={() => { setModality('face'); setPage(1); }}>
                        面部（{detail.frames.face}）
                      </Button>
                      <Button size="small" type={modality === 'gesture' ? 'primary' : 'default'}
                        onClick={() => { setModality('gesture'); setPage(1); }}>
                        手势（{detail.frames.gesture}）
                      </Button>
                      <span style={{ color: 'var(--ax-text-secondary)', fontSize: 12 }}>
                        若采集期间画面卡顿，此处可直观排查是否出现连续重复静帧
                      </span>
                    </Space>
                    {framesLoading ? <Spin /> : frames.frames.length === 0 ? (
                      <Empty description="本场该模态暂无抽帧画面" />
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
                label: `原始文件（${detail.files.length}）`,
                children: detail.files.length === 0 ? <Empty description="没有可下载的文件" /> : (
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {detail.files.map((f) => (
                      <div key={f} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{f}</span>
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
                label: `离线报告（${detail.reports.length}）`,
                children: detail.reports.length === 0 ? (
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Alert
                      type="info" showIcon
                      message="本场尚未归档离线 HTML 报告"
                      description="离线单文件报告按需生成，点击下方按钮即可按本场会话号从落盘日志实时生成；也可点击右上角「结构化查账」直接在线查看。"
                    />
                    <Button type="primary" icon={<BarChartOutlined />}
                      loading={generating} onClick={generateReport}>
                      生成离线报告
                    </Button>
                    {genMsg && <Typography.Text type="secondary">{genMsg}</Typography.Text>}
                  </Space>
                ) : (
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {detail.reports.map((r) => (
                      <div key={r.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.name}</span>
                        <Button size="small" icon={<ReloadOutlined />}
                          href={`${API_BASE_URL}/output/${r.name}`} target="_blank" rel="noreferrer">
                          打开
                        </Button>
                      </div>
                    ))}
                    <Space>
                      <Button icon={<BarChartOutlined />} loading={generating} onClick={generateReport}>
                        重新生成一份
                      </Button>
                      {genMsg && <Typography.Text type="secondary">{genMsg}</Typography.Text>}
                    </Space>
                    {detail.reports.length > 1 && (
                      <span style={{ color: 'var(--ax-text-secondary)', fontSize: 12 }}>
                        同一场次多次生成会保留多份历史快照，文件名中包含生成时刻
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
