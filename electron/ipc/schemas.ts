/**
 * IPC 参数验证 schemas
 * 使用 zod 统一验证所有 IPC handler 的输入参数
 */
import { z } from 'zod'

// ─── 便签 (Memos) ───────────────────────────────────────────
export const SaveNoteSchema = z.object({
  id: z.string().uuid(),
  title: z.string().max(200),
  content: z.string().default(''),
  type: z.enum(['quick_note', 'document']),
  project: z.string().max(100).default(''),
  category: z.string().max(100).default(''),
  tags: z.array(z.string().max(50)).default([]),
  images: z.array(z.string()).default([]),
  source_type: z.string().max(50).default('manual'),
  source_id: z.string().default(''),
  created_at: z.string().optional(),
})

export const GetMemosSchema = z.object({
  type: z.enum(['quick_note', 'document']).optional(),
  project: z.string().optional(),
  category: z.string().optional(),
}).optional()

export const SearchMemosSchema = z.object({
  query: z.string().max(200),
  limit: z.number().int().positive().max(100).default(20),
})

export const DeleteMemoSchema = z.object({
  id: z.string(),
})

export const UpdateMemoTagsSchema = z.object({
  id: z.string(),
  tags: z.array(z.string().max(50)),
})

// ─── 知识库 (Knowledge) ──────────────────────────────────────
export const ImportFilesSchema = z.object({
  filePaths: z.array(z.string().min(1)),
  folderId: z.string().uuid().optional(),
})

export const ImportFolderSchema = z.object({
  folderPath: z.string().min(1),
  folderId: z.string().uuid().optional(),
})

export const DeleteFileSchema = z.object({
  id: z.string(),
})

export const GenerateSummarySchema = z.object({
  fileId: z.string(),
})

export const GenerateTagsSchema = z.object({
  content: z.string().max(10000),
  model: z.string().optional(),
})

export const ReindexFileSchema = z.object({
  id: z.string(),
})

export const OpenPathSchema = z.object({
  path: z.string().min(1),
})

export const SearchKnowledgeSchema = z.object({
  query: z.string().max(500),
  mode: z.enum(['keyword', 'semantic', 'hybrid']).default('hybrid'),
  limit: z.number().int().positive().max(100).default(20),
})

export const UpdateFileTagsSchema = z.object({
  id: z.string(),
  tags: z.array(z.string().max(50)),
})

export const MoveFileToFolderSchema = z.object({
  fileId: z.string(),
  folderId: z.string().uuid(),
})

// ─── 对话 (Chat) ─────────────────────────────────────────────
export const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
})

export const ChatWithKbSchema = z.object({
  query: z.string().max(2000),
  model: z.string().optional(),
  sessionId: z.string().uuid().optional().nullable(),
  history: z.array(ChatMessageSchema).default([]),
  searchEnabled: z.boolean().default(false),
  ragEnabled: z.boolean().default(true),
  searxngUrl: z.string().url().optional().or(z.literal('')),
  searchProviders: z.object({
    selectedProvider: z.enum(['searxng', 'bocha', 'bing']).optional(),
    bochaApiKey: z.string().optional(),
    searchMode: z.enum(['fast', 'deep']).optional(),
  }).optional(),
  images: z.array(z.string()).default([]),
  systemPrompt: z.string().default(''),
  noPersist: z.boolean().default(false),
  cloudModelId: z.string().optional(),
  projectName: z.string().optional(),
})

export const AskAiSchema = z.object({
  prompt: z.string().max(5000),
  model: z.string(),
  history: z.array(ChatMessageSchema).default([]),
})

export const ChatKnowledgeSchema = z.object({
  query: z.string().max(2000),
  model: z.string().optional(),
  searxngUrl: z.string().url().optional().or(z.literal('')),
  cloudModelId: z.string().optional(),
})

export const CreateChatSessionSchema = z.object({
  title: z.string().min(1).max(200),
})

export const DeleteChatSessionSchema = z.object({
  sessionId: z.string().min(1),
})

export const RenameChatSessionSchema = z.object({
  sessionId: z.string().min(1),
  title: z.string().min(1).max(200),
})

