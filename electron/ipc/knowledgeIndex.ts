/**
 * 知识库索引/嵌入/AI相关 IPC 处理器
 */
import { IpcModule, IpcContext } from './index'
import dbHelper from '../db'
import vectorDb from '../vectorDb'
import * as modelRouter from '../modelRouter'
import { resolvePreferredModel } from '../modelPreference'
import {
  GenerateSummarySchema,
  validateInput,
} from './schemas'
import {
  logError,
  logInfo,
  ErrorCategory,
} from '../errorHandler'
import {
  isPathWithinVault,
} from '../pathSecurity'
import { asyncMemo } from '../util/ttlCache'

// P1：知识库统计 IPC 调用频繁（首页轮询、设置页、KB 状态栏），加 5s TTL + 飞行合并
// 写操作（save/delete）会调用 invalidateKnowledgeStats() 主动失效
type StatsFn = (k: string) => Promise<{ memos: number; schedules: number; vectors: number }>;
let statsMemo: StatsFn | null = null;
function getStatsMemo(): StatsFn {
  if (statsMemo) return statsMemo;
  const fetch: StatsFn = async (_: string) => {
    const memoCount = await dbHelper.getQuery("SELECT COUNT(*) as count FROM notes WHERE type = 'quick_note'")
    const scheduleCount = await dbHelper.getQuery('SELECT COUNT(*) as count FROM schedules')
    const vectorCount = await vectorDb.getVectorCount()
    return { memos: memoCount?.count || 0, schedules: scheduleCount?.count || 0, vectors: vectorCount }
  };
  statsMemo = asyncMemo(fetch, { ttlMs: 5_000, maxEntries: 8 });
  return statsMemo;
}

/** 写操作后调用，强制下次 stats 重新查询 */
export function invalidateKnowledgeStats(): void {
  statsMemo = null;
}

