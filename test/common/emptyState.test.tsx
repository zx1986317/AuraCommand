/**
 * P2 #5：EmptyState 组件单测
 *
 * 覆盖：
 *  - 基础渲染：title / description / icon / action 节点
 *  - aria 属性：role="status" + aria-live="polite"
 *  - compact 模式：text-2xs + 更紧凑的内边距
 *  - action 与 secondary 同时存在时排版正确
 *  - 无 icon / 无 description 时不渲染对应节点（不出现空白）
 *  - data-testid 透传
 *  - 自定义 className 合并
 */
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FileText, Plus } from 'lucide-react';
import { EmptyState } from '../../src/components/common/EmptyState';

describe('EmptyState', () => {
  it('基础渲染：icon + title + description + action', () => {
    const html = renderToStaticMarkup(
      <EmptyState
        icon={<FileText size={48} />}
        title="还没有便签"
        description="便签是你的私人速记本"
        action={<button>+ 新建便签</button>}
      />
    );
    expect(html).toContain('还没有便签');
    expect(html).toContain('便签是你的私人速记本');
    expect(html).toContain('+ 新建便签');
    // FileText 渲染为 svg
    expect(html).toContain('<svg');
  });

  it('aria 属性：role="status" + aria-live="polite" + data-testid', () => {
    const html = renderToStaticMarkup(
      <EmptyState title="空" data-testid="kb-empty" />
    );
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('data-testid="kb-empty"');
  });

  it('无 icon / description 时不渲染对应容器', () => {
    const html = renderToStaticMarkup(<EmptyState title="空" />);
    // 不应出现图标背景容器 div（带 w-16 h-16）
    expect(html).not.toContain('w-16 h-16');
    // 标题要渲染
    expect(html).toContain('空');
  });

  it('默认模式：text-sm 标题 + text-xs 描述 + 较宽 padding', () => {
    const html = renderToStaticMarkup(
      <EmptyState title="标题" description="描述" icon={<Plus />} />
    );
    expect(html).toContain('py-10 px-6');
    expect(html).toContain('text-sm');
    expect(html).toContain('text-xs');
    // 图标容器
    expect(html).toContain('w-16 h-16');
  });

  it('compact 模式：text-2xs 标题 + 更紧凑 padding', () => {
    const html = renderToStaticMarkup(
      <EmptyState
        title="空"
        description="次要说明"
        icon={<Plus />}
        compact
      />
    );
    expect(html).toContain('py-6 px-3');
    expect(html).toContain('text-2xs');
    // 紧凑图标容器
    expect(html).toContain('w-10 h-10');
  });

  it('action 与 secondary 都能渲染', () => {
    const html = renderToStaticMarkup(
      <EmptyState
        title="空"
        action={<button>主操作</button>}
        secondary={
          <>
            <button>次操作 A</button>
            <button>次操作 B</button>
          </>
        }
      />
    );
    expect(html).toContain('主操作');
    expect(html).toContain('次操作 A');
    expect(html).toContain('次操作 B');
    // secondary 容器带 flex
    expect(html).toContain('flex items-center gap-3');
  });

  it('className 合并到根容器', () => {
    const html = renderToStaticMarkup(
      <EmptyState title="空" className="my-extra-class" />
    );
    expect(html).toContain('my-extra-class');
  });

  it('icon 容器自带 aria-hidden，不被屏幕阅读器读出', () => {
    const html = renderToStaticMarkup(
      <EmptyState title="空" icon={<Plus />} />
    );
    expect(html).toContain('aria-hidden="true"');
  });
});
