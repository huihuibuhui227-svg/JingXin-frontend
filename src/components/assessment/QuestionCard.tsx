import React from 'react';
import { Card, Button } from 'antd';
import { SoundOutlined } from '@ant-design/icons';

interface QuestionCardProps {
  question: string;
  currentIndex: number;
  totalQuestions: number;
  onPlayAudio?: () => void;
}

const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  currentIndex,
  totalQuestions,
  onPlayAudio
}) => {
  return (
    <Card
      // ⚠️ 分母由服务端给(`/interview/start` 的 total_questions)。拿不到(0)时
      //    **不显示分母**,而不是编一个 —— 此前这里是写死的 10,而题库只有 8 题。
      title={totalQuestions > 0
        ? `问题 ${currentIndex + 1}/${totalQuestions}`
        : `问题 ${currentIndex + 1}`}
      variant="borderless"
      style={{ borderRadius: '8px' }}
    >
      <div style={{ fontSize: '18px', lineHeight: '1.8', marginBottom: '20px' }}>
        {question}
      </div>

      {onPlayAudio && (
        <Button
          type="primary"
          icon={<SoundOutlined />}
          onClick={onPlayAudio}
        >
          播放问题
        </Button>
      )}
    </Card>
  );
};

export default QuestionCard;