export function createKnowledgeIndexModule(ctx: IpcContext): IpcModule {
  return {
    'get-knowledge-stats': async () => {
      try {
        return await getStatsMemo()('all')
      } catch (err) { logError('Failed to get knowledge stats:', ErrorCategory.UNKNOWN, { err }); return { memos: 0, schedules: 0, vectors: 0 } }
    },
    'rebuild-vector-index': async () => {
      try {
        await vectorDb.clearAll()
        invalidateKnowledgeStats()
        const notesList = await dbHelper.allQuery("SELECT * FROM notes WHERE type = 'quick_note'")
        let indexed = 0
        for (const note of notesList) {
          try {
            const text = note.content || note.text || ''
            if (text.trim()) {
              await vectorDb.addDocument({ id: note.id, text, title: note.title, type: 'memo', folder_id: note.folder_id })
              indexed++
            }
          } catch (e) { logError(`Failed to index note ${note.id}:`, ErrorCategory.DATABASE, { e }) }
        }
        return { success: true, indexed, total: notesList.length }
      } catch (err: any) { logError('Rebuild vector index failed:', ErrorCategory.DATABASE, { err }); throw err }
    },
    'delete-vector-entries': async (_: any, { ids }: { ids: string[] }) => {
      try {
        for (const id of ids) { await vectorDb.deleteDocument(id) }
        return { success: true }
      } catch (err: any) { logError('Delete vector entries failed:', ErrorCategory.DATABASE, { err }); throw err }
    },
    'perform-ocr': async (_: any, { imagePath }: { imagePath: string }) => {
      try { return { text: '', confidence: 0, error: 'OCR not available' } }
      catch (err: any) { logError('OCR failed:', ErrorCategory.UNKNOWN, { err }); return { text: '', confidence: 0, error: err.message } }
    },
    'analyze-screenshot': async (_: any, args: any) => {
      try {
        const ollamaMod = await import('../ollama');
        if (args.imageBase64s) {
          return await ollamaMod.default.analyzeScreenshot(args.imageBase64s, args.model, args.prompt);
        } else if (args.imagePath) {
          if (!isPathWithinVault(args.imagePath, ctx.vaultPath)) {
            throw new Error('路径不在工作区范围内');
          }
          const fs = await import('fs');
          const imageBuffer = fs.readFileSync(args.imagePath);
          const base64Image = imageBuffer.toString('base64');
          return await ollamaMod.default.analyzeImage(base64Image, args.prompt || '请描述这张截图的内容');
        } else {
          throw new Error('Missing image base64 or path');
        }
      } catch (err: any) {
        logError('Screenshot analysis failed:', ErrorCategory.UNKNOWN, { err });
        throw err;
      }
    },
    'parse-uploaded-document': async (_: any, { filePath }: { filePath: string }) => {
      try {
        if (!isPathWithinVault(filePath, ctx.vaultPath)) {
          throw new Error('路径不在工作区范围内')
        }
        const fs = await import('fs'); const content = fs.readFileSync(filePath, 'utf-8'); return { text: content, metadata: { name: filePath.split(/[\\/]/).pop(), size: content.length } }
      }
      catch (err: any) { logError('Document parsing failed:', ErrorCategory.FILE_SYSTEM, { err }); throw err }
    },
    'clipboard-ocr': async () => {
      try { return { text: '', confidence: 0 } }
      catch (err: any) { logError('Clipboard OCR failed:', ErrorCategory.UNKNOWN, { err }); return { text: '', confidence: 0 } }
    },
    'clear-vectors': async () => {
      try {
        await (await import('../vectorDb')).default.clearAll();
        invalidateKnowledgeStats();
        return { success: true }
      }
      catch (err: any) { logError('Clear vectors failed:', ErrorCategory.DATABASE, { err }); throw err }
    },
    'generate-file-summary': async (_: any, { fileId }: { fileId: string }) => {
      try {
        const file = await dbHelper.getQuery('SELECT * FROM file_metadata WHERE id = ?', [fileId])
        if (!file) return { success: false, error: 'File not found' }
        
        const chunks = await dbHelper.allQuery('SELECT text FROM file_chunks WHERE file_id = ? ORDER BY chunk_index', [fileId])
        if (!chunks || chunks.length === 0) return { success: false, error: 'No content available' }
        
        const fullText = chunks.map((c: any) => c.text).join('\n')
        const prompt = `你是一位知识管理专家。请为以下文档内容生成：\n1. 一段50-100字的摘要（用中文）\n2. 3-5个标签（每个标签2-4个字）\n\n文档名：${file.file_name}\n内容：${fullText.substring(0, 3000)}\n\n请按以下格式输出，不要添加其他内容：\n摘要：xxx\n标签：标签1,标签2,标签3`
        let responseText = ''
        try {
          responseText = await modelRouter.chat({ messages: [{ role: 'user' as const, content: prompt }] })
        } catch (err: any) {
          logError('[KB] Generate summary failed', ErrorCategory.AI_SERVICE, { err: err.message })
          responseText = ''
        }
        
        let summary = ''
        let tags: string[] = []
        const summaryMatch = responseText.match(/摘要[：:]\s*(.+)/)
        if (summaryMatch && summaryMatch[1]) summary = summaryMatch[1].trim()
        const tagsMatch = responseText.match(/标签[：:]\s*(.+)/)
        if (tagsMatch && tagsMatch[1]) {
          tags = tagsMatch[1].split(/[,，、]/).map((t: string) => t.trim()).filter(Boolean)
        }
        
        if (summary) await dbHelper.updateFileSummary(fileId, summary)
        if (tags.length > 0) {
          const existingTagsRow = await dbHelper.getQuery('SELECT tags FROM file_metadata WHERE id = ?', [fileId])
          let existingTags: string[] = []
          try { existingTags = existingTagsRow?.tags ? JSON.parse(existingTagsRow.tags) : [] } catch {}
          await dbHelper.updateFileTags(fileId, [...new Set([...existingTags, ...tags])])
        }
        
        logInfo(`[KB] Generated summary for ${file.file_name}: ${summary.substring(0, 30)}... | ${tags.join(',')}`)
        return { success: true, summary, tags }
      } catch (err: any) {
        logError('Failed to generate summary:', ErrorCategory.DATABASE, { err })
        return { success: false, error: err.message }
      }
    },
    'save-ai-memory': async (_: any, { category, content, relevance }: { category: string, content: string, relevance?: number }) => {
      try { const { v4: uuidv4 } = await import('uuid'); const id = uuidv4(); await dbHelper.runQuery('INSERT INTO ai_memories (id, category, content, source, relevance) VALUES (?, ?, ?, ?, ?)', [id, category, content, 'manual', relevance || 5]); return { success: true, id } }
      catch (err: any) { logError('Failed to save AI memory:', ErrorCategory.DATABASE, { err }); throw err }
    },
    'delete-ai-memory': async (_: any, { id }: { id: string }) => {
      try { await dbHelper.runQuery('DELETE FROM ai_memories WHERE id = ?', [id]); return { success: true } }
      catch (err: any) { logError('Failed to delete AI memory:', ErrorCategory.DATABASE, { err }); throw err }
    },
    'extract-memories': async (_: any, { content }: { content: string }) => {
      try {
        const ollamaMod = await import('../ollama')
        const preferredModel = await resolvePreferredModel()
        const result = await ollamaMod.default.generateChat([{ role: 'user', content: `从以下内容中提取关键记忆。返回JSON: {"memories":[{"category":"类别","content":"内容","relevance":1-10}]}\n\n内容：${content.substring(0, 2000)}` }], preferredModel)
        const jsonMatch = result.match(/\{[\s\S]*\}/)
        if (jsonMatch) { const parsed = JSON.parse(jsonMatch[0]); return parsed.memories || [] }
        return []
      } catch (err: any) { logError('Extract memories failed:', ErrorCategory.AI_SERVICE, { err }); return [] }
    },
  }
}