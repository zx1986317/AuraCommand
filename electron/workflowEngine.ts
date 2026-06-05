/**
 * 工作流引擎
 * 
 * 核心概念：
 * - Workflow：由多个 Node 按顺序组成的工作流
 * - Node：单个步骤，可以是 LLM调用、工具调用、条件分支
 * - ExecutionContext：节点间数据传递的上下文
 * - 执行方式：顺序执行，每个节点的输出可作为下一个节点的输入
 */

import ollama, { generateChatStream } from './ollama';
import { getTool, getAllTools, ToolExecutionContext } from './toolRegistry';
import { runQuery, allQuery, getQuery } from './db/connection';
import log from 'electron-log';

// ===== 类型定义 =====

export type NodeType = 'llm' | 'tool' | 'condition' | 'start' | 'end';

export interface WorkflowNode {
  id: string;
  type: NodeType;
  name: string;
  config: Record<string, any>;
  nextNodeId?: string;       // 条件分支时有 true/false 两个
  nextNodeTrueId?: string;   // condition 节点：条件为真时跳转
  nextNodeFalseId?: string;  // condition 节点：条件为假时跳转
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  variables: Record<string, string>;  // 工作流变量（默认值）
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowEdge {
  sourceId: string;
  targetId: string;
  label?: string;  // 条件边：true/false
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  status: 'running' | 'completed' | 'error' | 'paused';
  currentNodeId: string;
  context: Record<string, any>;  // 执行上下文（变量值）
  logs: WorkflowRunLog[];
  startedAt: string;
  completedAt?: string;
}

export interface WorkflowRunLog {
  nodeId: string;
  nodeName: string;
  nodeType: NodeType;
  input: any;
  output: any;
  status: 'success' | 'error' | 'skipped';
  timestamp: string;
  duration: number;  // ms
}

export interface NodeExecutionState {
  status: 'pending' | 'running' | 'completed' | 'failed';
  input: any;
  output: any;
  started_at: string;
  completed_at: string;
}

export interface ExecutionState {
  nodes: { [nodeId: string]: NodeExecutionState };
  currentNode: string | null;
}



// ===== 执行上下文 =====

class ExecutionContext implements ToolExecutionContext {
  private variables: Record<string, any> = {};
  private nodeOutputs: Record<string, any> = {};
  // ToolExecutionContext 接口的 searxngUrl 属性
  get searxngUrl(): string | undefined {
    return this.variables['searxngUrl'];
  }

  constructor(initialVars: Record<string, string> = {}) {
    this.variables = { ...initialVars };
  }

  setVariable(key: string, value: any) {
    this.variables[key] = value;
  }

  getVariable(key: string): any {
    return this.variables[key];
  }

  setNodeOutput(nodeId: string, output: any) {
    this.nodeOutputs[nodeId] = output;
  }

  getNodeOutput(nodeId: string): any {
    return this.nodeOutputs[nodeId];
  }

  // 解析模板字符串：{{variable}} 或 {{node.output.field}}
  resolveTemplate(template: string): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const trimmed = key.trim();
      // 支持 nodeOutput.field 格式
      if (trimmed.startsWith('nodeOutput.')) {
        const parts = trimmed.split('.');
        const nodeId = parts[1];
        const field = parts.slice(2).join('.');
        const output = this.nodeOutputs[nodeId];
        if (!output) return match;
        if (field) {
          return String(output[field] ?? match);
        }
        return String(output);
      }
      // 支持变量引用
      if (this.variables[trimmed] !== undefined) {
        return String(this.variables[trimmed]);
      }
      return match;
    });
  }

  toJSON(): Record<string, any> {
    // 安全序列化：避免循环引用，只保留 variables 和简化的 nodeOutputs
    const safeOutputs: Record<string, any> = {};
    for (const [key, value] of Object.entries(this.nodeOutputs)) {
      try {
        JSON.stringify(value);
        safeOutputs[key] = value;
      } catch {
        safeOutputs[key] = String(value);
      }
    }
    return { variables: this.variables, nodeOutputs: safeOutputs };
  }
}



