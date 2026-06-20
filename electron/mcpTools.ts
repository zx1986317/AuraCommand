import { mcpManager, McpToolInfo } from './mcpClient';
import { getTool as getRegistryTool } from './toolRegistry';
import log from 'electron-log';

export type McpToolCategory =
  | 'web-search'
  | 'web-read'
  | 'browser'
  | 'file'
  | 'memory'
  | 'database'
  | 'reasoning'
  | 'other';

export const MCP_TOOL_CATEGORIES: McpToolCategory[] = [
  'web-search', 'web-read', 'browser', 'file', 'memory', 'database', 'reasoning', 'other',
];

export const MCP_CATEGORY_LABELS: Record<McpToolCategory, string> = {
  'web-search': '网页搜索',
  'web-read': '网页阅读',
  'browser': '浏览器',
  'file': '文件系统',
  'memory': '记忆',
  'database': '数据库',
  'reasoning': '推理',
  'other': '其他',
};

export interface McpCategoryPreference {
  category: McpToolCategory;
  preferredServerId: string;
  preferredServerName?: string;
}

export interface ToolDefinition {
    name: string;
    description: string;
    parameters: {
        name: string;
        type: 'string' | 'number' | 'boolean' | 'array' | 'object';
        description: string;
        required: boolean;
    }[];
    categories?: McpToolCategory[];
}

export interface ToolCall {
    tool: string;
    args: Record<string, any>;
}

interface DynamicToolPromptOptions {
    preferredMcpServerId?: string;
    categoryPreferences?: McpCategoryPreference[];
    maxTools?: number;
    /** 如果提供，只包含匹配这些意图类别的 MCP 工具 */
    intentFilter?: McpToolCategory[];
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
    {
        name: 'create_memo',
        description: '创建一条新的便签笔记。当用户要求记录、备忘、写下某些内容时使用。',
        parameters: [
            { name: 'title', type: 'string', description: '便签标题', required: true },
            { name: 'content', type: 'string', description: '便签内容', required: true },
            { name: 'tags', type: 'string', description: '标签，用逗号分隔', required: false }
        ]
    },
    {
        name: 'create_schedule',
        description: '创建一条新的日程安排。当用户要求安排会议、提醒、待办事项时使用。',
        parameters: [
            { name: 'title', type: 'string', description: '日程标题', required: true },
            { name: 'start_time', type: 'string', description: '开始时间，格式如 "2025-01-15 14:00" 或 "今天 15:00"', required: true },
            { name: 'content', type: 'string', description: '日程详情描述', required: false },
            { name: 'category', type: 'string', description: '分类：个人/工作/会议/截止日期', required: false }
        ]
    },
    {
        name: 'search_knowledge',
        description: '在本地知识库中搜索相关内容。当需要查找用户已有的便签、文档或笔记时使用。同时搜索便签和知识库文件。',
        parameters: [
            { name: 'query', type: 'string', description: '搜索关键词', required: true }
        ]
    },
    {
        name: 'search_memos',
        description: '专门搜索用户的便签笔记。当你需要查找用户之前记录的想法、笔记、会议记录等内容时使用。',
        parameters: [
            { name: 'query', type: 'string', description: '搜索关键词', required: true },
            { name: 'category', type: 'string', description: '分类筛选：个人/工作/会议记录/读书笔记/项目日志/灵感闪念', required: false }
        ]
    },
    {
        name: 'web_search',
        description: '联网搜索获取实时信息。当需要最新信息、新闻、天气等时使用。',
        parameters: [
            { name: 'query', type: 'string', description: '搜索关键词', required: true }
        ]
    },
    {
        name: 'clip_web_page',
        description: '剪藏一个网页的内容保存到知识库。当用户想要保存某个网页时使用。',
        parameters: [
            { name: 'url', type: 'string', description: '要剪藏的网页URL', required: true }
        ]
    },
    {
        name: 'generate_image',
        description: '使用AI生成图片。当用户要求画图、生成图片、创作图像时使用。',
        parameters: [
            { name: 'prompt', type: 'string', description: '图片描述/提示词', required: true }
        ]
    },
    {
        name: 'export_docx',
        description: '将 Markdown 内容导出为 Word 文档（.docx）。适用于生成报告、方案、手册等正式文档。',
        parameters: [
            { name: 'markdown', type: 'string', description: 'Markdown 格式的文档内容', required: true },
            { name: 'title', type: 'string', description: '文档标题，也用作文件名', required: true },
            { name: 'header', type: 'string', description: '页眉文字', required: false },
            { name: 'footer', type: 'string', description: '页脚文字', required: false }
        ]
    },
    {
        name: 'export_pptx',
        description: '将内容导出为 PowerPoint 演示文稿（.pptx），自动按标题拆分幻灯片。适用于生成汇报、演示、方案展示。',
        parameters: [
            { name: 'content', type: 'string', description: 'Markdown 或纯文本内容，按标题自动拆分幻灯片', required: true },
            { name: 'title', type: 'string', description: '演示文稿标题', required: true },
            { name: 'author', type: 'string', description: '作者名称', required: false }
        ]
    },
    {
        name: 'export_xlsx',
        description: '将表格数据导出为 Excel 文件（.xlsx）。支持 JSON 数组和 Markdown 表格两种格式。',
        parameters: [
            { name: 'data', type: 'string', description: 'JSON 数组或 Markdown 表格内容', required: true },
            { name: 'title', type: 'string', description: '文件标题，也用作文件名', required: true },
            { name: 'data_type', type: 'string', description: '数据格式：json 或 markdown，默认自动检测', required: false }
        ]
    },
    {
        name: 'get_tasks',
        description: '获取用户的待办列表。当你需要查看用户的待办事项、日程安排，或者需要从待办中提取地点、日期、事件等信息来帮助用户时使用。例如用户询问火车票、机票、酒店时，可以先调用此工具从待办中获取目的地、日期等信息。',
        parameters: [
            { name: 'status', type: 'string', description: '筛选状态：inbox(收集箱)/today(今日)/next(下一步)/completed(已完成)', required: false },
            { name: 'type', type: 'string', description: '筛选类型', required: false }
        ]
    }
];

