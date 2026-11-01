// D:\Project\mk-crackers-store\backend\vite.config.mjs

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
  server: {
    port: 8000,
    strictPort: true,
    watch: {
      usePolling: true,
      interval: 300,
    },
    proxy: {
      '/api': 'http://localhost:5000',
      '/uploads': 'http://localhost:5000',
    },
  },
})























// import { defineConfig } from 'vite'
// import react from '@vitejs/plugin-react'

// // Dev only: /api and /uploads are forwarded to the Node backend (port 5000).
// // Production: "npm run build" writes to dist/, and Express (server/server.js) serves it.
// export default defineConfig({
//   plugins: [react()],
//   build: {
//     outDir: 'dist',
//   },
//   server: {
//     port: 8000,
//     strictPort: true,
//     proxy: {
//       '/api': 'http://localhost:5000',
//       '/uploads': 'http://localhost:5000',
//     },
//   },
// })