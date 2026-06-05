/**
 * Chat 类型定义
 * 用于替换 useChatLogic.ts 中的 any 类型
 */

/** 聊天消息角色 */
export type ChatRole = 'user' | 'assistant' | 'system';

/** 单个 Agent 步骤 */
export interface AgentStep {
  id: string;
  type: 'tool_call' | 'tool_result' | 'reasoning' | 'search' | 'rag';
  name?: string;
  input?: Record<string, unknown>;
  output?: string;
  status?: 'running' | 'completed' | 'failed';
  timestamp?: string;
}

/** 聊天中的搜索结果（联网/RAG） */
export interface ChatSearchResult {
  title: string;
  url?: string;
  snippet?: string;
  source?: string;
}

/** 书签收藏的消息 */
export interface BookmarkedMessage {
  id: string;
  sessionId: string;
  messageId: string;
  content: string;
  title?: string;
  createdAt: string;
}

/** 聊天消息（宽松类型，兼容流式构建中的部分对象） */
export type ChatMessage = Partial<{
  id: string;
  role: string;
  content: string;
  timestamp: string;
  reasoning: string;
  agentSteps: AgentStep[];
  searchResults: ChatSearchResult[];
  isBookmarked: boolean;
  sources: Array<{ type: string; id: string; title: string }>;
  branchId: string;
  parentMessageId: string;
  isStreaming: boolean;
  error: string | boolean;
  phase: string;
  usesRetrieval: boolean;
  images: string[];
}> & Record<string, unknown>;

/** 聊天会话 */
export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  /** 是否置顶 */
  isPinned?: boolean;
  /** 角色 ID */
  roleId?: string;
  /** 角色名称 */
  roleName?: string;
  /** 消息数量 */
  messageCount?: number;
}

/** AI 角色/角色预设 */
export interface AiRole {
  id: string;
  name: string;
  description?: string;
  systemPrompt: string;
  isDefault?: boolean;
  isCustom?: boolean;
  icon?: string;
}

/** 流式输出事件数据 */
export interface StreamChunkData {
  sessionId: string;
  messageId: string;
  content: string;
  reasoning?: string;
  isComplete?: boolean;
}

/** 流式输出结束数据 */
export interface StreamEndData {
  sessionId: string;
  messageId: string;
  finalContent: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/** 流式输出错误数据 */
export interface StreamErrorData {
  sessionId: string;
  messageId: string;
  error: string;
}

/** 消息编辑数据 */
export interface MessageEditData {
  messageId: string;
  newContent: string;
}

/** 会话创建数据 */
export interface CreateSessionData {
  id?: string;
  title?: string;
  roleId?: string;
}

/** 消息操作数据 */
export interface MessageActionData {
  messageId: string;
  sessionId: string;
}

/** 搜索配置 */
export interface SearchConfig {
  isSearchEnabled: boolean;
  isRAGEnabled: boolean;
}

/** 聊天上下文 */
export interface ChatContext {
  session: ChatSession;
  messages: ChatMessage[];
  config: SearchConfig;
  selectedModel: string;
}
