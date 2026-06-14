import React from 'react';
import { AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { loadWebSearchSettings } from '../utils/webSearchSettings';
import KnowledgePage from '../pages-v2/KnowledgePage';
import DeskPage from '../pages-v2/DeskPage';
import TasksPage from '../pages-v2/TasksPage';
import DashboardPage from '../pages-v2/DashboardPage';
import WorkflowsPage from '../pages-v2/WorkflowsPage';
import MemoryPage from '../pages-v2/MemoryPage';
import ChatPage from '../pages-v2/ChatPage';
import ProjectDashboardPage from '../pages-v2/ProjectDashboardPage';
import { useAppStore } from '../store/appStore';

interface AppRouterProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  setDeskDefaultTab: (tab: any) => void;
  setSourceNoteToOpen: (val: any) => void;
  setNotification: (val: any) => void;
  setEditingSchedule: (val: any) => void;
  setPdfViewerState: (val: any) => void;
  setModalConfig: (val: any) => void;
  setIsRAGEnabled: (val: boolean) => void;
  setChatNetworkMode: (val: any) => void;
  setManualPreferredMcpServerId: (val: any) => void;
  setManualPreferredMcpServerName: (val: string | null) => void;
  setExpandedReasoningMessages: (fn: (prev: any) => any) => void;
  setEditingMessageId: (val: string | null) => void;
  setEditingMessageContent: (val: string) => void;
  setIsChatSidebarOpen: (val: boolean) => void;
  setSelectedRole: (val: any) => void;
  setIsRoleEditorOpen: (val: boolean) => void;
  setEditingCustomRole: (val: any) => void;
  setChatContextLength: (val: number) => void;
  loadFiles: () => void;
  handleImportFiles: () => void;
  handleKbSearch: any;
  handleFileSelect: any;
  removeImage: any;
  handleCopy: any;
  handleExportChat: any;
  handleToggleBookmark: any;
  handleExtractTodos: any;
  handleSendMessage: any;
  handleStopChat: any;
  handleNewChat: any;
  handleSelectSession: any;
  handleDeleteSession: any;
  handleRenameSession: any;
  handleClearChat: any;
  handleRollbackTurn: any;
  handleModelChange: any;
  handleSaveEditAndRegenerate: any;
  handleRegenerateResponse: any;
  handleContinueResponse: any;
  handleBranchMessage: any;
  handleExecuteWorkflow: any;
  handleToggleWorkflowEnabled: any;
  loadWorkflows: any;
  handleSaveCustomRole: any;
  handleDeleteCustomRole: any;
  aiGenerate: any;
  handleSaveAsTask: any;
  chatMessages: any;
  setChatMessages: any;
  chatSessions: any;
  activeSessionId: any;
  chatInput: any;
  setChatInput: any;
  isChatLoading: any;
  availableModels: any;
  selectedModel: any;
  isRAGEnabled: any;
  chatNetworkMode: any;
  agentSteps: any;
  activeMcpRouting: any;
  manualPreferredMcpServerId: any;
  manualPreferredMcpServerName: any;
  showReasoningProcess: any;
  chatImages: any;
  chatAttachments: any;
  setChatAttachments: any;
  attachmentLoading: any;
  setAttachmentLoading: any;
  isChatSidebarOpen: any;
  expandedReasoningMessages: any;
  copiedId: any;
  editingMessageId: any;
  editingMessageContent: any;
  bookmarkedMessages: any;
  chatInputRef: any;
  chatEndRef: any;
  fileInputRef: any;
  pinnedSessions: any;
  handleTogglePin: any;
  selectedRole: any;
  allRoles: any;
  customRoles: any;
  isRoleEditorOpen: any;
  editingCustomRole: any;
  deskDefaultTab: any;
  aiChatReady: any;
  aiRagReady: any;
  workflows: any;
  workflowLogs: any;
  executingWorkflows: any;
  kbSearchQuery: any;
  kbSearchResults: any;
  visibleFiles: any;
  indexedFileCount: any;
  activeIndexingCount: any;
  isFilesLoading: any;
  hasLoadedOnce: any;
  kbFolders: any;
  allFileTags: any;
  createKbFolder: any;
  deleteKbFolder: any;
  moveFileToFolder: any;
}

