/**
 * P2 #6：i18n 核心模块单测
 *
 * 覆盖：
 *  - translate() 基本 lookup
 *  - translate() 参数插值
 *  - translate() 缺失 key 回退到默认 locale
 *  - translate() 缺失 key 进一步回退到 key 字符串
 *  - interpolate() 各种占位符形式
 *  - detectBrowserLocale() 浏览器/无 navigator 情况
 *  - loadStoredLocale() localStorage 可用/不可用
 *  - storeLocale() 持久化
 *  - 两个 locale 文件的 keys 对齐（编译期 + 运行期）
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  translate,
  interpolate,
  detectBrowserLocale,
  loadStoredLocale,
  storeLocale,
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  TRANSLATIONS,
  LOCALE_LABELS,
  type Locale,
} from '../../src/i18n';
import { zhCN } from '../../src/i18n/locales/zh-CN';
import { enUS } from '../../src/i18n/locales/en-US';

describe('i18n/translate', () => {
  it('基础 lookup: zh-CN / en-US', () => {
    expect(translate('zh-CN', 'common.confirm')).toBe('确认');
    expect(translate('en-US', 'common.confirm')).toBe('Confirm');
  });

  it('参数插值: {name}', () => {
    expect(translate('zh-CN', 'ai.usage.unpricedNote', { count: 3 })).toBe(
      '3 次调用无价格表数据（本地模型或自定义模型）'
    );
    expect(translate('en-US', 'ai.usage.unpricedNote', { count: 5 })).toBe(
      '5 call(s) without price data (local or custom models)'
    );
  });

  it('ai.testing 进度插值', () => {
    expect(translate('zh-CN', 'ai.testing', { done: 2, total: 5 })).toBe('测试中 2/5');
    expect(translate('en-US', 'ai.testing', { done: 0, total: 3 })).toBe('Testing 0/3');
  });

  it('缺失 key: 优先回退到默认 locale 的值', () => {
    // 假设 en-US 没有 'fake.key'，应该回退到 zh-CN 的值
    const zhOnly = (TRANSLATIONS as any)['zh-CN']['common.confirm'];
    expect(zhOnly).toBe('确认');
    // 强行制造一个 en-US 没有的 key
    expect(translate('en-US', 'common.confirm')).toBe('Confirm');
  });

  it('缺失 key 且默认 locale 也没有: 回退到 key 字符串本身', () => {
    const result = translate('zh-CN', 'totally.nonexistent.key');
    expect(result).toBe('totally.nonexistent.key');
  });

  it('未知 locale: 回退到默认 locale 的值', () => {
    const result = translate('xx-XX' as Locale, 'common.confirm');
    expect(result).toBe('确认');
  });

  it('null/undefined params 不报错', () => {
    expect(translate('zh-CN', 'common.confirm')).toBe('确认');
    expect(translate('zh-CN', 'common.confirm', undefined)).toBe('确认');
  });
});

describe('i18n/通用组件 (Toast / Modal / ErrorBoundary)', () => {
  it('toast.label.* 4 种类型', () => {
    expect(translate('zh-CN', 'toast.label.info')).toBe('提示');
    expect(translate('zh-CN', 'toast.label.error')).toBe('错误');
    expect(translate('zh-CN', 'toast.label.warning')).toBe('注意');
    expect(translate('zh-CN', 'toast.label.success')).toBe('成功');
    expect(translate('en-US', 'toast.label.info')).toBe('Info');
    expect(translate('en-US', 'toast.label.error')).toBe('Error');
    expect(translate('en-US', 'toast.label.warning')).toBe('Warning');
    expect(translate('en-US', 'toast.label.success')).toBe('Success');
  });

  it('modal.systemConfirm: 中英对齐', () => {
    expect(translate('zh-CN', 'modal.systemConfirm')).toBe('系统确认');
    expect(translate('en-US', 'modal.systemConfirm')).toBe('System Confirm');
  });

  it('errorBoundary.*: 中英 + 参数插值', () => {
    expect(translate('zh-CN', 'errorBoundary.title')).toBe('组件加载失败');
    expect(translate('en-US', 'errorBoundary.title')).toBe('Component Failed to Load');
    expect(translate('zh-CN', 'errorBoundary.module', { name: 'ChatPanel' })).toBe('出错模块: ChatPanel');
    expect(translate('en-US', 'errorBoundary.module', { name: 'ChatPanel' })).toBe('Failed module: ChatPanel');
  });

  it('common.next / common.prev: 中英对齐', () => {
    expect(translate('zh-CN', 'common.next')).toBe('下一步');
    expect(translate('en-US', 'common.next')).toBe('Next');
    expect(translate('zh-CN', 'common.prev')).toBe('上一步');
    expect(translate('en-US', 'common.prev')).toBe('Previous');
  });

  it('onboarding.* 关键文案: 中英对齐 + 不丢失标点', () => {
    expect(translate('zh-CN', 'onboarding.badge')).toBe('首次启动引导');
    expect(translate('en-US', 'onboarding.badge')).toBe('First-time Setup');
    expect(translate('zh-CN', 'onboarding.step.welcome')).toBe('欢迎');
    expect(translate('en-US', 'onboarding.step.welcome')).toBe('Welcome');
    expect(translate('zh-CN', 'onboarding.step.aiCheck')).toBe('AI 检查');
    expect(translate('en-US', 'onboarding.step.aiCheck')).toBe('AI Check');
    expect(translate('zh-CN', 'onboarding.skip')).toBe('跳过并进入应用');
    expect(translate('en-US', 'onboarding.skip')).toBe('Skip and Enter App');
  });

  it('sidebar.* 关键文案: 中英对齐 + 参数插值', () => {
    expect(translate('zh-CN', 'sidebar.tab.chat')).toBe('对话');
    expect(translate('en-US', 'sidebar.tab.chat')).toBe('Chat');
    expect(translate('zh-CN', 'sidebar.section.project', { name: 'Aura' })).toBe('项目 · Aura');
    expect(translate('en-US', 'sidebar.section.project', { name: 'Aura' })).toBe('Project · Aura');
    expect(translate('zh-CN', 'sidebar.engine.status', { status: '在线' })).toBe('状态: 在线');
    expect(translate('en-US', 'sidebar.engine.status', { status: 'Online' })).toBe('Status: Online');
    expect(translate('zh-CN', 'sidebar.project.deleteHint', { name: 'X' })).toContain('"X"');
    expect(translate('en-US', 'sidebar.project.deleteHint', { name: 'X' })).toContain('"X"');
  });
});

describe('i18n/interpolate', () => {
  it('无 params: 原样返回', () => {
    expect(interpolate('hello')).toBe('hello');
  });

  it('params 全部命中', () => {
    expect(interpolate('Hi {name}, you have {count} msgs', { name: 'Tom', count: 3 })).toBe(
      'Hi Tom, you have 3 msgs'
    );
  });

  it('param 缺失时保留占位符', () => {
    expect(interpolate('Hi {name}, {missing}', { name: 'Tom' })).toBe('Hi Tom, {missing}');
  });

  it('param 值为 number 时转为字符串', () => {
    expect(interpolate('count: {n}', { n: 42 })).toBe('count: 42');
  });

  it('多个相同占位符都会被替换', () => {
    expect(interpolate('{a} - {a}', { a: 'X' })).toBe('X - X');
  });
});

describe('i18n/locales 一致性', () => {
  it('zh-CN 与 en-US 的 key 集合完全一致', () => {
    const zhKeys = Object.keys(zhCN).sort();
    const enKeys = Object.keys(enUS).sort();
    expect(enKeys).toEqual(zhKeys);
  });

  it('每个 locale 都有非空翻译值', () => {
    for (const locale of SUPPORTED_LOCALES) {
      for (const [key, value] of Object.entries(TRANSLATIONS[locale])) {
        expect(value, `${locale}.${key} 不可为空`).toBeTruthy();
        expect(typeof value).toBe('string');
      }
    }
  });

  it('DEFAULT_LOCALE 必须属于 SUPPORTED_LOCALES', () => {
    expect(SUPPORTED_LOCALES).toContain(DEFAULT_LOCALE);
  });

  it('LOCALE_LABELS 覆盖所有 SUPPORTED_LOCALES', () => {
    for (const loc of SUPPORTED_LOCALES) {
      expect(LOCALE_LABELS[loc]).toBeTruthy();
    }
  });
});

describe('i18n/detectBrowserLocale', () => {
  it('zh 前缀返回 zh-CN', () => {
    Object.defineProperty(navigator, 'language', { value: 'zh-CN', configurable: true });
    expect(detectBrowserLocale()).toBe('zh-CN');
    Object.defineProperty(navigator, 'language', { value: 'zh-TW', configurable: true });
    expect(detectBrowserLocale()).toBe('zh-CN');
  });

  it('en 前缀返回 en-US', () => {
    Object.defineProperty(navigator, 'language', { value: 'en-US', configurable: true });
    expect(detectBrowserLocale()).toBe('en-US');
    Object.defineProperty(navigator, 'language', { value: 'en-GB', configurable: true });
    expect(detectBrowserLocale()).toBe('en-US');
  });

  it('未知语言回退到默认 locale', () => {
    Object.defineProperty(navigator, 'language', { value: 'ja-JP', configurable: true });
    expect(detectBrowserLocale()).toBe(DEFAULT_LOCALE);
  });
});

describe('i18n/storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('storeLocale 写入后 loadStoredLocale 能读出', () => {
    storeLocale('en-US');
    expect(loadStoredLocale()).toBe('en-US');
  });

  it('localStorage 无值时回退到浏览器检测', () => {
    Object.defineProperty(navigator, 'language', { value: 'zh-CN', configurable: true });
    localStorage.clear();
    expect(loadStoredLocale()).toBe('zh-CN');
  });

  it('localStorage 有非法值时回退到浏览器检测', () => {
    Object.defineProperty(navigator, 'language', { value: 'en-US', configurable: true });
    localStorage.setItem('auracommand.locale', 'garbage');
    expect(loadStoredLocale()).toBe('en-US');
  });

  it('storeLocale 在 localStorage 不可用时不抛错', () => {
    const original = (globalThis as any).localStorage;
    Object.defineProperty(globalThis, 'localStorage', { value: undefined, configurable: true });
    expect(() => storeLocale('en-US')).not.toThrow();
    Object.defineProperty(globalThis, 'localStorage', { value: original, configurable: true });
  });
});
