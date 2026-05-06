import React from 'react';
import { Layout } from 'antd';

const { Footer: AntFooter } = Layout;

const Footer: React.FC = () => {
  return (
    <AntFooter style={{ textAlign: 'center', background: '#f0f2f5' }}>
      <div>JingXin 多模态面试评估系统 ©2026</div>
      <div style={{ marginTop: '8px', color: '#999' }}>
        AI驱动的智能面试与科研能力评估平台
      </div>
    </AntFooter>
  );
};

export default Footer;
