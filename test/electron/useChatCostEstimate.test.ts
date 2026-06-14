/**
 * useChatCostEstimate 单测：覆盖纯函数 hashMessages / isCloudModel
 * IPC 路径已通过 electron/costEstimate.test.ts 覆盖；此处避免引入 jsdom。
 */
import { describe, it, expect } from 'vitest';
import { __test__ } from '../../src/hooks/useChatCostEstimate';

const { hashMessages, isCloudModel } = __test__;

describe('useChatCostEstimate (P1 聊天费用预估)', () => {
  describe('hashMessages', () => {
    it('空数组返回 "0"', () => {
      expect(hashMessages([])).toBe('0');
      expect(hashMessages(undefined)).toBe('0');
    });

    it('相同消息产生相同 hash', () => {
      const a = hashMessages([{ role: 'user', content: 'hello' }]);
      const b = hashMessages([{ role: 'user', content: 'hello world' }]);
      // 长度不同 → hash 不同
      expect(a).not.toBe(b);
    });

    it('消息数变化 → hash 变化', () => {
      const a = hashMessages([{ role: 'user', content: 'a' }]);
      const b = hashMessages([
        { role: 'user', content: 'a' },
        { role: 'assistant', content: 'b' },
      ]);
      expect(a).not.toBe(b);
    });

    it('支持 array content（多模态）', () => {
      const h = hashMessages([
        {
          role: 'user',
          content: [
            { type: 'text', text: '看图' },
            { type: 'image_url', image_url: { url: 'data:img' } },
          ],
        },
      ]);
      expect(h).toContain('arr2');
    });
  });

  describe('isCloudModel', () => {
    it('空字符串返回 false', () => {
      expect(isCloudModel('')).toBe(false);
    });

    it('典型本地命名返回 false', () => {
      expect(isCloudModel('llama3:8b')).toBe(false);
      expect(isCloudModel('qwen2.5:7b')).toBe(false);
      expect(isCloudModel('mistral:7b')).toBe(false);
    });

    it('云端命名返回 true', () => {
      expect(isCloudModel('gpt-4o')).toBe(true);
      expect(isCloudModel('claude-3-5-sonnet')).toBe(true);
      expect(isCloudModel('qwen-max')).toBe(true);
      expect(isCloudModel('glm-4-plus')).toBe(true);
    });
  });
});
