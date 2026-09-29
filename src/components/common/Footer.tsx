import React from 'react';

/**
 * 页脚 —— 按 DESIGN.md 的 `footer` 实现。
 *
 * 规范：背景 `canvas-parchment` #f5f5f7，文字 `ink-muted-80` #333，
 * 链接列用 `dense-link`（17px / 400 / **行高 2.41**）—— 那个松弛的行高
 * 正是密集链接列能扫读的原因，不是笔误。列标题 `caption-strong` 14px/600，
 * 最底部法务行 `fine-print` 12px + `ink-muted-48`。纵向内距 64px。
 *
 * 规范也指出：页脚是全站**唯一**允许"故意密集"的地方 —— 好让整个信息
 * 架构一眼可见。
 */
const Footer: React.FC = () => {
  return (
    <footer
      style={{
        background: 'var(--ax-parchment)',
        color: 'var(--ax-ink-muted-80)',
        padding: '64px 24px 32px'
      }}
    >
      <div style={{ maxWidth: 'var(--ax-content-max)', margin: '0 auto' }}>
        {/* 法务行：fine-print 12px */}
        <div
          className="ax-fine-print"
          style={{
            borderTop: '1px solid var(--ax-hairline)',
            paddingTop: 17,
            // 规范把 ink-muted-48(#7a7a7a) 用于法务小字,但它实测只有 4.29:1,
            // 不到 AA。按 tokens.css 里记的约定:该档只留给**禁用态**,
            // 真实文字用 secondary(米白底 4.66:1)。
            color: 'var(--ax-text-secondary)',
            display: 'flex',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap'
          }}
        >
          <span>JingXin 多模态面试评估系统</span>
          <span>面部表情 · 手势姿态 · 语音内容 · 眼动轨迹</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
