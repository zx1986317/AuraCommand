/**
 * P1 #7：modelKind 工具单测
 * 覆盖：云端/本地/未知三类判定
 */
import { describe, it, expect } from 'vitest';
import { getModelKind } from '../../src/utils/modelKind';

describe('getModelKind (P1 #7 model badge)', () => {
  it('空字符串/缺省 → unknown', () => {
    expect(getModelKind('')).toBe('unknown');
    expect(getModelKind(undefined)).toBe('unknown');
    expect(getModelKind(null)).toBe('unknown');
  });

  it('显式 cloudModelId 一定返回 cloud', () => {
    expect(getModelKind('llama3:8b', 'm2')).toBe('cloud');
    expect(getModelKind(undefined, 'm2')).toBe('cloud');
  });

  it('☁️ 前缀 → cloud', () => {
    expect(getModelKind('☁️ gpt-4o')).toBe('cloud');
    expect(getModelKind('☁️ qwen-max')).toBe('cloud');
  });

  it('常见云端命名 → cloud', () => {
    expect(getModelKind('gpt-4o')).toBe('cloud');
    expect(getModelKind('gpt-4o-mini')).toBe('cloud');
    expect(getModelKind('claude-3-5-sonnet')).toBe('cloud');
    expect(getModelKind('gemini-pro')).toBe('cloud');
    expect(getModelKind('qwen-max')).toBe('cloud');
    expect(getModelKind('deepseek-chat')).toBe('cloud');
    expect(getModelKind('glm-4-plus')).toBe('cloud');
  });

  it('典型本地命名 → local', () => {
    expect(getModelKind('llama3:8b')).toBe('local');
    expect(getModelKind('qwen2.5:7b')).toBe('local');
    expect(getModelKind('qwen3:14b')).toBe('local');
    expect(getModelKind('mistral:7b')).toBe('local');
    expect(getModelKind('mixtral:8x7b')).toBe('local');
    expect(getModelKind('deepseek-r1:7b')).toBe('local');
  });

  it('未识别的命名 → unknown', () => {
    expect(getModelKind('mystery-model-9000')).toBe('unknown');
    expect(getModelKind('custom-finetune-v3')).toBe('unknown');
  });

  it('大小写不敏感', () => {
    expect(getModelKind('LLAMA3:8B')).toBe('local');
    expect(getModelKind('GPT-4O')).toBe('cloud');
  });
});
