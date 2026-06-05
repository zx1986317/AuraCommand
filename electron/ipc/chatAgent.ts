/**
 * Chat Agent 工具循环：解析工具调用、执行、重试、综合回答
 */
import * as modelRouter from '../modelRouter'
import { parseToolCalls, executeTool, getDynamicToolPrompt, getMcpServerLabel, normalizeToolCallForPreferredServer, McpCategoryPreference, McpToolCategory, classifyMcpTool, MCP_CATEGORY_LABELS } from '../mcpTools'
import { mcpManager } from '../mcpClient'
import { ToolCall } from '../mcpTools'
import {
  toRouterMessages,
  sanitizeVisibleAssistantText,
  formatToolResultDetail,
  stringifyToolResultForModel,
  buildInitialRoutingCalls,
  buildRecoveryCalls,
} from './chatUtils'

function shouldBlockImageGenerationForCodeRequest(query: string): boolean {
  const normalized = String(query || '').toLowerCase()
  if (!normalized) return false

  const requestsCode = /(html|css|javascript|typescript|\bjs\b|\bts\b|源码|源代码|代码|网页|页面|原型|原型图|设计稿|界面图|首页图|\bui\b原型|前端|单文件)/.test(normalized)
  const requestsImageOnly = /(海报|插画|配图|风景图|人物图|logo图|照片|渲染图|实景图)/.test(normalized)

  return requestsCode && !requestsImageOnly
}

async function synthesizeToolAnswer(opts: {
  model: string
  cloudModelId?: string
  query: string
  draftAnswer: string
  toolOutputs: Array<{ tool: string; success: boolean; message: string; detail: string }>
}): Promise<string> {
  const { model, cloudModelId, query, draftAnswer, toolOutputs } = opts
  const toolContext = toolOutputs.map((item, index) => {
    return [
      `工具 ${index + 1}: ${item.tool}`,
      `状态: ${item.success ? '成功' : '失败'}`,
      `说明: ${item.message}`,
      item.detail ? `结果:\n${item.detail}` : '',
    ].filter(Boolean).join('\n')
  }).join('\n\n---\n\n')

  if (!toolContext.trim()) {
    return ''
  }

  const prompt = `请基于工具结果，直接回答用户问题，并自行判断应该输出"默认简报"还是"深度解读"。

用户问题：
${query}

你之前的草稿回答：
${draftAnswer || '（无）'}

工具结果：
${toolContext}

回答要求：
1. 只输出最终给用户看的回答，不要输出工具调用过程、JSON、XML、标签或"工具执行结果"字样。
2. 优先筛选与用户问题直接相关的信息，忽略明显无关的热榜项。
3. 你需要自行判断输出深度：
   - 如果用户只是想"看一下""给我最新的""列出资讯/热榜/新闻"，默认使用"默认简报"。
   - 如果用户明确要求"分析、研判、解读、趋势、影响、总结、像文章一样写"，或者工具结果呈现出明显主题共性，升级为"深度解读"。
   - 如果拿不准，优先选择"默认简报"，不要无故写成长文。
4. "默认简报"结构：
   - 先给一句总览。
   - 再给 5-10 条最相关的信息，使用编号列表。
   - 每条尽量包含标题、时间、一句话摘要，能给链接就给链接。
5. "深度解读"结构：
   - 先给"核心结论"。
   - 再给"关键信号"列表。
   - 然后给"趋势/影响研判"。
   - 最后给"值得继续关注"或"延伸阅读"。
   - 深度解读也必须基于工具结果，不要脱离证据臆测。
6. 如果有个别工具失败，只在确实影响结论时用一句话简短说明，不要展开报错细节。
7. 始终保留来源感，尽量给出链接，但不要把原始结果整段照搬。
8. 如果是目录/文件搜索任务，直接给出找到的路径、判断依据和下一步建议；不要只说"你可以自己去看"。
9. 如果用户要求像公众号文章、简报、日报、周报一样写，请直接产出可交付正文，而不是素材列表。
10. 使用简洁、自然、专业的中文 Markdown，不要解释你选择了哪种模式。`

  const answer = await modelRouter.chat({
    model,
    ...(cloudModelId ? { cloudModelId } : {}),
    messages: toRouterMessages([{ role: 'user', content: prompt }]),
  })

  return sanitizeVisibleAssistantText(answer)
}

