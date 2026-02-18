import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    allowedHosts: [
      '3965-200-106-76-49.ngrok-free.app'
    ],
    proxy: {
      '/api': {
        target: 'http://172.24.174.219:8020',
        changeOrigin: true,
        ws: true, // Para WebSocket si es necesario
      },
    },
  },
})
