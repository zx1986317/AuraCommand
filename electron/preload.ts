import { ipcRenderer, contextBridge, clipboard } from 'electron'

const SEND_CHANNELS: string[] = []

const INVOKE_CHANNELS = [
  'ai-schedule',
  'analyze-screenshot',
  'auto-tag-message',
  'backup-vault',
  'chat-with-kb',
  'check-models',
  'check-ollama-status',
  'check-searxng-connection',
  'clear-chat-messages',
  'clipboard-ocr',
  'create-kb-folder',
  'delete-agent-workflow',
  'delete-ai-memory',
  'delete-chat-session',
  'delete-document',
  'delete-file',
  'delete-kb-folder',
  'delete-memo',
  'delete-note',
  'delete-schedule',
  'delete-task',
  'execute-agent-workflow',
    'export-chat-to-docx',
    'export-document-to-docx',
    'export-file',
  'export-quick-notes-markdown',
  'export-schedules-markdown',
  'extract-schedules',
  'generate-file-summary',
  'generate-report',
  'get-agent-workflow-logs',
  'get-agent-workflows',
  'get-ai-memories',
  'get-bookmarked-messages',
  'get-chat-messages',
  'get-chat-sessions',
  'create-doc-category',
  'delete-doc-category',
  'get-doc-categories',
  'get-document-by-id',
  'get-documents',
  'update-doc-category',
  'get-file-preview',
  'read-pdf-file',
  'get-file-tags',
  'get-kb-folders',
  'get-kb-graph-data',
  'get-memo-backlinks',
  'get-memo-by-id',
  'get-memos',
  'get-note-by-id',
  'get-note-categories',
  'get-note-tags',
  'get-notes',
  'get-ollama-models',
  'ollama-generate',
  'ollama-chat',
  'ollama-gpu-mode',
  'ollama-set-gpu-mode',
  'ollama-url',
  'ollama-set-url',
  'ollama-model-params',
  'ollama-set-model-params',
  'get-schedules',
  'get-setting',
  'get-task-by-id',
  'get-task-stats',
  'get-tasks',
  'get-vault-config',
  'get-clips',
  'search-clips',
  'save-clip',
  'update-clip-description',
  'delete-clip',
  'clear-old-clips',
  'get-clip-groups',
  'create-clip-group',
  'delete-clip-group',
  'add-clips-to-group',
  'remove-clip-from-group',
  'get-clips-in-group',
  'read-clipboard-image',
  'read-clipboard-image-preview',
  'get-vault-files',
  'global-search',
  'import-files',
  'import-quick-notes-markdown',
  'is-maximized',
  'mcp-add-server',
  'mcp-connect',
  'mcp-delete-server',
  'mcp-disconnect',
  'mcp-get-statuses',
  'mcp-list-servers',
  'mcp-update-server',
  'move-file-to-folder',
  'generate-file-summary',
  'clear-all-quick-notes',

  'open-external',
  'open-path',
  'install-playwright-browser',
  'quick-add-todo',
  'relink-file',
  'rename-chat-session',
  'rename-kb-folder',
  'reorder-schedules',
  'restore-vault',
  'rollback-chat-turn',
  'get-attachment-context',
  'open-file-path',
  'save-agent-workflow',
  'save-chat-message',
  'save-document',
  'save-memo',
  'save-note',
  'save-schedule',
  'save-task',
  'search-chat-messages',
  'search-kb-fulltext',
  'search-documents',
  'search-memos',
  'search-notes',
  'search-schedules-by-title',
  'search-tasks',
  'select-directory',
  'select-file-dialog',
  'set-setting',
  'show-item-in-folder',
  'stop-chat',
  'store-text-as-file',
  'suggest-tags',
  'summarize-memo',
  'get-weekly-digest',
  'switch-vault',
  'sync-export',
  'sync-from-webdav',
  'sync-import',
  'sync-to-webdav',
  'toggle-bookmark-message',
  'update-chat-message',
  'toggle-workflow-enabled',
  'update-file-tags',
  'update-schedule-status',
  'update-task-status',
  'window-close',
  'window-max',
  'window-min',
  'save-note-version',
  'get-note-versions',
  'get-note-version-content',
  'restore-note-version',
  'upgrade-note-to-document',
  'search-notes-for-link',
  'global-hybrid-search',
  'search-files-for-chat',
  'get-file-content-for-chat',
  'save-ai-memory',
  'search-ai-memories',
  'save-ai-response-as-document',
  'extract-tasks-from-file',
  'sync-checkbox-to-tasks',
  'get-related-content',
  'get-cloud-config',
  'get-cloud-models',
  'save-cloud-config',
  'save-cloud-model',
  'delete-cloud-model',
  'test-cloud-model',
  'is-cloud-ai-enabled',
  // P0 #1：Keychain 安全状态 + 一次性迁移触发
  'secret-store-status',
  'migrate-cloud-api-keys',
  // 注意：'internal-resolve-api-key' 故意不暴露给渲染进程，保留主进程内部专用
  'add-to-project',
  'remove-from-project',
  'list-project-items',
  'list-projects',
  'create-project',
  'rename-project',
  'delete-project',
  'resume-workflow-execution',
  'find-crash-recoverable-workflows',
  'save-ocr-to-note',
  'save-ocr-to-kb',
  'copy-clip-to-clipboard',
  'set-task-notify-enabled',
  'get-task-notify-enabled',
  'start-digest',
  'cancel-digest',
  'get-digest-summary',
  'get-digest-detail',
  'get-digest-prompt',
  'clear-digest',
  'incremental-digest'
]

