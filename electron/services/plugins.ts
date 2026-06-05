/**
 * 插件系统
 * 加载、管理和执行插件工具
 */
import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import log from 'electron-log'
import * as modelRouter from '../modelRouter'

export interface PluginConfig {
  id: string
  name: string
  description: string
  version: string
  enabled: boolean
  tools?: { name: string; description: string; prompt_template: string }[]
  hooks?: { event: string; action: string }[]
}

let loadedPlugins: PluginConfig[] = []

export function loadPlugins(vaultPath?: string) {
  const pluginsDir = path.join(app.getPath('userData'), 'plugins')
  if (!fs.existsSync(pluginsDir)) {
    fs.mkdirSync(pluginsDir, { recursive: true })
    const samplePlugin: PluginConfig = {
      id: 'sample-quick-note',
      name: '快速记录插件',
      description: '通过AI快速记录想法到便签',
      version: '1.0.0',
      enabled: true,
      tools: [
        { name: 'quick_note', description: '快速记录一个想法到便签', prompt_template: '将以下内容整理为一条便签，标题简明扼要：{{input}}' }
      ]
    }
    fs.writeFileSync(path.join(pluginsDir, 'sample-plugin.json'), JSON.stringify(samplePlugin, null, 2))
  }

  try {
    const files = fs.readdirSync(pluginsDir).filter(f => f.endsWith('.json'))
    loadedPlugins = files.map(f => {
      try { return JSON.parse(fs.readFileSync(path.join(pluginsDir, f), 'utf-8')) }
      catch { return null }
    }).filter(Boolean) as PluginConfig[]
    log.info(`[Plugins] Loaded ${loadedPlugins.length} plugins`)
  } catch (err) {
    log.error('[Plugins] Failed to load:', err)
  }
}

export function getPlugins(): PluginConfig[] {
  return loadedPlugins
}

export function getPluginToolPrompt(): string {
  const pluginTools = loadedPlugins.filter(p => p.enabled).flatMap(p =>
    (p.tools || []).map(t => `### plugin_${p.id}_${t.name}\n${t.description}\n参数:\n    - input (string, 必填): 用户输入内容`)
  )
  return pluginTools.length > 0 ? '\n\n【插件工具】\n' + pluginTools.join('\n\n') : ''
}

export async function executePluginTool(fullToolName: string, args: any): Promise<{ success: boolean; result: any; message: string } | null> {
  const match = fullToolName.match(/^plugin_(.+?)_(.+)$/)
  if (!match) return null
  const [, pluginId, toolName] = match
  const plugin = loadedPlugins.find(p => p.id === pluginId && p.enabled)
  if (!plugin) return { success: false, result: null, message: `插件 ${pluginId} 未找到或未启用` }
  const tool = plugin.tools?.find(t => t.name === toolName)
  if (!tool) return { success: false, result: null, message: `工具 ${toolName} 未找到` }

  const prompt = tool.prompt_template.replace('{{input}}', args.input || '')
  const result = await modelRouter.chat({ messages: [{ role: 'user' as const, content: prompt }] })
  return { success: true, result: { output: result }, message: result.substring(0, 200) }
}

export function togglePlugin(pluginId: string, enabled: boolean) {
  const plugin = loadedPlugins.find(p => p.id === pluginId)
  if (!plugin) return { success: false, error: '插件未找到' }
  plugin.enabled = enabled
  const pluginsDir = path.join(app.getPath('userData'), 'plugins')
  const files = fs.readdirSync(pluginsDir).filter(f => f.endsWith('.json'))
  for (const f of files) {
    try {
      const content = JSON.parse(fs.readFileSync(path.join(pluginsDir, f), 'utf-8'))
      if (content.id === pluginId) {
        content.enabled = enabled
        fs.writeFileSync(path.join(pluginsDir, f), JSON.stringify(content, null, 2))
        break
      }
    } catch {}
  }
  return { success: true }
}