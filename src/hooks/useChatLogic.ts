import { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../store/appStore';
import { logger } from '../utils/logger';
import type { ChatMessage, ChatSession, AgentStep } from '../types/chat';
import { useChatStream, sanitizeStreamingAssistantText, extractMcpRoutingState } from './useChatStream';
import { useChatSession } from './useChatSession';
import { useChatUI } from './useChatUI';

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

interface ChatLogicDeps {
  setNotification: (n: { message: string; type: 'info' | 'error' | 'warning' | 'success' } | null) => void;
  setModalConfig: (config: { isOpen: boolean; title: string; message: string; onConfirm: (inputValue?: string) => void; inputDefaultValue?: string | undefined; } | null) => void;
}

export function useChatLogic(deps: ChatLogicDeps) {
  const { setNotification, setModalConfig } = deps;

  const chatNetworkMode = useAppStore(s => s.chatNetworkMode);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(localStorage.getItem('activeSessionId') || null);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]);
  const [activeMcpRouting, setActiveMcpRouting] = useState<McpRoutingState | null>(null);
  const [chatAttachments, setChatAttachments] = useState<Array<{ name: string; text: string; size: number }>>([]);
  const [attachmentLoading, setAttachmentLoading] = useState(false);

  const ui = useChatUI({
    setNotification,
    chatMessages,
    setChatMessages,
    activeSessionId,
  });

  const stream = useChatStream({
    chatMessages, setChatMessages, activeSessionId,
    isChatLoading, setIsChatLoading,
    agentSteps, setAgentSteps,
    activeMcpRouting, setActiveMcpRouting,
    chatAttachments, setChatAttachments,
    chatInput: ui.chatInput, setChatInput: ui.setChatInput,
    chatImages: ui.chatImages, setChatImages: ui.setChatImages,
    chatContextLength: ui.chatContextLength,
    manualPreferredMcpServerId: ui.manualPreferredMcpServerId,
    getCurrentSystemPrompt: ui.getCurrentSystemPrompt,
  });

  const cleanupChatListeners = () => {
    stream.cleanupAllStreamListeners();
    setActiveMcpRouting(null);
    setIsChatLoading(false);
  };

  const handleNewChat = async () => {
    cleanupChatListeners();
    setActiveSessionId(null);
    localStorage.removeItem('activeSessionId');
    setChatMessages([]);
    setAgentSteps([]);
    ui.setChatInput('');
    requestAnimationFrame(() => {
      ui.chatInputRef.current?.focus();
    });
  };

  const session = useChatSession({
    setNotification, setModalConfig,
    chatMessages, setChatMessages,
    chatSessions, setChatSessions,
    activeSessionId, setActiveSessionId,
    setIsChatLoading, setAgentSteps, setActiveMcpRouting,
    setChatInput: ui.setChatInput, chatInputRef: ui.chatInputRef,
    cleanupChatListeners, handleNewChat,
    chatSearchResults: ui.chatSearchResults, setChatSearchResults: ui.setChatSearchResults,
    isChatSearching: ui.isChatSearching, setIsChatSearching: ui.setIsChatSearching,
  });

  useEffect(() => {
    const handleSessionCreated = (_event: any, { id, title }: { id: string, title: string }) => {
      if (id.startsWith('doc-')) return;
      setChatSessions(prev => {
        if (prev.some(s => s.id === id)) return prev;
        return [{ id, title, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, ...prev];
      });
      setActiveSessionId(id);
      localStorage.setItem('activeSessionId', id);
      if (ui.pendingRole !== 'default') {
        ui.setSessionRoleMap(prev => {
          const next = { ...prev, [id]: ui.pendingRole };
          localStorage.setItem('sessionRoleMap', JSON.stringify(next));
          return next;
        });
      }
    };
    window.ipcRenderer.on('session-created', handleSessionCreated);
    return () => window.ipcRenderer.off('session-created', handleSessionCreated);
  }, [ui.pendingRole]);

  useEffect(() => {
    const el = ui.chatScrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 200;
    if (isNearBottom) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'auto' });
    }
  }, [chatMessages, isChatLoading]);

  const sortedChatSessions = useMemo(() => {
    const pinned = ui.pinnedSessions
      .map((id: string) => chatSessions.find((s: any) => s.id === id))
      .filter((s): s is NonNullable<typeof s> => !!s);
    const unpinned = chatSessions.filter((s: any) => !ui.pinnedSessions.includes(s.id));
    return [...pinned, ...unpinned];
  }, [chatSessions, ui.pinnedSessions]);

  // Cleanup stream listeners on unmount
  useEffect(() => {
    return () => {
      stream.cleanupAllStreamListeners();
    };
  }, []);

  return {
    chatMessages, setChatMessages,
    chatSessions: sortedChatSessions, setChatSessions,
    activeSessionId, setActiveSessionId,
    isChatSidebarOpen: ui.isChatSidebarOpen, setIsChatSidebarOpen: ui.setIsChatSidebarOpen,
    chatInput: ui.chatInput, setChatInput: ui.setChatInput,
    isChatLoading, setIsChatLoading,
    agentSteps, setAgentSteps,
    customSystemPrompt: ui.customSystemPrompt, setCustomSystemPrompt: ui.setCustomSystemPrompt,
    selectedRole: ui.selectedRole, setSelectedRole: ui.setSelectedRole,
    sessionRoleMap: ui.sessionRoleMap,
    activeMcpRouting,
    manualPreferredMcpServerId: ui.manualPreferredMcpServerId, setManualPreferredMcpServerId: ui.setManualPreferredMcpServerId,
    manualPreferredMcpServerName: ui.manualPreferredMcpServerName, setManualPreferredMcpServerName: ui.setManualPreferredMcpServerName,
    chatImages: ui.chatImages, setChatImages: ui.setChatImages,
    chatAttachments, setChatAttachments, attachmentLoading, setAttachmentLoading,
    expandedReasoningMessages: ui.expandedReasoningMessages, setExpandedReasoningMessages: ui.setExpandedReasoningMessages,
    copiedCodeId: ui.copiedCodeId, setCopiedCodeId: ui.setCopiedCodeId,
    editingMessageId: ui.editingMessageId, setEditingMessageId: ui.setEditingMessageId,
    editingMessageContent: ui.editingMessageContent, setEditingMessageContent: ui.setEditingMessageContent,
    copiedId: ui.copiedId, setCopiedId: ui.setCopiedId,
    isPromptSelectorOpen: ui.isPromptSelectorOpen, setIsPromptSelectorOpen: ui.setIsPromptSelectorOpen,
    promptCategory: ui.promptCategory, setPromptCategory: ui.setPromptCategory,
    promptSearchQuery: ui.promptSearchQuery, setPromptSearchQuery: ui.setPromptSearchQuery,
    chatInputRef: ui.chatInputRef, chatEndRef: ui.chatEndRef, fileInputRef: ui.fileInputRef, chatScrollRef: ui.chatScrollRef,
    filteredPromptTemplates: ui.filteredPromptTemplates,
    chatSearchQuery: ui.chatSearchQuery, setChatSearchQuery: ui.setChatSearchQuery, chatSearchResults: ui.chatSearchResults, isChatSearching: ui.isChatSearching, isChatSearchOpen: ui.isChatSearchOpen, setIsChatSearchOpen: ui.setIsChatSearchOpen, handleChatSearch: session.handleChatSearch,
    bookmarkedMessages: ui.bookmarkedMessages, loadBookmarkedMessages: ui.loadBookmarkedMessages, handleToggleBookmark: ui.handleToggleBookmark,
    handleFileSelect: ui.handleFileSelect, removeImage: ui.removeImage, toggleReasoningExpanded: ui.toggleReasoningExpanded,
    handleSearchEnabledChange: ui.handleSearchEnabledChange, handleSearxngUrlChange: ui.handleSearxngUrlChange, handleShowReasoningProcessChange: ui.handleShowReasoningProcessChange,
    handleCopy: ui.handleCopy, handleExportMessage: ui.handleExportMessage, handleExportChat: ui.handleExportChat, handleExtractTodos: session.handleExtractTodos,
    handleStopChat: stream.handleStopChat,
    handleEditMessage: ui.handleEditMessage, handleCancelEdit: ui.handleCancelEdit, handleSaveEditAndRegenerate: () => stream.handleSaveEditAndRegenerate(ui.editingMessageId, ui.editingMessageContent), handleRegenerateResponse: stream.handleRegenerateResponse, handleContinueResponse: stream.handleContinueResponse, handleBranchMessage: ui.handleBranchMessage,
    handleNewChat, handleSelectSession: session.handleSelectSession, handleDeleteSession: session.handleDeleteSession, handleRenameSession: session.handleRenameSession, handleClearChat: session.handleClearChat, handleRollbackTurn: session.handleRollbackTurn,
    handleSendMessage: stream.handleSendMessage, handleModelChange: session.handleModelChange, handleExportSession: session.handleExportSession,
    getCurrentSystemPrompt: ui.getCurrentSystemPrompt, loadModels: session.loadModels, loadSessionState: session.loadSessionState,
    customRoles: ui.customRoles, allRoles: ui.allRoles, isRoleEditorOpen: ui.isRoleEditorOpen, setIsRoleEditorOpen: ui.setIsRoleEditorOpen, editingCustomRole: ui.editingCustomRole, setEditingCustomRole: ui.setEditingCustomRole,
    handleSaveCustomRole: ui.handleSaveCustomRole, handleDeleteCustomRole: ui.handleDeleteCustomRole,
    pinnedSessions: ui.pinnedSessions, handleTogglePin: ui.handleTogglePin,
    searxngStatus: ui.searxngStatus, checkSearxngConnection: ui.checkSearxngConnection,
    chatNetworkMode,
    chatContextLength: ui.chatContextLength, setChatContextLength: ui.setChatContextLength,
  };
}
