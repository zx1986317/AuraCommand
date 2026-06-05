export interface ModelStatus {
  category: string;
  recommend: string;
  installed: boolean;
  pullCommand: string;
}

export interface VaultStats {
  totalFiles: number;
  indexedCount: number;
  pendingCount: number;
  folderCount: number;
  totalSize: number;
  typeStats: { type: string; count: number }[];
  totalMemos: number;
  totalSchedules: number;
  vaultPath: string;
  vectorStatus: 'active' | 'empty' | 'error' | 'unknown';
}

export interface OllamaReadiness {
  connected: boolean;
  chatModelReady: boolean;
  embeddingModelReady: boolean;
  error?: string;
}

export interface DiagnosisItem {
  title: string;
  status: 'ready' | 'warning' | 'error';
  detail: string;
  action: string;
}

export const getDefaultBaseUrl = (provider: string): string => {
  switch (provider) {
    case 'openai': return 'https://api.openai.com/v1';
    case 'claude': return 'https://api.anthropic.com/v1';
    case 'zhipu': return 'https://open.bigmodel.cn/api/paas/v4';
    case 'dashscope': return 'https://dashscope.aliyuncs.com/compatible-mode/v1';
    case 'custom': return '';
    default: return '';
  }
};

export const getDefaultModel = (provider: string): string => {
  switch (provider) {
    case 'openai': return 'gpt-4o';
    case 'claude': return 'claude-sonnet-4-20250514';
    case 'zhipu': return 'glm-4-plus';
    case 'dashscope': return 'qwen-plus';
    case 'custom': return '';
    default: return '';
  }
};