// ===== 获取可用工具列表（给前端用）=====

export function getAvailableTools(): { name: string; description: string; parameters: { name: string; type: string; description: string; required?: boolean }[] }[] {
  return getAllTools().map(tool => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }));
}

// ===== 工作流执行引擎 =====

export class WorkflowEngine {
  private workflow: Workflow;
  private context: ExecutionContext;
  private logs: WorkflowRunLog[] = [];
  private onLog: ((log: WorkflowRunLog) => void) | undefined;
  private onNodeStart: ((nodeId: string) => void) | undefined;
  private onNodeComplete: ((nodeId: string, output: any) => void) | undefined;
  private model: string;
  private searxngUrl: string;
  private abortController: AbortController | null = null;
  private executionState: ExecutionState = { nodes: {}, currentNode: null };
  private logId: string | null = null;
  private resumeFromNodeId: string | null = null;

  constructor(
    workflow: Workflow,
    options: {
      model?: string;
      searxngUrl?: string;
      onLog?: (log: WorkflowRunLog) => void;
      onNodeStart?: (nodeId: string) => void;
      onNodeComplete?: (nodeId: string, output: any) => void;
      logId?: string;
      resumeFromNodeId?: string;
      initialExecutionState?: ExecutionState;
    } = {}
  ) {
    this.workflow = workflow;
    this.context = new ExecutionContext(workflow.variables);
    this.model = options.model || '';
    this.searxngUrl = options.searxngUrl || 'http://localhost:8080';
    this.onLog = options.onLog;
    this.onNodeStart = options.onNodeStart;
    this.onNodeComplete = options.onNodeComplete;
    this.logId = options.logId || null;
    this.resumeFromNodeId = options.resumeFromNodeId || null;
    if (options.initialExecutionState) {
      this.executionState = options.initialExecutionState;
      for (const [nodeId, state] of Object.entries(options.initialExecutionState.nodes)) {
        if (state.status === 'completed' && state.output !== undefined) {
          this.context.setNodeOutput(nodeId, state.output);
        }
      }
    }
  }

  // 设置变量（运行时覆盖）
  setVariable(key: string, value: string) {
    this.context.setVariable(key, value);
  }

  // 构建 nextNodeId 映射（从 edges 推导）
  private buildNextMap(): Record<string, { next?: string; trueNext?: string; falseNext?: string }> {
    const map: Record<string, { next?: string; trueNext?: string; falseNext?: string }> = {};
    for (const edge of this.workflow.edges) {
      const entry = map[edge.sourceId] ?? (map[edge.sourceId] = {});
      if (edge.label === 'true') {
        entry.trueNext = edge.targetId;
      } else if (edge.label === 'false') {
        entry.falseNext = edge.targetId;
      } else {
        entry.next = edge.targetId;
      }
    }
    return map;
  }

