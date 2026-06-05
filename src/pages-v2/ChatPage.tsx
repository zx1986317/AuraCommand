import React, { useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BrainCircuit, Search, Zap, Globe, Check, X, Download, ChevronDown } from 'lucide-react';
import { getAssistantMessageParts } from '../utils/chat';
import ChatSessionSidebar from '../components/chat/ChatSessionSidebar';
import ChatHeader from '../components/chat/ChatHeader';
import ChatMessageItem from '../components/chat/ChatMessageItem';
import ChatRoleBar from '../components/chat/ChatRoleBar';
import ChatInputArea from '../components/chat/ChatInputArea';
import CanvasPanel from '../components/chat/CanvasPanel';
import RoleEditorModal from '../components/RoleEditorModal';
import TodoExtractPreviewModal from '../components/TodoExtractPreviewModal';
import { ErrorBoundary } from '../components/ErrorBoundary';


interface ChatPageProps {
  chatMessages: any[];
  setChatMessages: (msgs: any[] | ((prev: any[]) => any[])) => void;
  chatSessions: any[];
  activeSessionId: string | null;
  chatInput: string;
  setChatInput: (val: string) => void;
  isChatLoading: boolean;
  availableModels: string[];
  selectedModel: string;
  isRAGEnabled: boolean;
  chatNetworkMode: 'off' | 'direct';
  searchMode: 'fast' | 'deep';
  activeMcpRouting?: {
    preferredServerId?: string;
    preferredServerName?: string;
    lockedServerId?: string;
    lockedServerName?: string;
    categoryRouting?: Array<{
      category: string;
      categoryLabel: string;
      preferredServerId: string;
      preferredServerName: string;
    }>;
  } | null;
  manualPreferredMcpServerId?: string | null;
  manualPreferredMcpServerName?: string | null;
  onManualPreferredMcpChange?: (serverId: string | null, serverName?: string | null) => void;

  agentSteps: any[];
  showReasoningProcess: boolean;
  chatImages: string[];
  chatAttachments: Array<{ name: string; text: string; size: number }>;
  setChatAttachments: (attachments: Array<{ name: string; text: string; size: number }> | ((prev: Array<{ name: string; text: string; size: number }>) => Array<{ name: string; text: string; size: number }>)) => void;
  attachmentLoading: boolean;
  setAttachmentLoading: (val: boolean) => void;
  isChatSidebarOpen: boolean;
  setIsChatSidebarOpen: (val: boolean) => void;
  expandedReasoningMessages: Record<string, boolean>;
  copiedId: string | null;
  editingMessageId: string | null;
  editingMessageContent: string;
  bookmarkedMessages: any[];
  chatInputRef: React.RefObject<HTMLTextAreaElement>;
  chatEndRef: React.RefObject<HTMLDivElement>;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onSendMessage: (overrideMessage?: string) => void;
  onStopChat: () => void;
  onNewChat: () => void;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (e: React.MouseEvent, sessionId: string) => void;
  onRenameSession: (e: React.MouseEvent, sessionId: string, title: string) => void;
  onClearChat: () => void;
  onRollbackTurn: () => void;
  onModelChange: (model: string) => void;
  onToggleRAG: () => void;
  onNetworkModeChange: (mode: 'off' | 'direct', searchMode?: 'fast' | 'deep') => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: (idx: number) => void;
  onCopy: (content: string, id: string) => void;
  onEditMessage: (id: string, content: string) => void;
  onCancelEdit: () => void;
  onSaveEditAndRegenerate: (id: string, content: string) => void;
  onRegenerateResponse: (id: string) => void;
  onContinueResponse: (id: string) => void;
  onBranchMessage: (id: string, direction: 'prev' | 'next') => void;
  onExportChat: (format: 'markdown' | 'json') => void;
  onToggleBookmark: (messageId: string, currentBookmarked: boolean) => void;
  onExtractTodos: (msg: any) => void;
  onToggleReasoning: (msgId: string) => void;
  pinnedSessions?: string[];
  onTogglePin?: (sessionId: string) => void;
  selectedRole: string;
  onSelectRole: (roleId: string) => void;
  allRoles: any[];
  customRoles: any[];
  isRoleEditorOpen: boolean;
  setIsRoleEditorOpen: (open: boolean) => void;
  editingCustomRole: any;
  setEditingCustomRole: (role: any) => void;
  onSaveCustomRole: (role: any) => void;
  onDeleteCustomRole: (roleId: string) => void;
}

