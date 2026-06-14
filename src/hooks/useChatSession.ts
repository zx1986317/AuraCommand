import { v4 as uuidv4 } from 'uuid';
import { getAssistantMessageParts } from '../utils/chat';
import { useAppStore } from '../store/appStore';
import { logger } from '../utils/logger';
import type { ChatMessage, ChatSession, AgentStep } from '../types/chat';

type McpCategoryRouting = {
  category: string;
  categoryLabel: string;
  preferredServerId: string;
  preferredServerName: string;
};

type McpRoutingState = Partial<{
  preferredServerId: string;
  preferredServerName: string;
  lockedServerId: string;
  lockedServerName: string;
  categoryRouting: McpCategoryRouting[];
}>;

interface ChatSessionDeps {
  setNotification: (n: { message: string; type: 'info' | 'error' | 'warning' | 'success' } | null) => void;
  setModalConfig: (config: { isOpen: boolean; title: string; message: string; onConfirm: (inputValue?: string) => void; inputDefaultValue?: string | undefined; } | null) => void;
  chatMessages: ChatMessage[];
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  chatSessions: ChatSession[];
  setChatSessions: React.Dispatch<React.SetStateAction<ChatSession[]>>;
  activeSessionId: string | null;
  setActiveSessionId: React.Dispatch<React.SetStateAction<string | null>>;
  setIsChatLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setAgentSteps: React.Dispatch<React.SetStateAction<AgentStep[]>>;
  setActiveMcpRouting: React.Dispatch<React.SetStateAction<McpRoutingState | null>>;
  setChatInput: React.Dispatch<React.SetStateAction<string>>;
  chatInputRef: React.RefObject<HTMLInputElement | null>;
  cleanupChatListeners: () => void;
  handleNewChat: () => Promise<void>;
  chatSearchResults: ChatSearchResult[];
  setChatSearchResults: React.Dispatch<React.SetStateAction<ChatSearchResult[]>>;
  isChatSearching: boolean;
  setIsChatSearching: React.Dispatch<React.SetStateAction<boolean>>;
}

import type { ChatSearchResult } from '../types/chat';

