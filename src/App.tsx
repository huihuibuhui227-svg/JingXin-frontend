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
const DataExportPage = React.lazy(() => import('./pages/DataExportPage'));
const QuestionBankPage = React.lazy(() => import('./pages/QuestionBankPage'));
const BenchmarksPage = React.lazy(() => import('./pages/BenchmarksPage'));
const CareerMcpPage = React.lazy(() => import('./pages/CareerMcpPage'));
const MetacognitionAssessment = React.lazy(() => import('./pages/MetacognitionAssessment'));
const FollowupPage = React.lazy(() => import('./pages/FollowupPage'));
const FollowupCapture = React.lazy(() => import('./pages/FollowupCapture'));
const CompareSessionsPage = React.lazy(() => import('./pages/CompareSessionsPage'));
const ResearchHubPage = React.lazy(() => import('./pages/ResearchHubPage'));
const MetacognitionHubPage = React.lazy(() => import('./pages/MetacognitionHubPage'));
const FollowupHubPage = React.lazy(() => import('./pages/FollowupHubPage'));

const PageLoader: React.FC = () => <Loading tip="页面加载中…" />;

/**
 * 衡才智析 Ant Design 主题令牌 —— 与 DESIGN.md 和 src/styles/tokens.css 一一对应。
 * 唯一交互色 Action Blue #0066cc；正文 17px；零卡片/按钮阴影；清透高对比状态色。
 */
const antdTheme = {
  algorithm: theme.defaultAlgorithm,
  token: {
    colorPrimary: '#0066cc',
    colorInfo: '#0066cc',
    colorSuccess: '#0b5d2e',
    colorWarning: '#7a4a05',
    colorError: '#9e1f1f',
    colorLink: '#0066cc',
    colorLinkHover: '#0071e3',

    colorText: '#1d1d1f',
    colorTextSecondary: '#333333',
    colorTextTertiary: '#5c5c61',
    colorBgLayout: '#f5f5f7',
    colorBorder: '#e0e0e0',
    colorBorderSecondary: '#f0f0f0',

    fontFamily: 'var(--ax-font-text)',
    fontSize: 17,

    borderRadius: 8,
    borderRadiusLG: 18,
    controlHeight: 44,
    wireframe: false,
    boxShadow: 'none',
    boxShadowSecondary: 'none',
  },
  components: {
    Layout: {
      headerBg: '#000000',
      headerHeight: 44,
      headerPadding: '0 24px',
      bodyBg: '#f5f5f7',
      footerBg: '#f5f5f7',
      footerPadding: '56px 24px',
    },
    Card: {
      paddingLG: 24,
      borderRadiusLG: 18,
      headerFontSize: 17,
    },
    Alert: {
      colorInfoBg: '#eef5fc',
      colorInfoBorder: '#c2dcf5',
      colorSuccessBg: '#edf7f0',
      colorSuccessBorder: '#bfe3cb',
      colorWarningBg: '#fdf6e9',
      colorWarningBorder: '#eed39e',
      colorErrorBg: '#fdf0f0',
      colorErrorBorder: '#f2c2c2',
    },
    Button: {
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
      headerColor: '#5c5c61',
      headerSplitColor: 'transparent',
      borderColor: '#e0e0e0',
      cellPaddingBlock: 14,
      rowHoverBg: '#f5f5f7',
      headerSortActiveBg: '#f5f5f7',
      headerSortHoverBg: '#f5f5f7',
    },
    Menu: {
      darkItemBg: '#000000',
      darkItemColor: 'rgba(255,255,255,0.82)',
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
      contentFontSize: 40,
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
                  <Route path="/export" element={<DataExportPage />} />
                  <Route path="/question-bank" element={<QuestionBankPage />} />
                  <Route path="/benchmarks" element={<BenchmarksPage />} />
                  <Route path="/career-mcp" element={<CareerMcpPage />} />
                  <Route path="/metacognition" element={<MetacognitionAssessment />} />
                  <Route path="/followup" element={<FollowupPage />} />
                  <Route path="/followup/capture" element={<FollowupCapture />} />
                  <Route path="/compare" element={<CompareSessionsPage />} />
                  <Route path="/hub/research" element={<ResearchHubPage />} />
                  <Route path="/hub/metacognition" element={<MetacognitionHubPage />} />
                  <Route path="/hub/followup" element={<FollowupHubPage />} />
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
