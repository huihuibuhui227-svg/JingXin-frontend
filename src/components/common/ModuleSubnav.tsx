import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export interface SubnavItem {
  to: string;
  label: string;
}

interface ModuleSubnavProps {
  world: 'linear' | 'claude' | 'oura';
  moduleTitle: string;
  items: SubnavItem[];
  rightSlot?: React.ReactNode;
}

/**
 * 模块内轻量子导航条 —— 替代原有占位的 52px 全局双行顶栏，
 * 根据 Linear / Claude / Oura 各自原生美学渲染克制的横条切换。
 */
const ModuleSubnav: React.FC<ModuleSubnavProps> = ({ world, moduleTitle, items, rightSlot }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const barStyle: React.CSSProperties =
    world === 'linear'
      ? {
          borderBottom: '1px solid var(--ax-hairline)',
          background: 'rgba(15, 16, 17, 0.72)',
        }
      : world === 'claude'
        ? {
            borderBottom: '1px solid var(--ax-hairline)',
            background: 'rgba(250, 249, 245, 0.85)',
          }
        : {
            borderBottom: '1px solid var(--ax-hairline)',
            background: 'rgba(247, 241, 232, 0.9)',
          };

  return (
    <nav aria-label={`${moduleTitle}场景子导航`} style={barStyle}>
      <div
        style={{
          maxWidth: 'var(--ax-content-max)',
          margin: '0 auto',
          padding: '10px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          <span
            style={{
              fontFamily: world === 'linear' ? 'var(--ax-font-mono)' : 'var(--ax-font-serif)',
              fontSize: world === 'linear' ? 12 : 14,
              letterSpacing: world === 'linear' ? '0.06em' : '0',
              fontWeight: world === 'linear' ? 500 : 400,
              color: 'var(--ax-text-secondary)',
              whiteSpace: 'nowrap',
            }}
          >
            {moduleTitle}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {items.map((item) => {
              const active = location.pathname === item.to;
              const pillBg =
                world === 'linear'
                  ? active
                    ? 'var(--ax-surface-alt)'
                    : 'transparent'
                  : world === 'claude'
                    ? active
                      ? 'var(--ax-surface-alt)'
                      : 'transparent'
                    : active
                      ? '#ffffff'
                      : 'transparent';

              const pillBorder =
                world === 'linear'
                  ? active
                    ? '1px solid var(--ax-border-strong)'
                    : '1px solid transparent'
                  : world === 'claude'
                    ? active
                      ? '1px solid var(--ax-hairline)'
                      : '1px solid transparent'
                    : active
                      ? '1px solid var(--ax-border-strong)'
                      : '1px solid transparent';

              return (
                <button
                  key={item.to}
                  type="button"
                  onClick={() => navigate(item.to)}
                  aria-current={active ? 'page' : undefined}
                  style={{
                    background: pillBg,
                    border: pillBorder,
                    borderRadius: world === 'oura' ? 9999 : 6,
                    padding: '5px 12px',
                    cursor: 'pointer',
                    fontFamily: 'var(--ax-font-text)',
                    fontSize: 13.5,
                    fontWeight: active ? 600 : 400,
                    color: active ? 'var(--ax-ink)' : 'var(--ax-text-secondary)',
                    transition: 'background-color 140ms ease, color 140ms ease, border-color 140ms ease',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {rightSlot && <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{rightSlot}</div>}
      </div>
    </nav>
  );
};

export default ModuleSubnav;
