import { theme as antdThemeAlgorithm } from 'antd';
import type { ThemeConfig } from 'antd';

export type DesignThemeId = 'vercel' | 'linear' | 'claude' | 'oura';
export type ThemeSelectionMode = 'auto' | DesignThemeId;

export interface DesignThemeSpec {
  id: DesignThemeId;
  brandName: string;
  zhLabel: string;
  moduleLabel: string;
  tagline: string;
  isDark: boolean;
  swatches: [string, string, string];
  antdTheme: ThemeConfig;
}

const FONT_SANS_GEOMETRIC =
  "'Geist', 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Noto Sans CJK SC', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif";
const FONT_SANS_HUMANIST =
  "'StyreneB', 'Inter', system-ui, -apple-system, 'Noto Sans CJK SC', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif";
const FONT_SERIF_EDITORIAL =
  "'Copernicus', 'Tiempos Headline', 'Editorial New', 'Noto Serif CJK SC', 'Source Han Serif SC', 'Songti SC', Georgia, serif";

export const DESIGN_THEME_ORDER: DesignThemeId[] = ['vercel', 'linear', 'claude', 'oura'];

export const DESIGN_THEMES: Record<DesignThemeId, DesignThemeSpec> = {
  vercel: {
    id: 'vercel',
    brandName: 'Vercel',
    zhLabel: '极简架构网格',
    moduleLabel: '总门户 · 公共工作台',
    tagline: '高对比黑白极简架构线网、等宽坐标标记与锐利边角',
    isDark: false,
    swatches: ['#ffffff', '#171717', '#0068d6'],
    antdTheme: {
      algorithm: antdThemeAlgorithm.defaultAlgorithm,
      token: {
        colorPrimary: '#171717',
        colorInfo: '#0068d6',
        colorSuccess: '#0b5d2e',
        colorWarning: '#7a4a05',
        colorError: '#b42318',
        colorLink: '#0068d6',
        colorLinkHover: '#0050b3',
        colorText: '#171717',
        colorTextSecondary: '#4d4d4d',
        colorTextTertiary: '#5c5c5c',
        colorBgLayout: '#fafafa',
        colorBgContainer: '#ffffff',
        colorBgElevated: '#ffffff',
        colorBorder: '#ebebeb',
        colorBorderSecondary: '#f2f2f2',
        fontFamily: FONT_SANS_GEOMETRIC,
        fontSize: 16,
        borderRadius: 6,
        borderRadiusLG: 8,
        controlHeight: 40,
        wireframe: false,
        boxShadow: 'none',
        boxShadowSecondary: 'none',
      },
      components: {
        Layout: {
          bodyBg: '#fafafa',
          headerBg: '#ffffff',
          footerBg: '#ffffff',
        },
        Card: {
          paddingLG: 24,
          borderRadiusLG: 8,
          headerFontSize: 16,
        },
        Button: {
          borderRadius: 6,
          borderRadiusSM: 6,
          borderRadiusLG: 8,
          controlHeight: 40,
          paddingInline: 18,
          fontWeight: 500,
          primaryShadow: 'none',
          defaultShadow: 'none',
          dangerShadow: 'none',
        },
        Table: {
          headerBg: '#fafafa',
          headerColor: '#4d4d4d',
          headerSplitColor: 'transparent',
          borderColor: '#ebebeb',
          cellPaddingBlock: 12,
          rowHoverBg: '#fafafa',
        },
        Segmented: {
          trackBg: '#f4f4f5',
          itemSelectedBg: '#ffffff',
          itemColor: '#4d4d4d',
          itemSelectedColor: '#171717',
        },
      },
    },
  },
  linear: {
    id: 'linear',
    brandName: 'Linear',
    zhLabel: '深邃曜石精密仪',
    moduleLabel: '研思循证 · 科研过程',
    tagline: '曜石暗底四阶表面、1px 暗框细线与克制靛蓝主控',
    isDark: true,
    swatches: ['#08090a', '#141516', '#5e6ad2'],
    antdTheme: {
      algorithm: antdThemeAlgorithm.darkAlgorithm,
      token: {
        colorPrimary: '#5e6ad2',
        colorInfo: '#5e6ad2',
        colorSuccess: '#27a644',
        colorWarning: '#d97706',
        colorError: '#dc2626',
        colorLink: '#9da7ff',
        colorLinkHover: '#bec4ff',
        colorText: '#f7f8f8',
        colorTextSecondary: '#d0d6e0',
        colorTextTertiary: '#9ba1ae',
        colorBgBase: '#08090a',
        colorBgLayout: '#08090a',
        colorBgContainer: '#0f1011',
        colorBgElevated: '#141516',
        colorBorder: '#23252a',
        colorBorderSecondary: '#1b1d22',
        fontFamily: FONT_SANS_GEOMETRIC,
        fontSize: 15,
        borderRadius: 6,
        borderRadiusLG: 8,
        controlHeight: 38,
        wireframe: false,
        boxShadow: 'none',
        boxShadowSecondary: 'none',
      },
      components: {
        Layout: {
          bodyBg: '#08090a',
          headerBg: '#08090a',
          footerBg: '#08090a',
        },
        Card: {
          colorBgContainer: '#0f1011',
          paddingLG: 22,
          borderRadiusLG: 8,
          headerFontSize: 15,
        },
        Button: {
          borderRadius: 6,
          borderRadiusSM: 6,
          borderRadiusLG: 8,
          controlHeight: 38,
          paddingInline: 16,
          fontWeight: 500,
          primaryShadow: 'none',
          defaultShadow: 'none',
          dangerShadow: 'none',
          defaultBg: '#141516',
          defaultBorderColor: '#2d3038',
          defaultColor: '#f7f8f8',
        },
        Table: {
          colorBgContainer: '#0f1011',
          headerBg: '#141516',
          headerColor: '#d0d6e0',
          headerSplitColor: 'transparent',
          borderColor: '#23252a',
          cellPaddingBlock: 12,
          rowHoverBg: '#181a1f',
        },
        Segmented: {
          trackBg: '#141516',
          itemSelectedBg: '#23252a',
          itemColor: '#9ba1ae',
          itemSelectedColor: '#f7f8f8',
        },
        Tag: {
          defaultBg: '#141516',
          defaultColor: '#d0d6e0',
        },
      },
    },
  },
  claude: {
    id: 'claude',
    brandName: 'Claude',
    zhLabel: '温润象牙编校室',
    moduleLabel: '元智审辨 · 职业实训',
    tagline: '温润象牙纸面、常规字重衬线标题与暗炭审辨对比框',
    isDark: false,
    swatches: ['#faf9f5', '#181715', '#a34f33'],
    antdTheme: {
      algorithm: antdThemeAlgorithm.defaultAlgorithm,
      token: {
        colorPrimary: '#a34f33',
        colorInfo: '#256058',
        colorSuccess: '#1f6440',
        colorWarning: '#7d4d08',
        colorError: '#a32828',
        colorLink: '#9b482c',
        colorLinkHover: '#7c361f',
        colorText: '#141413',
        colorTextSecondary: '#3d3d3a',
        colorTextTertiary: '#5e5c57',
        colorBgLayout: '#faf9f5',
        colorBgContainer: '#ffffff',
        colorBgElevated: '#faf9f5',
        colorBorder: '#e6dfd8',
        colorBorderSecondary: '#ebe6df',
        fontFamily: FONT_SANS_HUMANIST,
        fontSize: 16,
        borderRadius: 8,
        borderRadiusLG: 12,
        controlHeight: 40,
        wireframe: false,
        boxShadow: 'none',
        boxShadowSecondary: 'none',
      },
      components: {
        Layout: {
          bodyBg: '#faf9f5',
          headerBg: '#faf9f5',
          footerBg: '#f5f0e8',
        },
        Card: {
          paddingLG: 24,
          borderRadiusLG: 12,
          headerFontSize: 16,
        },
        Button: {
          borderRadius: 8,
          borderRadiusSM: 6,
          borderRadiusLG: 10,
          controlHeight: 40,
          paddingInline: 18,
          fontWeight: 500,
          primaryShadow: 'none',
          defaultShadow: 'none',
          dangerShadow: 'none',
        },
        Table: {
          headerBg: '#f5f0e8',
          headerColor: '#3d3d3a',
          headerSplitColor: 'transparent',
          borderColor: '#e6dfd8',
          cellPaddingBlock: 13,
          rowHoverBg: '#faf9f5',
        },
        Segmented: {
          trackBg: '#efe9de',
          itemSelectedBg: '#ffffff',
          itemColor: '#3d3d3a',
          itemSelectedColor: '#141413',
        },
        Typography: {
          fontFamilyCode: "'JetBrains Mono', ui-monospace, monospace",
          titleMarginBottom: '0.45em',
          titleMarginTop: '0.75em',
        },
      },
    },
  },
  oura: {
    id: 'oura',
    brandName: 'Oura',
    zhLabel: '森绿亚麻静谧风',
    moduleLabel: '时序观微 · 匿名随访',
    tagline: '深森绿静谧头带、极轻衬线标题、温暖亚麻底与克制行动蓝',
    isDark: false,
    swatches: ['#224228', '#f7f1e8', '#2264ca'],
    antdTheme: {
      algorithm: antdThemeAlgorithm.defaultAlgorithm,
      token: {
        colorPrimary: '#2264ca',
        colorInfo: '#224228',
        colorSuccess: '#224228',
        colorWarning: '#8c5309',
        colorError: '#a82a18',
        colorLink: '#224228',
        colorLinkHover: '#17301c',
        colorText: '#1c1b1a',
        colorTextSecondary: '#4a4741',
        colorTextTertiary: '#5b5851',
        colorBgLayout: '#f7f1e8',
        colorBgContainer: '#ffffff',
        colorBgElevated: '#ffffff',
        colorBorder: '#e1dcd3',
        colorBorderSecondary: '#ece6dc',
        fontFamily: FONT_SANS_HUMANIST,
        fontSize: 16,
        borderRadius: 10,
        borderRadiusLG: 16,
        controlHeight: 42,
        wireframe: false,
        boxShadow: 'none',
        boxShadowSecondary: 'none',
      },
      components: {
        Layout: {
          bodyBg: '#f7f1e8',
          headerBg: '#f7f1e8',
          footerBg: '#19191c',
        },
        Card: {
          paddingLG: 26,
          borderRadiusLG: 16,
          headerFontSize: 16,
        },
        Button: {
          borderRadius: 9999,
          borderRadiusSM: 9999,
          borderRadiusLG: 9999,
          controlHeight: 42,
          paddingInline: 22,
          fontWeight: 600,
          primaryShadow: 'none',
          defaultShadow: 'none',
          dangerShadow: 'none',
        },
        Table: {
          headerBg: '#f7f1e8',
          headerColor: '#4a4741',
          headerSplitColor: 'transparent',
          borderColor: '#e1dcd3',
          cellPaddingBlock: 13,
          rowHoverBg: '#fbf8f3',
        },
        Segmented: {
          trackBg: '#efe8dc',
          itemSelectedBg: '#ffffff',
          itemColor: '#4a4741',
          itemSelectedColor: '#1c1b1a',
        },
      },
    },
  },
};

export function resolveRouteTheme(pathname: string, search = ''): DesignThemeId {
  if (pathname === '/') return 'vercel';

  if (
    pathname === '/hub/research' ||
    pathname.startsWith('/research') ||
    pathname.startsWith('/interview') ||
    pathname.startsWith('/compare')
  ) {
    return 'linear';
  }

  if (
    pathname === '/hub/metacognition' ||
    pathname.startsWith('/career-mcp') ||
    pathname.startsWith('/metacognition')
  ) {
    return 'claude';
  }

  if (pathname === '/hub/followup' || pathname.startsWith('/followup')) {
    return 'oura';
  }

  if (pathname.startsWith('/report/') || pathname === '/report') {
    const params = new URLSearchParams(search);
    const sp = params.get('scene_profile');
    if (sp === 'research_interview') return 'linear';
    if (sp === 'longitudinal_followup') return 'oura';
    return 'claude';
  }

  return 'vercel';
}

export const THEME_FONT_SERIF = FONT_SERIF_EDITORIAL;
