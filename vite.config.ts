import { defineConfig } from 'vite'
import path from 'node:path'
import fs from 'node:fs'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'

/**
 * 构建 Electron 主进程后，将 main.js 重命名为 main.cjs
 * 因为 package.json 声明了 "type": "module"，而 vite-plugin-electron 0.14
 * 只能输出 CJS 格式，Node.js 会拒绝在 ESM 模式下执行 require()
 */
function renameMainToCjsPlugin() {
  return {
    name: 'rename-main-to-cjs',
    closeBundle() {
      const mainJs = path.resolve(__dirname, 'dist-electron/main.js')
      const mainCjs = path.resolve(__dirname, 'dist-electron/main.cjs')
      if (fs.existsSync(mainJs)) {
        fs.renameSync(mainJs, mainCjs)
      }
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['better-sqlite3', 'sqlite3', '@lancedb/lancedb', 'canvas', 'pdfjs-dist', /^pdfjs-dist\/.*/, 'xlsx', 'archiver', 'chokidar', '@modelcontextprotocol/sdk', /^@modelcontextprotocol\/sdk\/.*/, 'webdav', '@aws-sdk/client-s3', 'jieba-wasm'],
            },
          },
        },
      },
      {
        entry: 'electron/preload.ts',
        onstart(options) {
          options.reload()
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
    ]),
    renderer(),
    renameMainToCjsPlugin(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