const ChatPage: React.FC<ChatPageProps> = (props) => {
  const {
    chatMessages, setChatMessages, chatSessions, activeSessionId,
    chatInput, setChatInput, isChatLoading,
    availableModels, selectedModel,
    isRAGEnabled, chatNetworkMode, searchMode, activeMcpRouting, agentSteps,
    manualPreferredMcpServerId, manualPreferredMcpServerName, onManualPreferredMcpChange,
    showReasoningProcess, chatImages, chatAttachments, setChatAttachments, attachmentLoading, setAttachmentLoading,
    isChatSidebarOpen, setIsChatSidebarOpen,
    expandedReasoningMessages, copiedId, editingMessageId, editingMessageContent,
    bookmarkedMessages, chatInputRef, chatEndRef, fileInputRef,
    onSendMessage, onStopChat, onNewChat, onSelectSession, onDeleteSession,
    onRenameSession, onClearChat, onRollbackTurn, onModelChange, onToggleRAG, onNetworkModeChange,
    onFileSelect, onRemoveImage, onCopy,
    onEditMessage, onCancelEdit, onSaveEditAndRegenerate, onRegenerateResponse, onContinueResponse,
    onBranchMessage, onExportChat, onToggleBookmark, onExtractTodos,
    onToggleReasoning, pinnedSessions, onTogglePin,
    selectedRole, onSelectRole, allRoles, customRoles,
    isRoleEditorOpen, setIsRoleEditorOpen, editingCustomRole, setEditingCustomRole,
    onSaveCustomRole, onDeleteCustomRole
  } = props;

  const [sessionFilter, setSessionFilter] = React.useState('');
  const [canvasOpen, setCanvasOpen] = React.useState(false);
  const [canvasHtml, setCanvasHtml] = React.useState('');
  const [canvasTitle, setCanvasTitle] = React.useState('画布预览');

  const handleOpenInCanvas = useCallback((htmlContent: string, title?: string) => {
    // empty content signals toggle close
    if (!htmlContent) {
      setCanvasOpen(false);
      return;
    }
    setCanvasHtml(htmlContent);
    setCanvasTitle(title || '画布预览');
    setCanvasOpen(true);
  }, []);

  const attachmentInputRef = useRef<HTMLInputElement>(null);

  const handleAttachmentSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setAttachmentLoading(true);
    try {
      const fileBuffers = await Promise.all(
        Array.from(files).map(async (file) => {
          const arrayBuffer = await file.arrayBuffer();
          return {
            name: file.name,
            buffer: Array.from(new Uint8Array(arrayBuffer)),
            mimeType: file.type,
            size: file.size,
          };
        })
      );
      const result = await window.ipcRenderer.invoke('get-attachment-context', { fileBuffers });
      if (result?.success && result.attachments?.length) {
        const newAttachments = result.attachments
          .filter((a: any) => a.text)
          .map((a: any, i: number) => ({
            name: a.name,
            text: a.text,
            size: fileBuffers[i]?.size || 0,
          }));
        setChatAttachments(prev => [...prev, ...newAttachments]);
      }
    } catch (err) {
      console.error('Attachment parse failed:', err);
    } finally {
      setAttachmentLoading(false);
      if (e.target) e.target.value = '';
    }
  }, [setChatAttachments, setAttachmentLoading]);

  const handleRemoveAttachment = useCallback((idx: number) => {
    setChatAttachments(prev => prev.filter((_, i) => i !== idx));
  }, [setChatAttachments]);

  const [isModelOpen, setIsModelOpen] = React.useState(false);
  const [isRoleOpen, setIsRoleOpen] = React.useState(false);
  const [editingIdx, setEditingIdx] = React.useState<number | null>(null);
  const [editContent, setEditContent] = React.useState('');
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = React.useRef(true);
  const [showScrollBtn, setShowScrollBtn] = React.useState(false);

  const [fileRefOpen, setFileRefOpen] = React.useState(false);
  const [fileRefQuery, setFileRefQuery] = React.useState('');
  const [fileRefResults, setFileRefResults] = React.useState<any[]>([]);
  const [fileRefSelectedIdx, setFileRefSelectedIdx] = React.useState(0);
  const [fileRefPos, setFileRefPos] = React.useState({ top: 0, left: 0 });
  const [attachedFiles, setAttachedFiles] = React.useState<any[]>([]);
  const fileRefMenuRef = React.useRef<HTMLDivElement>(null);

  const searchFileRef = React.useCallback(async (q: string) => {
    try {
      const results = await window.ipcRenderer.invoke('search-files-for-chat', { query: q });
      setFileRefResults(results || []);
      setFileRefSelectedIdx(0);
    } catch {
      setFileRefResults([]);
    }
  }, []);

  const handleAttachFile = React.useCallback(async (fileId: string) => {
    try {
      const fileContent = await window.ipcRenderer.invoke('get-file-content-for-chat', { fileId });
      if (fileContent) {
        setAttachedFiles(prev => {
          if (prev.some(f => f.id === fileContent.id)) return prev;
          return [...prev, fileContent];
        });
      }
    } catch (err) {
      console.error('Failed to attach file:', err);
    }
    setFileRefOpen(false);
    setFileRefQuery('');
    chatInputRef.current?.focus();
  }, [chatInputRef]);

  React.useEffect(() => {
    if (!fileRefOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (fileRefMenuRef.current && !fileRefMenuRef.current.contains(e.target as Node)) {
        setFileRefOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [fileRefOpen]);

  const [todoExtractOpen, setTodoExtractOpen] = React.useState(false);
  const [todoExtractMessage, setTodoExtractMessage] = React.useState('');
  const [chatExportNotification, setChatExportNotification] = React.useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const scrollToBottom = React.useCallback((behavior: ScrollBehavior = 'auto') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  const handleSendMessageWithScroll = React.useCallback((overrideMessage?: string) => {
    shouldAutoScrollRef.current = true;
    setShowScrollBtn(false);
    requestAnimationFrame(() => {
      scrollToBottom();
    });
    onSendMessage(overrideMessage);
  }, [onSendMessage, scrollToBottom]);

  const handleSelectSessionWithScroll = React.useCallback((sessionId: string) => {
    shouldAutoScrollRef.current = true;
    setShowScrollBtn(false);
    onSelectSession(sessionId);
    requestAnimationFrame(() => {
      setTimeout(() => scrollToBottom('auto'), 150);
    });
  }, [onSelectSession, scrollToBottom]);

  const handleExtractTodosClick = React.useCallback((msg: any) => {
    const parts = getAssistantMessageParts(msg);
    const content = parts?.answer || (typeof msg.content === 'string' ? msg.content : '');
    setTodoExtractMessage(content);
    setTodoExtractOpen(true);
  }, []);

  const handleConfirmExtractTodos = React.useCallback((todos: { title: string; description?: string; priority?: string }[]) => {
    onExtractTodos({ content: JSON.stringify(todos) });
  }, [onExtractTodos]);

  const handleExportChatToDocx = React.useCallback(async () => {
    if (!activeSessionId || !window.ipcRenderer) return;
    try {
      const result = await window.ipcRenderer.invoke('export-chat-to-docx', { sessionId: activeSessionId });
      if (result?.success) {
        setChatExportNotification({ message: '对话已成功导出为 DOCX', type: 'success' });
      } else {
        setChatExportNotification({ message: result?.error || '导出失败', type: 'error' });
      }
    } catch {
      setChatExportNotification({ message: '导出失败', type: 'error' });
    }
  }, [activeSessionId]);

  React.useEffect(() => {
    shouldAutoScrollRef.current = true;
    setShowScrollBtn(false);
    requestAnimationFrame(() => {
      setTimeout(() => scrollToBottom('auto'), 100);
    });
  }, [activeSessionId, scrollToBottom]);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 200;
      shouldAutoScrollRef.current = isNearBottom;
      setShowScrollBtn(!isNearBottom);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (shouldAutoScrollRef.current) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
  }, [chatMessages, isChatLoading]);

  return (
    <ErrorBoundary name="ChatPage">
    <div className="flex h-full w-full gap-0">
      <ChatSessionSidebar
        isOpen={isChatSidebarOpen}
        chatSessions={chatSessions}
        activeSessionId={activeSessionId}
        sessionFilter={sessionFilter}
        onSessionFilterChange={setSessionFilter}
        {...(pinnedSessions !== undefined && { pinnedSessions })}
        {...(onTogglePin !== undefined && { onTogglePin })}
        onNewChat={onNewChat}
        onSelectSession={handleSelectSessionWithScroll}
        onDeleteSession={onDeleteSession}
        onRenameSession={onRenameSession}
      />

      {/* Chat + Canvas layout */}
      <div className="flex-1 flex min-w-0 relative">
        {/* Chat area */}
        <div className={`flex-1 flex flex-col min-w-0 relative ${canvasOpen ? '' : ''}`}>
        <ChatHeader
          isChatSidebarOpen={isChatSidebarOpen}
          isRAGEnabled={isRAGEnabled}
          chatNetworkMode={chatNetworkMode}
          searchMode={searchMode}
          {...(activeMcpRouting !== undefined ? { activeMcpRouting } : {})}
          {...(manualPreferredMcpServerId !== undefined ? { manualPreferredMcpServerId } : {})}
          {...(manualPreferredMcpServerName !== undefined ? { manualPreferredMcpServerName } : {})}
          {...(onManualPreferredMcpChange !== undefined ? { onManualPreferredMcpChange } : {})}
          isModelOpen={isModelOpen}
          selectedModel={selectedModel}
          availableModels={availableModels}
          chatMessages={chatMessages}
          onToggleSidebar={() => setIsChatSidebarOpen(!isChatSidebarOpen)}
          onToggleRAG={onToggleRAG}
          onNetworkModeChange={onNetworkModeChange}
          onToggleModel={setIsModelOpen}
          onModelChange={onModelChange}
          onExportChat={onExportChat}
          onExportChatToDocx={handleExportChatToDocx}
          onClearChat={onClearChat}
          onRollbackTurn={onRollbackTurn}
        />

        {/* Chat messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pt-4 pb-2 space-y-1 scroll-smooth">
          {chatMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-8">
              <div className="space-y-4">
                <div className="w-20 h-20 bg-accent/5 rounded-[2rem] flex items-center justify-center text-accent mx-auto">
                  <BrainCircuit size={40} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">开始对话</h3>
                  <p className="text-sm text-muted max-w-sm mx-auto">基于本地知识库的智能对话，支持联网搜索和 Agent 模式</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 max-w-lg w-full px-4">
                {[
                  { icon: <Search size={14} />, text: '搜索知识库中的内容' },
                  { icon: <BrainCircuit size={14} />, text: '总结我最近的便签' },
                  { icon: <Globe size={14} />, text: '帮我搜索最新资讯' },
                  { icon: <Zap size={14} />, text: '分析并整理待办任务' },
                ].map((q, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setChatInput(q.text);
                      shouldAutoScrollRef.current = true;
                      setShowScrollBtn(false);
                      setTimeout(() => handleSendMessageWithScroll(), 100);
                    }}
                    className="flex items-center gap-3 p-4 bg-white/60 border border-teal-900/5 rounded-2xl hover:bg-white hover:border-accent/30 hover:shadow-md transition-all text-left group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-accent/5 flex items-center justify-center text-accent group-hover:bg-accent group-hover:text-white transition-colors">
                      {q.icon}
                    </div>
                    <span className="text-xs font-medium text-foreground/80">{q.text}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {chatMessages.map((msg, idx) => (
                <ChatMessageItem
                  key={String(msg.id ?? idx)}
                  msg={msg}
                  idx={idx}
                  isLastInList={idx === chatMessages.length - 1}
                  isChatLoading={isChatLoading}
                  agentSteps={agentSteps}
                  showReasoningProcess={showReasoningProcess}
                  expandedReasoningMessages={expandedReasoningMessages}
                  copiedId={copiedId}
                  editingMessageId={editingMessageId}
                  editingMessageContent={editingMessageContent}
                  editingIdx={editingIdx}
                  editContent={editContent}
                  onCopy={onCopy}
                  onContinueMessage={onContinueResponse}
                  onOpenInCanvas={handleOpenInCanvas}
                  isCanvasOpen={canvasOpen}
                  onEditMessage={onEditMessage}
                  onCancelEdit={onCancelEdit}
                  onSaveEditAndRegenerate={onSaveEditAndRegenerate}
                  onRegenerateResponse={onRegenerateResponse}
                  onBranchMessage={onBranchMessage}
                  onToggleBookmark={onToggleBookmark}
                  onExtractTodos={handleExtractTodosClick}
                  onToggleReasoning={onToggleReasoning}
                  onSetChatMessages={setChatMessages}
                  onSetEditingIdx={setEditingIdx}
                  onSetEditContent={setEditContent}
                />
              ))}

              {isChatLoading && (chatMessages.length === 0 || chatMessages[chatMessages.length - 1]?.role === 'user') && (
                <div className="flex justify-start">
                  <div className="bg-white/80 border border-teal-900/5 px-6 py-4 rounded-2xl rounded-tl-md flex items-center gap-3 shadow-sm">
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" />
                      <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce [animation-delay:0.2s]" />
                      <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce [animation-delay:0.4s]" />
                    </div>
                    <span className="text-2xs font-bold text-accent uppercase tracking-widest">
                      {chatNetworkMode !== 'off' ? '搜集资料中...' : '思考中...'}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={chatEndRef} className="h-4" />
        </div>

        <AnimatePresence>
          {showScrollBtn && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              onClick={() => {
                const el = scrollRef.current;
                shouldAutoScrollRef.current = true;
                if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
                setShowScrollBtn(false);
              }}
              className="absolute bottom-32 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-4 py-2 bg-white/90 border border-teal-900/10 rounded-full shadow-lg text-2xs font-bold text-accent hover:bg-white hover:shadow-xl transition-all cursor-pointer"
            >
              <ChevronDown size={12} /> 回到底部
            </motion.button>
          )}
        </AnimatePresence>

        <ChatRoleBar
          allRoles={allRoles}
          customRoles={customRoles}
          selectedRole={selectedRole}
          isRoleOpen={isRoleOpen}
          isRoleEditorOpen={isRoleEditorOpen}
          onSelectRole={onSelectRole}
          onToggleRoleManager={setIsRoleOpen}
          onOpenRoleEditor={() => { setEditingCustomRole(null); setIsRoleEditorOpen(true); }}
          onEditRole={(role) => { setEditingCustomRole(role); setIsRoleEditorOpen(true); setIsRoleOpen(false); }}
          onDeleteRole={onDeleteCustomRole}
        />

        <ChatInputArea
          chatInput={chatInput}
          chatImages={chatImages}
          isChatLoading={isChatLoading}
          fileRefOpen={fileRefOpen}
          fileRefQuery={fileRefQuery}
          fileRefResults={fileRefResults}
          fileRefSelectedIdx={fileRefSelectedIdx}
          attachedFiles={attachedFiles}
          chatAttachments={chatAttachments}
          attachmentLoading={attachmentLoading}
          chatInputRef={chatInputRef}
          fileInputRef={fileInputRef}
          attachmentInputRef={attachmentInputRef}
          onInputChange={setChatInput}
          onSendMessage={handleSendMessageWithScroll}
          onStopChat={onStopChat}
          onFileSelect={onFileSelect}
          onAttachmentSelect={handleAttachmentSelect}
          onRemoveImage={onRemoveImage}
          onRemoveAttachment={handleRemoveAttachment}
          onAttachFile={handleAttachFile}
          onSearchFileRef={searchFileRef}
          onFileRefOpenChange={setFileRefOpen}
          onFileRefQueryChange={setFileRefQuery}
          onFileRefSelectedIdxChange={setFileRefSelectedIdx}
          onAttachedFilesChange={setAttachedFiles}
          fileRefMenuRef={fileRefMenuRef}
        />
        </div>{/* end chat area */}
        <CanvasPanel
          isOpen={canvasOpen}
          onClose={() => setCanvasOpen(false)}
          htmlContent={canvasHtml}
          title={canvasTitle}
        />
      </div>{/* end Chat + Canvas layout */}

      <RoleEditorModal
        isOpen={isRoleEditorOpen}
        editingRole={editingCustomRole}
        allCustomRoles={customRoles}
        onSave={onSaveCustomRole}
        onDelete={onDeleteCustomRole}
        onClose={() => setIsRoleEditorOpen(false)}
        onNotification={(n) => {}}
      />

      <TodoExtractPreviewModal
        isOpen={todoExtractOpen}
        messageContent={todoExtractMessage}
        onClose={() => setTodoExtractOpen(false)}
        onConfirm={handleConfirmExtractTodos}
      />

      {chatExportNotification && (
        <div className={`fixed top-12 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-xl shadow-lg border backdrop-blur-xl transition-all ${
          chatExportNotification.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium">{chatExportNotification.message}</span>
            <button onClick={() => setChatExportNotification(null)} className="p-0.5 hover:opacity-70">
              <X size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
    </ErrorBoundary>
  );
};

export default ChatPage;
