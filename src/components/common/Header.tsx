import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from 'antd';

/**
 * 衡才智析两行式导航 —— 遵循 DESIGN.md 的 `global-nav` + `sub-nav-frosted`。
 * 第 1 行：纯黑 44px 全局导航（全站唯一纯黑面）。
 * 第 2 行：磨砂子导航（米白 80% + backdrop-filter），52px；正在采集/测评页隐藏右侧主 CTA，减少干扰。
 */

interface NavItem {
  key: string;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: '/', label: '首页' },
  { key: '/interview', label: '面试采集' },
  { key: '/research', label: '科研采集' },
  { key: '/analysis', label: '实时监测' },
  { key: '/reports', label: '报告中心' },
  { key: '/recordings', label: '录制素材' },
  { key: '/export', label: '数据导出' },
  { key: '/question-bank', label: '题库管理' },
];

const sectionName = (pathname: string): string => {
  if (pathname === '/') return '衡才智析 · 系统总览';
  if (pathname.startsWith('/report/')) return '行为证据披露报告';
  const hit = NAV_ITEMS.find((i) => i.key !== '/' && pathname.startsWith(i.key));
  return hit?.label ?? '衡才智析';
};

const ACTIVE_CAPTURE_ROUTES = ['/interview', '/research', '/analysis'];

const Header: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const inCapture = ACTIVE_CAPTURE_ROUTES.some((p) => location.pathname.startsWith(p));

  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 1000 }}>
      <nav
        aria-label="全局导航"
        style={{
          height: 'var(--ax-nav-height)',
          background: 'var(--ax-black)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 'var(--ax-workbench-max)',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 28,
          }}
        >
          <button
            type="button"
            onClick={() => navigate('/')}
            className="ax-press"
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              color: 'var(--ax-on-dark)',
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: '-0.12px',
              fontFamily: 'var(--ax-font-text)',
              whiteSpace: 'nowrap',
            }}
          >
            衡才智析
          </button>

          <ul
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 22,
              listStyle: 'none',
              margin: 0,
              padding: 0,
              flex: 1,
              overflowX: 'auto',
            }}
          >
            {NAV_ITEMS.map((item) => {
              const active =
                item.key === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.key);
              return (
                <li key={item.key}>
                  <button
                    type="button"
                    onClick={() => navigate(item.key)}
                    aria-current={active ? 'page' : undefined}
                    className="ax-press"
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '4px 0',
                      cursor: 'pointer',
                      fontFamily: 'var(--ax-font-text)',
                      fontSize: 'var(--ax-nav-link-size)',
                      fontWeight: active ? 600 : 400,
                      lineHeight: 'var(--ax-nav-link-lh)',
                      letterSpacing: 'var(--ax-nav-link-ls)',
                      color: active ? 'var(--ax-on-dark)' : 'rgba(255,255,255,0.82)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      <div
        style={{
          height: 'var(--ax-subnav-height)',
          background: 'rgba(245, 245, 247, 0.85)',
          backdropFilter: 'saturate(180%) blur(20px)',
          WebkitBackdropFilter: 'saturate(180%) blur(20px)',
          borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 'var(--ax-workbench-max)',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <span
            className="ax-tagline"
            style={{ color: 'var(--ax-ink)', whiteSpace: 'nowrap' }}
          >
            {sectionName(location.pathname)}
          </span>

          {!inCapture && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Button
                className="ax-btn--pill ax-btn--ghost"
                size="small"
                onClick={() => navigate('/report/latest')}
                style={{ fontSize: 'var(--ax-caption-size)', paddingInline: 16, height: 32 }}
              >
                查看最新报告
              </Button>
              <Button
                type="primary"
                className="ax-btn--pill"
                size="small"
                onClick={() => navigate('/interview')}
                style={{ fontSize: 'var(--ax-caption-size)', paddingInline: 18, height: 32 }}
              >
                开始采集
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
