/**
 * 待办任务相关 IPC 处理器
 */
import { IpcModule, IpcContext } from './index'
import dbHelper from '../db'
import {
  SaveTaskSchema,

  MoveTaskStatusSchema,
  DeleteTaskSchema,
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
import { setTaskNotifyEnabled, getTaskNotifyEnabled } from '../services/taskNotifier'

function parseTags(tags: unknown): string[] {
  if (!tags) return []
  if (Array.isArray(tags)) return tags.map(t => String(t).trim()).filter(Boolean)
  if (typeof tags === 'string') {
    try {
      const parsed = JSON.parse(tags)
      if (Array.isArray(parsed)) return parsed.map(t => String(t).trim()).filter(Boolean)
    } catch {}
    return tags.split(/[,，]/).map(t => t.trim()).filter(Boolean)
  }
  return []
}

function normalizeTask(task: any) {
  if (!task) return null
  return { ...task, tags: parseTags(task.tags) }
}

export function createTasksModule(ctx: IpcContext): IpcModule {
  const getWin = () => ctx.getWin()

  return {
    'get-tasks': async (_event: any, filter?: { status?: string; type?: string }) => {
      return withErrorHandling(async () => {
        if (filter && typeof filter !== 'object') {
          throw new AppError('无效的过滤条件', ErrorCategory.VALIDATION, ErrorLevel.WARNING)
        }
        let sql = 'SELECT * FROM tasks'
        const conditions: string[] = []
        const params: any[] = []
        if (filter?.status) { conditions.push('status = ?'); params.push(filter.status) }
        if (filter?.type) { conditions.push('type = ?'); params.push(filter.type) }
        if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ')
        sql += ' ORDER BY priority DESC, due_date ASC, created_at DESC'
        const tasks = await dbHelper.allQuery(sql, params)
        return tasks.map(normalizeTask)
      }, 'get-tasks')
    },

    'get-task-by-id': async (_event: any, id: string) => {
      return withErrorHandling(async () => {
        if (!id || typeof id !== 'string') {
          throw new AppError('无效的任务 ID', ErrorCategory.VALIDATION, ErrorLevel.WARNING)
        }
        const task = await dbHelper.getQuery('SELECT * FROM tasks WHERE id = ?', [id])
        return normalizeTask(task)
      }, 'get-task-by-id')
    },

    'save-task': async (_event: any, task: any) => {
      return withErrorHandling(async () => {
        const validated = validateInput(SaveTaskSchema, task, 'save-task')
        const tagsJson = JSON.stringify(parseTags(validated.tags))
        const sql = `INSERT OR REPLACE INTO tasks (id, title, description, type, status, priority, due_date, scheduled_date, source_type, source_id, source_title, tags, created_at, updated_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        const now = new Date().toISOString()
        const createdAt = validated.created_at || now
        const completedAt = validated.status === 'done' ? (validated.completed_at || now) : null
        await dbHelper.runQuery(sql, [
          validated.id, validated.title, validated.description || '',
          validated.type || 'task', validated.status || 'inbox', validated.priority || 'medium',
          validated.due_date || '', validated.scheduled_date || '',
          validated.source_type || '', validated.source_id || '', validated.source_title || '',
          tagsJson, createdAt, now, completedAt
        ])
        logInfo('Task saved', { id: validated.id })
        return { success: true }
      }, 'save-task', getWin())
    },

    'delete-task': async (_event: any, id: string) => {
      return withErrorHandling(async () => {
        const validated = validateInput(DeleteTaskSchema, { id }, 'delete-task')
        await dbHelper.runQuery('DELETE FROM tasks WHERE id = ?', [validated.id])
        logInfo('Task deleted', { id: validated.id })
        return { success: true }
      }, 'delete-task', getWin())
    },

    'update-task-status': async (_event: any, { id, status }: { id: string; status: string }) => {
      return withErrorHandling(async () => {
        const validated = validateInput(MoveTaskStatusSchema, { id, status }, 'update-task-status')
        const now = new Date().toISOString()
        const completedAt = validated.status === 'done' ? now : null
        await dbHelper.runQuery('UPDATE tasks SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?', [validated.status, completedAt, now, validated.id])
        logInfo('Task status updated', { id: validated.id, status: validated.status })
        return { success: true }
      }, 'update-task-status', getWin())
    },

    'search-tasks': async (_event: any, query: string) => {
      return withErrorHandling(async () => {
        if (!query || typeof query !== 'string' || query.trim().length === 0) {
          throw new AppError('搜索关键词不能为空', ErrorCategory.VALIDATION, ErrorLevel.WARNING)
        }
        const tasks = await dbHelper.allQuery(
          `SELECT * FROM tasks WHERE title LIKE ? OR description LIKE ? OR tags LIKE ? ORDER BY priority DESC, due_date ASC LIMIT 50`,
          [`%${query}%`, `%${query}%`, `%${query}%`]
        )
        return tasks.map(normalizeTask)
      }, 'search-tasks')
    },

    'get-task-stats': async () => {
      return withErrorHandling(async () => {
        const stats = await dbHelper.getQuery(`
          SELECT
            COUNT(*) as total,
            SUM(CASE WHEN status = 'inbox' THEN 1 ELSE 0 END) as inbox,
            SUM(CASE WHEN status = 'next' THEN 1 ELSE 0 END) as next,
            SUM(CASE WHEN status = 'waiting' THEN 1 ELSE 0 END) as waiting,
            SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done
          FROM tasks
        `)
        return stats || { total: 0, inbox: 0, next: 0, waiting: 0, done: 0 }
      }, 'get-task-stats')
    },

    'get-overdue-task-count': async () => {
      return withErrorHandling(async () => {
        const now = Math.floor(Date.now() / 1000)
        const result = await dbHelper.getQuery(
          `SELECT COUNT(*) as count FROM tasks WHERE status != 'done' AND due_date != '' AND due_date IS NOT NULL AND CAST(strftime('%s', due_date) AS INTEGER) < ?`,
          [now]
        )
        return { count: result?.count || 0 }
      }, 'get-overdue-task-count')
    },

    'set-task-notify-enabled': async (_event: any, enabled: boolean) => {
      return withErrorHandling(async () => {
        await setTaskNotifyEnabled(!!enabled)
        logInfo('Task notify enabled changed', { enabled })
        return { success: true }
      }, 'set-task-notify-enabled', getWin())
    },

    'get-task-notify-enabled': async () => {
      return withErrorHandling(async () => {
        const enabled = await getTaskNotifyEnabled()
        return { enabled }
      }, 'get-task-notify-enabled')
    },
  }
}
