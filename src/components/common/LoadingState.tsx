/**
 * P1 #8：统一 Loading / Skeleton 组件
 *
 * 设计要点：
 *  1. Skeleton = 静态骨架（不旋转），适合"列表/卡片占位"等可预测布局
 *  2. Spinner = 旋转图标（Loader2），适合"操作进行中"且没有固定布局可参考
 *  3. DelayedLoading = 300ms 内不显示 Loading，避免快速 IPC 闪烁
 *  4. 所有颜色走 Tailwind slate 系 + 背景半透明，融入现有 teal/emerald 设计语言
 *
 * 用法：
 *   <Skeleton variant="rect" width={120} height={20} />
 *   <SkeletonText lines={3} />
 *   <LoadingState loading={isLoading} mode="spinner" text="正在加载文件…" />
 *   <DelayedLoading loading={isLoading}><YourContent /></DelayedLoading>
 */
import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';

// ---------------- 基础 Skeleton ----------------

export type SkeletonVariant = 'text' | 'rect' | 'circle';

export interface SkeletonProps {
  variant?: SkeletonVariant;
  width?: number | string;
  height?: number | string;
  className?: string;
  /** 圆角（仅 rect 生效），默认 4px（text 用 4px、rect 用 6px、circle 用 50%） */
  rounded?: number | string;
}

/**
 * 单个骨架块。提供 variant 让使用者少写宽度/高度/圆角。
 * - text：宽 100%，高 12px，圆角 4px，适合"一行文本"
 * - rect：宽 100%，高 64px，圆角 6px，适合"卡片/缩略图"
 * - circle：1em × 1em，圆角 50%，适合"头像"
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'rect',
  width,
  height,
  className,
  rounded,
}) => {
  // P2 #4：reduced-motion 时去掉 animate-pulse 类，保留静态占位
  const reduced = usePrefersReducedMotion();
  const style: React.CSSProperties = {
    width: width ?? (variant === 'text' ? '100%' : variant === 'circle' ? '1em' : '100%'),
    height:
      height ??
      (variant === 'text' ? '0.75em' : variant === 'circle' ? '1em' : '4rem'),
    borderRadius:
      rounded ??
      (variant === 'circle' ? '50%' : variant === 'text' ? '4px' : '6px'),
    display: 'inline-block',
  };

  return (
    <span
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={clsx(
        'skeleton-block bg-slate-200/70 dark:bg-slate-700/40',
        !reduced && 'animate-pulse',
        variant === 'text' && 'align-middle',
        className
      )}
      style={style}
    />
  );
};

// ---------------- 文本骨架 ----------------

export interface SkeletonTextProps {
  /** 行数，默认 3 */
  lines?: number;
  /** 最后一行宽度比例（0-1），默认 0.6 */
  lastLineRatio?: number;
  className?: string;
  /** 行间距，默认 8px */
  gap?: number;
}

/**
 * 多行文本骨架。最后一行默认收窄（60%）模拟真实段落。
 */
export const SkeletonText: React.FC<SkeletonTextProps> = ({
  lines = 3,
  lastLineRatio = 0.6,
  className,
  gap = 8,
}) => {
  const arr = Array.from({ length: lines }, (_, i) => i);
  return (
    <div
      className={clsx('flex flex-col', className)}
      style={{ gap }}
      role="status"
      aria-busy="true"
      aria-label="正在加载文本"
    >
      {arr.map((i) => (
        <Skeleton
          key={i}
          variant="text"
          width={i === lines - 1 && lines > 1 ? `${Math.round(lastLineRatio * 100)}%` : '100%'}
          height={12}
        />
      ))}
    </div>
  );
};

// ---------------- Spinner 加载中 ----------------

export interface SpinnerProps {
  size?: number;
  className?: string;
  text?: string;
  /** 居中显示（块级） */
  block?: boolean;
}

/**
 * 简单旋转图标 + 可选文本。
 */
