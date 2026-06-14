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

/**
 * P2 #1：协议模板 - 根据 Provider 推断 baseUrl 和 modelName 默认值
 *
 * 设计要点：
 *  - 用户在 <select> 选 Provider 时一键带入默认值，省去手动复制
 *  - 若 baseUrl/modelName 已经被用户手动改过（与默认不同），自动填充会跳过该字段
 *    避免覆盖用户已输入的自定义配置（如私有部署、代理、版本号）
 *  - custom 提供商不强制默认值，留给用户填写
 */
export interface ProviderTemplate {
  provider: string;
  baseUrl: string;
  modelName: string;
  /** 是否为"协议官方"配置（区别于用户自定义） */
  isPreset: boolean;
}

export const buildProviderTemplate = (provider: string, currentBaseUrl: string, currentModelName: string): ProviderTemplate => {
  const defaultBaseUrl = getDefaultBaseUrl(provider);
  const defaultModelName = getDefaultModel(provider);
  return {
    provider,
    // 留空 / 等于上一次默认 → 用新默认；否则保留用户输入
    baseUrl: !currentBaseUrl || currentBaseUrl === '' ? defaultBaseUrl : currentBaseUrl,
    modelName: !currentModelName || currentModelName === '' ? defaultModelName : currentModelName,
    isPreset: defaultBaseUrl !== '',
  };
};

/** 提供商显示名（中英） */
export const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  claude: 'Claude (Anthropic)',
  zhipu: '智谱 AI',
  dashscope: '通义千问',
  custom: '自定义 (OpenAI 兼容)',
};
