import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import Header from './components/common/Header';
import Footer from './components/common/Footer';
import ErrorBoundary from './components/common/ErrorBoundary';
import Loading from './components/common/Loading';
import Home from './pages/Home';
import { DesignThemeProvider, useDesignTheme } from './theme/ThemeContext';
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

const ThemedShell: React.FC = () => {
  const { themeSpec } = useDesignTheme();

  return (
    <ConfigProvider locale={zhCN} theme={themeSpec.antdTheme}>
      <div
        data-theme-world={themeSpec.id}
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--ax-canvas)',
          color: 'var(--ax-ink)',
        }}
      >
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
    </ConfigProvider>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <DesignThemeProvider>
        <ThemedShell />
      </DesignThemeProvider>
    </Router>
  );
};

export default App;
