/**
 * AuraCommand Electron 主入口
 * 重构后的薄入口：仅负责初始化 + 组装各模块
 */
import { app, BrowserWindow, clipboard, nativeImage } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import log from 'electron-log'

import './polyfills'

import dbHelper from './db'
import vectorDb from './vectorDb'
import { autoBackup } from './db/connection'
import { registerAllIpcHandlers, IpcContext } from './ipc/index'
import { createWindow, createTray, registerGlobalShortcuts, setVaultPath, getVaultPath, getMainWindow, setMainWindow, getIsQuitting, setIsQuitting } from './window'
import { setupWatcher, loadReferenceWatchers, closeAllReferenceWatchers } from './services/watcher'
import { startProactiveSystem, stopProactiveSystem } from './services/proactive'
import { loadAllCronWorkflows } from './services/cron'
import { mcpManager } from './mcpClient'
import { startTaskNotifier, stopTaskNotifier } from './services/taskNotifier'

const gotSingleInstanceLock = app.requestSingleInstanceLock()

if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const win = getMainWindow()
    if (!win) return

    if (win.isMinimized()) {
      win.restore()
    }
    if (!win.isVisible()) {
      win.show()
    }
    if (win.isMaximized()) {
      win.focus()
    } else {
      win.show()
      win.focus()
    }
  })
}

// ─── 进程错误处理 ───────────────────────────────────────────
log.info('Node version:', process.version)
log.info('Electron version:', process.versions.electron)
log.info('Chrome version:', process.versions.chrome)

process.on('uncaughtException', (error) => {
  fs.appendFileSync('crash.log', `Uncaught Exception: ${error.stack || error}\n`)
  process.exit(1)
})

process.on('unhandledRejection', (reason, _promise) => {
  fs.appendFileSync('crash.log', `Unhandled Rejection: ${reason}\n`)
})

// ─── 环境变量 ────────────────────────────────────────────────
process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(__dirname, '../public')

// ─── Vault 初始化 ────────────────────────────────────────────
function initVault() {
  const vaultPath = path.join(app.getPath('documents'), 'AuraVault')
  log.info('Vault Path:', vaultPath)

  try {
    fs.mkdirSync(vaultPath, { recursive: true })
    fs.mkdirSync(path.join(vaultPath, 'Memos'), { recursive: true })
    fs.mkdirSync(path.join(vaultPath, 'Files'), { recursive: true })
    fs.mkdirSync(path.join(vaultPath, 'VectorDB'), { recursive: true })
  } catch (e) {
    log.error('Failed to create vault directory:', e)
  }

  dbHelper.setDatabasePath(vaultPath)
  vectorDb.setVectorDbPath(vaultPath)
  setVaultPath(vaultPath)
}

// ─── IPC 上下文 ──────────────────────────────────────────────
const chatAbortController: { current: AbortController | null } = { current: null }

function buildIpcContext(): IpcContext {
  return {
    vaultPath: getVaultPath(),
    getWin: () => getMainWindow(),
    chatAbortController,
    setChatAbortController: (ac: AbortController | null) => { chatAbortController.current = ac },
  }
}

// ─── App 生命周期 ────────────────────────────────────────────
if (gotSingleInstanceLock) {
app.whenReady().then(async () => {
  log.info('App ready, initializing...')
  try {
    // 1. 初始化 Vault 目录 + 数据库
    initVault()
    await dbHelper.initDatabase()

    // 1.5 P0 #1：迁移老版本的明文 API Key 到 Keychain（幂等）
    try {
      const { migratePlaintextApiKeys } = await import('./util/apiKeyStore')
      const r = await migratePlaintextApiKeys()
      log.info('[Startup] API Key 迁移:', r)
    } catch (migErr: any) {
      log.warn('[Startup] API Key 迁移失败（可忽略）:', migErr?.message)
    }

    // 2. 注册所有 IPC 处理器
    log.info('Starting IPC handler registration...')
    registerAllIpcHandlers(buildIpcContext())
    log.info('IPC handler registration completed')

    // 3. 创建窗口 + 托盘 + 快捷键
    createWindow()
    createTray()
    registerGlobalShortcuts()

    // 4. 启动主动建议系统
    startProactiveSystem(getMainWindow)

    // 5. 加载定时工作流
    loadAllCronWorkflows()

    // 6. 设置文件监听
    setupWatcher(getVaultPath(), getMainWindow())
    loadReferenceWatchers()
    log.info('Watcher set up complete.')

    // 7. 自动连接 MCP Servers
    try {
      await mcpManager.autoConnect()
    } catch (mcpErr) {
      log.error('[MCP] autoConnect failed during startup:', mcpErr)
    }

    // 8. 启动剪贴板监听
    startClipboardWatcher(getMainWindow)

    // 9. 启动逾期任务通知
    startTaskNotifier(getMainWindow)

    // 10. 启动时自动备份 + 每6小时定期备份
    autoBackup(getVaultPath())
    const autoBackupInterval = setInterval(() => autoBackup(getVaultPath()), 6 * 60 * 60 * 1000)

    // 在退出时清理
    app.on('before-quit', () => {
      clearInterval(autoBackupInterval)
    })
  } catch (err) {
    log.error('Error during initialization:', err)
  }
})
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.on('before-quit', async () => {
  setIsQuitting(true)

  if (clipboardCheckInterval) {
    clearInterval(clipboardCheckInterval)
    clipboardCheckInterval = null
  }

  stopTaskNotifier()
  stopProactiveSystem()
  closeAllReferenceWatchers()

  try {
    await dbHelper.checkpoint()
    log.info('[Main] Database checkpoint completed before quit')
  } catch (err) {
    log.error('[Main] Database checkpoint failed before quit:', err)
  }

  mcpManager.disconnectAll().catch((err) => {
    log.error('[MCP] disconnectAll error on quit:', err)
  })
})

let lastClipboardContent: string | null = null
let clipboardCheckInterval: NodeJS.Timeout | null = null

function startClipboardWatcher(win: () => BrowserWindow | null) {
  if (clipboardCheckInterval) return

  clipboardCheckInterval = setInterval(() => {
    try {
      const image = clipboard.readImage()
      if (!image.isEmpty()) {
        const content = image.toDataURL()
        if (content !== lastClipboardContent) {
          lastClipboardContent = content
          const w = win()
          if (w && !w.isDestroyed()) {
            w.webContents.send('clipboard-changed', { type: 'image', content })
          }
        }
        return
      }

      const text = clipboard.readText()
      if (text && text.trim() && text !== lastClipboardContent) {
        lastClipboardContent = text
        const w = win()
        if (w && !w.isDestroyed()) {
          w.webContents.send('clipboard-changed', { type: 'text', content: text })
        }
      }
    } catch (err) {
      log.error('[Clipboard] Watcher error:', err)
    }
  }, 1000)
}

export function stopClipboardWatcher() {
  if (clipboardCheckInterval) {
    clearInterval(clipboardCheckInterval)
    clipboardCheckInterval = null
  }
}
