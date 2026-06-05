import { v4 as uuidv4 } from 'uuid'
import dbHelper from '../db'
import ollama from '../ollama'
import * as modelRouter from '../modelRouter'
import vectorDb from '../vectorDb'
import { searchWeb } from '../searxng'
import type { SearchProviderConfig } from '../searxng'
import { buildRAGContext } from './rag'
import { parseToolCalls, executeTool } from '../mcpTools'
import { logInfo, logWarn, logError, ErrorCategory } from '../errorHandler'
import { measureAsync } from '../perf'

export async function expandQuery(
  query: string,
  history: any[],
  activeModel: string | undefined,
  ollamaRunning: boolean,
  sendPhase?: (phase: string) => void
): Promise<string[]> {
  let expandedTerms: string[] = []
  const isSimpleGreeting = /^(hi|hello|hey|你好|您好|嗨|早上好|下午好|晚上好)[!！.。]?$/i.test(query.trim())
  if (isSimpleGreeting) return []

  sendPhase?.('query-expanding')

  if (ollamaRunning && activeModel) {
    try {
      expandedTerms = await ollama.expandQueryWithContext(query, history, activeModel)
      if (expandedTerms.length > 0) logInfo('[RAG Query Expansion]', { query, terms: expandedTerms.join(', ') })
    } catch {
      try { expandedTerms = await ollama.expandQuery(query, activeModel) } catch {}
    }
  } else {
    try {
      const prompt = `从以下问题中提取2-4个最关键的搜索关键词，用于本地知识库全文检索。请补充简称、别称、同义词，将长短语拆成独立关键词。只返回关键词用逗号分隔，不要解释。\n\n问题: ${query}\n关键词:`
      const result = await modelRouter.chat({ messages: [{ role: 'user' as const, content: prompt }] })
      expandedTerms = result.split(/[,，、\n]/).map((s: string) => s.trim()).filter((s: string) => s.length > 0 && s.length < 30)
      if (expandedTerms.length > 0) logInfo('[RAG Cloud Query Expansion]', { query, terms: expandedTerms.join(', ') })
    } catch (err) {
      logWarn('[RAG] Cloud query expansion failed', { error: err })
    }
  }

  return expandedTerms
}

