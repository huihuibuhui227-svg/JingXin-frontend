import React from 'react';
import { useSearchParams } from 'react-router-dom';
import AssessmentPage from '@/components/assessment/AssessmentPage';

const FollowupCapture: React.FC = () => {
  const [params] = useSearchParams();
  const subjectCode = params.get('subject');

  return (
    <AssessmentPage
      assessmentType="followup"
      defaultPrivacyMode="anonymous_kinematics_only"
      reportSceneProfile="longitudinal_followup"
      complianceBanner={
        subjectCode
          ? `非医疗科研随访档案 ${subjectCode} · 当前默认仅保存匿名特征（不保存原始画面与录音）。`
          : '非医疗科研随访模式 · 当前默认仅保存匿名特征（不保存原始画面与录音）。'
      }
    />
  );
};

export default FollowupCapture;
