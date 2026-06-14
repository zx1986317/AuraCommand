/**
 * P2 #1：协议模板 - 验证 buildProviderTemplate 的自动填充行为
 */
import { describe, it, expect } from 'vitest';
import { buildProviderTemplate, getDefaultBaseUrl, getDefaultModel, PROVIDER_LABELS } from '../../src/components/settings/SettingsTypes';

describe('buildProviderTemplate', () => {
  describe('空表单时选择 Provider', () => {
    it('openai：自动填入 baseUrl 和 modelName', () => {
      const t = buildProviderTemplate('openai', '', '');
      expect(t.baseUrl).toBe('https://api.openai.com/v1');
      expect(t.modelName).toBe('gpt-4o');
      expect(t.isPreset).toBe(true);
    });

    it('claude：自动填入 Anthropic baseUrl', () => {
      const t = buildProviderTemplate('claude', '', '');
      expect(t.baseUrl).toBe('https://api.anthropic.com/v1');
      expect(t.modelName).toBe('claude-sonnet-4-20250514');
    });

    it('zhipu：自动填入智谱 baseUrl', () => {
      const t = buildProviderTemplate('zhipu', '', '');
      expect(t.baseUrl).toBe('https://open.bigmodel.cn/api/paas/v4');
      expect(t.modelName).toBe('glm-4-plus');
    });

    it('dashscope：自动填入通义 baseUrl', () => {
      const t = buildProviderTemplate('dashscope', '', '');
      expect(t.baseUrl).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1');
      expect(t.modelName).toBe('qwen-plus');
    });

    it('custom：不强制填默认值', () => {
      const t = buildProviderTemplate('custom', '', '');
      expect(t.baseUrl).toBe('');
      expect(t.modelName).toBe('');
      expect(t.isPreset).toBe(false);
    });
  });

  describe('用户已自定义时切换 Provider', () => {
    it('baseUrl 已被修改：保留用户的 baseUrl（不覆盖）', () => {
      const t = buildProviderTemplate('openai', 'https://my-proxy.example.com/v1', '');
      // 用户已输入自定义 baseUrl → 保留
      expect(t.baseUrl).toBe('https://my-proxy.example.com/v1');
      // modelName 仍为空 → 用默认
      expect(t.modelName).toBe('gpt-4o');
    });

    it('modelName 已被修改：保留用户的 modelName', () => {
      const t = buildProviderTemplate('openai', '', 'gpt-4o-mini');
      // baseUrl 仍为空 → 用默认
      expect(t.baseUrl).toBe('https://api.openai.com/v1');
      // 用户已输入自定义 modelName → 保留
      expect(t.modelName).toBe('gpt-4o-mini');
    });

    it('两者都已修改：完全保留用户输入', () => {
      const t = buildProviderTemplate('openai', 'https://my-proxy.example.com/v1', 'gpt-4o-mini');
      expect(t.baseUrl).toBe('https://my-proxy.example.com/v1');
      expect(t.modelName).toBe('gpt-4o-mini');
    });
  });

  describe('重置场景：用户清空字段后再次选择相同 Provider', () => {
    it('清空 baseUrl + 选 openai → 重新带入默认 baseUrl', () => {
      const t = buildProviderTemplate('openai', '', 'gpt-4o');
      expect(t.baseUrl).toBe('https://api.openai.com/v1');
      expect(t.modelName).toBe('gpt-4o');
    });
  });
});

describe('getDefaultBaseUrl / getDefaultModel 一致性', () => {
  it('所有 Provider 都有对应的 baseUrl', () => {
    ['openai', 'claude', 'zhipu', 'dashscope'].forEach(p => {
      expect(getDefaultBaseUrl(p)).not.toBe('');
    });
  });

  it('所有 Provider 都有对应的 modelName', () => {
    ['openai', 'claude', 'zhipu', 'dashscope'].forEach(p => {
      expect(getDefaultModel(p)).not.toBe('');
    });
  });

  it('custom 提供商返回空字符串（让用户自填）', () => {
    expect(getDefaultBaseUrl('custom')).toBe('');
    expect(getDefaultModel('custom')).toBe('');
  });

  it('未知 Provider 返回空字符串（不抛错）', () => {
    expect(getDefaultBaseUrl('unknown')).toBe('');
    expect(getDefaultModel('unknown')).toBe('');
  });
});

describe('PROVIDER_LABELS', () => {
  it('所有内置 Provider 都有中文显示名', () => {
    ['openai', 'claude', 'zhipu', 'dashscope', 'custom'].forEach(p => {
      expect(PROVIDER_LABELS[p]).toBeTruthy();
    });
  });
});
