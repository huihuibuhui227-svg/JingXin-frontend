import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDesignTheme } from '@/theme/ThemeContext';
import ThemeSwitcher from './ThemeSwitcher';

interface PrimaryNavItem {
  to: string;
  label: string;
  prefixes: string[];
}

interface WorkbenchGroup {
  groupLabel: string;
  items: Array<{ to: string; label: string; desc: string }>;
}

const PRIMARY_NAV_ITEMS: PrimaryNavItem[] = [
  { to: '/', label: '总门户', prefixes: ['/'] },
  {
    to: '/hub/research',
    label: '研思循证',
    prefixes: ['/hub/research', '/research', '/interview', '/compare'],
  },
  {
    to: '/hub/metacognition',
    label: '元智审辨',
    prefixes: ['/hub/metacognition', '/career-mcp', '/metacognition'],
  },
  {
    to: '/hub/followup',
    label: '时序观微',
    prefixes: ['/hub/followup', '/followup'],
  },
  {
    to: '/reports',
    label: '报告中心',
    prefixes: ['/reports', '/report'],
  },
];

const WORKBENCH_GROUPS: WorkbenchGroup[] = [
  {
    groupLabel: '01 · 采录与对比',
    items: [
      { to: '/research', label: '科研采录', desc: '课题组汇报与过程采录' },
      { to: '/interview', label: '答辩采录', desc: '复试答辩与问答行为采样' },
      { to: '/compare', label: '多场对比', desc: '同代次纵向并排对照' },
    ],
  },
  {
    groupLabel: '02 · 实训与随访',
    items: [
      { to: '/career-mcp', label: '岗位对照', desc: '岗位需求与行为线索核查' },
      { to: '/metacognition', label: 'AI 审辨实训', desc: '三阶段口头批判校准' },
      { to: '/followup', label: '随访档案', desc: '匿名个体轨迹档案' },
      { to: '/followup/capture', label: '无影像采录', desc: '零原始影像静默采样' },
    ],
  },
  {
    groupLabel: '03 · 资源与验证',
    items: [
      { to: '/analysis', label: '实时监测', desc: '多通道同步采集监测台' },
      { to: '/recordings', label: '录制素材', desc: '场次录像与可控清理' },
      { to: '/export', label: '数据导出', desc: '结构化指标与原表导出' },
      { to: '/question-bank', label: '题库管理', desc: '多场景问答题目配置' },
      { to: '/benchmarks', label: '科研基准', desc: '跨语料与三维姿态验证' },
    ],
  },
];

const SECONDARY_ROUTES = new Set(
  WORKBENCH_GROUPS.flatMap((group) => group.items.map((item) => item.to))
);

const ACTIVE_CAPTURE_ROUTES = [
  '/interview',
  '/research',
  '/metacognition',
  '/followup/capture',
  '/analysis',
];

const isNavItemActive = (item: PrimaryNavItem, pathname: string): boolean => {
  if (item.to === '/') return pathname === '/';
  return item.prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
};

