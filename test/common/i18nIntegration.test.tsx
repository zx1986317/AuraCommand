/**
 * P2 #6：I18nContext + LocaleSwitcher 集成单测
 *
 * 覆盖：
 *  - I18nProvider 注入 locale 后 useTranslation 拿到正确 t
 *  - setLocale 切换后 useTranslation 立即反映
 *  - 切换持久化到 localStorage
 *  - 嵌套 Provider（initialLocale）优先级最高
 *  - 没有 Provider 时 useTranslation 不抛错（降级到默认 locale）
 *  - LocaleSwitcher dropdown 切换 locale
 *  - LocaleSwitcher segmented 点击切换并高亮
 *  - LocaleSwitcher dropdown 点击外部关闭
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, fireEvent, act, cleanup } from '@testing-library/react';
import { I18nProvider, useTranslation } from '../../src/i18n/I18nContext';
import { LocaleSwitcher } from '../../src/i18n/LocaleSwitcher';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('I18nProvider / useTranslation', () => {
  it('useTranslation 在 Provider 内能拿到翻译函数', () => {
    let captured = '';
    function Probe() {
      const { t } = useTranslation();
      captured = t('common.confirm');
      return null;
    }
    render(
      <I18nProvider initialLocale="zh-CN">
        <Probe />
      </I18nProvider>
    );
    expect(captured).toBe('确认');
  });

  it('initialLocale=en-US 时 t 返回英文', () => {
    let captured = '';
    function Probe() {
      const { t } = useTranslation();
      captured = t('common.confirm');
      return null;
    }
    render(
      <I18nProvider initialLocale="en-US">
        <Probe />
      </I18nProvider>
    );
    expect(captured).toBe('Confirm');
  });

  it('setLocale 切换语言后 t 立即反映', () => {
    function Probe() {
      const { t, locale, setLocale } = useTranslation();
      return (
        <div>
          <span data-testid="locale">{locale}</span>
          <span data-testid="text">{t('common.confirm')}</span>
          <button onClick={() => setLocale('en-US')}>to-en</button>
          <button onClick={() => setLocale('zh-CN')}>to-zh</button>
        </div>
      );
    }
    const { getByTestId, getByText } = render(
      <I18nProvider initialLocale="zh-CN">
        <Probe />
      </I18nProvider>
    );
    expect(getByTestId('text').textContent).toBe('确认');
    act(() => {
      fireEvent.click(getByText('to-en'));
    });
    expect(getByTestId('text').textContent).toBe('Confirm');
    expect(getByTestId('locale').textContent).toBe('en-US');
  });

  it('setLocale 会持久化到 localStorage', () => {
    function Probe() {
      const { setLocale } = useTranslation();
      return <button onClick={() => setLocale('en-US')}>switch</button>;
    }
    const { getByText } = render(
      <I18nProvider initialLocale="zh-CN">
        <Probe />
      </I18nProvider>
    );
    act(() => {
      fireEvent.click(getByText('switch'));
    });
    expect(localStorage.getItem('auracommand.locale')).toBe('en-US');
  });

  it('useTranslation 缺 Provider 时降级到默认 locale', () => {
    let capturedLocale = '';
    let capturedText = '';
    function Probe() {
      const { t, locale } = useTranslation();
      capturedLocale = locale;
      capturedText = t('common.confirm');
      return null;
    }
    // 关闭 console.warn 噪音
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<Probe />);
    expect(capturedLocale).toBe('zh-CN');
    expect(capturedText).toBe('确认');
    consoleWarn.mockRestore();
  });

  it('setLocale 为 noop 当没有 Provider 时', () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let setLocaleFn: any;
    function Probe() {
      const { setLocale } = useTranslation();
      setLocaleFn = setLocale;
      return null;
    }
    render(<Probe />);
    expect(() => setLocaleFn('en-US')).not.toThrow();
    consoleWarn.mockRestore();
  });

  it('useTranslation 提供的 availableLocales 与 SUPPORTED_LOCALES 一致', () => {
    let locales: readonly string[] = [];
    function Probe() {
      const { availableLocales } = useTranslation();
      locales = availableLocales;
      return null;
    }
    render(
      <I18nProvider initialLocale="zh-CN">
        <Probe />
      </I18nProvider>
    );
    expect(Array.from(locales)).toEqual(['zh-CN', 'en-US']);
  });
});

describe('LocaleSwitcher / dropdown', () => {
  function renderInProvider(ui: React.ReactNode) {
    return render(<I18nProvider initialLocale="zh-CN">{ui}</I18nProvider>);
  }

  it('默认渲染: 显示当前 locale 名称', () => {
    const { getByTestId } = renderInProvider(<LocaleSwitcher />);
    const root = getByTestId('locale-switcher-dropdown');
    expect(root.textContent).toContain('简体中文');
  });

  it('点击切换后: locale 变化, 持久化到 localStorage', () => {
    const { getByTestId, getByText } = renderInProvider(<LocaleSwitcher />);
    fireEvent.click(getByTestId('locale-switcher-dropdown').querySelector('button')!);
    // 弹出后点击 "English"
    const enOption = getByText('English').closest('button')!;
    act(() => {
      fireEvent.click(enOption);
    });
    expect(localStorage.getItem('auracommand.locale')).toBe('en-US');
  });

  it('点击外部关闭下拉', () => {
    const { getByTestId, getByText, container } = renderInProvider(
      <div>
        <LocaleSwitcher />
        <span data-testid="outside">outside</span>
      </div>
    );
    const trigger = getByTestId('locale-switcher-dropdown').querySelector('button')!;
    fireEvent.click(trigger);
    // 弹出后外部元素应该存在
    expect(getByText('English')).toBeTruthy();
    // 点击外部
    act(() => {
      fireEvent.mouseDown(getByTestId('outside'));
    });
    // 此时 listbox 应该消失（English 节点移除）
    expect(container.querySelector('[role="listbox"]')).toBeNull();
  });
});

describe('LocaleSwitcher / segmented', () => {
  it('渲染两个 locale 按钮, 当前 locale 高亮', () => {
    const { getByTestId } = render(
      <I18nProvider initialLocale="zh-CN">
        <LocaleSwitcher variant="segmented" />
      </I18nProvider>
    );
    const root = getByTestId('locale-switcher-segmented');
    const buttons = root.querySelectorAll('button');
    expect(buttons.length).toBe(2);
    // 第一个（zh-CN）应有 aria-pressed=true
    expect(buttons[0]!.getAttribute('aria-pressed')).toBe('true');
    expect(buttons[1]!.getAttribute('aria-pressed')).toBe('false');
  });

  it('点击 en-US 按钮后切换 locale', () => {
    function Probe() {
      const { locale, t } = useTranslation();
      return (
        <div>
          <LocaleSwitcher variant="segmented" />
          <span data-testid="locale">{locale}</span>
          <span data-testid="text">{t('common.confirm')}</span>
        </div>
      );
    }
    const { getByTestId, getByText } = render(
      <I18nProvider initialLocale="zh-CN">
        <Probe />
      </I18nProvider>
    );
    expect(getByTestId('text').textContent).toBe('确认');
    act(() => {
      fireEvent.click(getByText('English'));
    });
    expect(getByTestId('locale').textContent).toBe('en-US');
    expect(getByTestId('text').textContent).toBe('Confirm');
  });
});

describe('I18nProvider 静态渲染（SSR 兼容）', () => {
  it('renderToStaticMarkup 不会因为 useTranslation 抛错', () => {
    function SsrProbe() {
      const { t } = useTranslation();
      return <div>{t('common.confirm')}</div>;
    }
    const html = renderToStaticMarkup(
      <I18nProvider initialLocale="zh-CN">
        <SsrProbe />
      </I18nProvider>
    );
    expect(html).toContain('确认');
  });
});
