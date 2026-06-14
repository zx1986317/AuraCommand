import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Zap } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useApp } from './hooks/useApp';
import type { ActiveTab } from './store/types';
import { useAIActions } from './hooks/useAIActions';
import { useOnboarding } from './hooks/useOnboarding';
import { useShortcuts } from './hooks/useShortcuts';
import { useAppStore } from './store/appStore';
import { useTranslation } from './i18n/I18nContext';
import AppProviders from './app/AppProviders';
import AppLayout from './app/AppLayout';
import AppRouter from './app/AppRouter';
import AppModals from './app/AppModals';

const AuraLogo = () => (
  <div className="relative w-10 h-10 flex items-center justify-center">
    <div className="absolute inset-0 bg-accent rounded-xl blur-lg opacity-20 animate-pulse"></div>
    <div className="relative w-full h-full bg-white border border-accent/10 rounded-xl flex items-center justify-center shadow-glass overflow-hidden">
      <Zap size={20} className="text-accent fill-accent" />
      <div className="absolute inset-0 bg-gradient-to-tr from-accent/5 to-transparent"></div>
    </div>
  </div>
);

const App: React.FC = () => {
  const {
    activeTab, setActiveTab,
    deskDefaultTab, setDeskDefaultTab,
    chatMessages, setChatMessages,
    chatSessions,
    pinnedSessions, handleTogglePin,
    activeSessionId,
    isChatSidebarOpen,
    chatInput, setChatInput,
    isChatLoading,
    searchQuery, setSearchQuery,
    files,
    loadFiles,
    isAIProcessing, setIsAIProcessing,
    availableModels,
    visionModels,
    selectedModel,
    isModelDropdownOpen, setIsModelDropdownOpen,
    isSettingsModalOpen, setIsSettingsModalOpen,
    currentTheme,
    vaultPath,
    chatInputRef,
    isSearchEnabled, setIsSearchEnabled,
    isRAGEnabled, setIsRAGEnabled,
    chatNetworkMode, setChatNetworkMode,
    agentSteps,
    activeMcpRouting,
    manualPreferredMcpServerId, setManualPreferredMcpServerId,
    manualPreferredMcpServerName, setManualPreferredMcpServerName,
    searxngUrl,
    showReasoningProcess,
    customSystemPrompt, setCustomSystemPrompt,
    selectedRole, setSelectedRole,
    chatImages, setChatImages,
    chatAttachments, setChatAttachments, attachmentLoading, setAttachmentLoading,
    chatEndRef, fileInputRef,
    expandedReasoningMessages, setExpandedReasoningMessages,
    copiedCodeId, setCopiedCodeId,
    workflows,
    showWorkflowModal, setShowWorkflowModal,
    editingWorkflow, setEditingWorkflow,
    pdfViewerState, setPdfViewerState,
    workflowLogs,
    executingWorkflows,
    handleToggleWorkflowEnabled,
    kbViewMode, setKbViewMode,
    kbGraphData,
    editingMessageId, setEditingMessageId,
    editingMessageContent, setEditingMessageContent,
    isMaximized,
    ollamaStatus,
    isDragging,
    isPromptSelectorOpen, setIsPromptSelectorOpen,
    promptCategory, setPromptCategory,
    promptSearchQuery, setPromptSearchQuery,
    notification, setNotification,
    indexingEntries, activeIndexingCount, indexedFileCount, totalStorageMB, fileTypeStats, visibleFiles,
    isFilesLoading, hasLoadedOnce,
    filesPage, filesPageSize, filesTotal, filesTotalPages,
    kbFilter, setKbFilter,
    kbSort, setKbSort,
    filteredPromptTemplates,
    chatSearchQuery, setChatSearchQuery, chatSearchResults, isChatSearching, isChatSearchOpen, setIsChatSearchOpen, handleChatSearch,
    bookmarkedMessages, loadBookmarkedMessages, handleToggleBookmark,
    handleFileSelect, removeImage,
    handleSearchEnabledChange, handleSearxngUrlChange, handleShowReasoningProcessChange,
    handleCopy, handleExportMessage, handleExportChat, handleExtractTodos,
    loadWorkflows, handleExecuteWorkflow, loadKbGraphData,
    handleModelChange, setCurrentTheme,
    handleVaultSwitched,
    loadModels,
    aiMemories, isMemoryPanelOpen, setIsMemoryPanelOpen, loadAiMemories, handleDeleteAiMemory,
    proactiveNotifications,
    handleDragOver, handleDragLeave, handleDrop,
    kbSearchQuery, setKbSearchQuery, kbSearchMode, setKbSearchMode, kbSearchResults, setKbSearchResults,
    isKbSearching, handleKbSearch, handleGenerateSummary,
    allFileTags, loadFileTags, selectedTagFilter, setSelectedTagFilter, handleUpdateFileTags,
    folderTree, selectedFolderFilter, setSelectedFolderFilter,
    kbFolders, loadKbFolders,
    createKbFolder, renameKbFolder, deleteKbFolder, moveFileToFolder, relinkFile,
    showImportDialog, setShowImportDialog,
    pendingImportPaths, setPendingImportPaths,
    importMode, setImportMode,
    importTargetFolder, setImportTargetFolder,
    confirmImport,
    handleStopChat,
    handleNewChat, handleSelectSession, handleDeleteSession, handleRenameSession, handleClearChat, handleRollbackTurn,
    handleSendMessage, handleSaveEditAndRegenerate, handleRegenerateResponse, handleContinueResponse, handleBranchMessage,
    setIsChatSidebarOpen,
    copiedId, setCopiedId,
    modalConfig, setModalConfig,
    handleCreateMemoFromChat,
    handleCreateScheduleFromChat,
    customRoles,
    allRoles,
    isRoleEditorOpen, setIsRoleEditorOpen,
    editingCustomRole, setEditingCustomRole,
    handleSaveCustomRole, handleDeleteCustomRole,
    searxngStatus, checkSearxngConnection,
    chatContextLength, setChatContextLength,
    sourceNoteToOpen, setSourceNoteToOpen,
    editingSchedule, setEditingSchedule,
  } = useApp();

  const { t } = useTranslation();
  const [isWeeklyDigestOpen, setIsWeeklyDigestOpen] = useState(false);

  const {
    isGlobalSearchOpen,
    setIsGlobalSearchOpen,
    isOnboardingOpen,
    setIsOnboardingOpen,
    onboardingStep,
    setOnboardingStep,
    isImportingSampleWorkspace,
    setIsImportingSampleWorkspace,
    hasEvaluatedOnboarding,
    setHasEvaluatedOnboarding,
    showPostImportGuide,
    setShowPostImportGuide,
    highlightedSampleMemoIds,
    setHighlightedSampleMemoIds,
    highlightedSampleFileIds,
    setHighlightedSampleFileIds,
    markOnboardingComplete,
    openOnboarding,
    openImportedSampleMemo,
    openSampleQuestionInChat,
    handleImportSampleWorkspace,
    handleOnboardingImportSample
  } = useOnboarding({
    files,
    loadFiles,
    loadFileTags,
    setNotification,
    setActiveTab,
    setDeskDefaultTab,
    setSourceNoteToOpen,
    ollamaStatus,
  });

  const hasIndexedKnowledge = indexedFileCount > 0;
  const aiChatReady = Boolean(ollamaStatus?.connected && ollamaStatus.chatModelReady);
  const aiEmbeddingReady = Boolean(ollamaStatus?.connected && ollamaStatus.embeddingModelReady);
  const aiRagReady = aiChatReady && aiEmbeddingReady && hasIndexedKnowledge;
  const aiStatusTone: 'ready' | 'warning' | 'error' | 'checking' =
    !ollamaStatus
        ? 'checking'
        : aiRagReady
          ? 'ready'
          : !ollamaStatus.connected
            ? 'error'
            : 'warning';
  const aiStatusLabel =
    aiStatusTone === 'ready'
      ? t('layout.aiStatus.ready')
      : aiStatusTone === 'error'
        ? t('layout.aiStatus.error')
        : aiStatusTone === 'checking'
          ? t('layout.aiStatus.checking')
          : t('layout.aiStatus.warning');
  const aiStatusHint =
    aiStatusTone === 'ready'
      ? t('layout.aiStatusHint.ready', { count: indexedFileCount })
      : !ollamaStatus?.connected
        ? t('layout.aiStatusHint.disconnected')
        : !ollamaStatus.chatModelReady
          ? t('layout.aiStatusHint.noChatModel')
          : !ollamaStatus.embeddingModelReady
            ? t('layout.aiStatusHint.noEmbedding')
            : !hasIndexedKnowledge
              ? t('layout.aiStatusHint.noIndexed')
              : t('layout.aiStatusHint.diagnose');

  const vaultStats = useMemo(() => ({
    totalFiles: files.length,
    indexedCount: indexedFileCount,
    pendingCount: Math.max(files.length - indexedFileCount, 0),
    folderCount: kbFolders.length,
    totalSize: files.reduce((sum: number, file: any) => sum + Number(file.file_size || file.size || 0), 0),
    typeStats: fileTypeStats.map(([type, count]: [string, number]) => ({ type, count })),
    totalMemos: 0,
    totalSchedules: 0,
    vaultPath,
    vectorStatus: indexedFileCount > 0 ? 'active' : files.length > 0 ? 'empty' : 'unknown' as 'active' | 'empty' | 'error' | 'unknown'
  }), [files, indexedFileCount, kbFolders.length, fileTypeStats, vaultPath]);

  const {
    aiSummarizeForContext,
    aiGenerate,
    aiKnowledgeQuestion,
    handleSaveAsNote,
    handleSaveAsDocument,
    handleSaveSchedule,
    handleInsertToScheduleEditor,
    handleSaveAsTask,
  } = useAIActions({
    selectedModel,
    setNotification,
    setActiveTab,
    setDeskDefaultTab,
    setSourceNoteToOpen,
    setEditingSchedule,
    setIsAIProcessing,
  });

  const handleImportFiles = useCallback(async () => {
    try {
      const result = await window.ipcRenderer.invoke('select-file-dialog');
      if (result && result.filePaths && result.filePaths.length > 0) {
        for (const filePath of result.filePaths) {
          await window.ipcRenderer.invoke('import-files', { filePaths: [filePath] });
        }
        loadFiles();
        setNotification({ message: `成功导入 ${result.filePaths.length} 个文件`, type: 'success' });
      }
    } catch (err) {
      console.error('Failed to import files:', err);
      setNotification({ message: '导入文件失败', type: 'error' });
    }
  }, [loadFiles, setNotification]);

  // P1：全局快捷键（Ctrl+1~5 / Ctrl+K / Ctrl+, / Ctrl+N / Ctrl+Shift+T / Esc）
  useShortcuts({
    onSwitchTab: (tab) => setActiveTab(tab),
    onOpenGlobalSearch: () => setIsGlobalSearchOpen(true),
    onOpenSettings: () => setIsSettingsModalOpen(true),
    onNewNote: () => {
      // 切到书桌 tab 并触发新建便签（DeskPage 监听 sourceNoteToOpen）
      setActiveTab('desk');
      setDeskDefaultTab('notes');
      setSourceNoteToOpen({ type: 'note', id: '__new__' });
    },
    onNewTask: () => {
      setActiveTab('tasks');
      setSourceNoteToOpen({ type: 'note', id: '__new_task__' });
    },
    onCloseTopModal: () => {
      if (isSettingsModalOpen) setIsSettingsModalOpen(false);
      else if (isGlobalSearchOpen) setIsGlobalSearchOpen(false);
      else if (modalConfig?.isOpen) setModalConfig(null);
    },
  });

  // P0 #5 修复：全局降级横幅监听（与 useChatStream 内的消息级降级提示并行）
  // 消息内文字会消失/被覆盖，但横幅始终在最顶部，30s 后自动关闭
  const setFallbackEvent = useAppStore(s => s.setFallbackEvent);
  const clearFallbackEvent = useAppStore(s => s.clearFallbackEvent);
  useEffect(() => {
    let dismissTimer: number | null = null;
    const handler = (_event: any, data: { from: string; to: string; message: string }) => {
      setFallbackEvent({ from: data.from, to: data.to, message: data.message, timestamp: Date.now() });
      if (dismissTimer) window.clearTimeout(dismissTimer);
      dismissTimer = window.setTimeout(() => clearFallbackEvent(), 30000);
    };
    window.ipcRenderer.on('chat-fallback', handler);
    return () => {
      window.ipcRenderer.off('chat-fallback', handler);
      if (dismissTimer) window.clearTimeout(dismissTimer);
    };
  }, [setFallbackEvent, clearFallbackEvent]);

  return (
    <AppProviders
      setActiveTab={setActiveTab}
      setDeskDefaultTab={setDeskDefaultTab}
      setSourceNoteToOpen={setSourceNoteToOpen}
      setIsGlobalSearchOpen={setIsGlobalSearchOpen}
    >
      <AppLayout
        activeTab={activeTab}
        selectedModel={selectedModel}
        availableModels={availableModels}
        isAIProcessing={isAIProcessing}
        ollamaStatus={ollamaStatus}
        isMaximized={isMaximized}
        aiStatus={{ tone: aiStatusTone, label: aiStatusLabel, hint: aiStatusHint }}
        AuraLogo={AuraLogo}
        onTabChange={(tab: string) => setActiveTab(tab as ActiveTab)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onOpenGlobalSearch={() => setIsGlobalSearchOpen(true)}
        onOpenWeeklyDigest={() => setIsWeeklyDigestOpen(true)}
      >
        <AppRouter
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          setDeskDefaultTab={setDeskDefaultTab}
          setSourceNoteToOpen={setSourceNoteToOpen}
          setNotification={setNotification}
          setEditingSchedule={setEditingSchedule}
          setPdfViewerState={setPdfViewerState}
          setModalConfig={setModalConfig}
          setIsRAGEnabled={setIsRAGEnabled}
          setChatNetworkMode={setChatNetworkMode}
          setManualPreferredMcpServerId={setManualPreferredMcpServerId}
          setManualPreferredMcpServerName={setManualPreferredMcpServerName}
          setExpandedReasoningMessages={setExpandedReasoningMessages}
          setEditingMessageId={setEditingMessageId}
          setEditingMessageContent={setEditingMessageContent}
          setIsChatSidebarOpen={setIsChatSidebarOpen}
          setSelectedRole={setSelectedRole}
          setIsRoleEditorOpen={setIsRoleEditorOpen}
          setEditingCustomRole={setEditingCustomRole}
          setChatContextLength={setChatContextLength}
          loadFiles={loadFiles}
          handleImportFiles={handleImportFiles}
          handleKbSearch={handleKbSearch}
          handleFileSelect={handleFileSelect}
          removeImage={removeImage}
          handleCopy={handleCopy}
          handleExportChat={handleExportChat}
          handleToggleBookmark={handleToggleBookmark}
          handleExtractTodos={handleExtractTodos}
          handleSendMessage={handleSendMessage}
          handleStopChat={handleStopChat}
          handleNewChat={handleNewChat}
          handleSelectSession={handleSelectSession}
          handleDeleteSession={handleDeleteSession}
          handleRenameSession={handleRenameSession}
          handleClearChat={handleClearChat}
          handleRollbackTurn={handleRollbackTurn}
          handleModelChange={handleModelChange}
          handleSaveEditAndRegenerate={handleSaveEditAndRegenerate}
          handleRegenerateResponse={handleRegenerateResponse}
          handleContinueResponse={handleContinueResponse}
          handleBranchMessage={handleBranchMessage}
          handleExecuteWorkflow={handleExecuteWorkflow}
          handleToggleWorkflowEnabled={handleToggleWorkflowEnabled}
          loadWorkflows={loadWorkflows}
          handleSaveCustomRole={handleSaveCustomRole}
          handleDeleteCustomRole={handleDeleteCustomRole}
          aiGenerate={aiGenerate}
          handleSaveAsTask={handleSaveAsTask}
          chatMessages={chatMessages}
          setChatMessages={setChatMessages}
          chatSessions={chatSessions}
          activeSessionId={activeSessionId}
          chatInput={chatInput}
          setChatInput={setChatInput}
          isChatLoading={isChatLoading}
          availableModels={availableModels}
          selectedModel={selectedModel}
          isRAGEnabled={isRAGEnabled}
          chatNetworkMode={chatNetworkMode}
          agentSteps={agentSteps}
          activeMcpRouting={activeMcpRouting}
          manualPreferredMcpServerId={manualPreferredMcpServerId}
          manualPreferredMcpServerName={manualPreferredMcpServerName}
          showReasoningProcess={showReasoningProcess}
          chatImages={chatImages}
          chatAttachments={chatAttachments}
          setChatAttachments={setChatAttachments}
          attachmentLoading={attachmentLoading}
          setAttachmentLoading={setAttachmentLoading}
          isChatSidebarOpen={isChatSidebarOpen}
          expandedReasoningMessages={expandedReasoningMessages}
          copiedId={copiedId}
          editingMessageId={editingMessageId}
          editingMessageContent={editingMessageContent}
          bookmarkedMessages={bookmarkedMessages}
          chatInputRef={chatInputRef}
          chatEndRef={chatEndRef}
          fileInputRef={fileInputRef}
          pinnedSessions={pinnedSessions}
          handleTogglePin={handleTogglePin}
          selectedRole={selectedRole}
          allRoles={allRoles}
          customRoles={customRoles}
          isRoleEditorOpen={isRoleEditorOpen}
          editingCustomRole={editingCustomRole}
          deskDefaultTab={deskDefaultTab}
          aiChatReady={aiChatReady}
          aiRagReady={aiRagReady}
          workflows={workflows}
          workflowLogs={workflowLogs}
          executingWorkflows={executingWorkflows}
          kbSearchQuery={kbSearchQuery}
          kbSearchResults={kbSearchResults}
          visibleFiles={visibleFiles}
          indexedFileCount={indexedFileCount}
          activeIndexingCount={activeIndexingCount}
          isFilesLoading={isFilesLoading}
          hasLoadedOnce={hasLoadedOnce}
          kbFolders={kbFolders}
          allFileTags={allFileTags}
          createKbFolder={createKbFolder}
          deleteKbFolder={deleteKbFolder}
          moveFileToFolder={moveFileToFolder}
        />
      </AppLayout>

      <AppModals
        activeTab={activeTab}
        indexingEntries={indexingEntries}
        notification={notification}
        setNotification={setNotification}
        isOnboardingOpen={isOnboardingOpen}
        onboardingStep={onboardingStep}
        aiStatusLabel={aiStatusLabel}
        aiStatusHint={aiStatusHint}
        aiChatReady={aiChatReady}
        aiRagReady={aiRagReady}
        isImportingSampleWorkspace={isImportingSampleWorkspace}
        markOnboardingComplete={markOnboardingComplete}
        setOnboardingStep={setOnboardingStep}
        handleOnboardingImportSample={handleOnboardingImportSample}
        setIsSettingsModalOpen={setIsSettingsModalOpen}
        setActiveTab={setActiveTab}
        setDeskDefaultTab={setDeskDefaultTab}
        showPostImportGuide={showPostImportGuide}
        setShowPostImportGuide={setShowPostImportGuide}
        openImportedSampleMemo={openImportedSampleMemo}
        openSampleQuestionInChat={openSampleQuestionInChat}
        proactiveNotifications={proactiveNotifications}
        editingSchedule={editingSchedule}
        handleSaveSchedule={handleSaveSchedule}
        setEditingSchedule={setEditingSchedule}
        setActiveTabForModal={setActiveTab}
        setDeskDefaultTabForModal={setDeskDefaultTab}
        setSourceNoteToOpen={setSourceNoteToOpen}
        modalConfig={modalConfig}
        setModalConfig={setModalConfig}
        isSettingsModalOpen={isSettingsModalOpen}
        selectedModel={selectedModel}
        handleModelChange={handleModelChange}
        availableModels={availableModels}
        vaultPath={vaultPath}
        vaultStats={vaultStats}
        isSearchEnabled={isSearchEnabled}
        handleSearchEnabledChange={handleSearchEnabledChange}
        searxngUrl={searxngUrl}
        handleSearxngUrlChange={handleSearxngUrlChange}
        showReasoningProcess={showReasoningProcess}
        handleShowReasoningProcessChange={handleShowReasoningProcessChange}
        handleVaultSwitched={handleVaultSwitched}
        ollamaStatus={ollamaStatus}
        activeIndexingCount={activeIndexingCount}
        openOnboarding={openOnboarding}
        chatContextLength={chatContextLength}
        setChatContextLength={setChatContextLength}
        loadModels={loadModels}
        pdfViewerState={pdfViewerState}
        setPdfViewerState={setPdfViewerState}
        isGlobalSearchOpen={isGlobalSearchOpen}
        setIsGlobalSearchOpen={setIsGlobalSearchOpen}
        isWeeklyDigestOpen={isWeeklyDigestOpen}
        setIsWeeklyDigestOpen={setIsWeeklyDigestOpen}
      />
    </AppProviders>
  );
};

export default App;