const TOOL_CALL_OPEN = '[TOOL_CALL]';
const TOOL_CALL_CLOSE = '[/TOOL_CALL]';

function getFilesystemToolRules(): string {
    return `
- 当任务是“找文件夹/目录/项目目录/代码目录”时，优先使用 \`list_directory\`、\`directory_tree\` 等目录工具，不要把 \`search_files\` 当成“搜索文件夹名称”的工具
- \`search_files\` 更适合搜索“文件”，不是搜索目录；如果工具 schema 里数组参数（如 \`excludePatterns\`）不是必填，优先省略，不要传空字符串
- 如果某个工具参数校验失败，不要立刻放弃；先根据已知工具描述修正参数后重试一次，再决定是否换工具
`.trim();
}

function isBrowserCapableTool(tool: ToolDefinition): boolean {
    const normalized = `${tool.name} ${tool.description}`.toLowerCase();
    return /(playwright|browser|navigate|snapshot|screenshot|click|type|press|tab|page)/.test(normalized);
}

function isWebReadLikeTool(tool: ToolDefinition): boolean {
    const normalized = `${tool.name} ${tool.description}`.toLowerCase();
    if (/clip_web_page/.test(normalized)) return true;
    return /(^|[._-])(read_url|fetch|fetch_url|open_url|extract_url)([._-]|$)/.test(normalized)
        || (/read/.test(normalized) && /url|网页|网页内容|web page|html/.test(normalized));
}

export function classifyMcpTool(tool: { name: string; description: string }): McpToolCategory[] {
    const normalized = `${tool.name} ${tool.description}`.toLowerCase();
    const categories: McpToolCategory[] = [];

    if (/(playwright|browser|navigate|goto|snapshot|screenshot|click|type|press|tab|page|web_interaction)/.test(normalized)) {
        categories.push('browser');
    }
    if (/(search|query|find|lookup|discover|检索|搜索|jina.*search|web_search|google|bing|duckduckgo)/.test(normalized)
        && !/(search_files|search_memos|search_knowledge)/.test(normalized)) {
        categories.push('web-search');
    }
    if (/(read_url|fetch_url|open_url|extract_url|clip_web_page|read.*url|scrape|crawl|extract.*page|extract.*content|网页|网页内容|markdownify)/.test(normalized)
        || (/(read|fetch|get|extract)/.test(normalized) && /(url|uri|link|href|page|web|html)/.test(normalized))) {
        categories.push('web-read');
    }
    if (/(file|directory|folder|filesystem|dir|ls|read_file|write_file|create_file|edit_file|move_file|delete_file|search_files|list_directory|directory_tree)/.test(normalized)
        && !/(read_url|web)/.test(normalized)) {
        categories.push('file');
    }
    if (/(memory|remember|memorize|recall|跨会话|记忆|remember_tool|create_memories|search_memories)/.test(normalized)) {
        categories.push('memory');
    }
    if (/(database|sqlite|postgres|mysql|mongo|supabase|sql|query.*db|table|schema)/.test(normalized)
        && !/(search_knowledge|search_memos)/.test(normalized)) {
        categories.push('database');
    }
    if (/(think|reasoning|chain.of.thought|sequential|step.by.step|分析|推理|思考)/.test(normalized)) {
        categories.push('reasoning');
    }

    if (categories.length === 0) {
        categories.push('other');
    }
    return categories;
}

