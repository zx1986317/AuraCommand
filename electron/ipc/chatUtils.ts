/**
 * Chat 工具函数：文本清洗、格式化、URL 检测、工具路由辅助
 */
import { mcpManager } from '../mcpClient'
import { parseToolCalls, hasAvailableTool, ToolCall, detectPreferredMcpServer, getMcpServerLabel, normalizeToolCallForPreferredServer, McpCategoryPreference, McpToolCategory, classifyMcpTool, MCP_CATEGORY_LABELS } from '../mcpTools'
import { getAllTools as getRegistryTools, ToolDefinition as RegistryToolDefinition } from '../toolRegistry'

export function stripThinkBlocks(text: string) {
  return String(text || '')
    .replace(/<think[\s\S]*?<\/think>/gi, '')
    .replace(/<think[\s\S]*$/gi, '')
    .trim()
}

export function toRouterMessages(messages: any[]) {
  return messages.map((msg: any) => {
    if (Array.isArray(msg.images) && msg.images.length > 0) {
      return {
        role: msg.role,
        content: [
          { type: 'text' as const, text: String(msg.content || '') },
          ...msg.images.map((img: string) => ({
            type: 'image_url' as const,
            image_url: {
              url: img.startsWith('data:') ? img : `data:image/png;base64,${img}`,
            },
          })),
        ],
      }
    }
    return {
      role: msg.role,
      content: String(msg.content || ''),
    }
  })
}

export function sanitizeVisibleAssistantText(text: string): string {
  const raw = stripThinkBlocks(String(text || ''))
    .replace(/\[\[TOOL_CALL\]\][\s\S]*?\[\[\/TOOL_CALL\]\]/gi, '')
    .replace(/\[TOOL_CALL\][\s\S]*?\[\/TOOL_CALL\]/gi, '')
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, '')
    .trim()
  if (!raw) return ''
  let cleaned = raw.replace(/^推理过程[\s\S]*?(?=\n\n[^\s])/im, '')
  const lines = cleaned.split(/\r?\n/)
  const filtered = lines.filter(line => {
    if (/^(好的，用户|我需要根据|我的角色|首先考虑|如果工具|如果.*失败|在组织回答|用户可能|现在思路|我将尝试|正在尝试|正在调用|\[工具执行中\]|\[TOOL_CALL\]|<tool_call>|由于本地)/.test(line)) return false
    if (/^\s*[-*]\s.*工具调用/.test(line)) return false
    return true
  })
  return filtered.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

function formatToolScalar(value: any): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function formatToolItems(items: any[]): string {
  const lines: string[] = []
  for (const [index, item] of items.slice(0, 5).entries()) {
    const title = formatToolScalar(item?.title || item?.name || item?.url || `结果 ${index + 1}`)
    const link = formatToolScalar(item?.url || item?.link || '')
    const snippet = formatToolScalar(item?.content || item?.snippet || item?.summary || '')
    lines.push(`${index + 1}. **${title}**`)
    if (link) lines.push(`链接：${link}`)
    if (snippet) lines.push(`摘要：${snippet}`)
    lines.push('')
  }
  return lines.join('\n').trim()
}

export function formatToolResultDetail(result: any): string {
  if (!result) return ''
  if (typeof result === 'string') return formatToolScalar(result)
  if (typeof result.content === 'string' && result.content.trim()) return result.content.trim()

  if (Array.isArray(result.raw) && result.raw.length > 0) {
    const rawTexts = result.raw
      .map((c: any) => {
        if (typeof c === 'string') return c
        if (c?.type === 'text') return String(c.text || '')
        if (c?.type === 'resource') return String(c.resource?.text || '')
        return ''
      })
      .filter(Boolean)
    if (rawTexts.length > 0) return rawTexts.join('\n\n')
  }

  if (Array.isArray(result.items)) {
    const lines: string[] = []
    if (result.message) lines.push(`- ${formatToolScalar(result.message)}`)
    if (result.effectiveQuery) lines.push(`- 实际查询：${formatToolScalar(result.effectiveQuery)}`)
    if (typeof result.count === 'number') lines.push(`- 结果数量：${result.count}`)
    if (Array.isArray(result.items) && result.items.length > 0) {
      lines.push('')
      lines.push(formatToolItems(result.items))
    }
    return lines.join('\n').trim()
  }

  if (typeof result === 'object') {
    if (result.displayMarkdown) return result.displayMarkdown
    if (result.imageUrl) return `![AI生成图片](${result.imageUrl})`
    const ignoredKeys = new Set(['raw', 'content', 'message'])
    const entries = Object.entries(result).filter(([key, value]) => !ignoredKeys.has(key) && value !== undefined && value !== null && value !== '')
    if (entries.length === 0) return ''
    return entries.map(([key, value]) => {
      if (Array.isArray(value)) {
        if (value.length === 0) return `- **${key}**: []`
        const arrText = value.every(v => typeof v !== 'object')
          ? value.map(v => formatToolScalar(v)).join('、')
          : `${value.length} 项`
        return `- **${key}**: ${arrText}`
      }
      if (typeof value === 'object') {
        return `- **${key}**: ${JSON.stringify(value)}`
      }
      return `- **${key}**: ${formatToolScalar(value)}`
    }).join('\n')
  }

  return formatToolScalar(result)
}

