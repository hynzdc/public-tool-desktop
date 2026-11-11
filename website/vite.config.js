import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  root: path.resolve(__dirname),
  plugins: [vue()],
  publicDir: 'public',
  base: './',
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true
  },
  server: {
    host: '127.0.0.1',
    port: 4177,
    strictPort: true
  }
})
