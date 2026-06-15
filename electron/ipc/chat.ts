/**
 * Chat 核心 IPC 处理器：chat-with-kb、chat-knowledge、stop-chat
 */
import { v4 as uuidv4 } from 'uuid'
import log from 'electron-log'
import { IpcModule, IpcContext } from './index'
import dbHelper from '../db'
import * as modelRouter from '../modelRouter'
import { resolvePreferredModel } from '../modelPreference'
import vectorDb from '../vectorDb'
import { searchWeb } from '../searxng'
import type { SearchProviderConfig } from '../searxng'
import { buildRAGContext } from '../services/rag'
import { getDynamicToolPrompt, detectPreferredMcpServer, getMcpServerLabel } from '../mcpTools'
import type { McpCategoryPreference, McpToolCategory } from '../mcpTools'
import { parseToolCalls } from '../mcpTools'
import { classifyQueryIntent } from '../classifyQueryIntent'

import { getMemoriesForContext, extractMemoriesFromChat } from '../services/memoryService'
import {
  toRouterMessages,
  stripThinkBlocks,
  sanitizeVisibleAssistantText,
  detectCategoryPreferences,
} from './chatUtils'
import { searchDigestByQuery } from '../services/knowledgeDigest'
import { resolveToolCallLoop, forceToolDecisionIfNeeded, synthesizeToolAnswer, detectImageGenerationIntent } from './chatAgent'
import { executeTool } from '../mcpTools'