export function stringifyToolResultForModel(result: any): string {
  if (!result) return ''
  const formatted = formatToolResultDetail(result)
  if (formatted) return formatted
  if (typeof result === 'string') return result
  try {
    return JSON.stringify(result, null, 2)
  } catch {
    return String(result)
  }
}

export function isAnalysisLikeQuery(query: string): boolean {
  return /分析|研判|解读|趋势|影响|总结|梳理|文章|报告|公众号|洞察/.test(String(query || ''))
}

export function isDirectorySearchQuery(query: string): boolean {
  const normalized = String(query || '')
  return /(文件夹|目录|路径|仓库|项目|工程|代码|源码|repo|project|workspace)/i.test(normalized)
    && !/(文件内容|全文|正则|后缀|扩展名|grep|字符串)/i.test(normalized)
}

export function normalizeSearchFilesArgs(args: Record<string, any>): Record<string, any> {
  const next: Record<string, any> = { ...(args || {}) }
  if (typeof next.pattern === 'string') {
    next.pattern = next.pattern.trim()
  }
  if (typeof next.excludePatterns === 'string') {
    const parts = next.excludePatterns
      .split(/[,\n]/)
      .map((item: string) => item.trim())
      .filter(Boolean)
    if (parts.length > 0) next.excludePatterns = parts
    else delete next.excludePatterns
  }
  if (Array.isArray(next.excludePatterns) && next.excludePatterns.length === 0) {
    delete next.excludePatterns
  }
  return next
}

export function extractFirstUrl(text: string): string | null {
  const match = String(text || '').match(/https?:\/\/[^\s)]+/i)
  return match?.[0] || null
}

export function isDynamicBrowserTarget(url: string): boolean {
  return /https?:\/\/(?:www\.)?(?:bilibili\.com|b23\.tv|xiaohongshu\.com|xhslink\.com|weibo\.com|zhihu\.com|douyin\.com)\//i.test(String(url || ''))
}

export function isReadUrlLikeToolName(toolName: string): boolean {
  const normalized = String(toolName || '').toLowerCase()
  if (normalized === 'clip_web_page') return true
  return /(^|[._-])(read_url|fetch|fetch_url|open_url|extract_url)([._-]|$)/.test(normalized)
}

export function isBrowserCapableTool(tool: RegistryToolDefinition): boolean {
  const normalized = `${tool.name} ${tool.description}`.toLowerCase()
  return /(playwright|browser|navigate|snapshot|screenshot|click|type|press|tab|page)/.test(normalized)
}

export async function detectCategoryPreferences(query: string): Promise<McpCategoryPreference[]> {
  const normalizedQuery = String(query || '').toLowerCase()
  if (!normalizedQuery) return []

  const allTools = await mcpManager.getAllTools()
  if (allTools.length === 0) return []

  const categoryHints: Array<{ category: McpToolCategory; patterns: RegExp[] }> = [
    { category: 'web-search', patterns: [/搜索|search|查找|查询|检索|新闻|资讯|热榜|热搜|趋势|排行|discover|lookup|find/i] },
    { category: 'web-read', patterns: [/阅读|read|抓取|fetch|提取|extract|网页|url|链接|https?:\/\/|scrape|crawl/i] },
    { category: 'browser', patterns: [/浏览器|browser|playwright|b站|bilibili|小红书|微博|知乎|抖音|交互|登录|click|navigate/i] },
    { category: 'file', patterns: [/文件|file|目录|directory|folder|创建|写入|read_file|write_file|list_directory/i] },
    { category: 'memory', patterns: [/记忆|memory|remember|memorize|recall|跨会话/i] },
    { category: 'database', patterns: [/数据库|database|sql|table|查询.*表|sqlite|postgres|mysql/i] },
    { category: 'reasoning', patterns: [/思考|think|推理|reasoning|分析|analyze|sequential|step.by.step/i] },
  ]

  const matchedCategories = categoryHints
    .filter(hint => hint.patterns.some(p => p.test(normalizedQuery)))
    .map(hint => hint.category)

  if (matchedCategories.length === 0) return []

  const preferences: McpCategoryPreference[] = []
  for (const category of matchedCategories) {
    const candidateTools = allTools.filter(tool => {
      const toolCategories = classifyMcpTool({ name: tool.name, description: tool.description })
      return toolCategories.includes(category)
    })
    if (candidateTools.length === 0) continue

    const serverCounts = new Map<string, { count: number; serverName: string }>()
    for (const tool of candidateTools) {
      const existing = serverCounts.get(tool.serverId) || { count: 0, serverName: tool.serverName || tool.serverId }
      existing.count += 1
      serverCounts.set(tool.serverId, existing)
    }

    let bestServerId = ''
    let bestCount = 0
    let bestServerName = ''
    for (const [serverId, info] of serverCounts) {
      if (info.count > bestCount) {
        bestCount = info.count
        bestServerId = serverId
        bestServerName = info.serverName
      }
    }

    if (bestServerId) {
      preferences.push({ category, preferredServerId: bestServerId, preferredServerName: bestServerName })
    }
  }

  return preferences
}

