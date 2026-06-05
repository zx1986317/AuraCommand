import cron, { ScheduledTask } from 'node-cron';
import dbHelper from './db';
import { WorkflowEngine, Workflow } from './workflowEngine';
import log from 'electron-log';

// 存储：workflowId -> { task, cronExpression }
const activeJobs: Map<string, { task: ScheduledTask; cronExpression: string }> = new Map();

// 启动调度器
export async function startScheduler(options?: { model?: string; searxngUrl?: string }) {
  stopScheduler();
  try {
    const rows = await dbHelper.allQuery(
      'SELECT * FROM workflows WHERE schedule_cron IS NOT NULL AND schedule_cron != "" AND schedule_enabled = 1'
    );
    for (const row of rows) {
      const workflow: Workflow = {
        id: row.id, name: row.name, description: row.description,
        nodes: JSON.parse(row.nodes || '[]'), edges: JSON.parse(row.edges || '[]'),
        variables: JSON.parse(row.variables || '{}'),
        createdAt: row.created_at, updatedAt: row.updated_at,
      };
      scheduleWorkflow(workflow, row.schedule_cron, options);
    }
    log.info(`[Scheduler] Started with ${activeJobs.size} jobs`);
  } catch (err) { log.error('[Scheduler] Start failed:', err); }
}

// 停止调度器
export function stopScheduler() {
  for (const [, { task }] of activeJobs) task.stop();
  activeJobs.clear();
}

// 调度单个工作流
export function scheduleWorkflow(workflow: Workflow, cronExpression: string, options?: { model?: string; searxngUrl?: string }) {
  const existing = activeJobs.get(workflow.id);
  if (existing) { existing.task.stop(); activeJobs.delete(workflow.id); }
  if (!cron.validate(cronExpression)) { log.error(`[Scheduler] Invalid cron: ${cronExpression}`); return; }

  const task = cron.schedule(cronExpression, async () => {
    log.info(`[Scheduler] Running: ${workflow.name}`);
    try {
      const engine = new WorkflowEngine(workflow, {
        ...(options?.model ? { model: options.model } : {}),
        ...(options?.searxngUrl ? { searxngUrl: options.searxngUrl } : {}),
      });
      const result = await engine.run();
      await dbHelper.runQuery('UPDATE workflows SET last_scheduled_run = ? WHERE id = ?', [new Date().toISOString(), workflow.id]);
      await dbHelper.runQuery(
        `INSERT OR REPLACE INTO workflow_runs (id, workflow_id, status, current_node_id, context, logs, started_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [result.id, result.workflowId, result.status, result.currentNodeId, JSON.stringify(result.context), JSON.stringify(result.logs), result.startedAt, result.completedAt || '']
      );
      log.info(`[Scheduler] ${workflow.name} completed: ${result.status}`);
    } catch (err) { log.error(`[Scheduler] ${workflow.name} failed:`, err); }
  }, { scheduled: true } as any);
  activeJobs.set(workflow.id, { task, cronExpression });
}

// 取消调度
export function unscheduleWorkflow(workflowId: string) {
  const entry = activeJobs.get(workflowId);
  if (entry) { entry.task.stop(); activeJobs.delete(workflowId); }
}

// 获取活跃的定时任务信息
export function getActiveScheduledInfo(): { workflowId: string; cronExpression: string }[] {
  return Array.from(activeJobs.entries()).map(([id, { cronExpression }]) => ({ workflowId: id, cronExpression }));
}
