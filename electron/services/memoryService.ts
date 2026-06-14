import { v4 as uuidv4 } from 'uuid'
import log from 'electron-log'
import dbHelper from '../db'
import * as modelRouter from '../modelRouter'

const MAX_CONTEXT_MEMORIES = 10
const DECAY_DAYS = 30
const RELEVANCE_BOOST_ON_ACCESS = 1
const MENTIONABLE_THRESHOLD = 9
const BACKGROUND_THRESHOLD = 5

export interface MemoryEntry {
  id: string
  category: string
  content: string
  source: string
  relevance: number
  created_at: string
  updated_at: string
  last_accessed: string
}

export async function getMemoriesForContext(): Promise<{ mentionable: string; background: string }> {
  try {
    await dbHelper.runQuery(
      `UPDATE ai_memories SET relevance = MAX(1, relevance - 1), last_accessed = datetime('now', 'localtime')
       WHERE julianday('now') - julianday(last_accessed) > ? AND relevance > 1`,
      [DECAY_DAYS / 2]
    )
    const memories = await dbHelper.allQuery(
      'SELECT id, category, content, relevance FROM ai_memories ORDER BY relevance DESC, last_accessed DESC LIMIT ?',
      [MAX_CONTEXT_MEMORIES]
    )
    if (memories.length > 0) {
      for (const m of memories) {
        await dbHelper.runQuery(
          "UPDATE ai_memories SET relevance = MIN(10, relevance + ?), last_accessed = datetime('now', 'localtime') WHERE id = ?",
          [RELEVANCE_BOOST_ON_ACCESS, m.id]
        )
      }
      const mentionable = memories
        .filter((m: any) => m.relevance >= MENTIONABLE_THRESHOLD)
        .map((m: any) => `[${m.category}] ${m.content}`)
        .join('\n')
      const background = memories
        .filter((m: any) => m.relevance >= BACKGROUND_THRESHOLD && m.relevance < MENTIONABLE_THRESHOLD)
        .map((m: any) => `[${m.category}] ${m.content}`)
        .join('\n')
      return { mentionable, background }
    }
    return { mentionable: '', background: '' }
  } catch (err) {
    log.warn('[MemoryService] getMemoriesForContext failed:', err)
    return { mentionable: '', background: '' }
  }
}

export function getMemoryTier(relevance: number): 'mentionable' | 'background' | 'hidden' {
  if (relevance >= MENTIONABLE_THRESHOLD) return 'mentionable'
  if (relevance >= BACKGROUND_THRESHOLD) return 'background'
  return 'hidden'
}

export async function extractMemoriesFromChat(
  sessionMessages: { role: string; content: string }[]
): Promise<void> {
  if (sessionMessages.length < 2) return

  try {
    const prompt = `分析以下对话，提取值得长期记忆的信息。只提取用户明确表达的偏好、习惯、重要事实。

评分规则 (relevance 1-10):
- 9-10: 明确的个人偏好/习惯/身份信息，可持续影响多次对话（如"我是前端工程师"）
- 5-8:  一般性事实或临时需求，可能在特定场景有用
- 1-4:  琐碎信息，几乎不需要记住

返回JSON: {"memories":[{"category":"偏好/习惯/个人信息/工作/其他","content":"记忆内容","relevance":1-10}]}，没有则返回{"memories":[]}。只返回JSON。

对话:
${sessionMessages.slice(-6).map((m: any) => `${m.role}: ${String(m.content || '').substring(0, 300)}`).join('\n')}`

    const result = await modelRouter.chat({ messages: [{ role: 'user', content: prompt }] })
    const jsonMatch = result.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return

    const parsed = JSON.parse(jsonMatch[0])
    if (!parsed.memories || !Array.isArray(parsed.memories)) return

    for (const memory of parsed.memories) {
      await insertMemoryIfNew(memory.category || 'general', memory.content, 'auto', memory.relevance || 5)
    }
  } catch (err) {
    log.warn('[MemoryService] extractMemoriesFromChat failed:', err)
  }
}

async function insertMemoryIfNew(category: string, content: string, source: string, relevance: number): Promise<void> {
  try {
    const existing = await dbHelper.allQuery(
      'SELECT id, relevance, content FROM ai_memories WHERE content LIKE ? LIMIT 1',
      [`%${content.substring(0, 30)}%`]
    )
    if (existing.length > 0) {
      const existingContent = existing[0].content
      const sim = simpleSimilarity(content, existingContent)
      if (sim > 0.6) {
        await dbHelper.runQuery(
          'UPDATE ai_memories SET relevance = MAX(relevance, ?), updated_at = datetime(\'now\', \'localtime\') WHERE id = ?',
          [Math.max(relevance, existing[0].relevance), existing[0].id]
        )
        return
      }
    }
    const id = uuidv4()
    await dbHelper.runQuery(
      'INSERT INTO ai_memories (id, category, content, source, relevance) VALUES (?, ?, ?, ?, ?)',
      [id, category, content, source, relevance]
    )
  } catch (err) {
    log.warn('[MemoryService] insertMemoryIfNew failed:', err)
  }
}

function simpleSimilarity(a: string, b: string): number {
  const shorter = a.length < b.length ? a : b
  const longer = a.length < b.length ? b : a
  if (longer.length === 0) return 1.0
  const matchingChars = shorter.split('').filter((ch, i) => ch === longer[i]).length
  return matchingChars / longer.length
}

export async function searchMemories(query: string): Promise<MemoryEntry[]> {
  try {
    return await dbHelper.allQuery(
      `SELECT * FROM ai_memories
       WHERE content LIKE ? OR category LIKE ?
       ORDER BY relevance DESC, last_accessed DESC`,
      [`%${query}%`, `%${query}%`]
    )
  } catch (err) {
    log.warn('[MemoryService] searchMemories failed:', err)
    return []
  }
}

export async function updateMemoryRelevance(id: string, relevance: number): Promise<void> {
  try {
    await dbHelper.runQuery(
      'UPDATE ai_memories SET relevance = ?, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?',
      [Math.max(1, Math.min(10, relevance)), id]
    )
  } catch (err) {
    log.warn('[MemoryService] updateMemoryRelevance failed:', err)
  }
}

export async function getMemoryStats(): Promise<{ total: number; categories: { name: string; count: number }[]; avgRelevance: number }> {
  try {
    const total = await dbHelper.getQuery('SELECT COUNT(*) as count FROM ai_memories')
    const cats = await dbHelper.allQuery('SELECT category, COUNT(*) as count FROM ai_memories GROUP BY category ORDER BY count DESC')
    const avg = await dbHelper.getQuery('SELECT AVG(relevance) as avg FROM ai_memories')
    return {
      total: total?.count || 0,
      categories: (cats || []).map((c: any) => ({ name: c.category || '未分类', count: c.count })),
      avgRelevance: Math.round((avg?.avg || 0) * 10) / 10,
    }
  } catch {
    return { total: 0, categories: [], avgRelevance: 0 }
  }
}
