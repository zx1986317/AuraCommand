/**
 * Agent 工具系统
 * - 在 system prompt 中注入工具定义，LLM 输出 [[TOOL_CALL]] 标签
 * - 后端解析后执行对应工具
 * - 将结果以 [[TOOL_RESULT]] 回注到对话
 * - 支持多轮循环（最多 MAX_TOOL_ROUNDS 轮）
 *
 * 内部实现使用统一工具注册表（toolRegistry）
 */

import log from 'electron-log';
import { getTool, getToolDefinitionsForPrompt, ToolExecutionContext } from './toolRegistry';

// ===== 类型定义（保持对外接口不变）=====

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    name: string;
    type: 'string' | 'number' | 'boolean';
    description: string;
    required?: boolean;
  }[];
}

export interface ToolCall {
  name: string;
  arguments: Record<string, any>;
}

export interface ToolResult {
  name: string;
  success: boolean;
  result: any;
  error?: string;
}

export interface AgentStep {
  type: 'tool_call' | 'tool_result' | 'thinking';
  toolCall?: ToolCall;
  toolResult?: ToolResult;
  content?: string;
  timestamp: number;
}

export const MAX_TOOL_ROUNDS = 5;

// ===== 生成工具描述（注入 system prompt）=====
export function generateToolPrompt(): string {
  return getToolDefinitionsForPrompt();
}

// ===== 从 LLM 输出中解析工具调用 =====
export function parseToolCalls(text: string): ToolCall[] {
  const calls: ToolCall[] = [];
  const regex = /\[\[TOOL_CALL\]\]\s*([\s\S]*?)\s*\[\[\/TOOL_CALL\]\]/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    try {
      const payload = match[1];
      if (!payload) continue;
      const parsed = JSON.parse(payload.trim());
      if (parsed.name && typeof parsed.name === 'string') {
        calls.push({
          name: parsed.name,
          arguments: parsed.arguments || {},
        });
      }
    } catch (e) {
      log.error('[Agent] Failed to parse tool call:', match[1], e);
    }
  }
  return calls;
}

// ===== 从文本中移除工具调用标签（用于显示给用户）=====
export function stripToolCalls(text: string): string {
  return text.replace(/\[\[TOOL_CALL\]\][\s\S]*?\[\[\/TOOL_CALL\]\]/g, '').trim();
}

// ===== 执行单个工具调用 =====
export async function executeToolCall(
  call: ToolCall,
  searxngUrl?: string
): Promise<ToolResult> {
  const { name, arguments: args } = call;

  const tool = getTool(name);
  if (!tool) {
    return { name, success: false, result: null, error: `未知工具: ${name}` };
  }

  const context: ToolExecutionContext = {
    resolveTemplate: (t: string) => t, // Agent 模式不需要模板解析
    getVariable: () => undefined,
    setVariable: () => {},
  };
  if (searxngUrl) {
    context.searxngUrl = searxngUrl;
  }

  try {
    const result = await tool.execute(args || {}, context);
    return { name, success: true, result };
  } catch (err: any) {
    log.error(`[Agent] Tool execution error (${name}):`, err);
    return { name, success: false, result: null, error: err.message || '执行失败' };
  }
}

// ===== 格式化工具结果（注入回对话）=====
export function formatToolResult(result: ToolResult): string {
  if (!result.success) {
    return `[[TOOL_RESULT]]\n{"name": "${result.name}", "success": false, "error": "${result.error}"}\n[[/TOOL_RESULT]]`;
  }
  return `[[TOOL_RESULT]]\n{"name": "${result.name}", "success": true, "result": ${JSON.stringify(result.result)}}\n[[/TOOL_RESULT]]`;
}

// ===== 检查是否需要继续 Agent 循环 =====
export function shouldContinueAgentLoop(fullResponse: string): boolean {
  return /\[\[TOOL_CALL\]\][\s\S]*?\[\[\/TOOL_CALL\]\]/.test(fullResponse);
}
