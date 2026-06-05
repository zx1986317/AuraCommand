import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Cable,
  Trash2,
  Edit3,
  ToggleLeft,
  ToggleRight,
  FolderOpen,
  Database,
  AlertCircle,
  X,
  Brain,
  Globe,
  Github,
  FileText,
  MessageSquare,
  Map,
  Search,
  BookOpen,
  Table2,
  Newspaper,
  Rss,
  Compass,
} from 'lucide-react';
import { useMcpServers } from '../../hooks/useMcpServers';
import { useAppStore } from '../../store/appStore';
import type { McpServerConfig, McpServerStatus } from '../../types';
import { McpServerModal } from '../McpServerModal';

interface McpTemplate {
  id: string
  name: string
  icon: React.ElementType
  desc: string
  group: 'data' | 'web' | 'development' | 'productivity' | 'ai-media'
  transport: 'stdio' | 'sse'
  command: string
  args: string[]
  env?: Record<string, string>
  tags: string[]
  installHint?: string
  installCommand?: string
  npm?: string
  popularity?: number
}

function normalizeEnvPath(input: string | undefined) {
  const base = (input || '.').trim() || '.'
  return base.replace(/\\/g, '/')
}

function buildMcpTemplates(vaultPath: string): McpTemplate[] {
  return [
    {
      id: 'filesystem',
      name: '文件系统',
      icon: FolderOpen,
      desc: 'AI 可直接读写本地文件，支持搜索/创建/编辑',
      group: 'data',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem'],
      env: {},
      tags: ['文件', '搜索', '编辑'],
      npm: '@modelcontextprotocol/server-filesystem',
      popularity: 95,
    },
    {
      id: 'memory',
      name: '跨会话记忆',
      icon: Database,
      desc: 'AI 可以记住跨会话的上下文信息，实现长期记忆',
      group: 'data',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-memory'],
      env: {},
      tags: ['记忆', '持久化'],
      npm: '@modelcontextprotocol/server-memory',
      popularity: 90,
    },
    {
      id: 'sequential-thinking',
      name: 'Sequential Thinking',
      icon: Brain,
      desc: '让 AI 具备分步推理能力，适合处理复杂问题和多步骤任务',
      group: 'data',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
      env: {},
      tags: ['推理', '复杂任务', '分步思考'],
      npm: '@modelcontextprotocol/server-sequential-thinking',
      popularity: 88,
    },
    {
      id: 'sqlite',
      name: 'SQLite 数据库',
      icon: Table2,
      desc: '让 AI 直接查询和操作 SQLite 数据库，支持读写和 Schema 分析',
      group: 'data',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-sqlite', '--db-path', './data.db'],
      env: {},
      tags: ['数据库', 'SQL', '查询'],
      npm: '@modelcontextprotocol/server-sqlite',
      popularity: 82,
    },
    {
      id: 'trends-hub',
      name: '热榜聚合',
      icon: Newspaper,
      desc: '聚合各平台热榜数据，AI 可获取热门话题',
      group: 'web',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', 'mcp-trends-hub@1.6.2'],
      env: {},
      tags: ['热榜', '新闻'],
      npm: 'mcp-trends-hub',
      popularity: 85,
    },
    {
      id: 'playwright',
      name: 'Playwright 浏览器',
      icon: Globe,
      desc: '浏览器自动化能力，支持网页截图、表单填写、数据提取和复杂网页交互',
      group: 'web',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@executeautomation/playwright-mcp-server'],
      env: {},
      tags: ['浏览器', '自动化', '截图'],
      installHint: 'Playwright 需要安装 Chromium 浏览器才能运行（约 300MB），是否现在安装？',
      installCommand: 'install-playwright-browser',
      npm: '@executeautomation/playwright-mcp-server',
      popularity: 92,
    },
    {
      id: 'fetch',
      name: 'Fetch 网页抓取',
      icon: Compass,
      desc: '轻量级网页内容抓取工具，将网页转为 Markdown 格式供 AI 阅读',
      group: 'web',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-fetch'],
      env: {},
      tags: ['网页', '抓取', 'Markdown'],
      npm: '@modelcontextprotocol/server-fetch',
      popularity: 87,
    },
    {
      id: 'brave-search',
      name: 'Brave 搜索',
      icon: Search,
      desc: '使用 Brave Search API 进行联网搜索，需要 API Key',
      group: 'web',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-brave-search'],
      env: { BRAVE_API_KEY: '' },
      tags: ['搜索', '联网', 'API'],
      npm: '@modelcontextprotocol/server-brave-search',
      popularity: 80,
    },
    {
      id: 'github',
      name: 'GitHub',
      icon: Github,
      desc: 'GitHub 仓库管理、Issue/PR 操作、代码搜索，需要 Personal Access Token',
      group: 'development',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      env: { GITHUB_PERSONAL_ACCESS_TOKEN: '' },
      tags: ['GitHub', '代码', 'PR', 'Issue'],
      npm: '@modelcontextprotocol/server-github',
      popularity: 89,
    },
    {
      id: 'gitlab',
      name: 'GitLab',
      icon: Github,
      desc: 'GitLab 项目管理、MR/Issue 操作、仓库浏览，需要 Access Token',
      group: 'development',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-gitlab'],
      env: { GITLAB_PERSONAL_ACCESS_TOKEN: '' },
      tags: ['GitLab', '代码', 'MR'],
      npm: '@modelcontextprotocol/server-gitlab',
      popularity: 75,
    },
    {
      id: 'jina-reader',
      name: 'Jina Reader',
      icon: BookOpen,
      desc: '将任意 URL 转为 LLM 友好的文本格式，支持搜索和网页阅读',
      group: 'web',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', 'jina-mcp-tools@latest'],
      env: {},
      tags: ['阅读', '网页', '搜索', 'Jina'],
      npm: 'jina-mcp-tools',
      popularity: 83,
    },
    {
      id: 'notion',
      name: 'Notion',
      icon: FileText,
      desc: '读写 Notion 页面和数据库，支持搜索、创建、更新内容',
      group: 'productivity',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@anthropic/mcp-server-notion'],
      env: { NOTION_API_KEY: '' },
      tags: ['Notion', '笔记', '文档'],
      npm: '@anthropic/mcp-server-notion',
      popularity: 78,
    },
    {
      id: 'slack',
      name: 'Slack',
      icon: MessageSquare,
      desc: 'Slack 消息读取和发送，支持频道管理和搜索',
      group: 'productivity',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@anthropic/mcp-server-slack'],
      env: { SLACK_BOT_TOKEN: '', SLACK_TEAM_ID: '' },
      tags: ['Slack', '消息', '协作'],
      npm: '@anthropic/mcp-server-slack',
      popularity: 72,
    },
    {
      id: 'google-maps',
      name: 'Google Maps',
      icon: Map,
      desc: '地理编码、地点搜索、路线规划，需要 Google Maps API Key',
      group: 'web',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-google-maps'],
      env: { GOOGLE_MAPS_API_KEY: '' },
      tags: ['地图', '导航', '地点'],
      npm: '@modelcontextprotocol/server-google-maps',
      popularity: 70,
    },
    {
      id: 'everything',
      name: 'Everything 搜索',
      icon: Search,
      desc: '使用 Everything 搜索本地文件，极速全文检索',
      group: 'data',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-everything'],
      env: {},
      tags: ['搜索', '文件', '本地'],
      npm: '@modelcontextprotocol/server-everything',
      popularity: 76,
    },
    {
      id: 'pptx',
      name: 'PPT 生成',
      icon: FileText,
      desc: 'AI 自动生成 PowerPoint 演示文稿，支持模板和图表',
      group: 'productivity',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@anthropic/mcp-server-pptx'],
      env: {},
      tags: ['PPT', '演示', '文档'],
      npm: '@anthropic/mcp-server-pptx',
      popularity: 68,
    },
    {
      id: 'excel',
      name: 'Excel 操作',
      icon: Table2,
      desc: '读写 Excel 文件，支持公式计算、图表生成和数据分析',
      group: 'productivity',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@anthropic/mcp-server-xlsx'],
      env: {},
      tags: ['Excel', '表格', '数据'],
      npm: '@anthropic/mcp-server-xlsx',
      popularity: 77,
    },
    {
      id: 'firecrawl',
      name: 'Firecrawl 爬虫',
      icon: Rss,
      desc: '高级网页爬取和内容提取，支持 JavaScript 渲染和批量抓取',
      group: 'web',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', 'firecrawl-mcp'],
      env: { FIRECRAWL_API_KEY: '' },
      tags: ['爬虫', '网页', '抓取'],
      npm: 'firecrawl-mcp',
      popularity: 79,
    },
  ]
}

