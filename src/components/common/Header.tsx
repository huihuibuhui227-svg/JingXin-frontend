import React from 'react';
import { Layout, Menu } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { HomeOutlined, VideoCameraOutlined, ExperimentOutlined, BarChartOutlined, FileTextOutlined } from '@ant-design/icons';

const { Header: AntHeader } = Layout;

const Header: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { key: '/', icon: <HomeOutlined />, label: '首页' },
    { key: '/interview', icon: <VideoCameraOutlined />, label: '面试评估' },
    { key: '/research', icon: <ExperimentOutlined />, label: '科研评估' },
    { key: '/analysis', icon: <BarChartOutlined />, label: '实时分析' },
    { key: '/reports', icon: <FileTextOutlined />, label: '报告列表' }
  ];

  return (
    <AntHeader style={{
      background: '#fff',
      padding: '0 24px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      position: 'sticky',
      top: 0,
      zIndex: 1000
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
        <div
          style={{
            fontSize: '20px',
            fontWeight: 'bold',
            color: '#2E86AB',
            cursor: 'pointer'
          }}
          onClick={() => navigate('/')}
        >
          🎯 JingXin 多模态评估系统
        </div>

        <Menu
          mode="horizontal"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ flex: 1, marginLeft: '40px', borderBottom: 'none' }}
        />
      </div>
    </AntHeader>
  );
};

export default Header;