export const GetChatMessagesSchema = z.object({
  sessionId: z.string().optional(),
})

export const SearchChatMessagesSchema = z.object({
  query: z.string().min(1).max(500),
})

export const ToggleBookmarkSchema = z.object({
  messageId: z.string().min(1),
  bookmarked: z.boolean(),
})

export const SaveChatMessageSchema = z.object({
  sessionId: z.string().min(1),
  role: z.string().min(1),
  content: z.string().min(1),
  images: z.array(z.unknown()).default([]),
  sources: z.array(z.unknown()).default([]),
})

export const AutoTagMessageSchema = z.object({
  messageId: z.string().optional(),
  content: z.string().min(1),
  model: z.string().optional(),
  cloudModelId: z.string().optional(),
})

export const ClearChatMessagesSchema = z.object({
  sessionId: z.string().optional(),
})

export const ExportChatToDocxSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
})

export const SummarizeMemoSchema = z.object({
  text: z.string().max(10000),
  model: z.string().optional(),
})

// ─── 待办 (Tasks) ────────────────────────────────────────────
export const SaveTaskSchema = z.object({
  id: z.string(),
  title: z.string().max(200),
  description: z.string().default(''),
  type: z.string().default('task'),
  status: z.enum(['inbox', 'today', 'next', 'waiting', 'done']).default('inbox'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  due_date: z.string().default(''),
  scheduled_date: z.string().default(''),
  source_type: z.string().default(''),
  source_id: z.string().default(''),
  source_title: z.string().default(''),
  tags: z.array(z.string()).default([]),
  created_at: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
})

export const CreateTaskSchema = z.object({
  title: z.string().max(200),
  description: z.string().default(''),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  status: z.enum(['inbox', 'today', 'next', 'waiting', 'done']).default('inbox'),
  source_type: z.string().default(''),
  source_id: z.string().default(''),
  source_title: z.string().default(''),
  tags: z.array(z.string()).default([]),
})

export const MoveTaskStatusSchema = z.object({
  id: z.string(),
  status: z.enum(['inbox', 'today', 'next', 'waiting', 'done']),
})

export const DeleteTaskSchema = z.object({
  id: z.string(),
})

// ─── 日程 (Schedules) ────────────────────────────────────────
export const SaveScheduleSchema = z.object({
  id: z.string(),
  title: z.string().max(200),
  content: z.string().default(''),
  start_time: z.string(),
  end_time: z.string().optional(),
  status: z.string().max(50),
  category: z.string().max(100),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  linked_memos: z.string().optional(),
})

export const DeleteScheduleSchema = z.object({
  id: z.string(),
})

// ─── 工作流 (Workflows) ──────────────────────────────────────
export const SaveWorkflowSchema = z.object({
  id: z.string().optional(),
  name: z.string().max(100),
  description: z.string().default(''),
  enabled: z.boolean().default(true),
  trigger: z.string(),
  steps: z.array(z.record(z.string(), z.unknown())),
})

export const DeleteWorkflowSchema = z.object({
  id: z.string(),
})

export const ExecuteWorkflowSchema = z.object({
  id: z.string(),
})

// ─── 文件夹 (Folders) ────────────────────────────────────────
export const CreateFolderSchema = z.object({
  name: z.string().max(100).min(1),
  parentId: z.string().uuid().optional().nullable(),
})

export const RenameFolderSchema = z.object({
  id: z.string().uuid(),
  name: z.string().max(100).min(1),
})

export const DeleteFolderSchema = z.object({
  id: z.string().uuid(),
})

// ─── Clips ───────────────────────────────────────────────────
export const SaveClipSchema = z.object({
  type: z.enum(['image', 'text']),
  content: z.string(),
  userDescription: z.string().max(500).optional().nullable(),
})

export const UpdateClipDescriptionSchema = z.object({
  id: z.string(),
  description: z.string().max(2000).optional().nullable(),
})

export const DeleteClipSchema = z.object({
  id: z.string(),
})

export const CreateClipGroupSchema = z.object({
  name: z.string().max(100).min(1),
  description: z.string().max(500).optional().nullable(),
})

export const DeleteClipGroupSchema = z.object({
  id: z.string(),
})

export const AddClipsToGroupSchema = z.object({
  groupId: z.string(),
  clipIds: z.array(z.string()).min(1),
})

export const RemoveClipFromGroupSchema = z.object({
  groupId: z.string(),
  clipId: z.string(),
})

export const GetClipsInGroupSchema = z.object({
  groupId: z.string(),
})

// ─── 云端 (Cloud) ───────────────────────────────────────────
export const SaveCloudConfigSchema = z.object({
  provider: z.string().max(100).min(1),
  apiKey: z.string().min(1),
  baseUrl: z.string().url().or(z.literal('')),
  modelName: z.string().max(100).min(1),
})

export const SaveCloudModelSchema = z.object({
  id: z.string().optional(),
  name: z.string().max(100).min(1),
  provider: z.string().max(100).min(1),
  apiKey: z.string().min(1),
  baseUrl: z.string().url().or(z.literal('')),
  modelName: z.string().max(100).min(1),
  isVision: z.boolean().optional(),
  capabilities: z.object({
    chat: z.boolean(),
    vision: z.boolean(),
    imageGen: z.boolean(),
    embedding: z.boolean(),
    videoGen: z.boolean(),
  }).optional(),
})

export const DeleteCloudModelSchema = z.object({
  id: z.string(),
})

export const TestCloudModelSchema = z.object({
  provider: z.string().max(100),
  apiKey: z.string().min(1),
  baseUrl: z.string().url().or(z.literal('')),
  model: z.string().max(100).min(1),
})

// ─── 同步 (Sync) ───────────────────────────────────────────
export const SaveSyncConfigSchema = z.object({
  type: z.enum(['none', 'webdav', 's3']),
  config: z.record(z.string(), z.unknown()).default({}),
  autoSync: z.boolean().default(false),
})

export const WebDavConfigSchema = z.object({
  url: z.string().url(),
  username: z.string().min(1),
  password: z.string().min(1),
})

export const S3ConfigSchema = z.object({
  endpoint: z.string().optional(),
  region: z.string().max(50).optional(),
  bucket: z.string().min(1),
  accessKeyId: z.string().min(1),
  secretAccessKey: z.string().min(1),
})

export const SyncImportSchema = z.object({
  data: z.string().min(1),
})

// ─── 导出 (Export) ───────────────────────────────────────────
export const ExportChatSchema = z.object({
  messages: z.array(z.unknown()),
  format: z.enum(['markdown', 'json', 'text']).default('markdown'),
})

export const ExportFileSchema = z.object({
  content: z.string().min(1),
  format: z.enum(['docx', 'xlsx', 'pptx']),
  title: z.string().optional(),
})

export const ExportMemoSchema = z.object({
  id: z.string(),
  format: z.enum(['markdown', 'pdf', 'docx']).default('markdown'),
})

// ─── 系统 (System) ───────────────────────────────────────────
export const SetVaultPathSchema = z.object({
  path: z.string().min(1),
})

export const ConfigKeySchema = z.object({
  key: z.string().min(1).max(100),
})

export const SetConfigSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.unknown(),
})

