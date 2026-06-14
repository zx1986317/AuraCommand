/**
 * P2 #6：i18n React 集成
 *
 * 用法：
 *   const { t, locale, setLocale } = useTranslation();
 *   <p>{t('common.confirm')}</p>
 *   <p>{t('ai.testing', { done: 2, total: 5 })}</p>
 *
 * 在 main.tsx 顶层用 <I18nProvider> 包裹一次即可
 */
import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import {
  translate,
  loadStoredLocale,
  storeLocale,
  DEFAULT_LOCALE,
  type Locale,
  type TranslationKey,
  SUPPORTED_LOCALES,
} from './index';

export interface I18nContextValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: (key: TranslationKey | string, params?: Record<string, string | number>) => string;
  /** 列出所有支持的 locale（用于切换器） */
  availableLocales: typeof SUPPORTED_LOCALES;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export const I18nProvider: React.FC<{ children: React.ReactNode; initialLocale?: Locale }> = ({
  children,
  initialLocale,
}) => {
  const [locale, setLocaleState] = useState<Locale>(() => initialLocale || loadStoredLocale());

  useEffect(() => {
    if (initialLocale) return;
    // 同步一次外部修改
    const latest = loadStoredLocale();
    if (latest !== locale) setLocaleState(latest);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    storeLocale(next);
  }, []);

  const t = useCallback(
    (key: TranslationKey | string, params?: Record<string, string | number>) => {
      return translate(locale, key, params);
    },
    [locale]
  );

  const value = useMemo<I18nContextValue>(
    () => ({ locale, setLocale, t, availableLocales: SUPPORTED_LOCALES }),
    [locale, setLocale, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export function useTranslation(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // 没装 Provider 时降级为默认 locale，避免崩溃
    return {
      locale: DEFAULT_LOCALE,
      setLocale: () => { /* noop */ },
      t: (key, params) => translate(DEFAULT_LOCALE, key, params),
      availableLocales: SUPPORTED_LOCALES,
    };
  }
  return ctx;
}
