/**
 * 工作流执行引擎
 * 处理各种工作流动作类型的执行逻辑
 */
import { BrowserWindow } from 'electron'
import log from 'electron-log'

function safeParseJSON(raw: any): any {
  if (!raw) return {}
  if (typeof raw === 'object') return raw
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed === 'string') return JSON.parse(parsed)
    return parsed
  } catch { return {} }
}
import { v4 as uuidv4 } from 'uuid'
import dbHelper from '../db'
import * as modelRouter from '../modelRouter'
import { resolvePreferredModel } from '../modelPreference'
import { searchSearxng, searchWeb, fetchAndExtractPages, selectRelevantUrls } from '../searxng';
import type { SearchProviderConfig } from '../searxng';

type WorkflowNodeLogStatus = 'success' | 'error' | 'skipped'

const resolveWorkflowWindow = (win?: BrowserWindow | null) => {
  if (win && !win.isDestroyed()) return win
  const fallback = BrowserWindow.getAllWindows()[0]
  if (fallback && !fallback.isDestroyed()) return fallback
  return null
}

const getWorkflowNodeType = (actionType: string): 'llm' | 'tool' | 'condition' | 'start' | 'end' => {
  if (actionType === 'condition') return 'condition'
  if (actionType === 'custom_prompt' || actionType === 'summarize_memos' || actionType === 'daily_report') return 'llm'
  return 'tool'
}

