import { Notification } from 'electron'
import log from 'electron-log'
import dbHelper from '../db'

let checkInterval: NodeJS.Timeout | null = null
let initialCheckTimer: NodeJS.Timeout | null = null

export function startTaskNotifier(getWin: () => any) {
  if (checkInterval) return

  const checkOverdueTasks = async () => {
    try {
      const enabled = await getTaskNotifyEnabled()
      if (!enabled) return

      const now = Math.floor(Date.now() / 1000)
      const result = await dbHelper.allQuery(
        `SELECT COUNT(*) as count FROM tasks WHERE status != 'done' AND due_date != '' AND due_date IS NOT NULL AND CAST(strftime('%s', due_date) AS INTEGER) < ?`,
        [now]
      )

      const count = result?.[0]?.count || 0
      if (count === 0) return

      if (Notification.isSupported()) {
        const notification = new Notification({
          title: 'AuraCommand 逾期提醒',
          body: `您有 ${count} 个逾期待办需要处理`,
          silent: false,
        })

        notification.on('click', () => {
          const win = getWin()
          if (win) {
            if (win.isMinimized()) win.restore()
            if (!win.isVisible()) win.show()
            win.focus()
            win.webContents.send('navigate-to-tasks')
          }
        })

        notification.show()
      }
    } catch (err) {
      log.error('[TaskNotifier] Check failed:', err)
    }
  }

  checkInterval = setInterval(checkOverdueTasks, 60 * 60 * 1000)

  initialCheckTimer = setTimeout(checkOverdueTasks, 30 * 1000)
}

export function stopTaskNotifier() {
  if (checkInterval) {
    clearInterval(checkInterval)
    checkInterval = null
  }
  if (initialCheckTimer) {
    clearTimeout(initialCheckTimer)
    initialCheckTimer = null
  }
}

async function getTaskNotifyEnabledFromDB(): Promise<boolean> {
  try {
    const row = await dbHelper.getQuery(
      "SELECT value FROM app_settings WHERE key = 'task_notify_enabled'"
    )
    return row?.value !== 'false'
  } catch {
    return true
  }
}

export async function setTaskNotifyEnabled(enabled: boolean) {
  try {
    await dbHelper.runQuery(
      "INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES ('task_notify_enabled', ?, datetime('now'))",
      [String(enabled)]
    )
  } catch (err) {
    log.error('[TaskNotifier] Failed to save config:', err)
  }
}

export async function getTaskNotifyEnabled(): Promise<boolean> {
  return getTaskNotifyEnabledFromDB()
}
