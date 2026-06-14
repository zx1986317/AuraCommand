/**
 * 笔记相关 IPC 处理器
 */
import { IpcModule, IpcContext } from './index'
import dbHelper from '../db'
import * as vectorDb from '../vectorDb'
import * as modelRouter from '../modelRouter'
import { parseHtmlToDocx } from '../exportService'
import { escapeFts5Query } from '../db/search'
import { parseSearchQuery } from '../search/queryParser'
import { generateTags } from '../services/autoTag'
import {
  GetNotesSchema,
  SaveNoteSchema,
  SaveQuickNoteSchema,
  DeleteNoteSchema,
  SearchNotesSchema,
  SearchMemosSchema,
  DeleteMemoSchema,
  SummarizeMemoSchema,
  SaveDocumentSchema,
  DeleteDocumentSchema,
  SearchDocumentsSchema,
  DocCategorySchema,
  DeleteDocCategorySchema,
  ExportDocumentSchema,
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

function parseNoteImages(images: unknown): any[] {
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

function normalizeNote(note: any) {
  if (!note) return null
  return {
    ...note,
    tags: parseTags(note.tags),
    images: parseNoteImages(note.images),
    pinned: Boolean(note.pinned),
  }
}

function normalizeDocument(doc: any) {
  if (!doc) return null
  let tags: string[] = []
  if (doc.tags) {
    if (Array.isArray(doc.tags)) { tags = doc.tags.map((t: any) => String(t).trim()).filter(Boolean) }
    else if (typeof doc.tags === 'string') { try { const p = JSON.parse(doc.tags); if (Array.isArray(p)) tags = p.map((t: any) => String(t).trim()).filter(Boolean) } catch {} }
  }
  return { ...doc, type: 'document', tags }
}

export function createNotesModule(ctx: IpcContext): IpcModule {
  const getWin = () => ctx.getWin()

  return {
    'get-notes': async (_event: any, filter?: { type?: string; category?: string }) => {
      return withErrorHandling(async () => {
        if (filter && typeof filter !== 'object') {
          throw new AppError('无效的过滤条件', ErrorCategory.VALIDATION, ErrorLevel.WARNING)
        }
        const validated = validateInput(GetNotesSchema, filter, 'get-notes')
        let sql = 'SELECT * FROM notes'
        const params: any[] = []
        if (validated?.type) {
          sql += ' WHERE type = ?'
          params.push(validated.type)
          if (validated?.category) { sql += ' AND category = ?'; params.push(validated.category) }
        } else if (validated?.category) {
          sql += ' WHERE category = ?'
          params.push(validated.category)
        }
        sql += ' ORDER BY updated_at DESC'
        const rows = await dbHelper.allQuery(sql, params)
        const results = rows.map(r => r.type === 'document' ? normalizeDocument(r) : normalizeNote(r))
        logInfo('Notes retrieved', { type: validated?.type, category: validated?.category, count: results.length })
        return results
      }, 'get-notes')
    },

    'get-note-by-id': async (_event: any, id: string) => {
      return withErrorHandling(async () => {
        if (!id || typeof id !== 'string') {
          throw new AppError('无效的笔记 ID', ErrorCategory.VALIDATION, ErrorLevel.WARNING)
        }
        const note = await dbHelper.getQuery('SELECT * FROM notes WHERE id = ?', [id])
        return normalizeNote(note)
      }, 'get-note-by-id')
    },

    'save-note': async (_event: any, note: any) => {
      return withErrorHandling(async () => {
        const validated = validateInput(SaveQuickNoteSchema, note, 'save-note')
        const tagsJson = JSON.stringify(parseTags(validated.tags))
        const imagesJson = JSON.stringify(parseNoteImages(validated.images))
        const pinned = validated.pinned ? 1 : 0
        const sql = `INSERT OR REPLACE INTO notes (id, type, title, content, tags, category, project, folder_id, file_path, size, source_url, pinned, images, source_type, source_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        const now = new Date().toISOString()
        await dbHelper.runQuery(sql, [
          validated.id,
          validated.type,
          validated.title,
          validated.content,
          tagsJson,
          validated.category,
          validated.project,
          validated.folder_id,
          validated.file_path,
          validated.size,
          validated.source_url,
          pinned,
          imagesJson,
          validated.source_type,
          validated.source_id,
          validated.created_at || now,
          now,
        ])
        logInfo('Note saved', { id: validated.id, type: validated.type })
        if (validated.project && validated.project.trim()) {
          await dbHelper.runQuery(
            'INSERT OR IGNORE INTO project_items (project_name, item_type, item_id) VALUES (?, ?, ?)',
            [validated.project.trim(), validated.type === 'quick_note' ? 'note' : 'document', validated.id]
          )
        }
        try { await vectorDb.addMemoToVectorDb(validated.id, `${validated.title}\n${validated.content}`, { title: validated.title, type: validated.type || 'quick_note', project: validated.project || '', category: validated.category || '' }); } catch (e: any) { logWarn('[save-note] Vector embedding failed:', e.message); }
        generateTags(validated.title, validated.content, parseTags(validated.tags)).then(result => {
          if (result.tags.length > 0 || result.category) {
            const win = getWin()
            if (win) win.webContents.send('auto-tag-suggestion', { noteId: validated.id, ...result })
          }
        })
        return { success: true }
      }, 'save-note', getWin())
    },

    'delete-note': async (_event: any, id: string) => {
      return withErrorHandling(async () => {
        const validated = validateInput(DeleteNoteSchema, { id }, 'delete-note')
        await dbHelper.runQuery('DELETE FROM notes WHERE id = ?', [validated.id])
        try { await vectorDb.deleteMemoFromVectorDb(validated.id) } catch (vErr: any) { logWarn('Vector DB delete failed', { id: validated.id, error: vErr.message }) }
        logInfo('Note deleted', { id: validated.id })
        return { success: true }
      }, 'delete-note', getWin())
    },

    'search-notes': async (_event: any, query: string) => {
      return withErrorHandling(async () => {
        if (!query || typeof query !== 'string' || query.trim().length === 0) {
          throw new AppError('搜索关键词不能为空', ErrorCategory.VALIDATION, ErrorLevel.WARNING)
        }
        const validated = validateInput(SearchNotesSchema, { query }, 'search-notes')
        const ftsQuery = escapeFts5Query(validated.query)
        const rows = await dbHelper.allQuery(
          `SELECT n.* FROM notes n JOIN notes_fts fts ON n.rowid = fts.rowid WHERE notes_fts MATCH ? ORDER BY fts.rank LIMIT 50`,
          [ftsQuery]
        )
        const results = rows.map(r => r.type === 'document' ? normalizeDocument(r) : normalizeNote(r))
        logInfo('Notes search completed', { query: validated.query, resultsCount: results.length })
        return results
      }, 'search-notes')
    },

    'get-note-categories': async () => {
      return withErrorHandling(async () => {
        const rows = await dbHelper.allQuery(
          `SELECT category, COUNT(*) as count FROM notes WHERE category != '' GROUP BY category ORDER BY count DESC`
        )
        logInfo('Note categories retrieved', { count: rows.length })
        return rows
      }, 'get-note-categories')
    },

    'get-note-tags': async () => {
      return withErrorHandling(async () => {
        const notes = await dbHelper.allQuery('SELECT tags FROM notes WHERE tags != "" AND tags != "[]"')
        const tagSet = new Set<string>()
        for (const note of notes) {
          parseTags(note.tags).forEach(t => tagSet.add(t))
        }
        const tags = Array.from(tagSet).sort()
        logInfo('Note tags retrieved', { count: tags.length })
        return tags
      }, 'get-note-tags')
    },

    // ─── 文档 (Documents) ────────────────────────────────────────
    'get-documents': async () => {
      return withErrorHandling(async () => {
        const documents = await dbHelper.allQuery("SELECT * FROM notes WHERE type='document' ORDER BY updated_at DESC")
        const results = documents.map(r => normalizeDocument(r))
        logInfo('Documents retrieved', { count: results.length })
        return results
      }, 'get-documents')
    },
    'get-document-by-id': async (_event: any, id: string) => {
      return withErrorHandling(async () => {
        if (!id || typeof id !== 'string') {
          throw new AppError('无效的文档 ID', ErrorCategory.VALIDATION, ErrorLevel.WARNING)
        }
        const document = await dbHelper.getQuery("SELECT * FROM notes WHERE id = ? AND type='document'", [id])
        return document ? normalizeDocument(document) : null
      }, 'get-document-by-id')
    },
    'save-document': async (_event: any, document: any) => {
      return withErrorHandling(async () => {
        const validated = validateInput(SaveDocumentSchema, document, 'save-document')
        const tagsJson = JSON.stringify(parseTags(validated.tags))
        const updatedAt = new Date().toISOString()
        const createdAt = validated.created_at || new Date().toISOString()
        await dbHelper.runQuery(
          `INSERT OR REPLACE INTO notes (id, type, title, content, tags, category, project, source_type, source_id, created_at, updated_at)
           VALUES (?, 'document', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            validated.id,
            validated.title,
            validated.content,
            tagsJson,
            validated.category,
            validated.project,
            validated.source_type,
            validated.source_id,
            createdAt,
            updatedAt,
          ]
        )
        logInfo('Document saved', { id: validated.id })
        if (validated.project && validated.project.trim()) {
          await dbHelper.runQuery(
            'INSERT OR IGNORE INTO project_items (project_name, item_type, item_id) VALUES (?, ?, ?)',
            [validated.project.trim(), 'document', validated.id]
          )
        }
        try { await vectorDb.addMemoToVectorDb(validated.id, `${validated.title}\n${validated.content}`, { title: validated.title, type: 'document', project: validated.project || '', category: validated.category || '' }); } catch (e: any) { logWarn('[save-document] Vector embedding failed:', e.message); }
        return { success: true }
      }, 'save-document', getWin())
    },
    'delete-document': async (_event: any, id: string) => {
      return withErrorHandling(async () => {
        const validated = validateInput(DeleteDocumentSchema, { id }, 'delete-document')
        await dbHelper.runQuery("DELETE FROM notes WHERE id = ? AND type='document'", [validated.id])
        try { await vectorDb.deleteMemoFromVectorDb(validated.id) } catch (vErr: any) { logWarn('Vector DB delete failed', { id: validated.id, error: vErr.message }) }
        logInfo('Document deleted', { id: validated.id })
        return { success: true }
      }, 'delete-document', getWin())
    },
    'search-documents': async (_event: any, query: string) => {
      return withErrorHandling(async () => {
        if (!query || typeof query !== 'string' || query.trim().length === 0) {
          throw new AppError('搜索关键词不能为空', ErrorCategory.VALIDATION, ErrorLevel.WARNING)
        }
        const validated = validateInput(SearchDocumentsSchema, { query }, 'search-documents')
        const ftsQuery = escapeFts5Query(validated.query)
        const documents = await dbHelper.allQuery(
          `SELECT n.* FROM notes n JOIN notes_fts fts ON n.rowid = fts.rowid WHERE n.type='document' AND notes_fts MATCH ? ORDER BY fts.rank`,
          [ftsQuery]
        )
        const results = documents.map(r => normalizeDocument(r))
        logInfo('Documents search completed', { query: validated.query, resultsCount: results.length })
        return results
      }, 'search-documents')
    },

    // ─── 文档分类 CRUD ─────────────────────────────────────────
    'get-doc-categories': async () => {
      return withErrorHandling(async () => {
        const categories = await dbHelper.allQuery('SELECT * FROM doc_categories ORDER BY sort_order ASC')
        logInfo('Doc categories retrieved', { count: categories.length })
        return categories
      }, 'get-doc-categories')
    },
    'create-doc-category': async (_event: any, category: any) => {
      return withErrorHandling(async () => {
        const validated = validateInput(DocCategorySchema, category, 'create-doc-category')
        const now = new Date().toISOString()
        await dbHelper.runQuery(
          'INSERT OR REPLACE INTO doc_categories (id, name, color, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
          [validated.id, validated.name, validated.color, validated.sort_order, now, now]
        )
        logInfo('Doc category created', { id: validated.id, name: validated.name })
        return { success: true }
      }, 'create-doc-category', getWin())
    },
    'update-doc-category': async (_event: any, category: any) => {
      return withErrorHandling(async () => {
        const validated = validateInput(DocCategorySchema, category, 'update-doc-category')
        const now = new Date().toISOString()
        await dbHelper.runQuery(
          'UPDATE doc_categories SET name = ?, color = ?, sort_order = ?, updated_at = ? WHERE id = ?',
          [validated.name, validated.color, validated.sort_order, now, validated.id]
        )
        logInfo('Doc category updated', { id: validated.id })
        return { success: true }
      }, 'update-doc-category', getWin())
    },
    'delete-doc-category': async (_event: any, id: string) => {
      return withErrorHandling(async () => {
        const validated = validateInput(DeleteDocCategorySchema, { id }, 'delete-doc-category')
        await dbHelper.runQuery("UPDATE notes SET category = ? WHERE type='document' AND category = ?", ['uncategorized', validated.id])
        await dbHelper.runQuery('DELETE FROM doc_categories WHERE id = ?', [validated.id])
        logInfo('Doc category deleted', { id: validated.id })
        return { success: true }
      }, 'delete-doc-category', getWin())
    },
    'export-document-to-docx': async (_event: any, params: any) => {
      return withErrorHandling(async () => {
        const validated = validateInput(ExportDocumentSchema, params, 'export-document-to-docx')
        const doc = await dbHelper.getQuery("SELECT * FROM notes WHERE id = ? AND type='document'", [validated.id])
        if (!doc) {
          throw new AppError('文档不存在', ErrorCategory.VALIDATION, ErrorLevel.WARNING)
        }
        const buffer = await parseHtmlToDocx(doc.content || '', doc.title || 'Untitled')
        logInfo('Document exported to docx', { id: validated.id })
        return { success: true, data: buffer.toString('base64') }
      }, 'export-document-to-docx', getWin())
    },

    // ─── 便签 (Memos — legacy IPC channels, kept for frontend compat) ───────
    'get-memos': async () => {
      return withErrorHandling(async () => {
        const memos = await dbHelper.allQuery("SELECT * FROM notes WHERE type = 'quick_note' ORDER BY updated_at DESC")
        return memos.map((m: any) => {
          const { folder: _folder, ...rest } = m
          return { ...rest, tags: parseTags(m.tags), images: parseNoteImages(m.images) }
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
        return { ...rest, tags: parseTags(memo.tags), images: parseNoteImages(memo.images) }
      }, 'get-memo-by-id')
    },
    'save-memo': async (_: any, memo: any) => {
      return withErrorHandling(async () => {
        const validated = validateInput(SaveNoteSchema, memo, 'save-memo')
        const tagsJson = JSON.stringify(parseTags(validated.tags))
        const imagesJson = JSON.stringify(validated.images)
        const updatedAt = new Date().toISOString()

        await dbHelper.runQuery(
          `INSERT OR REPLACE INTO notes (id, type, title, content, tags, project, category, images, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, (SELECT created_at FROM notes WHERE id = ?), CURRENT_TIMESTAMP), ?)`,
          [validated.id, validated.type, validated.title, validated.content, tagsJson, validated.project, validated.category, imagesJson, validated.created_at || null, validated.id, updatedAt]
        )

        try {
          await vectorDb.addMemoToVectorDb(validated.id, validated.content, {
            title: validated.title,
            type: validated.type,
            project: validated.project,
            category: validated.category,
          })
          logInfo('Memo vectorized successfully', { id: validated.id })
        } catch (vErr: any) {
          logWarn('Vector DB update failed', { id: validated.id, error: vErr.message })
        }

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

        generateTags(validated.title, validated.content, parseTags(validated.tags)).then(result => {
          if (result.tags.length > 0 || result.category) {
            const win = getWin()
            if (win) win.webContents.send('auto-tag-suggestion', { noteId: validated.id, ...result })
          }
        })
        return { success: true }
      }, 'save-memo', getWin())
    },
    'delete-memo': async (_: any, id: string) => {
      return withErrorHandling(async () => {
        const validated = validateInput(DeleteMemoSchema, { id }, 'delete-memo')
        await dbHelper.runQuery('DELETE FROM notes WHERE id = ?', [validated.id])
        try { await vectorDb.deleteMemoFromVectorDb(validated.id) } catch (vErr: any) { logWarn('Vector DB delete failed', { id: validated.id, error: vErr.message }) }
        logInfo('Memo deleted', { id: validated.id })
        return { success: true }
      }, 'delete-memo', getWin())
    },
    'search-memos': async (_: any, query: string) => {
      return withErrorHandling(async () => {
        const validated = validateInput(SearchMemosSchema, { query }, 'search-memos')
        const { cleanQuery } = parseSearchQuery(validated.query)
        const results = await vectorDb.searchKnowledgeBase(cleanQuery || validated.query)
        logInfo('Memo search completed', { query: validated.query, resultsCount: results.length })
        return results
      }, 'search-memos')
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
          return { ...rest, tags: parseTags(m.tags), images: parseNoteImages(m.images) }
        })
      }, 'get-memo-backlinks')
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

        if (savedNotes.length === 0 && taskCreated.length === 0 && chatCreated.length === 0 && kbCreated.length === 0) {
          return { summary: `你在${rangeLabel}还没有任何活动记录。`, stats: summaryData, noteItems: [], kbItems: [], taskItems: [] }
        }

        const notesText = savedNotes.length > 0 ? `【便签/文档】\n${savedNotes.map((n: any, i: number) => `${i + 1}. ${n.title || '无标题'}：${(n.content || '').replace(/<[^>]+>/g, '').slice(0, 120)}`).join('\n\n')}` : '【便签/文档】无'
        const tasksText = taskCreated.length > 0 ? `【待办】共新建 ${taskCreated.length} 项，已完成 ${taskCompleted.length} 项，未完成 ${tasksIncomplete.length} 项` : '【待办】无'
        const chatText = chatCreated.length > 0 ? `【AI 对话】共 ${chatCreated.length} 条提问，主题包括：${chatCreated.slice(0, 5).map((m: any) => (m.content || '').replace(/<[^>]+>/g, '').slice(0, 30)).filter(Boolean).join('、')}` : '【AI 对话】无'
        const kbText = kbCreated.length > 0 ? `【知识库】新增/索引了 ${kbCreated.length} 个文件，如：${kbCreated.slice(0, 3).map((f: any) => f.file_name).join('、')}` : '【知识库】无'

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
