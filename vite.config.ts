
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { visualizer } from 'rollup-plugin-visualizer'

// 只在显式要求时产出体积报告：`ANALYZE=1 npm run build`。
// 否则每次构建都多写一份 dist/stats.html,没必要。
const analyze = process.env.ANALYZE === '1'

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
  define: {
    /*
     * ⚠️ 这里**不能**用 `define: { global: 'globalThis' }`。
     * Vite/esbuild 的 define 是**字面文本替换**，它会把 `global` 这三个词
     * 在任何出现处都换掉 —— 包括字符串里的路径：
     *   import './styles/global.css'  →  import './styles/globalThis.css'
     * 于是构建报 `Could not resolve "./styles/globalThis.css"`。（实测踩过。）
     *
     * 改用入口处的**运行时 shim**：见 src/main.tsx 顶部的
     * `window.global = window`。同样是给细粒度 plotly 模块补 Node 的 global，
     * 但不碰任何源码文本。
     */
  },
  build: {
    // 图表分块本来就有 4.7MB,不设阈值每次构建都会刷警告,
    // 反而把真正的警告埋掉。测完体积再决定要不要动它。
    chunkSizeWarningLimit: 5000
  },
  server: {
    port: 5173,
    // 经 `tailscale serve` 访问时,Host 头是 `gpuserver.tail4ffce2.ts.net`,
    // 而 Vite 会**挡陌生 Host**(实测报 `Blocked request. This host is not allowed.`)。
    // `.ts.net` 带前导点是「后缀匹配」,覆盖本 tailnet 下所有设备名。
    allowedHosts: ['.ts.net'],
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      },
      '/output': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  }
})
