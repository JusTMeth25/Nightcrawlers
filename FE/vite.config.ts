import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const pages = (mode: string): Record<string, string> =>
  mode === 'production' ? { main: 'index.html' } : { main: 'index.html', gameDev: 'game-dev.html' }

const src = (path: string) => fileURLToPath(new URL(`./src/${path}`, import.meta.url))

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': src('shared'),
      '@data': src('data'),
      '@game': src('game'),
    },
  },
  server: {
    host: true,
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: false },
    },
  },
  build: {
    rollupOptions: {
      input: pages(mode),
    },
  },
}))
