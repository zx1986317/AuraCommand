/**
 * 主动建议系统
 * 日程提醒、AI 建议等主动式交互
 */
import { BrowserWindow, Notification } from 'electron'
import log from 'electron-log'
import dbHelper from '../db'
import * as modelRouter from '../modelRouter'
import { resolvePreferredModel } from '../modelPreference'
import { executeWorkflowInternal } from './workflow'

const notifiedSchedulePhases = new Map<string, number>()
const PHASE_COOLDOWN_MS = 5 * 60 * 1000

let scheduleCheckTimer: NodeJS.Timeout | null = null
let suggestionTimer: NodeJS.Timeout | null = null

export function startProactiveSystem(winRef: () => BrowserWindow | null) {
  checkUpcomingSchedules(winRef())
  scheduleCheckTimer = setInterval(() => checkUpcomingSchedules(winRef()), 60 * 1000)
  suggestionTimer = setInterval(() => generateProactiveSuggestions(winRef()), 30 * 60 * 1000)
}

export function stopProactiveSystem() {
  if (scheduleCheckTimer) { clearInterval(scheduleCheckTimer); scheduleCheckTimer = null }
  if (suggestionTimer) { clearInterval(suggestionTimer); suggestionTimer = null }
}

async function checkUpcomingSchedules(win: BrowserWindow | null) {
  try {
    const now = new Date()
    const in30Min = new Date(now.getTime() + 30 * 60 * 1000)

    const schedules = await dbHelper.allQuery(
      `SELECT * FROM schedules WHERE status = 'pending' AND start_time >= ? AND start_time <= ?`,
      [now.toISOString(), in30Min.toISOString()]
    )

    for (const schedule of schedules) {
      const startTime = new Date(schedule.start_time)
      const minutesLeft = Math.round((startTime.getTime() - now.getTime()) / 60000)

      let phase: string | null = null
      let phaseTitle = ''
      let phaseBody = ''

      if (minutesLeft <= 0 && minutesLeft > -2) {
        phase = 'start'
        phaseTitle = '🚀 日程开始'
        phaseBody = `「${schedule.title}」正在进行中`
      } else if (minutesLeft <= 5 && minutesLeft > 0) {
        phase = '5min'
        phaseTitle = '⏰ 日程即将开始'
        phaseBody = `「${schedule.title}」将在 5 分钟后开始，请做好准备`
      } else if (minutesLeft <= 15 && minutesLeft > 10) {
        phase = '15min'
        phaseTitle = '📢 日程提醒'
        phaseBody = `「${schedule.title}」将在 15 分钟后开始`
      }

      if (!phase) continue

      const key = `${schedule.id}_${phase}`
      const lastNotified = notifiedSchedulePhases.get(key) || 0
      if (Date.now() - lastNotified < PHASE_COOLDOWN_MS) continue
      notifiedSchedulePhases.set(key, Date.now())

      if (Notification.isSupported()) {
        const notif = new Notification({ title: phaseTitle, body: phaseBody, silent: false })
        notif.on('click', () => {
          if (win) {
            if (win.isMinimized()) win.restore()
            win.show()
            win.focus()
          }
        })
        notif.show()
      }

      if (win && !win.isDestroyed()) {
        win.webContents.send('proactive-notification', {
          type: 'schedule_reminder',
          title: phaseTitle,
          message: phaseBody,
          scheduleId: schedule.id,
          timestamp: Date.now()
        })
      }

      if (phase === 'start') {
        try {
          const dueWorkflows = await dbHelper.allQuery(
            "SELECT * FROM agent_workflows WHERE trigger_type = 'on_schedule_due' AND enabled = 1"
          )
          for (const wf of dueWorkflows) {
            const tc = typeof wf.trigger_config === 'string' ? JSON.parse(wf.trigger_config) : (wf.trigger_config || {})
            const matchCategory = tc?.category || ''
            const matchTitle = tc?.title_match || ''
            if (matchCategory && schedule.category !== matchCategory) continue
            if (matchTitle && !schedule.title.includes(matchTitle)) continue
            log.info(`[ScheduleDue] Triggering workflow ${wf.id} for schedule ${schedule.id}`)
            const res = await executeWorkflowInternal(wf.id)
            if (res.success && win && !win.isDestroyed()) {
              win.webContents.send('workflow-cron-completed', {
                workflowId: wf.id, result: res.result, logId: res.logId
              })
            }
          }
        } catch (wfErr: any) {
          log.error('[ScheduleDue] Failed to trigger workflow:', wfErr.message)
        }
      }
    }

    const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000
    for (const [key, timestamp] of notifiedSchedulePhases.entries()) {
      if (timestamp < twoDaysAgo) {
        notifiedSchedulePhases.delete(key)
      }
    }
  } catch (err) {
    log.error('Proactive schedule check failed:', err)
  }
}

async function generateProactiveSuggestions(win: BrowserWindow | null) {
  try {
    const now = new Date()
    const hour = now.getHours()

    let suggestionType = ''
    let prompt = ''
    if (hour >= 8 && hour < 10) {
      suggestionType = 'morning_briefing'
      prompt = '现在是早晨，请为用户生成一个简短的今日工作建议（50字以内），包括优先级最高的3件事'
    } else if (hour >= 12 && hour < 14) {
      suggestionType = 'midday_check'
      prompt = '现在是中午，请给用户一个简短的午间提醒（50字以内），提醒休息和下午重点'
    } else if (hour >= 17 && hour < 19) {
      suggestionType = 'evening_review'
      prompt = '现在是傍晚，请给用户一个简短的晚间建议（50字以内），提醒回顾今日完成情况'
    } else {
      return
    }

    const schedules = await dbHelper.allQuery(
      `SELECT * FROM schedules WHERE status = 'pending' AND start_time >= ? ORDER BY start_time ASC LIMIT 5`,
      [now.toISOString()]
    )
    const pendingSchedules = schedules.map((s: any) => `- ${s.title} (${new Date(s.start_time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })})`).join('\n')

    const fullPrompt = `${prompt}\n\n今日待办日程：\n${pendingSchedules || '暂无待办日程'}`

    const preferredModel = await resolvePreferredModel()
    const result = await modelRouter.chat({ model: preferredModel, messages: [{ role: 'user' as const, content: fullPrompt }] })

    if (win && !win.isDestroyed()) {
      win.webContents.send('proactive-notification', {
        type: suggestionType,
        title: '💡 AI 建议',
        message: result.substring(0, 200),
        timestamp: Date.now()
      })
    }
  } catch (err) {
    log.error('Proactive suggestion failed:', err)
  }
}
