export type AssistantPhase = 'query-expanding' | 'retrieving' | 'web-searching' | 'web-reading' | 'thinking' | 'searching' | 'reasoning' | 'composing' | 'tool-executing' | 'tool-retrying' | 'tool-summarizing' | 'completed' | 'error';

export type ActiveTab = 'dashboard' | 'chat' | 'kb' | 'documents' | 'tasks' | 'desk' | 'workflows' | 'memory';
export type OllamaStatus = 'online' | 'offline' | 'checking';
export type NotificationType = 'info' | 'error' | 'warning' | 'success';

export interface Notification {
  message: string;
  type: NotificationType;
}

export interface IndexingTask {
  fileName: string;
  status: 'parsing' | 'vectorizing' | 'completed' | 'error';
  progress: number;
  message?: string;
}