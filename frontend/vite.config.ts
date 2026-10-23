import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// https://vite.dev/config/
// `npm run build`        -> dist/ (triển khai web bình thường, vd. Vercel)
// `npm run build:single` -> dist-single/index.html: MỘT file duy nhất chứa sẵn JS, CSS và ảnh
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), ...(mode === 'single' ? [viteSingleFile()] : [])],
  // Import "@/..." tính từ thư mục frontend/ (khớp "paths" trong tsconfig.app.json)
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  build: mode === 'single' ? { outDir: 'dist-single' } : {},
}))
