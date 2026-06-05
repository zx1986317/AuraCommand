/**
 * MCP 客户端管理器
 * 管理与 MCP Server 的连接、工具发现和调用
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import dbHelper from './db'
import { buildQualifiedMcpToolName, registerMcpTool, unregisterMcpTools, setMcpToolExecutor } from './toolRegistry'
import log from 'electron-log'

// ─── 配置接口 ────────────────────────────────────────────────
export interface McpServerConfig {
  id: string
  name: string
  transport: 'stdio' | 'sse'
  command?: string       // stdio: e.g. 'npx'
  args?: string[]        // stdio: e.g. ['-y', 'mcp-trends-hub@1.6.2']
  env?: Record<string, string>
  url?: string            // sse: e.g. 'http://localhost:3000/sse'
  enabled: boolean
  auto_connect: boolean
}

const LEGACY_MCP_PACKAGE_MAP: Record<string, string> = {
  '@anthropic/mcp-server-filesystem': '@modelcontextprotocol/server-filesystem',
  '@anthropic/mcp-server-fetch': 'mcp-fetch',
  '@anthropic/mcp-server-git': 'mcp-git',
  '@anthropic/mcp-server-memory': '@modelcontextprotocol/server-memory',
  '@modelcontextprotocol/server-fetch': 'mcp-fetch',
  '@modelcontextprotocol/server-git': 'mcp-git',
}

export function normalizeMcpConfig(config: McpServerConfig): McpServerConfig {
  const nextArgs = (config.args || []).map(arg => LEGACY_MCP_PACKAGE_MAP[arg] || arg)
  const mutated = nextArgs.some((arg, index) => arg !== (config.args || [])[index])
  if (mutated) {
    log.warn(`[MCP] Normalized legacy package name for server: ${config.name}`)
  }
  return {
    ...config,
    args: nextArgs,
  }
}

// ─── 工具信息接口 ────────────────────────────────────────────
export interface McpToolInfo {
  serverId: string
  serverName: string
  name: string
  qualifiedName: string
  description: string
  inputSchema: any
}

// ─── 连接状态 ────────────────────────────────────────────────
type ServerStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

type McpClientEntry = {
  client: Client
  transport: StdioClientTransport | SSEClientTransport
  transportType: 'stdio' | 'sse'
}

function interpolateEnvPlaceholders(value: string, env: Record<string, string>): string {
  return String(value || '').replace(/\$\{([^}]+)\}/g, (_match, name: string) => {
    const key = String(name || '').trim()
    return key in env ? String(env[key] ?? '') : ''
  })
}

let cachedWindowsProxyEnv: Record<string, string> | null = null
let cachedBootstrapFilePath: string | null = null

const MCP_UNDICI_PROXY_BOOTSTRAP_SOURCE = `'use strict';
try {
  const httpProxy = process.env.https_proxy || process.env.HTTPS_PROXY || process.env.http_proxy || process.env.HTTP_PROXY;
  const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy || httpProxy;
  const noProxy = process.env.NO_PROXY || process.env.no_proxy;
  const undiciPath = process.env.AURACOMMAND_UNDICI_REQUIRE_PATH;

  if (httpProxy || httpsProxy) {
    const undici = undiciPath ? require(undiciPath) : require('undici');
    if (undici && undici.EnvHttpProxyAgent && undici.setGlobalDispatcher) {
      const agent = new undici.EnvHttpProxyAgent({
        httpProxy,
        httpsProxy,
        noProxy,
      });
      undici.setGlobalDispatcher(agent);
      process.env.NODE_USE_ENV_PROXY = '1';
    }
  }
} catch (_) {}
`

function ensureProxyScheme(value: string, protocolHint?: string): string {
  const trimmed = String(value || '').trim()
  if (!trimmed) return ''
  if (/^[a-z]+:\/\//i.test(trimmed)) return trimmed
  if (protocolHint === 'socks' || protocolHint === 'socks4' || protocolHint === 'socks5') {
    return `${protocolHint}://${trimmed}`
  }
  return `http://${trimmed}`
}

function parseWindowsProxyOverride(value: string): string {
  const items = String(value || '')
    .split(';')
    .map(item => item.trim())
    .filter(Boolean)
    .flatMap(item => {
      if (item.toLowerCase() === '<local>') {
        return ['localhost', '127.0.0.1', '::1', '*.local']
      }
      return [item]
    })

  return Array.from(new Set(items)).join(',')
}

function parseWindowsProxyServer(value: string): Record<string, string> {
  const raw = String(value || '').trim()
  if (!raw) return {}

  const segments = raw.split(';').map(part => part.trim()).filter(Boolean)
  const protocolEntries = segments.filter(segment => segment.includes('='))

  if (protocolEntries.length === 0) {
    const unified = ensureProxyScheme(raw)
    return {
      HTTP_PROXY: unified,
      HTTPS_PROXY: unified,
      ALL_PROXY: unified,
    }
  }

  const mapping: Record<string, string> = {}
  for (const entry of protocolEntries) {
    const [protocolRaw, proxyRaw] = entry.split('=', 2)
    const protocol = String(protocolRaw || '').trim().toLowerCase()
    const proxy = String(proxyRaw || '').trim()
    if (!protocol || !proxy) continue

    if (protocol === 'http') mapping.HTTP_PROXY = ensureProxyScheme(proxy, 'http')
    if (protocol === 'https') mapping.HTTPS_PROXY = ensureProxyScheme(proxy, 'https')
    if (protocol === 'ftp') mapping.FTP_PROXY = ensureProxyScheme(proxy, 'http')
    if (protocol === 'socks' || protocol === 'socks4' || protocol === 'socks5') {
      mapping.ALL_PROXY = ensureProxyScheme(proxy, protocol === 'socks' ? 'socks5' : protocol)
      mapping.SOCKS_PROXY = ensureProxyScheme(proxy, protocol === 'socks' ? 'socks5' : protocol)
    }
  }

  if (!mapping.HTTP_PROXY && mapping.HTTPS_PROXY) mapping.HTTP_PROXY = mapping.HTTPS_PROXY
  if (!mapping.HTTPS_PROXY && mapping.HTTP_PROXY) mapping.HTTPS_PROXY = mapping.HTTP_PROXY
  if (!mapping.ALL_PROXY) mapping.ALL_PROXY = mapping.HTTPS_PROXY || mapping.HTTP_PROXY || ''

  return Object.fromEntries(Object.entries(mapping).filter(([, proxy]) => !!proxy))
}

function isNodeRuntimeCommand(command: string): boolean {
  const normalized = path.basename(String(command || '').trim()).toLowerCase()
  return ['node', 'node.exe', 'npx', 'npx.cmd', 'npm', 'npm.cmd', 'pnpm', 'pnpm.cmd', 'yarn', 'yarn.cmd', 'bun', 'bun.exe'].includes(normalized)
}

function appendNodeRequireOption(existingOptions: string | undefined, requirePath: string): string {
  const quotedPath = `"${requirePath.replace(/\\/g, '\\\\')}"`
  const requireOption = `--require ${quotedPath}`
  const current = String(existingOptions || '').trim()
  if (current.includes(requirePath) || current.includes(requireOption)) {
    return current
  }
  return current ? `${current} ${requireOption}` : requireOption
}

function ensureProxyBootstrapFile(): string {
  if (cachedBootstrapFilePath && fs.existsSync(cachedBootstrapFilePath)) {
    return cachedBootstrapFilePath
  }

  const bootstrapDir = path.join(os.tmpdir(), 'auracommand-mcp')
  const bootstrapPath = path.join(bootstrapDir, 'mcp-undici-proxy-bootstrap.cjs')
  fs.mkdirSync(bootstrapDir, { recursive: true })
  fs.writeFileSync(bootstrapPath, MCP_UNDICI_PROXY_BOOTSTRAP_SOURCE, 'utf-8')
  cachedBootstrapFilePath = bootstrapPath
  return bootstrapPath
}

function getWindowsProxyEnv(): Record<string, string> {
  if (process.platform !== 'win32') return {}
  if (cachedWindowsProxyEnv) return { ...cachedWindowsProxyEnv }

  try {
    const script = [
      "$v = Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'",
      "@{ ProxyEnable = $v.ProxyEnable; ProxyServer = $v.ProxyServer; ProxyOverride = $v.ProxyOverride; AutoConfigURL = $v.AutoConfigURL } | ConvertTo-Json -Compress",
    ].join('; ')
    const output = execSync(`powershell -NoProfile -Command "${script}"`, {
      encoding: 'utf-8',
      timeout: 4000,
      windowsHide: true,
    }).trim()

    if (!output) {
      cachedWindowsProxyEnv = {}
      return {}
    }

    const parsed = JSON.parse(output) as {
      ProxyEnable?: number
      ProxyServer?: string
      ProxyOverride?: string
      AutoConfigURL?: string
    }

    if (parsed.ProxyEnable !== 1 || !parsed.ProxyServer) {
      cachedWindowsProxyEnv = {}
      return {}
    }

    const proxyEnv = parseWindowsProxyServer(parsed.ProxyServer)
    const noProxy = parseWindowsProxyOverride(parsed.ProxyOverride || '')
    cachedWindowsProxyEnv = {
      ...proxyEnv,
      ...(noProxy ? { NO_PROXY: noProxy, no_proxy: noProxy } : {}),
      NODE_USE_ENV_PROXY: '1',
    }
    if (cachedWindowsProxyEnv.HTTP_PROXY) cachedWindowsProxyEnv.http_proxy = cachedWindowsProxyEnv.HTTP_PROXY
    if (cachedWindowsProxyEnv.HTTPS_PROXY) cachedWindowsProxyEnv.https_proxy = cachedWindowsProxyEnv.HTTPS_PROXY
    if (cachedWindowsProxyEnv.ALL_PROXY) cachedWindowsProxyEnv.all_proxy = cachedWindowsProxyEnv.ALL_PROXY
    return { ...cachedWindowsProxyEnv }
  } catch (error) {
    log.warn('[MCP] Failed to read Windows proxy settings for MCP child process:', error)
    cachedWindowsProxyEnv = {}
    return {}
  }
}

function decodeHtmlEntities(text: string): string {
  return String(text || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function stripXmlTags(text: string): string {
  return decodeHtmlEntities(text)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractXmlTag(block: string, tagName: string): string {
  const match = block.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i'))
  return stripXmlTags(match?.[1] ?? '')
}

function normalizeLooseUrl(text: string): string {
  return String(text || '')
    .replace(/https?\s*:\s*\/\s*\//gi, match => match.toLowerCase().startsWith('https') ? 'https://' : 'http://')
    .replace(/\s+/g, '')
}

function cleanTaggedValue(tagName: string, value: string): string {
  const cleaned = stripXmlTags(value)
  if (tagName === 'link') {
    return normalizeLooseUrl(cleaned)
  }
  return cleaned
}

function formatTaggedFragments(text: string): string {
  const tagRegex = /<(title|publish_time|pubDate|published|updated|link|summary|description)>\s*([\s\S]*?)\s*<\/\1>/gi
  const items: Array<{ title?: string; time?: string; link?: string; summary?: string }> = []
  let current: { title?: string; time?: string; link?: string; summary?: string } = {}

  const pushCurrent = () => {
    if (current.title || current.time || current.link || current.summary) {
      items.push(current)
      current = {}
    }
  }

  for (const match of text.matchAll(tagRegex)) {
    const tagName = match[1]?.toLowerCase() || ''
    const value = cleanTaggedValue(tagName, match[2] || '')
    if (!value) continue

    if ((tagName === 'publish_time' || tagName === 'pubdate' || tagName === 'published' || tagName === 'updated') && (current.title || current.time || current.link || current.summary)) {
      pushCurrent()
    }
    if (tagName === 'title' && current.title && (current.time || current.link || current.summary)) {
      pushCurrent()
    }

    if (tagName === 'title') current.title = value
    if (tagName === 'publish_time' || tagName === 'pubdate' || tagName === 'published' || tagName === 'updated') current.time = value
    if (tagName === 'link') current.link = value
    if (tagName === 'summary' || tagName === 'description') current.summary = value
  }
  pushCurrent()

  if (items.length === 0) {
    return ''
  }

  const lines: string[] = []
  for (const [index, item] of items.slice(0, 10).entries()) {
    lines.push(`${index + 1}. **${item.title || `资讯 ${index + 1}`}**`)
    if (item.time) lines.push(`时间：${item.time}`)
    if (item.summary) lines.push(`摘要：${item.summary}`)
    if (item.link) lines.push(`链接：${item.link}`)
    lines.push('')
  }
  return lines.join('\n').trim()
}

function formatXmlFeed(text: string): string {
  const normalized = decodeHtmlEntities(text)
  const blocks = Array.from(normalized.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)).map(match => match[0])
  if (blocks.length === 0) {
    return stripXmlTags(normalized)
  }

  const lines: string[] = []
  for (const [index, block] of blocks.slice(0, 10).entries()) {
    const title = extractXmlTag(block, 'title') || `热榜 ${index + 1}`
    const link = extractXmlTag(block, 'link')
    const source = extractXmlTag(block, 'source') || extractXmlTag(block, 'author')
    const time = extractXmlTag(block, 'pubDate') || extractXmlTag(block, 'updated') || extractXmlTag(block, 'published')
    const summary = extractXmlTag(block, 'description') || extractXmlTag(block, 'summary') || extractXmlTag(block, 'content')

    lines.push(`${index + 1}. **${title}**`)
    if (source) lines.push(`来源：${source}`)
    if (time) lines.push(`时间：${time}`)
    if (summary) lines.push(`摘要：${summary}`)
    if (link) lines.push(`链接：${link}`)
    lines.push('')
  }

  return lines.join('\n').trim()
}

function formatStructuredLines(text: string): string {
  const rawLines = String(text || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)

  if (rawLines.length === 0) {
    return ''
  }

  const lines: string[] = []
  let index = 0
  for (const line of rawLines.slice(0, 40)) {
    const cleaned = line
      .replace(/^[•·\-]+\s*/, '')
      .replace(/^\d+[.)、]\s*/, '')
      .trim()

    if (/^https?:\/\//i.test(cleaned)) {
      lines.push(`链接：${cleaned}`)
      lines.push('')
      continue
    }

    if (/^(来源|平台|网站|链接|时间|日期|热度|摘要|描述|分类|作者)[:：]/.test(cleaned)) {
      lines.push(cleaned)
      continue
    }

    index += 1
    lines.push(`${index}. **${cleaned}**`)
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