const EVENT_CHANNELS = [
  'chat-chunk',
  'chat-end',
  'chat-error',
  'chat-phase',
  'indexing-progress',
  'indexing-queue-status',
  'memo-created-by-workflow',
  'proactive-notification',
  'quick-note-focus',
  'session-created',
  'tool-call',
  'tool-result',
  'mcp-connect-failed',
  'vault-file-added',
  'window-maximized',
  'window-unmaximized',
  'workflow-cron-completed',
  'workflow-node-complete',
  'workflow-node-start',
  'workflow-run-log',
  'navigate-to-tasks',
  'digest-progress'
]

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  // 仅允许发送到这些频道
  send(channel: string, ...args: any[]) {
    if (SEND_CHANNELS.includes(channel)) {
      ipcRenderer.send(channel, ...args)
    }
  },

  // 仅允许调用这些异步方法
  invoke(channel: string, ...args: any[]) {
    if (INVOKE_CHANNELS.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args)
    }
    return Promise.reject(new Error(`Unauthorized IPC channel: ${channel}`))
  },

  // 仅允许监听这些来自主进程的事件
  on: (channel: string, callback: (event: any, ...args: any[]) => void) => {
    if (EVENT_CHANNELS.includes(channel)) {
      ipcRenderer.on(channel, callback)
    }
  },
  // 提供一次性监听
  once: (channel: string, callback: (event: any, ...args: any[]) => void) => {
    if (EVENT_CHANNELS.includes(channel)) {
      ipcRenderer.once(channel, callback)
    }
  },
  // 移除监听器
  removeListener: (channel: string, callback: (event: any, ...args: any[]) => void) => {
    if (EVENT_CHANNELS.includes(channel)) {
      ipcRenderer.removeListener(channel, callback);
    }
  },
  off: (channel: string, callback: (event: any, ...args: any[]) => void) => {
    if (EVENT_CHANNELS.includes(channel)) {
      ipcRenderer.removeListener(channel, callback);
    }
  },
  removeAllListeners: (channel: string) => {
    if (EVENT_CHANNELS.includes(channel)) {
      ipcRenderer.removeAllListeners(channel);
    }
  },
  
  // 获取剪贴板图片 (返回 base64)
  getClipboardImage: () => {
    try {
      const image = clipboard.readImage();
      if (image.isEmpty()) {
        return null;
      }
      return image.toDataURL().split(',')[1];
    } catch {
      return null;
    }
  }
})
