import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  root: 'storefront',
  envDir: projectRoot,
  plugins: [react()],
  build: {
    outDir: fileURLToPath(new URL('./dist/storefront', import.meta.url)),
    emptyOutDir: true,
  },
  server: {
    proxy: { '/api': 'http://localhost:3001' },
  },
})