const Header: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { themeSpec } = useDesignTheme();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuContainerRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);

  const inCapture = ACTIVE_CAPTURE_ROUTES.some((prefix) => location.pathname.startsWith(prefix));
  const inSecondaryTool = SECONDARY_ROUTES.has(location.pathname);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (event: MouseEvent | PointerEvent) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        menuTriggerRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  const menuShadow = themeSpec.isDark
    ? '0 14px 36px rgba(0, 0, 0, 0.72), 0 0 0 1px rgba(255, 255, 255, 0.06)'
    : '0 2px 6px rgba(0, 0, 0, 0.04), 0 16px 32px -6px rgba(0, 0, 0, 0.12)';

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        height: 58,
        background: 'var(--ax-header-bg)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--ax-header-border)',
        color: 'var(--ax-header-ink)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <style>{`
        .jx-header-nav-scroll {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .jx-header-nav-scroll::-webkit-scrollbar {
          display: none;
        }
        .jx-header-link:hover {
          color: var(--ax-header-ink) !important;
        }
        .jx-workbench-item:hover {
          background: var(--ax-surface-alt) !important;
        }
      `}</style>

      <div
        style={{
          width: '100%',
          maxWidth: 'var(--ax-workbench-max)',
          height: '100%',
          padding: '0 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        {/* 左侧：几何品牌标记 + 字标 */}
        <button
          type="button"
          onClick={() => navigate('/')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 9,
            background: 'none',
            border: 'none',
            padding: '4px 2px',
            cursor: 'pointer',
            color: 'var(--ax-header-ink)',
            flexShrink: 0,
          }}
        >
          <svg
            aria-hidden="true"
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            style={{ flexShrink: 0 }}
          >
            <rect
              x="1.5"
              y="1.5"
              width="17"
              height="17"
              rx="3"
              stroke="var(--ax-header-ink)"
              strokeWidth="1.25"
              strokeOpacity="0.28"
            />
            <path d="M10 4.5L15.2 14.2H4.8L10 4.5Z" fill="var(--ax-primary)" />
            <circle cx="10" cy="11.2" r="1.4" fill="var(--ax-on-primary)" />
          </svg>
          <span
            style={{
              fontFamily: 'var(--ax-font-display)',
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              whiteSpace: 'nowrap',
            }}
          >
            衡才智析
          </span>
        </button>

        {/* 中央：主导航链路 + 工作台下拉菜单 */}
        <nav
          aria-label="全局导航"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flex: 1,
            minWidth: 0,
            height: '100%',
            justifyContent: 'center',
          }}
        >
          <ul
            className="jx-header-nav-scroll"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 20,
              listStyle: 'none',
              margin: 0,
              padding: '0 4px',
              height: '100%',
              overflowX: 'auto',
            }}
          >
            {PRIMARY_NAV_ITEMS.map((item) => {
              const active = isNavItemActive(item, location.pathname);
              return (
                <li key={item.to} style={{ height: '100%', display: 'flex', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => navigate(item.to)}
                    aria-current={active ? 'page' : undefined}
                    className="jx-header-link"
                    style={{
                      height: '100%',
                      display: 'inline-flex',
                      alignItems: 'center',
                      background: 'none',
                      border: 'none',
                      borderTop: '2px solid transparent',
                      borderBottom: active ? '2px solid var(--ax-primary)' : '2px solid transparent',
                      padding: '0 2px',
                      cursor: 'pointer',
                      fontFamily: 'var(--ax-font-text)',
                      fontSize: 13.5,
                      fontWeight: active ? 600 : 400,
                      letterSpacing: '-0.01em',
                      color: active ? 'var(--ax-header-ink)' : 'var(--ax-header-muted)',
                      whiteSpace: 'nowrap',
                      transition: 'color 140ms ease, border-color 140ms ease',
                    }}
                  >
                    {item.label}
                  </button>
                </li>
              );
            })}
          </ul>

          <div
            ref={menuContainerRef}
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              flexShrink: 0,
              marginLeft: 6,
            }}
          >
            <button
              ref={menuTriggerRef}
              type="button"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((prev) => !prev)}
              className="jx-header-link"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                height: 30,
                padding: '0 9px',
                borderRadius: 'var(--ax-rounded-sm)',
                background: menuOpen || inSecondaryTool ? 'var(--ax-surface-alt)' : 'transparent',
                border:
                  menuOpen || inSecondaryTool
                    ? '1px solid var(--ax-hairline)'
                    : '1px solid transparent',
                cursor: 'pointer',
                fontFamily: 'var(--ax-font-text)',
                fontSize: 13,
                fontWeight: inSecondaryTool ? 600 : 500,
                color: inSecondaryTool || menuOpen ? 'var(--ax-header-ink)' : 'var(--ax-header-muted)',
                whiteSpace: 'nowrap',
                transition: 'color 140ms ease, background-color 140ms ease, border-color 140ms ease',
              }}
            >
              <span>工作台</span>
              <svg
                aria-hidden="true"
                width="10"
                height="10"
                viewBox="0 0 12 12"
                fill="none"
                style={{
                  transform: menuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 150ms ease',
                }}
              >
                <path
                  d="M2.5 4.5L6 8L9.5 4.5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {menuOpen && (
              <div
                role="menu"
                aria-label="工作台与工具页面"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 10px)',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 560,
                  maxWidth: 'calc(100vw - 24px)',
                  background: 'var(--ax-surface)',
                  border: '1px solid var(--ax-hairline)',
                  borderRadius: 8,
                  boxShadow: menuShadow,
                  padding: 14,
                  zIndex: 1200,
                  color: 'var(--ax-ink)',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: 12,
                }}
              >
                {WORKBENCH_GROUPS.map((group) => (
                  <div key={group.groupLabel} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div
                      style={{
                        fontFamily: 'var(--ax-font-mono)',
                        fontSize: 10.5,
                        color: 'var(--ax-text-secondary)',
                        padding: '2px 8px 6px',
                        borderBottom: '1px solid var(--ax-hairline)',
                        marginBottom: 2,
                      }}
                    >
                      {group.groupLabel}
                    </div>
                    {group.items.map((sub) => {
                      const subActive = location.pathname === sub.to;
                      return (
                        <button
                          key={sub.to}
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setMenuOpen(false);
                            navigate(sub.to);
                          }}
                          className="jx-workbench-item"
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 1,
                            padding: '6px 8px',
                            borderRadius: 6,
                            background: subActive ? 'var(--ax-surface-alt)' : 'transparent',
                            border: subActive
                              ? '1px solid var(--ax-hairline)'
                              : '1px solid transparent',
                            cursor: 'pointer',
                            textAlign: 'left',
                            fontFamily: 'var(--ax-font-text)',
                            transition: 'background-color 120ms ease',
                          }}
                        >
                          <span
                            style={{
                              fontSize: 12.5,
                              fontWeight: subActive ? 600 : 500,
                              color: 'var(--ax-ink)',
                              lineHeight: 1.3,
                            }}
                          >
                            {sub.label}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              color: 'var(--ax-text-secondary)',
                              lineHeight: 1.3,
                            }}
                          >
                            {sub.desc}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        </nav>

        {/* 右侧：主题切境触发器 + 单一克制辅助入口 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <ThemeSwitcher />
          {!inCapture && (
            <button
              type="button"
              onClick={() => navigate('/report/latest')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                height: 32,
                padding: '0 11px',
                borderRadius: 'var(--ax-rounded-sm)',
                background: 'transparent',
                border: '1px solid var(--ax-hairline)',
                color: 'var(--ax-header-ink)',
                fontFamily: 'var(--ax-font-text)',
                fontSize: 12.5,
                fontWeight: 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              最新报告
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