  // 执行单个节点
  private async executeNode(node: WorkflowNode): Promise<{ output: any; nextNodeId?: string }> {
    const startTime = Date.now();
    this.onNodeStart?.(node.id);

    this.executionState.currentNode = node.id;
    this.executionState.nodes[node.id] = {
      status: 'running',
      input: node.config,
      output: null,
      started_at: new Date().toISOString(),
      completed_at: '',
    };
    await this.persistExecutionState();

    try {
      let output: any;
      let nextNodeId: string | undefined;

      switch (node.type) {
        case 'start': {
          output = { message: '工作流启动', variables: { ...this.workflow.variables } };
          break;
        }

        case 'end': {
          output = { message: '工作流完成' };
          break;
        }

        case 'llm': {
          const promptTemplate = node.config.prompt || '';
          const prompt = this.context.resolveTemplate(promptTemplate);
          const systemPrompt = node.config.system_prompt || '你是一个智能助手，请根据提供的信息给出简洁准确的回答。';

          // 收集上下文信息（之前的节点输出）
          const contextParts: string[] = [];
          for (const log of this.logs) {
            if (log.output && log.nodeType === 'tool') {
              contextParts.push(`[${log.nodeName} 结果]: ${JSON.stringify(log.output)}`);
            }
          }
          const contextStr = contextParts.length > 0 ? `\n\n【前序节点输出】：\n${contextParts.join('\n')}` : '';

          const fullSystemPrompt = systemPrompt + contextStr;
          const messages = [
            { role: 'system' as const, content: fullSystemPrompt, images: [] },
            { role: 'user' as const, content: prompt, images: [] },
          ];

          // 流式生成
          let fullResponse = '';
          await new Promise<void>((resolve, reject) => {
            generateChatStream(messages, this.model, (data) => {
              if (data.content) fullResponse += data.content;
            }, this.abortController?.signal).then(resolve).catch(reject);
          });

          output = { response: fullResponse };
          // 将 LLM 输出存入上下文
          this.context.setVariable('llm_output', fullResponse);
          break;
        }

        case 'tool': {
          const toolName = node.config.tool_name || '';
          const toolArgs = { ...node.config.tool_args };
          // 注入 searxngUrl 到上下文
          this.context.setVariable('searxngUrl', this.searxngUrl);
          
          const tool = getTool(toolName);
          if (!tool) {
            throw new Error(`未知工具: ${toolName}`);
          }
          output = await tool.execute(toolArgs, this.context);
          break;
        }

        case 'condition': {
          const conditionExpr = node.config.condition || '';
          // 简单条件评估：支持变量比较
          const evaluated = this.evaluateCondition(conditionExpr);
          output = { condition: conditionExpr, result: evaluated };
          // 条件节点决定下一个节点
          nextNodeId = evaluated
            ? this.buildNextMap()[node.id]?.trueNext
            : this.buildNextMap()[node.id]?.falseNext;
          break;
        }

        default:
          throw new Error(`未知节点类型: ${node.type}`);
      }

      const duration = Date.now() - startTime;
      const log: WorkflowRunLog = {
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type,
        input: node.config,
        output,
        status: 'success',
        timestamp: new Date().toISOString(),
        duration,
      };
      this.logs.push(log);
      this.context.setNodeOutput(node.id, output);
      this.onLog?.(log);
      this.onNodeComplete?.(node.id, output);

      this.executionState.nodes[node.id] = {
        status: 'completed',
        input: node.config,
        output,
        started_at: this.executionState.nodes[node.id]?.started_at || new Date().toISOString(),
        completed_at: new Date().toISOString(),
      };
      this.executionState.currentNode = null;
      await this.persistExecutionState(node.id);

      // 如果条件节点已经决定了 nextNodeId，用它；否则用 nextMap
      if (!nextNodeId) {
        const nextMap = this.buildNextMap();
        nextNodeId = nextMap[node.id]?.next;
      }

      return nextNodeId ? { output, nextNodeId } : { output };
    } catch (err: any) {
      const duration = Date.now() - startTime;
      const log: WorkflowRunLog = {
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type,
        input: node.config,
        output: { error: err.message },
        status: 'error',
        timestamp: new Date().toISOString(),
        duration,
      };
      this.logs.push(log);
      this.onLog?.(log);

      this.executionState.nodes[node.id] = {
        status: 'failed',
        input: node.config,
        output: { error: err.message },
        started_at: this.executionState.nodes[node.id]?.started_at || new Date().toISOString(),
        completed_at: new Date().toISOString(),
      };
      this.executionState.currentNode = null;
      await this.persistExecutionState();

      throw err;
    }
  }

