import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // './' base is required so Electron can load index.html via file:// protocol
  base: process.env.ELECTRON === '1' ? './' : '/',
  server: {
    port: 5174,
    open: true,
  },
})

