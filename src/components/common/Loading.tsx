import React from 'react';
import { Spin } from 'antd';

interface LoadingProps {
  tip?: string;
  fullScreen?: boolean;
}

/**
 * 统一加载指示器 —— 不在独立 <Spin> 上使用 tip 属性，彻底消除 antd 5 控制台警告。
 */
const Loading: React.FC<LoadingProps> = ({
  tip = '加载中…',
  fullScreen = false
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: fullScreen ? '60vh' : 140,
        padding: fullScreen ? '48px 24px' : '32px 16px',
        flexDirection: 'column',
        gap: 12
      }}
    >
      <Spin size={fullScreen ? 'large' : 'default'} />
      {tip && (
        <span
          style={{
            fontSize: 'var(--ax-caption-size)',
            color: 'var(--ax-text-secondary)'
          }}
        >
          {tip}
        </span>
      )}
    </div>
  );
};

export default Loading;