const STATUS_COLORS: Record<string, string> = {
  connected: 'bg-green-500',
  disconnected: 'bg-gray-400',
  error: 'bg-red-500',
}

const TEMPLATE_GROUPS = [
  { id: 'web', title: '联网能力', desc: '网页访问、搜索和内容聚合' },
  { id: 'data', title: '数据与记忆', desc: '文件访问、本地知识和长期记忆' },
  { id: 'development', title: '开发协作', desc: '面向代码仓库和工程操作的工具' },
  { id: 'productivity', title: '效率办公', desc: '文档、表格、协作和演示工具' },
]

function getServerTargetSummary(server: McpServerStatus) {
  if (server.transport === 'sse') {
    return server.url || '未配置 SSE 地址'
  }
  const args = server.args || []
  const remoteIndex = args.findIndex(arg => arg === 'mcp-remote')
  if (remoteIndex >= 0) {
    const remoteUrl = args[remoteIndex + 1]
    if (remoteUrl) {
      return `${server.command || 'npx'} mcp-remote ${remoteUrl}`
    }
  }
  const commandParts = [server.command, ...(server.args || []).slice(0, 2)].filter(Boolean)
  if (commandParts.length === 0) {
    return '未配置启动命令'
  }
  return commandParts.join(' ')
}

