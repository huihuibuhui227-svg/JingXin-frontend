import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import Header from './components/common/Header';
import Footer from './components/common/Footer';
import Home from './pages/Home';
import InterviewAssessment from './pages/InterviewAssessment';
import ResearchAssessment from './pages/ResearchAssessment';
import RealtimeAnalysis from './pages/RealtimeAnalysis';
import ReportPage from './pages/ReportPage';
import ReportsList from './pages/ReportsList';
import './styles/global.css';

const App: React.FC = () => {
  return (
    <ConfigProvider locale={zhCN}>
      <Router>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          <Header />
          <div style={{ flex: 1, background: '#f0f2f5' }}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/interview" element={<InterviewAssessment />} />
              <Route path="/research" element={<ResearchAssessment />} />
              <Route path="/analysis" element={<RealtimeAnalysis />} />
              <Route path="/report/:id" element={<ReportPage />} />
              <Route path="/reports" element={<ReportsList />} />
            </Routes>
          </div>
          <Footer />
        </div>
      </Router>
    </ConfigProvider>
  );
};

export default App;
