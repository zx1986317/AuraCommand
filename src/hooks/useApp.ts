import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useChatLogic } from './useChatLogic';
import { useKBLogic } from './useKBLogic';
import { useWorkflowsLogic } from './useWorkflowsLogic';
import { useAppStore } from '../store/appStore';
import { logger } from '../utils/logger';

export function useApp() {
  const activeTab = useAppStore(s => s.activeTab);
  const setActiveTab = useAppStore(s => s.setActiveTab);
  const deskDefaultTab = useAppStore(s => s.deskDefaultTab);
  const setDeskDefaultTab = useAppStore(s => s.setDeskDefaultTab);
  const searchQuery = useAppStore(s => s.searchQuery);
  const setSearchQuery = useAppStore(s => s.setSearchQuery);
  const isAIProcessing = useAppStore(s => s.isAIProcessing);
  const setIsAIProcessing = useAppStore(s => s.setIsAIProcessing);
  const isSettingsModalOpen = useAppStore(s => s.isSettingsModalOpen);
  const setIsSettingsModalOpen = useAppStore(s => s.setIsSettingsModalOpen);
  const currentTheme = useAppStore(s => s.currentTheme);
  const vaultPath = useAppStore(s => s.vaultPath);
  const setVaultPath = useAppStore(s => s.setVaultPath);
  const notification = useAppStore(s => s.notification);
  const setNotification = useAppStore(s => s.setNotification);
  const isMaximized = useAppStore(s => s.isMaximized);
  const setIsMaximized = useAppStore(s => s.setIsMaximized);
  const ollamaStatus = useAppStore(s => s.ollamaStatus);
  const setOllamaStatus = useAppStore(s => s.setOllamaStatus);
  const modalConfig = useAppStore(s => s.modalConfig);
  const setModalConfig = useAppStore(s => s.setModalConfig);
  const sourceNoteToOpen = useAppStore(s => s.sourceNoteToOpen);
  const setSourceNoteToOpen = useAppStore(s => s.setSourceNoteToOpen);
  const editingSchedule = useAppStore(s => s.editingSchedule);
  const setEditingSchedule = useAppStore(s => s.setEditingSchedule);
  const isMemoryPanelOpen = useAppStore(s => s.isMemoryPanelOpen);
  const setIsMemoryPanelOpen = useAppStore(s => s.setIsMemoryPanelOpen);
  const selectedModel = useAppStore(s => s.selectedModel);
  const proactiveNotifications = useAppStore(s => s.proactiveNotifications);
  const addProactiveNotification = useAppStore(s => s.addProactiveNotification);
  const removeProactiveNotification = useAppStore(s => s.removeProactiveNotification);

  const [aiMemories, setAiMemories] = useState<any[]>([]);

  const chatLogic = useChatLogic({
    setNotification,
    setModalConfig,
  });

  const kbLogic = useKBLogic({
    setNotification,
    setModalConfig,
    setIsAIProcessing,
  });

  const workflowsLogic = useWorkflowsLogic({
    setNotification,
  });

  const loadData = async () => {
    await Promise.all([
      kbLogic.loadFiles(),
      loadAiMemories()
    ]);
  };

  const loadAiMemories = async () => {
    try {
      const memories = await window.ipcRenderer.invoke('get-ai-memories');
      setAiMemories(memories);
    } catch (err) {
      console.error('[useApp] Failed to load AI memories:', err);
    }
  };

  const handleDeleteAiMemory = async (id: string) => {
    try {
      await window.ipcRenderer.invoke('delete-ai-memory', { id });
      setAiMemories(prev => prev.filter(m => m.id !== id));
    } catch (err) {
      console.error('[useApp] Failed to delete AI memory:', err);
    }
  };

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const handler = (_event: any, data: any) => {
      addProactiveNotification(data);
      if (data.message) {
        setNotification({ message: data.message, type: 'info' });
      }
      const timer = setTimeout(() => {
        removeProactiveNotification(data.timestamp);
      }, 8000);
      timers.push(timer);
    };
    window.ipcRenderer.on('proactive-notification', handler);
    return () => {
      window.ipcRenderer.off('proactive-notification', handler);
      timers.forEach(t => clearTimeout(t));
    };
  }, []);

  const handleVaultSwitched = async (newPath: string) => {
    setVaultPath(newPath);
    setModalConfig(null);
    chatLogic.setChatSessions([]);
    chatLogic.setChatMessages([]);
    chatLogic.setActiveSessionId(null);
    localStorage.removeItem('activeSessionId');

    await loadData();
    await chatLogic.loadSessionState(null);

    setNotification({ message: `知识库目录已切换到: ${newPath}`, type: 'info' });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleCreateMemoFromChat = async (content: string, title?: string) => {
    try {
      const id = uuidv4();
      await window.ipcRenderer.invoke('save-note', {
        id,
        title: title || '来自AI对话',
        content: content,
        type: 'quick_note',
        project: 'AI对话沉淀',
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
    } catch (err) {
      logger.error('Failed to create memo from chat:', err);
      setNotification({ message: '保存便签失败，请重试', type: 'error' });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleCreateScheduleFromChat = async (content: string) => {
    try {
      setIsAIProcessing(true);
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
        setNotification({ message: `已从对话生成 ${extractedSchedules.length} 项任务`, type: 'info' });
      } else {
        setNotification({ message: '未检测到可提取的待办信息，已为您打开新建待办', type: 'warning' });
        setActiveTab('tasks');
      }
      setTimeout(() => setNotification(null), 3000);
    } catch (err) {
      logger.error('Create schedule from chat failed:', err);
      setNotification({ message: '生成任务失败，请手动创建', type: 'error' });
      setTimeout(() => setNotification(null), 3000);
    } finally {
      setIsAIProcessing(false);
    }
  };

  useEffect(() => {
    const initApp = async () => {
      try {
        const config = await window.ipcRenderer.invoke('get-vault-config');
        if (config && config.path) {
          setVaultPath(config.path);
        }
        await chatLogic.loadSessionState(localStorage.getItem('activeSessionId'));
      } catch (err) {
        logger.error('Failed to init app:', err);
      }
    };
    initApp();
  }, []);

  useEffect(() => {
    if (!window.ipcRenderer) return;
    const checkStatus = async () => {
      try {
        const [ollamaStatus, cloudEnabled] = await Promise.all([
          window.ipcRenderer.invoke('check-ollama-status'),
          window.ipcRenderer.invoke('is-cloud-ai-enabled'),
        ])
        // 如果启用了云端AI，即使Ollama未连接也视为已连接
        if (cloudEnabled && !ollamaStatus.connected) {
          setOllamaStatus({ connected: true, chatModelReady: true, embeddingModelReady: true })
        } else {
          setOllamaStatus(ollamaStatus)
        }
      } catch {
        setOllamaStatus({ connected: false, chatModelReady: false, embeddingModelReady: false, error: '无法检测 AI 状态' });
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', currentTheme);
  }, [currentTheme]);

  useEffect(() => {
    const preventDefault = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    window.addEventListener('dragover', preventDefault);
    window.addEventListener('drop', preventDefault);

    let handleProgress: ((event: any, data: any) => void) | null = null;
    let handleFileAdded: ((event: any) => void) | null = null;
    const pendingTimers: ReturnType<typeof setTimeout>[] = [];

    if (window.ipcRenderer) {
      handleProgress = (_event: any, data: any) => {
        const normalized = {
          ...data,
          progress: typeof data.progress === 'number' ? data.progress : (data.status === 'completed' ? 100 : 0)
        };

        kbLogic.setIndexingFiles(prev => ({
          ...prev,
          [normalized.fileId]: normalized
        }));

        if (normalized.status === 'completed') {
          pendingTimers.push(setTimeout(() => {
            kbLogic.setIndexingFiles(current => {
              const next = { ...current };
              delete next[normalized.fileId];
              return next;
            });
            kbLogic.loadFiles();
          }, 3000));
        } else if (normalized.status === 'error') {
          pendingTimers.push(setTimeout(() => {
            kbLogic.setIndexingFiles(current => {
              const next = { ...current };
              delete next[normalized.fileId];
              return next;
            });
          }, 5000));
          if (setNotification) {
            const fileName = normalized.fileName || normalized.fileId || '未知文件';
            setNotification({ message: `${fileName} 处理失败`, type: 'error' });
            pendingTimers.push(setTimeout(() => setNotification(null), 4000));
          }
          kbLogic.loadFiles();
        }
      };

      handleFileAdded = (_event: any) => {
        kbLogic.loadFiles();
      };

      window.ipcRenderer.on('vault-file-added', handleFileAdded!);
      window.ipcRenderer.on('indexing-progress', handleProgress!);
      chatLogic.loadModels();

      window.ipcRenderer.invoke('is-maximized').then(setIsMaximized);

      const handleWindowMaximized = (_event: any) => setIsMaximized(true);
      const handleWindowUnmaximized = (_event: any) => setIsMaximized(false);

      window.ipcRenderer.on('window-maximized', handleWindowMaximized);
      window.ipcRenderer.on('window-unmaximized', handleWindowUnmaximized);

      const handleNavigateToTasks = () => setActiveTab('tasks');
      window.ipcRenderer.on('navigate-to-tasks', handleNavigateToTasks);

      loadData();

      return () => {
        pendingTimers.forEach(clearTimeout);
        window.removeEventListener('dragover', preventDefault);
        window.removeEventListener('drop', preventDefault);
        if (window.ipcRenderer) {
          if (handleFileAdded) window.ipcRenderer.off('vault-file-added', handleFileAdded);
          if (handleProgress) window.ipcRenderer.off('indexing-progress', handleProgress);
          window.ipcRenderer.off('window-maximized', handleWindowMaximized);
          window.ipcRenderer.off('window-unmaximized', handleWindowUnmaximized);
          window.ipcRenderer.off('navigate-to-tasks', handleNavigateToTasks);
        }
      };
    }
  }, []);

  return {
    activeTab, setActiveTab,
    deskDefaultTab, setDeskDefaultTab,
    searchQuery, setSearchQuery,
    isAIProcessing, setIsAIProcessing,
    isSettingsModalOpen, setIsSettingsModalOpen,
    currentTheme,
    setCurrentTheme: useAppStore(s => s.setCurrentTheme),
    vaultPath,
    notification, setNotification,
    isMaximized,
    ollamaStatus,
    modalConfig, setModalConfig,

    chatMessages: chatLogic.chatMessages, setChatMessages: chatLogic.setChatMessages,
    chatSessions: chatLogic.chatSessions, setChatSessions: chatLogic.setChatSessions,
    pinnedSessions: chatLogic.pinnedSessions, handleTogglePin: chatLogic.handleTogglePin,
    activeSessionId: chatLogic.activeSessionId, setActiveSessionId: chatLogic.setActiveSessionId,
    isChatSidebarOpen: chatLogic.isChatSidebarOpen, setIsChatSidebarOpen: chatLogic.setIsChatSidebarOpen,
    chatInput: chatLogic.chatInput, setChatInput: chatLogic.setChatInput,
    isChatLoading: chatLogic.isChatLoading,
    availableModels: useAppStore(s => s.availableModels),
    visionModels: useAppStore(s => s.visionModels),
    selectedModel: useAppStore(s => s.selectedModel),
    isModelDropdownOpen: useAppStore(s => s.isModelDropdownOpen), setIsModelDropdownOpen: useAppStore(s => s.setIsModelDropdownOpen),
    isSearchEnabled: useAppStore(s => s.isSearchEnabled), setIsSearchEnabled: useAppStore(s => s.setIsSearchEnabled),

    isRAGEnabled: useAppStore(s => s.isRAGEnabled), setIsRAGEnabled: useAppStore(s => s.setIsRAGEnabled),
    chatNetworkMode: useAppStore(s => s.chatNetworkMode), setChatNetworkMode: useAppStore(s => s.setChatNetworkMode),

    agentSteps: chatLogic.agentSteps,
    activeMcpRouting: chatLogic.activeMcpRouting,
    manualPreferredMcpServerId: chatLogic.manualPreferredMcpServerId,
    manualPreferredMcpServerName: chatLogic.manualPreferredMcpServerName,
    setManualPreferredMcpServerId: chatLogic.setManualPreferredMcpServerId,
    setManualPreferredMcpServerName: chatLogic.setManualPreferredMcpServerName,
    searxngUrl: useAppStore(s => s.searxngUrl),
    showReasoningProcess: useAppStore(s => s.showReasoningProcess),
    customSystemPrompt: chatLogic.customSystemPrompt, setCustomSystemPrompt: chatLogic.setCustomSystemPrompt,
    selectedRole: chatLogic.selectedRole, setSelectedRole: chatLogic.setSelectedRole,
    chatImages: chatLogic.chatImages, setChatImages: chatLogic.setChatImages,
    chatAttachments: chatLogic.chatAttachments, setChatAttachments: chatLogic.setChatAttachments,
    attachmentLoading: chatLogic.attachmentLoading, setAttachmentLoading: chatLogic.setAttachmentLoading,
    chatEndRef: chatLogic.chatEndRef, chatInputRef: chatLogic.chatInputRef, fileInputRef: chatLogic.fileInputRef,
    expandedReasoningMessages: chatLogic.expandedReasoningMessages, setExpandedReasoningMessages: chatLogic.setExpandedReasoningMessages,
    copiedCodeId: chatLogic.copiedCodeId, setCopiedCodeId: chatLogic.setCopiedCodeId,
    editingMessageId: chatLogic.editingMessageId, setEditingMessageId: chatLogic.setEditingMessageId,
    editingMessageContent: chatLogic.editingMessageContent, setEditingMessageContent: chatLogic.setEditingMessageContent,
    copiedId: chatLogic.copiedId, setCopiedId: chatLogic.setCopiedId,
    isPromptSelectorOpen: chatLogic.isPromptSelectorOpen, setIsPromptSelectorOpen: chatLogic.setIsPromptSelectorOpen,
    promptCategory: chatLogic.promptCategory, setPromptCategory: chatLogic.setPromptCategory,
    promptSearchQuery: chatLogic.promptSearchQuery, setPromptSearchQuery: chatLogic.setPromptSearchQuery,
    filteredPromptTemplates: chatLogic.filteredPromptTemplates,
    chatSearchQuery: chatLogic.chatSearchQuery, setChatSearchQuery: chatLogic.setChatSearchQuery, chatSearchResults: chatLogic.chatSearchResults, isChatSearching: chatLogic.isChatSearching, isChatSearchOpen: chatLogic.isChatSearchOpen, setIsChatSearchOpen: chatLogic.setIsChatSearchOpen, handleChatSearch: chatLogic.handleChatSearch,
    bookmarkedMessages: chatLogic.bookmarkedMessages, loadBookmarkedMessages: chatLogic.loadBookmarkedMessages, handleToggleBookmark: chatLogic.handleToggleBookmark,
    handleFileSelect: chatLogic.handleFileSelect, removeImage: chatLogic.removeImage,
    handleSearchEnabledChange: chatLogic.handleSearchEnabledChange, handleSearxngUrlChange: chatLogic.handleSearxngUrlChange, handleShowReasoningProcessChange: chatLogic.handleShowReasoningProcessChange,
    handleCopy: chatLogic.handleCopy, handleExportMessage: chatLogic.handleExportMessage, handleExportChat: chatLogic.handleExportChat, handleExtractTodos: chatLogic.handleExtractTodos,
    handleStopChat: chatLogic.handleStopChat,
    handleEditMessage: chatLogic.handleEditMessage, handleCancelEdit: chatLogic.handleCancelEdit, handleSaveEditAndRegenerate: chatLogic.handleSaveEditAndRegenerate, handleRegenerateResponse: chatLogic.handleRegenerateResponse, handleContinueResponse: chatLogic.handleContinueResponse, handleBranchMessage: chatLogic.handleBranchMessage,
    handleNewChat: chatLogic.handleNewChat, handleSelectSession: chatLogic.handleSelectSession, handleDeleteSession: chatLogic.handleDeleteSession, handleRenameSession: chatLogic.handleRenameSession, handleClearChat: chatLogic.handleClearChat, handleRollbackTurn: chatLogic.handleRollbackTurn,
    handleSendMessage: chatLogic.handleSendMessage,
    handleModelChange: chatLogic.handleModelChange,
    loadModels: chatLogic.loadModels, loadSessionState: chatLogic.loadSessionState,

    files: kbLogic.files,
    visibleFiles: kbLogic.visibleFiles,
    indexedFileCount: kbLogic.indexedFileCount,
    activeIndexingCount: kbLogic.activeIndexingCount,
    totalStorageMB: kbLogic.totalStorageMB,
    fileTypeStats: kbLogic.fileTypeStats,
    isDragging: kbLogic.isDragging,
    indexingEntries: kbLogic.indexingEntries,
    kbFilter: kbLogic.kbFilter, setKbFilter: kbLogic.setKbFilter,
    kbSort: kbLogic.kbSort, setKbSort: kbLogic.setKbSort,
    kbViewMode: kbLogic.kbViewMode, setKbViewMode: kbLogic.setKbViewMode,
    kbGraphData: kbLogic.kbGraphData,
    loadFiles: kbLogic.loadFiles,
    filesPage: kbLogic.filesPage, setFilesPage: kbLogic.setFilesPage,
    filesPageSize: kbLogic.filesPageSize,
    filesTotal: kbLogic.filesTotal,
    filesTotalPages: kbLogic.filesTotalPages,
    handleDeleteFile: kbLogic.handleDeleteFile,
    handleDragOver: kbLogic.handleDragOver, handleDragLeave: kbLogic.handleDragLeave, handleDrop: kbLogic.handleDrop,
    loadKbGraphData: kbLogic.loadKbGraphData,
    kbSearchQuery: kbLogic.kbSearchQuery, setKbSearchQuery: kbLogic.setKbSearchQuery,
    kbSearchMode: kbLogic.kbSearchMode, setKbSearchMode: kbLogic.setKbSearchMode,
    kbSearchResults: kbLogic.kbSearchResults, setKbSearchResults: kbLogic.setKbSearchResults,
    isKbSearching: kbLogic.isKbSearching,
    handleKbSearch: kbLogic.handleKbSearch,
    handleGenerateSummary: kbLogic.handleGenerateSummary,
    allFileTags: kbLogic.allFileTags, loadFileTags: kbLogic.loadFileTags,
    selectedTagFilter: kbLogic.selectedTagFilter, setSelectedTagFilter: kbLogic.setSelectedTagFilter,
    handleUpdateFileTags: kbLogic.handleUpdateFileTags,
    folderTree: kbLogic.folderTree,
    selectedFolderFilter: kbLogic.selectedFolderFilter, setSelectedFolderFilter: kbLogic.setSelectedFolderFilter,
    kbFolders: kbLogic.kbFolders, loadKbFolders: kbLogic.loadKbFolders,
    selectedVirtualFolder: kbLogic.selectedVirtualFolder, setSelectedVirtualFolder: kbLogic.setSelectedVirtualFolder,
    createKbFolder: kbLogic.createKbFolder, renameKbFolder: kbLogic.renameKbFolder, deleteKbFolder: kbLogic.deleteKbFolder,
    moveFileToFolder: kbLogic.moveFileToFolder, relinkFile: kbLogic.relinkFile,
    showImportDialog: kbLogic.showImportDialog, setShowImportDialog: kbLogic.setShowImportDialog,
    pendingImportPaths: kbLogic.pendingImportPaths, setPendingImportPaths: kbLogic.setPendingImportPaths,
    importMode: kbLogic.importMode, setImportMode: kbLogic.setImportMode,
    importTargetFolder: kbLogic.importTargetFolder, setImportTargetFolder: kbLogic.setImportTargetFolder,
    confirmImport: kbLogic.confirmImport,

    workflows: workflowsLogic.workflows,
    showWorkflowModal: workflowsLogic.showWorkflowModal, setShowWorkflowModal: workflowsLogic.setShowWorkflowModal,
    editingWorkflow: workflowsLogic.editingWorkflow, setEditingWorkflow: workflowsLogic.setEditingWorkflow,
    pdfViewerState: workflowsLogic.pdfViewerState, setPdfViewerState: workflowsLogic.setPdfViewerState,
    workflowLogs: workflowsLogic.workflowLogs,
    executingWorkflows: workflowsLogic.executingWorkflows,
    loadWorkflows: workflowsLogic.loadWorkflows, handleExecuteWorkflow: workflowsLogic.handleExecuteWorkflow,
    handleToggleWorkflowEnabled: workflowsLogic.handleToggleWorkflowEnabled,

    handleVaultSwitched, loadData,
    handleCreateMemoFromChat, handleCreateScheduleFromChat,

    aiMemories, isMemoryPanelOpen, setIsMemoryPanelOpen, loadAiMemories, handleDeleteAiMemory,
    proactiveNotifications,

    customRoles: chatLogic.customRoles,
    allRoles: chatLogic.allRoles,
    isRoleEditorOpen: chatLogic.isRoleEditorOpen, setIsRoleEditorOpen: chatLogic.setIsRoleEditorOpen,
    editingCustomRole: chatLogic.editingCustomRole, setEditingCustomRole: chatLogic.setEditingCustomRole,
    handleSaveCustomRole: chatLogic.handleSaveCustomRole,
    handleDeleteCustomRole: chatLogic.handleDeleteCustomRole,
    searxngStatus: chatLogic.searxngStatus,
    checkSearxngConnection: chatLogic.checkSearxngConnection,
    chatContextLength: chatLogic.chatContextLength,
    setChatContextLength: chatLogic.setChatContextLength,

    sourceNoteToOpen, setSourceNoteToOpen,
    editingSchedule, setEditingSchedule,
  };
}
