import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Served from the apex path of portal.wealthig.com — never a repo subpath.
  base: '/',
  server: {
    historyApiFallback: true
  }
})
