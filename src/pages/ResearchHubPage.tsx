import React from 'react';
import { ExperimentOutlined, SwapOutlined, VideoCameraOutlined } from '@ant-design/icons';
import BaseHubTemplate from '@/components/common/BaseHubTemplate';

const ResearchHubPage: React.FC = () => (
  <BaseHubTemplate
    profileId="research_interview"
    themeKey="b1"
    title="研思循证 · 科研行为过程分析"
    englishTag="Research Process Evidence"
    weightLabel="核心科研场景"
    subtitle="面向课题组汇报、复试答辩与科研表达训练的过程性多模态行为证据中心，按答题窗口同步记录声学节律、面部动作与上肢稳定性，支持多场次同口径纵向对比。"
    workflows={[
      {
        to: '/research',
        title: '科研过程采录',
        desc: '围绕课题进展与研究设计逐题作答，同步记录作答窗口、语音节律与多模态行为证据。',
        action: '开始科研采录',
        icon: <ExperimentOutlined />,
      },
      {
        to: '/interview',
        title: '答辩与面试采录',
        desc: '面向结构化问答与复试模拟场景的多模态采录流程，自动归档为可读证据报告。',
        action: '开始面试采录',
        icon: <VideoCameraOutlined />,
      },
      {
        to: '/compare',
        title: '多场纵向对比',
        desc: '并排对比同一参与者多次汇报场次的变化情况，自动隔离不同采录口径并保留缺口。',
        action: '进入多场对比',
        icon: <SwapOutlined />,
      },
    ]}
    fallbackFoundation={{
      framework: '社会信号处理与过程性表现循证框架（Social Signal Processing & Process Evidence）',
      core_principle:
        '仅报告在真实作答时间窗内采得的行为指标与样本覆盖情况，明确披露每一项未测得原因，绝不产出综合评分或主观能力结论。',
      key_constructs: ['回答响应时延', '语速与停顿节律', '面部动作几何变化', '上肢姿态稳定性'],
      references: [
        'Vinciarelli et al. (2009), Social Signal Processing: Survey of an Emerging Domain, Image and Vision Computing',
        'Muralidhar et al. (2016), Behavioral Analysis of Structured Interviews, ACM ICMI',
        'Vovk et al. (2005), Algorithmic Learning in a Random World (Conformal Uncertainty)',
      ],
    }}
    fallbackCompliance="复用多模态客观行为指标与保形核验门控，绝不出具总分、划档或主观品格推断。"
    fallbackBlocked={[
      {
        key: 'overall_score',
        label: '综合能力总分与等级划分',
        reason: '过程性采录不构成标准化常模测验，禁止输出总分或排序标签。',
      },
      {
        key: 'affect_diagnosis',
        label: '情绪或心理状态定性结论',
        reason: '声学与几何行为信号不等同于内在心理或临床诊断。',
      },
    ]}
  />
);

export default ResearchHubPage;
