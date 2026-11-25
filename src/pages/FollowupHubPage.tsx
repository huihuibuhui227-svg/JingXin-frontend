import React from 'react';
import { LineChartOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import BaseHubTemplate from '@/components/common/BaseHubTemplate';

const FollowupHubPage: React.FC = () => (
  <BaseHubTemplate
    profileId="longitudinal_followup"
    themeKey="b3"
    title="时序观微 · 匿名个体纵向随访"
    englishTag="Idiographic Longitudinal"
    weightLabel="匿名纵向研究 · 非医疗"
    subtitle="以匿名随访编号与本人首访基线为自我参照，在零原始影像与零原声落盘隐私保护模式下，持续追踪个人多次采录的客观表达节律与姿态变化轨迹。"
    workflows={[
      {
        to: '/followup',
        title: '匿名随访档案与轨迹',
        desc: '创建匿名受试编号并关联多期随访场次，查看个人首访基线、稳健参考区间与平滑趋势轨迹。',
        action: '查看随访档案',
        icon: <LineChartOutlined />,
      },
      {
        to: '/followup/capture',
        title: '匿名无影像随访采录',
        desc: '默认开启最高隐私保护模式，仅在内存计算三维姿态与声学标量指标，原始画面与录音零落盘。',
        action: '发起匿名采录',
        icon: <SafetyCertificateOutlined />,
      },
    ]}
    fallbackFoundation={{
      framework: '个体特异纵向科学范式与稳健趋势监控（Idiographic N-of-1 & Robust EWMA Control）',
      core_principle:
        '以个体首次有效记录作为自我参照基线，结合中位绝对偏差、四分位参考带与指数平滑趋势识别阶段性变化，严格禁止跨个体横向比较。',
      key_constructs: ['个人首访基线偏移', '四分位稳健参考带', '平滑趋势估计', '采录口径代次隔离'],
      references: [
        'Molenaar (2004), A Manifesto on Psychology as Idiographic Science, Measurement',
        'Montgomery (2020), Introduction to Statistical Quality Control (EWMA Monitoring)',
        'Leys et al. (2013), Detecting Outliers: Robust Scale Estimators around the Median, JESP',
      ],
    }}
    fallbackCompliance="非医疗科研观测模块 · 严格禁止跨人对照、能力评定及任何健康或临床状态推断。"
    fallbackBlocked={[
      {
        key: 'cross_person_norm',
        label: '跨个体常模对比与百分位排名',
        reason: '不同个体的基线特征不可直接横向相减或排序。',
      },
      {
        key: 'clinical_inference',
        label: '心理或临床健康状态推断',
        reason: '本系统不具备医疗器械属性，严禁输出任何临床或健康定性结论。',
      },
    ]}
  />
);

export default FollowupHubPage;
