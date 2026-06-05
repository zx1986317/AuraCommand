import { useState, useCallback } from 'react'
import type { McpServerStatus } from '../types'
import { logger } from '../utils/logger'

export function useMcpServers() {
  const [servers, setServers] = useState<McpServerStatus[]>([])
  const [loading, setLoading] = useState(false)

  const loadServers = useCallback(async () => {
    setLoading(true)
    try {
      const configs: any[] = await window.ipcRenderer.invoke('mcp-list-servers')
      const statuses: Record<string, any> = await window.ipcRenderer.invoke('mcp-get-statuses')

      const merged: McpServerStatus[] = configs.map((cfg: any) => {
        const st = statuses[cfg.id]
        return {
          id: cfg.id,
          name: cfg.name,
          status: st?.status || 'disconnected',
          enabled: cfg.enabled,
          error: st?.error,
          transport: cfg.transport,
          command: cfg.command,
          args: cfg.args || [],
          env: cfg.env || {},
          url: cfg.url,
          auto_connect: cfg.auto_connect !== 0,
          tools: st?.tools || []
        }
      })
      setServers(merged)
    } catch (err) {
      logger.error('Failed to load MCP servers:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const addServer = useCallback(async (config: any) => {
    try {
      const result = await window.ipcRenderer.invoke('mcp-add-server', config)
      if (result.success) {
        // 添加后自动连接
        await window.ipcRenderer.invoke('mcp-connect', result.id)
        await loadServers()
      }
      return result
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }, [loadServers])

  const removeServer = useCallback(async (id: string) => {
    try {
      const result = await window.ipcRenderer.invoke('mcp-delete-server', id)
      if (result.success) {
        await loadServers()
      }
      return result
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }, [loadServers])

  const updateServer = useCallback(async (config: any) => {
    try {
      const result = await window.ipcRenderer.invoke('mcp-update-server', config)
      if (result.success) {
        await loadServers()
      }
      return result
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }, [loadServers])

  const toggleServer = useCallback(async (id: string, currentStatus: string) => {
    try {
      if (currentStatus === 'connected' || currentStatus === 'connecting') {
        await window.ipcRenderer.invoke('mcp-disconnect', id)
      } else {
        await window.ipcRenderer.invoke('mcp-connect', id)
      }
      await loadServers()
    } catch (err) {
      logger.error('Failed to toggle MCP server:', err)
    }
  }, [loadServers])

  const refreshStatuses = useCallback(async () => {
    await loadServers()
  }, [loadServers])

  return { servers, loading, loadServers, addServer, removeServer, updateServer, toggleServer, refreshStatuses }
}
