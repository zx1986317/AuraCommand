/**
 * P2 #6：语言切换器
 *
 * 两种形态：
 *  1. <LocaleSwitcher />           - 紧凑型（按钮 + 下拉）
 *  2. <LocaleSwitcher variant="segmented" /> - 分段型（中文/英文两个按钮并排）
 *
 * 接入 I18nProvider 后挂在设置/侧栏任意位置即可。
 */
import React, { useState, useRef, useEffect } from 'react';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { useTranslation } from './I18nContext';
import { LOCALE_LABELS, SUPPORTED_LOCALES, type Locale } from './index';

interface LocaleSwitcherProps {
  variant?: 'dropdown' | 'segmented';
  className?: string;
}

export const LocaleSwitcher: React.FC<LocaleSwitcherProps> = ({ variant = 'dropdown', className = '' }) => {
  const { locale, setLocale, availableLocales } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (variant === 'segmented') {
    return (
      <div className={`inline-flex items-center gap-1 p-1 rounded-xl bg-teal-900/5 border border-teal-900/10 ${className}`} data-testid="locale-switcher-segmented">
        {availableLocales.map((loc) => {
          const active = loc === locale;
          return (
            <button
              key={loc}
              onClick={() => setLocale(loc as Locale)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                active
                  ? 'bg-white text-accent shadow-sm'
                  : 'text-muted hover:text-foreground'
              }`}
              aria-pressed={active}
            >
              {LOCALE_LABELS[loc as Locale]}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div ref={ref} className={`relative inline-block ${className}`} data-testid="locale-switcher-dropdown">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted hover:text-foreground hover:bg-teal-900/5 transition-colors"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Globe size={13} className="opacity-70" />
        <span>{LOCALE_LABELS[locale]}</span>
        <ChevronDown size={11} className={`opacity-50 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 top-full mt-1 min-w-[140px] bg-white border border-teal-900/10 rounded-xl shadow-lg py-1 z-50"
        >
          {availableLocales.map((loc) => {
            const active = loc === locale;
            return (
              <li key={loc}>
                <button
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    setLocale(loc as Locale);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 text-xs hover:bg-teal-900/5 transition-colors ${
                    active ? 'text-accent font-bold' : 'text-foreground'
                  }`}
                >
                  <span>{LOCALE_LABELS[loc as Locale]}</span>
                  {active && <Check size={12} className="text-accent" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default LocaleSwitcher;

// 重新导出常量方便外部引用
export { LOCALE_LABELS, SUPPORTED_LOCALES, type Locale };
