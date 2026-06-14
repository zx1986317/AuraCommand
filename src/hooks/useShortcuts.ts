/**
 * 全局快捷键（Renderer 端）
 * P1：Ctrl+1~5 切 tab、Ctrl+K 全局搜索、Ctrl+, 设置、Ctrl+N 新建便签、Ctrl+Shift+T 新建任务、Esc 关弹窗
 * 设计：单例 hook、避免在 input/textarea 内误触、main 进程窗口快捷键留口（globalShortcut）
 */
import { useEffect } from 'react';
import type { ActiveTab } from '../store/types';

export interface ShortcutHandlers {
  onSwitchTab: (tab: ActiveTab) => void;
  onOpenGlobalSearch: () => void;
  onOpenSettings: () => void;
  onNewNote: () => void;
  onNewTask: () => void;
  onCloseTopModal: () => void;
}

const TAB_INDEX: ActiveTab[] = ['dashboard', 'desk', 'chat', 'kb', 'tasks'];

function isEditableTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if (t.isContentEditable) return true;
  return false;
}

export function useShortcuts(h: ShortcutHandlers): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const key = e.key;

      // Esc 永远响应（即便在编辑器内也能关弹窗）
      if (key === 'Escape') {
        h.onCloseTopModal();
        return;
      }

      // 其它快捷键：编辑器/输入框内不拦截
      if (isEditableTarget(e.target) && !ctrl) return;

      if (!ctrl) return;

      // Ctrl+1~5 切 tab
      if (key >= '1' && key <= '5' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        const idx = parseInt(key, 10) - 1;
        const tab = TAB_INDEX[idx];
        if (tab) h.onSwitchTab(tab);
        return;
      }

      // Ctrl+K 全局搜索
      if (key === 'k' || key === 'K') {
        e.preventDefault();
        h.onOpenGlobalSearch();
        return;
      }

      // Ctrl+, 设置
      if (key === ',') {
        e.preventDefault();
        h.onOpenSettings();
        return;
      }

      // Ctrl+N 新建便签（不与浏览器新窗口冲突：仅在主窗口响应）
      if ((key === 'n' || key === 'N') && !e.shiftKey) {
        e.preventDefault();
        h.onNewNote();
        return;
      }

      // Ctrl+Shift+T 新建任务
      if ((key === 'T' || key === 't') && e.shiftKey) {
        e.preventDefault();
        h.onNewTask();
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [h]);
}
