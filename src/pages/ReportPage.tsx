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
// (n_passed / n_slots / confidence_cap,spec §5.4/§5.6)。前端手写的 `EvaluationResult`
// 里**没有这个字段** —— 那个类型文件工作树里有使用者未提交的改动,不混进本提交,
// 所以在这里就地声明并断言。
type ReportExtras = {
  coverage?: { n_passed: number; n_slots: number; confidence_cap?: string };
};

const { Content } = Layout;

// 后端 `/api/report/structured` 的 `sources` 是三态:loaded / unreadable / missing
const MODALITY_LABELS: Record<string, string> = {
  face: '面部', gesture: '手势', voice_interview: '语音（面试）', voice_research: '语音（科研）',
};
const STATUS_LABELS: Record<string, string> = {
  loaded: '已读入', unreadable: '未读到数据', missing: '缺失',
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
  const coverage = (report as (EvaluationResult & ReportExtras) | null)?.coverage;

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

  return (
    <Content style={{ padding: '24px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button onClick={() => navigate('/reports')}>← 返回列表</Button>
          <h2 style={{ margin: 0 }}>评估报告</h2>
          <DownloadButton />
        </div>

        {/* spec §5.4/§5.6:本系统**不产出对候选人的评分与评级** —— 未标定标尺上的复合点分
            与五档评语一律不渲染(HTML 报告早已如此,这里跟上:同一份载荷的
            `summary_narrative` 本来就写着「未产出综合评分,也不给评级」,而页面却把
            `30.8` + 「待提升」印成「综合评分」,自相矛盾)。
            呈现的是**覆盖事实 + 依据**,聚合只给区间与置信度上限。 */}
        <Card style={{ marginBottom: '24px' }}>
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <div style={{ fontSize: '48px', fontWeight: 'bold', color: '#2E86AB', marginBottom: '8px' }}>
              {coverage ? `${coverage.n_passed} / ${coverage.n_slots}` : '—'}
            </div>
            <div style={{ fontSize: '20px', color: '#666', marginBottom: '8px' }}>
              个指标槽通过证据门
            </div>
            {coverage?.confidence_cap && (
              <div style={{ color: '#2E86AB', fontWeight: 'bold' }}>
                置信度上限：{coverage.confidence_cap}
              </div>
            )}
            <div style={{ color: '#999', marginTop: '8px' }}>
              评估时间: {new Date(report.model_metadata.timestamp).toLocaleString('zh-CN')}
            </div>
          </div>
        </Card>

        {report.summary_narrative && (
          <Card style={{ marginBottom: '24px' }}>
            <h3 style={{ marginTop: 0 }}>📝 综合总结</h3>
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
          <div style={{ color: '#666' }}>
            <strong>本场会话：</strong>
            <code>{describedSession ?? '（无 —— 本场没有任何日志）'}</code>
          </div>
          {sources && (
            <ul style={{ margin: '8px 0 0', paddingLeft: '20px', color: '#666', fontSize: '13px' }}>
              {Object.entries(sources)
                .filter(([k]) => k !== 'none_bucket')
                .map(([k, v]: [string, any]) => (
                  <li key={k}>
                    {MODALITY_LABELS[k] ?? k} · {STATUS_LABELS[v.status] ?? v.status}
                    {v.status === 'loaded' ? `（${v.rows} 行）` : ''}
                  </li>
                ))}
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
