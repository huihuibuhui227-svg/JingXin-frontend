import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ConfigProvider } from 'antd';
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

const PageLoader: React.FC = () => <Loading tip="页面加载中..." />;

const App: React.FC = () => {
  return (
    <ConfigProvider locale={zhCN}>
      <Router>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          <Header />
          <div style={{ flex: 1, background: '#f0f2f5' }}>
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
