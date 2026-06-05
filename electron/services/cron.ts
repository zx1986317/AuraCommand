/**
 * Cron 调度服务
 * 管理工作流的定时调度
 */
import cron, { ScheduledTask } from 'node-cron'
import { BrowserWindow } from 'electron'
import log from 'electron-log'
import dbHelper from '../db'

const cronJobs: Map<string, ScheduledTask> = new Map()

export function startCronWorkflow(workflowId: string, cronExpression: string): boolean {
  if (cronJobs.has(workflowId)) {
    cronJobs.get(workflowId)?.stop()
    cronJobs.delete(workflowId)
  }
  if (!cron.validate(cronExpression)) {
    log.error(`[Cron] Invalid cron expression: ${cronExpression}`)
    return false
  }
  const task = cron.schedule(cronExpression, async () => {
    log.info(`[Cron] Executing workflow ${workflowId} at ${new Date().toISOString()}`)
    try {
      const workflow = await dbHelper.getQuery('SELECT * FROM agent_workflows WHERE id = ?', [workflowId])
      if (!workflow || !Number(workflow.enabled)) {
        log.info(`[Cron] Workflow ${workflowId} is disabled, skipping`)
        return
      }
      // 延迟导入避免循环依赖
      const { executeWorkflowInternal } = await import('./workflow')
      const res = await executeWorkflowInternal(workflowId)
      if (res.success) {
        const targetWin = BrowserWindow.getAllWindows()[0]
        if (targetWin) {
          targetWin.webContents.send('workflow-cron-completed', {
            workflowId, result: res.result, logId: res.logId
          })
        }
      }
    } catch (err: any) {
      log.error(`[Cron] Workflow ${workflowId} execution failed:`, err.message)
    }
  })
  cronJobs.set(workflowId, task)
  log.info(`[Cron] Started cron job for workflow ${workflowId} with expression: ${cronExpression}`)
  return true
}

export function stopCronWorkflow(workflowId: string) {
  if (cronJobs.has(workflowId)) {
    cronJobs.get(workflowId)?.stop()
    cronJobs.delete(workflowId)
    log.info(`[Cron] Stopped cron job for workflow ${workflowId}`)
  }
}

export async function loadAllCronWorkflows() {
  try {
    const workflows = await dbHelper.allQuery(
      "SELECT * FROM agent_workflows WHERE trigger_type = 'cron' AND enabled = 1"
    )
    for (const wf of workflows) {
      const triggerConfig = typeof wf.trigger_config === 'string'
        ? JSON.parse(wf.trigger_config) : wf.trigger_config
      const cronExpr = triggerConfig?.cron_expression || triggerConfig?.cron || ''
      if (cronExpr) {
        startCronWorkflow(wf.id, cronExpr)
      }
    }
    log.info(`[Cron] Loaded ${workflows.length} cron workflows`)
  } catch (err: any) {
    log.error('[Cron] Failed to load cron workflows:', err.message)
  }
}

export function getActiveCronIds(): string[] {
  const ids: string[] = []
  cronJobs.forEach((_, id) => ids.push(id))
  return ids
}