export async function retrieveContext(
  allSearchTerms: string[],
  ragEnabled: boolean,
  vectorModelAvailable: boolean,
  searchEnabled: boolean,
  searxngUrl: string,
  query: string,
  history: any[],
  sendPhase?: (phase: string, data?: any) => void,
  searchProviders?: { selectedProvider?: string; bochaApiKey?: string; searchMode?: string }
): Promise<{
  expandedResults: any[],
  webResults: any[],
  memoryContext: string,
  kbContextWithRefs: string,
  webContextWithRefs: string,
  allRefNums: number
}> {
  const isSimpleGreeting = /^(hi|hello|hey|你好|您好|嗨|早上好|下午好|晚上好)[!！.。]?$/i.test(query.trim())

  let searchResults: any[] = []
  let sqliteResults: any[] = []
  let vectorSearchFailed = false

  sendPhase?.('retrieving')

  const searchOneTerm = async (term: string) => {
    if (isSimpleGreeting) return { vecRes: [], sqlRes: [] }
    logInfo('[RAG Search] searchOneTerm', { term, ragEnabled, vectorModelAvailable })
    const [vecRes, sqlRes] = await Promise.all([
      (ragEnabled && vectorModelAvailable) ? vectorDb.searchKnowledgeBase(term, 10).catch((err: any) => { logInfo('[RAG Search] vector search failed', { error: err.message }); vectorSearchFailed = true; return [] }) : Promise.resolve([]),
      ragEnabled ? dbHelper.searchMemosAndFiles(term).catch((err: any) => { logInfo('[RAG Search] sql search failed', { error: err.message }); return [] }) : Promise.resolve([])
    ])
    logInfo('[RAG Search] searchOneTerm result', { vecCount: vecRes.length, sqlCount: sqlRes.length })
    return { vecRes, sqlRes }
  }

  const allSearches = await measureAsync('rag:retrieve-local', () =>
    Promise.all(allSearchTerms.map(t => searchOneTerm(t)))
  )

  logInfo('[RAG Search]', { query, ragEnabled, allSearchTerms })

  const seenVecIds = new Set<string>()
  const seenSqlIds = new Set<string>()
  for (const { vecRes, sqlRes } of allSearches) {
    for (const r of vecRes) { if (!seenVecIds.has(r.id)) { seenVecIds.add(r.id); searchResults.push(r) } }
    for (const r of sqlRes) { if (!seenSqlIds.has(r.id)) { seenSqlIds.add(r.id); sqliteResults.push(r) } }
  }

  if (sqliteResults.length > 0) {
    logInfo('[RAG Search] SQL results preview', { results: sqliteResults.slice(0, 3).map((r: any) => ({ id: r.id, title: r.title || r.file_name, type: r.type })) })
  }

  let webResults: any[] = []
  if (searchEnabled) {
    sendPhase?.('web-searching')
    const searchConfig: SearchProviderConfig = {
      searxngUrl: searxngUrl || undefined,
      bochaApiKey: searchProviders?.bochaApiKey,
      selectedProvider: (searchProviders?.selectedProvider as 'searxng' | 'bocha' | 'bing' | undefined) || (searxngUrl ? 'searxng' : 'bing'),
      searchMode: (searchProviders?.searchMode as 'fast' | 'deep' | undefined),
    }
    try {
      const hasHistory = history && history.length > 0
      const conversationContext = hasHistory ? history.slice(-4).map((m: any) =>
        `${m.role === 'user' ? '用户' : '助手'}: ${String(m.content || '').substring(0, 200)}`
      ).join('\n') : ''

      const searchPrompt = hasHistory
        ? `基于以下对话历史和用户最新问题，生成 1-3 个最适合联网搜索的关键词或短语。
要求：
1. 关键词应该简洁、精准，适合搜索引擎
2. 如果问题需要最新信息，加上时间限定（如 2025）
3. 如果问题是关于特定产品/技术，使用官方名称
4. 只返回关键词，用逗号分隔，不要解释

对话历史：
${conversationContext}

用户最新问题：${query}

搜索关键词：`
        : `分析用户的问题，生成 1-3 个最适合联网搜索的关键词或短语。
要求：
1. 分析问题的核心主题和关键概念
2. 关键词应该简洁、精准，适合搜索引擎
3. 如果问题需要最新信息，加上时间限定（如 2025）
4. 如果问题是关于特定产品/技术，使用官方名称
5. 只返回关键词，用逗号分隔，不要解释

用户问题：${query}

搜索关键词：`

      const searchKeywords = await modelRouter.chat({ messages: [{ role: 'user' as const, content: searchPrompt }] })
      const keywords = searchKeywords.split(/[,，、\n]/)
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0 && s.length < 50)
        .slice(0, 3)

      logInfo('[Web Search] AI generated keywords', { keywords })

      const isTimeSensitive = /今天|明日|天气|新闻|最新|近期|现在|目前|202[4-9]|203\d/.test(query + ' ' + keywords.join(' '))
      const searchQueries = keywords.length > 0 ? keywords : [query]

      const searchPromises = searchQueries.map((kw: string) =>
        searchWeb(kw, searchConfig, 5, isTimeSensitive ? 'day' : '').catch(() => [])
      )
      const searchResultsArray = await Promise.all(searchPromises)

      const seenUrls = new Set<string>()
      for (const results of searchResultsArray) {
        for (const r of results) {
          if (!seenUrls.has(r.url)) {
            seenUrls.add(r.url)
            webResults.push(r)
          }
        }
      }

      logInfo('[Web Search] Found results', { count: webResults.length, queries: searchQueries.length })
    } catch (err: any) {
      logWarn('[Web Search] AI keyword generation failed, fallback to original query', { error: err.message })
      const isTimeSensitive = /今天|明日|天气|新闻|最新|近期|现在|目前/.test(query)
      webResults = await searchWeb(query, searchConfig, 5, isTimeSensitive ? 'day' : '').catch(() => [])
    }
  }

  const vectorMapped = searchResults.filter((r: any) => r.id !== 'dummy').map((r: any) => ({ ...r, id: r.id, title: r.title || '', text: r.text || r.content || '', type: r.type || 'memo', score: r._distance !== undefined ? (1 - r._distance) : 0.7 }))
  const sqliteMapped = sqliteResults.map((r: any) => ({ ...r, id: r.id, title: r.title || '', text: r.text || r.content || '', score: 1.0 }))
  const fusedResults = dbHelper.reciprocalRankFusion([sqliteMapped, vectorMapped], 60)
  const topResults = fusedResults.slice(0, 10)

  const expandedResults = await Promise.all(topResults.map(async (r: any) => {
    if (r.type === 'file_chunk' && r.file_id && r.chunk_index != null) {
      try {
        const neighbors = await dbHelper.getNeighborChunks(r.file_id, r.chunk_index, 1)
        if (neighbors.length > 1) {
          const fullText = neighbors.map((c: any) => c.text).join('\n')
          return { ...r, text: fullText }
        }
      } catch {}
    }
    return r
  }))

  buildRAGContext(expandedResults, 6000)

  const kbContextWithRefs = expandedResults.map((r: any, idx: number) => {
    const refNum = idx + 1
    const sourceLabel = r.type === 'web' ? `网页` : r.type === 'file_chunk' ? `文档` : `便签`
    return `[${refNum}] [${sourceLabel}] ${r.title || r.file_name || '未命名'}\n${r.text || r.content || ''}`
  }).join('\n\n---\n\n')

  const webContextWithRefs = webResults.map((r: any, idx: number) => {
    const refNum = expandedResults.length + idx + 1
    return `[${refNum}] [网页] ${r.title}\nURL: ${r.url}\n内容: ${r.content}`
  }).join('\n\n---\n\n')

  const allRefNums = expandedResults.length + webResults.length

  let memoryContext = ''
  try {
    const memories = await dbHelper.allQuery('SELECT category, content, relevance FROM ai_memories ORDER BY relevance DESC LIMIT 10')
    if (memories.length > 0) { memoryContext = memories.map((m: any) => `[${m.category}] ${m.content}`).join('\n') }
  } catch {}

  return {
    expandedResults,
    webResults,
    memoryContext,
    kbContextWithRefs,
    webContextWithRefs,
    allRefNums
  }
}

