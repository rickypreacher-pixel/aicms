import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Stamp a human-readable build id at build time so devices can report which version they're on.
  define: {
    __APP_BUILD__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC'),
  },
  plugins: [react()],
  // './' base is required so Electron can load index.html via file:// protocol
  base: process.env.ELECTRON === '1' ? './' : '/',
  server: {
    port: 5174,
    open: true,
  },
})

