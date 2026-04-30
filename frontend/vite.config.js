import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: [
      'welcoming-youthfulness-production-11c9.up.railway.app'
    ]
  },
  preview: {
    allowedHosts: [
      'welcoming-youthfulness-production-11c9.up.railway.app'
    ]
  }
})