export async function resolveToolCallLoop(opts: {
  initialResponse: string
  baseMessages: any[]
  model: string
  cloudModelId?: string
  query: string
  event: any
  preferredMcpServerId?: string
  categoryPreferences?: McpCategoryPreference[]
  maxRounds?: number
}): Promise<{
  finalResponse: string
  hadToolCalls: boolean
  toolOutputs: Array<{ tool: string; success: boolean; message: string; detail: string }>
  toolResultsForDisplay: string[]
}> {
  const {
    initialResponse,
    baseMessages,
    model,
    cloudModelId,
    query,
    event,
    preferredMcpServerId,
    categoryPreferences,
    maxRounds = 3,
  } = opts

  let currentResponse = initialResponse
  let workingMessages = [...baseMessages]
  let hadToolCalls = false
  let lockedMcpServerId = preferredMcpServerId
  const activeCategoryPreferences = [...(categoryPreferences || [])]
  const allToolOutputs: Array<{ tool: string; success: boolean; message: string; detail: string }> = []
  const allToolResultsForDisplay: string[] = []

  const emitChatPhase = async (payload: Record<string, any>) => {
    if (!event.sender || event.sender.isDestroyed()) {
      return
    }
    const preferredMcpServerName = await getMcpServerLabel(preferredMcpServerId)
    const lockedMcpServerName = await getMcpServerLabel(lockedMcpServerId)
    const categoryRouting = activeCategoryPreferences.map(pref => ({
      category: pref.category,
      categoryLabel: MCP_CATEGORY_LABELS[pref.category] || pref.category,
      preferredServerId: pref.preferredServerId,
      preferredServerName: pref.preferredServerName || pref.preferredServerId,
    }))
    event.sender.send('chat-phase', {
      ...payload,
      ...(preferredMcpServerId ? { preferredMcpServerId, preferredMcpServerName: preferredMcpServerName || preferredMcpServerId } : {}),
      ...(lockedMcpServerId ? { lockedMcpServerId, lockedMcpServerName: lockedMcpServerName || lockedMcpServerId } : {}),
      ...(categoryRouting.length > 0 ? { categoryRouting } : {}),
    })
  }

  for (let round = 0; round < maxRounds; round += 1) {
    const { calls, cleanResponse } = parseToolCalls(currentResponse)
    if (calls.length === 0) {
      return {
        finalResponse: currentResponse,
        hadToolCalls,
        toolOutputs: allToolOutputs,
        toolResultsForDisplay: allToolResultsForDisplay,
      }
    }

    hadToolCalls = true
    const roundToolOutputs: Array<{ tool: string; success: boolean; message: string; detail: string }> = []
    const roundToolResults: string[] = []
    const totalTools = calls.length

    for (const [toolIndex, call] of calls.entries()) {
      const attemptResults: Array<{ call: ToolCall; success: boolean; message: string; result: any }> = []
      const attemptedCalls = new Set<string>()
      const normalizedCall = await normalizeToolCallForPreferredServer(call, lockedMcpServerId, activeCategoryPreferences)

      if (normalizedCall.tool === 'generate_image' && shouldBlockImageGenerationForCodeRequest(query)) {
        const blockedMessage = '用户明确要求的是 HTML/CSS/JS 页面代码，本轮已阻止 generate_image，请直接输出可运行代码而不是生成图片'
        roundToolOutputs.push({
          tool: normalizedCall.tool,
          success: false,
          message: blockedMessage,
          detail: blockedMessage,
        })
        allToolOutputs.push({
          tool: normalizedCall.tool,
          success: false,
          message: blockedMessage,
          detail: blockedMessage,
        })
        roundToolResults.push(`**${normalizedCall.tool}**: ${blockedMessage}`)
        if (event.sender && !event.sender.isDestroyed()) {
          event.sender.send('tool-result', {
            tool: normalizedCall.tool,
            success: false,
            message: blockedMessage,
          })
        }
        continue
      }

      const callServerId = mcpManager.findServerForTool(normalizedCall.tool)

      if (!lockedMcpServerId && callServerId) {
        lockedMcpServerId = callServerId
      }

      if (callServerId) {
        const allMcpTools = await mcpManager.getAllTools()
        const matchedTool = allMcpTools.find(t => t.qualifiedName === normalizedCall.tool || t.name === normalizedCall.tool)
        if (matchedTool) {
          const toolCategories = classifyMcpTool({ name: matchedTool.name, description: matchedTool.description })
          for (const cat of toolCategories) {
            const existingPref = activeCategoryPreferences.find(p => p.category === cat)
            if (!existingPref) {
              activeCategoryPreferences.push({
                category: cat,
                preferredServerId: callServerId,
                preferredServerName: matchedTool.serverName || callServerId,
              })
            } else if (existingPref.preferredServerId !== callServerId) {
              const lockedLabel = existingPref.preferredServerName || existingPref.preferredServerId
              const actualLabel = matchedTool.serverName || callServerId
              const categoryLabel = MCP_CATEGORY_LABELS[cat] || cat
              const blockedMessage = `${categoryLabel} 类工具已锁定由 ${lockedLabel} 提供，已阻止切换到 ${actualLabel}`
              roundToolOutputs.push({
                tool: normalizedCall.tool,
                success: false,
                message: blockedMessage,
                detail: blockedMessage,
              })
              allToolOutputs.push({
                tool: normalizedCall.tool,
                success: false,
                message: blockedMessage,
                detail: blockedMessage,
              })
              roundToolResults.push(`**${normalizedCall.tool}**: ${blockedMessage}`)
              if (event.sender && !event.sender.isDestroyed()) {
                event.sender.send('tool-result', {
                  tool: normalizedCall.tool,
                  success: false,
                  message: blockedMessage,
                })
              }
              continue
            }
          }
        }
      }

      const executeOneCall = async (attemptCall: ToolCall, retryAttempt = 0) => {
        if (event.sender && !event.sender.isDestroyed()) {
          await emitChatPhase({
            phase: retryAttempt > 0 ? 'tool-retrying' : 'tool-executing',
            currentTool: toolIndex + 1,
            totalTools,
            toolName: attemptCall.tool,
            retryAttempt,
          })
          event.sender.send('tool-call', { tool: attemptCall.tool, args: attemptCall.args })
        }

        const result = await executeTool(attemptCall)
        const detailStr = result.success ? formatToolResultDetail(result.result) : ''
        const statusText = result.success
          ? (result.message && !/^执行成功$/.test(result.message) ? result.message : '工具执行完成')
          : result.message
        const toolOutput = {
          tool: attemptCall.tool,
          success: result.success,
          message: statusText,
          detail: stringifyToolResultForModel(result.result),
        }

        attemptResults.push({ call: attemptCall, success: result.success, message: statusText, result: result.result })
        roundToolOutputs.push(toolOutput)
        allToolOutputs.push(toolOutput)
        roundToolResults.push(`**${attemptCall.tool}**: ${statusText}${detailStr ? '\n' + detailStr : ''}`)

        if (event.sender && !event.sender.isDestroyed()) {
          event.sender.send('tool-result', {
            tool: attemptCall.tool,
            success: result.success,
            message: statusText,
            ...(result.result?.filePath ? { filePath: result.result.filePath } : {}),
          })
        }

        return { success: result.success, statusText }
      }

      let succeeded = false
      let lastFailureStatus = ''
      const initialCalls = await buildInitialRoutingCalls(normalizedCall, query)

      for (const [attemptIndex, attemptCall] of initialCalls.entries()) {
        const attemptKey = `${attemptCall.tool}:${JSON.stringify(attemptCall.args || {})}`
        attemptedCalls.add(attemptKey)
        const attemptResult = await executeOneCall(attemptCall, attemptIndex === 0 ? 0 : attemptIndex)
        if (attemptResult.success) {
          succeeded = true
          break
        }
        lastFailureStatus = attemptResult.statusText
      }

      if (!succeeded) {
        const recoveryCalls = await buildRecoveryCalls(call, query, lastFailureStatus)
        let recoveryOffset = initialCalls.length
        for (const recoveryCall of recoveryCalls) {
          const recoveryKey = `${recoveryCall.tool}:${JSON.stringify(recoveryCall.args || {})}`
          if (attemptedCalls.has(recoveryKey)) continue
          attemptedCalls.add(recoveryKey)
          const retryAttempt = await executeOneCall(recoveryCall, recoveryOffset)
          recoveryOffset += 1
          if (retryAttempt.success) break
        }
      }
    }

    allToolResultsForDisplay.push(...roundToolResults)

    if (event.sender && !event.sender.isDestroyed()) {
      await emitChatPhase({ phase: 'tool-summarizing', currentTool: totalTools, totalTools })
    }

    const toolContext = roundToolOutputs.map((item, index) => {
      return [
        `工具 ${index + 1}: ${item.tool}`,
        `状态: ${item.success ? '成功' : '失败'}`,
        `说明: ${item.message}`,
        item.detail ? `结果:\n${item.detail}` : '',
      ].filter(Boolean).join('\n')
    }).join('\n\n---\n\n')

    workingMessages = [
      ...workingMessages,
      { role: 'assistant' as const, content: currentResponse },
      {
        role: 'user' as const,
        content: `你刚才调用的工具已经返回结果。

原始用户问题：
${query}

你上一步的可见回答草稿：
${cleanResponse || '（无）'}

本轮工具结果：
${toolContext}

请继续完成任务，规则如下：
1. 如果信息仍然不足，请继续调用必要工具，不要停在半成品状态。
2. 如果信息已经足够，请直接给出最终回答。
3. 最终回答不要出现 [TOOL_CALL]、JSON、XML、原始参数或"工具执行结果"字样。
4. 如果是搜索、目录、资讯、热榜、文章整理类任务，必须形成对用户可交付的最终结果，不要只汇报中间步骤。
5. 必须将工具返回的搜索结果与用户原始问题紧密结合，基于搜索到的资料来回答或完成任务，而不是简单罗列搜索结果。例如用户要求写文档，应将搜索资料融入文档内容中；用户要求查询信息，应基于搜索结果整理出完整答案。
6. ${lockedMcpServerId ? `本轮后续若继续调用 MCP，只允许使用 ${await getMcpServerLabel(lockedMcpServerId) || lockedMcpServerId} 这个 MCP 服务器下的工具，不要切换到其他 MCP。` : '如果本轮已经开始使用某个 MCP 服务器，后续优先留在同一命名空间内完成。'}`
      }
    ]

    currentResponse = await modelRouter.chat({
      model,
      ...(cloudModelId ? { cloudModelId } : {}),
      messages: toRouterMessages(workingMessages),
    })
  }

  return {
    finalResponse: currentResponse,
    hadToolCalls,
    toolOutputs: allToolOutputs,
    toolResultsForDisplay: allToolResultsForDisplay,
  }
}

