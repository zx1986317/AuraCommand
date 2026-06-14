/**
 * 费用预估单测：覆盖 token 估算、已知/未知模型定价、CNY 换算
 */
import { describe, it, expect } from 'vitest';
import {
  estimateTokens,
  getModelPrice,
  estimateChatCost,
  usdToCny,
  formatCostUSD,
} from '../../electron/util/costEstimate';

describe('costEstimate (P1 费用预估)', () => {
  describe('estimateTokens', () => {
    it('空串返回 0', () => {
      expect(estimateTokens('')).toBe(0);
    });

    it('纯英文：约 4 字符/token', () => {
      // 100 个英文/空格/标点 ≈ 25 tokens
      const t = 'a'.repeat(100);
      const n = estimateTokens(t);
      expect(n).toBeGreaterThanOrEqual(20);
      expect(n).toBeLessThanOrEqual(35);
    });

    it('纯中文：约 1.5 字符/token', () => {
      // 60 个中文字符 ≈ 40 tokens
      const t = '你好'.repeat(30);
      const n = estimateTokens(t);
      expect(n).toBeGreaterThanOrEqual(35);
      expect(n).toBeLessThanOrEqual(50);
    });
  });

  describe('getModelPrice', () => {
    it('精确匹配返回内置价格', () => {
      const p = getModelPrice('gpt-4o');
      expect(p).not.toBeNull();
      expect(p?.inputPer1M).toBe(2.5);
    });

    it('模糊匹配：gpt-4o-2024-08-06 命中 gpt-4o', () => {
      const p = getModelPrice('gpt-4o-2024-08-06');
      expect(p?.label).toBe('GPT-4o');
    });

    it('未知模型返回 null', () => {
      expect(getModelPrice('mystery-model-9000')).toBeNull();
    });
  });

  describe('estimateChatCost', () => {
    it('已知模型：input * 1M/price', () => {
      const r = estimateChatCost('openai', 'gpt-4o-mini', [
        { role: 'user', content: 'hello world this is a test' },
      ], { expectedOutputTokens: 1000 });
      expect(r.priceKnown).toBe(true);
      expect(r.inputTokens).toBeGreaterThan(0);
      expect(r.outputUSD).toBeCloseTo(0.0006, 4); // 1000/1e6 * 0.6
    });

    it('未知模型：priceKnown=false, USD=0', () => {
      const r = estimateChatCost('openai', 'gpt-99999', [
        { role: 'user', content: 'hi' },
      ]);
      expect(r.priceKnown).toBe(false);
      expect(r.totalUSD).toBe(0);
    });

    it('图片消息按 765 token 估算', () => {
      const r = estimateChatCost('openai', 'gpt-4o', [
        { role: 'user', content: [{ type: 'text', text: '看看这张图' }, { type: 'image_url', image_url: { url: 'data:image/png;base64,xxx' } }] },
      ]);
      expect(r.inputTokens).toBeGreaterThanOrEqual(765);
    });
  });

  describe('utils', () => {
    it('usdToCny 1:7.2', () => {
      expect(usdToCny(1)).toBeCloseTo(7.2, 5);
    });
    it('formatCostUSD 各种量级', () => {
      expect(formatCostUSD(0)).toBe('$0');
      expect(formatCostUSD(0.00001)).toBe('<$0.0001');
      expect(formatCostUSD(0.123)).toBe('$0.1230');
      expect(formatCostUSD(2.5)).toBe('$2.50');
    });
  });
});
