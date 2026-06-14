/**
 * P1：云端模型费用预估
 * 思路：
 *  1. 内置常见模型价格表（USD / 1M tokens）
 *  2. 提供 token 估算（粗略：4 字符 ≈ 1 token，中文 1.5 字符 ≈ 1 token）
 *  3. 暴露 estimateChatCost(provider, model, messages) 工具
 *  4. 通过 IPC 注入到前端，调用前显示预估成本
 *
 * 注意：价格是 2024-Q4 公开价，UI 上明确标注"仅供参考"
 */

export interface ModelPrice {
  /** USD / 1M input tokens */
  inputPer1M: number;
  /** USD / 1M output tokens */
  outputPer1M: number;
  /** 显示用的标签 */
  label: string;
  /** 备注（如有缓存价、批次价等） */
  note?: string;
}

/** 内置价格表（USD / 1M tokens，2024-Q4 公开价） */
const PRICE_TABLE: Record<string, ModelPrice> = {
  // OpenAI
  'gpt-4o': { inputPer1M: 2.5, outputPer1M: 10, label: 'GPT-4o' },
  'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.6, label: 'GPT-4o mini' },
  'gpt-4-turbo': { inputPer1M: 10, outputPer1M: 30, label: 'GPT-4 Turbo' },
  'gpt-3.5-turbo': { inputPer1M: 0.5, outputPer1M: 1.5, label: 'GPT-3.5 Turbo' },
  'o1-preview': { inputPer1M: 15, outputPer1M: 60, label: 'o1-preview' },
  'o1-mini': { inputPer1M: 3, outputPer1M: 12, label: 'o1-mini' },
  'gpt-image-1': { inputPer1M: 5, outputPer1M: 0, label: 'GPT Image-1' },
  'dall-e-3': { inputPer1M: 0, outputPer1M: 0, label: 'DALL·E 3', note: '按张计费，不在 token 估算范围内' },

  // Anthropic Claude
  'claude-3-5-sonnet': { inputPer1M: 3, outputPer1M: 15, label: 'Claude 3.5 Sonnet' },
  'claude-3-5-haiku': { inputPer1M: 0.8, outputPer1M: 4, label: 'Claude 3.5 Haiku' },
  'claude-3-opus': { inputPer1M: 15, outputPer1M: 75, label: 'Claude 3 Opus' },
  'claude-sonnet-4': { inputPer1M: 3, outputPer1M: 15, label: 'Claude Sonnet 4' },
  'claude-opus-4': { inputPer1M: 15, outputPer1M: 75, label: 'Claude Opus 4' },

  // 智谱
  'glm-4-plus': { inputPer1M: 7, outputPer1M: 7, label: 'GLM-4 Plus' },
  'glm-4-flash': { inputPer1M: 0, outputPer1M: 0, label: 'GLM-4 Flash', note: '免费' },
  'cogview-4': { inputPer1M: 0, outputPer1M: 0, label: 'CogView-4', note: '按张计费' },

  // 通义千问 / DashScope
  'qwen-max': { inputPer1M: 2.4, outputPer1M: 9.6, label: 'Qwen Max' },
  'qwen-plus': { inputPer1M: 0.8, outputPer1M: 2, label: 'Qwen Plus' },
  'qwen-turbo': { inputPer1M: 0.3, outputPer1M: 0.6, label: 'Qwen Turbo' },
  'wan2.6-t2i': { inputPer1M: 0, outputPer1M: 0, label: '通义万相 2.6', note: '按张计费' },
};

/**
 * 粗略估算文本 token 数
 *  - 英文/数字/标点：≈ 4 字符/token
 *  - 中文（CJK）：≈ 1.5 字符/token
 *  - 公式：tokens ≈ englishChars/4 + cjkChars*2/3
 * 误差 ±25%，仅供预估
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  let cjk = 0, other = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) || 0;
    if (
      (code >= 0x4E00 && code <= 0x9FFF) ||   // CJK Unified
      (code >= 0x3400 && code <= 0x4DBF) ||   // CJK Ext A
      (code >= 0xF900 && code <= 0xFAFF)      // CJK Compat
    ) {
      cjk++;
    } else {
      other++;
    }
  }
  return Math.ceil(cjk * (2 / 3) + other / 4);
}

export interface CostBreakdown {
  inputTokens: number;
  outputTokens: number;
  inputUSD: number;
  outputUSD: number;
  totalUSD: number;
  priceKnown: boolean;
  priceLabel?: string | undefined;
  priceNote?: string | undefined;
}

export function getModelPrice(modelName: string): ModelPrice | null {
  if (!modelName) return null;
  const exact = PRICE_TABLE[modelName];
  if (exact) return exact;
  // 模糊匹配：gpt-4o-2024-08-06 → gpt-4o
  const lower = modelName.toLowerCase();
  for (const key of Object.keys(PRICE_TABLE)) {
    const found = PRICE_TABLE[key];
    if (found && lower.startsWith(key.toLowerCase())) return found;
  }
  return null;
}

export interface ChatMessageLite {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

/**
 * 估算一次对话成本
 * - input = 所有历史消息的 token 数
 * - output = 预留 maxTokens（或固定默认 1000）作为输出预估
 */
export function estimateChatCost(
  provider: string,
  modelName: string,
  messages: ChatMessageLite[],
  options?: { expectedOutputTokens?: number }
): CostBreakdown {
  let inputTokens = 0;
  for (const m of messages || []) {
    if (typeof m.content === 'string') {
      inputTokens += estimateTokens(m.content);
    } else if (Array.isArray(m.content)) {
      for (const part of m.content) {
        if (part.type === 'text' && part.text) inputTokens += estimateTokens(part.text);
        // 图片按 765 token 估算（GPT-4o vision 实际值）
        if (part.type === 'image_url') inputTokens += 765;
      }
    }
  }
  const outputTokens = options?.expectedOutputTokens ?? 1000;
  const price = getModelPrice(modelName);
  if (!price) {
    return { inputTokens, outputTokens, inputUSD: 0, outputUSD: 0, totalUSD: 0, priceKnown: false };
  }
  const inputUSD = (inputTokens / 1_000_000) * price.inputPer1M;
  const outputUSD = (outputTokens / 1_000_000) * price.outputPer1M;
  return {
    inputTokens,
    outputTokens,
    inputUSD,
    outputUSD,
    totalUSD: inputUSD + outputUSD,
    priceKnown: true,
    priceLabel: price.label,
    priceNote: price.note,
  };
}

/** USD → CNY（粗略 1:7.2，可后续接入实时汇率） */
export function usdToCny(usd: number): number {
  return usd * 7.2;
}

/** 简短格式化：< $0.001 显示 "<0.01¢"；否则显示 "$X.XXXX" */
export function formatCostUSD(usd: number): string {
  if (usd === 0) return '$0';
  if (usd < 0.0001) return '<$0.0001';
  if (usd < 1) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}
