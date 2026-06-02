import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        mini: resolve(__dirname, 'mini.html'),
        medium: resolve(__dirname, 'medium.html'),
        full: resolve(__dirname, 'full.html')
      }
    }
  },
  server: {
    port: 4825,
    strictPort: true, // Fail if port is already in use
    open: false, // Disabled - start.bat handles browser opening
    proxy: {
      '/api': {
        target: 'http://localhost:4824',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      },
      '/ws': {
        target: 'ws://localhost:4824',
        ws: true
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    include: ['src/**/*.{test,spec}.{js,jsx}']
  }
})
