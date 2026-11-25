import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useDesignTheme } from '@/theme/ThemeContext';
import { BRAND_FULL_TITLE, BRAND_PRINCIPLE, BRAND_SLOGAN } from '@/utils/constants';

const QUICK_LINKS = [
  { to: '/hub/research', label: '研思循证' },
  { to: '/hub/metacognition', label: '元智审辨' },
  { to: '/hub/followup', label: '时序观微' },
  { to: '/compare', label: '多场对比' },
  { to: '/reports', label: '报告中心' },
  { to: '/recordings', label: '录制素材' },
  { to: '/question-bank', label: '题库管理' },
  { to: '/benchmarks', label: '科研基准' },
];

const Footer: React.FC = () => {
  const navigate = useNavigate();
  const { themeSpec } = useDesignTheme();

  return (
    <footer
      style={{
        background: 'var(--ax-footer-bg)',
        color: 'var(--ax-footer-ink)',
        padding: '44px 24px 28px',
        borderTop: '1px solid var(--ax-hairline)',
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
            paddingBottom: 24,
          }}
        >
          <div style={{ maxWidth: 500 }}>
            <div
              style={{
                fontFamily: 'var(--ax-font-display)',
                fontSize: 15,
                fontWeight: 600,
                color: 'var(--ax-footer-link)',
                letterSpacing: '-0.02em',
              }}
            >
              {BRAND_FULL_TITLE}
            </div>
            <p
              className="ax-fine-print"
              style={{
                color: 'var(--ax-footer-ink)',
                margin: '8px 0 0',
                lineHeight: 1.68,
              }}
            >
              {BRAND_SLOGAN} · {BRAND_PRINCIPLE}。原始音视频与采集日志按场次独立留存并支持可控清理；
              报告层不产出综合评分、不作等级评定、不作心理或临床推断。
            </p>
          </div>

          <nav
            aria-label="页脚快捷入口"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px 18px',
              maxWidth: 420,
            }}
          >
            {QUICK_LINKS.map((item) => (
              <button
                key={item.to}
                type="button"
                onClick={() => navigate(item.to)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '4px 0',
                  cursor: 'pointer',
                  fontFamily: 'var(--ax-font-text)',
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--ax-footer-link)',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div
          aria-hidden="true"
          style={{
            height: 1,
            background: 'var(--ax-footer-ink)',
            opacity: 0.2,
            marginBottom: 16,
          }}
        />

        <div
          className="ax-fine-print"
          style={{
            color: 'var(--ax-footer-ink)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <span>
            {BRAND_FULL_TITLE} · 视觉风格：{themeSpec.brandName} ({themeSpec.zhLabel})
          </span>
          <span>面部动作观察 · 上肢姿态轨迹 · 语音声学与转写 · 可追溯行为证据</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