export const SetSearxngUrlSchema = z.object({
  url: z.string().url().or(z.literal('')),
})

export const SetSettingSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.unknown(),
})

export const SwitchVaultSchema = z.object({
  path: z.string().min(1),
})

export const ShowItemInFolderSchema = z.object({
  path: z.string().min(1),
})

export const OpenExternalSchema = z.object({
  url: z.string().url().refine(
    (url) => /^https?:\/\//i.test(url),
    { message: '只允许 http/https 协议' }
  ),
})

export const SetGlobalShortcutSchema = z.object({
  shortcut: z.string().min(1),
  action: z.string().min(1),
})

// ─── Ollama / 模型管理 ──────────────────────────────────────
export const OllamaModelNameSchema = z.object({
  modelName: z.string().min(1),
})

export const OllamaGenerateSchema = z.object({
  prompt: z.string().min(1),
  model: z.string().optional(),
})

export const OllamaChatMessageSchema = z.object({
  role: z.string(),
  content: z.union([z.string(), z.unknown()]),
})

export const OllamaChatSchema = z.object({
  messages: z.array(OllamaChatMessageSchema).min(1),
  model: z.string().optional(),
})

export const OllamaEmbeddingsSchema = z.object({
  text: z.string().min(1),
  model: z.string().optional(),
})

