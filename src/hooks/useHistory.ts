/**
 * P1：通用撤销/重做 hook（无外部依赖）
 * 核心算法见 electron/util/historyCore.ts，便于纯函数单测
 * 行为：连续输入 400ms 合并为一次历史；栈深度上限 50
 */
import { useCallback, useRef, useState } from 'react';
import {
  createHistoryCore,
  applyChange,
  undoStep,
  redoStep,
  type HistoryCore,
} from '../shared/historyCore';

export interface UseHistoryOptions {
  debounceMs?: number;
  maxDepth?: number;
}

export function useHistory<T>(initial: T, opts: UseHistoryOptions = {}) {
  const { debounceMs = 400, maxDepth = 50 } = opts;
  const [state, setState] = useState<T>(initial);
  const coreRef = useRef<HistoryCore<T>>(createHistoryCore(initial));
  // canUndo/canRedo 用 state 触发渲染
  const [revision, setRevision] = useState(0);

  const set = useCallback((updater: T | ((prev: T) => T)) => {
    setState(prev => {
      const next = typeof updater === 'function' ? (updater as (p: T) => T)(prev) : updater;
      applyChange(coreRef.current, next, Date.now(), debounceMs, maxDepth);
      setRevision(r => r + 1);
      return next;
    });
  }, [debounceMs, maxDepth]);

  const undo = useCallback(() => {
    setState(prev => {
      const next = undoStep(coreRef.current);
      if (next === null) return prev;
      setRevision(r => r + 1);
      return next;
    });
  }, []);

  const redo = useCallback(() => {
    setState(prev => {
      const next = redoStep(coreRef.current);
      if (next === null) return prev;
      setRevision(r => r + 1);
      return next;
    });
  }, []);

  const reset = useCallback((value: T) => {
    coreRef.current = createHistoryCore(value);
    setRevision(r => r + 1);
    setState(value);
  }, []);

  return {
    state,
    set,
    undo,
    redo,
    canUndo: coreRef.current.past.length > 0,
    canRedo: coreRef.current.future.length > 0,
    reset,
    _revision: revision, // 仅用于触发依赖更新
  };
}
