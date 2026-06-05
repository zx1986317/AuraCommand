import { IpcModule, IpcContext } from './index'
import dbHelper from '../db'
import * as modelRouter from '../modelRouter'
import { resolvePreferredModel } from '../modelPreference'
import { startCronWorkflow, stopCronWorkflow } from '../services/cron'
import { logError, logInfo, logWarn, ErrorCategory } from '../errorHandler'
import { findCrashRecoverableExecutions, resumeWorkflowExecution } from '../workflowEngine'

export function createWorkflowsModule(ctx: IpcContext): IpcModule {
  const normalizeWorkflowPayload = (payload: string | { workflowId?: string; manualTrigger?: boolean; model?: string } | undefined) => {
    if (typeof payload === 'string') {
      return { workflowId: payload, manualTrigger: false, model: undefined as string | undefined }
    }
    return {
      workflowId: payload?.workflowId || '',
      manualTrigger: !!payload?.manualTrigger,
      model: payload?.model
    }
  }

  const normalizeWorkflowLogsPayload = (payload: string | { workflowId?: string; limit?: number } | undefined) => {
    if (typeof payload === 'string') {
      return { workflowId: payload, limit: 50 }
    }
    return {
      workflowId: payload?.workflowId,
      limit: payload?.limit ?? 50
    }
  }

  return {
    'get-workflows': async () => {
      try { const workflows = await dbHelper.allQuery('SELECT * FROM agent_workflows ORDER BY created_at DESC'); return { success: true, workflows } }
      catch (err) { logError('Failed to get workflows:', ErrorCategory.DATABASE, { err }); return { success: false, workflows: [] } }
    },
    'save-workflow': async (_: any, workflow: any) => {
      try {
        const triggerConfig = typeof (workflow.trigger_config || workflow.trigger?.config) === 'string' ? (workflow.trigger_config || workflow.trigger?.config) : JSON.stringify(workflow.trigger_config || workflow.trigger?.config || {})
        const actionConfig = typeof (workflow.action_config || (workflow.steps && workflow.steps[0]?.params)) === 'string' ? (workflow.action_config || (workflow.steps && workflow.steps[0]?.params)) : JSON.stringify(workflow.action_config || (workflow.steps && workflow.steps[0]?.params) || {})
        const existing = await dbHelper.getQuery('SELECT id FROM agent_workflows WHERE id = ?', [workflow.id])
        if (existing) {
          await dbHelper.runQuery('UPDATE agent_workflows SET name = ?, description = ?, trigger_type = ?, trigger_config = ?, action_type = ?, action_config = ?, enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [workflow.name, workflow.description || '', workflow.trigger_type || workflow.trigger?.type || 'manual', triggerConfig, workflow.action_type || (workflow.steps && workflow.steps[0]?.action_type) || '', actionConfig, workflow.enabled ? 1 : 0, workflow.id])
        } else {
          await dbHelper.runQuery('INSERT INTO agent_workflows (id, name, description, trigger_type, trigger_config, action_type, action_config, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)', [workflow.id, workflow.name, workflow.description || '', workflow.trigger_type || workflow.trigger?.type || 'manual', triggerConfig, workflow.action_type || (workflow.steps && workflow.steps[0]?.action_type) || '', actionConfig, workflow.enabled ? 1 : 0])
        }
        return { success: true, id: workflow.id }
      } catch (err: any) { logError('Failed to save workflow:', ErrorCategory.DATABASE, { err }); throw err }
    },
    'delete-workflow': async (_: any, { id }: { id: string }) => {
      try { await dbHelper.runQuery('DELETE FROM agent_workflows WHERE id = ?', [id]); return { success: true } }
      catch (err: any) { logError('Failed to delete workflow:', ErrorCategory.DATABASE, { err }); throw err }
    },
    'toggle-workflow': async (_: any, { id, enabled }: { id: string, enabled: boolean }) => {
      try { await dbHelper.runQuery('UPDATE agent_workflows SET enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [enabled ? 1 : 0, id]); return { success: true } }
      catch (err: any) { logError('Failed to toggle workflow:', ErrorCategory.DATABASE, { err }); throw err }
    },
    'execute-agent-workflow': async (event: any, payload: string | { workflowId: string, manualTrigger?: boolean, model?: string }) => {
      try {
        const { workflowId, manualTrigger, model } = normalizeWorkflowPayload(payload)
        if (!workflowId) throw new Error('Workflow ID is required')
        const workflow = await dbHelper.getQuery('SELECT * FROM agent_workflows WHERE id = ?', [workflowId])
        if (!workflow) throw new Error('Workflow not found')
        const { executeWorkflowInternal } = await import('../services/workflow')
        const result = await executeWorkflowInternal(workflow, [], { vaultPath: ctx.vaultPath, win: ctx.getWin(), manualTrigger, model })
        return result
      } catch (err: any) { logError('Failed to execute workflow:', ErrorCategory.UNKNOWN, { err }); throw err }
    },
    'execute-agent-workflow-step': async (event: any, { workflowId, stepIndex, context }: { workflowId: string, stepIndex: number, context?: any }) => {
      try {
        const workflow = await dbHelper.getQuery('SELECT * FROM agent_workflows WHERE id = ?', [workflowId])
        if (!workflow) throw new Error('Workflow not found')
        const { executeWorkflowInternal } = await import('../services/workflow')
        const result = await executeWorkflowInternal(workflow, [], { vaultPath: ctx.vaultPath, win: ctx.getWin(), stepContext: context })
        return result
      } catch (err: any) { logError('Failed to execute workflow step:', ErrorCategory.UNKNOWN, { err }); throw err }
    },
    'generate-workflow-from-prompt': async (_: any, { prompt }: { prompt: string }) => {
      try {
        const systemPrompt = `你是一个工作流生成助手。根据用户的描述生成一个自动化工作流。返回JSON格式：
{
  "name": "工作流名称",
  "description": "工作流描述",
  "trigger_type": "cron|manual|event",
  "trigger_config": {},
  "action_type": "summarize_memos|daily_report|auto_tag_memos|extract_todos|search_and_summarize|search_web|save_to_memo",
  "action_config": {}
}
只返回JSON，不要其他内容。`
        const preferredModel = await resolvePreferredModel()
        const result = await modelRouter.chat({
          model: preferredModel,
          messages: [
            { role: 'system' as const, content: systemPrompt },
            { role: 'user' as const, content: prompt }
          ],
        })
        const jsonMatch = result.match(/\{[\s\S]*\}/)
        if (jsonMatch) return JSON.parse(jsonMatch[0])
        throw new Error('Failed to parse workflow JSON from AI response')
      } catch (err: any) { logError('Failed to generate workflow:', ErrorCategory.AI_SERVICE, { err }); throw err }
    },
    'get-workflow-logs': async (_: any, { workflowId, limit = 50 }: { workflowId?: string, limit?: number }) => {
      try {
        let sql = 'SELECT * FROM agent_workflow_logs'
        const params: any[] = []
        if (workflowId) { sql += ' WHERE workflow_id = ?'; params.push(workflowId) }
        sql += ' ORDER BY executed_at DESC LIMIT ?'
        params.push(limit)
        const logs = await dbHelper.allQuery(sql, params)
        return { success: true, logs }
      } catch (err) { logError('Failed to get workflow logs:', ErrorCategory.DATABASE, { err }); return { success: false, logs: [] } }
    },
    'get-agent-workflows': async () => {
      try { const workflows = await dbHelper.allQuery('SELECT * FROM agent_workflows ORDER BY created_at DESC'); return { success: true, workflows } }
      catch (err) { logError('Failed to get agent workflows:', ErrorCategory.DATABASE, { err }); return { success: false, workflows: [] } }
    },
    'save-agent-workflow': async (_: any, workflow: any) => {
      try {
        const triggerConfig = typeof workflow.trigger_config === 'string' ? workflow.trigger_config : JSON.stringify(workflow.trigger_config || {})
        const actionConfig = typeof workflow.action_config === 'string' ? workflow.action_config : JSON.stringify(workflow.action_config || {})
        const existing = await dbHelper.getQuery('SELECT id FROM agent_workflows WHERE id = ?', [workflow.id])
        if (existing) {
          await dbHelper.runQuery('UPDATE agent_workflows SET name = ?, description = ?, trigger_type = ?, trigger_config = ?, action_type = ?, action_config = ?, enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [workflow.name, workflow.description || '', workflow.trigger_type || 'manual', triggerConfig, workflow.action_type || '', actionConfig, workflow.enabled ? 1 : 0, workflow.id])
        } else {
          await dbHelper.runQuery('INSERT INTO agent_workflows (id, name, description, trigger_type, trigger_config, action_type, action_config, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)', [workflow.id, workflow.name, workflow.description || '', workflow.trigger_type || 'manual', triggerConfig, workflow.action_type || '', actionConfig, workflow.enabled ? 1 : 0])
        }
        if (workflow.trigger_type === 'cron') {
          const wf = await dbHelper.getQuery('SELECT * FROM agent_workflows WHERE id = ?', [workflow.id])
          if (wf && Number(wf.enabled)) {
            const tc = typeof wf.trigger_config === 'string' ? JSON.parse(wf.trigger_config) : wf.trigger_config
            const cronExpr = tc?.cron_expression || tc?.cron || ''
            if (cronExpr) { stopCronWorkflow(wf.id); startCronWorkflow(wf.id, cronExpr) }
          } else {
            stopCronWorkflow(workflow.id)
          }
        }
        return { success: true, id: workflow.id }
      } catch (err: any) { logError('Failed to save agent workflow:', ErrorCategory.DATABASE, { err }); throw err }
    },
    'delete-agent-workflow': async (_: any, { id }: { id: string }) => {
      try { await dbHelper.runQuery('DELETE FROM agent_workflows WHERE id = ?', [id]); return { success: true } }
      catch (err: any) { logError('Failed to delete agent workflow:', ErrorCategory.DATABASE, { err }); throw err }
    },
    'get-agent-workflow-logs': async (_: any, payload: string | { workflowId?: string, limit?: number }) => {
      try {
        const { workflowId, limit } = normalizeWorkflowLogsPayload(payload)
        let sql = 'SELECT * FROM agent_workflow_logs'
        const params: any[] = []
        if (workflowId) { sql += ' WHERE workflow_id = ?'; params.push(workflowId) }
        sql += ' ORDER BY executed_at DESC LIMIT ?'
        params.push(limit)
        const logs = await dbHelper.allQuery(sql, params)
        return { success: true, logs }
      } catch (err) { logError('Failed to get agent workflow logs:', ErrorCategory.DATABASE, { err }); return { success: false, logs: [] } }
    },
    'toggle-workflow-enabled': async (_: any, { id, enabled }: { id: string, enabled: boolean }) => {
      try {
        await dbHelper.runQuery('UPDATE agent_workflows SET enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [enabled ? 1 : 0, id])
        const wf = await dbHelper.getQuery('SELECT * FROM agent_workflows WHERE id = ?', [id])
        if (wf?.trigger_type === 'cron') {
          if (enabled) {
            const tc = typeof wf.trigger_config === 'string' ? JSON.parse(wf.trigger_config) : wf.trigger_config
            const cronExpr = tc?.cron_expression || tc?.cron || ''
            if (cronExpr) { stopCronWorkflow(id); startCronWorkflow(id, cronExpr) }
          } else {
            stopCronWorkflow(id)
          }
        }
        return { success: true }
      } catch (err: any) { logError('Failed to toggle workflow enabled:', ErrorCategory.DATABASE, { err }); throw err }
    },
    'resume-workflow-execution': async (_: any, { logId }: { logId: string }) => {
      try {
        const result = await resumeWorkflowExecution(logId)
        return { success: true, result }
      } catch (err: any) { logError('Failed to resume workflow execution:', ErrorCategory.UNKNOWN, { err }); throw err }
    },
    'find-crash-recoverable-workflows': async () => {
      try {
        const executions = await findCrashRecoverableExecutions()
        return { success: true, executions }
      } catch (err: any) { logError('Failed to find crash-recoverable workflows:', ErrorCategory.DATABASE, { err }); return { success: false, executions: [] } }
    },
  }
}
