import React, { useEffect, useState } from 'react';
import { Sun, Moon, Sparkles, Monitor } from 'lucide-react';
import { useTranslation } from './I18nContext';

export type ThemeKey = 'default' | 'dark' | 'retro' | 'system';
export type ResolvedTheme = 'default' | 'dark' | 'retro';

const STORAGE_KEY = 'theme';

interface ThemeSwitcherProps {
  /** 显示样式：segmented 横向卡片 / dropdown 紧凑下拉 */
  variant?: 'segmented' | 'compact';
  className?: string;
}

/**
 * P3 任务 1：深色模式 / 主题切换优化
 *
 * 关键能力：
 *  - 三套主题：default（浅色 Teal）、dark（深色 Teal）、retro（复古米色）
 *  - "跟随系统"：监听 prefers-color-scheme，OS 切换深浅时自动同步
 *  - 即时预览：悬停时短暂切换预览，点击确认才写入 localStorage
 *  - 持久化：写入 localStorage + 设置 document.documentElement[data-theme]
 *
 * 设计取舍：
 *  - 选择 system 时，预解析出 'default' / 'dark'，data-theme 始终保持具体主题，
 *    这样深色组件的 CSS 变量能正常命中。
 *  - 即时预览通过本地 state 暂存 candidate，避免误触后立即污染 localStorage。
 */
const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ variant = 'segmented', className = '' }) => {
  const { t } = useTranslation();
  const [theme, setTheme] = useState<ThemeKey>(() => {
    if (typeof localStorage === 'undefined') return 'default';
    return (localStorage.getItem(STORAGE_KEY) as ThemeKey) || 'default';
  });
  const [previewTheme, setPreviewTheme] = useState<ThemeKey | null>(null);
  const [systemTheme, setSystemTheme] = useState<'default' | 'dark'>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return 'default';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'default';
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'default');
    };
    if (mql.addEventListener) mql.addEventListener('change', onChange);
    else mql.addListener(onChange);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', onChange);
      else mql.removeListener(onChange);
    };
  }, []);

  // 解析出最终需要写入 data-theme 的具体主题
  const resolved: ResolvedTheme = previewTheme
    ? (previewTheme === 'system' ? systemTheme : (previewTheme as ResolvedTheme))
    : theme === 'system'
      ? systemTheme
      : (theme as ResolvedTheme);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-theme', resolved);
  }, [resolved]);

  const apply = (next: ThemeKey) => {
    setTheme(next);
    setPreviewTheme(null);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, next);
    }
  };

  const options: { key: ThemeKey; label: string; desc: string; icon: React.ReactNode; swatch: string }[] = [
    {
      key: 'default',
      label: t('theme.option.default'),
      desc: t('theme.option.defaultDesc'),
      icon: <Sun size={14} />,
      swatch: 'linear-gradient(135deg, #F0FDFA 0%, #5EEAD4 100%)',
    },
    {
      key: 'dark',
      label: t('theme.option.dark'),
      desc: t('theme.option.darkDesc'),
      icon: <Moon size={14} />,
      swatch: 'linear-gradient(135deg, #0A1F1D 0%, #2DD4BF 100%)',
    },
    {
      key: 'retro',
      label: t('theme.option.retro'),
      desc: t('theme.option.retroDesc'),
      icon: <Sparkles size={14} />,
      swatch: 'linear-gradient(135deg, #FDF8F1 0%, #8D6E63 100%)',
    },
    {
      key: 'system',
      label: t('theme.followSystem'),
      desc: t('theme.followSystemDesc'),
      icon: <Monitor size={14} />,
      swatch: 'linear-gradient(135deg, #F0FDFA 0%, #F0FDFA 50%, #0A1F1D 50%, #0A1F1D 100%)',
    },
  ];

  if (variant === 'compact') {
    const active = previewTheme ?? theme;
    return (
      <div className={`flex items-center gap-1 p-1 rounded-2xl bg-white/40 border border-teal-900/5 ${className}`}>
        {options.map(opt => (
          <button
            key={opt.key}
            onClick={() => apply(opt.key)}
            onMouseEnter={() => setPreviewTheme(opt.key)}
            onMouseLeave={() => setPreviewTheme(null)}
            className={`px-3 py-1.5 rounded-xl text-2xs font-bold flex items-center gap-1.5 transition-all ${
              active === opt.key
                ? 'bg-accent text-white shadow-glass'
                : 'text-muted hover:text-foreground hover:bg-white/60'
            }`}
            title={opt.desc}
            aria-pressed={active === opt.key}
          >
            {opt.icon}
            <span>{opt.label}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-2 sm:grid-cols-4 gap-3 ${className}`}>
      {options.map(opt => {
        const active = (previewTheme ?? theme) === opt.key;
        return (
          <button
            key={opt.key}
            onClick={() => apply(opt.key)}
            onMouseEnter={() => setPreviewTheme(opt.key)}
            onMouseLeave={() => setPreviewTheme(null)}
            onFocus={() => setPreviewTheme(opt.key)}
            onBlur={() => setPreviewTheme(null)}
            className={`group relative flex flex-col items-start gap-2 p-4 rounded-2xl border text-left transition-all overflow-hidden ${
              active
                ? 'border-accent bg-accent/5 shadow-glass'
                : 'border-teal-900/5 bg-white/40 hover:border-accent/30 hover:bg-white/60'
            }`}
            aria-pressed={active}
          >
            <div
              className="w-full h-12 rounded-xl border border-black/5"
              style={{ background: opt.swatch }}
            />
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <span className="text-accent">{opt.icon}</span>
              {opt.label}
            </div>
            <div className="text-2xs text-muted leading-relaxed">{opt.desc}</div>
            {active && (
              <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-accent shadow-[0_0_10px_rgba(13,148,136,0.6)]" />
            )}
          </button>
        );
      })}
    </div>
  );
};

export default ThemeSwitcher;

/**
 * 在 main.tsx 挂载前同步读取 localStorage 中的主题并应用到 <html data-theme="...">，
 * 避免 React 首次渲染前的"闪白/闪黑"。
 */
export function applyStoredTheme(): void {
  if (typeof document === 'undefined') return;
  let key: ThemeKey = 'default';
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'default' || stored === 'dark' || stored === 'retro' || stored === 'system') {
      key = stored;
    }
  } catch {
    // ignore
  }
  const systemDark = typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false;
  const resolved: ResolvedTheme = key === 'system' ? (systemDark ? 'dark' : 'default') : (key as ResolvedTheme);
  document.documentElement.setAttribute('data-theme', resolved);
}
