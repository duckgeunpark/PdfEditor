import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    // Pre-bundle pdfjs-dist fully at dev-server startup rather than
    // discovering pieces of it lazily at runtime.
    include: ['pdfjs-dist'],
  },
  server: {
    watch: {
      // Tooling/session state directories (e.g. AI coding assistant state)
      // can live inside a project folder and get written to continuously,
      // independent of any real source change. Vite's default watcher
      // covers the whole project root, so without this it treats that
      // churn as a file change and fires a full-reload — silently wiping
      // whatever was loaded in the browser (an uploaded PDF, an open editor
      // session, etc.) at an arbitrary moment.
      ignored: ['**/.omc/**', '**/.claude/**'],
    },
  },
})
