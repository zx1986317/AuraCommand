/**
 * P1 #8：统一 Loading / Skeleton 组件单测
 *
 * 覆盖：
 *  - Skeleton 基础渲染：variant、宽高、圆角、aria 属性
 *  - SkeletonText 行数与最后一行宽度
 *  - Spinner 内联 / 块级 + 文本
 *  - LoadingState 在 loading=false 时直接渲染 children
 *  - LoadingState 在 loading=true 初始时（延迟内）先渲染 children
 *  - DelayedLoading 在 loading=false 时不显示 fallback
 *
 * 注意：
 *  - 使用 react-dom/server 做静态渲染验证（不依赖 testing-library）
 *  - 延迟 timer 行为用 fake timers + act 触发后再断言
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  Skeleton,
  SkeletonText,
  Spinner,
  LoadingState,
  DelayedLoading,
} from '../../src/components/common/LoadingState';

// 工具：把组件挂到 jsdom 容器中（用 fake timers 推进时间）
const mount = (ui: React.ReactElement): { root: Root; container: HTMLDivElement } => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(ui);
  });
  return { root, container };
};

const unmount = (root: Root, container: HTMLDivElement) => {
  act(() => root.unmount());
  container.remove();
};

// 工具：临时把 matchMedia 设为指定值，测试结束后恢复
const setMatchMedia = (matches: boolean) => {
  const original = window.matchMedia;
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (q: string) => ({
      matches,
      media: q,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
  return () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: original,
    });
  };
};

describe('LoadingState / Skeleton (静态渲染)', () => {
  it('Skeleton 默认渲染为 rect 变体 + animate-pulse + 100% × 4rem', () => {
    const html = renderToStaticMarkup(<Skeleton />);
    expect(html).toContain('animate-pulse');
    expect(html).toContain('bg-slate-200/70');
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-live="polite"');
    // 默认 rect：宽 100%，高 4rem
    expect(html).toMatch(/width:\s*100%/);
    expect(html).toMatch(/height:\s*4rem/);
  });

  it('Skeleton text 变体：高度 0.75em + 圆角 4px', () => {
    const html = renderToStaticMarkup(<Skeleton variant="text" />);
    expect(html).toMatch(/height:\s*0\.75em/);
    expect(html).toMatch(/border-radius:\s*4px/);
  });

  it('Skeleton circle 变体：宽高 1em + 圆角 50%', () => {
    const html = renderToStaticMarkup(<Skeleton variant="circle" />);
    expect(html).toMatch(/width:\s*1em/);
    expect(html).toMatch(/height:\s*1em/);
    expect(html).toMatch(/border-radius:\s*50%/);
  });

  it('Skeleton 显式 width/height/rounded 覆盖默认', () => {
    const html = renderToStaticMarkup(
      <Skeleton width={120} height={40} rounded={8} />
    );
    expect(html).toMatch(/width:\s*120px/);
    expect(html).toMatch(/height:\s*40px/);
    expect(html).toMatch(/border-radius:\s*8px/);
  });

  it('Skeleton 字符串宽度（百分比）原样透传', () => {
    const html = renderToStaticMarkup(<Skeleton width="60%" height="0.6em" />);
    expect(html).toMatch(/width:\s*60%/);
    expect(html).toMatch(/height:\s*0\.6em/);
  });
});

describe('LoadingState / SkeletonText', () => {
  it('SkeletonText 默认 3 行，最后一行宽度 60%', () => {
    const html = renderToStaticMarkup(<SkeletonText />);
    // 第 1、2 行 100%
    const matches100 = html.match(/width:\s*100%/g) ?? [];
    expect(matches100.length).toBeGreaterThanOrEqual(2);
    // 最后一行 60%
    expect(html).toMatch(/width:\s*60%/);
  });

  it('SkeletonText lines=5 渲染 5 个 Skeleton 块', () => {
    const html = renderToStaticMarkup(<SkeletonText lines={5} />);
    // 4 个 100% + 1 个 60%（默认 lastLineRatio=0.6）
    const matches100 = html.match(/width:\s*100%/g) ?? [];
    expect(matches100.length).toBe(4);
    expect(html).toMatch(/width:\s*60%/);
  });

  it('SkeletonText lastLineRatio=0.3 时最后一行 30%', () => {
    const html = renderToStaticMarkup(
      <SkeletonText lines={2} lastLineRatio={0.3} />
    );
    expect(html).toMatch(/width:\s*30%/);
  });
});

describe('LoadingState / Spinner', () => {
  it('Spinner inline 模式（默认）渲染 span + Loader2 类', () => {
    const html = renderToStaticMarkup(<Spinner />);
    // inline 模式使用 span
    expect(html.startsWith('<span')).toBe(true);
    expect(html).toContain('animate-spin');
    expect(html).toContain('text-teal-500');
  });

  it('Spinner block 模式渲染 div + 自带 py-6', () => {
    const html = renderToStaticMarkup(<Spinner block />);
    expect(html.startsWith('<div')).toBe(true);
    expect(html).toContain('py-6');
  });

  it('Spinner 带 text 时显示文本', () => {
    const html = renderToStaticMarkup(<Spinner text="加载中…" />);
    expect(html).toContain('加载中…');
  });

  it('Spinner 不带 text 时不渲染文本 span', () => {
    const html = renderToStaticMarkup(<Spinner />);
    expect(html).not.toContain('加载中');
  });
});

describe('LoadingState / LoadingState 容器', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('loading=false 时直接渲染 children，不渲染骨架', () => {
    const html = renderToStaticMarkup(
      <LoadingState loading={false} mode="skeleton">
        <span data-testid="content">真实内容</span>
      </LoadingState>
    );
    expect(html).toContain('真实内容');
    expect(html).not.toContain('animate-pulse');
  });

  it('loading=true 初始渲染 children（延迟内），delay 过后才显示骨架', () => {
    const { root, container } = mount(
      <LoadingState loading={true} mode="skeleton" delayMs={200}>
        <span data-testid="content">真实内容</span>
      </LoadingState>
    );
    try {
      // 延迟内：children 仍可见，骨架未出现
      expect(container.innerHTML).toContain('真实内容');
      expect(container.innerHTML).not.toContain('animate-pulse');
      // 推进时间，触发 setTimeout
      act(() => {
        vi.advanceTimersByTime(250);
      });
      // 延迟后：骨架出现
      expect(container.innerHTML).toContain('animate-pulse');
    } finally {
      unmount(root, container);
    }
  });

  it('mode="spinner" 渲染 Spinner 而不是 Skeleton', () => {
    const { root, container } = mount(
      <LoadingState loading={true} mode="spinner" text="正在加载" delayMs={0} />
    );
    try {
      act(() => {
        vi.advanceTimersByTime(0);
      });
      expect(container.innerHTML).toContain('animate-spin');
      expect(container.innerHTML).toContain('正在加载');
    } finally {
      unmount(root, container);
    }
  });

  it('自定义 skeleton prop 覆盖默认 SkeletonText', () => {
    const { root, container } = mount(
      <LoadingState
        loading={true}
        mode="skeleton"
        delayMs={0}
        skeleton={<div data-testid="custom-skel">自定义骨架</div>}
      />
    );
    try {
      act(() => {
        vi.advanceTimersByTime(0);
      });
      expect(container.innerHTML).toContain('自定义骨架');
    } finally {
      unmount(root, container);
    }
  });
});

describe('LoadingState / DelayedLoading', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('loading=false 时只渲染 children，不显示 fallback', () => {
    const { root, container } = mount(
      <DelayedLoading loading={false} fallback={<div data-testid="fb">占位</div>}>
        <span>实际</span>
      </DelayedLoading>
    );
    try {
      expect(container.innerHTML).toContain('实际');
      expect(container.innerHTML).not.toContain('占位');
    } finally {
      unmount(root, container);
    }
  });

  it('loading=true 在 thresholdMs 内仍渲染 children', () => {
    const { root, container } = mount(
      <DelayedLoading loading={true} thresholdMs={300} fallback={<div data-testid="fb">占位</div>}>
        <span>实际</span>
      </DelayedLoading>
    );
    try {
      expect(container.innerHTML).toContain('实际');
      expect(container.innerHTML).not.toContain('占位');
    } finally {
      unmount(root, container);
    }
  });

  it('loading=true 超过 thresholdMs 后显示 fallback 并覆盖 children', () => {
    const { root, container } = mount(
      <DelayedLoading loading={true} thresholdMs={300} fallback={<div data-testid="fb">占位</div>}>
        <span>实际</span>
      </DelayedLoading>
    );
    try {
      act(() => {
        vi.advanceTimersByTime(350);
      });
      // 覆盖层出现，包含 fallback
      expect(container.innerHTML).toContain('占位');
      expect(container.innerHTML).toContain('backdrop-blur');
    } finally {
      unmount(root, container);
    }
  });

  it('loading 从 true 变 false：清掉定时器，children 恢复显示', () => {
    const { root, container } = mount(
      <DelayedLoading loading={true} thresholdMs={300} fallback={<div>占位</div>}>
        <span>实际</span>
      </DelayedLoading>
    );
    try {
      // 提前取消 loading=true
      act(() => {
        root.render(
          <DelayedLoading loading={false} thresholdMs={300} fallback={<div>占位</div>}>
            <span>实际</span>
          </DelayedLoading>
        );
      });
      // 即使推进时间也不再出现占位
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(container.innerHTML).toContain('实际');
      expect(container.innerHTML).not.toContain('占位');
    } finally {
      unmount(root, container);
    }
  });
});

describe('LoadingState / prefers-reduced-motion', () => {
  it('reduced-motion=true 时 Skeleton 不带 animate-pulse 类', () => {
    const restore = setMatchMedia(true);
    const { root, container } = mount(<Skeleton variant="rect" />);
    try {
      expect(container.innerHTML).not.toContain('animate-pulse');
      expect(container.innerHTML).toContain('bg-slate-200/70');
    } finally {
      unmount(root, container);
      restore();
    }
  });

  it('reduced-motion=false 时 Skeleton 仍带 animate-pulse 类', () => {
    const restore = setMatchMedia(false);
    const { root, container } = mount(<Skeleton variant="rect" />);
    try {
      expect(container.innerHTML).toContain('animate-pulse');
    } finally {
      unmount(root, container);
      restore();
    }
  });

  it('reduced-motion=true 时 Spinner 使用 animate-pulse 代替 animate-spin', () => {
    const restore = setMatchMedia(true);
    const { root, container } = mount(<Spinner />);
    try {
      expect(container.innerHTML).toContain('animate-pulse');
      expect(container.innerHTML).not.toContain('animate-spin');
    } finally {
      unmount(root, container);
      restore();
    }
  });
});
