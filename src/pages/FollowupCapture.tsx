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
          ? `非医疗科研随访档案 ${subjectCode} · 当前默认采用「仅匿名特征」挡位，原始图像与原声零落盘，仅记录匿名三维姿态与声学标量。`
          : '非医疗科研随访模式 · 当前默认采用「仅匿名特征」挡位，原始图像与原声零落盘，仅记录匿名三维姿态与声学标量。'
      }
    />
  );
};

export default FollowupCapture;