const AppRouter: React.FC<AppRouterProps> = ({
  activeTab,
  setActiveTab,
  setDeskDefaultTab,
  setSourceNoteToOpen,
  setNotification,
  setEditingSchedule,
  setPdfViewerState,
  setModalConfig,
  setIsRAGEnabled,
  setChatNetworkMode,
  setManualPreferredMcpServerId,
  setManualPreferredMcpServerName,
  setExpandedReasoningMessages,
  setEditingMessageId,
  setEditingMessageContent,
  setIsChatSidebarOpen,
  setSelectedRole,
  setIsRoleEditorOpen,
  setEditingCustomRole,
  setChatContextLength,
  loadFiles,
  handleImportFiles,
  handleKbSearch,
  handleFileSelect,
  removeImage,
  handleCopy,
  handleExportChat,
  handleToggleBookmark,
  handleExtractTodos,
  handleSendMessage,
  handleStopChat,
  handleNewChat,
  handleSelectSession,
  handleDeleteSession,
  handleRenameSession,
  handleClearChat,
  handleRollbackTurn,
  handleModelChange,
  handleSaveEditAndRegenerate,
  handleRegenerateResponse,
  handleContinueResponse,
  handleBranchMessage,
  handleExecuteWorkflow,
  handleToggleWorkflowEnabled,
  loadWorkflows,
  handleSaveCustomRole,
  handleDeleteCustomRole,
  aiGenerate,
  handleSaveAsTask,
  chatMessages,
  setChatMessages,
  chatSessions,
  activeSessionId,
  chatInput,
  setChatInput,
  isChatLoading,
  availableModels,
  selectedModel,
  isRAGEnabled,
  chatNetworkMode,
  agentSteps,
  activeMcpRouting,
  manualPreferredMcpServerId,
  manualPreferredMcpServerName,
  showReasoningProcess,
  chatImages,
  chatAttachments, setChatAttachments, attachmentLoading, setAttachmentLoading,
  isChatSidebarOpen,
  expandedReasoningMessages,
  copiedId,
  editingMessageId,
  editingMessageContent,
  bookmarkedMessages,
  chatInputRef,
  chatEndRef,
  fileInputRef,
  pinnedSessions,
  handleTogglePin,
  selectedRole,
  allRoles,
  customRoles,
  isRoleEditorOpen,
  editingCustomRole,
  deskDefaultTab,
  aiChatReady,
  aiRagReady,
  workflows,
  workflowLogs,
  executingWorkflows,
  kbSearchQuery,
  kbSearchResults,
  visibleFiles,
  indexedFileCount,
  activeIndexingCount,
  isFilesLoading,
  hasLoadedOnce,
  kbFolders,
  allFileTags,
  createKbFolder,
  deleteKbFolder,
  moveFileToFolder,
}) => {
  const currentProjectName = useAppStore(s => s.currentProjectName);

  return (
    <AnimatePresence mode="wait">
      {activeTab === 'dashboard' && !currentProjectName && (
        <DashboardPage
          files={kbSearchQuery.trim() ? kbSearchResults : visibleFiles}
          onNavigateToKB={() => setActiveTab('kb')}
          onNavigateToNotes={() => { setActiveTab('desk'); setDeskDefaultTab('notes'); }}
          onNavigateToTasks={() => setActiveTab('tasks')}
          onCreateMemo={async () => {
            const id = uuidv4();
            await window.ipcRenderer.invoke('save-note', {
              id,
              title: '新便签',
              content: '',
              type: 'quick_note',
              project: '',
              category: '',
              tags: [],
              source_type: 'manual',
              source_id: '',
            });
            setDeskDefaultTab('notes');
            setActiveTab('desk');
            setSourceNoteToOpen({ type: 'note', id });
          }}
          onCreateTask={() => {
            setActiveTab('tasks');
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('focus-quick-add-task'));
            }, 100);
          }}
          onImportFiles={handleImportFiles}
          aiChatReady={aiChatReady}
          aiRagReady={aiRagReady}
        />
      )}

      {activeTab === 'dashboard' && currentProjectName && (
        <ProjectDashboardPage
          files={kbSearchQuery.trim() ? kbSearchResults : visibleFiles}
          onNavigateToKB={() => setActiveTab('kb')}
          onNavigateToNotes={() => { setActiveTab('desk'); setDeskDefaultTab('notes'); }}
          onNavigateToTasks={() => setActiveTab('tasks')}
          onCreateMemo={async () => {
            const id = uuidv4();
            await window.ipcRenderer.invoke('save-note', {
              id, title: '新便签', content: '', type: 'quick_note', project: currentProjectName,
              category: '', tags: [], source_type: 'manual', source_id: '',
            });
            setDeskDefaultTab('notes');
            setActiveTab('desk');
            setSourceNoteToOpen({ type: 'note', id });
          }}
          onCreateTask={() => {
            setActiveTab('tasks');
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('focus-quick-add-task'));
            }, 100);
          }}
          onImportFiles={handleImportFiles}
          aiChatReady={aiChatReady}
          aiRagReady={aiRagReady}
        />
      )}

      {activeTab === 'kb' && (
        <KnowledgePage
          files={kbSearchQuery.trim() ? kbSearchResults : visibleFiles}
          indexedFileCount={indexedFileCount}
          activeIndexingCount={activeIndexingCount}
          isFilesLoading={isFilesLoading}
          hasLoadedOnce={hasLoadedOnce}
          onImportFiles={handleImportFiles}
          onSearch={(query) => handleKbSearch(query, 'hybrid')}
          onFileClick={(file) => {
            const ext = (file.file_type || '').toLowerCase();
            if (ext === '.pdf') setPdfViewerState({ fileId: file.id, fileName: file.file_name });
            else window.ipcRenderer.invoke('open-path', { path: file.file_path });
          }}


          onDeleteFile={(file) => {
            if (!file?.id) return;
            setModalConfig({
              isOpen: true,
              title: '删除文件',
              message: `确定要从知识库中删除 "${file.title || file.file_name}" 吗？这将同时删除其向量索引，且无法撤销。`,
              onConfirm: async () => {
                try {
                  await window.ipcRenderer.invoke('delete-file', { id: file.id });
                  await loadFiles();
                  setNotification({ message: '文件已删除', type: 'success' });
                } catch (err: any) {
                  setNotification({ message: `删除失败: ${err.message}`, type: 'error' });
                }
                setModalConfig(null);
              },
            });
          }}
          kbFolders={kbFolders}
          onCreateFolder={createKbFolder}
          onDeleteFolder={deleteKbFolder}
          onMoveFileToFolder={moveFileToFolder}
          onRefreshFiles={loadFiles}
          setNotification={setNotification}
          fileTags={allFileTags}
        />
      )}

      {activeTab === 'chat' && (
        <ChatPage
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
          searchMode={loadWebSearchSettings().searchMode}
          agentSteps={agentSteps}
          activeMcpRouting={activeMcpRouting}
          manualPreferredMcpServerId={manualPreferredMcpServerId}
          manualPreferredMcpServerName={manualPreferredMcpServerName}
          onManualPreferredMcpChange={(serverId, serverName) => {
            setManualPreferredMcpServerId(serverId);
            setManualPreferredMcpServerName(serverName || null);
          }}
          showReasoningProcess={showReasoningProcess}
          chatImages={chatImages}
          chatAttachments={chatAttachments}
          setChatAttachments={setChatAttachments}
          attachmentLoading={attachmentLoading}
          setAttachmentLoading={setAttachmentLoading}
          isChatSidebarOpen={isChatSidebarOpen}
          setIsChatSidebarOpen={setIsChatSidebarOpen}
          expandedReasoningMessages={expandedReasoningMessages}
          copiedId={copiedId}
          editingMessageId={editingMessageId}
          editingMessageContent={editingMessageContent}
          bookmarkedMessages={bookmarkedMessages}
          chatInputRef={chatInputRef}
          chatEndRef={chatEndRef}
          fileInputRef={fileInputRef}
          onSendMessage={handleSendMessage}
          onStopChat={handleStopChat}
          onNewChat={handleNewChat}
          onSelectSession={handleSelectSession}
          onDeleteSession={handleDeleteSession}
          onRenameSession={handleRenameSession}
          onClearChat={handleClearChat}
          onRollbackTurn={handleRollbackTurn}
          onModelChange={handleModelChange}
          onToggleRAG={() => {
            const next = !isRAGEnabled;
            setIsRAGEnabled(next);
            setNotification({ message: next ? '已开启知识库检索，将基于你的知识库回答' : '已关闭知识库检索', type: 'info' });
          }}
          onNetworkModeChange={(mode, searchMode) => {
            setChatNetworkMode(mode);
            if (searchMode) {
              const settings = loadWebSearchSettings();
              settings.searchMode = searchMode;
              localStorage.setItem('webSearchProviders', JSON.stringify(settings));
            }
            if (mode === 'off') {
              setNotification({ message: '已关闭联网搜索', type: 'info' });
            } else if (mode === 'direct') {
              const sm = searchMode || loadWebSearchSettings().searchMode;
              setNotification({ message: `已开启直接搜索(${sm === 'fast' ? '极速' : '深度'})`, type: 'info' });
            }
          }}
          onFileSelect={handleFileSelect}
          onRemoveImage={removeImage}
          onCopy={handleCopy}
          onEditMessage={setEditingMessageId}
          onCancelEdit={() => { setEditingMessageId(null); setEditingMessageContent(''); }}
          onSaveEditAndRegenerate={handleSaveEditAndRegenerate}
          onRegenerateResponse={handleRegenerateResponse}
          onContinueResponse={handleContinueResponse}
          onBranchMessage={handleBranchMessage}
          onExportChat={handleExportChat}
          onToggleBookmark={handleToggleBookmark}
          onExtractTodos={handleExtractTodos}
          onToggleReasoning={(msgId) => setExpandedReasoningMessages(prev => ({ ...prev, [msgId]: !prev[msgId] }))}
          pinnedSessions={pinnedSessions}
          onTogglePin={handleTogglePin}
          selectedRole={selectedRole}
          onSelectRole={setSelectedRole}
          allRoles={allRoles}
          customRoles={customRoles}
          isRoleEditorOpen={isRoleEditorOpen}
          setIsRoleEditorOpen={setIsRoleEditorOpen}
          editingCustomRole={editingCustomRole}
          setEditingCustomRole={setEditingCustomRole}
          onSaveCustomRole={handleSaveCustomRole}
          onDeleteCustomRole={handleDeleteCustomRole}
        />
      )}

      {activeTab === 'desk' && (
        <DeskPage
          aiChatReady={aiChatReady}
          selectedModel={selectedModel}
          onAiAsk={aiGenerate}
          onSaveAsTask={handleSaveAsTask}
        />
      )}

      {activeTab === 'tasks' && (
        <TasksPage />
      )}

      {activeTab === 'workflows' && (
        <WorkflowsPage
          workflows={workflows}
          logs={workflowLogs}
          executing={executingWorkflows}
          onExecute={handleExecuteWorkflow}
          onToggleEnabled={handleToggleWorkflowEnabled}
          onCreate={async (wf) => { await window.ipcRenderer.invoke('save-agent-workflow', wf); loadWorkflows(); }}
          onUpdate={async (wf) => { await window.ipcRenderer.invoke('save-agent-workflow', wf); loadWorkflows(); }}
          onDelete={async (id) => { await window.ipcRenderer.invoke('delete-agent-workflow', { id }); loadWorkflows(); }}
        />
      )}

      {activeTab === 'memory' && (
        <MemoryPage />
      )}
    </AnimatePresence>
  );
};

export default AppRouter;