function formatCommonObjectItem(item: any, index: number): string[] {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return []
  }

  const title = String(
    item.title ||
    item.name ||
    item.path ||
    item.url ||
    item.link ||
    `结果 ${index + 1}`
  ).trim()

  const lines = [`${index + 1}. **${title}**`]
  const orderedKeys = ['path', 'url', 'link', 'time', 'publish_time', 'created_at', 'updated_at', 'summary', 'description', 'snippet', 'type', 'size']

  for (const key of orderedKeys) {
    const value = item[key]
    if (value === undefined || value === null || value === '') continue
    const label =
      key === 'path' ? '路径' :
      key === 'url' || key === 'link' ? '链接' :
      key === 'time' || key === 'publish_time' || key === 'created_at' || key === 'updated_at' ? '时间' :
      key === 'summary' || key === 'description' || key === 'snippet' ? '摘要' :
      key === 'type' ? '类型' :
      key === 'size' ? '大小' :
      key
    lines.push(`${label}：${String(value).trim()}`)
  }

  return lines
}

function tryParseJson(text: string): any | null {
  const raw = String(text || '').trim()
  if (!raw) return null

  const fencedMatch = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  const candidate = fencedMatch?.[1]?.trim() ?? raw
  if (!/^[\[{]/.test(candidate)) {
    return null
  }

  try {
    return JSON.parse(candidate)
  } catch {
    return null
  }
}

function formatJsonValue(value: any, indent = ''): string[] {
  if (value === null || value === undefined) {
    return [`${indent}- null`]
  }

  if (typeof value !== 'object') {
    return [`${indent}- ${String(value)}`]
  }

  if (Array.isArray(value)) {
    const lines: string[] = []
    for (const [index, item] of value.slice(0, 20).entries()) {
      const commonObjectLines = formatCommonObjectItem(item, index)
      if (commonObjectLines.length > 0 && indent === '') {
        lines.push(...commonObjectLines)
        lines.push('')
      } else if (item && typeof item === 'object') {
        lines.push(`${indent}-`)
        lines.push(...formatJsonValue(item, `${indent}  `))
      } else {
        lines.push(`${indent}- ${String(item)}`)
      }
    }
    return lines
  }

  const lines: string[] = []
  const orderedEntries = Object.entries(value)
    .filter(([, val]) => val !== undefined && val !== null && val !== '')
    .sort(([a], [b]) => {
      const priority = ['title', 'name', 'path', 'url', 'link', 'time', 'summary', 'description']
      return priority.indexOf(a) - priority.indexOf(b)
    })
  for (const [key, val] of orderedEntries.slice(0, 30)) {
    if (val && typeof val === 'object') {
      lines.push(`${indent}- **${key}**:`)
      lines.push(...formatJsonValue(val, `${indent}  `))
    } else {
      lines.push(`${indent}- **${key}**: ${String(val)}`)
    }
  }
  return lines
}

function formatJsonText(text: string): string {
  const parsed = tryParseJson(text)
  if (parsed === null) {
    return ''
  }
  return formatJsonValue(parsed).join('\n').trim()
}

function formatKeyValueText(text: string): string {
  const rawLines = String(text || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)

  if (rawLines.length === 0) {
    return ''
  }

  const kvLines = rawLines
    .slice(0, 40)
    .filter(line => /^[^:：]{1,40}[:：]\s*\S+/.test(line))

  if (kvLines.length < 2) {
    return ''
  }

  return kvLines
    .map(line => {
      const parts = line.split(/[:：]/)
      const key = parts.shift()?.trim()
      const value = parts.join(':').trim()
      return key && value ? `- **${key}**: ${value}` : ''
    })
    .filter(Boolean)
    .join('\n')
}

function formatMcpContent(toolName: string, text: string): string {
  const normalized = String(text || '').trim()
  if (!normalized) {
    return ''
  }

  const formattedTaggedFragments = formatTaggedFragments(normalized)
  if (formattedTaggedFragments) {
    return formattedTaggedFragments
  }

  if (/<(rss|feed|channel|item|entry)\b/i.test(normalized)) {
    return formatXmlFeed(normalized)
  }

  if (/trend|hot|rank|top|榜/i.test(toolName) || /热榜|热搜|趋势|排行/.test(normalized)) {
    return formatStructuredLines(normalized)
  }

  const formattedJson = formatJsonText(normalized)
  if (formattedJson) {
    return formattedJson
  }

  if (/^[A-Za-z]:\\/.test(normalized) || /^\/[^/\s]/.test(normalized)) {
    return normalized
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .slice(0, 30)
      .map((line, index) => `${index + 1}. \`${line}\``)
      .join('\n')
  }

  const formattedKv = formatKeyValueText(normalized)
  if (formattedKv) {
    return formattedKv
  }

  return normalized
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function summarizeMcpError(message: string): string {
  const raw = String(message || '').replace(/\s+/g, ' ').trim()
  if (!raw) {
    return '未知错误'
  }

  const fieldMatch = raw.match(/at "([^"]+)"/i)
  if (/validation error/i.test(raw)) {
    return `参数校验失败${fieldMatch?.[1] ? `：${fieldMatch[1]} 参数不合法` : ''}`
  }

  if (raw.length > 240) {
    return `${raw.slice(0, 240)}...`
  }

  return raw
}

class McpClientManager {
  private clients: Map<string, McpClientEntry> = new Map()
  private toolsCache: Map<string, McpToolInfo[]> = new Map()
  private statuses: Map<string, ServerStatus> = new Map()
  private errorMessages: Map<string, string> = new Map()

  // ─── 连接 MCP Server ──────────────────────────────────────
  async connect(config: McpServerConfig): Promise<void> {
    const normalizedConfig = normalizeMcpConfig(config)
    const { id, name, transport, command, args, env, url } = normalizedConfig

    if (this.clients.has(id)) {
      await this.disconnect(id)
    }

    this.statuses.set(id, 'connecting')
    log.info(`[MCP] Connecting to server: ${name} (${id}) via ${transport}`)

    try {
      let transportInstance: StdioClientTransport | SSEClientTransport

      if (transport === 'sse') {
        if (!url) throw new Error('SSE transport requires a URL')
        transportInstance = new SSEClientTransport(new URL(url))
      } else {
        if (!command) throw new Error('stdio transport requires a command')
        const SAFE_ENV_PREFIXES = ['PATH', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP', 'LANG', 'LC_ALL', 'NODE_OPTIONS', 'NPM_CONFIG_PREFIX', 'HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'NO_PROXY', 'no_proxy', 'PROGRAMFILES', 'SYSTEMROOT', 'WINDIR', 'PROCESSOR_ARCHITECTURE']
        const filteredEnv: Record<string, string> = {}
        for (const [key, value] of Object.entries(process.env)) {
          if (value !== undefined && SAFE_ENV_PREFIXES.some(prefix => key === prefix || key.startsWith(prefix + '_'))) {
            filteredEnv[key] = value
          }
        }
        const proxyEnv =
          filteredEnv.HTTP_PROXY || filteredEnv.HTTPS_PROXY || filteredEnv.http_proxy || filteredEnv.https_proxy
            ? {}
            : getWindowsProxyEnv()
        const mergedEnv = {
          ...filteredEnv,
          ...proxyEnv,
          ...(env || {}),
        } as Record<string, string>
        if ((mergedEnv.HTTP_PROXY || mergedEnv.HTTPS_PROXY || mergedEnv.http_proxy || mergedEnv.https_proxy) && isNodeRuntimeCommand(command)) {
          const bootstrapPath = ensureProxyBootstrapFile()
          mergedEnv.AURACOMMAND_UNDICI_REQUIRE_PATH = require.resolve('undici')
          mergedEnv.NODE_OPTIONS = appendNodeRequireOption(mergedEnv.NODE_OPTIONS, bootstrapPath)
        }
        transportInstance = new StdioClientTransport({
          command,
          args: (args || []).map(arg => interpolateEnvPlaceholders(arg, mergedEnv)),
          env: mergedEnv,
        })
      }

      const client = new Client(
        { name: 'auracommand', version: '1.0.0' },
        { capabilities: {} }
      )

      await client.connect(transportInstance)

      // 获取工具列表并动态注册到 toolRegistry
      const toolsResult = await client.listTools()
      const tools: McpToolInfo[] = (toolsResult.tools || []).map(tool => ({
        serverId: id,
        serverName: name,
        name: tool.name,
        qualifiedName: buildQualifiedMcpToolName(id, tool.name, name),
        description: tool.description || '',
        inputSchema: tool.inputSchema,
      }))
      this.toolsCache.set(id, tools)

      // 注册到统一工具注册表（Agent 和工作流可用）
      for (const tool of tools) {
        registerMcpTool(id, name, tool.name, tool.description, tool.inputSchema)
      }

      this.clients.set(id, { client, transport: transportInstance, transportType: transport })
      this.statuses.set(id, 'connected')
      this.errorMessages.delete(id)

      log.info(`[MCP] Connected to ${name}, found ${tools.length} tools, registered into toolRegistry`)
    } catch (err: any) {
      unregisterMcpTools(id)
      this.toolsCache.delete(id)
      this.clients.delete(id)
      this.statuses.set(id, 'error')
      const msg = err.message || String(err)
      this.errorMessages.set(id, msg)
      log.error(`[MCP] Failed to connect to ${name}:`, msg)

      try {
        const { BrowserWindow } = require('electron')
        const win = BrowserWindow.getAllWindows()[0]
        if (win && !win.isDestroyed()) {
          win.webContents.send('mcp-connect-failed', { id, name, error: msg })
        }
      } catch {}
      throw err
    }
  }

  // ─── 获取所有已连接 Server 的工具列表 ──────────────────────
  async getAllTools(): Promise<McpToolInfo[]> {
    const allTools: McpToolInfo[] = []
    for (const [, tools] of this.toolsCache) {
      allTools.push(...tools)
    }
    return allTools
  }

  // ─── 调用指定工具 ──────────────────────────────────────────
  async callTool(serverId: string, toolName: string, args: Record<string, any>): Promise<{ success: boolean; result: any; message: string }> {
    const entry = this.clients.get(serverId)
    if (!entry) {
      return { success: false, result: null, message: `MCP Server ${serverId} 未连接` }
    }

    const { client } = entry

    try {
      // 30 秒超时
      let timer: ReturnType<typeof setTimeout> | undefined
      const result = await Promise.race([
        client.callTool({ name: toolName, arguments: args }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('调用超时（30s）')), 30000)
        }),
      ])
      if (timer) clearTimeout(timer)

      // SDK 返回结构: { content: [...], isError?: boolean }
      const response = result as any
      if (response.isError) {
        const errorContent = (response.content || []).map((c: any) => c.text || '').join('')
        return { success: false, result: null, message: `工具执行错误: ${summarizeMcpError(errorContent || '未知错误')}` }
      }

      // 提取文本内容
      const rawContent = (response.content || []).map((c: any) => {
        if (c.type === 'text') return String(c.text || '')
        if (c.type === 'image') return '[图片]'
        if (c.type === 'resource') return String(c.resource?.text || '[资源]')
        return ''
      }).filter(Boolean).join('\n\n')
      const content = formatMcpContent(toolName, rawContent) || rawContent

      return {
        success: true,
        result: { content, raw: response.content },
        message: '工具执行完成',
      }
    } catch (err: any) {
      const message = err.message || String(err)
      log.error(`[MCP] callTool error (${serverId}/${toolName}):`, message)
      return { success: false, result: null, message: `工具调用失败: ${summarizeMcpError(message)}` }
    }
  }

  // ─── 断开指定 Server（三级优雅关闭）───────────────────────
  async disconnect(serverId: string): Promise<void> {
    const entry = this.clients.get(serverId)
    if (!entry) return

    unregisterMcpTools(serverId)

    const { client, transport, transportType } = entry
    const childProcess = transportType === 'stdio'
      ? (transport as any)._process as (import('child_process').ChildProcess | undefined)
      : undefined

    try {
      await transport.close()
    } catch (err: any) {
      log.warn(`[MCP] Level-1 close failed for ${serverId}:`, err.message || err)
    }

    if (transportType === 'stdio' && childProcess && !childProcess.killed) {
      try {
        childProcess.kill('SIGTERM')
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => resolve(), 2000)
          childProcess!.once('exit', () => { clearTimeout(timeout); resolve() })
        })
      } catch {}
    }

    if (transportType === 'stdio' && childProcess && !childProcess.killed) {
      try {
        childProcess.kill('SIGKILL')
        log.warn(`[MCP] Force-killed process for ${serverId}`)
      } catch {}
    }

    this.clients.delete(serverId)
    this.toolsCache.delete(serverId)
    this.statuses.set(serverId, 'disconnected')
    this.errorMessages.delete(serverId)
    log.info(`[MCP] Disconnected: ${serverId}`)
  }

  // ─── 断开所有（app quit 时调用）──────────────────────────
  async disconnectAll(): Promise<void> {
    const ids = Array.from(this.clients.keys())
    await Promise.allSettled(ids.map(id => this.disconnect(id)))
    log.info('[MCP] All servers disconnected')
  }

  // ─── 获取指定工具属于哪个 server ──────────────────────────
  findServerForTool(toolName: string): string | undefined {
    const matches: string[] = []
    for (const [serverId, tools] of this.toolsCache) {
      if (tools.some(t => t.name === toolName || t.qualifiedName === toolName)) {
        matches.push(serverId)
      }
    }
    if (matches.length === 1) return matches[0]
    if (matches.length > 1) {
      log.warn(`[MCP] Ambiguous tool name "${toolName}" matched ${matches.length} servers; require namespaced tool name`)
    }
    return undefined
  }

  // ─── 获取所有 server 状态 ─────────────────────────────────
  getStatuses(): Map<string, string> {
    const result = new Map<string, string>()
    for (const [id, status] of this.statuses) {
      const info: any = { status }
      const errMsg = this.errorMessages.get(id)
      if (errMsg) info.error = errMsg
      result.set(id, JSON.stringify(info))
    }
    return result
  }

  // ─── 自动连接所有 enabled 的 server（从 DB 读取配置）──────
  async autoConnect(): Promise<void> {
    setMcpToolExecutor(async (serverId, toolName, args) => {
      const response = await this.callTool(serverId, toolName, args)
      if (response.success) {
        return response.result || { message: response.message }
      }
      throw new Error(response.message || 'MCP tool call failed')
    })
    try {
      const rows = await dbHelper.allQuery(
        'SELECT id, name, transport, command, args, env, url, enabled, auto_connect FROM mcp_servers WHERE enabled = 1 AND auto_connect = 1'
      )

      if (!rows || rows.length === 0) {
        log.info('[MCP] No enabled MCP servers found')
        return
      }

      log.info(`[MCP] Auto-connecting ${rows.length} servers...`)

      for (const row of rows) {
        try {
          const config: McpServerConfig = {
            id: row.id,
            name: row.name,
            transport: row.transport || 'stdio',
            command: row.command,
            args: typeof row.args === 'string' ? JSON.parse(row.args) : (row.args || []),
            env: typeof row.env === 'string' ? JSON.parse(row.env) : (row.env || undefined),
            url: row.url,
            enabled: !!row.enabled,
            auto_connect: !!row.auto_connect,
          }
          await this.connect(config)
        } catch (err: any) {
          log.error(`[MCP] Auto-connect failed for ${row.name}:`, err.message || err)
        }
      }
    } catch (err: any) {
      log.error('[MCP] autoConnect error:', err.message || err)
    }
  }
}

// ─── 导出单例 ────────────────────────────────────────────────
export const mcpManager = new McpClientManager()
