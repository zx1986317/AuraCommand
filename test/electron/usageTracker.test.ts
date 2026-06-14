/**
 * P2 #3：多模型用量面板 - 单测
 */
import { describe, it, expect } from 'vitest';
import { aggregateUsage, formatRelativeTime, UsageRecord } from '../../electron/util/usageTracker';

const r = (over: Partial<UsageRecord>): UsageRecord => ({
  modelId: 'm1',
  modelName: 'gpt-4o',
  provider: 'openai',
  inputTokens: 1000,
  outputTokens: 500,
  costUSD: 0.005,
  estimated: true,
  at: Date.now(),
  ...over,
});

describe('aggregateUsage', () => {
  it('空记录：返回零值', () => {
    const s = aggregateUsage([]);
    expect(s.totalCalls).toBe(0);
    expect(s.totalCostUSD).toBe(0);
    expect(s.byModel).toEqual([]);
    expect(s.byProvider).toEqual([]);
  });

  it('单条记录：模型/Provider 各聚合为 1 行', () => {
    const s = aggregateUsage([r({})]);
    expect(s.totalCalls).toBe(1);
    expect(s.totalInputTokens).toBe(1000);
    expect(s.totalOutputTokens).toBe(500);
    expect(s.totalCostUSD).toBe(0.005);
    expect(s.byModel).toHaveLength(1);
    expect(s.byProvider).toHaveLength(1);
  });

  it('同模型多次调用：合并到一行 + 累加 token/cost', () => {
    const s = aggregateUsage([
      r({ at: 1000, costUSD: 0.01 }),
      r({ at: 2000, inputTokens: 500, outputTokens: 200, costUSD: 0.005 }),
      r({ at: 3000, costUSD: 0.02 }),
    ]);
    expect(s.totalCalls).toBe(3);
    expect(s.totalInputTokens).toBe(2500);
    expect(s.totalOutputTokens).toBe(1200);
    expect(s.totalCostUSD).toBeCloseTo(0.035, 4);
    expect(s.byModel).toHaveLength(1);
    expect(s.byModel[0]?.callCount).toBe(3);
    expect(s.byModel[0]?.lastUsedAt).toBe(3000);
  });

  it('多模型：按 costUSD 降序', () => {
    const s = aggregateUsage([
      r({ modelId: 'cheap', modelName: 'qwen-turbo', provider: 'dashscope', costUSD: 0.001 }),
      r({ modelId: 'mid', modelName: 'gpt-4o-mini', provider: 'openai', costUSD: 0.01 }),
      r({ modelId: 'expensive', modelName: 'gpt-4o', provider: 'openai', costUSD: 0.1 }),
    ]);
    expect(s.byModel[0]?.modelId).toBe('expensive');
    expect(s.byModel[1]?.modelId).toBe('mid');
    expect(s.byModel[2]?.modelId).toBe('cheap');
  });

  it('多 Provider：按 costUSD 降序', () => {
    const s = aggregateUsage([
      r({ provider: 'openai', costUSD: 0.1 }),
      r({ provider: 'openai', costUSD: 0.05 }),
      r({ provider: 'zhipu', costUSD: 0.001 }),
    ]);
    expect(s.byProvider[0]?.provider).toBe('openai');
    expect(s.byProvider[0]?.callCount).toBe(2);
    expect(s.byProvider[0]?.costUSD).toBeCloseTo(0.15, 4);
    expect(s.byProvider[1]?.provider).toBe('zhipu');
  });

  it('priced vs unpriced：costUSD > 0 视为 priced', () => {
    const s = aggregateUsage([
      r({ costUSD: 0.01, estimated: true }),
      r({ costUSD: 0, estimated: true }),  // 本地模型或未知价格
      r({ costUSD: 0, estimated: false }), // 手动记录
    ]);
    expect(s.pricedCalls).toBe(1);
    expect(s.unpricedCalls).toBe(2);
  });
});

describe('formatRelativeTime', () => {
  const now = 1700000000000;

  it('30 秒前 → 刚刚', () => {
    expect(formatRelativeTime(now - 30_000, now)).toBe('刚刚');
  });

  it('5 分钟前 → 5 分钟前', () => {
    expect(formatRelativeTime(now - 5 * 60_000, now)).toBe('5 分钟前');
  });

  it('2 小时前 → 2 小时前', () => {
    expect(formatRelativeTime(now - 2 * 3_600_000, now)).toBe('2 小时前');
  });

  it('3 天前 → 3 天前', () => {
    expect(formatRelativeTime(now - 3 * 86_400_000, now)).toBe('3 天前');
  });

  it('30 天前 → 完整日期', () => {
    const result = formatRelativeTime(now - 30 * 86_400_000, now);
    expect(result).toMatch(/^\d{4}\/\d{1,2}\/\d{1,2}$/);
  });

  it('时间戳为 0 → 从未', () => {
    expect(formatRelativeTime(0, now)).toBe('从未');
  });
});
