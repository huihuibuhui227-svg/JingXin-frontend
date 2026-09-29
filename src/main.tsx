// ⚠️ 必须排在最前。见 src/polyfills/global.ts 的说明 ——
// 自建 plotly 部分包依赖 Node 的 `global`，缺了这个 shim 图表会静默全白。
import './polyfills/global';

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
