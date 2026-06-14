/**
 * P3 任务 1：ThemeSwitcher 单元测试
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock localStorage
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); },
  get length() { return Object.keys(store).length; },
  key: (_i: number) => null,
};

beforeEach(() => {
  localStorageMock.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('ThemeSwitcher / applyStoredTheme', () => {
  it('默认主题为 default', async () => {
    // Override globalThis.localStorage for JSDOM
    vi.stubGlobal('localStorage', localStorageMock);
    const { applyStoredTheme } = await import('../../src/i18n/ThemeSwitcher');
    applyStoredTheme();
    expect(document.documentElement.getAttribute('data-theme')).toBe('default');
  });

  it('从 localStorage 读取 dark', async () => {
    store['theme'] = 'dark';
    vi.stubGlobal('localStorage', localStorageMock);
    const { applyStoredTheme } = await import('../../src/i18n/ThemeSwitcher');
    applyStoredTheme();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('从 localStorage 读取 retro', async () => {
    store['theme'] = 'retro';
    vi.stubGlobal('localStorage', localStorageMock);
    const { applyStoredTheme } = await import('../../src/i18n/ThemeSwitcher');
    applyStoredTheme();
    expect(document.documentElement.getAttribute('data-theme')).toBe('retro');
  });

  it('无效值回退到 default', async () => {
    store['theme'] = 'invalid-theme';
    vi.stubGlobal('localStorage', localStorageMock);
    const { applyStoredTheme } = await import('../../src/i18n/ThemeSwitcher');
    applyStoredTheme();
    expect(document.documentElement.getAttribute('data-theme')).toBe('default');
  });
});
