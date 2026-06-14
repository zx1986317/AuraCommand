/**
 * 多模型用量追踪 - 纯函数与类型定义
 *
 * 从 electron/util/usageTracker.ts 迁移纯函数部分至 src/shared/，
 * 供渲染进程直接引用，避免 Vite 打包时触发 require('electron')。
 *
 * 带持久化的 UsageTrackerImpl 单例保留在 electron/util/usageTracker.ts，
 * 仅在主进程中使用。
 */

export interface UsageRecord {
  modelId: string;
  modelName: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  /** 单次费用（USD），可为 0（本地模型或未知价格） */
  costUSD: number;
  /** 是否为本估算（true = 用 token 估算 + 价格表；false = 用户手动标记/外部传入） */
  estimated: boolean;
  /** 毫秒时间戳 */
  at: number;
}

export interface ModelUsageStats {
  modelId: string;
  modelName: string;
  provider: string;
  callCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUSD: number;
  lastUsedAt: number;
}

export interface OverallUsageStats {
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUSD: number;
  /** 已知价格 vs 未知价格的占比 */
  pricedCalls: number;
  unpricedCalls: number;
  byModel: ModelUsageStats[];
  byProvider: Array<{ provider: string; callCount: number; costUSD: number }>;
  updatedAt: number;
}

/** 纯函数：从 records 聚合整体统计 */
export function aggregateUsage(records: UsageRecord[]): OverallUsageStats {
  if (records.length === 0) {
    return {
      totalCalls: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCostUSD: 0,
      pricedCalls: 0,
      unpricedCalls: 0,
      byModel: [],
      byProvider: [],
      updatedAt: Date.now(),
    };
  }

  const byModelMap = new Map<string, ModelUsageStats>();
  const byProviderMap = new Map<string, { callCount: number; costUSD: number }>();
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCostUSD = 0;
  let pricedCalls = 0;
  let unpricedCalls = 0;

  for (const r of records) {
    totalInputTokens += r.inputTokens;
    totalOutputTokens += r.outputTokens;
    totalCostUSD += r.costUSD;
    if (r.costUSD > 0) pricedCalls++;
    if (r.costUSD === 0) unpricedCalls++;

    let ms = byModelMap.get(r.modelId);
    if (!ms) {
      ms = {
        modelId: r.modelId,
        modelName: r.modelName,
        provider: r.provider,
        callCount: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCostUSD: 0,
        lastUsedAt: 0,
      };
      byModelMap.set(r.modelId, ms);
    }
    ms.callCount++;
    ms.totalInputTokens += r.inputTokens;
    ms.totalOutputTokens += r.outputTokens;
    ms.totalCostUSD += r.costUSD;
    if (r.at > ms.lastUsedAt) ms.lastUsedAt = r.at;

    const p = byProviderMap.get(r.provider) || { callCount: 0, costUSD: 0 };
    p.callCount++;
    p.costUSD += r.costUSD;
    byProviderMap.set(r.provider, p);
  }

  return {
    totalCalls: records.length,
    totalInputTokens,
    totalOutputTokens,
    totalCostUSD,
    pricedCalls,
    unpricedCalls,
    byModel: Array.from(byModelMap.values()).sort((a, b) => b.totalCostUSD - a.totalCostUSD),
    byProvider: Array.from(byProviderMap.entries())
      .map(([provider, v]) => ({ provider, ...v }))
      .sort((a, b) => b.costUSD - a.costUSD),
    updatedAt: Date.now(),
  };
}

/** 把秒级时间戳格式化为友好的相对时间 */
export function formatRelativeTime(ts: number, now: number = Date.now()): string {
  if (!ts) return '从未';
  const diff = now - ts;
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 86_400_000)} 小时前`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`;
  return new Date(ts).toLocaleDateString('zh-CN');
}
