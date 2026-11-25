import React, { useEffect, useRef, useState } from 'react';
import { DESIGN_THEMES, DESIGN_THEME_ORDER, DesignThemeId } from '@/theme/designThemes';
import { useDesignTheme } from '@/theme/ThemeContext';

const WireframePreview: React.FC<{ swatches: [string, string, string]; isDark: boolean }> = ({
  swatches,
  isDark,
}) => {
  const [canvas, panel, accent] = swatches;
  const frameBorder = isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(20, 20, 19, 0.14)';
  const lineTone = isDark ? 'rgba(247, 248, 248, 0.28)' : 'rgba(23, 23, 23, 0.2)';
  const lineSubtle = isDark ? 'rgba(247, 248, 248, 0.14)' : 'rgba(23, 23, 23, 0.1)';

  return (
    <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {/* 迷你工作台骨架线框预览 */}
      <div
        style={{
          height: 36,
          borderRadius: 4,
          background: canvas,
          border: `1px solid ${frameBorder}`,
          padding: 5,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
          <span
            style={{
              width: 24,
              height: 4,
              borderRadius: 2,
              background: panel,
              border: `1px solid ${frameBorder}`,
            }}
          />
          <span
            style={{
              width: 12,
              height: 4,
              borderRadius: 99,
              background: accent,
            }}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 4, alignItems: 'center' }}>
          <span style={{ height: 12, borderRadius: 2, background: panel, border: `1px solid ${frameBorder}` }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ height: 3, width: '90%', borderRadius: 2, background: lineTone }} />
            <span style={{ height: 3, width: '65%', borderRadius: 2, background: lineSubtle }} />
          </div>
        </div>
      </div>

      {/* 真实 3 色色板条 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          height: 5,
          borderRadius: 3,
          overflow: 'hidden',
          border: `1px solid ${frameBorder}`,
        }}
      >
        <span style={{ background: canvas }} />
        <span style={{ background: panel }} />
        <span style={{ background: accent }} />
      </div>
    </div>
  );
};

const ThemeSwitcher: React.FC = () => {
  const { mode, activeTheme, routeTheme, themeSpec, setMode, resetAuto } = useDesignTheme();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent | PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const handleSelectTheme = (id: DesignThemeId) => {
    setMode(id, true);
  };

  const handleToggleAuto = () => {
    if (mode === 'auto') {
      setMode(activeTheme, true);
    } else {
      resetAuto();
    }
  };

  const popoverShadow = themeSpec.isDark
    ? '0 12px 32px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.06)'
    : '0 2px 4px rgba(0, 0, 0, 0.04), 0 14px 28px -6px rgba(0, 0, 0, 0.12)';

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="切换页面视觉风格"
        onClick={() => setOpen((prev) => !prev)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          height: 32,
          padding: '0 10px',
          borderRadius: 'var(--ax-rounded-sm)',
          background: 'var(--ax-surface)',
          border: '1px solid var(--ax-hairline)',
          color: 'var(--ax-header-ink)',
          fontFamily: 'var(--ax-font-text)',
          fontSize: 12.5,
          fontWeight: 500,
          lineHeight: 1,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          transition: 'border-color 140ms ease, background-color 140ms ease',
        }}
      >
        <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          {themeSpec.swatches.map((hex, index) => (
            <span
              key={`${themeSpec.id}-${index}`}
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: hex,
                boxShadow: 'inset 0 0 0 1px rgba(128, 128, 128, 0.36)',
                display: 'inline-block',
              }}
            />
          ))}
        </span>
        <span>风格 · {themeSpec.brandName}</span>
        {mode === 'auto' && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: 'var(--ax-text-secondary)',
            }}
          >
            (自动)
          </span>
        )}
        <svg
          aria-hidden="true"
          width="11"
          height="11"
          viewBox="0 0 12 12"
          fill="none"
          style={{
            color: 'var(--ax-text-secondary)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
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

      {open && (
        <div
          role="dialog"
          aria-label="页面视觉风格切换器"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 344,
            maxWidth: 'calc(100vw - 24px)',
            background: 'var(--ax-surface)',
            border: '1px solid var(--ax-hairline)',
            borderRadius: 8,
            boxShadow: popoverShadow,
            padding: 12,
            zIndex: 1200,
            color: 'var(--ax-ink)',
          }}
        >
          <button
            type="button"
            aria-pressed={mode === 'auto'}
            onClick={handleToggleAuto}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              padding: '9px 10px',
              borderRadius: 6,
              background: mode === 'auto' ? 'var(--ax-surface-alt)' : 'transparent',
              border: '1px solid var(--ax-hairline)',
              color: 'var(--ax-ink)',
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: 'var(--ax-font-text)',
            }}
          >
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ax-ink)', lineHeight: 1.3 }}>
                跟随场景自动切境
              </div>
              <div style={{ fontSize: 11, color: 'var(--ax-text-secondary)', marginTop: 2, lineHeight: 1.35 }}>
                当前路由默认：{DESIGN_THEMES[routeTheme].brandName}
              </div>
            </div>
            <span
              style={{
                flexShrink: 0,
                padding: '3px 8px',
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 600,
                background: mode === 'auto' ? 'var(--ax-primary)' : 'var(--ax-parchment)',
                color: mode === 'auto' ? 'var(--ax-on-primary)' : 'var(--ax-ink)',
                border: mode === 'auto' ? '1px solid transparent' : '1px solid var(--ax-hairline)',
              }}
            >
              {mode === 'auto' ? '已开启' : '恢复自动'}
            </span>
          </button>

          <div
            style={{
              height: 1,
              background: 'var(--ax-hairline)',
              margin: '10px 0 8px',
            }}
          />

          <div
            style={{
              fontSize: 11,
              fontFamily: 'var(--ax-font-mono)',
              color: 'var(--ax-text-secondary)',
              marginBottom: 8,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>STYLE WORLDS (4)</span>
            <span>{mode === 'auto' ? 'AUTO SYNC' : `LOCKED: ${themeSpec.brandName.toUpperCase()}`}</span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 8,
            }}
          >
            {DESIGN_THEME_ORDER.map((id) => {
              const spec = DESIGN_THEMES[id];
              const isSelected = activeTheme === id;
              const isDefaultRoute = routeTheme === id;

              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => handleSelectTheme(id)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    padding: 9,
                    borderRadius: 6,
                    background: isSelected ? 'var(--ax-surface-alt)' : 'var(--ax-parchment)',
                    border: isSelected
                      ? '1px solid var(--ax-primary)'
                      : '1px solid var(--ax-hairline)',
                    boxShadow: isSelected ? 'inset 0 0 0 1px var(--ax-primary)' : 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'var(--ax-font-text)',
                    transition: 'border-color 140ms ease, background-color 140ms ease',
                  }}
                >
                  <WireframePreview swatches={spec.swatches} isDark={spec.isDark} />

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 4,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'var(--ax-ink)',
                          lineHeight: 1.25,
                        }}
                      >
                        {spec.brandName}
                      </span>
                      {isSelected ? (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            padding: '1px 5px',
                            borderRadius: 3,
                            background: 'var(--ax-primary)',
                            color: 'var(--ax-on-primary)',
                            lineHeight: 1.4,
                          }}
                        >
                          当前
                        </span>
                      ) : isDefaultRoute ? (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 500,
                            color: 'var(--ax-text-secondary)',
                            lineHeight: 1.4,
                          }}
                        >
                          默认
                        </span>
                      ) : null}
                    </div>
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 500,
                        color: 'var(--ax-ink-muted-80)',
                        lineHeight: 1.3,
                      }}
                    >
                      {spec.zhLabel}
                    </span>
                    <span
                      style={{
                        fontSize: 10.5,
                        color: 'var(--ax-text-secondary)',
                        lineHeight: 1.3,
                      }}
                    >
                      {spec.moduleLabel}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ThemeSwitcher;
