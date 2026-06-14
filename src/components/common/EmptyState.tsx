/**
 * P2 #5：统一空状态组件
 *
 * 设计要点：
 *  - 视觉规范：图标 48px（紧凑模式 32px）、标题 text-sm/font-bold、描述 text-xs/muted
 *  - 强调引导：默认带一个主操作按钮（action）+ 可选次操作（secondary）
 *  - 紧凑模式：用于侧栏/列内小区域（无 action 也能用）
 *  - 色彩统一：图标用 text-muted/30，标题 text-foreground/80，描述 text-muted
 *  - A11y：role="status" + aria-live="polite" 让屏幕阅读器读到"空状态"
 *
 * 用法：
 *   <EmptyState
 *     icon={<FileText size={48} />}
 *     title="还没有便签"
 *     description="便签是你的私人速记本，支持 Markdown 与双向链接"
 *     action={<Button onClick={...}>+ 新建便签</Button>}
 *   />
 */
import React from 'react';
import { clsx } from 'clsx';

export interface EmptyStateProps {
  /** 主图标（通常是 Lucide icon，调用方控制 size） */
  icon?: React.ReactNode;
  /** 标题（一句话，必填） */
  title: string;
  /** 副标题/描述（可选，一行说明） */
  description?: string;
  /** 主操作（通常一个按钮） */
  action?: React.ReactNode;
  /** 次操作（链接样式按钮组，可选） */
  secondary?: React.ReactNode;
  /** 紧凑模式：用于侧栏/列内小区域 */
  compact?: boolean;
  /** 额外类名 */
  className?: string;
  /** 测试 ID */
  'data-testid'?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  secondary,
  compact = false,
  className,
  'data-testid': testId = 'empty-state',
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid={testId}
      className={clsx(
        'flex flex-col items-center justify-center text-center',
        compact ? 'py-6 px-3 gap-2' : 'py-10 px-6 gap-3',
        className
      )}
    >
      {icon && (
        <div
          className={clsx(
            'flex items-center justify-center text-muted/30',
            compact ? 'w-10 h-10 rounded-xl bg-muted/5' : 'w-16 h-16 rounded-2xl bg-muted/5'
          )}
          aria-hidden="true"
        >
          {icon}
        </div>
      )}
      <p
        className={clsx(
          'font-bold text-foreground/80',
          compact ? 'text-2xs' : 'text-sm'
        )}
      >
        {title}
      </p>
      {description && (
        <p
          className={clsx(
            'text-muted/80 max-w-xs leading-relaxed',
            compact ? 'text-2xs' : 'text-xs'
          )}
        >
          {description}
        </p>
      )}
      {action && <div className={clsx('mt-1', compact ? '' : 'mt-2')}>{action}</div>}
      {secondary && <div className="flex items-center gap-3">{secondary}</div>}
    </div>
  );
};
