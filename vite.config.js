/**
 * ============================================================
 * Vite 配置
 * ------------------------------------------------------------
 * dev server 对外开放（host: true），便于浏览器预览与逐模块验证。
 * ============================================================
 */
import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    host: true,
    port: 5173,
    open: false
  },
  build: {
    target: 'es2020'
  }
})
