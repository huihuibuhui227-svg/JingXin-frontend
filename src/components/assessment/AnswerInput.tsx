import React, { useState } from 'react';
import { Card, Input, Button, Space, message } from 'antd';
import { AudioOutlined, SendOutlined, LoadingOutlined } from '@ant-design/icons';

const { TextArea } = Input;

interface AnswerInputProps {
  onSubmit: (answer: string, audioFile?: File) => void;
  // 只有接了 ASR 的页面才传;没传就不渲染录音按钮(见下方),不编一个假的识别函数
  onSpeechToText?: (audioBlob: Blob) => Promise<string>;
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => Blob | null;
  disabled?: boolean;
}

const AnswerInput: React.FC<AnswerInputProps> = ({
  onSubmit,
  onSpeechToText,
  isRecording,
  onStartRecording,
  onStopRecording,
  disabled = false
}) => {
  const [answer, setAnswer] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = () => {
    if (answer.trim()) {
      onSubmit(answer);
      setAnswer('');
    }
  };

  const handleStopRecording = async () => {
    // 没有 onSpeechToText 时录音按钮根本不渲染,这里只是把类型收口
    if (!onSpeechToText) return;

    const audioBlob = onStopRecording();

    if (!audioBlob) {
      message.error('录音失败，请重试');
      return;
    }

    setIsProcessing(true);
    message.loading({ content: '正在识别语音...', key: 'asr', duration: 0 });

    try {
      const recognizedText = await onSpeechToText(audioBlob);

      if (recognizedText) {
        setAnswer(prev => prev + recognizedText);
        message.success({ content: '语音识别成功！', key: 'asr' });
      } else {
        message.warning({ content: '未识别到内容，请重试', key: 'asr' });
      }
    } catch (error) {
      console.error('语音识别失败:', error);
      message.error({ content: '语音识别失败，请重试', key: 'asr' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card
      title="回答区域"
      bordered={false}
      style={{ borderRadius: '8px' }}
    >
      <TextArea
        rows={6}
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder={onSpeechToText
          ? '请输入您的回答，或点击"语音回答"按钮说话...'
          : '请输入您的回答...'}
        disabled={disabled || isProcessing}
        style={{ marginBottom: '16px', fontSize: '16px' }}
      />

      <Space>
        {/* 没接 ASR 的页面(如科研评估)不该出现一个按下去必然失败的录音按钮 */}
        {onSpeechToText && (
        <Button
          type={isRecording ? 'primary' : 'default'}
          danger={isRecording}
          icon={isRecording ? <LoadingOutlined spin /> : <AudioOutlined />}
          onClick={isRecording ? handleStopRecording : onStartRecording}
          disabled={disabled || isProcessing}
          loading={isProcessing && isRecording}
        >
          {isRecording ? '停止录音' : '语音回答'}
        </Button>
        )}

        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={handleSubmit}
          disabled={!answer.trim() || disabled || isProcessing}
        >
          提交回答
        </Button>
      </Space>

      {isProcessing && (
        <div style={{ marginTop: '12px', color: '#999', fontSize: '12px' }}>
          <LoadingOutlined /> 正在处理语音...
        </div>
      )}
    </Card>
  );
};

export default AnswerInput;