  // 简单条件评估
  private evaluateCondition(condition: string): boolean {
    // 支持 {{variable}} == "value" 格式
    const resolved = this.context.resolveTemplate(condition);
    // 尝试作为 JS 表达式评估（安全受限）
    try {
      if (resolved === 'true') return true;
      if (resolved === 'false') return false;
      // 包含比较操作符
      if (resolved.includes('==')) {
        const [left, right] = resolved.split('==').map(s => s.trim());
        return left === right;
      }
      if (resolved.includes('!=')) {
        const [left, right] = resolved.split('!=').map(s => s.trim());
        return left !== right;
      }
      if (resolved.includes('>')) {
        const left = Number.parseFloat(resolved.split('>')[0]?.trim() ?? 'NaN');
        const right = Number.parseFloat(resolved.split('>')[1]?.trim() ?? 'NaN');
        return left > right;
      }
      if (resolved.includes('<')) {
        const left = Number.parseFloat(resolved.split('<')[0]?.trim() ?? 'NaN');
        const right = Number.parseFloat(resolved.split('<')[1]?.trim() ?? 'NaN');
        return left < right;
      }
      return !!resolved;
    } catch {
      return !!resolved;
    }
  }

  // 执行整个工作流
  async run(): Promise<WorkflowRun> {
    this.abortController = new AbortController();
    const runId = this.logId || `run-${Date.now()}`;
    const startedAt = new Date().toISOString();

    if (!this.logId) {
      await runQuery(
        `INSERT INTO agent_workflow_logs (id, workflow_id, status, execution_state, executed_at) VALUES (?, ?, 'running', ?, CURRENT_TIMESTAMP)`,
        [runId, this.workflow.id, JSON.stringify(this.executionState)]
      );
      this.logId = runId;
    } else {
      await runQuery(
        `UPDATE agent_workflow_logs SET status = 'running', crash_recovery = 1, execution_state = ? WHERE id = ?`,
        [JSON.stringify(this.executionState), this.logId]
      );
    }

    const startNode = this.workflow.nodes.find(n => n.type === 'start');
    if (!startNode) throw new Error('工作流没有起始节点');

    let currentNode: WorkflowNode | undefined;
    if (this.resumeFromNodeId) {
      currentNode = this.workflow.nodes.find(n => n.id === this.resumeFromNodeId);
      if (!currentNode) {
        log.warn(`[Workflow] Resume node ${this.resumeFromNodeId} not found, starting from beginning`);
        currentNode = startNode;
      } else {
        const nextMap = this.buildNextMap();
        const nextId = nextMap[this.resumeFromNodeId]?.next;
        currentNode = nextId ? this.workflow.nodes.find(n => n.id === nextId) : undefined;
        if (!currentNode) {
          currentNode = startNode;
        }
      }
    } else {
      currentNode = startNode;
    }

    let status: WorkflowRun['status'] = 'running';

    while (currentNode) {
      if (this.abortController.signal.aborted) {
        status = 'paused';
        break;
      }

      try {
        const { nextNodeId } = await this.executeNode(currentNode);
        
        if (currentNode.type === 'end') {
          status = 'completed';
          break;
        }

        // 查找下一个节点
        if (nextNodeId) {
          currentNode = this.workflow.nodes.find(n => n.id === nextNodeId);
        } else {
          // 没有 next 节点，工作流结束
          status = 'completed';
          break;
        }
      } catch (err) {
        log.error('[Workflow] Node execution error:', err);
        status = 'error';
        break;
      }
    }

    const completedAt = status !== 'running' ? new Date().toISOString() : undefined;

    if (this.logId) {
      await runQuery(
        `UPDATE agent_workflow_logs SET status = ?, result = ?, execution_state = ?, last_completed_node = ? WHERE id = ?`,
        [
          status,
          status === 'error' ? 'error' : 'success',
          JSON.stringify(this.executionState),
          this.getLastCompletedNodeId(),
          this.logId,
        ]
      );
    }

    return {
      id: runId,
      workflowId: this.workflow.id,
      status,
      currentNodeId: currentNode?.id || '',
      context: this.context.toJSON(),
      logs: this.logs,
      startedAt,
      ...(completedAt ? { completedAt } : {}),
    };
  }

