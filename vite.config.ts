import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { visualizer } from 'rollup-plugin-visualizer';

// 仅在显式要求时产出体积报告：`ANALYZE=1 npm run build`
const analyze = process.env.ANALYZE === '1';

// 支持通过环境变量 `VITE_ALLOWED_HOSTS`（逗号分隔）追加放行主机，默认保留 `.ts.net` 后缀匹配
const extraAllowedHosts = (process.env.VITE_ALLOWED_HOSTS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const allowedHosts = Array.from(new Set(['.ts.net', ...extraAllowedHosts]));

const sharedProxy = {
  '/api': {
    target: 'http://127.0.0.1:5000',
    changeOrigin: true
  },
  '/output': {
    target: 'http://127.0.0.1:5000',
    changeOrigin: true
  },
  '/_svc/face': {
    target: 'http://127.0.0.1:8000',
    changeOrigin: true,
    rewrite: (p: string) => p.replace(/^\/_svc\/face/, '')
  },
  '/_svc/voice': {
    target: 'http://127.0.0.1:8001',
    changeOrigin: true,
    rewrite: (p: string) => p.replace(/^\/_svc\/voice/, '')
  },
  '/_svc/gesture': {
    target: 'http://127.0.0.1:8002',
    changeOrigin: true,
    rewrite: (p: string) => p.replace(/^\/_svc\/gesture/, '')
  }
};

export default defineConfig({
  plugins: [
    react(),
    ...(analyze
      ? [visualizer({ filename: 'dist/stats.html', gzipSize: true, brotliSize: true }) as never]
      : [])
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    chunkSizeWarningLimit: 1200
  },
  server: {
    port: 5173,
    allowedHosts,
    proxy: sharedProxy
  },
  preview: {
    port: 5173,
    strictPort: true,
    proxy: sharedProxy
  }
});
