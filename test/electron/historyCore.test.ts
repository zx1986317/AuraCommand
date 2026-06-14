/**
 * useHistory 核心逻辑（去重 + 合并窗口 + 撤销/重做 + 栈深度上限）单测
 */
import { describe, it, expect } from 'vitest';
import {
  createHistoryCore,
  applyChange,
  undoStep,
  redoStep,
} from '../../electron/util/historyCore';

describe('historyCore (P1 撤销/重做核心)', () => {
  it('初次变化推入 past，lastSnapshot 变更为新值', () => {
    const c = createHistoryCore<string>('a');
    applyChange(c, 'b', 1000, 400, 50);
    expect(c.past).toEqual(['a']);
    expect(c.lastSnapshot).toBe('b');
    expect(c.future).toEqual([]);
  });

  it('相同值（JSON.stringify 等价）不推历史', () => {
    const c = createHistoryCore<{ k: number }>({ k: 1 });
    applyChange(c, { k: 1 }, 1000, 400, 50);
    expect(c.past).toEqual([]);
  });

  it('合并窗口内连续变化只保留一次历史起点', () => {
    const c = createHistoryCore<string>('a');
    applyChange(c, 'b', 1000, 400, 50);
    applyChange(c, 'c', 1100, 400, 50); // 窗口内
    applyChange(c, 'd', 1200, 400, 50); // 窗口内
    // 只应有一条历史：a
    expect(c.past).toEqual(['a']);
    expect(c.lastSnapshot).toBe('d');
  });

  it('超过合并窗口则推入新历史点', () => {
    const c = createHistoryCore<string>('a');
    applyChange(c, 'b', 1000, 400, 50);
    applyChange(c, 'c', 1500, 400, 50); // 超出窗口
    expect(c.past).toEqual(['a', 'b']);
    expect(c.lastSnapshot).toBe('c');
  });

  it('undo / redo 双向回放', () => {
    const c = createHistoryCore<string>('a');
    applyChange(c, 'b', 1000, 400, 50);
    applyChange(c, 'c', 1500, 400, 50);
    expect(undoStep(c)).toBe('b');
    expect(undoStep(c)).toBe('a');
    expect(undoStep(c)).toBeNull();
    expect(redoStep(c)).toBe('b');
    expect(redoStep(c)).toBe('c');
    expect(redoStep(c)).toBeNull();
  });

  it('新变更会清空 redo 栈（标准行为）', () => {
    const c = createHistoryCore<string>('a');
    applyChange(c, 'b', 1000, 400, 50);
    applyChange(c, 'c', 1500, 400, 50);
    undoStep(c); // future = [c]
    expect(c.future).toEqual(['c']);
    applyChange(c, 'd', 2000, 400, 50); // 新分支
    expect(c.future).toEqual([]);
  });

  it('栈深度上限生效', () => {
    const c = createHistoryCore<number>(0);
    for (let i = 1; i <= 60; i++) {
      applyChange(c, i, i * 1000, 0, 50); // 不合并
    }
    expect(c.past.length).toBe(50);
    expect(c.past[0]).toBe(10); // 最早的 10 个被丢弃
  });
});
