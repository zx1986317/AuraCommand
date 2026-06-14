/**
 * P2 #4：usePrefersReducedMotion 单测
 *
 * 覆盖：
 *  - 默认无 matchMedia 退化（server-side / 极旧浏览器）→ 返回 false
 *  - matchMedia.matches = true → 返回 true
 *  - change 事件触发后状态更新
 *  - 兼容旧 API：addListener / removeListener 分支
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// 不依赖 @testing-library/react；用 createRoot + act(react) 自行挂载
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { usePrefersReducedMotion } from '../../src/hooks/usePrefersReducedMotion';

type Listener = (e: { matches: boolean }) => void;

class FakeMediaQueryList {
  matches: boolean;
  private listeners: Listener[] = [];

  constructor(matches: boolean) {
    this.matches = matches;
  }

  // 新 API
  addEventListener(type: string, cb: Listener) {
    if (type !== 'change') return;
    this.listeners.push(cb);
  }
  removeEventListener(type: string, cb: Listener) {
    if (type !== 'change') return;
    this.listeners = this.listeners.filter((l) => l !== cb);
  }

  // 旧 API（被兼容代码使用）
  addListener(cb: Listener) {
    this.listeners.push(cb);
  }
  removeListener(cb: Listener) {
    this.listeners = this.listeners.filter((l) => l !== cb);
  }

  // 测试辅助
  __fire(matches: boolean) {
    this.matches = matches;
    this.listeners.forEach((cb) => cb({ matches } as MediaQueryListEvent));
  }
}

// 用 defineProperty 改写 window.matchMedia（jsdom 类型允许但赋值需绕过只读保护）
const setMatchMedia = (impl: ((q: string) => MediaQueryList) | undefined) => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: impl,
  });
};

describe('usePrefersReducedMotion', () => {
  let fakeMql: FakeMediaQueryList;
  let originalMatchMedia: typeof window.matchMedia | undefined;

  beforeEach(() => {
    fakeMql = new FakeMediaQueryList(false);
    originalMatchMedia = window.matchMedia;
    setMatchMedia((q: string) => {
      expect(q).toBe('(prefers-reduced-motion: reduce)');
      return fakeMql as unknown as MediaQueryList;
    });
  });

  afterEach(() => {
    setMatchMedia(originalMatchMedia);
  });

  const mountHook = (): { root: Root; container: HTMLDivElement; getValue: () => boolean | undefined } => {
    let lastValue: boolean | undefined;
    const Probe: React.FC = () => {
      lastValue = usePrefersReducedMotion();
      return null;
    };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(<Probe />);
    });
    return {
      root,
      container,
      getValue: () => lastValue,
    };
  };

  it('matchMedia.matches=false 时返回 false', () => {
    fakeMql = new FakeMediaQueryList(false);
    setMatchMedia(() => fakeMql as unknown as MediaQueryList);
    const { root, container, getValue } = mountHook();
    try {
      expect(getValue()).toBe(false);
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });

  it('matchMedia.matches=true 时返回 true', () => {
    fakeMql = new FakeMediaQueryList(true);
    setMatchMedia(() => fakeMql as unknown as MediaQueryList);
    const { root, container, getValue } = mountHook();
    try {
      expect(getValue()).toBe(true);
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });

  it('change 事件触发后状态从 false → true', () => {
    fakeMql = new FakeMediaQueryList(false);
    setMatchMedia(() => fakeMql as unknown as MediaQueryList);
    const { root, container, getValue } = mountHook();
    try {
      expect(getValue()).toBe(false);
      act(() => {
        fakeMql.__fire(true);
      });
      expect(getValue()).toBe(true);
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });

  it('change 事件触发后状态从 true → false', () => {
    fakeMql = new FakeMediaQueryList(true);
    setMatchMedia(() => fakeMql as unknown as MediaQueryList);
    const { root, container, getValue } = mountHook();
    try {
      expect(getValue()).toBe(true);
      act(() => {
        fakeMql.__fire(false);
      });
      expect(getValue()).toBe(false);
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });

  it('兼容旧 API：addListener/removeListener 也能工作', () => {
    // 旧浏览器：addEventListener 不存在
    const oldMql: { matches: boolean; addEventListener?: undefined; addListener: ReturnType<typeof vi.fn>; removeListener: ReturnType<typeof vi.fn> } = {
      matches: false,
      addEventListener: undefined,
      addListener: vi.fn(),
      removeListener: vi.fn(),
    };
    setMatchMedia(() => oldMql as unknown as MediaQueryList);

    const { root, container } = mountHook();
    try {
      expect(oldMql.addListener).toHaveBeenCalledTimes(1);
    } finally {
      act(() => root.unmount());
      container.remove();
      expect(oldMql.removeListener).toHaveBeenCalledTimes(1);
    }
  });

  it('无 matchMedia 时降级为 false', () => {
    setMatchMedia(undefined);
    const { root, container, getValue } = mountHook();
    try {
      expect(getValue()).toBe(false);
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });
});