export function resolveCategoryPreferences(
    allTools: ToolDefinition[],
    categoryPreferences?: McpCategoryPreference[],
): Map<McpToolCategory, string> {
    const map = new Map<McpToolCategory, string>();
    if (!categoryPreferences?.length) return map;
    for (const pref of categoryPreferences) {
        if (pref.category && pref.preferredServerId) {
            map.set(pref.category, pref.preferredServerId);
        }
    }
    return map;
}

function getMcpRoutingRules(tools: ToolDefinition[]): string {
    const browserTools = tools.filter(isBrowserCapableTool).map(tool => tool.name);
    const webReadTools = tools.filter(isWebReadLikeTool).map(tool => tool.name);

    const lines: string[] = [
        '- MCP 工具名如果带有 `mcp.<server>.<tool>` 前缀，说明这是某个特定 MCP 服务器的命名空间工具；当用户明确提到某个 MCP（如 `Jina MCP`）时，优先选择该服务器命名空间下的工具',
        '- 如果多个 MCP 看起来功能相似，不要混用；优先在同一命名空间内完成一轮“搜索 -> 读取 -> 总结”',
        '- 当用户给出 URL 时，先判断站点类型再选工具，不要默认所有链接都走网页直读工具',
        '- 以下站点优先使用浏览器/Playwright 类工具，而不是 `read_url`/`clip_web_page`：B站、b23.tv、小红书、微博、知乎、抖音，以及任何明显依赖登录态或前端动态渲染的页面',
        '- 普通新闻、博客、文档、公告页，优先使用网页直读工具；浏览器工具只在需要交互、登录、等待渲染，或网页直读失败时再使用',
        '- 如果网页直读工具返回 401/403/Unauthorized/Forbidden/空内容，不要直接放弃，改用浏览器类工具继续',
    ];

    if (browserTools.length > 0) {
        lines.push(`- 当前可用的浏览器类工具：${browserTools.join('、')}`);
    }
    if (webReadTools.length > 0) {
        lines.push(`- 当前可用的网页直读工具：${webReadTools.join('、')}`);
    }

    return lines.join('\n');
}