export const Spinner: React.FC<SpinnerProps> = ({
  size = 16,
  className,
  text,
  block = false,
}) => {
  // P2 #4：reduced-motion 时把旋转改为静态透明度脉冲（仍可感知"在动"但不旋转）
  const reduced = usePrefersReducedMotion();
  const inner = (
    <>
      <Loader2
        size={size}
        className={clsx(
          reduced ? 'animate-pulse text-teal-500' : 'animate-spin text-teal-500',
          className
        )}
      />
      {text && (
        <span className="text-xs text-slate-500 dark:text-slate-400">{text}</span>
      )}
    </>
  );

  if (!block) {
    return (
      <span className="inline-flex items-center gap-2" role="status" aria-busy="true">
        {inner}
      </span>
    );
  }
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 py-6"
      role="status"
      aria-busy="true"
    >
      {inner}
    </div>
  );
};

// ---------------- 统一 Loading 容器 ----------------

export interface LoadingStateProps {
  /** 是否正在加载 */
  loading: boolean;
  /** skeleton 或 spinner（默认 skeleton） */
  mode?: 'skeleton' | 'spinner';
  /** spinner 模式下的可选文本 */
  text?: string;
  /** skeleton 模式下的行数（仅当 children 是文本字符串时生效） */
  lines?: number;
  /** 自定义骨架内容（mode=skeleton 时优先使用） */
  skeleton?: React.ReactNode;
  /** 自定义 spinner 内容（mode=spinner 时优先使用） */
  spinner?: React.ReactNode;
  /** 非加载态要渲染的内容 */
  children?: React.ReactNode;
  /** 容器类名 */
  className?: string;
  /** 最小显示高度（避免布局抖动），默认 4rem */
  minHeight?: number | string;
  /**
   * 加载态显示延迟（毫秒），默认 200ms。
   * 避免快速 IPC 完成时出现"loading 一闪"，提升感知流畅度。
   */
  delayMs?: number;
}

/**
 * 统一 Loading 容器：根据 loading 切换"骨架/spinner/正文"。
 *
 * 推荐用法：
 *   <LoadingState loading={isFetching} mode="skeleton">
 *     <FileList files={files} />
 *   </LoadingState>
 */
export const LoadingState: React.FC<LoadingStateProps> = ({
  loading,
  mode = 'skeleton',
  text,
  lines = 3,
  skeleton,
  spinner,
  children,
  className,
  minHeight = '4rem',
  delayMs = 200,
}) => {
  const [showLoading, setShowLoading] = useState(false);

  useEffect(() => {
    if (!loading) {
      setShowLoading(false);
      return;
    }
    const t = window.setTimeout(() => setShowLoading(true), delayMs);
    return () => window.clearTimeout(t);
  }, [loading, delayMs]);

  if (!loading || !showLoading) {
    return <>{children}</>;
  }

  return (
    <div
      className={clsx('loading-state', className)}
      style={{ minHeight }}
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      {mode === 'spinner'
        ? spinner ?? (text ? <Spinner block text={text} /> : <Spinner block />)
        : skeleton ?? <SkeletonText lines={lines} />}
    </div>
  );
};

// ---------------- 延迟显示 Loading（包裹器） ----------------

export interface DelayedLoadingProps {
  loading: boolean;
  /** 超过该毫秒数仍 loading 时显示 fallback；默认 300 */
  thresholdMs?: number;
  /** 显示的占位元素；默认 Spinner */
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * 包裹任意内容：如果 loading 在 thresholdMs 内完成，不显示 fallback，避免快速 IPC 闪烁。
 * 与 LoadingState 区别：本组件不"接管"子内容渲染，只是条件性追加占位。
 */
export const DelayedLoading: React.FC<DelayedLoadingProps> = ({
  loading,
  thresholdMs = 300,
  fallback = <Spinner block text="加载中…" />,
  children,
}) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!loading) {
      setShow(false);
      return;
    }
    const t = window.setTimeout(() => setShow(true), thresholdMs);
    return () => window.clearTimeout(t);
  }, [loading, thresholdMs]);

  if (!loading || !show) return <>{children}</>;
  return (
    <div className="relative">
      <div className="opacity-60 pointer-events-none">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center bg-white/40 dark:bg-slate-900/40 backdrop-blur-[1px]">
        {fallback}
      </div>
    </div>
  );
};
