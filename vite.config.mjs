import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// /api and /uploads are forwarded to the Node backend (port 5000)
export default defineConfig({
  plugins: [react()],
  server: {
    port: 8000,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:5000',
      '/uploads': 'http://localhost:5000',
    },
  },
})
