import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BRAND_FULL_TITLE, BRAND_PRINCIPLE, BRAND_SLOGAN } from '@/utils/constants';

const QUICK_LINKS = [
  { to: '/research', label: '科研采集' },
  { to: '/interview', label: '面试观测' },
  { to: '/compare', label: '多场对比' },
  { to: '/career-mcp', label: '岗位 MCP 中心' },
  { to: '/metacognition', label: 'AI 审辨实训' },
  { to: '/followup', label: '长周期随访' },
  { to: '/reports', label: '报告中心' },
  { to: '/benchmarks', label: '科研基准' },
];

const Footer: React.FC = () => {
  const navigate = useNavigate();

  return (
    <footer
      style={{
        background: 'var(--ax-parchment)',
        color: 'var(--ax-ink-muted-80)',
        padding: '48px 24px 32px',
        borderTop: '1px solid var(--ax-hairline)'
      }}
    >
      <div style={{ maxWidth: 'var(--ax-content-max)', margin: '0 auto' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: 24,
            paddingBottom: 24
          }}
        >
          <div style={{ maxWidth: 460 }}>
            <div
              style={{
                fontFamily: 'var(--ax-font-display)',
                fontSize: 15,
                fontWeight: 600,
                color: 'var(--ax-ink)',
                letterSpacing: '-0.2px'
              }}
            >
              {BRAND_FULL_TITLE}
            </div>
            <div
              className="ax-fine-print"
              style={{ color: 'var(--ax-text-secondary)', marginTop: 6, lineHeight: 1.65 }}
            >
              {BRAND_SLOGAN} · {BRAND_PRINCIPLE}。原始音视频与采集日志按会话独立原样留存并支持可控清理；
              报告层不产出综合评分、不给等级评定、不做心理或临床推断。
            </div>
          </div>

          <nav aria-label="页脚快捷入口" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px' }}>
            {QUICK_LINKS.map((item) => (
              <button
                key={item.to}
                type="button"
                onClick={() => navigate(item.to)}
                className="ax-press"
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '4px 0',
                  cursor: 'pointer',
                  fontFamily: 'var(--ax-font-text)',
                  fontSize: 'var(--ax-caption-size)',
                  color: 'var(--ax-primary)',
                  whiteSpace: 'nowrap'
                }}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div
          className="ax-fine-print"
          style={{
            borderTop: '1px solid var(--ax-hairline)',
            paddingTop: 16,
            color: 'var(--ax-text-secondary)',
            display: 'flex',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap'
          }}
        >
          <span>{BRAND_FULL_TITLE}</span>
          <span>面部几何观测 · 手势与姿态检出 · 语音声学与转写 · 白盒证据门</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