const McpTab: React.FC<{ vaultPath: string }> = ({ vaultPath }) => {
  const { servers, loading, loadServers, addServer, removeServer, updateServer, toggleServer } = useMcpServers()
  const setNotification = useAppStore(state => state.setNotification)
  const [showModal, setShowModal] = useState(false)
  const [editingServer, setEditingServer] = useState<McpServerConfig | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [toolSearchQueries, setToolSearchQueries] = useState<Record<string, string>>({})
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [marketSearch, setMarketSearch] = useState('')
  const templates = React.useMemo(() => buildMcpTemplates(vaultPath), [vaultPath])
  const defaultMcpConfig = React.useMemo(() => templates.find(t => t.id === 'trends-hub')!, [templates])
  const hasDefaultServer = servers.some(server => server.name === defaultMcpConfig.name)

  useEffect(() => {
    loadServers()
    const interval = setInterval(loadServers, 10000)

    const handleMcpConnectFailed = (_event: any, data: { id: string; name: string; error: string }) => {
      setNotification({
        message: `MCP Server「${data.name}」连接失败，该工具暂不可用`,
        type: 'warning',
      })
      setTimeout(() => setNotification(null), 5000)
    }
    window.ipcRenderer.on('mcp-connect-failed', handleMcpConnectFailed)

    return () => {
      clearInterval(interval)
      window.ipcRenderer.off('mcp-connect-failed', handleMcpConnectFailed)
    }
  }, [])

  const handleOpenAdd = () => {
    setEditingServer(null)
    setShowModal(true)
  }

  const handleOpenEdit = (server: McpServerStatus) => {
    const config: McpServerConfig = {
      id: server.id,
      name: server.name,
      transport: server.transport || 'stdio',
      auto_connect: server.auto_connect !== false,
      ...(server.command ? { command: server.command } : {}),
      ...(server.args ? { args: server.args } : {}),
      ...(server.env ? { env: server.env } : {}),
      ...(server.url ? { url: server.url } : {}),
    }
    setEditingServer(config)
    setShowModal(true)
  }

  const handleSave = async (server: McpServerConfig): Promise<{ success: boolean; error?: string }> => {
    if (server.id) {
      const result = await updateServer({
        id: server.id,
        name: server.name,
        transport: server.transport,
        command: server.command || '',
        args: server.args || [],
        env: server.env || {},
        url: server.url || '',
        enabled: true,
        auto_connect: server.auto_connect,
      })
      if (result?.success) {
        setNotification({ message: '配置已保存，请断开后重新连接使新配置生效', type: 'info' })
      }
      return { success: result?.success ?? false, error: result?.error }
    } else {
      return await addServer({
        name: server.name,
        transport: server.transport,
        command: server.command || '',
        args: server.args || [],
        env: server.env || {},
        url: server.url || '',
        enabled: true,
        auto_connect: server.auto_connect,
      })
    }
  }

  const handleClose = () => {
    setShowModal(false)
    setEditingServer(null)
  }

  const handleAddPreset = async () => {
    if (hasDefaultServer) return
    await addServer({
      name: defaultMcpConfig.name,
      transport: defaultMcpConfig.transport,
      command: defaultMcpConfig.command,
      args: defaultMcpConfig.args,
      env: defaultMcpConfig.env || {},
      url: '',
      enabled: true,
      auto_connect: true,
    })
  }

  const handleDelete = async (id: string) => {
    await removeServer(id)
    setDeleteConfirmId(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold text-muted uppercase tracking-widest">MCP Server 管理</h3>
        <div className="flex gap-2">
          <button
            onClick={handleAddPreset}
            disabled={hasDefaultServer}
            className={`px-3 py-1.5 rounded-xl text-2xs font-bold transition-all ${
              hasDefaultServer
                ? 'bg-gray-100 text-muted/60 cursor-not-allowed'
                : 'bg-accent/10 text-accent hover:bg-accent/20'
            }`}
          >
            {hasDefaultServer ? '已添加 trends-hub 示例' : '+ 添加 trends-hub 示例'}
          </button>
          <button
            onClick={handleOpenAdd}
            className="px-3 py-1.5 bg-accent text-white rounded-xl text-2xs font-bold hover:bg-accent/90 transition-all"
          >
            + 添加 Server
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold text-muted uppercase tracking-widest">MCP 市场</h3>
          <span className="text-2xs text-muted/50">{templates.length} 个可用服务</span>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted/50" />
          <input
            type="text"
            value={marketSearch}
            onChange={e => setMarketSearch(e.target.value)}
            placeholder="搜索 MCP Server（名称、功能、标签）..."
            className="w-full bg-teal-900/5 rounded-xl pl-9 pr-3 py-2.5 text-xs outline-none focus:ring-2 focus:ring-accent/20 placeholder:text-muted/40"
          />
          {marketSearch && (
            <button
              onClick={() => setMarketSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-muted/10 flex items-center justify-center hover:bg-muted/20"
            >
              <X size={10} className="text-muted" />
            </button>
          )}
        </div>
      </div>

      <TemplateGrid servers={servers} templates={templates} onQuickAdd={addServer} searchQuery={marketSearch} />

      {loading ? (
        <div className="flex items-center justify-center p-8 bg-teal-900/5 rounded-[2rem] border border-teal-900/5">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : servers.length === 0 ? (
        <div className="text-center py-4">
          <div className="w-16 h-16 rounded-2xl bg-accent/5 flex items-center justify-center mx-auto mb-4">
            <Cable size={28} className="text-accent/30" />
          </div>
          <p className="text-sm font-bold text-muted mb-2">暂无 MCP Server</p>
          <p className="text-xs text-muted/60">从上方模板快速添加，或手动配置</p>
        </div>
      ) : (
        <div className="space-y-3">
          {servers.map(server => (
            <ServerCard
              key={server.id}
              server={server}
              isExpanded={expandedId === server.id}
              onToggleExpand={() => setExpandedId(expandedId === server.id ? null : server.id)}
              onEdit={() => handleOpenEdit(server)}
              onDelete={() => setDeleteConfirmId(server.id)}
              onToggleConnect={() => toggleServer(server.id, server.status)}
              toolSearchQuery={toolSearchQueries[server.id] || ''}
              onToolSearchChange={q => setToolSearchQueries(prev => ({ ...prev, [server.id]: q }))}
              onDisconnect={() => toggleServer(server.id, server.status)}
            />
          ))}
        </div>
      )}

      <AnimatePresence>
        {deleteConfirmId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/30 backdrop-blur-sm"
              onClick={() => setDeleteConfirmId(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-white/95 backdrop-blur-2xl border border-teal-900/10 rounded-[2rem] shadow-[0_40px_80px_rgba(0,0,0,0.15)] p-6"
            >
              <h3 className="text-base font-bold mb-2">确认删除</h3>
              <p className="text-sm text-muted mb-6">确定要删除此 MCP Server 吗？此操作不可撤销。</p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="px-4 py-2 text-xs font-bold text-muted hover:text-foreground transition-all"
                >
                  取消
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirmId)}
                  className="px-4 py-2 text-xs font-bold bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all"
                >
                  删除
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <McpServerModal
        isOpen={showModal}
        editingServer={editingServer}
        onClose={handleClose}
        onSave={handleSave}
        onNotification={() => {}}
      />
    </div>
  )
}

function TemplateGrid({ servers, templates, onQuickAdd, searchQuery }: { servers: McpServerStatus[]; templates: McpTemplate[]; onQuickAdd: (server: Partial<McpServerConfig>) => Promise<{ success: boolean; error?: string }>; searchQuery?: string }) {
  const [installingId, setInstallingId] = useState<string | null>(null)

  const filteredTemplates = React.useMemo(() => {
    if (!searchQuery?.trim()) return templates
    const q = searchQuery.toLowerCase()
    return templates.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.desc.toLowerCase().includes(q) ||
      t.tags.some(tag => tag.toLowerCase().includes(q)) ||
      (t.npm && t.npm.toLowerCase().includes(q))
    )
  }, [templates, searchQuery])

  const handleClick = async (tpl: McpTemplate) => {
    if (tpl.installCommand && !installingId) {
      const shouldInstall = confirm(tpl.installHint!)
      if (!shouldInstall) return
      setInstallingId(tpl.id)
      try {
        const result = await window.ipcRenderer.invoke(tpl.installCommand)
        if (!result?.success) {
          alert('安装失败：' + (result?.error || '未知错误'))
          setInstallingId(null)
          return
        }
      } catch (err: any) {
        alert('安装失败：' + (err?.message || '未知错误'))
        setInstallingId(null)
        return
      }
      setInstallingId(null)
    }
    onQuickAdd({
      name: tpl.name,
      transport: tpl.transport,
      command: tpl.command,
      args: tpl.args,
      env: tpl.env || {},
      url: '',
      enabled: true,
      auto_connect: true,
    })
  }

  if (filteredTemplates.length === 0 && searchQuery) {
    return (
      <div className="text-center py-6">
        <Search size={24} className="text-muted/30 mx-auto mb-2" />
        <p className="text-xs text-muted">未找到匹配的 MCP Server</p>
        <p className="text-2xs text-muted/50 mt-1">尝试其他关键词</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {TEMPLATE_GROUPS.map(group => {
        const groupTemplates = filteredTemplates.filter(t => t.group === group.id)
        if (groupTemplates.length === 0) return null
        const available = groupTemplates.filter(t => !servers.some(s => s.name === t.name))
        if (available.length === 0) return null
        return (
          <div key={group.id}>
            <div className="flex items-center gap-2 mb-2">
              <p className="text-xs font-bold text-muted uppercase tracking-widest">{group.title}</p>
              <span className="text-2xs text-muted/50">{group.desc}</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {available.map(tpl => {
                const Icon = tpl.icon
                const needsApiKey = tpl.env && Object.values(tpl.env).some(v => v === '')
                return (
                  <button
                    key={tpl.id}
                    onClick={() => handleClick(tpl)}
                    disabled={installingId === tpl.id}
                    title={`${tpl.desc}${tpl.npm ? `\nnpm: ${tpl.npm}` : ''}${needsApiKey ? '\n⚠ 需要配置 API Key' : ''}`}
                    className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-teal-900/10 hover:border-accent/30 hover:bg-accent/5 transition-all shrink-0 group disabled:opacity-50 relative"
                  >
                    <Icon size={14} className="text-accent shrink-0" />
                    <span className="text-xs font-medium text-foreground">
                      {installingId === tpl.id ? '安装中...' : tpl.name}
                    </span>
                    {needsApiKey && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="需要 API Key" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ServerCard({
  server,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onToggleConnect,
  toolSearchQuery,
  onToolSearchChange,
  onDisconnect,
}: {
  server: McpServerStatus
  isExpanded: boolean
  onToggleExpand: () => void
  onEdit: () => void
  onDelete: () => void
  onToggleConnect: () => void
  toolSearchQuery: string
  onToolSearchChange: (q: string) => void
  onDisconnect: () => void
}) {
  const statusColor = STATUS_COLORS[server.status] || 'bg-gray-400'
  const isConnected = server.status === 'connected'
  const isError = server.status === 'error'
  const tools = server.tools || []
  const filteredTools = toolSearchQuery
    ? tools.filter(t => t.name.toLowerCase().includes(toolSearchQuery.toLowerCase()) || (t.description || '').toLowerCase().includes(toolSearchQuery.toLowerCase()))
    : tools
  const displayTools = isExpanded ? filteredTools : filteredTools.slice(0, 6)
  const hasMoreTools = !isExpanded && tools.length > 6

  return (
    <motion.div
      layout
      className="bg-white rounded-2xl border border-teal-900/10 overflow-hidden"
    >
      <div className="flex items-center gap-3 p-4">
        <div className={`w-2 h-2 rounded-full shrink-0 ${statusColor}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-foreground truncate">{server.name}</p>
            {isConnected && (
              <span className="px-1.5 py-0.5 bg-green-500/10 text-green-600 text-2xs font-bold rounded shrink-0">已连接</span>
            )}
            {isError && (
              <span className="px-1.5 py-0.5 bg-red-500/10 text-red-600 text-2xs font-bold rounded shrink-0">错误</span>
            )}
          </div>
          <p className="text-2xs text-muted mt-0.5 truncate">{getServerTargetSummary(server)}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onEdit}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-muted hover:text-foreground hover:bg-black/5 transition-all"
            title="编辑"
          >
            <Edit3 size={14} />
          </button>
          <button
            onClick={onDelete}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-muted hover:text-red-500 hover:bg-red-50 transition-all"
            title="删除"
          >
            <Trash2 size={14} />
          </button>
          {isConnected ? (
            <button
              onClick={onDisconnect}
              className="px-3 py-1.5 rounded-xl text-2xs font-bold text-red-500 hover:bg-red-50 transition-all"
            >
              断开
            </button>
          ) : (
            <button
              onClick={onToggleConnect}
              disabled={isError}
              className="px-3 py-1.5 bg-accent text-white rounded-xl text-2xs font-bold hover:bg-accent/90 transition-all disabled:opacity-50"
            >
              连接
            </button>
          )}
          {tools.length > 0 && (
            <button
              onClick={onToggleExpand}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-muted hover:text-foreground hover:bg-black/5 transition-all"
              title={isExpanded ? '收起' : '查看工具'}
            >
              {isExpanded ? <ToggleUp size={14} /> : <ToggleDown size={14} />}
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden border-t border-teal-900/5"
          >
            <div className="p-4 space-y-3">
              <div className="relative">
                <input
                  type="text"
                  value={toolSearchQuery}
                  onChange={e => onToolSearchChange(e.target.value)}
                  placeholder="搜索工具..."
                  className="w-full bg-teal-900/5 rounded-xl pl-8 pr-3 py-2 text-xs outline-none focus:ring-2 focus:ring-accent/20"
                />
                <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" size={14} />
              </div>
              <div className="flex items-center gap-2">
                <p className="text-2xs text-muted">{filteredTools.length}/{tools.length} 个工具</p>
              </div>
              <div className="space-y-2">
                {displayTools.map(tool => (
                  <div key={tool.name} className="bg-teal-900/5 rounded-xl p-3">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono font-bold text-foreground">{tool.name}</p>
                        {tool.description && (
                          <p className="text-2xs text-muted mt-1 line-clamp-2">{tool.description}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {hasMoreTools && (
                  <button
                    onClick={onToggleExpand}
                    className="w-full py-2 text-xs text-accent font-bold hover:bg-accent/5 rounded-xl transition-all"
                  >
                    展开全部 {tools.length} 个工具
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function SearchIcon({ className, size }: { className?: string; size?: number }) {
  return (
    <svg className={className} width={size || 16} height={size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"></circle>
      <path d="m21 21-4.35-4.35"></path>
    </svg>
  )
}

function ToggleDown({ size }: { size?: number }) {
  return (
    <svg width={size || 16} height={size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6"/>
    </svg>
  )
}

function ToggleUp({ size }: { size?: number }) {
  return (
    <svg width={size || 16} height={size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m18 15-6-6-6 6"/>
    </svg>
  )
}

export default McpTab
