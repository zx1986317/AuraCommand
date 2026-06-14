/**
 * 统一工具注册表
 * Agent 和工作流共用同一套工具定义和执行器
 */
import dbHelper from './db';
import log from 'electron-log';
import { searchWeb, fetchAndExtractPages, selectRelevantUrls } from './searxng';
import type { SearchProviderConfig } from './searxng';
import vectorDb from './vectorDb';
import { net } from 'electron';
import { v4 as uuidv4 } from 'uuid';

// ===== 工具类型定义 =====
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: { name: string; type: string; description: string; required?: boolean }[];
  execute: (args: Record<string, any>, context: ToolExecutionContext) => Promise<any>;
}

export interface ToolExecutionContext {
  resolveTemplate: (template: string) => string;
  getVariable: (key: string) => any;
  setVariable: (key: string, value: any) => void;
  searxngUrl?: string | undefined;
}

interface SearchRoutingRule {
  id: string;
  label: string;
  directUrlPattern?: RegExp;
  queryPattern: RegExp;
  siteClause: string;
}

const SEARCH_ROUTING_RULES: SearchRoutingRule[] = [
  { id: 'wechat', label: '微信公众号', directUrlPattern: /https?:\/\/mp\.weixin\.qq\.com\/s\//i, queryPattern: /微信公众号|公众号文章|微信文章|公号|mp\.weixin\.qq\.com/i, siteClause: 'site:mp.weixin.qq.com' },
  { id: 'bilibili', label: 'B站', directUrlPattern: /https?:\/\/(?:www\.)?(?:bilibili\.com|b23\.tv)\//i, queryPattern: /B站|b站|UP主|BV[0-9A-Za-z]+|AV\d+|bilibili|b23\.tv/i, siteClause: '(site:bilibili.com OR site:b23.tv)' },
  { id: 'xiaohongshu', label: '小红书', directUrlPattern: /https?:\/\/(?:www\.)?(?:xiaohongshu\.com|xhslink\.com)\//i, queryPattern: /小红书|种草|避雷|探店|xiaohongshu|xhs/i, siteClause: '(site:xiaohongshu.com OR site:xhslink.com)' },
  { id: 'weibo', label: '微博', directUrlPattern: /https?:\/\/(?:www\.)?weibo\.com\//i, queryPattern: /微博|热搜|超话|weibo/i, siteClause: 'site:weibo.com' },
  { id: 'zhihu', label: '知乎', directUrlPattern: /https?:\/\/(?:www\.)?zhihu\.com\//i, queryPattern: /知乎|高赞回答|zhihu/i, siteClause: 'site:zhihu.com' },
  { id: 'v2ex', label: 'V2EX', directUrlPattern: /https?:\/\/(?:www\.)?v2ex\.com\//i, queryPattern: /V2EX|v2ex|V站|v站/i, siteClause: 'site:v2ex.com' },
  { id: 'xueqiu', label: '雪球', directUrlPattern: /https?:\/\/(?:www\.)?xueqiu\.com\//i, queryPattern: /雪球|个股讨论|财报点评|xueqiu/i, siteClause: 'site:xueqiu.com' },
  { id: 'douyin', label: '抖音', directUrlPattern: /https?:\/\/(?:www\.)?douyin\.com\//i, queryPattern: /抖音|短视频|直播切片|douyin/i, siteClause: 'site:douyin.com' },
];

function extractFirstUrl(text: string): string | null {
  const match = String(text || '').match(/https?:\/\/[^\s)]+/i);
  return match?.[0] || null;
}

function getSearchRouting(query: string): { effectiveQuery: string; directUrl?: string; routeLabel?: string } {
  const trimmed = String(query || '').trim();
  if (!trimmed) return { effectiveQuery: '' };

  const explicitUrl = extractFirstUrl(trimmed);
  if (explicitUrl) {
    const matchedRule = SEARCH_ROUTING_RULES.find(rule => rule.directUrlPattern?.test(explicitUrl));
    if (matchedRule) {
      return { effectiveQuery: trimmed, directUrl: explicitUrl, routeLabel: matchedRule.label };
    }
  }

  if (/\bsite:/i.test(trimmed)) {
    return { effectiveQuery: trimmed };
  }

  const matchedRule = SEARCH_ROUTING_RULES.find(rule => rule.queryPattern.test(trimmed));
  if (!matchedRule) {
    return { effectiveQuery: trimmed };
  }

  return {
    effectiveQuery: `${trimmed} ${matchedRule.siteClause}`.trim(),
    routeLabel: matchedRule.label,
  };
}

function buildFallbackSearchQuery(query: string): string {
  const trimmed = String(query || '').trim();
  if (!trimmed) return '';

  const simplified = trimmed
    .replace(/\b20\d{2}年?\b/g, ' ')
    .replace(/\b(最新|最新的|今年|参数规模|性能排行|性能排名|排行榜|排行|数据汇总|汇总|测评|评测)\b/g, ' ')
    .replace(/[：:，,、|/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!simplified || simplified === trimmed) return trimmed;
  return simplified;
}

function formatFetchedItems(items: Array<{ title: string; url: string; content: string; fetched: boolean }>) {
  return items.map((f: any) => ({
    title: f.title,
    url: f.url,
    content: f.content,
    fetched: f.fetched,
  }));
}

function getClipPlatformTags(url: string): string[] {
  const normalized = String(url || '').toLowerCase();
  const tags = ['网页剪藏'];
  const rules: Array<{ pattern: RegExp; tag: string }> = [
    { pattern: /mp\.weixin\.qq\.com/, tag: '微信公众号' },
    { pattern: /(?:bilibili\.com|b23\.tv)/, tag: 'B站' },
    { pattern: /xiaohongshu\.com|xhslink\.com/, tag: '小红书' },
    { pattern: /weibo\.com/, tag: '微博' },
    { pattern: /zhihu\.com/, tag: '知乎' },
    { pattern: /v2ex\.com/, tag: 'V2EX' },
    { pattern: /xueqiu\.com/, tag: '雪球' },
    { pattern: /douyin\.com/, tag: '抖音' },
  ];

  for (const rule of rules) {
    if (rule.pattern.test(normalized)) {
      tags.push(rule.tag);
      break;
    }
  }

  return tags;
}

// MCP 工具回调——由 mcpClient 在连接后设置
let mcpToolExecutor: ((serverId: string, toolName: string, args: Record<string, any>) => Promise<any>) | null = null;
const mcpToolMap: Map<string, string[]> = new Map();
const mcpNamespaceByServerId: Map<string, string> = new Map();
const mcpNamespaceOwners: Map<string, string> = new Map();

export function setMcpToolExecutor(
  executor: (serverId: string, toolName: string, args: Record<string, any>) => Promise<any>
) {
  mcpToolExecutor = executor;
}

function sanitizeMcpNamespace(value: string): string {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '');
  return normalized || 'server';
}

function getOrCreateMcpNamespace(serverId: string, serverName?: string): string {
  const existing = mcpNamespaceByServerId.get(serverId);
  if (existing) return existing;

  const baseNamespace = sanitizeMcpNamespace(serverName || serverId || 'server');
  let nextNamespace = baseNamespace;
  const currentOwner = mcpNamespaceOwners.get(nextNamespace);
  if (currentOwner && currentOwner !== serverId) {
    const suffix = sanitizeMcpNamespace(serverId).slice(-8) || 'server';
    nextNamespace = `${baseNamespace}-${suffix}`;
  }

  mcpNamespaceByServerId.set(serverId, nextNamespace);
  mcpNamespaceOwners.set(nextNamespace, serverId);
  return nextNamespace;
}

export function buildQualifiedMcpToolName(serverId: string, toolName: string, serverName?: string): string {
  const namespace = getOrCreateMcpNamespace(serverId, serverName);
  return `mcp.${namespace}.${toolName}`;
}

// 注册 MCP 工具到统一注册表（由 mcpClient 连接成功后调用）
export function registerMcpTool(serverId: string, serverName: string, toolName: string, description: string, inputSchema: any) {
  const params = mcpSchemaToParams(inputSchema || {});
  const qualifiedName = buildQualifiedMcpToolName(serverId, toolName, serverName);
  // 跟踪 serverId → toolName 的映射，方便注销
  if (!mcpToolMap.has(serverId)) mcpToolMap.set(serverId, []);
  mcpToolMap.get(serverId)!.push(qualifiedName);
  registerTool({
    name: qualifiedName,
    description: `[MCP/${serverName || serverId}] ${description || toolName}`,
    parameters: params,
    execute: async (args, _ctx) => {
      if (!mcpToolExecutor) {
        throw new Error('MCP executor not initialized');
      }
      const result = await mcpToolExecutor(serverId, toolName, args);
      return result;
    },
  });
}

// 注销某个 MCP Server 的所有工具
export function unregisterMcpTools(serverId: string) {
  const toolNames = mcpToolMap.get(serverId) || [];
  for (const name of toolNames) {
    registry.delete(name);
  }
  mcpToolMap.delete(serverId);
  const namespace = mcpNamespaceByServerId.get(serverId);
  if (namespace) {
    mcpNamespaceOwners.delete(namespace);
    mcpNamespaceByServerId.delete(serverId);
  }
}

function mcpSchemaToParams(schema: any): { name: string; type: string; description: string; required?: boolean }[] {
  if (!schema?.properties) return [];
  const required = new Set<string>((schema.required || []) as string[]);
  return Object.entries(schema.properties).map(([name, prop]: [string, any]) => ({
    name,
    type: prop.type || 'string',
    description: prop.description || '',
    required: required.has(name),
  }));
}

// ===== 工具注册 =====
const registry: Map<string, ToolDefinition> = new Map();

export function registerTool(tool: ToolDefinition) {
  registry.set(tool.name, tool);
}

export function getTool(name: string): ToolDefinition | undefined {
  return registry.get(name);
}

export function getAllTools(): ToolDefinition[] {
  return Array.from(registry.values());
}

export function getToolDefinitionsForPrompt(): string {
  const toolDescriptions = Array.from(registry.values()).map(tool => {
    const params = tool.parameters.map(p =>
      `    - ${p.name} (${p.type}${p.required ? ', 必填' : ', 可选'}): ${p.description}`
    ).join('\n');
    return `  - ${tool.name}: ${tool.description}\n    参数:\n${params}`;
  }).join('\n\n');

  return `
【Agent 工具系统】：
你可以使用以下工具来完成任务。当你需要执行操作时，请在回复中插入工具调用标签。

可用工具：
${toolDescriptions}

工具调用格式：
[[TOOL_CALL]]
{"name": "工具名称", "arguments": {"参数名": "参数值"}}
[[/TOOL_CALL]]

工具调用规则：
1. 每次只调用一个工具
2. 调用工具后，等待工具结果再决定是否继续
3. 如果任务需要多个步骤，依次调用所需工具
4. 工具调用完成后，用自然语言总结结果给用户
5. 不要在最终回复中包含工具调用标签，只保留给用户的答案
6. 不要向用户展示内部推理、工具选择理由或参数分析
7. 如果需要调用工具，直接输出工具调用标签，不要先写"让我先查一下""我先分析一下"
8. **当用户发送 URL 或链接时**，先判断站点类型再选工具：普通静态网页优先使用 \`clip_web_page\`、\`read_url\` 一类的网页直读工具；B站、小红书、微博、知乎、抖音等动态或受限站点优先使用浏览器/Playwright 类工具
9. **绝不要编造网页内容**。如果工具执行失败或返回空结果，请如实告知用户，不要凭空生成文章内容
10. **网页获取工具选择规则**：如果同时存在 \`clip_web_page\` 和 Playwright 工具，按以下规则选择：
   - \`clip_web_page\`：适合普通静态网页、新闻、博客、文档页面。速度快，直接提取正文。优先使用
   - Playwright：适合需要登录的页面、SPA 动态加载页面、需要点击/填写表单/截图等交互操作的场景。只在 \`clip_web_page\` 无法获取有效内容，或用户明确要求交互操作时才使用
   - 如果不确定，优先尝试 \`clip_web_page\`，失败后再用 Playwright 兜底
11. **MCP 工具命名空间规则**：如果工具名是 \`mcp.<server>.<tool>\` 形式，说明它来自特定 MCP 服务器。当用户明确指定某个 MCP（如 Jina MCP）时，优先使用对应命名空间下的工具，不要混用多个相似 MCP
12. **动态站点优先浏览器工具**：B站、b23、小红书、微博、知乎、抖音等强登录态或动态渲染站点，优先使用浏览器/Playwright 类工具，不要先用 \`read_url\`、\`clip_web_page\` 一类的直读工具
13. **失败回退规则**：如果网页直读工具返回 401/403/Unauthorized/Forbidden/空内容，优先切换到浏览器类工具继续，不要直接结束

重要：工具调用标签只用于内部执行，不是给用户看的正文。`;
}

// ===== 注册所有工具 =====

registerTool({
  name: 'search_web',
  description: '联网搜索，自动抓取网页全文。支持 SearXNG、博查搜索 API、Bing 爬虫、百度爬虫等多种搜索源',
  parameters: [
    { name: 'query', type: 'string', description: '搜索关键词', required: true },
    { name: 'limit', type: 'number', description: '返回结果数量，默认5' },
    { name: 'time_range', type: 'string', description: '时间范围：day/week/month/year' },
  ],
  execute: async (args, ctx) => {
    const query = ctx.resolveTemplate(args.query || '');
    const limit = args.limit || 5;
    const routing = getSearchRouting(query);

    // 构建搜索配置：优先使用传入的 searchProviders，否则 fallback 到 searxngUrl
    const searchConfig: SearchProviderConfig = {};
    if (ctx.searxngUrl) {
      searchConfig.searxngUrl = ctx.searxngUrl;
    }
    if (ctx.getVariable) {
      const searchProviders = ctx.getVariable('searchProviders');
      const searxngUrlVar = ctx.getVariable('searxngUrl');
      if (searxngUrlVar) searchConfig.searxngUrl = searxngUrlVar;
      if (searchProviders) {
        if (searchProviders.selectedProvider) searchConfig.selectedProvider = searchProviders.selectedProvider;
        if (searchProviders.bochaApiKey) searchConfig.bochaApiKey = searchProviders.bochaApiKey;
        if (searchProviders.searchMode) searchConfig.searchMode = searchProviders.searchMode;
      }
    }

    if (routing.directUrl) {
      const fetched = await fetchAndExtractPages([{ url: routing.directUrl, title: routing.routeLabel || '网页', snippet: '' }], 1, query);
      if (fetched.length === 0) {
        return { count: 0, items: [], message: `${routing.routeLabel || '目标网页'}内容抓取失败` };
      }
      const items = formatFetchedItems(fetched);
      const fetchedCount = items.filter((item: any) => item.fetched).length;
      return {
        count: items.length,
        fetchedCount,
        items,
        route: 'direct-fetch',
        routeLabel: routing.routeLabel || '网页',
        effectiveQuery: query,
        message: `已直接抓取${routing.routeLabel || '目标网页'}内容`,
      };
    }

    const effectiveQuery = routing.effectiveQuery || query;
    if (effectiveQuery !== query) {
      log.info('[ToolRegistry] search_web query rewritten', { original: query, effective: effectiveQuery, route: routing.routeLabel });
    }

    let results = await searchWeb(effectiveQuery, searchConfig, limit, args.time_range || '');
    let finalQuery = effectiveQuery;
    let route: 'search' | 'search-rewrite' | 'search-fallback' = effectiveQuery === query ? 'search' : 'search-rewrite';

    if (results.length === 0) {
      const fallbackQuery = buildFallbackSearchQuery(query);
      if (fallbackQuery && fallbackQuery !== effectiveQuery) {
        results = await searchWeb(fallbackQuery, searchConfig, limit, args.time_range || '');
        if (results.length > 0) {
          finalQuery = fallbackQuery;
          route = 'search-fallback';
        }
      }
    }

    if (results.length === 0) {
      return {
        count: 0,
        items: [],
        route,
        routeLabel: routing.routeLabel,
        effectiveQuery: finalQuery,
        message: '未找到搜索结果，已尝试放宽查询条件',
      };
    }

    // 用 LLM 智能筛选最相关的 URL，然后抓取全文
    const candidates = results.map((r: any) => ({
      url: r.url,
      title: r.title,
      snippet: r.content,
    }));

    const selected = await selectRelevantUrls(query, candidates, Math.min(5, candidates.length));
    const fetched = await fetchAndExtractPages(selected, 5, query);
    const items = formatFetchedItems(fetched);

    const fetchedCount = items.filter((f: any) => f.fetched).length;
    const baseMessage =
      route === 'search'
        ? '已完成联网搜索并抓取相关网页'
        : route === 'search-rewrite'
          ? `已按${routing.routeLabel || '目标平台'}定向搜索并抓取相关网页`
          : '首轮搜索未命中，已自动放宽查询并抓取相关网页';
    return {
      count: items.length,
      fetchedCount,
      items,
      route,
      routeLabel: routing.routeLabel,
      effectiveQuery: finalQuery,
      message: route === 'search'
        ? baseMessage
        : `${baseMessage}（实际查询：${finalQuery}）`,
    };
  }
});

registerTool({
  name: 'search_knowledge',
  description: '搜索本地知识库（便签+文档），使用RRF融合向量和全文检索',
  parameters: [
    { name: 'query', type: 'string', description: '搜索关键词', required: true },
    { name: 'limit', type: 'number', description: '返回结果数量，默认5' },
    { name: 'projectName', type: 'string', description: '项目名称（可选，用于限定搜索范围）' },
  ],
  execute: async (args, ctx) => {
    const query = ctx.resolveTemplate(args.query || '');
    const limit = args.limit || 5;
    const projectName = ctx.resolveTemplate(args.projectName || '');
    const [vectorResults, sqliteResults] = await Promise.all([
      vectorDb.searchKnowledgeBase(query, limit, projectName || undefined),
      dbHelper.searchMemosAndFiles(query, projectName || undefined),
    ]);
    const K_RRF = 60;
    const ftsRanks = new Map<string, number>();
    sqliteResults.forEach((r: any, idx: number) => ftsRanks.set(r.id, idx + 1));
    const vectorRanks = new Map<string, number>();
    vectorResults.forEach((r: any, idx: number) => { if (r.id !== 'dummy') vectorRanks.set(r.id, idx + 1); });
    const allIds = new Set([...ftsRanks.keys(), ...vectorRanks.keys()]);
    const candidateMap = new Map<string, any>();
    sqliteResults.forEach((r: any) => candidateMap.set(r.id, r));
    vectorResults.forEach((r: any) => { if (r.id !== 'dummy' && !candidateMap.has(r.id)) candidateMap.set(r.id, r); });
    const fused = Array.from(allIds).map(id => {
      const data = candidateMap.get(id);
      let score = 0;
      const ftsRank = ftsRanks.get(id);
      const vecRank = vectorRanks.get(id);
      if (ftsRank !== undefined) score += 1 / (K_RRF + ftsRank);
      if (vecRank !== undefined) score += 1 / (K_RRF + vecRank);
      return { ...data, score };
    }).sort((a, b) => b.score - a.score).slice(0, limit);
    return {
      count: fused.length,
      items: fused.map((r: any) => ({
        id: r.id, title: r.title, type: r.type,
        snippet: (r.text || '').substring(0, 300), score: r.score,
      })),
    };
  }
});

registerTool({
  name: 'create_memo',
  description: '创建便签并自动向量化索引',
  parameters: [
    { name: 'title', type: 'string', description: '便签标题', required: true },
    { name: 'content', type: 'string', description: '便签内容', required: true },
    { name: 'tags', type: 'string', description: '标签，逗号分隔' },
  ],
  execute: async (args, ctx) => {
    const title = ctx.resolveTemplate(args.title || '');
    const content = ctx.resolveTemplate(args.content || '');
    const rawTags = ctx.resolveTemplate(args.tags || '');
    const tags = JSON.stringify(
      String(rawTags)
        .split(/[,\uff0c]/)
        .map((tag) => tag.trim())
        .filter(Boolean)
    );
    const id = `memo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    await dbHelper.runQuery(
      `INSERT OR REPLACE INTO notes (id, type, title, content, tags, project, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, 'quick_note', title, content, tags, '默认项目', '收件箱', now, now]
    );
    try { await vectorDb.addMemoToVectorDb(id, `${title}\n${content}`, { type: 'memo', title }); } catch (e) { log.error('[ToolRegistry] vectorize error:', e); }
    return { id, title, message: '便签创建成功' };
  }
});

registerTool({
  name: 'search_memos',
  description: '搜索便签',
  parameters: [
    { name: 'query', type: 'string', description: '搜索关键词', required: true },
    { name: 'limit', type: 'number', description: '返回结果数量，默认5' },
    { name: 'projectName', type: 'string', description: '项目名称（可选，用于限定搜索范围）' },
  ],
  execute: async (args, ctx) => {
    const query = ctx.resolveTemplate(args.query || '');
    const projectName = ctx.resolveTemplate(args.projectName || '');
    const results = await dbHelper.searchMemosAndFiles(query, projectName || undefined);
    return { count: results.length, items: results.slice(0, args.limit || 5).map((r: any) => ({ id: r.id, title: r.title, type: r.type, snippet: (r.text || '').substring(0, 200) })) };
  }
});

registerTool({
  name: 'update_memo',
  description: '更新便签内容',
  parameters: [
    { name: 'id', type: 'string', description: '便签ID', required: true },
    { name: 'title', type: 'string', description: '新标题' },
    { name: 'content', type: 'string', description: '新内容' },
    { name: 'tags', type: 'string', description: '新标签' },
  ],
  execute: async (args, ctx) => {
    const id = ctx.resolveTemplate(args.id || '');
    const existing = await dbHelper.getQuery('SELECT * FROM notes WHERE id = ?', [id]);
    if (!existing) return { error: '便签不存在' };
    const updates: string[] = [];
    const values: any[] = [];
    if (args.title !== undefined) { updates.push('title = ?'); values.push(ctx.resolveTemplate(args.title)); }
    if (args.content !== undefined) { updates.push('content = ?'); values.push(ctx.resolveTemplate(args.content)); }
    if (args.tags !== undefined) { updates.push('tags = ?'); values.push(ctx.resolveTemplate(args.tags)); }
    if (updates.length === 0) return { error: '没有更新字段' };
    updates.push('updated_at = ?'); values.push(new Date().toISOString()); values.push(id);
    await dbHelper.runQuery(`UPDATE notes SET ${updates.join(', ')} WHERE id = ?`, values);
    if (args.content !== undefined || args.title !== undefined) {
      try {
        const updated = await dbHelper.getQuery('SELECT * FROM notes WHERE id = ?', [id]);
        await vectorDb.addMemoToVectorDb(id, `${updated.title}\n${updated.content}`, { type: 'memo', title: updated.title });
      } catch (vecErr) { log.error('[ToolRegistry] re-vectorize error:', vecErr); }
    }
    return { id, message: '便签更新成功' };
  }
});

registerTool({
  name: 'create_schedule',
  description: '创建日程',
  parameters: [
    { name: 'title', type: 'string', description: '日程标题', required: true },
    { name: 'start_time', type: 'string', description: '开始时间 YYYY-MM-DD HH:mm', required: true },
    { name: 'end_time', type: 'string', description: '结束时间' },
    { name: 'description', type: 'string', description: '描述' },
  ],
  execute: async (args, ctx) => {
    const title = ctx.resolveTemplate(args.title || '');
    const start_time = ctx.resolveTemplate(args.start_time || '');
    const end_time = ctx.resolveTemplate(args.end_time || start_time);
    const description = ctx.resolveTemplate(args.description || '');
    const id = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    await dbHelper.runQuery(
      `INSERT OR REPLACE INTO tasks (id, title, content, start_time, status, priority, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, title, description, start_time, 'pending', 'medium', '工作任务', now, now]
    );
    return { id, title, message: '日程创建成功' };
  }
});

registerTool({
  name: 'list_schedules',
  description: '列出任务',
  parameters: [
    { name: 'status', type: 'string', description: '状态筛选：pending/upcoming/completed' },
  ],
  execute: async (args) => {
    const status = args.status || 'pending';
    const tasks = await dbHelper.allQuery(
      `SELECT id, title, start_time, content as description, status FROM tasks WHERE status = ? ORDER BY start_time ASC LIMIT 20`,
      [status]
    );
    return { count: (tasks || []).length, items: tasks || [] };
  }
});

registerTool({
  name: 'get_tasks',
  description: '获取用户的待办列表。当需要查看用户的待办事项，或者需要从待办中提取地点、日期、事件等信息来帮助用户时使用。返回完整的待办详情，包括标题、描述、优先级、截止日期等。',
  parameters: [
    { name: 'status', type: 'string', description: '筛选状态：inbox(收集箱)/today(今日)/next(下一步)/completed(已完成)', required: false },
    { name: 'type', type: 'string', description: '筛选类型', required: false },
  ],
  execute: async (args) => {
    let sql = 'SELECT * FROM tasks';
    const conditions: string[] = [];
    const params: any[] = [];
    if (args.status) { conditions.push('status = ?'); params.push(args.status) }
    if (args.type) { conditions.push('type = ?'); params.push(args.type) }
    if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ')
    sql += ' ORDER BY priority DESC, due_date ASC, created_at DESC LIMIT 50'
    const tasks = await dbHelper.allQuery(sql, params)
    return {
      count: tasks.length,
      items: tasks.map((t: any) => ({
        id: t.id,
        title: t.title,
        content: t.content,
        status: t.status,
        priority: t.priority,
        due_date: t.due_date,
        start_time: t.start_time,
        category: t.category,
        created_at: t.created_at,
      }))
    };
  }
});

registerTool({
  name: 'send_notification',
  description: '发送通知给用户',
  parameters: [
    { name: 'message', type: 'string', description: '通知内容', required: true },
    { name: 'type', type: 'string', description: '通知类型：info/error/warning' },
  ],
  execute: async (args, ctx) => {
    const message = ctx.resolveTemplate(args.message || '');
    return { message, type: args.type || 'info' };
  }
});

// 兼容旧名称：read_knowledge -> search_knowledge
registerTool({
  name: 'read_knowledge',
  description: '深度检索知识库内容（向量语义搜索 + 全文关键词搜索融合）。当需要更精确地查找本地知识时使用。',
  parameters: [
    { name: 'query', type: 'string', description: '语义搜索查询', required: true },
    { name: 'limit', type: 'number', description: '返回结果数量，默认5' },
  ],
  execute: async (args, ctx) => {
    // 直接复用 search_knowledge 的执行逻辑
    const searchKnowledgeTool = getTool('search_knowledge')!;
    return searchKnowledgeTool.execute(args, ctx);
  }
});

// web_search 是 search_web 的别名（兼容 mcpTools 的命名）
registerTool({
  name: 'web_search',
  description: '联网搜索，自动抓取网页全文。支持 SearXNG、博查搜索 API、Bing 爬虫、百度爬虫等多种搜索源',
  parameters: [
    { name: 'query', type: 'string', description: '搜索关键词', required: true },
    { name: 'limit', type: 'number', description: '返回结果数量，默认5' },
    { name: 'time_range', type: 'string', description: '时间范围：day/week/month/year' },
  ],
  execute: async (args, ctx) => {
    const searchWebTool = getTool('search_web')!;
    return searchWebTool.execute(args, ctx);
  }
});

registerTool({
  name: 'clip_web_page',
  description: '剪藏一个网页的内容保存到知识库，自动提取正文',
  parameters: [
    { name: 'url', type: 'string', description: '要剪藏的网页URL', required: true },
  ],
  execute: async (args, ctx) => {
    const url = ctx.resolveTemplate(args.url || '');
    try {
      const fetched = await fetchAndExtractPages([{ url, title: '', snippet: '' }], 1);
      if (!fetched.length || !fetched[0]?.content) {
        return { error: '网页内容抓取失败，请检查URL是否正确' };
      }
      const page = fetched[0];
      const clipTags = getClipPlatformTags(url);
      const id = uuidv4();
      const now = new Date().toISOString();
      await dbHelper.runQuery(
        'INSERT INTO notes (id, type, title, content, tags, project, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, 'quick_note', `[网页剪藏] ${page.title}`, page.content, JSON.stringify(clipTags), '默认项目', '收件箱', now, now]
      );
      return { id, title: page.title, tags: clipTags, message: `网页「${page.title}」已剪藏到知识库${clipTags.length > 1 ? `，已添加标签：${clipTags.join('、')}` : ''}` };
    } catch (err: any) {
      return { error: '网页剪藏失败，请检查URL是否正确' };
    }
  }
});

registerTool({
  name: 'generate_image',
  description: '使用AI生成图片（仅云端模型支持，如DALL-E 3、通义万相、智谱CogView）。重要：如果系统提示中包含本地知识库内容，请务必结合知识库信息来优化图片提示词，使生成的图片更符合用户的实际需求和上下文。',
  parameters: [
    { name: 'prompt', type: 'string', description: '图片描述/提示词。请结合系统提示中的本地知识库内容、用户记忆等上下文信息来丰富提示词，使图片更贴合用户需求。建议使用英文以获得最佳效果。', required: true },
  ],
  execute: async (args, ctx) => {
    const prompt = ctx.resolveTemplate(args.prompt || '');
    if (!prompt) {
      return { error: '请提供图片描述/提示词' };
    }
    try {
      const modelRouter = await import('./modelRouter');
      const capability = await modelRouter.hasImageGenerationCapability();
      console.log('[generate_image] Capability check:', capability);
      if (!capability.available) {
        return {
          error: '没有可用的云端图片生成模型。请在设置中配置支持图片生成的云端模型（OpenAI DALL-E 3、通义万相、智谱 CogView）。注意：Ollama 本地模型不支持图片生成。',
          capabilityCheck: true,
        };
      }
      console.log('[generate_image] Calling generateImage with prompt:', prompt.substring(0, 100) + '...');
      const result = await modelRouter.generateImage(prompt);
      console.log('[generate_image] Result:', { url: result.url ? 'has url' : 'no url', revised_prompt: result.revised_prompt ? 'has' : 'none' });
      const displayMarkdown = result.url
        ? `![AI生成图片](${result.url})${result.revised_prompt ? `\n\n*优化后的提示词: ${result.revised_prompt}*` : ''}`
        : '';
      return {
        imageUrl: result.url,
        revisedPrompt: result.revised_prompt,
        provider: capability.provider,
        model: capability.model,
        displayMarkdown,
        message: result.url
          ? `图片已生成（${capability.provider}/${capability.model}）。请直接展示以下图片给用户：\n${displayMarkdown}`
          : '图片生成完成但未返回URL',
      };
    } catch (err: any) {
      console.error('[generate_image] Error:', err.message);
      return { error: err?.message || '图片生成失败' };
    }
  }
});

// ===== 文档导出工具 =====

registerTool({
  name: 'export_docx',
  description: '将 Markdown 内容导出为 Word 文档（.docx），返回可下载的文件路径。适用于生成报告、方案、手册等正式文档。',
  parameters: [
    { name: 'markdown', type: 'string', description: 'Markdown 格式的文档内容', required: true },
    { name: 'title', type: 'string', description: '文档标题，也用作文件名', required: true },
  ],
  execute: async (args) => {
    const { parseMarkdownToDocx } = await import('./exportService');
    const { app } = await import('electron');
    const path = await import('path');
    const fs = await import('fs');
    const markdown = String(args.markdown || '');
    const title = String(args.title || '文档');
    const buffer = await parseMarkdownToDocx(markdown, title);
    const exportDir = path.join(app.getPath('downloads'), 'AuraCommand');
    if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });
    const safeName = title.replace(/[<>:"/\\|?*]/g, '_');
    const filePath = path.join(exportDir, `${safeName}.docx`);
    fs.writeFileSync(filePath, buffer);
    return { filePath, fileName: `${safeName}.docx`, message: `Word 文档已生成：${safeName}.docx，保存在下载目录` };
  }
});

registerTool({
  name: 'export_pptx',
  description: '将内容导出为 PowerPoint 演示文稿（.pptx），自动将内容按标题拆分为多页幻灯片。适用于生成汇报、演示、方案展示等。',
  parameters: [
    { name: 'content', type: 'string', description: 'Markdown 或纯文本内容，按标题自动拆分幻灯片', required: true },
    { name: 'title', type: 'string', description: '演示文稿标题', required: true },
  ],
  execute: async (args) => {
    const { parseContentToPptx } = await import('./exportService');
    const { app } = await import('electron');
    const path = await import('path');
    const fs = await import('fs');
    const content = String(args.content || '');
    const title = String(args.title || '演示文稿');
    const buffer = await parseContentToPptx(content, title);
    const exportDir = path.join(app.getPath('downloads'), 'AuraCommand');
    if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });
    const safeName = title.replace(/[<>:"/\\|?*]/g, '_');
    const filePath = path.join(exportDir, `${safeName}.pptx`);
    fs.writeFileSync(filePath, buffer);
    return { filePath, fileName: `${safeName}.pptx`, message: `PPT 已生成：${safeName}.pptx，保存在下载目录` };
  }
});

registerTool({
  name: 'export_xlsx',
  description: '将表格数据导出为 Excel 文件（.xlsx）。支持两种格式：1) JSON 数组（每项为一行）2) Markdown 表格。',
  parameters: [
    { name: 'data', type: 'string', description: 'JSON 数组或 Markdown 表格内容', required: true },
    { name: 'title', type: 'string', description: '文件标题，也用作文件名', required: true },
  ],
  execute: async (args) => {
    const { parseContentToXlsx } = await import('./exportService');
    const { app } = await import('electron');
    const path = await import('path');
    const fs = await import('fs');
    const data = String(args.data || '');
    const title = String(args.title || '数据');
    const buffer = parseContentToXlsx(data, title);
    const exportDir = path.join(app.getPath('downloads'), 'AuraCommand');
    if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });
    const safeName = title.replace(/[<>:"/\\|?*]/g, '_');
    const filePath = path.join(exportDir, `${safeName}.xlsx`);
    fs.writeFileSync(filePath, buffer);
    return { filePath, fileName: `${safeName}.xlsx`, message: `Excel 文件已生成：${safeName}.xlsx，保存在下载目录` };
  }
});