  private getLastCompletedNodeId(): string | null {
    for (const [nodeId, state] of Object.entries(this.executionState.nodes)) {
      if (state.status === 'completed') {
        const hasLaterCompleted = Object.entries(this.executionState.nodes).some(
          ([, s]) => s.status === 'completed' && s.completed_at > state.completed_at
        );
        if (!hasLaterCompleted) return nodeId;
      }
    }
    return null;
  }

  private async persistExecutionState(completedNodeId?: string): Promise<void> {
    if (!this.logId) return;
    try {
      await runQuery(
        `UPDATE agent_workflow_logs SET execution_state = ?, last_completed_node = ? WHERE id = ?`,
        [
          JSON.stringify(this.executionState),
          completedNodeId || this.getLastCompletedNodeId(),
          this.logId,
        ]
      );
    } catch (err: any) {
      log.warn('[Workflow] Failed to persist execution state:', err.message);
    }
  }

  // 中止工作流
  abort() {
    this.abortController?.abort();
  }
}


export async function findCrashRecoverableExecutions(): Promise<{ id: string; workflow_id: string; last_completed_node: string | null; execution_state: string }[]> {
  try {
    const rows = await allQuery(
      `SELECT id, workflow_id, last_completed_node, execution_state FROM agent_workflow_logs WHERE status = 'running'`
    );
    return rows as any[];
  } catch (err: any) {
    log.warn('[Workflow] Failed to find crash-recoverable executions:', err.message);
    return [];
  }
}

export async function resumeWorkflowExecution(logId: string): Promise<WorkflowRun> {
  const logRow = await getQuery(
    `SELECT * FROM agent_workflow_logs WHERE id = ?`,
    [logId]
  ) as any;
  if (!logRow) throw new Error(`Workflow log ${logId} not found`);
  if (logRow.status !== 'running') throw new Error(`Workflow log ${logId} is not in running state (status: ${logRow.status})`);

  const workflowRow = await getQuery(
    `SELECT * FROM agent_workflows WHERE id = ?`,
    [logRow.workflow_id]
  ) as any;
  if (!workflowRow) throw new Error(`Workflow ${logRow.workflow_id} not found`);

  let executionState: ExecutionState;
  try {
    executionState = JSON.parse(logRow.execution_state || '{}');
  } catch {
    executionState = { nodes: {}, currentNode: null };
  }

  const workflow: Workflow = {
    id: workflowRow.id,
    name: workflowRow.name,
    description: workflowRow.description || '',
    nodes: [],
    edges: [],
    variables: {},
    createdAt: workflowRow.created_at,
    updatedAt: workflowRow.updated_at,
  };

  try {
    const actionConfig = typeof workflowRow.action_config === 'string'
      ? JSON.parse(workflowRow.action_config)
      : (workflowRow.action_config || {});
    if (actionConfig.nodes) workflow.nodes = actionConfig.nodes;
    if (actionConfig.edges) workflow.edges = actionConfig.edges;
    if (actionConfig.variables) workflow.variables = actionConfig.variables;
  } catch {
    throw new Error('Failed to parse workflow action_config');
  }

  if (workflow.nodes.length === 0) {
    throw new Error('Workflow has no nodes to resume');
  }

  const engine = new WorkflowEngine(workflow, {
    logId,
    resumeFromNodeId: logRow.last_completed_node || undefined,
    initialExecutionState: executionState,
  });

  return engine.run();
}

// ===== 预设工作流模板 =====

