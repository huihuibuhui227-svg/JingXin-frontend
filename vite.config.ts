
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
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
