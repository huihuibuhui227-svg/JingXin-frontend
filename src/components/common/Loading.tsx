import React from 'react';
import { Spin } from 'antd';

interface LoadingProps {
  tip?: string;
  fullScreen?: boolean;
}

const Loading: React.FC<LoadingProps> = ({
  tip = '加载中...',
  fullScreen = false
}) => {
  if (fullScreen) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        flexDirection: 'column'
      }}>
        <Spin size="large" tip={tip} />
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '40px',
      flexDirection: 'column'
    }}>
      <Spin tip={tip} />
    </div>
  );
};

export default Loading;
