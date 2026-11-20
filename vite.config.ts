import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { handleApi } from './server/handlers.js'

function adminApi(): Plugin {
  return {
    name: 'admin-api',
    configureServer(server) {
      Object.assign(process.env, loadEnv(server.config.mode, server.config.root, ''))
      server.middlewares.use(async (req: any, res: any, next: any) => {
        const url = String(req.url ?? '')
        const path = url.split('?')[0]
        if (path !== '/api/schedule' && path !== '/api/chat' && path !== '/api/roster') return next()
        let raw = ''
        for await (const chunk of req) {
          raw += typeof chunk === 'string' ? chunk : chunk.toString()
        }
        const result = await handleApi(req.method ?? 'GET', url, req.headers, raw)
        res.statusCode = result.status
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify(result.body))
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), adminApi()],
  server: {
    port: 5173,
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        entryFileNames: 'a/[hash].js',
        chunkFileNames: 'a/[hash].js',
        assetFileNames: 'a/[hash][extname]',
      },
    },
  },
})