export function buildSystemPrompt(params: {
  ragEnabled: boolean,
  searchEnabled: boolean,
  kbContextWithRefs: string,
  webContextWithRefs: string,
  memoryContext: string,
  allRefNums: number
}): string {
  const { ragEnabled, searchEnabled, kbContextWithRefs, webContextWithRefs, memoryContext } = params

  return `你是一个名为"AuraCommand" 的智能助手。请根据当前启用的模式回答用户的提问。
        【当前时间】：${new Date().toLocaleString()}
        【本地知识库状态】：${ragEnabled ? '已开启' : '已关闭'}
        【本地知识库内容】：\n${kbContextWithRefs || (ragEnabled ? '（未找到相关的本地便签或文档）' : '（本地知识库功能未开启）')}
        【联网搜索状态】：${searchEnabled ? '已开启' : '已关闭'}
        【网页搜索结果】：\n${webContextWithRefs || (searchEnabled ? '（未找到相关的网页搜索结果）' : '（实时联网功能未开启）')}
        【用户记忆（仅作参考，禁止主动提及）】：${memoryContext ? '\n' + memoryContext : '（暂无关于该用户的记忆信息）'}
        【回答准则】：
        1. ${ragEnabled ? '优先使用本地知识库中的信息' : '当前已禁用本地知识库，请直接回答或使用搜索结果'}
        2. ${searchEnabled ? '如果本地信息不足或已禁用，再结合网页搜索结果进行补充' : '当前已禁用联网搜索，请仅基于本地知识或你的通用知识回答'}
        3. 【引用标注】当你的回答引用了知识库或网页内容时，必须在相关句子末尾使用 **[数字]** 格式标注来源编号（如 **[1]**、**[2]**）。每个编号对应上方的一条来源。不要编造不存在的编号。
        4. 如果所有外部来源都没有相关信息，请诚实告知用户，并基于你的通用知识给出简要回答
        5. 使用简洁、专业且富有亲和力的中文回答
        6. 充分利用 Markdown 格式：使用 **加粗** 强调重点，使用列表组织信息，使用代码块包裹代码
        7. 知识库来源中标注了空间名称（如 [工作空间]、[学习空间]），当回答涉及多个空间的内容时，请按空间分组组织回答，并标注来源空间。当用户问题涉及特定空间时，优先使用该空间的内容
        8. 【严格遵守】用户记忆仅供内部背景参考。绝对不要在回复中主动提及、暗示或透露你知道用户之前在做什么、聊过什么、有什么习惯或偏好。除非用户的问题直接询问相关内容，否则完全忽略用户记忆，像一个全新对话一样回答。禁止使用"我注意到你之前……"、"根据我们的历史对话……"、"我记得你……"等任何形式的记忆引用`
}

