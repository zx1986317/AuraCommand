import { useState, useRef, useEffect, useCallback } from 'react';
import type { TiptapEditorHandle } from '../components/TiptapEditor';
import { useHistory } from './useHistory';

export interface EditorItem {
  id: string;
  type: 'note' | 'document';
  title: string;
  content: string;
  pinned?: boolean;
  category?: string;
  tags: string[];
}

export function useDeskEditor(
  saveNote: (note: any) => Promise<any>,
  saveDocument: (doc: any) => Promise<any>,
  onAiAsk?: (question: string) => Promise<string>,
) {
  const history = useHistory<{ title: string; content: string }>({ title: '', content: '' });
  // 派生值：跟随 history.state，外部消费者仍可读 editorContent/editorTitle
  const editorContent = history.state.content;
  const editorTitle = history.state.title;

  const setEditorContent = useCallback((next: string) => {
    history.set(prev => ({ ...prev, content: next }));
  }, [history]);

  const setEditorTitle = useCallback((next: string) => {
    history.set(prev => ({ ...prev, title: next }));
  }, [history]);

  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [aiActionLoading, setAiActionLoading] = useState<string | null>(null);
  const [copilotCollapsed, setCopilotCollapsed] = useState(true);
  const [chatPanelWidth, setChatPanelWidth] = useState(() => {
    const stored = localStorage.getItem('deskAIChatPanelWidth');
    if (stored) return Math.max(320, Math.min(parseInt(stored, 10), window.innerWidth * 0.6));
    return Math.floor(Math.min(window.innerWidth * 0.3, 560));
  });

  const tiptapRef = useRef<TiptapEditorHandle>(null);
  const currentItemRef = useRef<EditorItem | null>(null);
  const lastSavedRef = useRef<{ title: string; content: string }>({ title: '', content: '' });
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const autoSaveCurrent = useCallback(async () => {
    const item = currentItemRef.current;
    if (!item) return;
    const titleChanged = editorTitle !== lastSavedRef.current.title;
    const contentChanged = editorContent !== lastSavedRef.current.content;
    if (!titleChanged && !contentChanged) return;

    setSaveStatus('saving');
    try {
      const saveFn = item.type === 'document' ? saveDocument : saveNote;
      await saveFn({ ...item, title: editorTitle, content: editorContent });
      lastSavedRef.current = { title: editorTitle, content: editorContent };
      setIsDirty(false);
      setSaveStatus('saved');
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
      saveStatusTimerRef.current = setTimeout(() => setSaveStatus('idle'), 3000);
    } catch {
      setSaveStatus('error');
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
      saveStatusTimerRef.current = setTimeout(() => setSaveStatus('idle'), 3000);
    }
  }, [editorTitle, editorContent, saveNote, saveDocument]);

  const flushCurrentNote = useCallback(async () => {
    const item = currentItemRef.current;
    if (!item) return;
    const titleChanged = editorTitle !== lastSavedRef.current.title;
    const contentChanged = editorContent !== lastSavedRef.current.content;
    if (titleChanged || contentChanged) {
      const saveFn = item.type === 'document' ? saveDocument : saveNote;
      await saveFn({ ...item, title: editorTitle, content: editorContent });
      lastSavedRef.current = { title: editorTitle, content: editorContent };
    }
  }, [editorTitle, editorContent, saveNote, saveDocument]);

  const setCurrentItem = useCallback((item: EditorItem | null, dirty = false) => {
    currentItemRef.current = item;
    if (item) {
      history.reset({ title: item.title, content: item.content });
      lastSavedRef.current = { title: item.title, content: item.content };
      setIsDirty(dirty);
      setSaveStatus('idle');
    } else {
      history.reset({ title: '', content: '' });
      lastSavedRef.current = { title: '', content: '' };
      setIsDirty(false);
    }
  }, [history]);

  const handleSaveCurrent = useCallback(async () => {
    const item = currentItemRef.current;
    if (!item) return;
    setSaveStatus('saving');
    const saveFn = item.type === 'document' ? saveDocument : saveNote;
    await saveFn({ ...item, title: editorTitle, content: editorContent });
    lastSavedRef.current = { title: editorTitle, content: editorContent };
    setIsDirty(false);
    setSaveStatus('saved');
    if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
    saveStatusTimerRef.current = setTimeout(() => setSaveStatus('idle'), 3000);
  }, [editorTitle, editorContent, saveNote, saveDocument]);

  const handleInlineAiAction = useCallback(async (action: string) => {
    if (!onAiAsk || !editorContent) return;
    const content = selectedText || editorContent;
    const prompts: Record<string, string> = {
      continue: `请基于以下内容继续写一段，保持风格一致：\n\n${content}`,
      polish: `请润色以下文字，使其更专业流畅：\n\n${content}`,
      translate: `请将以下内容翻译成${/[\u4e00-\u9fff]/.test(content) ? '英文' : '中文'}：\n\n${content}`,
    };
    const prompt = prompts[action];
    if (!prompt) return;
    setAiActionLoading(action);
    try {
      const result = await onAiAsk(prompt);
      if (result) {
        tiptapRef.current?.insertMarkdown('\n\n' + result);
      }
    } catch (err) {
      console.error('AI action failed:', err);
    } finally {
      setAiActionLoading(null);
    }
  }, [onAiAsk, editorContent, selectedText]);

  useEffect(() => {
    const item = currentItemRef.current;
    if (!item) { setIsDirty(false); return; }
    const changed = editorTitle !== lastSavedRef.current.title || editorContent !== lastSavedRef.current.content;
    setIsDirty(changed);
  }, [editorTitle, editorContent]);

  useEffect(() => {
    if (!isDirty) { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); return; }
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => { autoSaveCurrent(); }, 5000);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [isDirty, autoSaveCurrent]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        autoSaveCurrent();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, autoSaveCurrent]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 's') {
        e.preventDefault();
        autoSaveCurrent();
        return;
      }
      // Ctrl+Z / Ctrl+Shift+Z 撤销/重做
      if (mod && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) {
          history.redo();
        } else {
          history.undo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [autoSaveCurrent, history]);

  useEffect(() => {
    return () => {
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, []);

  const updateCurrentCategory = useCallback((category: string) => {
    if (currentItemRef.current) {
      currentItemRef.current = { ...currentItemRef.current, category };
    }
  }, []);

  return {
    editorContent,
    setEditorContent,
    editorTitle,
    setEditorTitle,
    isDirty,
    setIsDirty,
    saveStatus,
    setSaveStatus,
    selectedText,
    setSelectedText,
    aiActionLoading,
    copilotCollapsed,
    setCopilotCollapsed,
    chatPanelWidth,
    setChatPanelWidth,
    tiptapRef,
    currentItem: currentItemRef.current,
    setCurrentItem,
    flushCurrentNote,
    handleSaveCurrent,
    handleInlineAiAction,
    autoSaveCurrent,
    updateCurrentCategory,
    // P1：撤销/重做
    undo: history.undo,
    redo: history.redo,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
  };
}
