/**
 * P2 #6：国际化（i18n）框架 - 核心类型与基础工具
 *
 * 设计目标：
 *  - 轻量：不到 100 行的核心实现
 *  - 类型安全：所有翻译 key 必须是已声明的
 *  - 可扩展：新增 locale 只需新增一个文件，无需改核心
 *  - 失败安全：缺失 key 时回退到 key 字符串本身（永远不抛错）
 */
import { zhCN, type ZhCNKeys } from './locales/zh-CN';
import { enUS, type EnUSKeys } from './locales/en-US';

export const SUPPORTED_LOCALES = ['zh-CN', 'en-US'] as const;
export type Locale = typeof SUPPORTED_LOCALES[number];

export const LOCALE_LABELS: Record<Locale, string> = {
  'zh-CN': '简体中文',
  'en-US': 'English',
};

/** 所有翻译 key 的并集（确保跨 locale 一致） */
export type TranslationKey = ZhCNKeys & EnUSKeys;

/** 翻译表：locale → 字典 */
export const TRANSLATIONS: Record<Locale, Record<string, string>> = {
  'zh-CN': zhCN,
  'en-US': enUS,
};

/** 默认 locale（首次启动 / 用户未设置） */
export const DEFAULT_LOCALE: Locale = 'zh-CN';

const STORAGE_KEY = 'auracommand.locale';

/** 简单参数插值：支持 {name} 风格的占位符 */
export function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return key in params ? String(params[key]) : match;
  });
}

/** 核心翻译函数（纯函数，可单测） */
export function translate(locale: Locale, key: string, params?: Record<string, string | number>): string {
  const dict = TRANSLATIONS[locale] || TRANSLATIONS[DEFAULT_LOCALE];
  const raw = dict[key];
  if (raw === undefined) {
    // 回退：先试默认 locale，再回退到 key 本身
    const fallback = TRANSLATIONS[DEFAULT_LOCALE][key];
    if (fallback !== undefined) return interpolate(fallback, params);
    if (typeof console !== 'undefined') {
      console.warn(`[i18n] missing key: ${key}`);
    }
    return key;
  }
  return interpolate(raw, params);
}

/** 浏览器/electron 渲染器可用的 locale 检测 */
export function detectBrowserLocale(): Locale {
  try {
    const lang = (typeof navigator !== 'undefined' && (navigator.language || (navigator as any).userLanguage)) || '';
    if (lang.toLowerCase().startsWith('zh')) return 'zh-CN';
    if (lang.toLowerCase().startsWith('en')) return 'en-US';
  } catch { /* SSR / 测试环境 */ }
  return DEFAULT_LOCALE;
}

/** 从 localStorage 读取用户偏好，没有就回退到浏览器检测 */
export function loadStoredLocale(): Locale {
  try {
    if (typeof localStorage === 'undefined') return detectBrowserLocale();
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED_LOCALES.includes(stored as Locale)) {
      return stored as Locale;
    }
  } catch { /* localStorage 不可用 */ }
  return detectBrowserLocale();
}

/** 持久化到 localStorage */
export function storeLocale(locale: Locale): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, locale);
    }
  } catch { /* 静默失败 */ }
}
