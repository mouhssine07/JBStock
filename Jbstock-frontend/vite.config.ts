import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ command, isPreview }) => {
  const development = command === 'serve' && !isPreview
  const token = process.env.JBSTOCK_LOCAL_SESSION_TOKEN ?? ''
  const backendUrl = new URL(process.env.JBSTOCK_BACKEND_URL ?? 'http://127.0.0.1:8080')
  if (development && !/^[a-f0-9]{64}$/.test(token)) {
    throw new Error('Start development with node scripts/dev.mjs from the repository root (local session token required).')
  }
  if (backendUrl.protocol !== 'http:' || backendUrl.hostname !== '127.0.0.1'
      || backendUrl.username || backendUrl.password || backendUrl.pathname !== '/'
      || backendUrl.search || backendUrl.hash) {
    throw new Error('JBSTOCK_BACKEND_URL must be an HTTP origin on 127.0.0.1.')
  }
  return {
    plugins: [react(), tailwindcss(), {
      name: 'local-api-development-guard',
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          // The proxy holds the secret: do not let a foreign web page use it.
          if (request.url?.startsWith('/api/')) {
            if (request.headers.host !== '127.0.0.1:5173'
                || request.headers['sec-fetch-site'] !== 'same-origin'
                || (request.headers.origin && request.headers.origin !== 'http://127.0.0.1:5173')) {
              response.writeHead(403, { 'Content-Type': 'application/json' })
              response.end('{"code":"DEV_ORIGIN_FORBIDDEN"}')
              return
            }
          }
          next()
        })
      },
    }],
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      cors: false,
      proxy: {
        '/api/health': { target: backendUrl.origin, rewrite: () => '/health' },
        '/api/': {
          target: backendUrl.origin,
          configure(proxy) {
            proxy.on('proxyReq', (proxyRequest) => {
              // Overwrite incoming values; never expose the token through import.meta.env.
              proxyRequest.setHeader('X-JBStock-Local-Token', token)
            })
          },
        },
      },
    },
  }
})