export async function extractMemories(
  fullResponse: string,
  activeSessionId: string | undefined
): Promise<void> {
  if (fullResponse.length <= 50 || !activeSessionId) return

  try {
    const sessionMessages = await dbHelper.allQuery('SELECT role, content FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC', [activeSessionId])
    if (sessionMessages.length < 2) return

    const memoryPrompt = `分析以下对话，提取值得长期记忆的信息。只提取用户明确表达的偏好、习惯、重要事实。返回JSON: {"memories":[{"category":"偏好/习惯/个人信息/工作/其他","content":"记忆内容","relevance":1-10}]}，没有则返回{"memories":[]}。只返回JSON。

对话:
${sessionMessages.slice(-6).map((m: any) => `${m.role}: ${String(m.content || '').substring(0, 300)}`).join('\n')}`
    modelRouter.chat({ messages: [{ role: 'user', content: memoryPrompt }] }).then(async (result: string) => {
      const jsonMatch = result.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        if (parsed.memories) {
          for (const memory of parsed.memories) {
            const existing = await dbHelper.allQuery('SELECT id FROM ai_memories WHERE content LIKE ? LIMIT 1', [`%${memory.content.substring(0, 30)}%`])
            if (existing.length === 0) { const id = uuidv4(); await dbHelper.runQuery('INSERT INTO ai_memories (id, category, content, source, relevance) VALUES (?, ?, ?, ?, ?)', [id, memory.category || 'general', memory.content, 'auto', memory.relevance || 5]) }
          }
        }
      }
    }).catch((err) => { logWarn('[Memory] Auto-extraction failed', { error: err?.message }) })
  } catch {}
}

export async function executeAgentTools(
  fullResponse: string,
  fullThinking: string,
  assistantContent: string,
  assistantMsgId: string,
  agentEnabled: boolean,
  sendToolCall?: (data: any) => void,
  sendChunk?: (data: any) => void
): Promise<{ updatedContent: string | null }> {
  const { calls, cleanResponse } = agentEnabled ? parseToolCalls(fullResponse) : { calls: [], cleanResponse: fullResponse }
  if (!agentEnabled || calls.length === 0) return { updatedContent: null }

  const toolResults: string[] = []
  for (const call of calls) {
    sendToolCall?.({ tool: call.tool, args: call.args })
    const result = await executeTool(call)
    toolResults.push(`工具 ${call.tool}: ${result.message}${result.success && result.result ? `\n详情: ${JSON.stringify(result.result)}` : ''}`)
  }
  const toolResultText = toolResults.join('\n\n')
  const updatedContent = cleanResponse ? `${cleanResponse}\n\n---\n🔧 **工具执行结果**：\n${toolResultText}` : `🔧 **工具执行结果**：\n${toolResultText}`
  sendChunk?.({ chunk: `\n\n---\n🔧 **工具执行结果**：\n${toolResultText}` })

  if (assistantMsgId) {
    try {
      await dbHelper.runQuery('UPDATE chat_messages SET content = ? WHERE id = ?', [fullThinking.trim() ? assistantContent.replace(fullResponse, updatedContent) : updatedContent, assistantMsgId])
    } catch (dbErr) { logError('Failed to update tool results', ErrorCategory.DATABASE, { error: dbErr }) }
  }

  return { updatedContent }
}
