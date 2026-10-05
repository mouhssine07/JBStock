import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

const backendUrl = process.env.JBSTOCK_BACKEND_URL ?? 'http://127.0.0.1:8080'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api/health': {
        target: backendUrl,
        rewrite: () => '/actuator/health',
      },
    },
  },
})
