/**
 * MCP Server 相关 IPC 处理器
 */
import { IpcModule, IpcContext } from './index'
import { McpServerConfig, mcpManager, normalizeMcpConfig } from '../mcpClient'
import dbHelper from '../db'
import {
  AddMcpServerSchema,
  UpdateMcpServerSchema,
  McpServerIdSchema,
  validateInput,
} from './schemas'
import {
  withErrorHandling,
  logInfo,
  logWarn,
  ErrorCategory,
  ErrorLevel,
  AppError,
} from '../errorHandler'

function rowToConfig(row: any): McpServerConfig {
  return normalizeMcpConfig({
    id: row.id,
    name: row.name,
    transport: row.transport || 'stdio',
    command: row.command,
    args: (() => { try { return typeof row.args === 'string' ? JSON.parse(row.args) : (row.args || []) } catch { return [] } })(),
    env: (() => { try { return typeof row.env === 'string' ? JSON.parse(row.env) : (row.env || undefined) } catch { return undefined } })(),
    url: row.url,
    enabled: !!row.enabled,
    auto_connect: row.auto_connect !== undefined ? !!row.auto_connect : true,
  })
}

async function normalizeStoredConfig(row: any): Promise<McpServerConfig> {
  const normalized = rowToConfig(row)
  const originalArgs = typeof row.args === 'string' ? row.args : JSON.stringify(row.args || [])
  const normalizedArgs = JSON.stringify(normalized.args || [])
  if (originalArgs !== normalizedArgs) {
    await dbHelper.runQuery('UPDATE mcp_servers SET args = ? WHERE id = ?', [normalizedArgs, row.id])
    logInfo('MCP server args normalized', { id: row.id, name: row.name })
  }
  return normalized
}

export function createMcpModule(ctx: IpcContext): IpcModule {
  const getWin = () => ctx.getWin()

  return {
    // 获取所有 MCP Server 配置
    'mcp-list-servers': async () => {
      return withErrorHandling(async () => {
        const rows = await dbHelper.allQuery('SELECT * FROM mcp_servers ORDER BY created_at')
        return Promise.all(rows.map(normalizeStoredConfig))
      }, 'mcp-list-servers')
    },

    // 添加 MCP Server 配置
    'mcp-add-server': async (_event: any, config: any) => {
      return withErrorHandling(async () => {
        const validated = normalizeMcpConfig(validateInput(AddMcpServerSchema, config, 'mcp-add-server') as McpServerConfig)
        const id = `mcp_${Date.now()}`
        const argsJson = JSON.stringify(validated.args)
        const envJson = JSON.stringify(validated.env || {})
        const autoConnect = validated.auto_connect ? 1 : 0
        await dbHelper.runQuery(
          'INSERT INTO mcp_servers (id, name, transport, command, args, env, url, enabled, auto_connect) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [id, validated.name, validated.transport, validated.command || null, argsJson, envJson, validated.url || null, validated.enabled ? 1 : 0, autoConnect]
        )
        logInfo('MCP server added', { id, name: validated.name })
        return { success: true, id }
      }, 'mcp-add-server', getWin())
    },

    // 更新 MCP Server 配置
    'mcp-update-server': async (_event: any, config: any) => {
      return withErrorHandling(async () => {
        const validated = normalizeMcpConfig(validateInput(UpdateMcpServerSchema, config, 'mcp-update-server') as McpServerConfig)
        const argsJson = JSON.stringify(validated.args)
        const envJson = JSON.stringify(validated.env || {})
        const autoConnect = validated.auto_connect ? 1 : 0
        await dbHelper.runQuery(
          'UPDATE mcp_servers SET name = ?, transport = ?, command = ?, args = ?, env = ?, url = ?, enabled = ?, auto_connect = ? WHERE id = ?',
          [validated.name, validated.transport, validated.command || null, argsJson, envJson, validated.url || null, validated.enabled ? 1 : 0, autoConnect, validated.id]
        )
        logInfo('MCP server updated', { id: validated.id })
        return { success: true }
      }, 'mcp-update-server', getWin())
    },

    // 删除 MCP Server 配置
    'mcp-delete-server': async (_event: any, id: string) => {
      return withErrorHandling(async () => {
        const validated = validateInput(McpServerIdSchema, { id }, 'mcp-delete-server')
        await mcpManager.disconnect(validated.id)
        await dbHelper.runQuery('DELETE FROM mcp_servers WHERE id = ?', [validated.id])
        logInfo('MCP server deleted', { id: validated.id })
        return { success: true }
      }, 'mcp-delete-server', getWin())
    },

    // 启动连接 MCP Server
    'mcp-connect': async (_event: any, id: string) => {
      return withErrorHandling(async () => {
        if (!id || typeof id !== 'string') {
          throw new AppError('无效的服务器 ID', ErrorCategory.VALIDATION, ErrorLevel.WARNING)
        }
        const row = await dbHelper.getQuery('SELECT * FROM mcp_servers WHERE id = ?', [id])
        if (!row) {
          throw new AppError('MCP 服务器不存在', ErrorCategory.VALIDATION, ErrorLevel.WARNING)
        }
        const config = await normalizeStoredConfig(row)
        await mcpManager.connect(config)
        const tools = (await mcpManager.getAllTools()).filter(t => t.serverId === id)
        logInfo('MCP server connected', { id, toolsCount: tools.length })
        return { success: true, tools }
      }, 'mcp-connect', getWin())
    },

    // 断开 MCP Server
    'mcp-disconnect': async (_event: any, id: string) => {
      return withErrorHandling(async () => {
        if (!id || typeof id !== 'string') {
          throw new AppError('无效的服务器 ID', ErrorCategory.VALIDATION, ErrorLevel.WARNING)
        }
        await mcpManager.disconnect(id)
        logInfo('MCP server disconnected', { id })
        return { success: true }
      }, 'mcp-disconnect', getWin())
    },

    // 获取所有 MCP Server 状态
    'mcp-get-statuses': async () => {
      return withErrorHandling(async () => {
        const statuses = mcpManager.getStatuses()
        const toolsMap = (await mcpManager.getAllTools()) || []
        const toolsByServer: Record<string, any[]> = {}
        for (const tool of toolsMap) {
          if (!tool || !tool.serverId) continue
          const sid = tool.serverId
          if (!toolsByServer[sid]) toolsByServer[sid] = []
          const arr = toolsByServer[sid]
          if (arr) arr.push({ name: tool.name || '', description: tool.description || '' })
        }
        const result: Record<string, any> = {}
        for (const [id, info] of statuses) {
          try {
            const parsed = JSON.parse(info)
            parsed.tools = toolsByServer[id] || []
            result[id] = parsed
          } catch {
            result[id] = { status: 'unknown', error: 'parse failed', tools: toolsByServer[id] || [] }
          }
        }
        return result
      }, 'mcp-get-statuses')
    },

    // 获取指定 MCP Server 的工具列表
    'mcp-list-tools': async (_event: any, id: string) => {
      return withErrorHandling(async () => {
        if (!id || typeof id !== 'string') {
          throw new AppError('无效的服务器 ID', ErrorCategory.VALIDATION, ErrorLevel.WARNING)
        }
        const allTools = await mcpManager.getAllTools()
        return allTools.filter(t => t.serverId === id)
      }, 'mcp-list-tools')
    },
  }
}
