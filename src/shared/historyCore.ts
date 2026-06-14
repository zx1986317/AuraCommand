/**
 * 撤销/重做核心逻辑的可独立测试版本（无 React 依赖）
 * 实际 React 集成见 src/hooks/useHistory.ts；这里把"快照去重 + 合并窗口"逻辑独立出来便于单测
 *
 * 从 electron/util/historyCore.ts 迁移至 src/shared/，
 * 供渲染进程直接引用，避免 Vite 打包时触发 require('electron')。
 */
export interface HistoryCore<T> {
  past: T[];
  future: T[];
  lastSnapshot: T;
  lastPushAt: number;
}

export function createHistoryCore<T>(initial: T): HistoryCore<T> {
  return { past: [], future: [], lastSnapshot: initial, lastPushAt: 0 };
}

export function applyChange<T>(
  core: HistoryCore<T>,
  next: T,
  now: number,
  debounceMs: number,
  maxDepth: number,
): void {
  if (JSON.stringify(next) === JSON.stringify(core.lastSnapshot)) return;
  const within = now - core.lastPushAt < debounceMs;
  if (!within) {
    core.past.push(core.lastSnapshot);
    if (core.past.length > maxDepth) core.past.shift();
  }
  // 在合并窗口内不修改 past：undo 应直接跳到"本次输入爆发前"的状态
  core.lastSnapshot = next;
  core.lastPushAt = now;
  core.future = [];
}

export function undoStep<T>(core: HistoryCore<T>): T | null {
  if (core.past.length === 0) return null;
  const prev = core.past.pop()!;
  core.future.push(core.lastSnapshot);
  core.lastSnapshot = prev;
  core.lastPushAt = 0;
  return prev;
}

export function redoStep<T>(core: HistoryCore<T>): T | null {
  if (core.future.length === 0) return null;
  const next = core.future.pop()!;
  core.past.push(core.lastSnapshot);
  core.lastSnapshot = next;
  core.lastPushAt = 0;
  return next;
}