function looksLikeIncompleteToolIntent(text: string): boolean {
  const normalized = sanitizeVisibleAssistantText(text)
  if (!normalized) return false
  if (/\[TOOL_CALL\]|<tool_call>/i.test(text)) return false
  return /((让我|我来|现在|接下来).*(搜索|查找|查看|读取|分析|整理|生成|执行))|((正在|立刻|马上).*(搜索|查找|查看|执行))|((我会|将会).*(搜索|查找|分析|整理))/.test(normalized)
}

/**
 * 检测用户是否明确要求图片生成
 * 用于本地模型不调用工具时的兜底
 */
export function detectImageGenerationIntent(query: string): boolean {
  const normalized = String(query || '').toLowerCase()
  if (!normalized) return false

  // 排除代码/原型类请求
  const isCodeRequest = /(html|css|javascript|typescript|\bjs\b|\bts\b|源码|源代码|代码|网页|页面|原型|原型图|ui原型|前端|单文件|可运行|网页设计稿)/.test(normalized)
  if (isCodeRequest) return false

  // 图片生成意图关键词
  const imageKeywords = /(生成.*(?:图片|图像|设计图|海报|插画|配图|风景图|人物图|logo|图标|照片|渲染图|示意图|流程图|架构图|思维导图|甘特图)|画一张|画一个|画出|制作.*(?:图片|海报|插画)|创建.*(?:图片|图像)|生成一张|生成一幅|draw|generate.*(?:image|picture|illustration|poster|diagram))/.test(normalized)

  return imageKeywords
}

export async function forceToolDecisionIfNeeded(opts: {
  response: string
  messages: any[]
  model: string
  cloudModelId?: string
}): Promise<string> {
  const { response, messages, model, cloudModelId } = opts
  if (!looksLikeIncompleteToolIntent(response)) {
    return response
  }

  const retryPrompt = `你上一条回复停留在中间态：你表示将要搜索、查看、分析或执行，但并没有真正完成任务。

严格要求：
1. 如果完成任务仍然需要工具，请现在立刻输出合法的 [TOOL_CALL]...[/TOOL_CALL]，不要写任何过渡话术。
2. 如果其实不需要工具，请直接给出最终完成态回答。
3. 禁止输出"让我来看看""我现在去搜索""我将继续执行"这类中间态句子。
4. 不允许停在半成品状态。`

  return modelRouter.chat({
    model,
    ...(cloudModelId ? { cloudModelId } : {}),
    messages: toRouterMessages([
      ...messages,
      { role: 'assistant' as const, content: response },
      { role: 'user' as const, content: retryPrompt },
    ]),
  })
}

export { synthesizeToolAnswer }