export function useChatSession(deps: ChatSessionDeps) {
  const {
    setNotification, setModalConfig,
    chatMessages, setChatMessages,
    chatSessions, setChatSessions,
    activeSessionId, setActiveSessionId,
    setIsChatLoading, setAgentSteps, setActiveMcpRouting,
    setChatInput, chatInputRef,
    cleanupChatListeners, handleNewChat,
    chatSearchResults, setChatSearchResults,
    isChatSearching, setIsChatSearching,
  } = deps;

  const selectedModel = useAppStore(s => s.selectedModel);
  const setSelectedModel = useAppStore(s => s.setSelectedModel);
  const setIsModelDropdownOpen = useAppStore(s => s.setIsModelDropdownOpen);
  const setCloudModelIdMap = useAppStore(s => s.setCloudModelIdMap);
  const setAvailableModels = useAppStore(s => s.setAvailableModels);
  const setVisionModels = useAppStore(s => s.setVisionModels);
  const setActiveTab = useAppStore(s => s.setActiveTab);

  const handleSelectSession = async (sessionId: string) => {
    cleanupChatListeners();
    setActiveSessionId(sessionId);
    localStorage.setItem('activeSessionId', sessionId);
    const history = await window.ipcRenderer.invoke('get-chat-messages', { sessionId });
    setChatMessages(history || []);
    setActiveMcpRouting(null);
    setAgentSteps([]);
    setIsChatLoading(false);
    requestAnimationFrame(() => {
      setTimeout(() => chatInputRef.current?.focus(), 100);
    });
  };

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    setModalConfig({
      isOpen: true,
      title: '删除对话',
      message: '确定要删除这个对话吗？此操作不可恢复。',
      onConfirm: async () => {
        setModalConfig(null);
        try {
          await window.ipcRenderer.invoke('delete-chat-session', { sessionId });
          setChatSessions(prev => prev.filter(s => s.id !== sessionId));
          if (activeSessionId === sessionId) {
            handleNewChat();
          }
        } catch (err) {
          setNotification({ message: '删除对话失败', type: 'error' });
        }
      },
    });
  };

  const handleRenameSession = async (e: React.MouseEvent, sessionId: string, currentTitle: string) => {
    e.stopPropagation();
    setModalConfig({
      isOpen: true,
      title: '重命名对话',
      message: '请输入新的对话标题：',
      inputDefaultValue: currentTitle,
      onConfirm: async (newTitle?: string) => {
        setModalConfig(null);
        if (newTitle && newTitle !== currentTitle) {
          try {
            await window.ipcRenderer.invoke('rename-chat-session', { sessionId, title: newTitle });
            setChatSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title: newTitle } : s));
          } catch (err) {
            setNotification({ message: '重命名失败', type: 'error' });
          }
        }
      },
    });
  };

  const handleClearChat = async () => {
    setModalConfig({
      isOpen: true,
      title: '清空对话',
      message: '确定要清空当前对话的所有记录吗？此操作不可恢复。',
      onConfirm: async () => {
        setModalConfig(null);
        try {
          await window.ipcRenderer.invoke('clear-chat-messages', { sessionId: activeSessionId });
          setChatMessages([]);
          setAgentSteps([]);
        } catch (err) {
          setNotification({ message: '清空聊天记录失败', type: 'error' });
        }
      },
    });
  };

  const handleRollbackTurn = async () => {
    if (!activeSessionId || chatMessages.length === 0) return;
    try {
      const result = await window.ipcRenderer.invoke('rollback-chat-turn', { sessionId: activeSessionId });
      if (result?.success) {
        // 移除最新的两条消息（assistant + user）
        setChatMessages(prev => {
          const next = [...prev];
          // 从末尾移除，最多移除 2 条
          next.splice(-Math.min(result.deletedCount || 2, next.length));
          return next;
        });
        setAgentSteps([]);
        setNotification({ message: '已回退上一轮对话', type: 'success' });
        setTimeout(() => setNotification(null), 2000);
      }
    } catch (err) {
      setNotification({ message: '回退失败', type: 'error' });
    }
  };

  const loadModels = async () => {
    if (!window.ipcRenderer) return;
    try {
      const models: string[] = await window.ipcRenderer.invoke('get-ollama-models') || [];
      const chatModels = models.filter((m: string) =>
        !m.toLowerCase().includes('embed') && !m.toLowerCase().includes('bge-m3')
      );

      let cloudModels: Array<{ id: string; name: string; provider: string; modelName: string }> = [];
      try {
        cloudModels = await window.ipcRenderer.invoke('get-cloud-models') || [];
      } catch {}
      const newIdMap: Record<string, string> = {};
      const cloudLabels: string[] = [];

      if (cloudModels.length > 0) {
        const providerNames: Record<string, string> = {
          openai: 'OpenAI',
          claude: 'Claude',
          zhipu: '智谱',
          dashscope: '通义千问',
          custom: '自定义',
        };
        cloudModels.forEach((cm: any) => {
          const providerName = providerNames[cm.provider] || cm.provider;
          const label = `☁️ ${cm.name || cm.modelName} · ${providerName}`;
          newIdMap[label] = cm.id;
          cloudLabels.push(label);
        });
      }

      setCloudModelIdMap(newIdMap);
      window.ipcRenderer.invoke('set-setting', { key: 'cloudModelIdMap', value: JSON.stringify(newIdMap) }).catch(() => {});

      const allModels = [...cloudLabels, ...chatModels];
      setAvailableModels(allModels);

      const vision = models.filter((m: string) =>
        m.toLowerCase().includes('llava') ||
        m.toLowerCase().includes('vl') ||
        m.toLowerCase().includes('vision') ||
        m.toLowerCase().includes('minicpm-v') ||
        m.toLowerCase().includes('gemma3') ||
        m.toLowerCase().includes('internvl') ||
        m.toLowerCase().includes('cogvlm')
      );
      setVisionModels(vision);

      if (!selectedModel && allModels.length > 0) {
        const defaultModel = cloudLabels[0] || chatModels[0] || allModels[0];
        if (defaultModel) setSelectedModel(defaultModel);
      }

      if (selectedModel && (selectedModel.toLowerCase().includes('embed') || selectedModel.toLowerCase().includes('bge-m3'))) {
        const defaultModel = cloudLabels[0] || chatModels[0] || allModels[0];
        if (defaultModel) setSelectedModel(defaultModel);
      }

      if (selectedModel && !allModels.includes(selectedModel)) {
        const defaultModel = cloudLabels[0] || chatModels[0] || allModels[0];
        if (defaultModel) setSelectedModel(defaultModel);
      }
    } catch (err) {
      logger.error('Failed to load models:', err);
    }
  };

  const handleModelChange = (model: string) => {
    setSelectedModel(model);
    setIsModelDropdownOpen(false);
  };

  const loadSessionState = async (preferredSessionId: string | null = activeSessionId) => {
    if (!window.ipcRenderer) return;

    const allSessions = await window.ipcRenderer.invoke('get-chat-sessions');
    const sessions = allSessions.filter((s: any) => !s.id.startsWith('doc-'));
    setChatSessions(sessions);

    let nextSessionId = preferredSessionId;
    if (nextSessionId && !sessions.some((session: any) => session.id === nextSessionId)) {
      nextSessionId = null;
    }
    if (!nextSessionId && sessions.length > 0) {
      nextSessionId = sessions[0].id;
    }

    if (nextSessionId) {
      setActiveSessionId(nextSessionId);
      localStorage.setItem('activeSessionId', nextSessionId);
      const history = await window.ipcRenderer.invoke('get-chat-messages', { sessionId: nextSessionId });
      setChatMessages(history || []);
    } else {
      setActiveSessionId(null);
      localStorage.removeItem('activeSessionId');
      setChatMessages([]);
    }
  };

  const handleExportSession = () => {
    if (chatMessages.length === 0) return;
    let exportContent = `# 对话记录\n\n`;
    exportContent += `**导出时间:** ${new Date().toLocaleString()}\n\n---\n\n`;
    chatMessages.forEach((msg: any) => {
      const assistantParts = msg.role === 'assistant' ? getAssistantMessageParts(msg) : null;
      const content = msg.role === 'assistant'
        ? (assistantParts?.answer || msg.content)
        : msg.content;
      exportContent += `## ${msg.role === 'user' ? '👤 用户' : '🤖 AI'}\n\n${content}\n\n`;
      if (msg.sources && msg.sources.length > 0) {
        exportContent += `**参考来源:**\n`;
        msg.sources.forEach((s: any) => {
          exportContent += `- ${s.title}\n`;
        });
        exportContent += `\n`;
      }
      exportContent += `---\n\n`;
    });
    const blob = new Blob([exportContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session_${activeSessionId || 'export'}_${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setNotification({ message: '对话记录已导出', type: 'info' });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleChatSearch = async (query: string) => {
    if (!query.trim()) return;
    setIsChatSearching(true);
    try {
      const results = await window.ipcRenderer.invoke('search-chat-messages', { query });
      setChatSearchResults(results || []);
    } catch (err) {
      logger.error('Chat search failed:', err);
      setChatSearchResults([]);
    } finally {
      setIsChatSearching(false);
    }
  };

  const handleExtractTodos = async (content: string) => {
    try {
      const extractedSchedules = await window.ipcRenderer.invoke('extract-schedules', {
        text: content,
        model: selectedModel
      });
      if (extractedSchedules && extractedSchedules.length > 0) {
        for (const schedule of extractedSchedules) {
          await window.ipcRenderer.invoke('save-task', {
            id: uuidv4(),
            title: schedule.title,
            description: schedule.content || '',
            scheduled_date: schedule.start_time || '',
            status: 'inbox',
            priority: 'medium',
            tags: [],
            type: 'task',
          });
        }
        setActiveTab('tasks');
        setNotification({ message: `已从对话生成 ${extractedSchedules.length} 项日程`, type: 'info' });
      } else {
        setNotification({ message: '未检测到可提取的待办信息，已为您打开新建待办', type: 'warning' });
        setActiveTab('tasks');
      }
      setTimeout(() => setNotification(null), 3000);
    } catch (err) {
      logger.error('Extract todos failed:', err);
      setNotification({ message: '提取待办失败', type: 'error' });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  return {
    handleSelectSession,
    handleDeleteSession,
    handleRenameSession,
    handleClearChat,
    handleRollbackTurn,
    loadModels,
    handleModelChange,
    loadSessionState,
    handleExportSession,
    handleChatSearch,
    handleExtractTodos,
  };
}
