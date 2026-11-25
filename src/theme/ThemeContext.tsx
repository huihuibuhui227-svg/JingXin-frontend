import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  DESIGN_THEMES,
  DesignThemeId,
  DesignThemeSpec,
  resolveRouteTheme,
  ThemeSelectionMode,
} from './designThemes';

const STORAGE_KEY = 'jx_design_theme_mode';
const VALID_MODES = new Set<ThemeSelectionMode>(['auto', 'vercel', 'linear', 'claude', 'oura']);

interface DesignThemeContextValue {
  mode: ThemeSelectionMode;
  activeTheme: DesignThemeId;
  routeTheme: DesignThemeId;
  themeSpec: DesignThemeSpec;
  setMode: (nextMode: ThemeSelectionMode, interactive?: boolean) => void;
  resetAuto: () => void;
}

const DesignThemeContext = createContext<DesignThemeContextValue | null>(null);

const readStoredMode = (): ThemeSelectionMode => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY) as ThemeSelectionMode | null;
    if (raw && VALID_MODES.has(raw)) return raw;
  } catch {
    // 忽略无存储权限环境
  }
  return 'auto';
};

const applyRootThemeAttrs = (themeId: DesignThemeId, isDark: boolean) => {
  const root = document.documentElement;
  root.dataset.designTheme = themeId;
  root.style.colorScheme = isDark ? 'dark' : 'light';
};

export const DesignThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const [mode, setModeState] = useState<ThemeSelectionMode>(() => readStoredMode());

  const routeTheme = useMemo(
    () => resolveRouteTheme(location.pathname, location.search),
    [location.pathname, location.search]
  );

  const activeTheme: DesignThemeId = mode === 'auto' ? routeTheme : mode;
  const themeSpec = DESIGN_THEMES[activeTheme];

  useEffect(() => {
    applyRootThemeAttrs(activeTheme, themeSpec.isDark);
  }, [activeTheme, themeSpec.isDark]);

  const setMode = useCallback(
    (nextMode: ThemeSelectionMode, interactive = true) => {
      const nextThemeId: DesignThemeId = nextMode === 'auto' ? routeTheme : nextMode;
      const nextSpec = DESIGN_THEMES[nextThemeId];

      const commit = () => {
        try {
          sessionStorage.setItem(STORAGE_KEY, nextMode);
        } catch {
          // ignore
        }
        setModeState(nextMode);
        applyRootThemeAttrs(nextThemeId, nextSpec.isDark);
      };

      const prefersReduced =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
      const startVT = (document as unknown as { startViewTransition?: (cb: () => void) => unknown })
        ?.startViewTransition;

      if (interactive && !prefersReduced && typeof startVT === 'function') {
        startVT.call(document, commit);
      } else {
        commit();
      }
    },
    [routeTheme]
  );

  const resetAuto = useCallback(() => setMode('auto', true), [setMode]);

  const value = useMemo<DesignThemeContextValue>(
    () => ({
      mode,
      activeTheme,
      routeTheme,
      themeSpec,
      setMode,
      resetAuto,
    }),
    [mode, activeTheme, routeTheme, themeSpec, setMode, resetAuto]
  );

  return <DesignThemeContext.Provider value={value}>{children}</DesignThemeContext.Provider>;
};

export function useDesignTheme(): DesignThemeContextValue {
  const ctx = useContext(DesignThemeContext);
  if (!ctx) {
    throw new Error('useDesignTheme must be used within DesignThemeProvider');
  }
  return ctx;
}