function buildUrlArgsForTool(tool: RegistryToolDefinition, url: string): Record<string, any> | null {
  const directUrlParam = tool.parameters.find(param => /^(url|uri|link|href|pageurl|page_url|targeturl|target_url)$/i.test(param.name))
  if (directUrlParam) {
    return { [directUrlParam.name]: url }
  }

  const firstRequiredStringParam = tool.parameters.find(param => param.required && param.type === 'string')
  if (firstRequiredStringParam) {
    return { [firstRequiredStringParam.name]: url }
  }

  const firstOptionalStringParam = tool.parameters.find(param => param.type === 'string')
  if (firstOptionalStringParam) {
    return { [firstOptionalStringParam.name]: url }
  }

  if (tool.parameters.length === 0) {
    return {}
  }

  return null
}

async function getPreferredMcpBrowserTools(originatingTool?: string): Promise<Set<string>> {
  if (!originatingTool) {
    return new Set<string>()
  }

  const serverId = mcpManager.findServerForTool(originatingTool)
  if (!serverId) {
    return new Set<string>()
  }

  const preferredNames = new Set<string>()
  const mcpTools = await mcpManager.getAllTools()
  for (const tool of mcpTools) {
    if (tool.serverId !== serverId) continue
    const qualifiedName = tool.qualifiedName || tool.name
    if (isBrowserCapableTool({
      name: qualifiedName,
      description: `[MCP/${tool.serverName || tool.serverId}] ${tool.description || ''}`,
      parameters: [],
      execute: async () => null,
    })) {
      preferredNames.add(qualifiedName)
    }
  }

  return preferredNames
}

export async function getBrowserRecoveryCalls(url: string, originatingTool?: string): Promise<ToolCall[]> {
  const preferredBrowserTools = await getPreferredMcpBrowserTools(originatingTool)
  const tools = getRegistryTools()
    .filter(isBrowserCapableTool)
    .sort((a, b) => {
      const score = (tool: RegistryToolDefinition) => {
        const normalized = tool.name.toLowerCase()
        const serverPriority = preferredBrowserTools.has(tool.name) ? 0 : 1
        const toolPriority =
          /navigate|open|goto/.test(normalized) ? 0
            : /snapshot|extract|content|text|markdown/.test(normalized) ? 1
              : 2
        return serverPriority * 10 + toolPriority
      }
      return score(a) - score(b)
    })

  const retries: ToolCall[] = []
  for (const tool of tools) {
    const args = buildUrlArgsForTool(tool, url)
    if (args) {
      retries.push({ tool: tool.name, args })
    }
  }
  return retries
}

function dedupeToolCalls(calls: ToolCall[]): ToolCall[] {
  const seen = new Set<string>()
  return calls.filter(call => {
    const key = `${call.tool}:${JSON.stringify(call.args || {})}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export async function buildInitialRoutingCalls(call: ToolCall, query: string): Promise<ToolCall[]> {
  const targetUrl = extractFirstUrl(String(call.args?.url || call.args?.link || query || ''))
  if (!targetUrl || !isDynamicBrowserTarget(targetUrl) || !isReadUrlLikeToolName(call.tool)) {
    return [call]
  }

  const browserCalls = await getBrowserRecoveryCalls(targetUrl, call.tool)
  if (browserCalls.length === 0) {
    return [call]
  }

  return dedupeToolCalls([...browserCalls, call])
}

export async function buildRecoveryCalls(call: ToolCall, query: string, errorMessage: string): Promise<ToolCall[]> {
  const retries: ToolCall[] = []
  const normalizedError = String(errorMessage || '')

  if (call.tool === 'search_files') {
    const fixedArgs = normalizeSearchFilesArgs(call.args || {})
    if (JSON.stringify(fixedArgs) !== JSON.stringify(call.args || {})) {
      retries.push({ tool: 'search_files', args: fixedArgs })
    }

    if (isDirectorySearchQuery(query) && /参数校验失败|Validation error|Invalid literal value/i.test(normalizedError)) {
      const path = String(call.args?.path || '').trim()
      if (path) {
        if (hasAvailableTool('list_directory')) {
          retries.push({ tool: 'list_directory', args: { path } })
        }
        if (hasAvailableTool('directory_tree')) {
          retries.push({ tool: 'directory_tree', args: { path } })
        }
      }
    }
  }

  const targetUrl = extractFirstUrl(String(call.args?.url || call.args?.link || query || ''))
  if (
    targetUrl &&
    isReadUrlLikeToolName(call.tool) &&
    (
      /401|403|unauthorized|forbidden|access denied|权限|鉴权/i.test(normalizedError) ||
      (/空内容|空结果|empty|no content/i.test(normalizedError) && isDynamicBrowserTarget(targetUrl))
    )
  ) {
    retries.push(...await getBrowserRecoveryCalls(targetUrl, call.tool))
  }

  return dedupeToolCalls(retries)
}