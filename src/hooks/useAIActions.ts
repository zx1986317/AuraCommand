import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Notification, ActiveTab } from '../store/appStore';

interface UseAIActionsParams {
  selectedModel: string;
  setNotification: (n: Notification | null) => void;
  setActiveTab: (tab: ActiveTab) => void;
  setDeskDefaultTab: (tab: 'documents' | 'notes') => void;
  setSourceNoteToOpen: (source: { type: 'note' | 'document'; id: string } | undefined) => void;
  setEditingSchedule: (schedule: any) => void;
  setIsAIProcessing: (v: boolean) => void;
}

export function useAIActions({
  selectedModel,
  setNotification,
  setActiveTab,
  setDeskDefaultTab,
  setSourceNoteToOpen,
  setEditingSchedule,
}: UseAIActionsParams) {

  const aiSummarizeForContext = useCallback(async (contextContent: string, promptPrefix: string = '请总结以下内容：'): Promise<string> => {
    const text = contextContent || '';
    if (!text) return '没有可用的上下文内容进行总结';
    try {
      const res = await window.ipcRenderer.invoke('summarize-memo', `${promptPrefix}\n\n${text}`, selectedModel);
      return res || 'AI 未返回结果';
    } catch (err) {
      console.error('AI summarize failed:', err);
      return 'AI 处理失败，请重试';
    }
  }, [selectedModel]);

  const aiGenerate = useCallback(async (prompt: string): Promise<string> => {
    try {
      const res = await window.ipcRenderer.invoke('ollama-chat', {
        messages: [
          {
            role: 'system',
            content: '你是 AuraCommand 的 AI 助手，专门处理文字任务（润色、续写、总结等）。\n\n【绝对规则】\n1. 将你的输出包裹在标记中：\n【结果开始】\n（你的输出）\n【结果结束】\n\n2. 只输出上述标记内的内容，禁止输出任何分析、说明、章节标题（如"风格分析""改写说明"）。\n3. 直接输出，不要说开场白或结束语。\n4. 输出必须能被直接替换到原文中使用。',
          },
          { role: 'user', content: prompt },
        ],
        model: selectedModel,
      });
      const raw = res || '';
      const startTag = '【结果开始】';
      const endTag = '【结果结束】';
      const startIdx = raw.indexOf(startTag);
      const endIdx = raw.indexOf(endTag);
      if (startIdx !== -1 && endIdx !== -1) {
        return raw.substring(startIdx + startTag.length, endIdx).trim();
      }
      return raw;
    } catch (err) {
      console.error('AI generate failed:', err);
      return 'AI 处理失败，请重试';
    }
  }, [selectedModel]);

  const aiKnowledgeQuestion = useCallback(async (question: string): Promise<string> => {
    try {
      const res = await window.ipcRenderer.invoke('chat-knowledge', {
        query: question,
        model: selectedModel,
      });
      if (res && res.content) {
        return res.content;
      }
      return 'AI 未返回结果';
    } catch (err) {
      console.error('AI knowledge Q&A failed:', err);
      return 'AI 处理失败，请重试';
    }
  }, [selectedModel]);

  const handleSaveAsNote = useCallback(async (content: string) => {
    const id = uuidv4();
    await window.ipcRenderer.invoke('save-note', {
      id,
      title: 'AI 沉淀便签',
      content,
      type: 'quick_note',
      project: 'AI沉淀',
      category: '智能提炼',
      tags: ['AI生成'],
      source_type: 'manual',
      source_id: '',
    });
    setDeskDefaultTab('notes');
    setActiveTab('desk');
    setSourceNoteToOpen({ type: 'note', id });
    setNotification({ message: '便签已保存到书桌', type: 'info' });
    setTimeout(() => setNotification(null), 3000);
  }, [setDeskDefaultTab, setActiveTab, setSourceNoteToOpen, setNotification]);

  const handleSaveAsDocument = useCallback(async (content: string) => {
    const id = uuidv4();
    await window.ipcRenderer.invoke('save-note', {
      id,
      title: 'AI 沉淀文档',
      content,
      type: 'document',
      project: 'AI沉淀',
      tags: ['AI生成'],
      source_type: 'manual',
      source_id: '',
      category: '',
    });
    setDeskDefaultTab('documents');
    setActiveTab('desk');
    setSourceNoteToOpen({ type: 'document', id });
    setNotification({ message: '文档已保存到书桌', type: 'info' });
    setTimeout(() => setNotification(null), 3000);
  }, [setDeskDefaultTab, setActiveTab, setSourceNoteToOpen, setNotification]);

  const handleSaveSchedule = useCallback(async (schedule: any) => {
    try {
      await window.ipcRenderer.invoke('save-task', {
        ...schedule,
        linked_memos: typeof schedule.linked_memos === 'string' ? schedule.linked_memos : JSON.stringify(schedule.linked_memos || []),
      });
      setEditingSchedule(null);
      setNotification({ message: '任务已保存', type: 'info' });
    } catch (err) {
      console.error('Save schedule failed:', err);
      setNotification({ message: '保存任务失败', type: 'error' });
    }
    setTimeout(() => setNotification(null), 3000);
  }, [setEditingSchedule, setNotification]);

  const handleInsertToScheduleEditor = useCallback((text: string) => {
    setEditingSchedule({
      id: uuidv4(),
      title: text.substring(0, 50),
      content: text,
      start_time: new Date().toISOString(),
      status: 'pending',
      category: '工作任务',
      priority: 'medium',
    });
    setNotification({ message: '已创建新待办', type: 'info' });
    setTimeout(() => setNotification(null), 3000);
  }, [setEditingSchedule, setNotification]);

  const handleSaveAsTask = useCallback(async (content: string) => {
    try {
      const res = await window.ipcRenderer.invoke('save-task', {
        id: uuidv4(),
        title: content.substring(0, 50),
        content,
        start_time: new Date().toISOString(),
        status: 'pending',
        category: '工作任务',
        priority: 'medium',
      });
      if (res) {
        setNotification({ message: '已保存为待办', type: 'info' });
      }
    } catch (err) {
      console.error('Save as task failed:', err);
      setNotification({ message: '保存待办失败', type: 'error' });
    }
    setTimeout(() => setNotification(null), 3000);
  }, [setNotification]);

  return {
    aiSummarizeForContext,
    aiGenerate,
    aiKnowledgeQuestion,
    handleSaveAsNote,
    handleSaveAsDocument,
    handleSaveSchedule,
    handleInsertToScheduleEditor,
    handleSaveAsTask,
  };
}
