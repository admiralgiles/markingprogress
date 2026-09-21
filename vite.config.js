import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Relative asset paths, so the same build works whether it is served from
  // the root of a domain or from a subfolder like /markingprogress/ on
  // GitHub Pages. Saves having to rebuild for a different host.
  base: './',
  server: {
    port: 3000,
    host: true,
  },
})
