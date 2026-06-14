import * as modelRouter from '../modelRouter'
import { runQuery, allQuery, getQuery } from '../db'
import { v4 as uuidv4 } from 'uuid'
import log from 'electron-log'

const DIGEST_META_KEY = 'knowledge_digest_status'
const CHUNK_SIZE = 8000

export interface DigestItem {
  id: string
  source_id: string
  source_type: string
  source_title: string
  category: string
  key_facts: string[]
}

export interface DigestSummary {
  totalFiles: number
  digestedFiles: number
  lastUpdated: string | null
  categories: { name: string; count: number }[]
  status: 'idle' | 'running' | 'done'
}

let abortController: AbortController | null = null

export function cancelDigest(): void {
  if (abortController) {
    abortController.abort()
    abortController = null
  }
}

export async function getDigestSummary(): Promise<DigestSummary> {
  const files = await allQuery('SELECT COUNT(*) as total FROM knowledge_digest')
  const meta = await getQuery('SELECT value FROM digest_metadata WHERE key = ?', [DIGEST_META_KEY])
  const cats = await allQuery('SELECT category, COUNT(*) as count FROM knowledge_digest GROUP BY category ORDER BY count DESC')
  const totalFiles = await getQuery('SELECT COUNT(*) as total FROM file_metadata WHERE is_indexed = 1')
  const totalCount = totalFiles?.total || 0
  const digestedCount = files?.[0]?.total || 0
  const lastUpdated = meta?.value || null
  return {
    totalFiles: totalCount,
    digestedFiles: digestedCount,
    lastUpdated,
    categories: (cats || []).map((c: any) => ({ name: c.category || '未分类', count: c.count })),
    // status 判断：优先看 metadata 的 lastUpdated，但也检查 digest 表是否有实际数据
    // 防止 metadata 丢失但 digest 数据仍存在时误显示"未学习"
    status: (lastUpdated || digestedCount > 0) ? 'done' : 'idle',
  }
}

export async function getDigestByCategory(category?: string): Promise<DigestItem[]> {
  let rows: any[]
  if (category) {
    rows = await allQuery('SELECT * FROM knowledge_digest WHERE category = ? ORDER BY source_title', [category])
  } else {
    rows = await allQuery('SELECT * FROM knowledge_digest ORDER BY category, source_title')
  }
  return (rows || []).map((r: any) => ({
    id: r.id,
    source_id: r.source_id,
    source_type: r.source_type,
    source_title: r.source_title,
    category: r.category || '',
    key_facts: JSON.parse(r.key_facts || '[]'),
  }))
}

export async function getDigestForPrompt(): Promise<string> {
  const rows = await allQuery(`
    SELECT source_title, category, key_facts FROM knowledge_digest
    ORDER BY category, source_title
  `)
  if (!rows || rows.length === 0) return ''

  const grouped: Record<string, { title: string; facts: string[] }[]> = {}
  for (const r of rows) {
    const cat = r.category || '未分类'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push({ title: r.source_title, facts: JSON.parse(r.key_facts || '[]') })
  }

  const parts: string[] = []
  for (const [cat, items] of Object.entries(grouped)) {
    const itemLines = items.map(i => {
      const facts = i.facts.map(f => `  - ${f}`).join('\n')
      return `📄 ${i.title}\n${facts}`
    }).join('\n')
    parts.push(`【${cat}】\n${itemLines}`)
  }

  return `以下是你已学习过的知识库文件要点（按分类列出）：\n\n${parts.join('\n\n')}`
}

function categorizeFile(fileName: string): string {
  const name = fileName.toLowerCase()
  if (/\.(ts|tsx|js|jsx|py|go|rs|java|cpp|c|h|hpp|cs|swift|kt|rb|php)$/.test(name)) return '代码文件'
  if (/\.(pdf|doc|docx)$/.test(name)) return '文档资料'
  if (/\.(xls|xlsx|csv)$/.test(name)) return '表格数据'
  if (/\.(md|txt)$/.test(name)) return '文本笔记'
  if (/\.(png|jpg|jpeg|gif|webp|bmp)$/.test(name)) return '图片文件'
  if (/\.(ppt|pptx|key)$/.test(name)) return '演示文稿'
  if (/操作手册|部署|指南|教程|howto|usage|manual|setup|install/.test(name)) return '操作手册'
  if (/协议|合同|合约|nda|agreement|contract|license/.test(name)) return '协议合同'
  return '其他文件'
}

