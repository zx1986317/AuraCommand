/**
 * Chat Session & Message CRUD IPC 处理器
 */
import { IpcModule, IpcContext } from './index'
import dbHelper from '../db'
import { escapeFts5Query } from '../db/search'
import { parseSearchQuery, applyTagFilter, applyDateFilter } from '../search/queryParser'
import * as modelRouter from '../modelRouter'
import { toRouterMessages } from './chatUtils'
import { isPathWithinVault } from '../pathSecurity'
import path from 'path'

export function createChatSessionModule(ctx: IpcContext): IpcModule {
  return {
    'get-chat-sessions': async () => {
      try { return await dbHelper.allQuery('SELECT * FROM chat_sessions ORDER BY updated_at DESC') }
      catch (err) { console.error('Failed to get chat sessions:', err); return [] }
    },

    'create-chat-session': async (_: any, { title }: { title: string }) => {
      try {
        const id = Math.random().toString(36).substring(2, 15)
        await dbHelper.runQuery('INSERT INTO chat_sessions (id, title, created_at, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)', [id, title])
        return { id, title }
      } catch (err) { console.error('Failed to create chat session:', err); throw err }
    },

    'delete-chat-session': async (_: any, { sessionId }: { sessionId: string }) => {
      try {
        await dbHelper.runQuery('DELETE FROM chat_sessions WHERE id = ?', [sessionId])
        await dbHelper.runQuery('DELETE FROM chat_messages WHERE session_id = ?', [sessionId])
        return { success: true }
      } catch (err) { console.error('Failed to delete chat session:', err); throw err }
    },

    'rename-chat-session': async (_: any, { sessionId, title }: { sessionId: string, title: string }) => {
      try {
        await dbHelper.runQuery('UPDATE chat_sessions SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [title, sessionId])
        return { success: true }
      } catch (err) { console.error('Failed to rename chat session:', err); throw err }
    },

    'get-chat-messages': async (_: any, { sessionId }: { sessionId?: string } = {}) => {
      try {
        let sql = 'SELECT * FROM chat_messages'
        let params: any[] = []
        if (sessionId) { sql += ' WHERE session_id = ?'; params.push(sessionId) }
        sql += ' ORDER BY created_at ASC'
        const rows = await dbHelper.allQuery(sql, params)
        return rows.map((r: any) => {
          try {
            return {
              ...r,
              images: r.images ? JSON.parse(r.images) : [],
              sources: r.sources ? JSON.parse(r.sources) : [],
              tags: r.tags ? JSON.parse(r.tags) : [],
            }
          } catch {
            return { ...r, images: [], sources: [], tags: [] }
          }
        })
      } catch (err) { console.error('Failed to get chat messages:', err); return [] }
    },

    'save-chat-message': async (_: any, { sessionId, role, content, images, sources }: { sessionId: string, role: string, content: string, images?: any[], sources?: any[] }) => {
      try {
        const id = `${role}-${Date.now()}`
        await dbHelper.runQuery('INSERT INTO chat_messages (id, session_id, role, content, images, sources) VALUES (?, ?, ?, ?, ?, ?)', [id, sessionId, role, content, JSON.stringify(images || []), JSON.stringify(sources || [])])
        return { success: true, id }
      } catch (err) { console.error('Failed to save chat message:', err); throw err }
    },

    'update-chat-message': async (_: any, { messageId, content, sources }: { messageId: string, content?: string, sources?: any[] }) => {
      try {
        if (content !== undefined && sources !== undefined) {
          await dbHelper.runQuery('UPDATE chat_messages SET content = ?, sources = ? WHERE id = ?', [content, JSON.stringify(sources || []), messageId])
        } else if (content !== undefined) {
          await dbHelper.runQuery('UPDATE chat_messages SET content = ? WHERE id = ?', [content, messageId])
        } else if (sources !== undefined) {
          await dbHelper.runQuery('UPDATE chat_messages SET sources = ? WHERE id = ?', [JSON.stringify(sources || []), messageId])
        }
        return { success: true }
      } catch (err) { console.error('Failed to update chat message:', err); throw err }
    },

    'clear-chat-messages': async (_: any, { sessionId }: { sessionId?: string } = {}) => {
      try {
        if (sessionId) { await dbHelper.runQuery('DELETE FROM chat_messages WHERE session_id = ?', [sessionId]) }
        else { await dbHelper.runQuery('DELETE FROM chat_messages') }
        return { success: true }
      } catch (err) { console.error('Failed to clear chat messages:', err); throw err }
    },

    'rollback-chat-turn': async (_: any, { sessionId }: { sessionId: string }) => {
      try {
        // 获取最新两条消息（assistant + user）
        const latest = await dbHelper.allQuery(
          'SELECT id, role, created_at FROM chat_messages WHERE session_id = ? ORDER BY created_at DESC LIMIT 2',
          [sessionId]
        )
        if (latest.length === 0) return { success: false, message: '没有可回退的消息' }

        // 找到最后一条 assistant 消息的时间戳，用于删除该轮产生的记忆
        const lastAssistant = latest.find((m: any) => m.role === 'assistant')
        if (lastAssistant) {
          try {
            await dbHelper.runQuery(
              "DELETE FROM ai_memories WHERE source = 'auto' AND created_at >= ?",
              [lastAssistant.created_at]
            )
          } catch {}
        }

        // 删除最新的 assistant 和 user 消息
        const idsToDelete = latest.map((m: any) => m.id)
        for (const id of idsToDelete) {
          await dbHelper.runQuery('DELETE FROM chat_messages WHERE id = ?', [id])
        }

        // 更新会话时间
        await dbHelper.runQuery('UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [sessionId])

        return { success: true, deletedCount: idsToDelete.length }
      } catch (err) { console.error('Failed to rollback chat turn:', err); throw err }
    },

    'search-chat-messages': async (_: any, { query, projectName }: { query: string, projectName?: string }) => {
      try {
        const { cleanQuery, filters } = parseSearchQuery(query)
        const searchTerm = cleanQuery || query
        const ftsQuery = escapeFts5Query(searchTerm)
        let sql = `SELECT m.*, s.title as session_title FROM chat_messages m JOIN chat_messages_fts fts ON m.rowid = fts.rowid LEFT JOIN chat_sessions s ON m.session_id = s.id WHERE chat_messages_fts MATCH ?`
        const params: any[] = [ftsQuery]
        const tagFilter = applyTagFilter('m', filters.tag || [])
        if (tagFilter.clause) { sql += tagFilter.clause; params.push(...tagFilter.params) }
        const dateFilter = applyDateFilter('m', filters)
        if (dateFilter.clause) { sql += dateFilter.clause; params.push(...dateFilter.params) }
        sql += ` ORDER BY fts.rank LIMIT 50`
        const messages = await dbHelper.allQuery(sql, params)
        return messages.map((r: any) => {
          try {
            return {
              ...r,
              images: r.images ? JSON.parse(r.images) : [],
              sources: r.sources ? JSON.parse(r.sources) : [],
              tags: r.tags ? JSON.parse(r.tags) : [],
            }
          } catch {
            return { ...r, images: [], sources: [], tags: [] }
          }
        })
      } catch (err) { console.error('Failed to search chat messages:', err); return [] }
    },

    'auto-tag-message': async (_: any, { messageId, content, model }: { messageId?: string, content: string, model?: string }) => {
      try {
        const prompt = `请分析以下对话内容，提取3-5个关键词标签（用逗号分隔）。标签应该简洁、有代表性，使用中文或英文。只返回标签，不要其他解释。\n\n内容：${content}`
        const result = await modelRouter.chat({
          messages: toRouterMessages([{ role: 'user', content: prompt }]),
        })
        const tags = result.split(/[,，]/).map((t: string) => t.trim()).filter((t: string) => t.length > 0 && t.length < 20).slice(0, 5)
        if (messageId) {
          await dbHelper.runQuery('UPDATE chat_messages SET tags = ? WHERE id = ?', [JSON.stringify(tags), messageId])
        }
        return { success: true, tags }
      } catch (err) {
        console.error('Failed to auto-tag message:', err)
        return { success: false, tags: [] }
      }
    },

    'toggle-bookmark-message': async (_: any, { messageId, bookmarked }: { messageId: string, bookmarked: boolean }) => {
      try {
        await dbHelper.runQuery('UPDATE chat_messages SET bookmarked = ? WHERE id = ?', [bookmarked ? 1 : 0, messageId])
        return { success: true }
      } catch (err) { console.error('Failed to toggle bookmark:', err); throw err }
    },

    'get-bookmarked-messages': async () => {
      try {
        const messages = await dbHelper.allQuery(
          `SELECT m.*, s.title as session_title FROM chat_messages m LEFT JOIN chat_sessions s ON m.session_id = s.id WHERE m.bookmarked = 1 ORDER BY m.created_at DESC LIMIT 100`
        )
        return messages.map((r: any) => {
          try {
            return {
              ...r,
              images: r.images ? JSON.parse(r.images) : [],
              sources: r.sources ? JSON.parse(r.sources) : [],
              tags: r.tags ? JSON.parse(r.tags) : [],
            }
          } catch {
            return { ...r, images: [], sources: [], tags: [] }
          }
        })
      } catch (err) { console.error('Failed to get bookmarked messages:', err); return [] }
    },

    'get-attachment-context': async (_: any, { filePaths, fileBuffers }: { filePaths?: string[], fileBuffers?: Array<{ name: string, buffer: Buffer, mimeType?: string }> }) => {
      try {
        const { parseFileBuffer, parseFile } = await import('../fileProcessor')
        const results: Array<{ name: string, text: string, error?: string }> = []

        // Parse files from paths
        if (filePaths?.length) {
          for (const fp of filePaths) {
            try {
              const text = await parseFile(fp)
              const name = fp.split(/[\\/]/).pop() || fp
              if (text) results.push({ name, text })
            } catch (e: any) {
              results.push({ name: fp.split(/[\\/]/).pop() || fp, text: '', error: e?.message || '解析失败' })
            }
          }
        }

        // Parse files from buffers (uploaded via renderer)
        if (fileBuffers?.length) {
          for (const fb of fileBuffers) {
            try {
              const text = await parseFileBuffer(fb.name, Buffer.from(fb.buffer))
              if (text) results.push({ name: fb.name, text })
              else results.push({ name: fb.name, text: '', error: '无法提取文本内容' })
            } catch (e: any) {
              results.push({ name: fb.name, text: '', error: e?.message || '解析失败' })
            }
          }
        }

        return { success: true, attachments: results }
      } catch (err) { console.error('Failed to get attachment context:', err); return { success: false, attachments: [], error: String(err) } }
    },

    'open-file-path': async (_: any, { filePath }: { filePath: string }) => {
      try {
        if (!filePath || !isPathWithinVault(filePath, ctx.vaultPath)) {
          return { success: false, error: '路径不在工作区范围内' }
        }
        const dangerousExts = ['.exe', '.bat', '.cmd', '.ps1', '.msi', '.com', '.scr', '.vbs']
        const ext = path.extname(filePath).toLowerCase()
        if (dangerousExts.includes(ext)) {
          return { success: false, error: '不允许打开可执行文件' }
        }
        const { shell } = require('electron')
        await shell.openPath(filePath)
        return { success: true }
      } catch (err: any) {
        console.error('Failed to open file:', err)
        return { success: false, error: err?.message || '打开文件失败' }
      }
    },
  }
}
