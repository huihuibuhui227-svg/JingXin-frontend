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
      title={`问题 ${currentIndex + 1}/${totalQuestions}`}
      bordered={false}
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