async function extractKeyFacts(title: string, content: string): Promise<{ category: string; facts: string[] }> {
  const truncated = content.length > CHUNK_SIZE ? content.substring(0, CHUNK_SIZE) : content
  const prompt = `你是一个文档分析助手。分析以下文档内容，提取 3~5 条最关键的事实信息。

要求：
1. 每条关键事实用一句话概括，简洁明确
2. 聚焦具体的信息：数据、规则、结论、配置、流程等
3. 不要写无关的评论或总结
4. 每条事实用 "- " 开头，每行一条

文档标题：${title}
文档内容：
${truncated}

关键事实：`

  try {
      const result = await modelRouter.chat({ messages: [{ role: 'user', content: prompt }] })
    const lines = result.split('\n').map(l => l.trim()).filter(l => l.startsWith('- '))
    const facts = lines.map(l => l.replace(/^-\s*/, '').trim()).filter(Boolean)
    const category = categorizeFile(title)
    return { category, facts: facts.length > 0 ? facts : [`（未能从 ${title} 中提取关键事实）`] }
  } catch (err) {
    log.warn(`[KnowledgeDigest] Failed to extract facts for ${title}:`, err)
    return { category: categorizeFile(title), facts: [`${title}: 提取失败`] }
  }
}

async function getAllIndexedFiles(): Promise<any[]> {
  return allQuery(`
    SELECT id, file_name, file_type, summary
    FROM file_metadata 
    WHERE is_indexed = 1
    ORDER BY file_name
  `)
}

async function getFileContent(file: any): Promise<string> {
  if (file.summary && file.summary.length > 10) return file.summary
  const chunks = await allQuery('SELECT text FROM file_chunks WHERE file_id = ? ORDER BY chunk_index', [file.id])
  if (chunks && chunks.length > 0) {
    return chunks.map((c: any) => c.text).join('\n')
  }
  return file.file_name || ''
}

export async function startFullDigest(onProgress?: (current: number, total: number, fileName: string) => void): Promise<void> {
  abortController = new AbortController()
  const signal = abortController.signal

  try {
    await runQuery('DELETE FROM knowledge_digest')
    const files = await getAllIndexedFiles()
    const total = files.length
    if (total === 0) {
      log.info('[KnowledgeDigest] No indexed files to digest')
      await runQuery('INSERT OR REPLACE INTO digest_metadata (key, value) VALUES (?, ?)',
        [DIGEST_META_KEY, new Date().toISOString()])
      return
    }

    for (let i = 0; i < total; i++) {
      if (signal.aborted) {
        log.info('[KnowledgeDigest] Digest cancelled')
        return
      }

      const file = files[i]
      const content = await getFileContent(file)
      onProgress?.(i + 1, total, file.file_name)

      const { category, facts } = await extractKeyFacts(file.file_name, content)
      const id = uuidv4()

      await runQuery(
        `INSERT INTO knowledge_digest (id, source_id, source_type, source_title, category, key_facts, created_at, updated_at)
         VALUES (?, ?, 'file', ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))`,
        [id, file.id, file.file_name, category, JSON.stringify(facts)]
      )
    }

    const now = new Date().toISOString()
    await runQuery('INSERT OR REPLACE INTO digest_metadata (key, value) VALUES (?, ?)',
      [DIGEST_META_KEY, now])

    log.info(`[KnowledgeDigest] Full digest complete: ${total} files`)
  } catch (err) {
    log.error('[KnowledgeDigest] Digest failed:', err)
    throw err
  } finally {
    abortController = null
  }
}

export async function incrementalDigest(changedFileIds: string[]): Promise<void> {
  if (changedFileIds.length === 0) return

  try {
    for (const fileId of changedFileIds) {
      await runQuery('DELETE FROM knowledge_digest WHERE source_id = ?', [fileId])

      const file = await getQuery('SELECT id, file_name, summary FROM file_metadata WHERE id = ?', [fileId])
      if (!file) continue

      const content = await getFileContent(file)
      const { category, facts } = await extractKeyFacts(file.file_name, content)
      const id = uuidv4()

      await runQuery(
        `INSERT INTO knowledge_digest (id, source_id, source_type, source_title, category, key_facts, created_at, updated_at)
         VALUES (?, ?, 'file', ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))`,
        [id, file.id, file.file_name, category, JSON.stringify(facts)]
      )
    }

    const now = new Date().toISOString()
    await runQuery('INSERT OR REPLACE INTO digest_metadata (key, value) VALUES (?, ?)',
      [DIGEST_META_KEY, now])

    log.info(`[KnowledgeDigest] Incremental digest complete: ${changedFileIds.length} files`)
  } catch (err) {
    log.error('[KnowledgeDigest] Incremental digest failed:', err)
    throw err
  }
}

export async function clearDigest(): Promise<void> {
  await runQuery('DELETE FROM knowledge_digest')
  await runQuery('DELETE FROM digest_metadata')
  log.info('[KnowledgeDigest] Cleared all digest data')
}