function normalizeMatchText(value: string): string {
    return String(value || '')
        .toLowerCase()
        .replace(/[`"'()[\]{}<>]+/g, ' ')
        .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function extractMcpNamespace(qualifiedName: string): string {
    const match = String(qualifiedName || '').match(/^mcp\.([^.]+)\./i);
    return match?.[1] || '';
}

function includesAlias(haystack: string, alias: string): boolean {
    const normalizedHaystack = normalizeMatchText(haystack);
    const normalizedAlias = normalizeMatchText(alias);
    if (!normalizedHaystack || !normalizedAlias) return false;
    if (normalizedHaystack.includes(normalizedAlias)) return true;
    return normalizedHaystack.replace(/\s+/g, '').includes(normalizedAlias.replace(/\s+/g, ''));
}

async function getMcpServerCatalog(): Promise<Array<{ serverId: string; serverName: string; aliases: string[] }>> {
    const allTools = await mcpManager.getAllTools();
    const catalog = new Map<string, { serverId: string; serverName: string; aliases: Set<string> }>();

    for (const tool of allTools) {
        const existing = catalog.get(tool.serverId) || {
            serverId: tool.serverId,
            serverName: tool.serverName || tool.serverId,
            aliases: new Set<string>(),
        };
        existing.serverName = existing.serverName || tool.serverName || tool.serverId;
        existing.aliases.add(tool.serverId);
        existing.aliases.add(tool.serverName || tool.serverId);
        const namespace = extractMcpNamespace(tool.qualifiedName || '');
        if (namespace) {
            existing.aliases.add(namespace);
        }
        catalog.set(tool.serverId, existing);
    }

    return Array.from(catalog.values()).map(item => ({
        serverId: item.serverId,
        serverName: item.serverName,
        aliases: Array.from(item.aliases).filter(Boolean),
    }));
}

export async function getMcpServerLabel(serverId?: string): Promise<string | undefined> {
    if (!serverId) return undefined;
    const catalog = await getMcpServerCatalog();
    return catalog.find(item => item.serverId === serverId)?.serverName;
}

export async function detectPreferredMcpServer(query: string): Promise<string | undefined> {
    const normalizedQuery = normalizeMatchText(query);
    if (!normalizedQuery || !/(^|\s)(mcp|server|服务器|工具|插件)(\s|$)/i.test(normalizedQuery)) {
        return undefined;
    }

    const catalog = await getMcpServerCatalog();
    let bestMatch: { serverId: string; score: number } | null = null;

    for (const server of catalog) {
        let score = 0;
        for (const alias of server.aliases) {
            if (!alias) continue;
            if (!includesAlias(normalizedQuery, alias)) continue;
            const normalizedAlias = normalizeMatchText(alias);
            score = Math.max(score, normalizedAlias.length);
            if (new RegExp(`\\b${normalizedAlias.replace(/\s+/g, '\\s+')}\\s+mcp\\b`, 'i').test(normalizedQuery)) {
                score += 50;
            }
        }
        if (!score) continue;
        if (!bestMatch || score > bestMatch.score) {
            bestMatch = { serverId: server.serverId, score };
        }
    }

    return bestMatch?.serverId;
}

function describeSchemaType(schema: any): 'string' | 'number' | 'boolean' | 'array' | 'object' {
    if (schema.type === 'number' || schema.type === 'integer') return 'number'
    if (schema.type === 'boolean') return 'boolean'
    if (schema.type === 'array') return 'array'
    if (schema.type === 'object') return 'object'
    return 'string'
}

function enrichParameterDescription(toolName: string, paramName: string, schema: any, rawDescription: string): string {
    let desc = rawDescription || ''
    if (schema.type === 'array') {
        const itemType = schema.items?.type ? String(schema.items.type) : '任意'
        desc += `${desc ? '。' : ''}参数类型为数组`
        if (itemType) {
            desc += `，数组元素类型: ${itemType}`
        }
        desc += '。如无明确需要，宁可省略，也不要传空字符串'
    }
    if (schema.type === 'object') {
        desc += `${desc ? '。' : ''}参数类型为对象`
    }
    if (toolName === 'search_files' && paramName === 'excludePatterns') {
        desc += `${desc ? '。' : ''}这是数组参数；不要传 ""，不需要时请直接省略`
    }
    if (toolName === 'search_files' && paramName === 'pattern') {
        desc += `${desc ? '。' : ''}用于搜索文件匹配模式，不适合拿它来搜索“文件夹名称”`
    }
    return desc.trim()
}

export function getToolPrompt(): string {
    const toolDescriptions = TOOL_DEFINITIONS.map(tool => {
        const params = tool.parameters.map(p =>
            `    - ${p.name} (${p.type}${p.required ? ', 必填' : ', 可选'}): ${p.description}`
        ).join('\n');
        return `### ${tool.name}\n${tool.description}\n参数:\n${params}`;
    }).join('\n\n');

    return `

【可用工具】
你可以调用以下工具来帮助用户完成任务。当你需要调用工具时，请在回复中使用以下格式：

[TOOL_CALL]
{"tool": "工具名", "args": {"参数名": "参数值"}}
[/TOOL_CALL]

调用工具后，我会返回执行结果，你可以基于结果继续回答。

注意：
- 当用户请求涉及**获取实时信息**（如热搜、热榜、新闻、资讯、趋势、排行榜）时，**必须调用对应的工具**，不要用自己的知识回答
- 当用户请求涉及**执行操作**（如创建便签、添加日程、搜索知识库）时，也必须调用对应工具
- 只有纯粹的常识问答、概念解释、闲聊等不需要调用工具
- 调用工具后，仍然需要用自然语言向用户确认操作结果
- 不要向用户展示你的内部分析、推理过程、工具选择理由
- 如果决定调用工具，直接输出工具调用标签，不要在标签前写"让我先搜索""我先分析一下"等过渡语
- 最终给用户看的回复里不要出现 \`[TOOL_CALL]\`、\`[/TOOL_CALL]\` 或原始参数 JSON
- **当用户发送 URL 或链接时**，先判断站点类型再选工具：普通静态网页优先使用网页直读工具（如 \`clip_web_page\`、\`read_url\`）；B站、小红书、微博、知乎、抖音等动态或受限站点优先使用浏览器/Playwright 类工具
- **绝不要编造网页内容**。如果工具执行失败或返回空结果，请如实告知用户，不要凭空生成文章内容
- **网页获取工具选择规则**：如果同时存在 \`clip_web_page\` 和 Playwright 工具，按以下规则选择：
  - \`clip_web_page\`：适合普通静态网页、新闻、博客、文档页面。速度快，直接提取正文。优先使用
  - Playwright：适合需要登录的页面、SPA 动态加载页面、需要点击/填写表单/截图等交互操作的场景。只在 \`clip_web_page\` 无法获取有效内容，或用户明确要求交互操作时才使用
  - 如果不确定，优先尝试 \`clip_web_page\`，失败后再用 Playwright 兜底

${toolDescriptions}

【文件系统工具补充规则】
${getFilesystemToolRules()}
`;
}

