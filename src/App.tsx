import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import Header from './components/common/Header';
import Footer from './components/common/Footer';
import ErrorBoundary from './components/common/ErrorBoundary';
import Loading from './components/common/Loading';
import Home from './pages/Home';
import './styles/global.css';

const InterviewAssessment = React.lazy(() => import('./pages/InterviewAssessment'));
const ResearchAssessment = React.lazy(() => import('./pages/ResearchAssessment'));
const RealtimeAnalysis = React.lazy(() => import('./pages/RealtimeAnalysis'));
const ReportPage = React.lazy(() => import('./pages/ReportPage'));
const ReportsList = React.lazy(() => import('./pages/ReportsList'));
const RecordingsPage = React.lazy(() => import('./pages/RecordingsPage'));

const PageLoader: React.FC = () => <Loading tip="页面加载中..." />;

/**
 * antd 主题令牌 —— 按 DESIGN.md（Apple-design-analysis）实现。
 *
 * 取值与 src/styles/tokens.css 一一对应；要改先改那边，再同步这里
 * （antd 的 token 只接受字面值，读不了 CSS 变量，所以这层映射躲不掉）。
 *
 * 三条边界见 tokens.css 顶部注释：单一 Action Blue、正文 17px、
 * 投影只给产品图。
 */
const antdTheme = {
  algorithm: theme.defaultAlgorithm,
  token: {
    // 唯一强调色：Action Blue。规范「Don't」明确禁止第二个品牌色。
    colorPrimary: '#0066cc',
    colorInfo: '#0066cc',
    colorSuccess: '#0a6b34',
    colorWarning: '#8a5a10',
    colorError: '#b03030',
    colorLink: '#0066cc',
    colorLinkHover: '#0071e3',

    colorText: '#1d1d1f',
    colorTextSecondary: '#333333',
    colorTextTertiary: '#6e6e73',
    colorBgLayout: '#ffffff',
    colorBorder: '#e0e0e0',
    colorBorderSecondary: '#f0f0f0',

    fontFamily: 'var(--ax-font-text)',
    fontSize: 17, // 规范：正文 17px，不是 16

    // 圆角语法：只在这几档里取，不要混。
    borderRadius: 8, // rounded.sm —— 紧凑工具按钮
    borderRadiusLG: 18, // rounded.lg —— 工具卡片
    controlHeight: 44, // 规范：触达目标最小 44×44
    wireframe: false,
    // 规范「Don't」：卡片/按钮/文字都不许有投影。禁用 antd 的默认阴影。
    boxShadow: 'none',
    boxShadowSecondary: 'none',
  },
  components: {
    Layout: {
      headerBg: '#000000', // 全局导航：唯一使用纯黑的地方
      headerHeight: 44,
      headerPadding: '0 24px',
      bodyBg: '#ffffff',
      footerBg: '#f5f5f7',
      footerPadding: '64px 24px',
    },
    Card: {
      paddingLG: 24, // spacing.lg
      borderRadiusLG: 18,
      headerFontSize: 17,
    },
    Button: {
      // 主 CTA 是完整胶囊 —— 这个圆角本身就是品牌动作信号
      borderRadius: 9999,
      borderRadiusSM: 9999,
      borderRadiusLG: 9999,
      controlHeight: 44,
      paddingInline: 22,
      fontWeight: 400,
      primaryShadow: 'none',
      defaultShadow: 'none',
      dangerShadow: 'none',
    },
    Table: {
      headerBg: '#ffffff',
      headerColor: '#6e6e73',
      headerSplitColor: 'transparent',
      borderColor: '#e0e0e0',
      cellPaddingBlock: 14,
      rowHoverBg: '#f5f5f7',
      // ⚠️ antd 排序态默认给表头一块灰底,实测把表头文字压到 4.5:1 以下。
      //    这里改成极浅的米白,保住对比度又保留"这一列在排序"的提示。
      headerSortActiveBg: '#f5f5f7',
      headerSortHoverBg: '#f5f5f7',
    },
    Menu: {
      // 黑色导航栏：选中项用白色高亮，不用色块
      darkItemBg: '#000000',
      darkItemColor: 'rgba(255,255,255,0.8)',
      darkItemHoverColor: '#ffffff',
      darkItemSelectedBg: 'transparent',
      darkItemSelectedColor: '#ffffff',
      horizontalItemSelectedColor: '#ffffff',
    },
    Tag: {
      defaultBg: '#f5f5f7',
      defaultColor: '#333333',
    },
    Statistic: {
      contentFontSize: 40, // display-lg
    },
    Typography: {
      titleMarginBottom: '0.4em',
      titleMarginTop: '0.8em',
    },
  },
} as const;

const App: React.FC = () => {
  return (
    <ConfigProvider locale={zhCN} theme={antdTheme}>
      <Router>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          <Header />
          {/*
            ⚠️ 这里**不能**用 <main>。
            antd 的 `Layout.Content` 本身就渲染成 <main>，用了它的页面（实时分析/
            报告列表/录制素材/报告页）已经有一个 main 了；在这里再包一层会出现
            **两个 main**，触发 axe 的 landmark-no-duplicate-main。
            没有用 Content 的页面（Home、AssessmentPage）各自在自己的根节点包 <main>。
          */}
          <div style={{ flex: 1, background: 'var(--ax-canvas)' }}>
            <ErrorBoundary>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/interview" element={<InterviewAssessment />} />
                  <Route path="/research" element={<ResearchAssessment />} />
                  <Route path="/analysis" element={<RealtimeAnalysis />} />
                  <Route path="/report/latest" element={<ReportPage />} />
                  <Route path="/report/:id" element={<ReportPage />} />
                  <Route path="/reports" element={<ReportsList />} />
                  <Route path="/recordings" element={<RecordingsPage />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </div>
          <Footer />
        </div>
      </Router>
    </ConfigProvider>
  );
};

export default App;