export const AnalyzeImageSchema = z.object({
  imagePath: z.string().min(1),
  prompt: z.string().optional(),
  model: z.string().optional(),
})

// ─── MCP Server ──────────────────────────────────────────────
export const AddMcpServerSchema = z.object({
  name: z.string().max(100).min(1),
  transport: z.enum(['stdio', 'sse']).default('stdio'),
  command: z.string().optional().nullable(),
  args: z.array(z.string()).default([]),
  env: z.record(z.string(), z.string()).optional().nullable(),
  url: z.string().optional().nullable(),
  enabled: z.boolean().default(true),
  auto_connect: z.boolean().default(true),
})

export const UpdateMcpServerSchema = z.object({
  id: z.string(),
  name: z.string().max(100).min(1),
  transport: z.enum(['stdio', 'sse']).default('stdio'),
  command: z.string().optional().nullable(),
  args: z.array(z.string()).default([]),
  env: z.record(z.string(), z.string()).optional().nullable(),
  url: z.string().optional().nullable(),
  enabled: z.boolean().default(true),
  auto_connect: z.boolean().default(true),
})

export const McpServerIdSchema = z.object({
  id: z.string(),
})

// ─── 笔记 (Notes) ────────────────────────────────────────────
export const GetNotesSchema = z.object({
  type: z.enum(['quick_note', 'document']).optional(),
  category: z.string().optional(),
}).optional()

export const SaveQuickNoteSchema = z.object({
  id: z.string(),
  type: z.enum(['quick_note', 'document']).default('quick_note'),
  title: z.string().max(200).default(''),
  content: z.string().default(''),
  tags: z.any().default([]),
  category: z.string().max(100).default(''),
  project: z.string().max(100).default(''),
  folder_id: z.string().default(''),
  file_path: z.string().default(''),
  size: z.number().default(0),
  source_url: z.string().default(''),
  pinned: z.boolean().default(false),
  images: z.any().default([]),
  source_type: z.string().max(50).default(''),
  source_id: z.string().default(''),
  created_at: z.string().optional(),
})

export const DeleteNoteSchema = z.object({
  id: z.string(),
})

export const SearchNotesSchema = z.object({
  query: z.string().max(200),
})

// ─── 文档 (Documents) ────────────────────────────────────────
export const SaveDocumentSchema = z.object({
  id: z.string(),
  title: z.string().max(200).default(''),
  content: z.string().default(''),
  project: z.string().max(100).default(''),
  category: z.string().max(100).default('uncategorized'),
  tags: z.union([z.array(z.string().max(50)), z.string()]).default([]),
  source_type: z.string().max(50).default('manual'),
  source_id: z.string().default(''),
  created_at: z.string().optional(),
})

export const DeleteDocumentSchema = z.object({
  id: z.string(),
})

export const SearchDocumentsSchema = z.object({
  query: z.string().max(200),
})

export const DocCategorySchema = z.object({
  id: z.string(),
  name: z.string().max(100),
  color: z.string().max(20).default('#6366f1'),
  sort_order: z.number().int().default(0),
})

export const DeleteDocCategorySchema = z.object({
  id: z.string(),
})

export const ExportDocumentSchema = z.object({
  id: z.string(),
})

// ─── 通用 ─────────────────────────────────────────────────────
export const ValidatePathSchema = z.object({
  path: z.string().min(1),
})

// ─── 验证辅助函数 ─────────────────────────────────────────────
export function validateInput<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown,
  context?: string
): z.infer<T> {
  const result = schema.safeParse(data)
  if (!result.success) {
    const errors = result.error.errors
      .map(e => `${e.path.join('.')}: ${e.message}`)
      .join('; ')
    const ctx = context ? `[${context}] ` : ''
    throw new Error(`${ctx}参数验证失败: ${errors}`)
  }
  return result.data
}