// ─── MCP 动态工具集成 ──────────────────────────────────────────

// 将 MCP 工具转为内置 ToolDefinition 格式
function convertMcpToolToDefinition(tool: McpToolInfo): ToolDefinition {
    const parameters: ToolDefinition['parameters'] = []
    try {
        const props = tool.inputSchema?.properties || {}
        const required = tool.inputSchema?.required || []
        for (const [name, schema] of Object.entries(props) as [string, any][]) {
            const type = describeSchemaType(schema)

            // 构建描述：原始描述 + 枚举选项
            let desc = enrichParameterDescription(tool.name, name, schema, schema.description || '')
            const enumOptions = extractEnumOptions(schema)
            if (enumOptions.length > 0) {
                desc += `。可选值: ${enumOptions.join('/')}`
            }

            parameters.push({
                name,
                type,
                description: desc,
                required: required.includes(name),
            })
        }
    } catch (e) {
        log.error('[MCP] Failed to parse inputSchema for tool:', tool.name, e)
    }
    return {
        name: tool.qualifiedName || tool.name,
        description: `[MCP/${tool.serverName || tool.serverId}] ${tool.description || '(MCP 工具，无描述)'}`,
        parameters,
    }
}

// 从 schema 中提取枚举选项（支持 anyOf/const 和 enum）
function extractEnumOptions(schema: any): string[] {
    // 直接 enum
    if (Array.isArray(schema.enum)) {
        return schema.enum.map(String)
    }
    // anyOf + const 格式（MCP trends-hub 常用）
    if (Array.isArray(schema.anyOf)) {
        const options: string[] = []
        for (const item of schema.anyOf) {
            if (item.const !== undefined) {
                const label = item.description || String(item.const)
                options.push(label)
            }
        }
        if (options.length > 0) return options
    }
    return []
}

export async function getAllToolDefinitions(options?: DynamicToolPromptOptions): Promise<ToolDefinition[]> {
    const builtIn = [...TOOL_DEFINITIONS]
    const preferredId = options?.preferredMcpServerId || undefined
    const categoryPrefs = resolveCategoryPreferences(builtIn, options?.categoryPreferences)
    const intentFilter = options?.intentFilter

    try {
        const mcpTools = await mcpManager.getAllTools()
        log.info(`[MCP-DIAG] getAllTools returned ${mcpTools.length} MCP tools, intentFilter: ${intentFilter?.join(',') || 'none'}`)
        let mcpAdded = 0
        const MAX_MCP_TOOLS = options?.maxTools ?? 10
        for (const tool of mcpTools) {
            if (mcpAdded >= MAX_MCP_TOOLS && !preferredId) break

            const converted = convertMcpToolToDefinition(tool)
            converted.categories = classifyMcpTool(converted)

            if (preferredId && tool.serverId !== preferredId) continue

            const dominatedByCategory = converted.categories.some(cat => {
                const prefServerId = categoryPrefs.get(cat)
                return prefServerId && prefServerId !== tool.serverId
            })
            if (dominatedByCategory && !preferredId) continue

            // 按意图过滤：只包含匹配查询意图类别的工具
            if (intentFilter && intentFilter.length > 0 && !intentFilter.includes('other')) {
                const matchesIntent = converted.categories.some(cat => intentFilter.includes(cat))
                if (!matchesIntent) continue
            }

            log.info(`[MCP-DIAG] Tool: ${converted.name} | desc: ${converted.description.substring(0, 60)} | params: ${converted.parameters.length} | categories: ${converted.categories.join(',')}`)
            builtIn.push(converted)
            mcpAdded++
        }
    } catch (e) {
        log.error('[MCP] Failed to get MCP tools:', e)
    }
    log.info(`[MCP-DIAG] Total tool definitions: ${builtIn.length} (built-in: ${TOOL_DEFINITIONS.length}, MCP: ${builtIn.length - TOOL_DEFINITIONS.length})`)
    return builtIn
}

