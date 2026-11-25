import React from 'react';
import { CompassOutlined, FileTextOutlined, RobotOutlined } from '@ant-design/icons';
import BaseHubTemplate from '@/components/common/BaseHubTemplate';

const MetacognitionHubPage: React.FC = () => (
  <BaseHubTemplate
    profileId="ai_metacognition"
    themeKey="b2"
    title="元智审辨 · AI 元能力与职业实训"
    englishTag="AI Metacognition & Career"
    weightLabel="AI 审辨与求职实训"
    subtitle="面向求职面试准备与人机协同科研训练，将岗位职责拆解为可观测行为线索，并联动「阅读 AI 回答 → 指出漏洞 → 口头修正」三阶段审辨实训。"
    workflows={[
      {
        to: '/career-mcp',
        title: '岗位能力画像对照',
        desc: '浏览校招与科研助理岗位要求，或粘贴自定义岗位说明，核查已有采录的行为证据覆盖与缺口。',
        action: '进入岗位对照',
        icon: <CompassOutlined />,
      },
      {
        to: '/metacognition',
        title: 'AI 审辨三阶段实训',
        desc: '针对生成式 AI 给出的分析回答开展漏洞识别、假设核验与口头修正演练，自动追踪三环调控覆盖。',
        action: '进入审辨实训',
        icon: <RobotOutlined />,
      },
      {
        to: '/reports',
        title: '实训证据报告查看',
        desc: '打开历史行为证据披露报告并切换「元智审辨」视角，阅读人机审辨过程总结与追问提纲。',
        action: '查看报告中心',
        icon: <FileTextOutlined />,
      },
    ]}
    fallbackFoundation={{
      framework: '自我调节学习与生成式 AI 元认知校准框架（Self-Regulated Learning & AI Metacognition）',
      core_principle:
        '围绕计划监控、核验判断与反思修正三环调控过程，客观统计审辨文本中的质疑边界标记、信息核验依据及多环节调控覆盖度。',
      key_constructs: ['质疑边界标记密度', '信息核验标记密度', '三环调控覆盖度', '结构化修正表达'],
      references: [
        'Zimmerman (2000), Attaining Self-Regulation: A Social Cognitive Perspective, Handbook of Self-Regulation',
        'Tankelevitch et al. (2024), The Metacognitive Demands and Opportunities of Generative AI, ACM CHI',
        'Schraw & Dennison (1994), Assessing Metacognitive Awareness, Contemporary Educational Psychology',
      ],
    }}
    fallbackCompliance="仅核查岗位行为证据覆盖情况与待补录缺口，不出具岗位匹配分数、排名或筛选建议。"
    fallbackBlocked={[
      {
        key: 'job_fit_score',
        label: '岗位契合度打分与筛选结论',
        reason: '实训对比旨在定位表达与审辨证据缺口，不构成人岗筛选决策。',
      },
      {
        key: 'hard_skill_exam',
        label: '闭卷编码与专业硬技能替代评价',
        reason: '口头表达过程观测不可替代实际代码实现与专业工程考核。',
      },
    ]}
  />
);

export default MetacognitionHubPage;
