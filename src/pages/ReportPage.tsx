import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Layout,
  Card,
  Button,
  Result,
  Alert,
  Drawer,
  Segmented,
  Space,
  Tag,
  Typography,
  Select,
  Input,
  Table,
  Skeleton,
  message,
} from 'antd';
import {
  CopyOutlined,
  EditOutlined,
  HighlightOutlined,
  ReadOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import ReportViewer from '@/components/report/ReportViewer';
import { BehaviorRegimeTimeline, RefereeStagePanel } from '@/components/report/ReportCharts';
import InstrumentProvenance from '@/components/report/InstrumentProvenance';
import type { L1WithInstruments } from '@/components/report/InstrumentProvenance';
import DownloadButton from '@/components/report/DownloadButton';
import Loading from '@/components/common/Loading';
import { useAssessmentStore } from '@/store/assessmentStore';
import {
  dashboardApi,
  getSessionId,
  ReportAssistMode,
  ReportLlmAssistResponse,
  ReviewerNote,
  reviewerNotesApi,
} from '@/services/api';
import { getAdminToken } from '@/services/recordingsApi';
import { API_BASE_URL } from '@/utils/constants';
import { downloadFile } from '@/utils/helpers';
import { EvaluationResult, Coverage } from '@/types/assessment';
import '@/styles/world-linear.css';

const { Content } = Layout;
const { Text } = Typography;

type NarrativeMode = 'narrative_review' | 'participant_feedback' | 'interview_guide';

const MODALITY_LABELS: Record<string, string> = {
  face: '面部',
  gesture: '手势',
  voice_interview: '语音（答辩/面试）',
  voice_research: '语音（科研）',
};
const STATUS_LABELS: Record<string, string> = {
  loaded: '已读入',
  unreadable: '未读到数据',
  missing: '缺失',
};
const LOG_KEY_TO_MODALITY: Record<string, string> = {
  voice_interview: 'voice',
  voice_research: 'voice',
};

const SESSION_ID_RE = /^\d{8}_\d{6}_[0-9a-f]{4}$/;

export function coverageHeroNumber(cov: Coverage): string {
  const n = cov.n_measurable;
  if (typeof n !== 'number') return `${cov.n_passed} / ${cov.n_slots}`;
  return n > 0 ? `${cov.n_passed} / ${n}` : '—';
}

export function coverageRateText(cov: Coverage): string | null {
  const rate = cov.pass_rate_of_measurable;
  if (rate === null) return '通过率不适用:可测量槽数为 0(分母为 0,不给百分比)';
  if (typeof rate === 'number') {
    return (
      `可测量槽通过率 ${cov.n_passed ?? '—'}/${cov.n_measurable ?? '—'}` +
      `(${Math.round(rate * 100)}%),分母只含可测量槽,不含另外两段`
    );
  }
  return null;
}

const REPORT_TASK_TIMEOUT_MS = 120_000;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const tailOf = (text?: string, n = 240): string => (text || '').trim().slice(-n) || '(未返回详细输出)';

const formatAssistPlainText = (data: ReportLlmAssistResponse): string => {
  if (Array.isArray(data.sections) && data.sections.length > 0) {
    return data.sections.map((s) => `【${s.title}】\n${s.body}`).join('\n\n');
  }
  return data.content || '';
};

const ReportPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { evaluationResult: storeResult } = useAssessmentStore();

  const [sceneProfile, setSceneProfile] = useState<string>(
    () => searchParams.get('scene_profile') || 'research_interview'
  );
  const [report, setReport] = useState<EvaluationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [describedSession, setDescribedSession] = useState<string | null>(null);
  const [sources, setSources] = useState<Record<string, any> | null>(null);
  const [subject, setSubject] = useState<Record<string, string> | null>(null);
  const [headerTimes, setHeaderTimes] = useState<{
    tested_at?: string | null;
    generated_at?: string | null;
  } | null>(null);

  const [reportHref, setReportHref] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [downloadNote, setDownloadNote] = useState<{
    kind: 'success' | 'info' | 'warning' | 'error';
    text: string;
  } | null>(null);

  // 一等公民可读叙事报告（页面打开即自动展示，支持切换受众视角与本地大模型润色）
  const [narrativeMode, setNarrativeMode] = useState<NarrativeMode>('narrative_review');
  const [assistLoading, setAssistLoading] = useState(false);
  const [assistLlmLoading, setAssistLlmLoading] = useState(false);
  const [assistData, setAssistData] = useState<ReportLlmAssistResponse | null>(null);
  const [assistError, setAssistError] = useState<string | null>(null);
  const assistReqSeq = useRef(0);

  // 管理员/导师人工复核注记（严格不打分，承接保形门不确定升级结果）
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewNote, setReviewNote] = useState<ReviewerNote | null>(null);
  const [reviewStatusDraft, setReviewStatusDraft] = useState<string>('pending_review');
  const [reviewTagsDraft, setReviewTagsDraft] = useState<string[]>([]);
  const [reviewTextDraft, setReviewTextDraft] = useState<string>('');
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const isAdmin = !!getAdminToken();

  useEffect(() => {
    // 路由切换时彻底清零派生状态，杜绝上一场内容残留；指定了 `:id`（含 `/report/latest`）时一律向服务端现取，不被旧 store 劫持。
    setReport(null);
    setError(null);
    setDescribedSession(null);
    setSources(null);
    setSubject(null);
    setHeaderTimes(null);
    setReportHref(null);
    setDownloadNote(null);
    setAssistData(null);
    setAssistError(null);
    setReviewNote(null);
    setReviewError(null);

    if (!id && storeResult && sceneProfile === 'research_interview' && !searchParams.get('scene_profile')) {
      setReport(storeResult);
      return;
    }

    const querySid = id && SESSION_ID_RE.test(id) ? id : undefined;
    setLoading(true);
    dashboardApi
      .getStructuredReport(querySid, sceneProfile)
      .then((data) => {
        if (data.status === 'success' && data.result) {
          setReport(data.result);
          setDescribedSession(data.session_id ?? null);
          setSources(data.sources ?? null);
          setSubject(data.subject ?? {});
          setHeaderTimes({ tested_at: data.tested_at ?? null, generated_at: data.generated_at ?? null });
        } else {
          setError(data.message || '无法获取报告数据');
        }
      })
      .catch((err) => {
        console.error('获取报告失败:', err);
        setError('获取报告失败，请确认总控面板服务已运行');
      })
      .finally(() => setLoading(false));
  }, [id, storeResult, sceneProfile]);

  const describedId =
    describedSession ??
    (!id && storeResult ? getSessionId() : null) ??
    (id && SESSION_ID_RE.test(id) ? id : null);

  // 报告就绪或切换受众视角/场景时，自动拉取结构化可读叙事报告（use_llm: false 确保即时呈现）
  useEffect(() => {
    if (!report || loading) return;
    const seq = ++assistReqSeq.current;
    setAssistLoading(true);
    setAssistError(null);
    dashboardApi
      .reportLlmAssist({
        session_id: describedId,
        mode: narrativeMode,
        use_llm: false,
        scene_profile: sceneProfile,
      })
      .then((res) => {
        if (seq !== assistReqSeq.current) return;
        setAssistData(res);
      })
      .catch((err: any) => {
        if (seq !== assistReqSeq.current) return;
        setAssistError(err?.response?.data?.message || err?.message || '暂未生成可读文字报告');
      })
      .finally(() => {
        if (seq === assistReqSeq.current) setAssistLoading(false);
      });
  }, [report, loading, describedId, narrativeMode, sceneProfile]);

  useEffect(() => {
    const sid = describedSession ?? (id && SESSION_ID_RE.test(id) ? id : null);
    if (!sid || !SESSION_ID_RE.test(sid)) return;
    reviewerNotesApi
      .get(sid)
      .then((res) => {
        if (res?.note) {
          setReviewNote(res.note);
          setReviewStatusDraft(res.note.verification_status || 'pending_review');
          setReviewTagsDraft(res.note.focus_tags || []);
          setReviewTextDraft(res.note.note_text || '');
        }
      })
      .catch(() => {});
  }, [describedSession, id]);

  const coverage = report?.coverage;
  const l1WithInstruments = report?.l1 as unknown as L1WithInstruments | undefined;

  const isRedactedSubject = subject?.status === 'redacted';
  const safeNamePrefix = !isRedactedSubject && subject?.name ? subject.name : describedId || '本场';
  const downloadName = `衡才智析-行为证据报告-${safeNamePrefix}.html`;

  const handleDownload = async () => {
    if (preparing) return;
    if (reportHref) {
      downloadFile(reportHref, downloadName);
      return;
    }
    if (!describedId) return;

    setPreparing(true);
    setDownloadNote({ kind: 'info', text: `正在按场次 ${describedId} 生成离线单文件 HTML 报告…` });
    try {
      const task = await dashboardApi.runModule('report', describedId);
      if (!task || task.status !== 'started' || !task.task_id) {
        throw new Error(task?.message || '后端没有接受生成任务');
      }

      const deadline = Date.now() + REPORT_TASK_TIMEOUT_MS;
      let last: any = null;
      for (;;) {
        if (Date.now() > deadline) {
          throw new Error(`等待 ${Math.round(REPORT_TASK_TIMEOUT_MS / 1000)} 秒仍未生成完成，请稍后前往报告中心重试`);
        }
        await sleep(1000);
        const r = await axios.get(`${API_BASE_URL}/api/task/${task.task_id}`);
        last = r.data;
        if (last?.status === 'success') break;
        if (last?.status === 'error') {
          throw new Error(`离线报告生成失败:${tailOf(last?.logs || last?.message)}`);
        }
      }

      let targetUrl: string = typeof last?.report_url === 'string' ? last.report_url : '';
      let targetName: string = last?.report_name || downloadName;
      if (!targetUrl) {
        const files = await dashboardApi.getFiles('reports');
        const newest = Array.isArray(files) ? files[0] : null;
        if (!newest?.url) {
          throw new Error('报告已生成,但列表中暂未读取到文件路径 —— 请前往「报告中心」直接打开');
        }
        targetUrl = String(newest.url);
        targetName = newest.display_name || newest.name || downloadName;
      }
      setReportHref(targetUrl);
      downloadFile(targetUrl, targetName);
      setDownloadNote({ kind: 'success', text: `离线 HTML 报告已生成并开始下载：${targetName}` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setDownloadNote({ kind: 'error', text: `下载报告失败:${msg}` });
      console.error('下载报告失败:', err);
    } finally {
      setPreparing(false);
    }
  };

  const handlePolishWithLlm = async () => {
    const seq = ++assistReqSeq.current;
    setAssistLlmLoading(true);
    setAssistError(null);
    try {
      const res = await dashboardApi.reportLlmAssist({
        session_id: describedId,
        mode: narrativeMode as ReportAssistMode,
        use_llm: true,
        scene_profile: sceneProfile,
        refresh: true,
      });
      if (seq !== assistReqSeq.current) return;
      setAssistData(res);
      if (res.source === 'local_llm') {
        message.success('已完成本地大模型文字润色');
      } else {
        message.info('当前保持结构化可读报告版本');
      }
    } catch (err: any) {
      if (seq !== assistReqSeq.current) return;
      setAssistError(err?.response?.data?.message || err?.message || '智能文字润色请求失败');
    } finally {
      if (seq === assistReqSeq.current) setAssistLlmLoading(false);
    }
  };

  const handleCopyNarrative = async () => {
    if (!assistData) return;
    const text = formatAssistPlainText(assistData);
    if (!text) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        message.success('文字报告已复制到剪贴板');
      } else {
        message.warning('当前浏览器不支持自动复制，请手动选择正文复制');
      }
    } catch {
      message.warning('复制未成功，请手动选择正文复制');
    }
  };

  const saveReviewNote = async () => {
    if (!describedId) return;
    setReviewSaving(true);
    setReviewError(null);
    try {
      const res = await reviewerNotesApi.save(describedId, {
        verification_status: reviewStatusDraft,
        focus_tags: reviewTagsDraft,
        note_text: reviewTextDraft,
      });
      setReviewNote(res.note);
      message.success('人工复核注记已合规存档');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || '保存人工复核注记失败';
      setReviewError(msg);
    } finally {
      setReviewSaving(false);
    }
  };

  const handleSceneProfileChange = (nextProfile: string) => {
    setSceneProfile(nextProfile);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('scene_profile', nextProfile);
    setSearchParams(nextParams, { replace: true });
  };

  if (loading) {
    return <Loading fullScreen tip="正在加载行为证据披露报告..." />;
  }

  if (error) {
    return (
      <Content className="ax-report-shell" style={{ padding: '40px 24px' }}>
        <Result
          status="warning"
          title="暂无报告数据"
          subTitle={error}
          extra={[
            <Button key="back" onClick={() => navigate(-1)}>
              返回
            </Button>,
            <Button key="home" type="primary" onClick={() => navigate('/')}>
              返回首页
            </Button>,
          ]}
        />
      </Content>
    );
  }

  if (!report) {
    return (
      <Content className="ax-report-shell" style={{ padding: '40px 24px' }}>
        <Result
          status="info"
          title="暂无行为证据报告"
          subTitle="请先完成一次科研、面试或审辨实训采录"
          extra={
            <Button type="primary" onClick={() => navigate('/research')}>
              开始采录
            </Button>
          }
        />
      </Content>
    );
  }

  const subjectPairs: Array<[string, string]> =
    subject && !isRedactedSubject
      ? (
          [
            ['被测者', subject.name],
            ['学号', subject.student_id],
            ['院系', subject.department],
            ['场次', subject.serial],
          ] as Array<[string, string | undefined]>
        )
          .filter(([, v]) => !!v)
          .map(([k, v]) => [k, v as string])
      : [];

  const crossModal = report.l1?.cross_modal_coverage;
  const asrDisclosure = report.l1?.asr_confidence_disclosure;
  const leadSummary = report.l1?.lead_summary;

  const metacogIndicators =
    report.scene_profile?.extensions?.all_metacognition_indicators ??
    report.scene_profile?.extensions?.metacognition_text?.indicators ??
    [];
  const metacogReg = report.scene_profile?.extensions?.metacognition_regulation;

  const narrativeSections =
    assistData?.sections && assistData.sections.length > 0
      ? assistData.sections
      : assistData?.content
        ? [{ title: assistData.audience_label || '行为观察正文', body: assistData.content }]
        : [];

  return (
    <Content className="ax-report-shell" style={{ padding: '28px 24px 56px' }}>
      <div style={{ maxWidth: 'var(--ax-content-max)', margin: '0 auto' }}>
        {/* 顶栏操作 */}
        <header className="ax-report-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <Button
                type="text"
                size="small"
                onClick={() => navigate('/reports')}
                style={{
                  padding: '2px 8px 2px 0',
                  height: 'auto',
                  color: 'var(--ax-text-secondary)',
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                ← 返回报告中心
              </Button>
              <span aria-hidden="true" style={{ color: 'var(--ax-hairline)' }}>
                |
              </span>
              <span
                style={{
                  fontFamily: 'var(--ax-font-mono)',
                  fontSize: 11.5,
                  letterSpacing: '0.06em',
                  color: 'var(--ax-text-secondary)',
                }}
              >
                EVIDENCE DISCLOSURE BRIEF · 行为证据核验简报
              </span>
            </div>
            <h1
              className="ax-report-title"
              style={{
                margin: '10px 0 0',
                fontFamily: 'var(--ax-font-serif, var(--ax-font-display))',
              }}
            >
              行为证据披露报告
            </h1>
          </div>
          <Space wrap>
            <Segmented
              aria-label="切换报告场景档案"
              size="small"
              value={sceneProfile}
              onChange={(val) => handleSceneProfileChange(String(val))}
              options={[
                { label: '研思循证', value: 'research_interview' },
                { label: '元智审辨', value: 'ai_metacognition' },
                { label: '时序观微', value: 'longitudinal_followup' },
              ]}
            />
            {describedId && (
              <Button icon={<EditOutlined />} onClick={() => setReviewOpen(true)}>
                人工复核注记
              </Button>
            )}
            <DownloadButton
              href={reportHref}
              filename={downloadName}
              loading={preparing}
              onDownload={describedId ? handleDownload : undefined}
              disabledReason={describedId ? undefined : '报告尚未生成(这份报告还没有关联会话)'}
            />
          </Space>
        </header>

        {!describedId && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="这一份没有会话号,页面上的「下载报告」暂时不可用"
            description={
              <span style={{ fontSize: 13 }}>
                要下载文件:到「历史报告」列表,点那一行行尾的「下载」。
                要看某一场的结构化报告:在「历史报告」里选那一份,或直接访问{' '}
                <code className="ax-mono-code">{'/report/<会话号>'}</code>。
              </span>
            }
            action={
              <Button size="small" onClick={() => navigate('/reports')}>
                去历史报告
              </Button>
            }
          />
        )}

        {downloadNote && (
          <Alert
            type={downloadNote.kind}
            showIcon
            closable
            onClose={() => setDownloadNote(null)}
            message={downloadNote.text}
            style={{ marginBottom: 16 }}
          />
        )}

        {/* 受试者身份 / 演示模式脱敏横幅 */}
        {subject !== null && (
          <Card className="ax-card" size="small" style={{ marginBottom: 16 }} data-testid="report-subject">
            {isRedactedSubject ? (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <Space wrap>
                  <Tag
                    style={{
                      margin: 0,
                      color: 'var(--ax-info)',
                      background: 'var(--ax-info-soft)',
                      borderColor: 'var(--ax-info-border)',
                    }}
                  >
                    演示模式已脱敏
                  </Tag>
                  <span style={{ fontSize: 13.5, color: 'var(--ax-text-secondary)' }}>
                    {subject.note || '演示模式已隐藏受试者身份信息，所有客观行为证据与缺口完整保留。'}
                  </span>
                </Space>
                <Button size="small" type="link" onClick={() => navigate('/recordings')}>
                  管理员登录解锁身份 ›
                </Button>
              </div>
            ) : subjectPairs.length === 0 ? (
              <div style={{ color: 'var(--ax-text-secondary)', fontSize: 13.5 }}>
                受试者：<strong style={{ color: 'var(--ax-ink)' }}>未填写身份信息</strong>
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '4px 18px' }}>
                {subjectPairs.map(([k, v]) => (
                  <span key={k} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ color: 'var(--ax-text-secondary)', fontSize: 13 }}>{k}</span>
                    <strong style={{ color: 'var(--ax-ink)' }}>{v}</strong>
                  </span>
                ))}
              </div>
            )}
            {(headerTimes?.tested_at || headerTimes?.generated_at) && (
              <div style={{ color: 'var(--ax-text-secondary)', fontSize: 12.5, marginTop: 8 }}>
                {headerTimes?.tested_at && <>采集时间 {headerTimes.tested_at}</>}
                {headerTimes?.tested_at && headerTimes?.generated_at && ' · '}
                {headerTimes?.generated_at && <>报告生成时间 {headerTimes.generated_at}</>}
                {describedSession && (
                  <>
                    {' '}
                    · 采录场次 <code className="ax-mono-code">{describedSession}</code>
                  </>
                )}
              </div>
            )}
          </Card>
        )}

        {/* ══ 一等公民核心区：「可读行为观察报告」编辑级纸张卡片 ═══════════════════ */}
        <section aria-label="可读行为观察报告" className="ax-narrative-paper">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: 14,
              paddingBottom: 18,
              borderBottom: '1px solid var(--ax-divider-soft)',
              marginBottom: 20,
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--ax-accent-ink)',
                  }}
                >
                  <ReadOutlined />
                  可读行为观察报告
                </span>
                {assistData && (
                  <Tag
                    icon={<SafetyCertificateOutlined />}
                    style={{
                      margin: 0,
                      color:
                        assistData.source === 'local_llm' ? 'var(--ax-success)' : 'var(--ax-info)',
                      background:
                        assistData.source === 'local_llm'
                          ? 'var(--ax-success-soft)'
                          : 'var(--ax-info-soft)',
                      borderColor:
                        assistData.source === 'local_llm'
                          ? 'var(--ax-success-border)'
                          : 'var(--ax-info-border)',
                    }}
                  >
                    {assistData.source === 'local_llm'
                      ? '智能文字润色 · 合规已核验'
                      : assistData.redline_verified
                        ? '结构化可读报告 · 合规已核验'
                        : '结构化可读报告'}
                  </Tag>
                )}
                {typeof assistData?.reading_time_min === 'number' && assistData.reading_time_min > 0 && (
                  <span style={{ fontSize: 12.5, color: 'var(--ax-text-secondary)' }}>
                    约 {assistData.reading_time_min} 分钟阅读
                  </span>
                )}
              </div>

              <h2
                className="ax-narrative-paper__title"
                style={{
                  margin: 0,
                  fontFamily: 'var(--ax-font-serif, var(--ax-font-display))',
                  color: 'var(--ax-ink)',
                }}
              >
                {assistData?.audience_label ||
                  (narrativeMode === 'narrative_review'
                    ? '导师审阅版 · 过程行为综述'
                    : narrativeMode === 'participant_feedback'
                      ? '个人成长版 · 表达反馈'
                      : '追问与实训提纲')}
              </h2>
            </div>

            <Space wrap size={10}>
              <Segmented
                aria-label="切换阅读受众版本"
                value={narrativeMode}
                onChange={(v) => setNarrativeMode(v as NarrativeMode)}
                options={[
                  { label: '导师审阅版', value: 'narrative_review' },
                  { label: '个人成长版', value: 'participant_feedback' },
                  { label: '追问与实训提纲', value: 'interview_guide' },
                ]}
              />
              <Button
                className="ax-btn--pill"
                type="primary"
                icon={<HighlightOutlined />}
                loading={assistLlmLoading}
                onClick={() => void handlePolishWithLlm()}
              >
                使用本地大模型深度润色
              </Button>
              <Button
                className="ax-btn--pill"
                icon={<CopyOutlined />}
                disabled={!assistData}
                onClick={() => void handleCopyNarrative()}
              >
                复制文字报告
              </Button>
            </Space>
          </div>

          {assistError && (
            <Alert type="warning" showIcon style={{ marginBottom: 16 }} message={assistError} />
          )}

          {(assistLoading || assistLlmLoading) && !assistData ? (
            <Skeleton active paragraph={{ rows: 6 }} />
          ) : assistLlmLoading ? (
            <div style={{ padding: '12px 0' }}>
              <Skeleton active paragraph={{ rows: 5 }} />
            </div>
          ) : narrativeSections.length > 0 ? (
            <div>
              {narrativeSections.map((sec, idx) => (
                <div key={`${sec.title}-${idx}`} className="ax-narrative-paper__section">
                  <h3>{sec.title}</h3>
                  <p>{sec.body}</p>
                </div>
              ))}
              {assistData?.watermark && (
                <div
                  style={{
                    marginTop: 22,
                    paddingTop: 14,
                    borderTop: '1px solid var(--ax-divider-soft)',
                    fontSize: 12.5,
                    color: 'var(--ax-text-secondary)',
                    lineHeight: 1.6,
                  }}
                >
                  {assistData.watermark}
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: 'var(--ax-text-secondary)', fontSize: 14 }}>
              暂未生成可读文字摘要，请查看下方分项测量明细。
            </div>
          )}
        </section>

        {/* 当前场景档案合规边界、主动封停项与场景扩展观测 */}
        {report.scene_profile && (
          <Card className="ax-card" size="small" style={{ marginBottom: 16 }}>
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <Space wrap size={8}>
                  <Tag
                    style={{
                      margin: 0,
                      color: 'var(--ax-info)',
                      background: 'var(--ax-info-soft)',
                      borderColor: 'var(--ax-info-border)',
                      fontWeight: 600,
                    }}
                  >
                    当前场景：{report.scene_profile.name}
                  </Tag>
                  {report.scene_profile.weight_label && (
                    <Tag
                      style={{
                        margin: 0,
                        color: 'var(--ax-ink-muted-80)',
                        background: 'var(--ax-surface-alt)',
                        borderColor: 'var(--ax-hairline)',
                      }}
                    >
                      {report.scene_profile.weight_label}
                    </Tag>
                  )}
                </Space>
                {reviewNote && (
                  <Tag
                    style={
                      reviewNote.exists
                        ? {
                            margin: 0,
                            color: 'var(--ax-success)',
                            background: 'var(--ax-success-soft)',
                            borderColor: 'var(--ax-success-border)',
                          }
                        : {
                            margin: 0,
                            color: 'var(--ax-text-secondary)',
                            background: 'var(--ax-surface-alt)',
                            borderColor: 'var(--ax-hairline)',
                          }
                    }
                  >
                    复核状态：{reviewNote.verification_label}
                  </Tag>
                )}
              </div>

              {report.scene_profile.compliance_banner && (
                <div style={{ fontSize: 13, color: 'var(--ax-text-secondary)' }}>
                  {report.scene_profile.compliance_banner}
                </div>
              )}

              {Array.isArray(report.scene_profile.explicit_blocked_overrides) &&
                report.scene_profile.explicit_blocked_overrides.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {report.scene_profile.explicit_blocked_overrides.map((ov) => (
                      <Tag key={ov.key} color="warning" style={{ margin: 0, whiteSpace: 'normal' }}>
                        主动封停：{ov.label}
                      </Tag>
                    ))}
                  </div>
                )}

              {metacogReg &&
                ((metacogReg.covered_loops_labels && metacogReg.covered_loops_labels.length > 0) ||
                  (metacogReg.missing_loops_labels && metacogReg.missing_loops_labels.length > 0)) && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                    <Text strong style={{ fontSize: 13 }}>
                      三环调控覆盖情况：
                    </Text>
                    {metacogReg.covered_loops_labels?.map((lbl) => (
                      <Tag
                        key={`cov-${lbl}`}
                        style={{
                          margin: 0,
                          color: 'var(--ax-success)',
                          background: 'var(--ax-success-soft)',
                          borderColor: 'var(--ax-success-border)',
                        }}
                      >
                        已覆盖：{lbl}
                      </Tag>
                    ))}
                    {metacogReg.missing_loops_labels?.map((lbl) => (
                      <Tag key={`miss-${lbl}`} color="warning" style={{ margin: 0 }}>
                        待补充：{lbl}
                      </Tag>
                    ))}
                  </div>
                )}

              {Array.isArray(metacogIndicators) && metacogIndicators.length > 0 && (
                <div style={{ marginTop: 4 }}>
                  <Text strong style={{ fontSize: 13.5 }}>
                    AI 元能力审辨文本扩展观测量（纯规则结构指标，严禁打分）
                  </Text>
                  <Table
                    size="small"
                    style={{ marginTop: 8 }}
                    rowKey="name"
                    pagination={false}
                    dataSource={metacogIndicators}
                    columns={[
                      { title: '扩展观测量', dataIndex: 'label', key: 'label' },
                      {
                        title: '实测读数',
                        key: 'value',
                        render: (_, r) => (r.value === null ? '缺口暂不可给' : `${r.value} ${r.unit}`.trim()),
                      },
                      { title: '置信度', dataIndex: 'confidence', key: 'confidence' },
                      { title: '说明', dataIndex: 'summary', key: 'summary' },
                    ]}
                  />
                </div>
              )}
            </Space>
          </Card>
        )}

        {/* 10 秒看懂导语卡片 */}
        {leadSummary && (
          <Card
            className="ax-card"
            size="small"
            style={{
              marginBottom: 16,
              background: 'var(--ax-info-soft)',
              borderColor: 'var(--ax-info-border)',
              borderLeft: '3px solid var(--ax-info)',
            }}
          >
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ax-info)', marginBottom: 4 }}>
              本场数据概览
            </div>
            <div style={{ fontSize: 15, lineHeight: 1.65, color: 'var(--ax-ink)' }}>{leadSummary}</div>
          </Card>
        )}

        {/* 画面与声音同步、问答声音分离 & 语音转写说明 */}
        {(crossModal || asrDisclosure || (report?.l1 as any)?.speaker_turn_audit) &&
          (() => {
            const cm = crossModal as any;
            const stAudit = (report?.l1 as any)?.speaker_turn_audit;
            const fgStatus = cm?.session?.pairs?.face_gesture?.status;
            const all3Status = cm?.session?.all_three?.status;
            let cmType: 'info' | 'warning' | 'error' | 'success' = 'info';
            let cmLabel = '单路数据';
            if (all3Status === 'aligned') {
              cmType = 'success';
              cmLabel = '画面与语音全程同步';
            } else if (fgStatus === 'aligned' && (all3Status === 'blocked' || all3Status === 'degraded')) {
              cmType = 'info';
              cmLabel = '面部与手势画面同步良好，语音按题分段记录';
            } else if (fgStatus === 'aligned') {
              cmType = 'success';
              cmLabel = '面部与手势画面同步良好';
            } else if (fgStatus === 'blocked' || all3Status === 'blocked') {
              cmType = 'warning';
              cmLabel = '不同通道采集时段重合较少，已分项独立展示';
            } else if (fgStatus === 'degraded' || all3Status === 'degraded') {
              cmType = 'warning';
              cmLabel = '部分时段重合';
            }
            const asr = asrDisclosure as any;
            const asrDegraded = Array.isArray(asr?.degraded_indicators) ? asr.degraded_indicators : [];
            return (
              <Space direction="vertical" size={10} style={{ width: '100%', marginBottom: 16 }}>
                {cm && (
                  <Alert
                    showIcon
                    type={cmType}
                    message={`画面与声音同步：${cmLabel}`}
                    description={
                      <div>
                        <div>{cm.summary_plain}</div>
                        {stAudit?.summary_plain && (
                          <div style={{ marginTop: 4 }}>{stAudit.summary_plain}</div>
                        )}
                      </div>
                    }
                  />
                )}
                {asr && (
                  <Alert
                    showIcon
                    type={asrDegraded.length > 0 ? 'warning' : 'info'}
                    message="语音转写说明"
                    description={asr.note_plain || asr.summary_plain}
                  />
                )}
              </Space>
            );
          })()}

        {/* 三段式覆盖大数卡片 */}
        <Card className="ax-card" style={{ marginBottom: 20 }}>
          <div style={{ textAlign: 'center', padding: '14px 12px' }}>
            <div
              style={{
                fontSize: 44,
                fontWeight: 700,
                color: 'var(--ax-accent-ink)',
                marginBottom: 6,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {coverage ? coverageHeroNumber(coverage) : '—'}
            </div>
            <div style={{ fontSize: 18, color: 'var(--ax-text-secondary)', marginBottom: 8 }}>
              项可测量指标通过客观审查
            </div>
            {coverage && (
              <>
                {coverage.segments && coverage.segments.length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                      gap: 12,
                      flexWrap: 'wrap',
                      margin: '14px 0 8px',
                    }}
                  >
                    {coverage.segments.map((seg) => (
                      <div
                        key={seg.key}
                        style={{
                          minWidth: 155,
                          maxWidth: 250,
                          textAlign: 'left',
                          padding: '12px 14px',
                          background: 'var(--ax-surface-alt)',
                          border: '1px solid var(--ax-hairline)',
                          borderRadius: 'var(--ax-rounded-md)',
                        }}
                      >
                        <div
                          style={{
                            fontSize: 22,
                            fontWeight: 600,
                            color: 'var(--ax-accent-ink)',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {seg.n}{' '}
                          <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--ax-text-secondary)' }}>
                            项
                          </span>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ax-ink)', marginTop: 2 }}>
                          {seg.label}
                        </div>
                        {seg.n_passed !== null && (
                          <div style={{ fontSize: 13, color: 'var(--ax-text-secondary)' }}>
                            通过 {seg.n_passed} / {seg.n}
                          </div>
                        )}
                        <div
                          style={{
                            fontSize: 12,
                            color: 'var(--ax-text-secondary)',
                            marginTop: 4,
                            lineHeight: 1.5,
                          }}
                        >
                          {seg.note}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {coverageRateText(coverage) && (
                  <div style={{ fontSize: 13, color: 'var(--ax-text-secondary)' }}>
                    {coverageRateText(coverage)}
                  </div>
                )}
                {coverage.explanation && (
                  <p
                    style={{
                      fontSize: 13,
                      color: 'var(--ax-text-secondary)',
                      maxWidth: '52em',
                      margin: '8px auto 0',
                      lineHeight: 1.6,
                    }}
                  >
                    {coverage.explanation}
                  </p>
                )}
                {!(coverage.segments && coverage.segments.length > 0) && (
                  <div style={{ fontSize: 13, color: 'var(--ax-text-secondary)', marginTop: 8 }}>
                    这份旧版报告没带分段覆盖数，仅记录通过项数 {coverage.n_passed} / {coverage.n_slots}{' '}
                    —— 该分母含不可测量项，不能直接当作覆盖率读。
                  </div>
                )}
              </>
            )}
            {coverage?.confidence_cap && (
              <div style={{ color: 'var(--ax-accent-ink)', fontWeight: 600, marginTop: 12 }}>
                全场最高置信度上限：{coverage.confidence_cap}
              </div>
            )}
            <div style={{ color: 'var(--ax-text-secondary)', marginTop: 6, fontSize: 13 }}>
              {report.summary_narrative}
            </div>
          </div>
        </Card>

        {/* 会话数据源实况 */}
        {sources !== null && (
          <Card className="ax-card" size="small" style={{ marginBottom: 20 }}>
            <div style={{ color: 'var(--ax-text-secondary)', fontSize: 13.5 }}>
              <strong style={{ color: 'var(--ax-ink)' }}>本场采录记录：</strong>
              <code className="ax-mono-code">{describedSession ?? '（无 —— 本场没有任何日志）'}</code>
            </div>
            {sources && (
              <ul
                style={{
                  margin: '8px 0 0',
                  paddingLeft: 20,
                  color: 'var(--ax-text-secondary)',
                  fontSize: 13,
                }}
              >
                {Object.entries(sources)
                  .filter(([k]) => k !== 'none_bucket')
                  .map(([k, v]: [string, any]) => {
                    const got = report?.l1?.modality_summary?.[LOG_KEY_TO_MODALITY[k] ?? k];
                    if (v.status !== 'loaded' && got && got.n_measured > 0) {
                      return (
                        <li key={k}>
                          <strong>
                            {MODALITY_LABELS[k] ?? k} · 日志没有数据，但这个模态算出了 {got.n_measured} /{' '}
                            {got.n_total} 条指标
                          </strong>
                          {got.source_note ? `（${got.source_note}）` : ''}
                        </li>
                      );
                    }
                    return (
                      <li key={k}>
                        {MODALITY_LABELS[k] ?? k} · {STATUS_LABELS[v.status] ?? v.status}
                        {v.status === 'loaded' ? `（${v.rows} 行）` : ''}
                      </li>
                    );
                  })}
                {sources.none_bucket && (
                  <li>
                    <em>
                      另有未归属场次日志 {sources.none_bucket.rows} 行（未关联采录场次编号，不进入本场统计）
                    </em>
                  </li>
                )}
              </ul>
            )}
          </Card>
        )}

        {/* 第三层模型裁判：证据核验阶段与宏观行为分段（不可用时退回无监督行为节奏时间轴） */}
        {report.l1?.referee_ml?.available ? (
          <RefereeStagePanel report={report} />
        ) : (
          <BehaviorRegimeTimeline report={report} />
        )}

        {/* 核心双层证据视图 */}
        <ReportViewer report={report} />

        {/* 仪器来源显式披露 */}
        <InstrumentProvenance l1={l1WithInstruments} />
      </div>

      {/* 导师/管理员非打分人工复核注记抽屉 */}
      <Drawer
        title={
          <Space>
            <EditOutlined />
            人工复核注记（承接不确定升级 · 严禁打分）
          </Space>
        }
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        width={480}
      >
        <Space direction="vertical" size={14} style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            message="仅记录复核一致情况、关注核验点与客观追问备忘；服务端已挂红线拦截任何数值打分或心理定性词汇。"
          />
          {reviewError && <Alert type="error" showIcon message={reviewError} />}

          <div>
            <Text strong style={{ fontSize: 13 }}>
              复核核验结论（非能力评价）
            </Text>
            <Select
              aria-label="选择复核状态"
              value={reviewStatusDraft}
              onChange={setReviewStatusDraft}
              disabled={!isAdmin}
              style={{ width: '100%', marginTop: 6 }}
              options={[
                { label: '待人工复核', value: 'pending_review' },
                { label: '复核与证据一致', value: 'verified_consistent' },
                { label: '建议补充采录', value: 'needs_recollect' },
                { label: '已注明采样干扰', value: 'signal_artifact_noted' },
              ]}
            />
          </div>

          <div>
            <Text strong style={{ fontSize: 13 }}>
              重点关注标记（可选多选）
            </Text>
            <Select
              mode="tags"
              aria-label="编辑复核关注标签"
              value={reviewTagsDraft}
              onChange={setReviewTagsDraft}
              disabled={!isAdmin}
              placeholder="例如：核验手势入画率、追问推导前提"
              style={{ width: '100%', marginTop: 6 }}
              options={[
                { label: '核验手势入画率', value: '核验手势入画率' },
                { label: '追问推导前提', value: '追问推导前提' },
                { label: '注意收音底噪', value: '注意收音底噪' },
                { label: '建议补充正面3D视场', value: '建议补充正面3D视场' },
              ]}
            />
          </div>

          <div>
            <Text strong style={{ fontSize: 13 }}>
              客观复核备注（限 1000 字）
            </Text>
            <Input.TextArea
              aria-label="输入人工复核备注"
              rows={5}
              value={reviewTextDraft}
              onChange={(e) => setReviewTextDraft(e.target.value)}
              disabled={!isAdmin}
              placeholder="记录画面遮挡核实、提问窗口对齐核查或后续面谈建议追问的关键环节…"
              style={{ marginTop: 6 }}
            />
          </div>

          {reviewNote?.updated_at && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              最近存档时间：{reviewNote.updated_at}
            </Text>
          )}

          {isAdmin ? (
            <Button type="primary" loading={reviewSaving} onClick={() => void saveReviewNote()}>
              保存人工复核注记
            </Button>
          ) : (
            <Alert
              type="warning"
              showIcon
              message="当前为只读演示状态"
              description={
                <Button
                  size="small"
                  type="link"
                  style={{ paddingLeft: 0 }}
                  onClick={() => navigate('/recordings')}
                >
                  前往「录制素材」或「题库管理」登录管理员后解锁保存 ›
                </Button>
              }
            />
          )}
        </Space>
      </Drawer>
    </Content>
  );
};

export default ReportPage;