export async function getDynamicToolPrompt(options?: DynamicToolPromptOptions): Promise<string> {
    const allTools = await getAllToolDefinitions(options)
    const preferredMcpServerLabel = await getMcpServerLabel(options?.preferredMcpServerId)
    const categoryPrefs = resolveCategoryPreferences(allTools, options?.categoryPreferences)

    const categoryRoutingLines: string[] = []
    if (categoryPrefs.size > 0) {
        for (const [cat, serverId] of categoryPrefs) {
            const label = await getMcpServerLabel(serverId) || serverId
            categoryRoutingLines.push(`- ${MCP_CATEGORY_LABELS[cat] || cat} 类工具已指定由 \`${label}\` 提供`)
        }
    }

    const toolDescriptions = allTools.map(tool => {
        const params = tool.parameters.map(p =>
            `    - ${p.name} (${p.type}${p.required ? ', 必填' : ', 可选'}): ${p.description}`
        ).join('\n');
        return `### ${tool.name}\n${tool.description}\n参数:\n${params}`;
    }).join('\n\n');

    return `

【可用工具】
你可以调用以下工具来帮助用户完成任务。当你需要调用工具时，请在回复中使用以下格式：

[TOOL_CALL]
{"tool": "工具名", "args": {"参数名": "参数值"}}
[/TOOL_CALL]

调用工具后，我会返回执行结果，你可以基于结果继续回答。

注意：
- 当用户请求涉及**获取实时信息**（如热搜、热榜、新闻、资讯、趋势、排行榜）时，**必须调用对应的工具**，不要用自己的知识回答
- 当用户请求涉及**执行操作**（如创建便签、添加日程、搜索知识库）时，也必须调用对应工具
- 只有纯粹的常识问答、概念解释、闲聊等不需要调用工具
- 调用工具后，仍然需要用自然语言向用户确认操作结果
- 不要向用户展示你的内部分析、推理过程、工具选择理由
- 如果决定调用工具，直接输出工具调用标签，不要在标签前写“让我先搜索”“我先分析一下”等过渡语
- 最终给用户看的回复里不要出现 \`[TOOL_CALL]\`、\`[/TOOL_CALL]\` 或原始参数 JSON
- ${preferredMcpServerLabel ? `本轮如果需要调用 MCP，只允许使用 \`${preferredMcpServerLabel}\` 这个 MCP 服务器下的工具，不要切换到其他 MCP` : '如果已经开始使用某个 MCP 服务器，后续优先留在同一个 MCP 命名空间内完成整轮任务'}
${categoryRoutingLines.length > 0 ? categoryRoutingLines.join('\n') : ''}

${toolDescriptions}

【文件系统工具补充规则】
${getFilesystemToolRules()}

