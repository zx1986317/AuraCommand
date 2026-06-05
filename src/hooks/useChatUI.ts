import { useState, useRef } from 'react';
import { AiRole, aiRoles, promptTemplates } from '../constants';
import { getAssistantMessageParts } from '../utils/chat';
import { useAppStore } from '../store/appStore';
import { logger } from '../utils/logger';
import type { ChatMessage, BookmarkedMessage } from '../types/chat';

interface ChatUIDeps {
  setNotification: (n: { message: string; type: 'info' | 'error' | 'warning' | 'success' } | null) => void;
  chatMessages: ChatMessage[];
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  activeSessionId: string | null;
}

export function useChatUI(deps: ChatUIDeps) {
  const { setNotification, chatMessages, setChatMessages, activeSessionId } = deps;

  const setIsSearchEnabled = useAppStore(s => s.setIsSearchEnabled);
  const searxngUrl = useAppStore(s => s.searxngUrl);
  const setSearxngUrl = useAppStore(s => s.setSearxngUrl);
  const setShowReasoningProcess = useAppStore(s => s.setShowReasoningProcess);

  const [isChatSidebarOpen, setIsChatSidebarOpen] = useState(true);
  const [chatInput, setChatInput] = useState('');
  const [customSystemPrompt, setCustomSystemPrompt] = useState<string>(localStorage.getItem('customSystemPrompt') || '');
  const [sessionRoleMap, setSessionRoleMap] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('sessionRoleMap') || '{}'); } catch { return {}; }
  });
  const [pendingRole, setPendingRole] = useState<string>('default');
  const selectedRole = activeSessionId ? (sessionRoleMap[activeSessionId] || 'default') : pendingRole;
  const setSelectedRole = (roleId: string) => {
    if (activeSessionId) {
      setSessionRoleMap(prev => {
        const next = { ...prev, [activeSessionId]: roleId };
        localStorage.setItem('sessionRoleMap', JSON.stringify(next));
        return next;
      });
    } else {
      setPendingRole(roleId);
    }
  };
  const [chatImages, setChatImages] = useState<string[]>([]);
  const [expandedReasoningMessages, setExpandedReasoningMessages] = useState<Record<string, boolean>>({});
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingMessageContent, setEditingMessageContent] = useState<string>('');
  const [pinnedSessions, setPinnedSessions] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('pinnedChatSessions') || '[]'); } catch { return []; }
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isPromptSelectorOpen, setIsPromptSelectorOpen] = useState(false);
  const [promptCategory, setPromptCategory] = useState<'all' | 'writing' | 'coding' | 'analysis' | 'productivity'>('all');
  const [promptSearchQuery, setPromptSearchQuery] = useState('');

  const [customRoles, setCustomRoles] = useState<AiRole[]>(() => {
    try {
      const saved = localStorage.getItem('customAiRoles');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [isRoleEditorOpen, setIsRoleEditorOpen] = useState(false);
  const [editingCustomRole, setEditingCustomRole] = useState<AiRole | null>(null);

  const allRoles = [...aiRoles, ...customRoles];

  const chatInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const [selectedText, setSelectedText] = useState('');

  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [chatSearchResults, setChatSearchResults] = useState<ChatSearchResult[]>([]);
  const [isChatSearching, setIsChatSearching] = useState(false);
  const [isChatSearchOpen, setIsChatSearchOpen] = useState(false);

  const [bookmarkedMessages, setBookmarkedMessages] = useState<BookmarkedMessage[]>([]);

  const [searxngStatus, setSearxngStatus] = useState<'unknown' | 'connected' | 'error'>('unknown');

  const [chatContextLength, setChatContextLength] = useState<number>(() => {
    const savedLength = localStorage.getItem('chatContextLength');
    return savedLength ? parseInt(savedLength, 10) : 10;
  });
  const [manualPreferredMcpServerId, setManualPreferredMcpServerId] = useState<string | null>(null);
  const [manualPreferredMcpServerName, setManualPreferredMcpServerName] = useState<string | null>(null);

  const filteredPromptTemplates = promptTemplates.filter(t => {
    if (promptCategory !== 'all' && t.category !== promptCategory) return false;
    if (promptSearchQuery && !t.name.toLowerCase().includes(promptSearchQuery.toLowerCase()) && !t.template.toLowerCase().includes(promptSearchQuery.toLowerCase())) return false;
    return true;
  });

  const getCurrentSystemPrompt = () => {
    const role = allRoles.find(r => r.id === selectedRole);
    return role?.prompt || customSystemPrompt || '';
  };

  const checkSearxngConnection = async () => {
    try {
      const result = await window.ipcRenderer.invoke('check-searxng-connection', { url: searxngUrl });
      setSearxngStatus(result.connected ? 'connected' : 'error');
    } catch {
      setSearxngStatus('error');
    }
  };

  const loadBookmarkedMessages = async () => {
    try {
      const messages = await window.ipcRenderer.invoke('get-bookmarked-messages');
      setBookmarkedMessages(messages);
    } catch (err) {
      logger.error('Failed to load bookmarked messages:', err);
    }
  };

  const handleToggleBookmark = async (messageId: string, currentBookmarkState: boolean) => {
    try {
      await window.ipcRenderer.invoke('toggle-bookmark-message', { messageId, bookmarked: !currentBookmarkState });
      setChatMessages(prev => prev.map(msg =>
        msg.id === messageId ? { ...msg, bookmarked: !currentBookmarkState } : msg
      ));
      if (!currentBookmarkState) {
        await loadBookmarkedMessages();
      }
    } catch (err) {
      logger.error('Failed to toggle bookmark:', err);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setChatImages(prev => [...prev, result]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    setChatImages(prev => prev.filter((_, i) => i !== index));
  };

  const toggleReasoningExpanded = (msgId: string) => {
    setExpandedReasoningMessages(prev => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const handleSearchEnabledChange = (enabled: boolean) => {
    setIsSearchEnabled(enabled);
    if (enabled) {
      checkSearxngConnection();
    }
  };

  const handleSearxngUrlChange = (url: string) => {
    setSearxngUrl(url);
    checkSearxngConnection();
  };

  const handleShowReasoningProcessChange = (enabled: boolean) => {
    setShowReasoningProcess(enabled);
  };

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      logger.error('Failed to copy:', err);
    }
  };

  const handleExportMessage = (message: any) => {
    const assistantParts = message.role === 'assistant' ? getAssistantMessageParts(message) : null;
    const content = message.role === 'assistant'
      ? (assistantParts?.answer || message.content)
      : message.content;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `message_${message.id}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportChat = () => {
    if (chatMessages.length === 0) return;
    let exportContent = `# 对话记录\n\n`;
    exportContent += `**导出时间:** ${new Date().toLocaleString()}\n\n---\n\n`;
    chatMessages.forEach((msg) => {
      const assistantParts = msg.role === 'assistant' ? getAssistantMessageParts(msg) : null;
      const content = msg.role === 'assistant'
        ? (assistantParts?.answer || msg.content)
        : msg.content;
      exportContent += `## ${msg.role === 'user' ? '👤 用户' : '🤖 AI'}\n\n${content}\n\n`;
      if (msg.sources && msg.sources.length > 0) {
        exportContent += `**参考来源:**\n`;
        msg.sources.forEach((s: any) => { exportContent += `- ${s.title}\n`; });
        exportContent += `\n`;
      }
      exportContent += `---\n\n`;
    });
    const blob = new Blob([exportContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat_${activeSessionId || 'export'}_${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setNotification({ message: '对话记录已导出', type: 'info' });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleEditMessage = (messageId: string) => {
    const msg = chatMessages.find(m => m.id === messageId);
    if (msg) {
      setEditingMessageId(messageId);
      setEditingMessageContent(msg.content as string);
    }
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingMessageContent('');
  };

  const handleBranchMessage = (messageId: string) => {
    const msgIndex = chatMessages.findIndex(m => m.id === messageId);
    if (msgIndex === -1) return;
    const branchPoint = chatMessages[msgIndex];
    if (branchPoint?.role === 'user') {
      setChatInput(branchPoint.content as string);
      chatInputRef.current?.focus();
    }
  };

  const handleTogglePin = (sessionId: string) => {
    setPinnedSessions(prev => {
      const next = prev.includes(sessionId)
        ? prev.filter(id => id !== sessionId)
        : [...prev, sessionId];
      localStorage.setItem('pinnedChatSessions', JSON.stringify(next));
      return next;
    });
  };

  const handleSaveCustomRole = (role: AiRole) => {
    setCustomRoles(prev => {
      const existing = prev.findIndex(r => r.id === role.id);
      let updated: AiRole[];
      if (existing >= 0) {
        updated = [...prev];
        updated[existing] = role;
      } else {
        updated = [...prev, role];
      }
      localStorage.setItem('customAiRoles', JSON.stringify(updated));
      return updated;
    });
    setSelectedRole(role.id);
  };

  const handleDeleteCustomRole = (roleId: string) => {
    setCustomRoles(prev => {
      const updated = prev.filter(r => r.id !== roleId);
      localStorage.setItem('customAiRoles', JSON.stringify(updated));
      return updated;
    });
    if (selectedRole === roleId) {
      setSelectedRole('default');
    }
  };

  return {
    isChatSidebarOpen, setIsChatSidebarOpen,
    chatInput, setChatInput,
    customSystemPrompt, setCustomSystemPrompt,
    selectedRole, setSelectedRole,
    sessionRoleMap, setSessionRoleMap,
    pendingRole, setPendingRole,
    chatImages, setChatImages,
    expandedReasoningMessages, setExpandedReasoningMessages,
    copiedCodeId, setCopiedCodeId,
    editingMessageId, setEditingMessageId,
    editingMessageContent, setEditingMessageContent,
    pinnedSessions, setPinnedSessions,
    copiedId, setCopiedId,
    isPromptSelectorOpen, setIsPromptSelectorOpen,
    promptCategory, setPromptCategory,
    promptSearchQuery, setPromptSearchQuery,
    customRoles, allRoles,
    isRoleEditorOpen, setIsRoleEditorOpen,
    editingCustomRole, setEditingCustomRole,
    chatInputRef, chatEndRef, fileInputRef, chatScrollRef,
    selectedText, setSelectedText,
    chatSearchQuery, setChatSearchQuery,
    chatSearchResults, setChatSearchResults,
    isChatSearching, setIsChatSearching,
    isChatSearchOpen, setIsChatSearchOpen,
    bookmarkedMessages,
    searxngStatus,
    chatContextLength, setChatContextLength,
    manualPreferredMcpServerId, setManualPreferredMcpServerId,
    manualPreferredMcpServerName, setManualPreferredMcpServerName,
    filteredPromptTemplates,
    getCurrentSystemPrompt,
    checkSearxngConnection,
    loadBookmarkedMessages,
    handleToggleBookmark,
    handleFileSelect, removeImage,
    toggleReasoningExpanded,
    handleSearchEnabledChange, handleSearxngUrlChange, handleShowReasoningProcessChange,
    handleCopy,
    handleExportMessage, handleExportChat,
    handleEditMessage, handleCancelEdit, handleBranchMessage,
    handleTogglePin,
    handleSaveCustomRole, handleDeleteCustomRole,
  };
}

import type { ChatSearchResult } from '../types/chat';