export function getPresetWorkflows(): Workflow[] {
  return [
    {
      id: 'preset-daily-tech-news',
      name: '每日科技资讯',
      description: '自动搜索今日科技新闻，AI 总结后保存为便签',
      nodes: [
        { id: 'n1', type: 'start', name: '开始', config: {} },
        { id: 'n2', type: 'tool', name: '搜索科技资讯', config: {
          tool_name: 'search_web',
          tool_args: { query: '今日科技新闻 最新科技资讯', time_range: 'day', limit: 8 }
        }},
        { id: 'n3', type: 'llm', name: 'AI 总结', config: {
          system_prompt: '你是一个科技资讯编辑，请将搜索到的新闻整理为结构化的每日科技简报。使用 Markdown 格式，包含：日期、重要新闻标题和摘要、分类（AI/芯片/互联网/创业等）。',
          prompt: '请将以下搜索结果整理为今日科技简报：\n\n{{nodeOutput.n2.items}}'
        }},
        { id: 'n4', type: 'tool', name: '保存为便签', config: {
          tool_name: 'create_memo',
          tool_args: { title: '每日科技简报 {{date}}', content: '{{nodeOutput.n3.response}}', tags: '科技,资讯,日报' }
        }},
        { id: 'n5', type: 'end', name: '结束', config: {} },
      ],
      edges: [
        { sourceId: 'n1', targetId: 'n2' },
        { sourceId: 'n2', targetId: 'n3' },
        { sourceId: 'n3', targetId: 'n4' },
        { sourceId: 'n4', targetId: 'n5' },
      ],
      variables: { date: new Date().toLocaleDateString('zh-CN'), searxngUrl: 'http://124.221.201.81:8080' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'preset-knowledge-summary',
      name: '知识库周报',
      description: '搜索本周知识库内容，生成周报并创建日程提醒',
      nodes: [
        { id: 'n1', type: 'start', name: '开始', config: {} },
        { id: 'n2', type: 'tool', name: '搜索知识库', config: {
          tool_name: 'search_knowledge',
          tool_args: { query: '本周工作记录 项目进展', limit: 10 }
        }},
        { id: 'n3', type: 'llm', name: '生成周报', config: {
          system_prompt: '你是一个项目经理，请根据知识库搜索结果生成本周工作周报。使用 Markdown 格式，包含：本周完成事项、遇到的问题、下周计划。',
          prompt: '请根据以下知识库内容生成本周工作周报：\n\n{{nodeOutput.n2.items}}'
        }},
        { id: 'n4', type: 'tool', name: '保存周报便签', config: {
          tool_name: 'create_memo',
          tool_args: { title: '工作周报 {{date}}', content: '{{nodeOutput.n3.response}}', tags: '周报,工作' }
        }},
        { id: 'n5', type: 'end', name: '结束', config: {} },
      ],
      edges: [
        { sourceId: 'n1', targetId: 'n2' },
        { sourceId: 'n2', targetId: 'n3' },
        { sourceId: 'n3', targetId: 'n4' },
        { sourceId: 'n4', targetId: 'n5' },
      ],
      variables: { date: new Date().toLocaleDateString('zh-CN') },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'preset-smart-reminder',
      name: '智能日程管理',
      description: '查看待办日程，AI 分析优先级，生成提醒便签',
      nodes: [
        { id: 'n1', type: 'start', name: '开始', config: {} },
        { id: 'n2', type: 'tool', name: '获取待办日程', config: {
          tool_name: 'list_schedules',
          tool_args: { status: 'pending' }
        }},
        { id: 'n3', type: 'llm', name: 'AI 分析优先级', config: {
          system_prompt: '你是一个时间管理专家，请分析用户的待办日程，按紧急程度排序，给出每个日程的优先级和建议处理时间。',
          prompt: '请分析以下待办日程并给出优先级建议：\n\n{{nodeOutput.n2.items}}'
        }},
        { id: 'n4', type: 'tool', name: '保存分析结果', config: {
          tool_name: 'create_memo',
          tool_args: { title: '日程优先级分析 {{date}}', content: '{{nodeOutput.n3.response}}', tags: '日程,分析' }
        }},
        { id: 'n5', type: 'end', name: '结束', config: {} },
      ],
      edges: [
        { sourceId: 'n1', targetId: 'n2' },
        { sourceId: 'n2', targetId: 'n3' },
        { sourceId: 'n3', targetId: 'n4' },
        { sourceId: 'n4', targetId: 'n5' },
      ],
      variables: { date: new Date().toLocaleDateString('zh-CN') },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
}
