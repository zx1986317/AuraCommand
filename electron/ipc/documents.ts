/**
 * 文档相关 IPC 处理器
 */
import { IpcContext, IpcModule } from './index'
import dbHelper from '../db'
import { parseHtmlToDocx } from '../exportService'
import {
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

function parseDocumentTags(tags: unknown): string[] {
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
    return tags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean)
  }
  return []
}

function normalizeDocument(document: any) {
  return {
    ...document,
    tags: parseDocumentTags(document.tags),
  }
}

export function createDocumentsModule(ctx: IpcContext): IpcModule {
  const getWin = () => ctx.getWin()

  return {
    'get-documents': async () => {
      return withErrorHandling(async () => {
        const documents = await dbHelper.allQuery('SELECT * FROM documents ORDER BY updated_at DESC')
        const results = documents.map(normalizeDocument)
        logInfo('Documents retrieved', { count: results.length })
        return results
      }, 'get-documents')
    },
    'get-document-by-id': async (_event: any, id: string) => {
      return withErrorHandling(async () => {
        if (!id || typeof id !== 'string') {
          throw new AppError('无效的文档 ID', ErrorCategory.VALIDATION, ErrorLevel.WARNING)
        }
        const document = await dbHelper.getQuery('SELECT * FROM documents WHERE id = ?', [id])
        return document ? normalizeDocument(document) : null
      }, 'get-document-by-id')
    },
    'save-document': async (_event: any, document: any) => {
      return withErrorHandling(async () => {
        const validated = validateInput(SaveDocumentSchema, document, 'save-document')
        const tagsJson = JSON.stringify(parseDocumentTags(validated.tags))
        const updatedAt = new Date().toISOString()
        await dbHelper.runQuery(
          `INSERT OR REPLACE INTO documents (id, title, content, project, category, tags, source_type, source_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, (SELECT created_at FROM documents WHERE id = ?), CURRENT_TIMESTAMP), ?)`,
          [
            validated.id,
            validated.title,
            validated.content,
            validated.project,
            validated.category,
            tagsJson,
            validated.source_type,
            validated.source_id,
            validated.created_at || null,
            validated.id,
            updatedAt,
          ]
        )
        logInfo('Document saved', { id: validated.id })
        return { success: true }
      }, 'save-document', getWin())
    },
    'delete-document': async (_event: any, id: string) => {
      return withErrorHandling(async () => {
        const validated = validateInput(DeleteDocumentSchema, { id }, 'delete-document')
        await dbHelper.runQuery('DELETE FROM documents WHERE id = ?', [validated.id])
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
        const likeQuery = `%${validated.query}%`
        const documents = await dbHelper.allQuery(
          'SELECT * FROM documents WHERE title LIKE ? OR content LIKE ? ORDER BY updated_at DESC',
          [likeQuery, likeQuery]
        )
        const results = documents.map(normalizeDocument)
        logInfo('Documents search completed', { query: validated.query, resultsCount: results.length })
        return results
      }, 'search-documents')
    },

    // --- 文档分类 CRUD ---
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
        await dbHelper.runQuery('UPDATE documents SET category = ? WHERE category = ?', ['uncategorized', validated.id])
        await dbHelper.runQuery('DELETE FROM doc_categories WHERE id = ?', [validated.id])
        logInfo('Doc category deleted', { id: validated.id })
        return { success: true }
      }, 'delete-doc-category', getWin())
    },
    'export-document-to-docx': async (_event: any, params: any) => {
      return withErrorHandling(async () => {
        const validated = validateInput(ExportDocumentSchema, params, 'export-document-to-docx')
        const doc = await dbHelper.getQuery('SELECT * FROM documents WHERE id = ?', [validated.id])
        if (!doc) {
          throw new AppError('文档不存在', ErrorCategory.VALIDATION, ErrorLevel.WARNING)
        }
        const buffer = await parseHtmlToDocx(doc.content || '', doc.title || 'Untitled')
        logInfo('Document exported to docx', { id: validated.id })
        return { success: true, data: buffer.toString('base64') }
      }, 'export-document-to-docx', getWin())
    },
  }
}
