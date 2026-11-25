import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from 'antd';

/**
 * 衡才智析两行式导航 —— 遵循 DESIGN.md 的 `global-nav` + `sub-nav-frosted`。
 * 第 1 行：纯黑 44px 全局导航（全站唯一纯黑面）。
 * 第 2 行：磨砂子导航（米白 80% + backdrop-filter），52px；正在采集页隐藏右侧主 CTA，减少干扰。
 */

interface NavGroup {
  key: string;
  label: string;
  accent: string;
  soft: string;
  border: string;
  prefixes: string[];
  subLinks: Array<{ to: string; label: string }>;
}

const NAV_GROUPS: NavGroup[] = [
  {
    key: '/',
    label: '总门户',
    accent: 'var(--ax-primary)',
    soft: 'var(--ax-info-soft)',
    border: 'var(--ax-info-border)',
    prefixes: ['/'],
    subLinks: [
      { to: '/hub/research', label: '研思循证' },
      { to: '/hub/metacognition', label: '元智审辨' },
      { to: '/hub/followup', label: '时序观微' },
      { to: '/reports', label: '报告中心' },
    ],
  },
  {
    key: '/hub/research',
    label: '研思循证',
    accent: 'var(--ax-b1)',
    soft: 'var(--ax-b1-soft)',
    border: 'var(--ax-b1-border)',
    prefixes: ['/hub/research', '/research', '/interview', '/compare'],
    subLinks: [
      { to: '/hub/research', label: '场景概览' },
      { to: '/research', label: '科研采录' },
      { to: '/interview', label: '模拟答辩' },
      { to: '/compare', label: '多场对比' },
    ],
  },
  {
    key: '/hub/metacognition',
    label: '元智审辨',
    accent: 'var(--ax-b2)',
    soft: 'var(--ax-b2-soft)',
    border: 'var(--ax-b2-border)',
    prefixes: ['/hub/metacognition', '/career-mcp', '/metacognition'],
    subLinks: [
      { to: '/hub/metacognition', label: '场景概览' },
      { to: '/career-mcp', label: '岗位对照' },
      { to: '/metacognition', label: 'AI 审辨实训' },
    ],
  },
  {
    key: '/hub/followup',
    label: '时序观微',
    accent: 'var(--ax-b3)',
    soft: 'var(--ax-b3-soft)',
    border: 'var(--ax-b3-border)',
    prefixes: ['/hub/followup', '/followup'],
    subLinks: [
      { to: '/hub/followup', label: '场景概览' },
      { to: '/followup', label: '匿名随访档案' },
      { to: '/followup/capture', label: '匿名无影像采录' },
    ],
  },
  {
    key: '/reports',
    label: '报告与资源',
    accent: 'var(--ax-primary)',
    soft: 'var(--ax-info-soft)',
    border: 'var(--ax-info-border)',
    prefixes: ['/reports', '/report', '/analysis', '/recordings', '/export', '/question-bank', '/benchmarks'],
    subLinks: [
      { to: '/reports', label: '报告中心' },
      { to: '/analysis', label: '实时监测' },
      { to: '/recordings', label: '录制素材' },
      { to: '/export', label: '数据导出' },
      { to: '/question-bank', label: '题库管理' },
      { to: '/benchmarks', label: '科研基准' },
    ],
  },
];

const isGroupActive = (group: NavGroup, pathname: string): boolean => {
  if (group.key === '/') return pathname === '/';
  return group.prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
};

const activeGroupOf = (pathname: string): NavGroup =>
  NAV_GROUPS.find((g) => isGroupActive(g, pathname)) ?? NAV_GROUPS[0];

const sectionName = (pathname: string): string => {
  if (pathname === '/') return '衡才智析 · 多模态行为证据分析';
  if (pathname === '/hub/research') return '研思循证 · 科研行为过程分析';
  if (pathname === '/hub/metacognition') return '元智审辨 · AI 元能力与职业实训';
  if (pathname === '/hub/followup') return '时序观微 · 匿名个体纵向随访';
  if (pathname.startsWith('/report/')) return '行为证据披露报告';
  if (pathname === '/reports') return '报告中心';
  if (pathname === '/career-mcp') return '岗位能力画像与行为对照';
  if (pathname === '/metacognition') return 'AI 审辨三阶段实训';
  if (pathname === '/followup/capture') return '匿名无影像随访采录';
  if (pathname === '/followup') return '匿名个体随访档案';
  if (pathname === '/compare') return '多场次纵向对比工作台';
  if (pathname === '/research') return '科研过程行为采录';
  if (pathname === '/interview') return '答辩与面试行为采录';
  if (pathname === '/analysis') return '多通道实时监测台';
  if (pathname === '/recordings') return '录制素材管理';
  if (pathname === '/export') return '数据导出与原表复核';
  if (pathname === '/question-bank') return '多模块题库管理';
  if (pathname === '/benchmarks') return '方法学验证与科研基准';
  return '衡才智析';
};

const ACTIVE_CAPTURE_ROUTES = ['/interview', '/research', '/metacognition', '/followup/capture', '/analysis'];

const Header: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const inCapture = ACTIVE_CAPTURE_ROUTES.some((p) => location.pathname.startsWith(p));
  const activeGroup = activeGroupOf(location.pathname);

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
            {NAV_GROUPS.map((group) => {
              const active = isGroupActive(group, location.pathname);
              return (
                <li key={group.key}>
                  <button
                    type="button"
                    onClick={() => navigate(group.key)}
                    aria-current={active ? 'page' : undefined}
                    className="ax-press ax-nav-link"
                    style={{
                      position: 'relative',
                      display: 'inline-flex',
                      alignItems: 'center',
                      background: 'none',
                      border: 'none',
                      borderTop: '2px solid transparent',
                      borderBottom: active ? '2px solid #ffffff' : '2px solid transparent',
                      padding: '10px 2px',
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
                    {group.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      <div
        style={{
          minHeight: 'var(--ax-subnav-height)',
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
            padding: '8px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <span
              className="ax-tagline"
              style={{
                color: 'var(--ax-ink)',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: activeGroup.accent,
                  display: 'inline-block',
                  flexShrink: 0,
                }}
              />
              {sectionName(location.pathname)}
            </span>

            <nav aria-label="场景子导航" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {activeGroup.subLinks.map((sub) => {
                const subActive = location.pathname === sub.to;
                return (
                  <button
                    key={sub.to}
                    type="button"
                    onClick={() => navigate(sub.to)}
                    aria-current={subActive ? 'page' : undefined}
                    className="ax-press"
                    style={{
                      background: subActive ? activeGroup.soft : 'transparent',
                      border: subActive ? `1px solid ${activeGroup.border}` : '1px solid transparent',
                      borderRadius: 'var(--ax-rounded-pill)',
                      padding: '4px 12px',
                      cursor: 'pointer',
                      fontFamily: 'var(--ax-font-text)',
                      fontSize: 12.5,
                      fontWeight: subActive ? 600 : 400,
                      color: subActive ? activeGroup.accent : 'var(--ax-text-secondary)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {sub.label}
                  </button>
                );
              })}
            </nav>
          </div>

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
                onClick={() => navigate('/research')}
                style={{ fontSize: 'var(--ax-caption-size)', paddingInline: 18, height: 32 }}
              >
                开始科研采录
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
