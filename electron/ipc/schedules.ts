/**
 * 日程相关 IPC 处理器
 */
import { IpcModule, IpcContext } from './index'
import dbHelper from '../db'
import * as modelRouter from '../modelRouter'
import { resolvePreferredModel } from '../modelPreference'
import {
  SaveScheduleSchema,
  DeleteScheduleSchema,
  validateInput,
} from './schemas'
import {
  withErrorHandling,
  logInfo,
  logWarn,
  ErrorCategory,
  ErrorLevel,
  AppError,
} from '../errorHandler'

export function createSchedulesModule(ctx: IpcContext): IpcModule {
  const getWin = () => ctx.getWin()

  return {
    'get-schedules': async () => {
      return withErrorHandling(async () => {
        return await dbHelper.allQuery('SELECT * FROM schedules ORDER BY start_time ASC')
      }, 'get-schedules')
    },

    'save-schedule': async (_: any, schedule: any) => {
      return withErrorHandling(async () => {
        const validated = validateInput(SaveScheduleSchema, schedule, 'save-schedule')
        const sql = `INSERT OR REPLACE INTO schedules (id, title, content, start_time, end_time, memo_id, status, category, source, recurrence, linked_memos, priority, due_date, parent_id, sort_order, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        const params = [
          validated.id,
          validated.title,
          validated.content || '',
          validated.start_time,
          validated.end_time || validated.start_time,
          '',
          validated.status || 'pending',
          validated.category || '工作',
          '',
          'none',
          validated.linked_memos || '[]',
          validated.priority || 'medium',
          '',
          '',
          0,
          new Date().toISOString()
        ]
        const result = await dbHelper.runQuery(sql, params)
        logInfo('Schedule saved', { id: validated.id })
        return { success: true }
      }, 'save-schedule', getWin())
    },

    'quick-add-todo': async (_: any, { title, priority, category }: { title: string, priority?: string, category?: string }) => {
      return withErrorHandling(async () => {
        if (!title || typeof title !== 'string' || title.trim().length === 0) {
          throw new AppError('标题不能为空', ErrorCategory.VALIDATION, ErrorLevel.WARNING)
        }
        const id = crypto.randomUUID()
        const now = new Date().toISOString()
        const maxSort = await dbHelper.getQuery('SELECT MAX(sort_order) as max_sort FROM schedules WHERE parent_id = "" OR parent_id IS NULL')
        const nextSort = (maxSort?.max_sort || 0) + 1
        await dbHelper.runQuery(`INSERT INTO schedules (id, title, content, start_time, end_time, status, category, source, priority, due_date, parent_id, sort_order, recurrence, linked_memos, created_at, updated_at) VALUES (?, ?, '', ?, ?, 'pending', ?, '', ?, '', '', ?, 'none', '[]', ?, ?)`, [id, title, now, now, category || '工作', priority || 'medium', nextSort, now, now])
        logInfo('Quick todo added', { id, title })
        return { success: true, id }
      }, 'quick-add-todo', getWin())
    },

    'reorder-schedules': async (_: any, items: { id: string, sort_order: number }[]) => {
      return withErrorHandling(async () => {
        if (!Array.isArray(items) || items.length === 0) {
          throw new AppError('无效的排序列表', ErrorCategory.VALIDATION, ErrorLevel.WARNING)
        }
        for (const item of items) {
          await dbHelper.runQuery('UPDATE schedules SET sort_order = ? WHERE id = ?', [item.sort_order, item.id])
        }
        logInfo('Schedules reordered', { count: items.length })
        return { success: true }
      }, 'reorder-schedules')
    },


    'delete-schedule': async (_: any, id: string) => {
      return withErrorHandling(async () => {
        const validated = validateInput(DeleteScheduleSchema, { id }, 'delete-schedule')
        await dbHelper.runQuery('DELETE FROM schedules WHERE id = ?', [validated.id])
        logInfo('Schedule deleted', { id: validated.id })
        return { success: true }
      }, 'delete-schedule', getWin())
    },

    'update-schedule-status': async (_: any, { id, status }: { id: string, status: string }) => {
      return withErrorHandling(async () => {
        if (!id || typeof id !== 'string') {
          throw new AppError('无效的日程 ID', ErrorCategory.VALIDATION, ErrorLevel.WARNING)
        }
        if (!status || typeof status !== 'string') {
          throw new AppError('无效的状态值', ErrorCategory.VALIDATION, ErrorLevel.WARNING)
        }
        await dbHelper.runQuery('UPDATE schedules SET status = ?, updated_at = ? WHERE id = ?', [status, new Date().toISOString(), id])
        logInfo('Schedule status updated', { id, status })
        return { success: true }
      }, 'update-schedule-status', getWin())
    },

    'search-schedules-by-title': async (_: any, titles: string[]) => {
      return withErrorHandling(async () => {
        if (!Array.isArray(titles) || titles.length === 0) {
          throw new AppError('无效的标题列表', ErrorCategory.VALIDATION, ErrorLevel.WARNING)
        }
        const schedules: any[] = []
        for (const title of titles) {
          const results = await dbHelper.allQuery('SELECT * FROM schedules WHERE title LIKE ?', [`%${title}%`])
          schedules.push(...results)
        }
        logInfo('Schedules searched by title', { count: titles.length })
        return { success: true, schedules }
      }, 'search-schedules-by-title')
    },

    'extract-schedules': async (_: any, { text, model }: { text: string, model: string }) => {
      return withErrorHandling(async () => {
        if (!text || typeof text !== 'string' || text.trim().length === 0) {
          throw new AppError('输入文本不能为空', ErrorCategory.VALIDATION, ErrorLevel.WARNING)
        }
        const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
        const now = new Date()
        const nowStr = now.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
        const dayOfWeek = days[now.getDay()]
        const getTargetDate = (offsetDays: number) => { const d = new Date(now.getTime() + offsetDays * 86400000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
        const currentDay = now.getDay()
        const nextMondayOffset = currentDay === 0 ? 1 : 8 - currentDay
        const thisMondayOffset = currentDay === 0 ? -6 : 1 - currentDay
        const dateMap: Record<string, string> = { '今天': getTargetDate(0), '明天': getTargetDate(1), '后天': getTargetDate(2) }
        const weekNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
        weekNames.forEach((name, i) => { dateMap[`这${name}`] = getTargetDate(thisMondayOffset + (i === 0 ? 6 : i - 1)); dateMap[`下${name}`] = getTargetDate(nextMondayOffset + (i === 0 ? 6 : i - 1)) })
        const dateMappingStr = Object.entries(dateMap).map(([key, val]) => `${key}: ${val}`).join('\n')
        const prompt = `你是一个顶级的时间规划和日程管理专家。当前参考时间：${nowStr} (${dayOfWeek})\n\n请严格按照以下【日期对照表】来转换文中的时间词，严禁自行计算：\n${dateMappingStr}\n\n要求：1. **精准映射**：\n   - 识别文中的时间词（如"下周四"、"明天"），直接在对照表中找到对应 YYYY-MM-DD 格式\n   - 如果文中提到"下周四"，必须映射为：${dateMap['下周四']}\n   - 如果文中只提到"周四"，且当前是 ${dayOfWeek}，请\n    - title: 简洁明了的事件标题\n   - start_time: ISO 8601 格式的开始时间 (例如: 2026-04-30T14:00:00+08:00)\n   - end_time: ISO 8601 格式的结束时间 (如未提及，默认开始时间加1小时)\n   - content: 事件的详细描述\n内容：${text}`
        let response = await modelRouter.chat({ messages: [{ role: 'user' as const, content: prompt }] })
        let jsonStr = response
        const mdMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
        if (mdMatch) { jsonStr = mdMatch[1] || '' } else { const start = jsonStr.indexOf('['); const end = jsonStr.lastIndexOf(']'); if (start !== -1 && end !== -1) { jsonStr = jsonStr.substring(start, end + 1) } }
        jsonStr = jsonStr.replace(/,\s*([\]}])/g, '$1')
        logInfo('AI extracted schedules', { responseLength: jsonStr.length })
        const parsed = JSON.parse(jsonStr)
        return Array.isArray(parsed) ? parsed : []
      }, 'extract-schedules', getWin())
    },

    'ai-schedule': async (_: any, { schedules, memos, selectedDate }: { schedules: any[], memos: any[], selectedDate: string }) => {
      return withErrorHandling(async () => {
        if (!selectedDate || typeof selectedDate !== 'string') {
          throw new AppError('无效的日期', ErrorCategory.VALIDATION, ErrorLevel.WARNING)
        }
        const pendingSchedules = schedules.filter((s: any) => s.status === 'pending')
        const scheduleInfo = pendingSchedules.map((s: any) => `- ${s.title} (${s.category}, ${s.start_time})`).join('\n')
        const memoInfo = memos.slice(0, 10).map((m: any) => `- ${m.title}: ${(m.content || '').substring(0, 100)}`).join('\n')
        const prompt = `你是一个智能日程助手。基于以下信息，给出今天（${selectedDate}）的智能排程建议。\n已有日程：${scheduleInfo || '暂无'}\n\n相关便签：${memoInfo || '暂无'}\n\n请给出3-5条排程建议，每条格式为：\n时间范围 | 事项名称 | 分类 | 原因\n\n只输出建议，不要其他内容。`
        const ollamaUrl = await dbHelper.allQuery("SELECT value FROM app_settings WHERE key = 'ollama_url'")
        const baseUrl = ollamaUrl[0]?.value || 'http://localhost:11434'
        const model = await resolvePreferredModel()
        const response = await fetch(`${baseUrl}/api/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, prompt, stream: false }) })
        const data = await response.json()
        logInfo('AI schedule suggestions generated', { date: selectedDate })
        return { success: true, suggestions: data.response }
      }, 'ai-schedule', getWin())
    },
  }
}
