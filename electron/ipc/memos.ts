/**
 * 便签相关 IPC 处理器
 */
import { IpcModule, IpcContext } from './index'
import dbHelper from '../db'
import vectorDb from '../vectorDb'
import * as modelRouter from '../modelRouter'
import {
  SaveNoteSchema,
  SearchMemosSchema,
  DeleteMemoSchema,
  UpdateMemoTagsSchema,
  SummarizeMemoSchema,
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

function parseMemoTags(tags: unknown): string[] {
  if (!tags) return []
  if (Array.isArray(tags)) {
    return tags.map((tag) => String(tag).trim()).filter(Boolean)
  }
  if (typeof tags === 'string') {
    try {
      const parsed = JSON.parse(tags)
      if (Array.isArray(parsed)) {
        return parsed.map((tag) => String(tag).trim()).filter(Boolean)
      }
    } catch {}
    return tags
      .split(/[,\uff0c]/)
      .map((tag) => tag.trim())
      .filter(Boolean)
  }
  return []
}

function parseMemoImages(images: unknown): any[] {
  if (!images) return []
  if (Array.isArray(images)) return images
  if (typeof images === 'string') {
    try {
      const parsed = JSON.parse(images)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

function normalizeMemoTags(tags: unknown): string[] {
  return Array.from(new Set(parseMemoTags(tags)))
}

export function createMemosModule(ctx: IpcContext): IpcModule {
  const getWin = () => ctx.getWin()

  return {
    'get-memos': async () => {
      return withErrorHandling(async () => {
        const memos = await dbHelper.allQuery("SELECT * FROM notes WHERE type = 'quick_note' ORDER BY updated_at DESC")
        return memos.map((m: any) => {
          const { folder: _folder, ...rest } = m
          return { ...rest, tags: parseMemoTags(m.tags), images: parseMemoImages(m.images) }
        })
      }, 'get-memos')
    },
    'get-memo-by-id': async (_: any, id: string) => {
      return withErrorHandling(async () => {
        if (!id || typeof id !== 'string') {
          throw new AppError('无效的便签 ID', ErrorCategory.VALIDATION, ErrorLevel.WARNING)
        }
        const memos = await dbHelper.allQuery('SELECT * FROM notes WHERE id = ?', [id])
        const memo = memos[0]
        if (!memo) return null
        const { folder: _folder, ...rest } = memo
        return { ...rest, tags: parseMemoTags(memo.tags), images: parseMemoImages(memo.images) }
      }, 'get-memo-by-id')
    },
    'save-memo': async (_: any, memo: any) => {
      return withErrorHandling(async () => {
        const validated = validateInput(SaveNoteSchema, memo, 'save-memo')
        const tagsJson = JSON.stringify(normalizeMemoTags(validated.tags))
        const imagesJson = JSON.stringify(validated.images)
        const updatedAt = new Date().toISOString()

        await dbHelper.runQuery(
          `INSERT OR REPLACE INTO notes (id, type, title, content, tags, project, category, images, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, (SELECT created_at FROM notes WHERE id = ?), CURRENT_TIMESTAMP), ?)`,
          [validated.id, validated.type, validated.title, validated.content, tagsJson, validated.project, validated.category, imagesJson, validated.created_at || null, validated.id, updatedAt]
        )

        // 向量数据库更新（非关键路径，失败不影响主流程）
        try {
          await vectorDb.addMemoToVectorDb(validated.id, validated.content, {
            title: validated.title,
            project: validated.project,
            category: validated.category,
          })
          logInfo('Memo vectorized successfully', { id: validated.id })
        } catch (vErr: any) {
          logWarn('Vector DB update failed', { id: validated.id, error: vErr.message })
        }

        // 触发工作流（非关键路径）
        try {
          const workflows = await dbHelper.allQuery("SELECT * FROM agent_workflows WHERE trigger_type = 'on_memo_created' AND enabled != 0")
          for (const wf of workflows) {
            logInfo('Auto-triggering workflow', { id: wf.id, name: wf.name })
            const { ipcMain } = await import('electron')
            ipcMain.emit('execute-agent-workflow', _, wf.id)
          }
        } catch (wfErr: any) {
          logWarn('Workflow trigger failed', { error: wfErr.message })
        }

        return { success: true }
      }, 'save-memo', getWin())
    },
    'search-memos': async (_: any, query: string) => {
      return withErrorHandling(async () => {
        const validated = validateInput(SearchMemosSchema, { query }, 'search-memos')
        const results = await vectorDb.searchKnowledgeBase(validated.query)
        logInfo('Memo search completed', { query: validated.query, resultsCount: results.length })
        return results
      }, 'search-memos')
    },
    'delete-memo': async (_: any, id: string) => {
      return withErrorHandling(async () => {
        const validated = validateInput(DeleteMemoSchema, { id }, 'delete-memo')
        await dbHelper.runQuery('DELETE FROM notes WHERE id = ?', [validated.id])
        try {
          await vectorDb.deleteMemoFromVectorDb(validated.id)
        } catch (vErr: any) {
          logWarn('Vector DB delete failed', { id: validated.id, error: vErr.message })
        }
        logInfo('Memo deleted', { id: validated.id })
        return { success: true }
      }, 'delete-memo', getWin())
    },
    'get-memo-backlinks': async (_: any, { title, excludeId }: { title: string, excludeId?: string }) => {
      return withErrorHandling(async () => {
        if (!title || typeof title !== 'string') {
          throw new AppError('无效的标题', ErrorCategory.VALIDATION, ErrorLevel.WARNING)
        }
        const searchTerm = `%[[${title}]]%`
        const memos = await dbHelper.allQuery('SELECT * FROM notes WHERE content LIKE ? AND id != ?', [searchTerm, excludeId || ''])
        return memos.map((m: any) => {
          const { folder: _folder, ...rest } = m
          return { ...rest, tags: parseMemoTags(m.tags), images: parseMemoImages(m.images) }
        })
      }, 'get-memo-backlinks')
    },
    'search-memos-by-tag': async (_: any, { tag }: { tag: string }) => {
      return withErrorHandling(async () => {
        if (!tag || typeof tag !== 'string') {
          throw new AppError('无效的标签', ErrorCategory.VALIDATION, ErrorLevel.WARNING)
        }
        const memos = await dbHelper.allQuery('SELECT * FROM notes WHERE tags LIKE ?', [`%"${tag}"%`])
        return memos.map((m: any) => {
          const { folder: _folder, ...rest } = m
          return { ...rest, tags: parseMemoTags(m.tags), images: parseMemoImages(m.images) }
        })
      }, 'search-memos-by-tag')
    },
    'summarize-memo': async (_: any, content: string, model: string) => {
      return withErrorHandling(async () => {
        const validated = validateInput(SummarizeMemoSchema, { text: content }, 'summarize-memo')
        const prompt = `你是一个高效的个人助手。请对以下内容进行深度提炼，并按以下格式返回：

✨ 【一句话摘要】
(不超过 30 字，概括核心内容)

💡 【关键信息点】
- (列出 2-3 个最重要的信息点)

📅 【后续行动项】
- (如果有日程安排或建议的后续计划，请列出；如果没有则跳过此部分)

---
内容：
${validated.text}`

        const result = await modelRouter.chat({ messages: [{ role: 'user' as const, content: prompt }] })
        logInfo('Memo summarized', { contentLength: validated.text.length })
        return result
      }, 'summarize-memo', getWin())
    },
    'suggest-tags': async (_: any, { title, content, existingTags, model }: { title: string, content: string, existingTags: string[], model: string }) => {
      return withErrorHandling(async () => {
        const prompt = `你是一个标签推荐助手。根据以下便签内容，推荐3-5个最合适的标签。

标题：${title || '无标题'}
内容：${content.slice(0, 500)}
已有标签：${existingTags.join(', ') || '无'}

要求：
1. 标签应简洁（1-4个字）
2. 不要重复已有标签
3. 优先推荐内容主题、领域、类型相关的标签
4. 返回JSON格式：{"tags": ["标签1", "标签2", "标签3"]}

只返回JSON，不要其他内容。`

        const result = await modelRouter.chat({ messages: [{ role: 'user' as const, content: prompt }] })
        try {
          const jsonMatch = result.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            return JSON.parse(jsonMatch[0])
          }
        } catch {}
        return { tags: [] }
      }, 'suggest-tags')
    },
    'delete-tag': async (_: any, tagName: string) => {
      return withErrorHandling(async () => {
        if (!tagName || typeof tagName !== 'string') {
          throw new AppError('无效的标签名', ErrorCategory.VALIDATION, ErrorLevel.WARNING)
        }
        const memos = await dbHelper.allQuery('SELECT id, tags FROM notes WHERE tags LIKE ?', [`%"${tagName}"%`])
        for (const memo of memos) {
          const tags = parseMemoTags(memo.tags)
          const newTags = tags.filter((t: string) => t !== tagName)
          await dbHelper.runQuery('UPDATE notes SET tags = ? WHERE id = ?', [JSON.stringify(newTags), memo.id])
        }
        logInfo('Tag deleted', { tagName, affectedCount: memos.length })
        return { success: true, affectedCount: memos.length }
      }, 'delete-tag')
    },
    'rename-tag': async (_: any, { oldName, newName }: { oldName: string, newName: string }) => {
      return withErrorHandling(async () => {
        if (!oldName || !newName || typeof oldName !== 'string' || typeof newName !== 'string') {
          throw new AppError('无效的标签名', ErrorCategory.VALIDATION, ErrorLevel.WARNING)
        }
        const validated = validateInput(UpdateMemoTagsSchema, { id: 'tag-rename', tags: [newName] }, 'rename-tag')
        const memos = await dbHelper.allQuery('SELECT id, tags FROM notes WHERE tags LIKE ?', [`%"${oldName}"%`])
        for (const memo of memos) {
          const tags = parseMemoTags(memo.tags)
          const newTags = tags.map((t: string) => t === oldName ? validated.tags[0] : t)
          await dbHelper.runQuery('UPDATE notes SET tags = ? WHERE id = ?', [JSON.stringify(newTags), memo.id])
        }
        logInfo('Tag renamed', { oldName, newName: validated.tags[0], affectedCount: memos.length })
        return { success: true, affectedCount: memos.length }
      }, 'rename-tag')
    },
    'batch-delete-memos': async (_: any, ids: string[]) => {
      return withErrorHandling(async () => {
        if (!Array.isArray(ids) || ids.length === 0) {
          throw new AppError('无效的 ID 列表', ErrorCategory.VALIDATION, ErrorLevel.WARNING)
        }
        for (const id of ids) {
          await dbHelper.runQuery('DELETE FROM notes WHERE id = ?', [id])
          try {
            await vectorDb.deleteMemoFromVectorDb(id)
          } catch (vErr: any) {
            logWarn('Vector DB delete failed', { id, error: vErr.message })
          }
        }
        logInfo('Batch delete completed', { count: ids.length })
        return { success: true, deletedCount: ids.length }
      }, 'batch-delete-memos')
    },
    'get-weekly-digest': async (_: any, { range, startDate, endDate, model }: { range?: string; startDate?: string; endDate?: string; model?: string } = {}) => {
      return withErrorHandling(async () => {
        const now = new Date()
        let start: Date
        let end = now

        if (range === 'month') {
          start = new Date(now.getFullYear(), now.getMonth(), 1)
        } else if (range === 'custom' && startDate && endDate) {
          start = new Date(startDate)
          end = new Date(endDate)
          end.setHours(23, 59, 59, 999)
        } else {
          start = new Date(now)
          start.setDate(start.getDate() - 7)
        }

        const startStr = start.toISOString().slice(0, 19).replace('T', ' ')
        const endStr = end.toISOString().slice(0, 19).replace('T', ' ')
        const startIso = start.toISOString()
        const endIso = end.toISOString()
        const rangeLabel = range === 'month' ? '本月' : range === 'custom' ? '自定义周期' : '本周'

        const [notes, tasks, chatMsgs, kbFiles] = await Promise.all([
          dbHelper.allQuery(`SELECT id, title, content, type, updated_at FROM notes WHERE updated_at >= ? AND updated_at <= ? ORDER BY updated_at DESC LIMIT 20`, [startStr, endStr]),
          dbHelper.allQuery(`SELECT id, title, status, created_at, completed_at FROM tasks WHERE created_at >= ? AND created_at <= ?`, [startIso, endIso]),
          dbHelper.allQuery(`
            SELECT m.id, m.content, m.created_at, s.title as session_title
            FROM chat_messages m
            LEFT JOIN chat_sessions s ON m.session_id = s.id
            WHERE m.role = 'user' AND m.created_at >= ? AND m.created_at <= ?
            AND (s.title IS NULL OR s.title NOT IN ('Knowledge Chat', 'Schedule Chat', 'Workflow Chat'))
            ORDER BY m.created_at DESC LIMIT 30`, [startStr, endStr]),
          dbHelper.allQuery(`SELECT id, file_name, file_type, is_indexed, created_at FROM file_metadata WHERE created_at >= ? AND created_at <= ? ORDER BY created_at DESC LIMIT 15`, [startStr, endStr]),
        ])

        const taskCompleted = Array.isArray(tasks) ? tasks.filter((t: any) => t.completed_at && t.completed_at >= startIso && t.completed_at <= endIso) : []
        const taskCreated = Array.isArray(tasks) ? tasks : []
        const chatCreated = Array.isArray(chatMsgs) ? chatMsgs : []
        const kbCreated = Array.isArray(kbFiles) ? kbFiles : []

        const tasksIncomplete = taskCreated.filter((t: any) => !t.completed_at)

        const savedNotes = (notes as any[]).filter((n: any) => n.title && n.title.trim() !== '')

        const summaryData = {
          rangeLabel,
          notes: savedNotes,
          taskCompleted,
          taskCreated,
          taskIncomplete: tasksIncomplete,
          chatCount: chatCreated.length,
          chatTopics: chatCreated.slice(0, 10).map((m: any) => (m.content || '').replace(/<[^>]+>/g, '').slice(0, 80)).filter(Boolean),
          kbFiles: kbCreated,
        }

        if (
          savedNotes.length === 0 && taskCreated.length === 0 &&
          chatCreated.length === 0 && kbCreated.length === 0
        ) {
          return { summary: `你在${rangeLabel}还没有任何活动记录。`, stats: summaryData, noteItems: [], kbItems: [], taskItems: [] }
        }

        const notesText = savedNotes.length > 0
          ? `【便签/文档】\n${savedNotes.map((n: any, i: number) => `${i + 1}. ${n.title || '无标题'}：${(n.content || '').replace(/<[^>]+>/g, '').slice(0, 120)}`).join('\n\n')}`
          : '【便签/文档】无'

        const tasksText = taskCreated.length > 0
          ? `【待办】共新建 ${taskCreated.length} 项，已完成 ${taskCompleted.length} 项，未完成 ${tasksIncomplete.length} 项`
          : '【待办】无'

        const chatText = chatCreated.length > 0
          ? `【AI 对话】共 ${chatCreated.length} 条提问，主题包括：${chatCreated.slice(0, 5).map((m: any) => (m.content || '').replace(/<[^>]+>/g, '').slice(0, 30)).filter(Boolean).join('、')}`
          : '【AI 对话】无'

        const kbText = kbCreated.length > 0
          ? `【知识库】新增/索引了 ${kbCreated.length} 个文件，如：${kbCreated.slice(0, 3).map((f: any) => f.file_name).join('、')}`
          : '【知识库】无'

        const prompt = `你是一个个人数据总结助手。请根据以下用户活动数据，用温暖鼓励的语气为用户生成一段简洁的总结。

${rangeLabel}数据如下：

${notesText}

${tasksText}
${chatText}
${kbText}

请用 3-4 句话总结，不要罗列数据，重点概括：
1. 用户主要在忙什么
2. 有没有值得注意的成果或进展
3. 可以适当提醒未完成的事项

只返回总结文字，不要返回 JSON 格式。`

        const summary = await modelRouter.chat({
          messages: [{ role: 'user' as const, content: prompt }],
        })

        logInfo('Weekly digest generated', { rangeLabel })

        return {
          summary,
          stats: summaryData,
          noteItems: savedNotes.slice(0, 5).map((n: any) => ({ id: n.id, title: n.title || '无标题', type: n.type, updated_at: n.updated_at })),
          kbItems: kbCreated.slice(0, 5).map((f: any) => ({ id: f.id, file_name: f.file_name, file_type: f.file_type })),
          taskItems: {
            completed: taskCompleted.slice(0, 3).map((t: any) => ({ id: t.id, title: t.title || '无标题' })),
            incomplete: tasksIncomplete.slice(0, 3).map((t: any) => ({ id: t.id, title: t.title || '无标题' })),
          },
        }
      }, 'get-weekly-digest', getWin())
    },
  }
}
