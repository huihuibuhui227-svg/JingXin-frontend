import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from 'antd';

/**
 * 两行式导航 —— 按 DESIGN.md 的 `global-nav` + `sub-nav-frosted` 实现。
 *
 * 第 1 行：黑底 44px 全局导航，12px 链接，纯黑是全站唯一用纯黑的地方。
 * 第 2 行：磨砂子导航，米白 80% + backdrop-filter，52px，
 *         左侧是当前板块名（21px / 600），右侧是常驻主 CTA。
 *
 * 此前是一个白色 56px 单行导航 + 16px logo。规范里的导航要"几乎隐形"，
 * 让内容说话 —— 所以这里去掉所有描边和阴影，只靠面色与模糊分层。
 */

interface NavItem {
  key: string;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: '/', label: '首页' },
  { key: '/interview', label: '面试评估' },
  { key: '/research', label: '科研评估' },
  { key: '/analysis', label: '实时分析' },
  { key: '/reports', label: '报告列表' },
  { key: '/recordings', label: '录制素材' }
];

/** 子导航左侧显示的板块名 —— 取当前路由对应的标签。 */
const sectionName = (pathname: string): string => {
  if (pathname === '/') return '概览';
  if (pathname.startsWith('/report')) return '评估报告';
  const hit = NAV_ITEMS.find((i) => i.key !== '/' && pathname.startsWith(i.key));
  return hit?.label ?? 'JingXin';
};

const Header: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 1000 }}>
      {/* ── 第 1 行：全局导航 ───────────────────────────────── */}
      <nav
        aria-label="全局导航"
        style={{
          height: 'var(--ax-nav-height)',
          background: 'var(--ax-black)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 'var(--ax-content-max)',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 28
          }}
        >
          {/* 字标：规范里导航是 12px，但品牌名给一档视觉权重，用 14px/600 */}
          <button
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
              whiteSpace: 'nowrap'
            }}
          >
            JingXin
          </button>

          <ul
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 24,
              listStyle: 'none',
              margin: 0,
              padding: 0,
              flex: 1
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
                    onClick={() => navigate(item.key)}
                    aria-current={active ? 'page' : undefined}
                    className="ax-press"
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      fontFamily: 'var(--ax-font-text)',
                      // 规范：nav-link 12px / 400 / -0.12px
                      fontSize: 'var(--ax-nav-link-size)',
                      fontWeight: 400,
                      lineHeight: 'var(--ax-nav-link-lh)',
                      letterSpacing: 'var(--ax-nav-link-ls)',
                      // 当前项用纯白，其余降到 80% —— 只用亮度区分，不加色块
                      color: active ? 'var(--ax-on-dark)' : 'rgba(255,255,255,0.8)',
                      whiteSpace: 'nowrap'
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

      {/* ── 第 2 行：磨砂子导航 ─────────────────────────────── */}
      <div
        style={{
          height: 'var(--ax-subnav-height)',
          // 米白 80% + 模糊 —— 规范里这是"浮在内容之上"的功能性毛玻璃
          background: 'rgba(245, 245, 247, 0.8)',
          backdropFilter: 'saturate(180%) blur(20px)',
          WebkitBackdropFilter: 'saturate(180%) blur(20px)',
          borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 'var(--ax-content-max)',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16
          }}
        >
          {/* 板块名：tagline 21px / 600 */}
          <span
            className="ax-tagline"
            style={{ color: 'var(--ax-ink)', whiteSpace: 'nowrap' }}
          >
            {sectionName(location.pathname)}
          </span>

          {/* 常驻主 CTA */}
          <Button
            type="primary"
            className="ax-btn--pill"
            size="small"
            onClick={() => navigate('/interview')}
            style={{ fontSize: 'var(--ax-caption-size)', paddingInline: 18, height: 32 }}
          >
            开始评估
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
