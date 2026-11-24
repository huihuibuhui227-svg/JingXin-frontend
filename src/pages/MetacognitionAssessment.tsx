import React from 'react';
import { useLocation } from 'react-router-dom';
import AssessmentPage, { AssessmentTaskBanner } from '@/components/assessment/AssessmentPage';

const MetacognitionAssessment: React.FC = () => {
  const location = useLocation();
  const state = (location.state as { taskBanner?: AssessmentTaskBanner } | null) ?? null;

  return (
    <AssessmentPage
      assessmentType="metacognition"
      reportSceneProfile="ai_metacognition"
      initialTaskBanner={state?.taskBanner ?? null}
      complianceBanner="AI 元能力实训场景档案已激活：系统聚焦「阅读 AI 回答 → 审辨找错 → 阐述修正」过程证据提取与规则化质疑标记，不出具任何数值总分或筛选结论。"
    />
  );
};

export default MetacognitionAssessment;