【MCP 工具路由规则】
${getMcpRoutingRules(allTools)}
`;
}

function parseXmlLikeToolCall(block: string): ToolCall | null {
    const jsonCandidate = block.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
    if (/^\{[\s\S]*\}$/.test(jsonCandidate)) {
        try {
            const parsed = JSON.parse(jsonCandidate)
            if (parsed?.tool) {
                return { tool: parsed.tool, args: parsed.args || {} }
            }
        } catch {}
    }

    const functionMatch = block.match(/<function(?:=|:)\s*([a-zA-Z0-9_.-]+)\s*>/i);
    if (!functionMatch?.[1]) return null;

    const args: Record<string, any> = {};
    const paramRegex = /<parameter(?:=|:)\s*([a-zA-Z0-9_.-]+)\s*>([\s\S]*?)<\/parameter>/gi;
    let paramMatch: RegExpExecArray | null;

    while ((paramMatch = paramRegex.exec(block)) !== null) {
        const key = paramMatch[1]?.trim();
        const value = paramMatch[2]?.trim() ?? '';
        if (key) {
            args[key] = value;
        }
    }

    return {
        tool: functionMatch[1].trim(),
        args,
    };
}

function tryParseJsonToolCall(text: string): ToolCall | null {
    const trimmed = text.trim();
    if (!trimmed) return null;
    try {
        const parsed = JSON.parse(trimmed);
        if (parsed?.tool) {
            return { tool: parsed.tool, args: parsed.args || {} };
        }
    } catch {}
    // 尝试修复本地模型常见的截断 JSON（缺少尾部 }）
    for (let closeIdx = trimmed.length - 1; closeIdx >= 0; closeIdx--) {
        if (trimmed[closeIdx] === '}' || trimmed[closeIdx] === ']') {
            const candidate = trimmed.slice(0, closeIdx + 1);
            try {
                const parsed = JSON.parse(candidate);
                if (parsed?.tool) {
                    return { tool: parsed.tool, args: parsed.args || {} };
                }
            } catch {}
        }
    }
    return null;
}

export function parseToolCalls(response: string): { calls: ToolCall[]; cleanResponse: string } {
    const calls: ToolCall[] = [];
    const bracketRegex = /\[TOOL_CALL\]\s*([\s\S]*?)\s*\[\/TOOL_CALL\]/gi;
    const xmlRegex = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/gi;
    let match: RegExpExecArray | null;

    // 解析 [TOOL_CALL]...[/TOOL_CALL] 格式
    try {
        while ((match = bracketRegex.exec(response)) !== null) {
            try {
                const parsed = JSON.parse(match[1]!.trim());
                if (parsed?.tool) {
                    calls.push({ tool: parsed.tool, args: parsed.args || {} });
                }
            } catch (e) {
                log.error('Failed to parse bracket tool call:', match[1]?.substring(0, 100));
            }
        }
    } catch (e) {
        log.error('Error in bracketRegex parsing:', e);
    }

    // 解析 XML 格式工具调用
    try {
        while ((match = xmlRegex.exec(response)) !== null) {
            try {
                const parsed = parseXmlLikeToolCall(match[1] ?? '');
                if (parsed?.tool) {
                    calls.push(parsed);
                }
            } catch (e) {
                log.error('Failed to parse xml-like tool call:', match[1]?.substring(0, 100));
            }
        }
    } catch (e) {
        log.error('Error in xmlRegex parsing:', e);
    }

    // 本地模型增强：从 markdown 代码块中提取 JSON 工具调用
    // 本地模型经常输出 ```json\n{"tool":"xxx","args":{...}}\n``` 格式
    if (calls.length === 0) {
        try {
            const codeBlockRegex = /```(?:json|tool)?\s*\n?([\s\S]*?)```/gi;
            while ((match = codeBlockRegex.exec(response)) !== null) {
                try {
                    const recovered = tryParseJsonToolCall(match[1] || '');
                    if (recovered && hasAvailableTool(recovered.tool)) {
                        calls.push(recovered);
                    }
                } catch (e) {
                    log.error('Error parsing code block tool call:', e);
                }
            }
        } catch (e) {
            log.error('Error in codeBlockRegex parsing:', e);
        }
    }

    // 本地模型增强：检测裸 JSON 工具调用（没有标签包裹）
    // 匹配 {"tool":"xxx","args":{...}} 格式
    if (calls.length === 0) {
        try {
            const bareJsonRegex = /\{\s*"tool"\s*:\s*"[^"]+"/g;
            while ((match = bareJsonRegex.exec(response)) !== null) {
                try {
                    // 从匹配位置开始尝试提取完整的 JSON
                    const startIdx = match.index;
                    const recovered = tryParseJsonToolCall(response.slice(startIdx));
                    if (recovered && hasAvailableTool(recovered.tool)) {
                        calls.push(recovered);
                    }
                } catch (e) {
                    log.error('Error parsing bare JSON tool call:', e);
                }
            }
        } catch (e) {
            log.error('Error in bareJsonRegex parsing:', e);
        }
    }

    const cleanResponse = response
        .replace(bracketRegex, '')
        .replace(xmlRegex, '')
        .trim();
    return { calls, cleanResponse };
}

export function hasAvailableTool(toolName: string): boolean {
    return Boolean(getRegistryTool(toolName) || mcpManager.findServerForTool(toolName))
}

export async function normalizeToolCallForPreferredServer(
    call: ToolCall,
    preferredMcpServerId?: string,
    categoryPreferences?: McpCategoryPreference[],
): Promise<ToolCall> {
    if (getRegistryTool(call.tool)) {
        return call;
    }

    const allTools = await mcpManager.getAllTools();
    const categoryPrefsMap = new Map<McpToolCategory, string>();
    if (categoryPreferences?.length) {
        for (const pref of categoryPreferences) {
            if (pref.category && pref.preferredServerId) {
                categoryPrefsMap.set(pref.category, pref.preferredServerId);
            }
        }
    }

    if (preferredMcpServerId) {
        const directMatch = allTools.find(tool =>
            tool.serverId === preferredMcpServerId &&
            (tool.qualifiedName === call.tool || tool.name === call.tool)
        );
        if (directMatch) {
            return { ...call, tool: directMatch.qualifiedName || directMatch.name };
        }

        const bareName = String(call.tool || '').replace(/^mcp\.[^.]+\./i, '');
        const preferredMatch = allTools.find(tool =>
            tool.serverId === preferredMcpServerId && tool.name === bareName
        );
        if (preferredMatch) {
            return { ...call, tool: preferredMatch.qualifiedName || preferredMatch.name };
        }
    }

    if (categoryPrefsMap.size > 0) {
        const bareName = String(call.tool || '').replace(/^mcp\.[^.]+\./i, '');
        const matchedTool = allTools.find(t => t.qualifiedName === call.tool || t.name === call.tool || t.name === bareName);
        if (matchedTool) {
            const toolCategories = classifyMcpTool({ name: matchedTool.name, description: matchedTool.description });
            for (const cat of toolCategories) {
                const prefServerId = categoryPrefsMap.get(cat);
                if (prefServerId && prefServerId !== matchedTool.serverId) {
                    const replacement = allTools.find(t =>
                        t.serverId === prefServerId && t.name === bareName
                    );
                    if (replacement) {
                        return { ...call, tool: replacement.qualifiedName || replacement.name };
                    }
                }
            }
        }
    }

    return call;
}

// 内置工具执行 —— 委托给统一工具注册表（toolRegistry）
async function executeBuiltInTool(call: ToolCall): Promise<{ success: boolean; result: any; message: string }> {
    const registryTool = getRegistryTool(call.tool);
    if (!registryTool) {
        return { success: false, result: null, message: `未知工具: ${call.tool}` };
    }

    const { execute, parameters } = registryTool;

    // 将参数从 mcpTools 格式（args 是扁平对象）传递给 registryTool
    try {
        const context = {
            resolveTemplate: (t: string) => t,
            getVariable: () => undefined,
            setVariable: () => {},
            searxngUrl: undefined as string | undefined,
        };
        const result = await execute(call.args || {}, context);
        return { success: true, result, message: result.message || '执行成功' };
    } catch (err: any) {
        return { success: false, result: null, message: `工具执行失败: ${err.message}` };
    }
}

// 工具执行路由：内置工具 → toolRegistry，MCP 工具 → mcpManager
function sanitizeToolArgs(args: Record<string, any>): Record<string, any> {
    if (!args || typeof args !== 'object') return args;
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(args)) {
        if (typeof value === 'string') {
            let cleaned = value.trim();
            if (/^`https?:\/\/.+`$/.test(cleaned)) {
                cleaned = cleaned.slice(1, -1).trim();
            }
            cleaned = cleaned.replace(/`/g, '');
            sanitized[key] = cleaned;
        } else if (Array.isArray(value)) {
            sanitized[key] = value.map(item => {
                if (typeof item === 'string') {
                    let cleaned = item.trim();
                    if (/^`https?:\/\/.+`$/.test(cleaned)) {
                        cleaned = cleaned.slice(1, -1).trim();
                    }
                    cleaned = cleaned.replace(/`/g, '');
                    return cleaned;
                }
                return item;
            });
        } else {
            sanitized[key] = value;
        }
    }
    return sanitized;
}

export async function executeTool(call: ToolCall): Promise<{ success: boolean; result: any; message: string }> {
    const sanitizedCall = { ...call, args: sanitizeToolArgs(call.args || {}) };

    const registryTool = getRegistryTool(sanitizedCall.tool);
    if (registryTool) {
        return executeBuiltInTool(sanitizedCall);
    }

    const serverId = mcpManager.findServerForTool(sanitizedCall.tool)
    if (serverId) {
        return mcpManager.callTool(serverId, sanitizedCall.tool, sanitizedCall.args || {})
    }

    return { success: false, result: null, message: `未知工具: ${sanitizedCall.tool}` }
}

export default { TOOL_DEFINITIONS, getToolPrompt, getDynamicToolPrompt, getAllToolDefinitions, parseToolCalls, executeTool };
