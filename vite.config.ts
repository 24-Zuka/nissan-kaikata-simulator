/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// @types/node を追加せずに base を環境変数で切替可能にするための最小宣言。
declare const process: { env: Record<string, string | undefined> }

// base は GitHub Pages 等のサブパス公開に対応するため環境変数で切替可能にする。
// 例: GitHub Pages なら VITE_BASE=/<repo-name>/ を指定。未指定なら '/' (Vercel/Netlify向け)。
const base = process.env.VITE_BASE ?? '/'

// https://vitejs.dev/config/
export default defineConfig({
  base,
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