export function createChatModule(ctx: IpcContext): IpcModule {
  return {
    'chat-with-kb': async (event: any, { query, model, sessionId, history = [], searchEnabled = false, ragEnabled = true, searxngUrl = '', searchProviders, images = [], systemPrompt: customSystemPrompt = '', noPersist = false, cloudModelId, preferredMcpServerId: frontendPreferredMcpServerId, attachments, projectName }: { query: string, model: string, sessionId?: string, history?: any[], searchEnabled?: boolean, ragEnabled?: boolean, searxngUrl?: string, searchProviders?: { selectedProvider?: string; bochaApiKey?: string; searchMode?: string }, images?: string[], systemPrompt?: string, noPersist?: boolean, cloudModelId?: string, preferredMcpServerId?: string, attachments?: Array<{ name: string, text: string }>, projectName?: string }) => {
      try {
        // 输入安全校验
        if (typeof query !== 'string') throw new Error('query 参数无效')
        if (query.trim() === '' && (!images || images.length === 0) && (!attachments || attachments.length === 0)) throw new Error('query 参数无效')
        if (query.length > 50000) throw new Error('query 长度超出限制')
        if (searxngUrl && typeof searxngUrl === 'string' && searxngUrl.trim() && !/^https?:\/\/.+/.test(searxngUrl)) {
          searxngUrl = ''
        }
        if (!Array.isArray(history)) throw new Error('history 参数无效')

        const activeModel = await resolvePreferredModel(model)
        let activeSessionId = sessionId
        if (ctx.chatAbortController.current) { ctx.chatAbortController.current.abort() }
        ctx.chatAbortController.current = new AbortController()

        let searchResults: any[] = []
        let sqliteResults: any[] = []
        let vectorSearchFailed = false

        const vectorSearchPromise = ragEnabled
          ? vectorDb.searchKnowledgeBase(query, 10, projectName).catch((err: any) => {
              console.warn('[Vector Search] Failed, falling back to SQLite only:', err.message)
              vectorSearchFailed = true
              return []
            })
          : Promise.resolve([])

        const sqliteSearchPromise = ragEnabled
          ? dbHelper.searchMemosAndFiles(query, projectName).catch((err: any) => {
              console.warn('[SQLite Search] Failed:', err.message)
              return []
            })
          : Promise.resolve([])

        const isTimeSensitive = /今天|明日|天气|新闻|最新|近期|现在|目前/.test(query)
        const searchConfig: SearchProviderConfig = {
          searxngUrl: searxngUrl || undefined,
          bochaApiKey: searchProviders?.bochaApiKey,
          selectedProvider: (searchProviders?.selectedProvider as 'searxng' | 'bocha' | 'bing' | undefined) || (searxngUrl ? 'searxng' : 'bing'),
          searchMode: (searchProviders?.searchMode as 'fast' | 'deep' | undefined),
        }
        const webSearchPromise = searchEnabled ? searchWeb(query, searchConfig, 5, isTimeSensitive ? 'day' : '') : Promise.resolve([])

        let webResults: any[] = []
        ;[searchResults, sqliteResults, webResults] = await Promise.all([vectorSearchPromise, sqliteSearchPromise, webSearchPromise])
        console.log(`[Web Search] Found ${webResults.length} results`)
        webResults.forEach((r: any, i: number) => console.log(`  [${i}] ${r.title} - ${r.url}`))

        // 向量搜索结果：计算相关性分数，过滤低相关性结果
        // _distance 是向量距离，范围约 0-2，越小越相似
        // 转换为 0-1 的相关性分数：score = 1 - min(_distance, 1)
        // 阈值 0.3 表示只保留相关性分数 > 0.3 的结果（即 _distance < 0.7）
        const VECTOR_SCORE_THRESHOLD = 0.3
        const vectorMapped = searchResults
          .filter((r: any) => r.id !== 'dummy')
          .map((r: any) => {
            const distance = r._distance ?? 1
            const score = Math.max(0, 1 - Math.min(distance, 1))
            return { ...r, id: r.id, title: r.title || r.file_name || '', text: r.text || r.content || '', type: r.type || 'memo', score, distance }
          })
          .filter((r: any) => r.score > VECTOR_SCORE_THRESHOLD)

        // SQLite 结果：基于关键词匹配计算相关性分数
        // 简单策略：检查查询关键词在文本中出现的次数
        const queryKeywords = query.toLowerCase().split(/[\s,，。、？?！!；;：:]+/).filter((w: string) => w.length >= 2)
        const SQLITE_SCORE_THRESHOLD = 0.1  // 降低阈值，避免过滤掉太多结果
        const sqliteMapped = sqliteResults
          .map((r: any) => {
            const text = (r.text || r.content || '').toLowerCase()
            const title = (r.title || r.file_name || '').toLowerCase()
            let matchScore = 0
            // 基础分数：每条结果至少给 0.1 分（避免全过滤）
            matchScore = 0.1
            for (const kw of queryKeywords) {
              // 标题匹配权重更高
              if (title.includes(kw)) matchScore += 0.4
              // 内容匹配
              const count = (text.match(new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
              matchScore += Math.min(count * 0.15, 0.6)
            }
            const score = Math.min(matchScore, 1)
            return { ...r, id: r.id, title: r.title || r.file_name || '', text: r.text || r.content || '', type: r.type || 'memo', score }
          })
          .filter((r: any) => r.score > SQLITE_SCORE_THRESHOLD)

        console.log(`[RAG] Vector results: ${searchResults.length} → ${vectorMapped.length} after threshold (${VECTOR_SCORE_THRESHOLD})`)
        console.log(`[RAG] SQLite results: ${sqliteResults.length} → ${sqliteMapped.length} after threshold (${SQLITE_SCORE_THRESHOLD})`)

        const fusedResults = dbHelper.reciprocalRankFusion([sqliteMapped, vectorMapped], 60)
        let topResults = fusedResults.slice(0, 10)

        // 知识要点辅助检索：当 RAG 结果不足时，用知识要点匹配补充相关文件内容
        if (ragEnabled && topResults.length < 5) {
          try {
            const digestMatches = await searchDigestByQuery(query, 3)
            if (digestMatches.length > 0) {
              console.log(`[Digest] Found ${digestMatches.length} digest matches for query`)
              // 根据匹配的 source_id 获取文件内容
              const digestFileIds = digestMatches.map(d => d.source_id)
              const digestFileChunks = await dbHelper.allQuery(
                `SELECT fc.file_id, fc.text, fm.file_name as title
                 FROM file_chunks fc
                 JOIN file_metadata fm ON fc.file_id = fm.id
                 WHERE fc.file_id IN (${digestFileIds.map(() => '?').join(',')})
                 ORDER BY fc.chunk_index
                 LIMIT 50`,
                digestFileIds
              )
              // 将摘要匹配的文件内容补充到 topResults
              const digestResults = digestFileChunks.map((c: any) => ({
                id: `digest-${c.file_id}`,
                title: c.title || '',
                text: c.text || '',
                type: 'file_chunk',
                score: 0.6, // 稍低的分数，表示是通过摘要匹配的
                source: 'digest-match'
              }))
              // 去重后合并
              const existingIds = new Set(topResults.map((r: any) => r.id))
              for (const dr of digestResults) {
                if (!existingIds.has(dr.id)) {
                  topResults.push(dr)
                  existingIds.add(dr.id)
                }
              }
              console.log(`[Digest] Added ${digestResults.filter((r: any) => !existingIds.has(r.id) || true).length} digest-matched results`)
            }
          } catch (err) {
            console.warn('[Digest] searchDigestByQuery failed:', err)
          }
        }

        // 云端模型支持更大上下文，本地模型窗口有限
        const maxContextChars = cloudModelId ? 15000 : 6000
        const kbContext = buildRAGContext(topResults, maxContextChars)

        console.log(`[RAG] Query: "${query}"`)
        console.log(`[RAG] Vector results: ${vectorMapped.length}, SQLite results: ${sqliteMapped.length}`)
        console.log(`[RAG] Fused results: ${fusedResults.length}, Top results: ${topResults.length}`)
        console.log(`[RAG] KB context length: ${kbContext.length} chars (budget: ${maxContextChars})`)
        if (kbContext) {
          console.log(`[RAG] KB context preview: ${kbContext.substring(0, 200)}...`)
        } else {
          console.log(`[RAG] No KB context found`)
        }

        const webContext = webResults.map((r: any) => `[来源: 网页 - ${r.title}]\nURL: ${r.url}\n内容: ${r.content}`).join('\n\n---\n\n')
        let mentionableMemory = '', backgroundMemory = ''
        try {
          const memories = await getMemoriesForContext()
          mentionableMemory = memories.mentionable
          backgroundMemory = memories.background
        } catch {}

        // Build attachment context
        let attachmentContext = ''
        if (attachments?.length) {
          const parts = attachments
            .filter(a => a.text)
            .map(a => `【文件：${a.name}】\n${a.text}`)
          if (parts.length > 0) {
            attachmentContext = parts.join('\n\n---\n\n')
          }
        }

        const hasWebResults = webResults.length > 0
        const webSearchHint = searchEnabled
          ? (hasWebResults
            ? `联网搜索已开启，且已找到 ${webResults.length} 条网页结果，请优先使用这些结果回答，无需再调用 MCP 搜索工具重复搜索`
            : '联网搜索已开启，但未找到相关网页结果，如果信息不足可以调用 MCP 搜索工具补充')
          : '当前已禁用联网搜索，请仅基于本地知识或你的通用知识回答'

        // 用户画像限制长度避免 prompt 过大拖慢推理
        const MAX_MEMORY_CHARS = 800
        const trimmedMentionable = mentionableMemory
          ? (mentionableMemory.length > MAX_MEMORY_CHARS ? mentionableMemory.substring(0, MAX_MEMORY_CHARS) + '...' : mentionableMemory)
          : ''
        const trimmedBackground = backgroundMemory
          ? (backgroundMemory.length > MAX_MEMORY_CHARS ? backgroundMemory.substring(0, MAX_MEMORY_CHARS) + '...' : backgroundMemory)
          : ''

        const systemPrompt = `你是一个名为"AuraCommand" 的智能助手。请根据当前启用的模式回答用户的提问。
        【当前时间】：${new Date().toLocaleString()}
        【本地知识库状态】：${ragEnabled ? '已开启' : '已关闭'}
        【本地知识库内容】：\n${kbContext || (ragEnabled ? '（未找到相关的本地便签或文档）' : '（本地知识库功能未开启）')}
        【联网搜索状态】：${searchEnabled ? '已开启' : '已关闭'}
        【网页搜索结果】：\n${webContext || (searchEnabled ? '（未找到相关的网页搜索结果）' : '（实时联网功能未开启）')}
        ${trimmedMentionable ? `【用户画像（AI 可自然参考）】：\n${trimmedMentionable}` : ''}
        ${trimmedBackground ? `【用户背景（仅供风格参考，禁止直接提及）】：\n${trimmedBackground}` : ''}
        ${attachmentContext ? `【用户上传的附件内容】：\n${attachmentContext}` : ''}
        【回答准则】：
        1. ${ragEnabled ? '优先使用本地知识库中的信息。如果本地知识库中有相关内容，请明确指出' : '当前已禁用本地知识库，请直接回答或使用搜索结果'}
        2. ${webSearchHint}
        3. 如果所有外部来源都没有相关信息，请诚实告知用户，并基于你的通用知识给出简要回答
        4. 使用简洁、专业且富有亲和力的中文回答
        5. 充分利用 Markdown 格式：使用 **加粗** 强调重点，使用列表组织信息，使用代码块包裹代码
        6. 知识库来源中标注了空间名称（如 [工作空间]、[学习空间]），当回答涉及多个空间的内容时，请按空间分组组织回答，并标注来源空间。当用户问题涉及特定空间时，优先使用该空间的内容
        7. 【记忆分层规则】以下两条规则适用于【用户画像】与【用户背景】两个记忆区块：
           a) 【用户画像】中的内容是高关联度记忆（relevance 9-10），你可以自然地将其融入回答中。例如用户说过"我是前端工程师"，你在回答前端问题时可以直接用"你在做前端…"来衔接，不需要声明"我记得你之前说过…"。但不要编造或夸大记忆内容。
           b) 【用户背景】中的内容是中等关联度记忆（relevance 5-8），仅供调整回答风格和语气时参考。禁止在这些内容上做直接引用、暗示或提及。
           c) 无论哪种记忆，都禁止使用"我注意到你之前……"、"根据我们的历史对话……"、"我记得你……"等任何形式的记忆引用句式。
        8. 【代码与原型优先】当用户要求 HTML 页面、网页原型、原型图、前端页面、完整代码、源代码、单文件 HTML、HTML/CSS/JS 实现、界面设计稿、UI 原型时，必须直接输出可运行的代码，不要调用 generate_image。"原型图""设计稿""界面图""首页图"等带"图"字但本质是 UI/页面/原型需求的，也按代码任务处理，用 HTML/CSS/JS 输出可交互原型
        9. 【图片生成】只有当用户明确要求生成真正的图片文件（如海报、插画、配图、风景图、人物图、Logo 图片、照片风格效果图），且没有要求返回 HTML/CSS/JS 代码或 UI 原型时，才调用 generate_image 工具。调用后将工具返回的图片 Markdown 直接展示给用户，不要使用 sequentialthinking 或其他推理工具
        10. 【文档查询】写代码时，如果涉及第三方库/框架的 API，优先调用 Context7 相关工具查询最新文档，不要依赖过时的训练数据
        11. 【文档生成】当用户要求生成 Word 文档、PPT、Excel 表格、报告、方案时，调用对应的 export 工具（export_docx / export_pptx / export_xlsx）。如果用户上传了附件，请结合附件内容来生成文档。工具完成后，简要告知用户文档已生成即可，不要重复输出文件路径和文件名（系统会自动显示下载按钮），不要输出大段总结文字
        12. 【附件理解】如果用户上传了附件（显示在【用户上传的附件内容】中），请仔细阅读附件内容，结合附件信息回答用户问题。附件可能包含文档、表格、PDF 等各种格式的文本内容`

        const detectedPreferredMcpServerId = await detectPreferredMcpServer(query)
        const preferredMcpServerId = frontendPreferredMcpServerId || detectedPreferredMcpServerId
        const categoryPreferences = await detectCategoryPreferences(query)
        const toolPromptOptions: { preferredMcpServerId?: string; categoryPreferences?: McpCategoryPreference[]; intentFilter?: McpToolCategory[] } = {}
        if (preferredMcpServerId) toolPromptOptions.preferredMcpServerId = preferredMcpServerId
        if (categoryPreferences.length > 0) toolPromptOptions.categoryPreferences = categoryPreferences
        const needToolPrompt = searchEnabled || ragEnabled || !!preferredMcpServerId || categoryPreferences.length > 0
        if (needToolPrompt) {
          toolPromptOptions.intentFilter = classifyQueryIntent(query)
        }
        const toolPrompt = needToolPrompt
          ? await getDynamicToolPrompt(
              Object.keys(toolPromptOptions).length > 0 ? toolPromptOptions : undefined
            )
          : ''

        const messages: any[] = [
          { role: 'system' as const, content: systemPrompt + toolPrompt },
          ...history.map((msg: any) => ({ role: (msg.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant', content: msg.role === 'assistant' ? stripThinkBlocks(msg.content) : msg.content, images: msg.images })),
          { role: 'user' as const, content: query, images }
        ]

        const sources = [
          ...topResults.map((r: any) => ({ id: r.id, title: r.title || r.file_name || '', type: r.type })),
          ...webResults.map((r: any, idx: number) => ({ id: `web-${idx}`, title: r.title, type: 'web', url: r.url }))
        ]

        let fullResponse = ''
        let fullThinking = ''
        let assistantContent = ''
        const newSessionId = uuidv4()
        modelRouter.chatStream({
          messages: toRouterMessages(messages),
          model: activeModel,
          cloudModelId,
          onChunk: (chunk: string, reasoning?: string) => {
            if (reasoning) {
              fullThinking += reasoning
              if (event.sender && !event.sender.isDestroyed()) { event.sender.send('chat-chunk', { reasoning }) }
            }
            if (chunk) {
              fullResponse += chunk
              if (event.sender && !event.sender.isDestroyed()) { event.sender.send('chat-chunk', { chunk }) }
            }
          },
          onFallback: (from, to) => {
            log.info(`[Chat] Model fallback: ${from} -> ${to}`)
            if (event.sender && !event.sender.isDestroyed()) {
              event.sender.send('chat-fallback', { from, to, message: `${from} 不可用，已切换到 ${to}` })
            }
          },
          signal: ctx.chatAbortController.current.signal,
        }).then(async () => {
          // 如果模型回复极短（可能 context 不足被截断），用更大的 num_ctx 重试一次
          if (fullResponse.trim().length > 0 && fullResponse.trim().length < 5 && !cloudModelId) {
            log.warn(`[Chat] Model response too short (${fullResponse.trim().length} chars), retrying with larger context`)
            fullResponse = ''
            fullThinking = ''
            try {
              await modelRouter.chatStream({
                messages: toRouterMessages(messages),
                model: activeModel,
                cloudModelId,
                num_ctx: 32768,
                onChunk: (chunk: string, reasoning?: string) => {
                  if (reasoning) {
                    fullThinking += reasoning
                    if (event.sender && !event.sender.isDestroyed()) { event.sender.send('chat-chunk', { reasoning }) }
                  }
                  if (chunk) {
                    fullResponse += chunk
                    if (event.sender && !event.sender.isDestroyed()) { event.sender.send('chat-chunk', { chunk }) }
                  }
                },
                signal: ctx.chatAbortController.current.signal,
              })
            } catch (retryErr) {
              log.warn('[Chat] Retry with larger context failed:', retryErr)
            }
          }

          let assistantMsgId = ''
          try {
            if (!noPersist) {
              if (!activeSessionId) {
                const title = query.substring(0, 30) + (query.length > 30 ? '...' : '')
                await dbHelper.runQuery('INSERT INTO chat_sessions (id, title, created_at, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)', [newSessionId, title])
                activeSessionId = newSessionId
                if (event.sender && !event.sender.isDestroyed()) { event.sender.send('session-created', { id: newSessionId, title }) }
              } else {
                await dbHelper.runQuery('UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [activeSessionId])
              }
              const userMsgId = `user-${Date.now()}`
              await dbHelper.runQuery('INSERT INTO chat_messages (id, session_id, role, content, images, sources) VALUES (?, ?, ?, ?, ?, ?)', [userMsgId, activeSessionId, 'user', query, JSON.stringify(images.map(img => `data:image/png;base64,${img}`)), JSON.stringify([])])
              assistantMsgId = `assistant-${Date.now()}`
              assistantContent = fullThinking.trim() ? `<think>${fullThinking.trim()}</think>\n\n${fullResponse}` : fullResponse
              await dbHelper.runQuery('INSERT INTO chat_messages (id, session_id, role, content, images, sources) VALUES (?, ?, ?, ?, ?, ?)', [assistantMsgId, activeSessionId, 'assistant', assistantContent, JSON.stringify([]), JSON.stringify(sources)])
            }
          } catch (dbErr) { console.error('Failed to save chat to database:', dbErr) }

          fullResponse = await forceToolDecisionIfNeeded({
            response: fullResponse,
            messages,
            model: activeModel,
            ...(cloudModelId ? { cloudModelId } : {}),
          })

          let finalVisibleContent = sanitizeVisibleAssistantText(fullResponse)
          const toolLoopResult = await resolveToolCallLoop({
            initialResponse: fullResponse,
            baseMessages: messages,
            model: activeModel,
            query,
            event,
            ...(preferredMcpServerId ? { preferredMcpServerId } : {}),
            ...(categoryPreferences.length > 0 ? { categoryPreferences } : {}),
            ...(cloudModelId ? { cloudModelId } : {}),
          })
          if (toolLoopResult.hadToolCalls) {
            const toolResultText = toolLoopResult.toolResultsForDisplay.join('\n\n')
            const synthesizedDraft = sanitizeVisibleAssistantText(toolLoopResult.finalResponse)
            let updatedContent = synthesizedDraft || toolLoopResult.finalResponse
            finalVisibleContent = sanitizeVisibleAssistantText(updatedContent)

            try {
              if (event.sender && !event.sender.isDestroyed()) {
                event.sender.send('chat-phase', {
                  phase: 'tool-summarizing',
                  currentTool: toolLoopResult.toolOutputs.length,
                  totalTools: toolLoopResult.toolOutputs.length,
                  ...(preferredMcpServerId ? { preferredMcpServerId, preferredMcpServerName: await getMcpServerLabel(preferredMcpServerId) || preferredMcpServerId } : {}),
                })
              }
              const synthesizedAnswer = await synthesizeToolAnswer({
                model: activeModel,
                query,
                draftAnswer: synthesizedDraft,
                toolOutputs: toolLoopResult.toolOutputs,
                ...(cloudModelId ? { cloudModelId } : {}),
              })
              if (synthesizedAnswer.trim()) {
                updatedContent = synthesizedAnswer
                finalVisibleContent = synthesizedAnswer
              } else if (!finalVisibleContent.trim()) {
                const { cleanResponse } = parseToolCalls(fullResponse)
                updatedContent = cleanResponse ? `${cleanResponse}\n\n---\n🔧 **工具执行结果**：\n${toolResultText}` : `🔧 **工具执行结果**：\n${toolResultText}`
                finalVisibleContent = sanitizeVisibleAssistantText(updatedContent)
                if (event.sender && !event.sender.isDestroyed()) { event.sender.send('chat-chunk', { chunk: `\n\n---\n🔧 **工具执行结果**：\n${toolResultText}` }) }
              }
            } catch (toolAnswerErr) {
              console.error('Failed to synthesize tool answer:', toolAnswerErr)
              if (!finalVisibleContent.trim()) {
                const { cleanResponse } = parseToolCalls(fullResponse)
                updatedContent = cleanResponse ? `${cleanResponse}\n\n---\n🔧 **工具执行结果**：\n${toolResultText}` : `🔧 **工具执行结果**：\n${toolResultText}`
                finalVisibleContent = sanitizeVisibleAssistantText(updatedContent)
                if (event.sender && !event.sender.isDestroyed()) { event.sender.send('chat-chunk', { chunk: `\n\n---\n🔧 **工具执行结果**：\n${toolResultText}` }) }
              }
            }

            if (assistantMsgId) {
              const persistedAssistantContent = fullThinking.trim() ? `<think>${fullThinking.trim()}</think>\n\n${updatedContent}` : updatedContent
              try { await dbHelper.runQuery('UPDATE chat_messages SET content = ? WHERE id = ?', [persistedAssistantContent, assistantMsgId]) }
              catch (dbErr) { console.error('Failed to update tool results:', dbErr) }
            }
          }

          // 兜底：本地模型未调用工具但用户明确要求生图时，自动触发 generate_image
          if (!toolLoopResult.hadToolCalls && detectImageGenerationIntent(query)) {
            try {
              console.log('[chat] Image generation intent detected but no tool call made, auto-triggering generate_image')
              if (event.sender && !event.sender.isDestroyed()) {
                event.sender.send('chat-phase', { phase: 'tool-executing', currentTool: 1, totalTools: 1, toolName: 'generate_image' })
              }
              const imgResult = await executeTool({ tool: 'generate_image', args: { prompt: query } })
              if (imgResult.success && imgResult.result?.displayMarkdown) {
                const imgContent = imgResult.result.displayMarkdown
                finalVisibleContent = imgContent
                if (event.sender && !event.sender.isDestroyed()) { event.sender.send('chat-chunk', { chunk: `\n\n${imgContent}` }) }
                if (assistantMsgId) {
                  try { await dbHelper.runQuery('UPDATE chat_messages SET content = ? WHERE id = ?', [imgContent, assistantMsgId]) }
                  catch (dbErr) { console.error('Failed to update image result:', dbErr) }
                }
              } else if (imgResult.result?.error) {
                const errMsg = `\n\n⚠️ 图片生成失败：${imgResult.result.error}`
                finalVisibleContent += errMsg
                if (event.sender && !event.sender.isDestroyed()) { event.sender.send('chat-chunk', { chunk: errMsg }) }
              }
            } catch (imgErr) {
              console.error('[chat] Auto image generation failed:', imgErr)
            }
          }

              if (fullResponse.length > 50 && activeSessionId) {
                try {
                  const sessionMessages = await dbHelper.allQuery('SELECT role, content FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC', [activeSessionId])
                  await extractMemoriesFromChat(sessionMessages)
                } catch {}
          }

          if (event.sender && !event.sender.isDestroyed()) {
            event.sender.send('chat-end', {
              finalContent: finalVisibleContent,
              sources,
            })
          }
          ctx.chatAbortController.current = null
        }).catch((err: any) => {
          if (err.name === 'AbortError') { console.log('Chat aborted by user'); return }
          if (event.sender && !event.sender.isDestroyed()) { event.sender.send('chat-error', { message: err.message }) }
          ctx.chatAbortController.current = null
        })

        return { sources }
      } catch (err) { console.error('KB Chat failed:', err); throw err }
    },

    'chat-knowledge': async (_: any, { query, model }: { query: string, model?: string }) => {
      try {
        const activeModel = await resolvePreferredModel(model)

        let searchResults: any[] = []
        let sqliteResults: any[] = []

        try {
          searchResults = await vectorDb.searchKnowledgeBase(query, 10)
        } catch (vecErr: any) {
          console.warn('[Vector Search] Failed:', vecErr.message)
        }

        try {
          sqliteResults = await dbHelper.searchMemosAndFiles(query)
        } catch (sqlErr: any) {
          console.warn('[SQLite Search] Failed:', sqlErr.message)
        }

        const vectorMapped = searchResults.filter((r: any) => r.id !== 'dummy').map((r: any) => ({
          ...r,
          id: r.id,
          title: r.title || '',
          text: r.text || r.content || '',
          type: r.type || 'memo',
          score: r._distance !== undefined ? (1 - r._distance) : 0.7
        }))

        const sqliteMapped = sqliteResults.map((r: any) => ({
          ...r,
          id: r.id,
          title: r.title || r.file_name || '',
          text: r.text || r.content || '',
          score: 1.0
        }))

        const fusedResults = dbHelper.reciprocalRankFusion([sqliteMapped, vectorMapped], 60)
        const topResults = fusedResults.slice(0, 10)
        const kbContext = buildRAGContext(topResults, 6000)

        const systemPrompt = `你是一个名为"AuraCommand" 的智能助手。请根据本地知识库回答用户的问题。
【当前时间】：${new Date().toLocaleString()}
【本地知识库内容】：
${kbContext || '（未找到相关的本地便签或文档）'}
【回答准则】：
1. 优先使用本地知识库中的信息。如果本地知识库中有相关内容，请明确指出
2. 使用简洁、专业且富有亲和力的中文回答
3. 充分利用 Markdown 格式：使用 **加粗** 强调重点，使用列表组织信息
4. 如果知识库没有相关信息，请诚实告知用户`

        const messages = [
          { role: 'system' as const, content: systemPrompt },
          { role: 'user' as const, content: query }
        ]

        const response = await modelRouter.chat({ messages: toRouterMessages(messages), model: activeModel })
        return { content: response, sources: topResults.map((r: any) => ({ id: r.id, title: r.title, type: r.type })) }
      } catch (err: any) {
        console.error('Knowledge Q&A failed:', err)
        throw err
      }
    },

    'stop-chat': async () => {
      if (ctx.chatAbortController.current) { ctx.chatAbortController.current.abort(); ctx.chatAbortController.current = null }
    },
  }
}