export async function executeWorkflowInternal(
  workflowOrId: any,
  steps?: any[],
  options?: { vaultPath?: string; win?: BrowserWindow | null; manualTrigger?: boolean; stepContext?: any; model?: string | undefined }
): Promise<{ success: boolean; result?: string; error?: string; logId?: string }> {
  let workflowId: string
  let workflow: any
  let effectiveSteps: any[] | undefined = steps
  const effectiveModel = await resolvePreferredModel(options?.model)

  if (typeof workflowOrId === 'string') {
    workflowId = workflowOrId
    workflow = await dbHelper.getQuery('SELECT * FROM agent_workflows WHERE id = ?', [workflowId])
    if (!workflow) return { success: false, error: '工作流不存在' }
  } else {
    workflow = workflowOrId
    workflowId = workflow.id
  }
  try {
    let result = ''
    const templateVars: Record<string, string> = {
      '{{today}}': new Date().toLocaleDateString('zh-CN'),
      '{{now}}': new Date().toLocaleString('zh-CN'),
      '{{weekday}}': (['日','一','二','三','四','五','六'] as const)[new Date().getDay()] || '日',
      '{{timestamp}}': new Date().toISOString(),
    }
    const resolveVariables = (text: string): string => {
      let resolved = text
      for (const [key, val] of Object.entries(templateVars)) {
        resolved = resolved.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), val)
      }
      return resolved
    }

    const emitWorkflowEvent = (channel: string, payload: any) => {
      const targetWin = resolveWorkflowWindow(options?.win)
      if (targetWin) {
        targetWin.webContents.send(channel, payload)
      }
    }

    const runWorkflowNode = async <T>(
      node: { nodeId: string; nodeName: string; nodeType: 'llm' | 'tool' | 'condition' | 'start' | 'end'; input?: any },
      executor: () => Promise<T>
    ) => {
      emitWorkflowEvent('workflow-node-start', { workflowId, nodeId: node.nodeId })
      const startedAt = Date.now()
      try {
        const output = await executor()
        const duration = Date.now() - startedAt
        emitWorkflowEvent('workflow-run-log', {
          workflowId,
          log: {
            nodeId: node.nodeId,
            nodeName: node.nodeName,
            nodeType: node.nodeType,
            input: node.input ?? null,
            output,
            status: 'success' as WorkflowNodeLogStatus,
            timestamp: new Date().toISOString(),
            duration,
          }
        })
        emitWorkflowEvent('workflow-node-complete', { workflowId, nodeId: node.nodeId, output })
        return output
      } catch (err: any) {
        const output = { error: err?.message || 'Unknown workflow error' }
        const duration = Date.now() - startedAt
        emitWorkflowEvent('workflow-run-log', {
          workflowId,
          log: {
            nodeId: node.nodeId,
            nodeName: node.nodeName,
            nodeType: node.nodeType,
            input: node.input ?? null,
            output,
            status: 'error' as WorkflowNodeLogStatus,
            timestamp: new Date().toISOString(),
            duration,
          }
        })
        emitWorkflowEvent('workflow-node-complete', { workflowId, nodeId: node.nodeId, output })
        throw err
      }
    }

    // 当传入了 steps 数组（来自 workflows 表），按步骤迭代执行
    if (effectiveSteps && effectiveSteps.length > 0) {
      const stepResults: string[] = []
      let context = options?.stepContext ? JSON.stringify(options.stepContext) : ''
      for (const [index, step] of effectiveSteps.entries()) {
        const stepConfig = safeParseJSON(step.params)
        const stepNode = {
          nodeId: step.id || `step-${index + 1}`,
          nodeName: step.name || step.action_type || `步骤 ${index + 1}`,
          nodeType: getWorkflowNodeType(step.action_type || ''),
          input: stepConfig,
        }
        const stepResult = await runWorkflowNode(stepNode, async () => {
          if (step.action_type === 'custom_prompt' || step.action_type === 'summarize_memos') {
            const prompt = resolveVariables((stepConfig.prompt || stepConfig.query || '') + (context ? `\n\n前序步骤输出：\n${context}` : ''))
            return modelRouter.chat({ model: effectiveModel, messages: [{ role: 'user' as const, content: prompt }] })
          }
          if (step.action_type === 'search_knowledge') {
            const query = resolveVariables(stepConfig.query || context.substring(0, 100) || '最新内容')
            const ftsQuery = dbHelper.escapeFts5Query(query)
            const foundNotes = await dbHelper.allQuery('SELECT n.id, n.title, n.content FROM notes n JOIN notes_fts fts ON n.rowid = fts.rowid WHERE notes_fts MATCH ? LIMIT 5', [ftsQuery])
            return foundNotes.map((m: any) => `- ${m.title}: ${m.content?.substring(0, 200)}`).join('\n') || '未找到相关内容'
          }
          if (step.action_type === 'search_web') {
            const storedSearxngUrl = await dbHelper.getSetting('searxngUrl')
            const searxngUrl = stepConfig.searxng_url || storedSearxngUrl
            if (!searxngUrl) return '⚠️ 未配置 SearXNG 服务地址'
            const results = await searchSearxng(stepConfig.query || '最新资讯', searxngUrl, stepConfig.max_results || 5, stepConfig.time_range || 'day')
            return results.map((r: any, i: number) => `${i+1}. 【${r.title}】\n   ${r.content}\n   ${r.url}`).join('\n') || '无结果'
          }
          if (step.action_type === 'save_to_memo') {
            const title = resolveVariables(stepConfig.memo_title || `工作流结果：${new Date().toLocaleDateString('zh-CN')}`)
            const memoId = uuidv4()
            const contentToSave = context || stepConfig.content || ''
            const category = stepConfig.memo_category || '工作流'
            const now = new Date().toISOString()
            try {
              await dbHelper.runQuery('INSERT INTO notes (id, type, title, content, category, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [memoId, 'quick_note', title, contentToSave, category, JSON.stringify(stepConfig.memo_tags || ['工作流']), now, now])
              log.info(`[Workflow] Saved note: "${title}" (${memoId})`)
            } catch (noteErr) {
              log.error('[Workflow] Failed to save note:', noteErr)
              throw noteErr
            }
            emitWorkflowEvent('memo-created-by-workflow', { id: memoId, title, category })
            return `已保存为便签: "${title}" (ID: ${memoId})`
          }
          if (step.action_type === 'extract_todos') {
            return modelRouter.chat({ model: effectiveModel, messages: [{ role: 'user' as const, content: resolveVariables(`从以下内容中提取待办事项：\n${context || '暂无内容'}`) }] })
          }
          if (step.action_type === 'auto_tag_memos') {
            return '自动标签功能已执行'
          }
          if (step.action_type === 'daily_report') {
            const today = new Date().toISOString().split('T')[0]
            const dailyNotes = await dbHelper.allQuery('SELECT * FROM notes WHERE type = ? AND created_at >= ?', ['quick_note', today])
            const schedules = await dbHelper.allQuery('SELECT * FROM schedules WHERE start_time >= ?', [today])
            const content = `便签：${dailyNotes.map((m: any) => `- ${m.title}`).join('\n')}\n日程：${schedules.map((s: any) => `- ${s.title} (${s.status})`).join('\n')}`
            return modelRouter.chat({ model: effectiveModel, messages: [{ role: 'user' as const, content: resolveVariables(`生成今日工作日报：\n${content || '暂无数据'}`) }] })
          }
          return `未知步骤类型: ${step.action_type}`
        })
        context = stepResult
        stepResults.push(`【${step.name || step.action_type}】\n${stepResult}`)
      }
      result = stepResults.join('\n\n---\n\n')
    } else {
      // 原有的 agent_workflows 执行逻辑
      const config = safeParseJSON(workflow.action_config)
      const singleNode = {
        nodeId: workflow.action_type || workflow.id || 'workflow',
        nodeName: workflow.name || workflow.action_type || '工作流',
        nodeType: getWorkflowNodeType(workflow.action_type || ''),
        input: config,
      }
      if (workflow.action_type === 'summarize_memos') {
        result = await runWorkflowNode(singleNode, async () => {
          const days = config.days || 1
          const since = new Date(Date.now() - days * 86400000).toISOString()
          const notesList = await dbHelper.allQuery('SELECT * FROM notes WHERE type = ? AND created_at >= ? ORDER BY created_at DESC', ['quick_note', since])
          const content = notesList.map((m: any) => `- ${m.title}: ${m.content}`).join('\n')
          const prompt = resolveVariables(`请总结以下便签内容，提炼关键信息和待办事项：\n\n${content || '暂无便签数据'}`)
          return modelRouter.chat({ model: effectiveModel, messages: [{ role: 'user' as const, content: prompt }] })
        })
      } else if (workflow.action_type === 'daily_report') {
        result = await runWorkflowNode(singleNode, async () => {
          const today = new Date().toISOString().split('T')[0]
          const dailyNotes = await dbHelper.allQuery('SELECT * FROM notes WHERE type = ? AND created_at >= ?', ['quick_note', today])
          const schedules = await dbHelper.allQuery('SELECT * FROM schedules WHERE start_time >= ?', [today])
          const content = `便签：${dailyNotes.map((m: any) => `- ${m.title}`).join('\n')}\n日程：${schedules.map((s: any) => `- ${s.title} (${s.status})`).join('\n')}`
          const prompt = resolveVariables(`生成今日工作日报：\n\n${content || '暂无数据'}`)
          return modelRouter.chat({ model: effectiveModel, messages: [{ role: 'user' as const, content: prompt }] })
        })
      } else if (workflow.action_type === 'auto_tag_memos') {
        result = await runWorkflowNode(singleNode, async () => {
          const notesList = await dbHelper.allQuery('SELECT * FROM notes WHERE type = ? AND (tags IS NULL OR tags = "" OR tags = "[]") ORDER BY created_at DESC LIMIT 20', ['quick_note'])
          let tagged = 0
          for (const note of notesList) {
            const prompt = resolveVariables(`为以下便签生成3-5个标签（逗号分隔，中英文均可）：\n${note.title}\n${note.content || ''}`)
            const tags = await modelRouter.chat({ model: effectiveModel, messages: [{ role: 'user' as const, content: prompt }] })
            const tagList = tags.split(/[,，]/).map((t: string) => t.trim()).filter((t: string) => t.length > 0).slice(0, 5).join(',')
            if (tagList) {
              await dbHelper.runQuery('UPDATE notes SET tags = ? WHERE id = ?', [JSON.stringify(tagList.split(',')), note.id])
              tagged++
            }
          }
          return `已为 ${tagged}/${notesList.length} 条便签生成标签`
        })
      } else if (workflow.action_type === 'multi_step') {
        const steps = config.steps || []
        const stepResults: string[] = []
        let context = ''
        for (let i = 0; i < steps.length; i++) {
          const step = steps[i]
          const stepNode = {
            nodeId: step.id || `multi-step-${i + 1}`,
            nodeName: step.name || step.action_type || `步骤 ${i + 1}`,
            nodeType: getWorkflowNodeType(step.action_type || ''),
            input: step.config || {},
          }
          const stepResult = await runWorkflowNode(stepNode, async () => {
            if (step.action_type === 'custom_prompt') {
              const prompt = resolveVariables((step.config?.prompt || '') + (context ? `\n\n前序步骤输出：\n${context}` : ''))
              return modelRouter.chat({ model: effectiveModel, messages: [{ role: 'user' as const, content: prompt }] })
            }
            if (step.action_type === 'summarize_memos') {
              const days = step.config?.days || 1
              const since = new Date(Date.now() - days * 86400000).toISOString()
              const notesList = await dbHelper.allQuery('SELECT * FROM notes WHERE type = ? AND created_at >= ? ORDER BY created_at DESC', ['quick_note', since])
              const content = notesList.map((m: any) => `- ${m.title}: ${m.content}`).join('\n')
              return modelRouter.chat({ model: effectiveModel, messages: [{ role: 'user' as const, content: resolveVariables(`总结以下内容：\n${content || '暂无数据'}${context ? `\n\n参考前序步骤：${context}` : ''}`) }] })
            }
            if (step.action_type === 'search_knowledge') {
              const query = resolveVariables(step.config?.query || context.substring(0, 100) || '最新内容')
              const ftsQuery = dbHelper.escapeFts5Query(query)
              const foundNotes = await dbHelper.allQuery('SELECT n.id, n.title, n.content FROM notes n JOIN notes_fts fts ON n.rowid = fts.rowid WHERE notes_fts MATCH ? LIMIT 5', [ftsQuery])
              return foundNotes.map((m: any) => `- ${m.title}: ${m.content?.substring(0, 200)}`).join('\n') || '未找到相关内容'
            }
            if (step.action_type === 'search_web') {
              const queries = step.config?.queries || [resolveVariables(step.config?.query || context.substring(0, 50) || '最新资讯')]
              const storedSearxngUrl = await dbHelper.getSetting('searxngUrl')
              const searxngUrl = step.config?.searxng_url || storedSearxngUrl
              if (!searxngUrl) {
                return '⚠️ 未配置 SearXNG 服务地址'
              }
              const timeRange = step.config?.time_range || 'day'
              const maxResults = step.config?.max_results || 5
              const searchParts: string[] = []
              for (const q of queries) {
                const results = await searchSearxng(q, searxngUrl, maxResults, timeRange)
                searchParts.push(`🔍 ${q}\n${results.map((r: any, i: number) => `${i+1}. 【${r.title}】\n   ${r.content}\n   ${r.url}`).join('\n') || '无结果'}`)
              }
              return searchParts.join('\n\n')
            }
            if (step.action_type === 'save_to_memo') {
              const title = resolveVariables(step.config?.memo_title || `工作流结果：${new Date().toLocaleDateString('zh-CN')}`)
              const category = step.config?.memo_category || '工作流'
              const contentToSave = context || step.config?.content || ''
              const memoId = uuidv4()
              const now = new Date().toISOString()
              try {
                await dbHelper.runQuery(
                  'INSERT INTO notes (id, type, title, content, category, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                  [memoId, 'quick_note', title, contentToSave, category, JSON.stringify(step.config?.memo_tags || ['工作流']), now, now]
                )
                log.info(`[Workflow] Saved note: "${title}" (${memoId})`)
              } catch (noteErr) {
                log.error('[Workflow] Failed to save note:', noteErr)
                throw noteErr
              }
              emitWorkflowEvent('memo-created-by-workflow', { id: memoId, title, category })
              return `已保存为便签: "${title}" (ID: ${memoId})`
            }
            if (step.action_type === 'extract_todos') {
              return modelRouter.chat({ model: effectiveModel, messages: [{ role: 'user' as const, content: resolveVariables(`从以下内容中提取待办事项，以列表形式输出：\n${context || '暂无内容'}`) }] })
            }
            if (step.action_type === 'daily_report') {
              const today = new Date().toISOString().split('T')[0]
              const dailyNotes = await dbHelper.allQuery('SELECT * FROM notes WHERE type = ? AND created_at >= ?', ['quick_note', today])
              const schedules = await dbHelper.allQuery('SELECT * FROM schedules WHERE start_time >= ?', [today])
              const content = `便签：${dailyNotes.map((m: any) => `- ${m.title}`).join('\n')}\n日程：${schedules.map((s: any) => `- ${s.title} (${s.status})`).join('\n')}`
              return modelRouter.chat({ model: effectiveModel, messages: [{ role: 'user' as const, content: resolveVariables(`生成今日工作日报：\n${content || '暂无数据'}${context ? `\n\n参考前序步骤：${context}` : ''}`) }] })
            }
            if (step.action_type === 'auto_tag_memos') {
              const notesList = await dbHelper.allQuery('SELECT * FROM notes WHERE type = ? AND (tags IS NULL OR tags = "" OR tags = "[]") ORDER BY created_at DESC LIMIT 10', ['quick_note'])
              let tagged = 0
              for (const note of notesList) {
                const tagRes = await modelRouter.chat({ model: effectiveModel, messages: [{ role: 'user' as const, content: resolveVariables(`为以下便签生成标签（逗号分隔）：\n${note.title}\n${note.content || ''}`) }] })
                const tagList = tagRes.split(/[,，]/).map((t: string) => t.trim()).filter((t: string) => t.length > 0).slice(0, 3).join(',')
                if (tagList) { await dbHelper.runQuery('UPDATE notes SET tags = ? WHERE id = ?', [JSON.stringify(tagList.split(',')), note.id]); tagged++ }
              }
              return `已为 ${tagged}/${notesList.length} 条便签生成标签`
            }
            if (step.action_type === 'condition') {
              const condition = resolveVariables(step.config?.condition || '')
              const prompt = `判断以下条件是否满足，只回答"是"或"否"：\n条件: ${condition}\n上下文: ${context || '无'}`
              const answer = await modelRouter.chat({ model: effectiveModel, messages: [{ role: 'user' as const, content: prompt }] })
              const isTrue = answer.includes('是') || answer.toLowerCase().includes('yes') || answer.toLowerCase().includes('true')
              if (!isTrue && step.config?.skip_if_false) {
                return `[条件不满足，跳过] ${condition}`
              }
              return `[条件${isTrue ? '满足' : '不满足'}] ${condition}`
            }
            return `未知步骤类型: ${step.action_type}`
          })
          context = stepResult
          stepResults.push(`【${step.name}】\n${stepResult}`)
        }
        result = stepResults.join('\n\n---\n\n')
      } else if (workflow.action_type === 'extract_todos') {
        result = await runWorkflowNode(singleNode, async () => {
          const days = config.days || 7
          const since = new Date(Date.now() - days * 86400000).toISOString()
          const notesList = await dbHelper.allQuery('SELECT * FROM notes WHERE type = ? AND created_at >= ? ORDER BY created_at DESC', ['quick_note', since])
          const content = notesList.map((m: any) => `- ${m.title}: ${m.content}`).join('\n')
          const prompt = resolveVariables(`从以下便签内容中提取所有待办事项和行动点，按优先级排列：\n\n${content || '暂无便签数据'}`)
          return modelRouter.chat({ model: effectiveModel, messages: [{ role: 'user' as const, content: prompt }] })
        })
      } else if (workflow.action_type === 'search_and_summarize') {
        result = await runWorkflowNode(singleNode, async () => {
          const query = resolveVariables(config.query || '最新内容')
          const sqliteResults = await dbHelper.searchMemosAndFiles(query)
          const kbContext = sqliteResults.map((r: any) => `[${r.type === 'memo' ? '便签' : '文档'} - ${r.title}]\n${r.text || r.content || ''}`).join('\n\n')
          const prompt = resolveVariables(`基于以下检索结果，生成一份综合摘要：\n\n${kbContext || '未找到相关内容'}`)
          return modelRouter.chat({ model: effectiveModel, messages: [{ role: 'user' as const, content: prompt }] })
        })
      } else if (workflow.action_type === 'search_web') {
        result = await runWorkflowNode(singleNode, async () => {
          const queries = config.queries || [resolveVariables(config.query || '今日科技新闻')]

          // 构建搜索配置：支持从数据库读取或工作流配置中指定
          const storedSearxngUrl = await dbHelper.getSetting('searxngUrl')
          const searchConfig: SearchProviderConfig = {}
          if (config.searxng_url) searchConfig.searxngUrl = config.searxng_url
          else if (storedSearxngUrl) searchConfig.searxngUrl = storedSearxngUrl

          const allSearchResults: string[] = []
          for (const q of queries) {
            const timeRange = config.time_range || 'day'
            const maxResults = config.max_results || 8
            const searchResults = await searchWeb(q, searchConfig, maxResults, timeRange)

            if (searchResults.length === 0) {
              allSearchResults.push(`🔍 关键词: ${q}\n未找到相关结果`)
              continue
            }

            // 智能筛选并抓取全文
            const candidates = searchResults.map((r: any) => ({
              url: r.url,
              title: r.title,
              snippet: r.content,
            }))
            const selected = await selectRelevantUrls(q, candidates, Math.min(5, candidates.length))
            const fetched = await fetchAndExtractPages(selected, 5)

            const formatted = fetched.map((r: any, idx: number) =>
              `${idx + 1}. 【${r.title}】${r.fetched ? ' (全文)' : ' (摘要)'}\n   ${r.content}\n   来源: ${r.url}`
            ).join('\n\n')
            allSearchResults.push(`🔍 关键词: ${q}\n${formatted || '未找到相关结果'}`)
          }
          const rawSearch = allSearchResults.join('\n\n---\n\n')
          if (config.summarize) {
            const model = config.model || effectiveModel
            const prompt = resolveVariables(config.summary_prompt || `你是一位专业的资讯分析师。请基于以下搜索结果，生成一份结构化的每日资讯简报。要求：
1. 📰 按主题分类归纳信息
2. 💡 提炼每条资讯的核心要点（不超过1句话）
3. 🔗 标注关键来源
4. 如果有值得关注的发展趋势或潜在影响，请特别指出

搜索结果：${rawSearch}`)
            result = await modelRouter.chat({ model, messages: [{ role: 'user' as const, content: prompt }] })
          } else {
            result = rawSearch
          }
          if (config.save_to_memo) {
            const memoTitle = resolveVariables(config.memo_title || `每日资讯 ${new Date().toLocaleDateString('zh-CN')}`)
            const memoCategory = config.memo_category || '资讯'
            const memoId = uuidv4()
            const now2 = new Date().toISOString()
            try {
              await dbHelper.runQuery(
                'INSERT INTO notes (id, type, title, content, category, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [memoId, 'quick_note', memoTitle, result, memoCategory, JSON.stringify(['资讯', '自动抓取']), now2, now2]
              )
              log.info(`[Workflow] Saved note: "${memoTitle}" (${memoId})`)
            } catch (noteErr) {
              log.error('[Workflow] Failed to save note (search_web):', noteErr)
              throw noteErr
            }
            emitWorkflowEvent('memo-created-by-workflow', { id: memoId, title: memoTitle, category: memoCategory })
          }
          return result
        })
      } else if (workflow.action_type === 'save_to_memo') {
        result = await runWorkflowNode(singleNode, async () => {
          const title = resolveVariables(config.memo_title || `工作流结果：${new Date().toLocaleDateString('zh-CN')}`)
          const category = config.memo_category || '工作流'
          const tags = config.memo_tags || ['工作流']
          const content = resolveVariables(config.content || result || '')
          const memoId = uuidv4()
          const now3 = new Date().toISOString()
          try {
            await dbHelper.runQuery(
              'INSERT INTO notes (id, type, title, content, category, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
              [memoId, 'quick_note', title, content, category, JSON.stringify(tags), now3, now3]
            )
            log.info(`[Workflow] Saved note: "${title}" (${memoId})`)
          } catch (noteErr) {
            log.error('[Workflow] Failed to save note (save_to_memo):', noteErr)
            throw noteErr
          }
          emitWorkflowEvent('memo-created-by-workflow', { id: memoId, title, category })
          return `已保存为便签: "${title}"`
        })
      } else {
        result = `未知操作类型: ${workflow.action_type}`
      }
    } // end of else (agent_workflows 执行逻辑)
    const logId = uuidv4()
    await dbHelper.runQuery(
      'INSERT INTO agent_workflow_logs (id, workflow_id, status, result) VALUES (?,?,?,?)',
      [logId, workflowId, 'completed', result]
    )
    return { success: true, result, logId }
  } catch (err: any) {
    const wf = await dbHelper.getQuery('SELECT * FROM agent_workflows WHERE id = ?', [workflowId])
    const errorHandling = wf?.error_handling || 'stop'
    if (errorHandling === 'retry') {
      try {
        log.info(`[Workflow] Retrying workflow ${workflowId}...`)
        await new Promise(r => setTimeout(r, 2000))
        return await executeWorkflowInternal(workflowId, steps, options)
      } catch (retryErr: any) {
        log.error(`[Workflow] Retry also failed:`, retryErr.message)
      }
    }
    const logId = uuidv4()
    await dbHelper.runQuery(
      'INSERT INTO agent_workflow_logs (id, workflow_id, status, result) VALUES (?,?,?,?)',
      [logId, workflowId, 'failed', err.message]
    )
    return { success: false, error: err.message, logId }
  }
}
