export interface MemoImage {
  id: string;
  dataUrl: string;
  name?: string;
  createdAt: string;
}

export interface Memo {
  id: string;
  title: string;
  content: string;
  project: string;
  category: string;
  tags?: string[];
  images?: MemoImage[];
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  title: string;
  content: string;
  project?: string | undefined;
  category?: string | undefined;
  tags?: string[] | undefined;
  source_type?: 'manual' | 'memo' | 'import' | undefined;
  source_id?: string | undefined;
  created_at: string;
  updated_at: string;
}

export interface DocCategory {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Schedule {
  id: string;
  title: string;
  content: string;
  start_time: string;
  end_time?: string;
  status: 'inbox' | 'today' | 'next' | 'waiting' | 'done';
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  images?: string[];
  sources?: Source[];
  tags?: string[];
  phase?: 'query-expanding' | 'retrieving' | 'web-searching' | 'web-reading' | 'thinking' | 'searching' | 'reasoning' | 'composing' | 'tool-executing' | 'tool-retrying' | 'tool-summarizing' | 'completed' | 'error';
  error?: boolean;
  timestamp?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  updated_at: string;
}

export interface Source {
  id: string;
  title: string;
  type: 'memo' | 'file' | 'web';
  url?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  trigger_type: 'manual' | 'cron' | 'on_memo_created' | 'on_schedule_due';
  trigger_config?: string;
  action_type: 'summarize_memos' | 'daily_report' | 'auto_tag_memos' | 'multi_step' | 'extract_todos' | 'search_and_summarize' | 'search_web' | 'save_to_memo';
  action_config?: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkflowStep {
  id: string;
  name: string;
  action_type: 'summarize_memos' | 'daily_report' | 'auto_tag_memos' | 'custom_prompt' | 'search_knowledge' | 'search_web' | 'extract_todos' | 'save_to_memo' | 'condition';
  config: Record<string, any>;
}

export interface WorkflowLog {
  id: string;
  workflow_id: string;
  status: 'running' | 'completed' | 'failed';
  result?: string;
  executed_at: string;
}

export interface FileItem {
  name: string;
  path: string;
  size: number;
  type: string;
  modified: string;
  indexed: boolean;
}

/** 知识库文件元数据（对应 SQLite file_metadata 表） */
export interface FileMetadata {
  id: string;
  file_path: string;
  file_name: string;
  file_type: string;
  file_size: number;
  last_modified: string;
  is_indexed: number; // 0 或 1
  summary?: string;
  tags?: string[];    // JSON 解析后的标签数组
  folder_path?: string;
  created_at: string;
  storage_mode?: 'reference' | 'copy';
  original_path?: string;
  link_status?: 'active' | 'deleted' | 'moved';
}

/** 文件分块（对应 SQLite file_chunks 表） */
export interface FileChunk {
  id: string;
  file_id: string;
  chunk_index: number;
  text: string;
  created_at: string;
}

/** 知识库搜索结果 */
export interface KBSearchResult {
  id: string;
  title: string;
  content?: string;
  text?: string;
  snippet?: string;
  type: 'memo' | 'file' | 'file_chunk';
  source?: 'keyword' | 'semantic' | 'hybrid';
  score?: number;
  rrfScore?: number;
  file_id?: string;
  file_name?: string;
  file_type?: string;
  file_path?: string;
  chunk_index?: number;
  category?: string;
  tags?: string | string[];
}

/** 索引进度状态 */
export interface IndexingStatus {
  fileName: string;
  status: 'parsing' | 'vectorizing' | 'completed' | 'error';
  progress: number;
  message?: string;
}

/** 搜索模式 */
export type KBSearchMode = 'keyword' | 'semantic' | 'hybrid';

/** 文件过滤模式 */
export type KBFilterMode = 'all' | 'indexed' | 'pending';

/** 文件排序模式 */
export type KBSortMode = 'newest' | 'largest';

/** 知识库视图模式 */
export type KBViewMode = 'list' | 'graph';

/** 虚拟文件夹 */
export interface KBFolder {
  id: string;
  name: string;
  parent_id?: string;
  sort_order: number;
  created_at: string;
  updated_at?: string;
}

export interface DailyInsight {
  summary: string;
  todos: string[];
  focus: string;
}

export interface Notification {
  message: string;
  type: 'info' | 'error' | 'warning';
}

export type TabType = 'dashboard' | 'chat' | 'kb' | 'desk' | 'documents' | 'tasks' | 'workflows' | 'memory';

export interface AppState {
  activeTab: TabType;
  memos: Memo[];
  schedules: Schedule[];
  chatMessages: ChatMessage[];
  chatSessions: ChatSession[];
  files: FileItem[];
  workflows: Workflow[];
}

export interface McpServerConfig {
  id?: string
  name: string
  transport: 'stdio' | 'sse'
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  enabled?: boolean
  auto_connect: boolean
}

export interface McpServerStatus {
  id: string
  name: string
  status: 'disconnected' | 'connecting' | 'connected' | 'error'
  enabled: boolean
  error?: string
  transport?: 'stdio' | 'sse'
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  auto_connect?: boolean
  tools?: { name: string; description: string }[]
}
