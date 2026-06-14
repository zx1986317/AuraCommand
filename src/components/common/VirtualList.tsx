/**
 * P1：极简虚拟滚动列表
 * 设计：无第三方依赖、固定行高 + 简单 windowing
 * 用法：<VirtualList items={...} itemHeight={40} renderItem={...} />
 */
import React, { useRef, useState, useLayoutEffect, useMemo } from 'react';

export interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  /** 视口高度（不传则用 100%） */
  height?: number | string;
  /** 上下预渲染条数（默认 6） */
  overscan?: number;
  className?: string;
  emptyMessage?: React.ReactNode;
}

export function VirtualList<T>({
  items,
  itemHeight,
  renderItem,
  height = '100%',
  overscan = 6,
  className,
  emptyMessage,
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportH, setViewportH] = useState(0);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setViewportH(el.clientHeight);
    const ro = new ResizeObserver(() => setViewportH(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { startIdx, endIdx, offsetY, totalH } = useMemo(() => {
    const totalH = items.length * itemHeight;
    const visH = viewportH || 0;
    const startIdx = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIdx = Math.min(items.length, Math.ceil((scrollTop + visH) / itemHeight) + overscan);
    const offsetY = startIdx * itemHeight;
    return { startIdx, endIdx, offsetY, totalH };
  }, [items.length, itemHeight, scrollTop, viewportH, overscan]);

  if (items.length === 0 && emptyMessage !== undefined) {
    return <div className={className} ref={containerRef} style={{ height, overflowY: 'auto' }}>{emptyMessage}</div>;
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ height, overflowY: 'auto', position: 'relative' }}
      onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
    >
      <div style={{ height: totalH, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {items.slice(startIdx, endIdx).map((it, i) => (
            <div key={startIdx + i} style={{ height: itemHeight }}>
              {renderItem(it, startIdx + i)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
