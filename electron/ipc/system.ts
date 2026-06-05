/**
 * 系统相关 IPC 处理器
 */
import { app, dialog } from 'electron'
import { spawn } from 'child_process'
import { IpcModule, IpcContext } from './index'
import dbHelper from '../db'
import { isPathWithinVault } from '../pathSecurity'
import {
  SetVaultPathSchema,
  ConfigKeySchema,
  SetConfigSchema,
  SetSearxngUrlSchema,
  SetSettingSchema,
  SwitchVaultSchema,
  ShowItemInFolderSchema,
  OpenPathSchema,
  OpenExternalSchema,
  SetGlobalShortcutSchema,
  validateInput,
} from './schemas'
import {
  withErrorHandling,
  logInfo,
  ErrorCategory,
  ErrorLevel,
  AppError,
} from '../errorHandler'

export function createSystemModule(ctx: IpcContext): IpcModule {
  const getWin = () => ctx.getWin()

  const normalizePathPayload = (payload: string | { path?: string } | undefined) => {
    if (typeof payload === 'string') return payload
    return payload?.path || ''
  }

  return {
    'minimize-window': async () => {
      return withErrorHandling(async () => {
        const win = ctx.getWin()
        if (win) win.minimize()
      }, 'minimize-window')
    },
    'maximize-window': async () => {
      return withErrorHandling(async () => {
        const win = ctx.getWin()
        if (win) {
          if (win.isMaximized()) win.unmaximize()
          else win.maximize()
        }
      }, 'maximize-window')
    },
    'close-window': async () => {
      return withErrorHandling(async () => {
        const win = ctx.getWin()
        if (win) win.close()
      }, 'close-window')
    },
    'is-window-maximized': async () => {
      return withErrorHandling(async () => {
        const win = ctx.getWin()
        return win ? win.isMaximized() : false
      }, 'is-window-maximized')
    },
    'is-maximized': async () => {
      return withErrorHandling(async () => {
        const win = ctx.getWin()
        return win ? win.isMaximized() : false
      }, 'is-maximized')
    },
    'get-vault-config': async () => {
      return withErrorHandling(async () => {
        return { path: ctx.vaultPath }
      }, 'get-vault-config')
    },
    'toggle-devtools': async () => {
      return withErrorHandling(async () => {
        const win = ctx.getWin()
        if (win) win.webContents.toggleDevTools()
      }, 'toggle-devtools')
    },
    'open-external': async (_: any, { url }: { url: string }) => {
      return withErrorHandling(async () => {
        const validated = validateInput(OpenExternalSchema, { url }, 'open-external')
        const { shell } = await import('electron')
        await shell.openExternal(validated.url)
      }, 'open-external', getWin())
    },
    'show-item-in-folder': async (_: any, payload: string | { path: string }) => {
      return withErrorHandling(async () => {
        const filePath = normalizePathPayload(payload)
        if (!filePath) {
          throw new AppError('路径不能为空', ErrorCategory.VALIDATION, ErrorLevel.WARNING)
        }
        if (!isPathWithinVault(filePath, ctx.vaultPath)) {
          throw new AppError('路径不在工作区范围内', ErrorCategory.VALIDATION, ErrorLevel.ERROR)
        }
        validateInput(ShowItemInFolderSchema, { path: filePath }, 'show-item-in-folder')
        const { shell } = await import('electron')
        shell.showItemInFolder(filePath)
      }, 'show-item-in-folder', getWin())
    },
    'install-playwright-browser': async () => {
      return new Promise<{ success: boolean; error?: string }>((resolve) => {
        const child = spawn('npx', ['playwright', 'install', 'chromium'], {
          shell: true,
          stdio: 'pipe',
        })
        let stdout = ''
        let stderr = ''
        child.stdout?.on('data', (data: Buffer) => { stdout += data.toString() })
        child.stderr?.on('data', (data: Buffer) => { stderr += data.toString() })
        child.on('close', (code) => {
          if (code === 0) {
            resolve({ success: true })
          } else {
            resolve({ success: false, error: stderr || stdout || `退出码 ${code}` })
          }
        })
        child.on('error', (err) => {
          resolve({ success: false, error: err.message })
        })
      })
    },
    'select-directory': async () => {
      return withErrorHandling(async () => {
        const win = ctx.getWin()
        if (!win) return { canceled: true, filePaths: [] }
        const result = await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
        return result
      }, 'select-directory')
    },
    'select-files': async (_: any, { filters }: { filters?: any[] } = {}) => {
      return withErrorHandling(async () => {
        const win = ctx.getWin()
        if (!win) return { canceled: true, filePaths: [] }
        const result = await dialog.showOpenDialog(win, {
          properties: ['openFile', 'multiSelections'],
          filters: filters || [{ name: 'All Files', extensions: ['*'] }],
        })
        return result
      }, 'select-files')
    },
    'get-app-version': async () => {
      return withErrorHandling(async () => {
        return app.getVersion()
      }, 'get-app-version')
    },
    'get-app-path': async () => {
      return withErrorHandling(async () => {
        return app.getPath('userData')
      }, 'get-app-path')
    },
    'get-vault-path': async () => {
      return withErrorHandling(async () => {
        return ctx.vaultPath
      }, 'get-vault-path')
    },
    'set-vault-path': async (_: any, { path: vaultPath }: { path: string }) => {
      return withErrorHandling(async () => {
        if (!vaultPath || typeof vaultPath !== 'string') {
          throw new AppError('无效的库路径', ErrorCategory.VALIDATION, ErrorLevel.WARNING)
        }
        const validated = validateInput(SetVaultPathSchema, { path: vaultPath }, 'set-vault-path')
        await dbHelper.runQuery('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', ['vaultPath', validated.path])
        logInfo('Vault path set', { path: validated.path })
        return { success: true }
      }, 'set-vault-path', getWin())
    },
    'get-config': async (_: any, { key }: { key: string }) => {
      return withErrorHandling(async () => {
        const validated = validateInput(ConfigKeySchema, { key }, 'get-config')
        const row = await dbHelper.getQuery('SELECT value FROM app_settings WHERE key = ?', [validated.key])
        return row ? row.value : null
      }, 'get-config')
    },
    'set-config': async (_: any, { key, value }: { key: string, value: any }) => {
      return withErrorHandling(async () => {
        const validated = validateInput(SetConfigSchema, { key, value }, 'set-config')
        await dbHelper.runQuery('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', [validated.key, JSON.stringify(validated.value)])
        logInfo('Config set', { key: validated.key })
        return { success: true }
      }, 'set-config', getWin())
    },
    'load-plugins': async () => {
      return withErrorHandling(async () => {
        return []
      }, 'load-plugins')
    },
    'get-plugins': async () => {
      return withErrorHandling(async () => {
        return []
      }, 'get-plugins')
    },
    'get-plugin-tool-prompt': async () => {
      return withErrorHandling(async () => {
        return ''
      }, 'get-plugin-tool-prompt')
    },
    'execute-plugin-tool': async () => {
      return withErrorHandling(async () => {
        return { success: false, message: 'Plugin system removed' }
      }, 'execute-plugin-tool')
    },
    'toggle-plugin': async () => {
      return withErrorHandling(async () => {
        return { success: false, error: 'Plugin system removed' }
      }, 'toggle-plugin')
    },
    'get-searxng-status': async () => {
      return withErrorHandling(async () => {
        const config = await dbHelper.getQuery("SELECT value FROM app_settings WHERE key = 'searxngUrl'")
        let url = ''
        if (config) {
          try { url = typeof config.value === 'string' ? JSON.parse(config.value) : config.value } catch { url = config.value }
        }
        return { configured: !!url, url: url || '' }
      }, 'get-searxng-status')
    },
    'set-searxng-url': async (_: any, { url }: { url: string }) => {
      return withErrorHandling(async () => {
        const validated = validateInput(SetSearxngUrlSchema, { url }, 'set-searxng-url')
        await dbHelper.runQuery("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('searxngUrl', ?)", [JSON.stringify(validated.url)])
        logInfo('Searxng URL set', { url: validated.url })
        return { success: true }
      }, 'set-searxng-url', getWin())
    },
    'check-searxng-connection': async (_: any, { url }: { url: string }) => {
      try {
        if (!url) return { success: false, error: 'URL 为空' }
        const cleanUrl = url.replace(/\/search\/?$/, '').replace(/\/+$/, '')
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 5000)
        const res = await fetch(`${cleanUrl}/search?q=test&format=json`, { signal: controller.signal })
        clearTimeout(timeout)
        if (res.ok) return { success: true }
        return { success: false, error: `HTTP ${res.status}` }
      } catch (err: any) {
        return { success: false, error: err?.message || '连接失败' }
      }
    },
    'restart-app': async () => {
      return withErrorHandling(async () => {
        app.relaunch()
        app.exit(0)
      }, 'restart-app')
    },
    'quit-app': async () => {
      return withErrorHandling(async () => {
        app.quit()
      }, 'quit-app')
    },
    'window-min': async () => {
      return withErrorHandling(async () => {
        const win = ctx.getWin()
        if (win) win.minimize()
      }, 'window-min')
    },
    'window-max': async () => {
      return withErrorHandling(async () => {
        const win = ctx.getWin()
        if (win) {
          if (win.isMaximized()) win.unmaximize()
          else win.maximize()
        }
      }, 'window-max')
    },
    'window-close': async () => {
      return withErrorHandling(async () => {
        const win = ctx.getWin()
        if (win) {
          const { setIsQuitting } = await import('../window')
          setIsQuitting(true)
          app.quit()
        }
      }, 'window-close')
    },
    'open-path': async (_: any, payload: string | { path: string }) => {
      return withErrorHandling(async () => {
        const filePath = normalizePathPayload(payload)
        if (!filePath) {
          throw new AppError('路径不能为空', ErrorCategory.VALIDATION, ErrorLevel.WARNING)
        }
        if (!isPathWithinVault(filePath, ctx.vaultPath)) {
          throw new AppError('路径不在工作区范围内', ErrorCategory.VALIDATION, ErrorLevel.ERROR)
        }
        validateInput(OpenPathSchema, { path: filePath }, 'open-path')
        const { shell } = await import('electron')
        shell.openPath(filePath)
      }, 'open-path', getWin())
    },
    'select-folder': async () => {
      return withErrorHandling(async () => {
        const win = ctx.getWin()
        if (!win) return { canceled: true, filePaths: [] }
        const result = await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
        return result
      }, 'select-folder')
    },
    'select-file-dialog': async () => {
      return withErrorHandling(async () => {
        const win = ctx.getWin()
        if (!win) return { canceled: true, filePaths: [] }
        const result = await dialog.showOpenDialog(win, {
          properties: ['openFile', 'multiSelections'],
          filters: [{ name: 'All Files', extensions: ['*'] }],
        })
        return result
      }, 'select-file-dialog')
    },
    'open-plugins-folder': async () => {
      return withErrorHandling(async () => {
        return { success: false }
      }, 'open-plugins-folder')
    },
    'get-setting': async (_: any, { key }: { key: string }) => {
      return withErrorHandling(async () => {
        const validated = validateInput(ConfigKeySchema, { key }, 'get-setting')
        const row = await dbHelper.getQuery('SELECT value FROM app_settings WHERE key = ?', [validated.key])
        if (!row) return null
        try { return typeof row.value === 'string' ? JSON.parse(row.value) : row.value } catch { return row.value }
      }, 'get-setting')
    },
    'set-setting': async (_: any, { key, value }: { key: string, value: any }) => {
      return withErrorHandling(async () => {
        const validated = validateInput(SetSettingSchema, { key, value }, 'set-setting')
        await dbHelper.runQuery('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', [validated.key, JSON.stringify(validated.value)])
        logInfo('Setting set', { key: validated.key })
        return { success: true }
      }, 'set-setting', getWin())
    },
    'switch-vault': async (_: any, { path: newPath }: { path: string }) => {
      return withErrorHandling(async () => {
        if (!newPath || typeof newPath !== 'string') {
          throw new AppError('无效的库路径', ErrorCategory.VALIDATION, ErrorLevel.WARNING)
        }
        const validated = validateInput(SwitchVaultSchema, { path: newPath }, 'switch-vault')
        await dbHelper.runQuery('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', ['vaultPath', validated.path])
        logInfo('Vault switched', { path: validated.path })
        return { success: true, requireRestart: true }
      }, 'switch-vault', getWin())
    },
    'get-cron-status': async () => {
      return withErrorHandling(async () => {
        return { running: true }
      }, 'get-cron-status')
    },
    'set-global-shortcut': async (_: any, { shortcut, action }: { shortcut: string, action: string }) => {
      return withErrorHandling(async () => {
        if (!shortcut || !action) {
          throw new AppError('快捷键和操作不能为空', ErrorCategory.VALIDATION, ErrorLevel.WARNING)
        }
        validateInput(SetGlobalShortcutSchema, { shortcut, action }, 'set-global-shortcut')
        return { success: true }
      }, 'set-global-shortcut', getWin())
    },
    'get-global-shortcut': async () => {
      return withErrorHandling(async () => {
        return { shortcut: 'Alt+Space', action: 'toggle-window' }
      }, 'get-global-shortcut')
    },
  }
}
