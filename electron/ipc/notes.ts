/**
 * 笔记相关 IPC 处理器
 */
import { IpcModule, IpcContext } from './index'
import dbHelper from '../db'
import {
  GetNotesSchema,
  SaveQuickNoteSchema,
  DeleteNoteSchema,
  SearchNotesSchema,
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
        const results: any[] = []
        if (!validated?.type || validated.type === 'quick_note') {
          let sql = 'SELECT * FROM notes WHERE type = ?'
          const params: any[] = ['quick_note']
          if (validated?.category) { sql += ' AND category = ?'; params.push(validated.category) }
          sql += ' ORDER BY updated_at DESC'
          const quickNotes = await dbHelper.allQuery(sql, params)
          results.push(...quickNotes.map(normalizeNote))
        }
        if (!validated?.type || validated.type === 'document') {
          let sql = 'SELECT * FROM documents'
          const params: any[] = []
          if (validated?.category) { sql += ' WHERE category = ?'; params.push(validated.category) }
          sql += ' ORDER BY updated_at DESC'
          const docs = await dbHelper.allQuery(sql, params)
          results.push(...docs.map(normalizeDocument))
        }
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
        return { success: true }
      }, 'save-note', getWin())
    },

    'delete-note': async (_event: any, id: string) => {
      return withErrorHandling(async () => {
        const validated = validateInput(DeleteNoteSchema, { id }, 'delete-note')
        await dbHelper.runQuery('DELETE FROM notes WHERE id = ?', [validated.id])
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
        const like = `%${validated.query}%`
        const noteResults = await dbHelper.allQuery(
          `SELECT * FROM notes WHERE title LIKE ? OR content LIKE ? OR tags LIKE ? ORDER BY updated_at DESC LIMIT 25`,
          [like, like, like]
        )
        const docResults = await dbHelper.allQuery(
          `SELECT * FROM documents WHERE title LIKE ? OR content LIKE ? OR tags LIKE ? ORDER BY updated_at DESC LIMIT 25`,
          [like, like, like]
        )
        const results = [...noteResults.map(normalizeNote), ...docResults.map(normalizeDocument)]
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
  }
}
