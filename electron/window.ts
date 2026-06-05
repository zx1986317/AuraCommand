/**
 * 窗口/托盘/快捷键管理
 */
import { app, BrowserWindow, Tray, Menu, nativeImage, globalShortcut, shell } from 'electron'
import path from 'node:path'
import log from 'electron-log'

let win: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
let vaultPath: string = ''

export function setVaultPath(p: string) { vaultPath = p }
export function getVaultPath() { return vaultPath }
export function getMainWindow() { return win }
export function setMainWindow(w: BrowserWindow | null) { win = w }
export function getIsQuitting() { return isQuitting }
export function setIsQuitting(v: boolean) { isQuitting = v }

export function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    resizable: true,
    maximizable: true,
    hasShadow: true,
    show: false,
    backgroundColor: '#F0FDFA',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      spellcheck: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  win.once('ready-to-show', () => {
    win?.show()
  })

  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      win?.hide()
    }
    return false
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    log.info('Loading URL:', process.env.VITE_DEV_SERVER_URL)
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    const distPath = path.join(__dirname, '../dist')
    const indexPath = path.join(distPath, 'index.html')
    log.info('App isPackaged:', app.isPackaged)
    log.info('__dirname:', __dirname)
    log.info('app.getAppPath():', app.getAppPath())
    log.info('Loading file:', indexPath)
    win.loadFile(indexPath)
  }

  if (!app.isPackaged) {
    win.webContents.openDevTools()
  }

  win.on('maximize', () => {
    win?.webContents.send('window-maximized')
  })
  win.on('unmaximize', () => {
    win?.webContents.send('window-unmaximized')
  })
}

export function createTray() {
  const publicPath = process.env.VITE_PUBLIC || path.join(__dirname, '../public')
  const iconPath = path.join(publicPath, 'favicon.ico')
  let icon = nativeImage.createFromPath(iconPath)

  if (icon.isEmpty()) {
    const canvas = nativeImage.createEmpty()
    icon = canvas
  }

  tray = new Tray(icon)

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示指挥座舱',
      click: () => {
        win?.show()
        win?.focus()
      }
    },
    {
      label: '打开 Vault 目录',
      click: () => {
        shell.openPath(vaultPath)
      }
    },
    { type: 'separator' },
    {
      label: '退出应用',
      click: () => {
        isQuitting = true
        app.quit()
      }
    }
  ])

  tray.setToolTip('AuraCommand - 灵动指挥舱')
  tray.setContextMenu(contextMenu)

  tray.on('double-click', () => {
    if (win?.isVisible()) {
      win.hide()
    } else {
      win?.show()
      win?.focus()
    }
  })
}

export function registerGlobalShortcuts() {
  const ret = globalShortcut.register('Alt+Space', () => {
    if (win?.isVisible() && win?.isFocused()) {
      win.hide()
    } else {
      win?.show()
      win?.focus()
    }
  })

  if (!ret) {
    log.error('Global shortcut registration failed')
  }
}
