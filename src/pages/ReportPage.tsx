import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout, Card, Button, Result } from 'antd';
import ReportViewer from '@/components/report/ReportViewer';
import DownloadButton from '@/components/report/DownloadButton';
import Loading from '@/components/common/Loading';
import { useAssessmentStore } from '@/store/assessmentStore';
import { dashboardApi } from '@/services/api';
import { EvaluationResult } from '@/types/assessment';

// 后端 `/api/report/structured` 的 `result.coverage` 是「本次观测覆盖」的权威呈现
// (n_passed / n_slots / confidence_cap / passed_slots,spec §5.4/§5.6)。
//
// ⚠️ 2026-10-03 收掉此前的就地声明:当时 `EvaluationResult` 里没有 `coverage`
// (那个类型文件工作树里有使用者未提交的改动,不混进当时的提交),
// 所以在这里 `as EvaluationResult & ReportExtras` 临时断言。现在前端仓干净、
// `coverage` 已按真实载荷写进 `types/assessment.ts` ⟹ 直接用它,不再断言。

const { Content } = Layout;

// 后端 `/api/report/structured` 的 `sources` 是三态:loaded / unreadable / missing
const MODALITY_LABELS: Record<string, string> = {
  face: '面部', gesture: '手势', voice_interview: '语音（面试）', voice_research: '语音（科研）',
};
const STATUS_LABELS: Record<string, string> = {
  loaded: '已读入', unreadable: '未读到数据', missing: '缺失',
};

/** 日志键 → L1 的族模态名(后端 `l1_quality.FAMILY_MODALITY` 用后者)。
 *  两者不同名:日志按「面试 / 科研」分文件,而 V 族不分 —— 同一套指标。 */
const LOG_KEY_TO_MODALITY: Record<string, string> = {
  voice_interview: 'voice', voice_research: 'voice',
};

const ReportPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { evaluationResult: storeResult } = useAssessmentStore();

  const [report, setReport] = useState<EvaluationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // M2.1(第 18 条):这份报告描述的是哪一场、每个模态进来了没有
  const [describedSession, setDescribedSession] = useState<string | null>(null);
  const [sources, setSources] = useState<Record<string, any> | null>(null);
  // 报告头：这一场是谁的、什么时候测的。与 HTML 报告头同一块（2026-10-26）——
  // 此前页面只有会话号，同一批报告在列表里、在页面上都分不出谁是谁。
  const [subject, setSubject] = useState<Record<string, string> | null>(null);
  const [headerTimes, setHeaderTimes] = useState<{
    tested_at?: string | null;
    generated_at?: string | null;
  } | null>(null);

  useEffect(() => {
    if (storeResult) {
      setReport(storeResult);
      return;
    }

    setLoading(true);
    // 读报告要指明**哪一场** —— 路由给了就用路由的,否则用当前会话;
    // 都没有才让后端取最新一场(报告头会写明是它)。
    dashboardApi.getStructuredReport(id)
      .then(data => {
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
      .catch(err => {
        console.error('获取报告失败:', err);
        setError('获取报告失败，请确保已完成后端评估流程');
      })
      .finally(() => setLoading(false));
  }, [id]);

  // 「本次观测覆盖」:本系统不产出对候选人的评分,只报**过了几个门**。
  const coverage = report?.coverage;

  if (loading) {
    return <Loading fullScreen tip="正在加载报告..." />;
  }

  if (error) {
    return (
      <Content style={{ padding: '40px' }}>
        <Result
          status="warning"
          title="暂无报告数据"
          subTitle={error}
          extra={[
            <Button key="back" onClick={() => navigate(-1)}>返回</Button>,
            <Button key="home" type="primary" onClick={() => navigate('/')}>返回首页</Button>,
          ]}
        />
      </Content>
    );
  }

  if (!report) {
    return (
      <Content style={{ padding: '40px' }}>
        <Result
          status="info"
          title="暂无评估报告"
          subTitle="请先完成一次面试或科研评估"
          extra={
            <Button type="primary" onClick={() => navigate('/')}>开始评估</Button>
          }
        />
      </Content>
    );
  }

  // 只印真有的字段：空字段整段不出现（不留孤零零的「院系」）。
  const subjectPairs: Array<[string, string]> = subject
    ? ([['被测者', subject.name], ['学号', subject.student_id],
        ['院系', subject.department], ['场次', subject.serial]] as Array<[string, string | undefined]>)
        .filter(([, v]) => !!v)
        .map(([k, v]) => [k, v as string])
    : [];

  return (
    <Content style={{ padding: '24px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button onClick={() => navigate('/reports')}>← 返回列表</Button>
          <h1 style={{ margin: 0, fontSize: "var(--ax-display-md-size)", fontWeight: 600 }}>评估报告</h1>
          <DownloadButton />
        </div>

        {/* 报告头：这一场是谁的、什么时候测的。与 HTML 报告头同一块（2026-10-26）——
            此前这里只有会话号，同一批报告在列表里、在页面上都分不出谁是谁。
            服务端没回 subject（老会话/短路走 store）时整块不渲染，不编。 */}
        {subject !== null && (
          <Card size="small" style={{ marginBottom: '24px' }} data-testid="report-subject">
            {subjectPairs.length === 0 ? (
              <div style={{ color: 'var(--ax-text-secondary)' }}>
                被测者：<strong>未标注</strong>（录制时没有填写姓名 / 学号 / 院系 —— 这份报告没法按人对号）
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '4px 18px' }}>
                {subjectPairs.map(([k, v]) => (
                  <span key={k} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ color: 'var(--ax-text-secondary)', fontSize: 13 }}>{k}</span>
                    <strong>{v}</strong>
                  </span>
                ))}
              </div>
            )}
            {(headerTimes?.tested_at || headerTimes?.generated_at) && (
              <div style={{ color: 'var(--ax-text-secondary)', fontSize: 13, marginTop: 8 }}>
                {headerTimes?.tested_at && <>测试时间 {headerTimes.tested_at}</>}
                {headerTimes?.tested_at && headerTimes?.generated_at && ' · '}
                {headerTimes?.generated_at && <>报告生成时间 {headerTimes.generated_at}</>}
              </div>
            )}
          </Card>
        )}

        {/* spec §5.4/§5.6:本系统**不产出对候选人的评分与评级** —— 未标定标尺上的复合点分
            与五档评语一律不渲染(HTML 报告早已如此,这里跟上:同一份载荷的
            `summary_narrative` 本来就写着「未产出综合评分,也不给评级」,而页面却把
            `30.8` + 「待提升」印成「综合评分」,自相矛盾)。
            呈现的是**覆盖事实 + 依据**,聚合只给区间与置信度上限。 */}
        <Card style={{ marginBottom: '24px' }}>
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <div style={{ fontSize: '48px', fontWeight: 'bold', color: 'var(--ax-primary)', marginBottom: '8px' }}>
              {coverage ? `${coverage.n_passed} / ${coverage.n_slots}` : '—'}
            </div>
            <div style={{ fontSize: '20px', color: 'var(--ax-text-secondary)', marginBottom: '8px' }}>
              个指标槽通过证据门
            </div>
            {coverage?.confidence_cap && (
              <div style={{ color: 'var(--ax-primary)', fontWeight: 'bold' }}>
                置信度上限：{coverage.confidence_cap}
              </div>
            )}
            <div style={{ color: 'var(--ax-text-secondary)', marginTop: '8px' }}>
              评估时间: {new Date(report.model_metadata.timestamp).toLocaleString('zh-CN')}
            </div>
          </div>
        </Card>

        {report.summary_narrative && (
          <Card style={{ marginBottom: '24px' }}>
            <h2 style={{ marginTop: 0 }}>综合总结</h2>
            <p style={{ margin: 0 }}>{report.summary_narrative}</p>
          </Card>
        )}

        {/* M2.1(第 18 条):spec D2 的"写明是哪一场"此前只落在 HTML 报告里,前端这条路上没有。
            ⚠️ 只在**服务端真的回答了来源**时渲染(`sources !== null`)。上面那条
            "store 有结果就不问服务端"的短路走下来时,`sources` 与 `describedSession` 都是
            `null` —— 那时渲染它就会印出「（无 —— 本场没有任何日志）**,而报告明明就在屏上。
            不知道就什么都不说,不编。 */}
        {sources !== null && (
        <Card size="small" style={{ marginBottom: '24px' }}>
          <div style={{ color: 'var(--ax-text-secondary)' }}>
            <strong>本场会话：</strong>
            <code>{describedSession ?? '（无 —— 本场没有任何日志）'}</code>
          </div>
          {sources && (
            <ul style={{ margin: '8px 0 0', paddingLeft: '20px', color: 'var(--ax-text-secondary)', fontSize: '13px' }}>
              {Object.entries(sources)
                .filter(([k]) => k !== 'none_bucket')
                .map(([k, v]: [string, any]) => {
                  /* ⚠️ 三态**只描述日志文件**。语音还有第二个数据源(整场录音重算),
                     日志 0 行时 V 族照样可能算出 10 条 —— 那时印「未读到数据」会与
                     同一份载荷里的指标明细打架(2026-10-25 实测)。
                     条数由载荷给(`modality_summary`),前端不自己数。 */
                  const got = report?.l1?.modality_summary?.[LOG_KEY_TO_MODALITY[k] ?? k];
                  if (v.status !== 'loaded' && got && got.n_measured > 0) {
                    return (
                      <li key={k}>
                        <strong>{MODALITY_LABELS[k] ?? k} · 日志没有数据，但这个模态算出了{' '}
                        {got.n_measured} / {got.n_total} 条指标</strong>
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
                  <em>另有 NONE 桶 {sources.none_bucket.rows} 行 —— 那些请求没带 session_id，不属于本场</em>
                </li>
              )}
            </ul>
          )}
        </Card>
        )}

        <ReportViewer report={report} />
      </div>
    </Content>
  );
};

export default ReportPage;
