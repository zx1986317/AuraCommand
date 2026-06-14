import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  MessageSquare, Plus, Download, Edit2, Trash2, Copy, Check, RotateCcw,
  Globe, Database, ChevronDown, BrainCircuit, Sparkles, ListTodo, Search,
  StickyNote, FileText, X, Image as ImageIcon, Zap, Square, Sidebar as SidebarIcon,
  ChevronLeft, ChevronRight, Bookmark, Wrench, Palette, CalendarPlus, FilePlus,
  PlusCircle, Eye, Wifi, WifiOff, Undo2
} from 'lucide-react';
import { AiRole, aiRoles } from '../constants';
import { getAssistantMessageParts, inferAssistantPhase, getAssistantPhaseLabel, getAssistantPhaseClasses } from '../utils/chat';
import { CodeBlockRenderer } from './CodeBlockRenderer';
import AgentStepsView from './AgentStepsView';
import { getModelInfo } from '../config/modelConfig';
import { MarkdownImage } from './chat/ImagePreview';
import { Spinner, Skeleton, SkeletonText } from './common/LoadingState';
import { EmptyState } from './common/EmptyState';
import { useTranslation } from '../i18n/I18nContext';
import MessageReactions from './chat/MessageReactions';
import MessageSearchBar from './chat/MessageSearchBar';
import { collectMessageMatches, findMatches, highlightMatches } from '../utils/chatSearch';

const SyntaxHighlighterAny = SyntaxHighlighter as unknown as React.ComponentType<Record<string, unknown>>;

/**
 * P3 任务 2：在 ReactMarkdown 渲染的 children 树中，把"纯字符串"叶子节点按
 * messageSearchQuery 拆出 <mark>。仅处理最浅层 string 节点，递归地穿过数组；
 * 对 React 元素不拆分（保持原结构）。空 query 直接返回原值。
 */
function wrapTextChildrenWithHighlight(
  children: React.ReactNode,
  query: string,
  activeIndex: number,
  baseKey: string
): React.ReactNode {
  if (!query || !query.trim()) return children;
  if (typeof children === 'string') {
    return highlightMatches(children, query, activeIndex, baseKey);
  }
  if (Array.isArray(children)) {
    return children.map((c, i) => {
      if (typeof c === 'string') {
        return <React.Fragment key={`${baseKey}-${i}`}>{highlightMatches(c, query, activeIndex, `${baseKey}-${i}`)}</React.Fragment>;
      }
      return c;
    });
  }
  return children;
}

interface ChatPanelProps {
  chatMessages: any[];
  chatSessions: any[];
  activeSessionId: string | null;
  isChatSidebarOpen: boolean;
  chatInput: string;
  isChatLoading: boolean;
  chatImages: string[];
  expandedReasoningMessages: Record<string, boolean>;
  editingMessageId: string | null;
  editingMessageContent: string;
  copiedId: string | null;
  copiedCodeId: string | null;
  selectedModel: string;
  availableModels: string[];
  isModelDropdownOpen: boolean;
  isRAGEnabled: boolean;
  isSearchEnabled: boolean;
  
  agentSteps: any[];
  showReasoningProcess: boolean;
  selectedRole: string;
  customSystemPrompt: string;
  isPromptSelectorOpen: boolean;
  promptSearchQuery: string;
  promptCategory: string;
  filteredPromptTemplates: any[];
  chatInputRef: React.RefObject<HTMLInputElement>;
  chatEndRef: React.RefObject<HTMLDivElement>;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onSetChatInput: (v: string) => void;
  onSetChatImages: (v: string[]) => void;
  onSetIsChatSidebarOpen: (v: boolean) => void;
  onSetIsModelDropdownOpen: (v: boolean) => void;
  onSetIsRAGEnabled: (v: boolean) => void;
  onSetIsSearchEnabled: (v: boolean) => void;
  
  onSetSelectedRole: (v: string) => void;
  onSetCustomSystemPrompt: (v: string) => void;
  onSetIsPromptSelectorOpen: (v: boolean) => void;
  onSetPromptSearchQuery: (v: string) => void;
  onSetPromptCategory: (v: string) => void;
  onSetExpandedReasoningMessages: (v: Record<string, boolean>) => void;
  onSetEditingMessageId: (v: string | null) => void;
  onSetEditingMessageContent: (v: string) => void;
  onSetCopiedId: (v: string | null) => void;
  onSetCopiedCodeId: (v: string | null) => void;
  onNewChat: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (e: React.MouseEvent, id: string) => void;
  onRenameSession: (e: React.MouseEvent, id: string, title: string) => void;
  onExportChat: (format: string) => void;
  onClearChat: () => void;
  onRollbackTurn: () => void;
  onSendMessage: (overrideMessage?: string) => void;
  onStopChat: () => void;
  onModelChange: (model: string) => void;
  onCopy: (text: string, id: string) => void;
  onEditMessage: (id: string, content: string) => void;
  onCancelEdit: () => void;
  onSaveEditAndRegenerate: (id: string, content: string) => void;
  onRegenerateResponse: (id: string) => void;
  onBranchMessage: (id: string, direction: 'prev' | 'next') => void;
  onExportMessage: (msg: any, format: string) => void;
  onExtractTodos: (msg: any) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: (idx: number) => void;
  StreamingReasoningText: React.FC<{ text: string; animate: boolean }>;
  chatSearchQuery: string;
  chatSearchResults: any[];
  isChatSearching: boolean;
  onChatSearch: (query: string) => void;
  bookmarkedMessages: any[];
  onLoadBookmarkedMessages: () => void;
  onToggleBookmark: (messageId: string, currentBookmarked: boolean) => void;
  aiMemories?: any[];
  onDeleteAiMemory?: (id: string) => void;
  onCreateMemoFromChat?: (content: string, title?: string) => void;
  onCreateScheduleFromChat?: (content: string) => void;
  allRoles?: AiRole[];
  isRoleEditorOpen?: boolean;
  onSetIsRoleEditorOpen?: (open: boolean) => void;
  editingCustomRole?: AiRole | null;
  onSetEditingCustomRole?: (role: AiRole | null) => void;
  onSaveCustomRole?: (role: AiRole) => void;
  onDeleteCustomRole?: (roleId: string) => void;
  searxngStatus?: 'unknown' | 'connected' | 'disconnected' | 'checking';
  onCheckSearxng?: () => void;
  aiChatReady: boolean;
  aiRagReady: boolean;
  aiStatusHint: string;
  onOpenSettings: () => void;
  onNavigateToMemos: () => void;
  onNavigateToKB: () => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({
  chatMessages, chatSessions, activeSessionId, isChatSidebarOpen,
  chatInput, isChatLoading, chatImages, expandedReasoningMessages,
  editingMessageId, editingMessageContent, copiedId, copiedCodeId,
  selectedModel, availableModels, isModelDropdownOpen,
  isRAGEnabled, isSearchEnabled, agentSteps, showReasoningProcess,
  selectedRole, customSystemPrompt, isPromptSelectorOpen,
  promptSearchQuery, promptCategory, filteredPromptTemplates,
  chatInputRef, chatEndRef, fileInputRef,
  onSetChatInput, onSetChatImages, onSetIsChatSidebarOpen,
  onSetIsModelDropdownOpen, onSetIsRAGEnabled, onSetIsSearchEnabled,
  onSetSelectedRole, onSetCustomSystemPrompt, onSetIsPromptSelectorOpen,
  onSetPromptSearchQuery, onSetPromptCategory, onSetExpandedReasoningMessages,
  onSetEditingMessageId, onSetEditingMessageContent, onSetCopiedId, onSetCopiedCodeId,
  onNewChat, onSelectSession, onDeleteSession, onRenameSession,
  onExportChat, onClearChat, onRollbackTurn, onSendMessage, onStopChat, onModelChange,
  onCopy, onEditMessage, onCancelEdit, onSaveEditAndRegenerate,
  onRegenerateResponse, onBranchMessage, onExportMessage, onExtractTodos,
  onFileSelect, onRemoveImage, StreamingReasoningText,
  chatSearchQuery, chatSearchResults, isChatSearching, onChatSearch,
  bookmarkedMessages, onLoadBookmarkedMessages, onToggleBookmark,
  aiMemories, onDeleteAiMemory,
  onCreateMemoFromChat,
  onCreateScheduleFromChat,
  allRoles: allRolesProp,
  isRoleEditorOpen: isRoleEditorOpenProp,
  onSetIsRoleEditorOpen,
  editingCustomRole,
  onSetEditingCustomRole,
  onSaveCustomRole,
  onDeleteCustomRole,
  searxngStatus,
  onCheckSearxng,
  aiChatReady,
  aiRagReady,
  aiStatusHint,
  onOpenSettings,
  onNavigateToMemos,
  onNavigateToKB
}) => {
  const [sidebarView, setSidebarView] = useState<'sessions' | 'search' | 'bookmarks' | 'memories'>('sessions');
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  // P3 任务 2：消息搜索高亮
  const [isMessageSearchOpen, setIsMessageSearchOpen] = useState(false);
  const [messageSearchQuery, setMessageSearchQuery] = useState('');
  const [activeMatchGlobalIndex, setActiveMatchGlobalIndex] = useState(0);
  const { t } = useTranslation();

  // P3 任务 2：聚合当前所有消息中的匹配
  const searchMatches = useMemo(() => {
    return collectMessageMatches(
      chatMessages.map((m: any) => ({ id: String(m.id ?? ''), content: m.content || '' })),
      messageSearchQuery
    );
  }, [chatMessages, messageSearchQuery]);

  const totalMatches = searchMatches.length;
  const currentMatch = totalMatches > 0 ? (activeMatchGlobalIndex % totalMatches) + 1 : 0;
  const currentMatchEntry = totalMatches > 0 ? searchMatches[activeMatchGlobalIndex % totalMatches] : null;

  const gotoNext = () => {
    if (totalMatches === 0) return;
    setActiveMatchGlobalIndex((activeMatchGlobalIndex + 1) % totalMatches);
  };
  const gotoPrev = () => {
    if (totalMatches === 0) return;
    setActiveMatchGlobalIndex((activeMatchGlobalIndex - 1 + totalMatches) % totalMatches);
  };
  const closeMessageSearch = () => {
    setIsMessageSearchOpen(false);
    setMessageSearchQuery('');
    setActiveMatchGlobalIndex(0);
  };

  const aiUnavailableMessage = aiStatusHint || t('chat.unavailableHint');
  const toggleReasoningExpanded = (messageId: string) => {
    onSetExpandedReasoningMessages({
      ...expandedReasoningMessages,
      [messageId]: !expandedReasoningMessages[messageId]
    });
  };

  return (
    <motion.div 
      key="chat"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="absolute inset-0 p-4 flex justify-center z-10"
    >
      <div className="w-full max-w-6xl h-full flex bg-white/40 backdrop-blur-xl border border-teal-900/5 rounded-[3rem] shadow-premium overflow-hidden">
        <div className={`${isChatSidebarOpen ? 'w-64' : 'w-0'} flex-shrink-0 border-r border-teal-900/5 bg-white/20 transition-all duration-300 flex flex-col overflow-hidden`}>
        <div className="shrink-0 p-6 border-b border-teal-900/5 flex items-center justify-between">
          <h3 className="text-xs font-bold text-muted uppercase tracking-widest">
            {sidebarView === 'search' ? t('chat.sessions.search') : sidebarView === 'bookmarks' ? t('chat.sessions.bookmarks') : sidebarView === 'memories' ? t('chat.sessions.memories') : t('chat.sessions.title')}
          </h3>
          <div className="flex items-center gap-1">
            <button onClick={() => { const next = sidebarView === 'memories' ? 'sessions' : 'memories'; setSidebarView(next); }} className={`p-2 rounded-xl transition-all ${sidebarView === 'memories' ? 'bg-accent/10 text-accent' : 'hover:bg-accent/10 text-muted hover:text-accent'}`} title={t('chat.sessions.aiMemory')}>
              <BrainCircuit size={14} />
            </button>
            <button onClick={() => { const next = sidebarView === 'bookmarks' ? 'sessions' : 'bookmarks'; if (next === 'bookmarks') onLoadBookmarkedMessages(); setSidebarView(next); }} className={`p-2 rounded-xl transition-all ${sidebarView === 'bookmarks' ? 'bg-accent/10 text-accent' : 'hover:bg-accent/10 text-muted hover:text-accent'}`} title={t('chat.sessions.bookmarks')}>
              <Bookmark size={14} />
            </button>
            <button onClick={() => { const next = sidebarView === 'search' ? 'sessions' : 'search'; setSidebarView(next); if (next !== 'search') onChatSearch(''); }} className={`p-2 rounded-xl transition-all ${sidebarView === 'search' ? 'bg-accent/10 text-accent' : 'hover:bg-accent/10 text-muted hover:text-accent'}`} title={t('chat.sessions.search')}>
              <Search size={14} />
            </button>
            {sidebarView === 'sessions' && (
              <>
                <button onClick={() => onExportChat('markdown')} className="p-2 hover:bg-accent/10 rounded-xl text-muted hover:text-accent transition-all" title={t('chat.sessions.export')}>
                  <Download size={14} />
                </button>
                <button onClick={onNewChat} className="p-2 hover:bg-accent/10 rounded-xl text-accent transition-all" title={t('chat.sessions.new')}>
                  <Plus size={16} />
                </button>
              </>
            )}
          </div>
        </div>
        {sidebarView === 'search' && (
          <div className="shrink-0 p-3 border-b border-teal-900/5">
            <div className="relative">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                value={chatSearchQuery}
                onChange={(e) => onChatSearch(e.target.value)}
                placeholder={t('chat.sessions.searchPlaceholder')}
                className="w-full bg-white/40 border border-teal-900/5 rounded-xl py-2 pl-9 pr-3 text-xs outline-none focus:border-accent/50 transition-all placeholder:text-muted/50"
                autoFocus
              />
            </div>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
          {sidebarView === 'search' ? (
            chatSearchQuery.trim() ? (
              isChatSearching ? (
                <Spinner block size={14} text={t('chat.sessions.searching')} />
              ) : chatSearchResults.length === 0 ? (
                <EmptyState compact icon={<Search size={20} />} title={t('chat.sessions.searchNoResult')} description={t('chat.sessions.searchNoResultDesc', { query: chatSearchQuery })} />
              ) : (
                chatSearchResults.map((msg: any) => (
                  <div key={msg.id}
                    onClick={() => { if (msg.session_id) onSelectSession(msg.session_id); setSidebarView('sessions'); onChatSearch(''); }}
                    className="group p-3 rounded-2xl cursor-pointer hover:bg-white/40 border border-transparent hover:border-teal-900/5 transition-all"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`px-1.5 py-0.5 rounded-md text-xs font-bold ${msg.role === 'user' ? 'bg-blue-50 text-blue-600' : 'bg-accent/10 text-accent'}`}>
                        {msg.role === 'user' ? t('chat.sessions.user') : t('chat.sessions.aiTag')}
                      </span>
                      {msg.session_title && (
                        <span className="text-xs text-muted truncate flex-1">{msg.session_title}</span>
                      )}
                    </div>
                    <p className="text-2xs text-foreground/80 line-clamp-3 leading-relaxed">
                      {msg.content?.substring(0, 150)}{msg.content?.length > 150 ? '...' : ''}
                    </p>
                    <p className="text-xs text-muted mt-1.5">{new Date(msg.created_at).toLocaleString()}</p>
                  </div>
                ))
              )
            ) : (
              <EmptyState compact icon={<Search size={20} />} title={t('chat.sessions.searchEmpty')} description={t('chat.sessions.searchEmptyDesc')} />
            )
          ) : sidebarView === 'bookmarks' ? (
            bookmarkedMessages.length === 0 ? (
              <EmptyState compact icon={<Bookmark size={20} />} title={t('chat.sessions.bookmarkEmpty')} description={t('chat.sessions.bookmarkEmptyDesc')} />
            ) : (
              bookmarkedMessages.map((msg: any) => (
                <div key={msg.id}
                  onClick={() => { if (msg.session_id) onSelectSession(msg.session_id); setSidebarView('sessions'); }}
                  className="group p-3 rounded-2xl cursor-pointer hover:bg-white/40 border border-transparent hover:border-teal-900/5 transition-all"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <Bookmark size={10} className="text-accent fill-accent" />
                    {msg.session_title && (
                      <span className="text-xs text-muted truncate flex-1">{msg.session_title}</span>
                    )}
                  </div>
                  <p className="text-2xs text-foreground/80 line-clamp-3 leading-relaxed">
                    {msg.content?.substring(0, 150)}{msg.content?.length > 150 ? '...' : ''}
                  </p>
                  <p className="text-xs text-muted mt-1.5">{new Date(msg.created_at).toLocaleString()}</p>
                </div>
              ))
            )
          ) : sidebarView === 'memories' ? (
            (!aiMemories || aiMemories.length === 0) ? (
              <EmptyState compact icon={<BrainCircuit size={20} />} title={t('chat.sessions.memoryEmpty')} description={t('chat.sessions.memoryEmptyDesc')} />
            ) : (
              aiMemories.map((memory: any) => (
                <div key={memory.id} className="group p-3 rounded-2xl border border-transparent hover:border-teal-900/5 hover:bg-white/40 transition-all">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="px-1.5 py-0.5 rounded-lg bg-accent/10 text-xs font-bold text-accent">
                      {memory.category}
                    </span>
                    {onDeleteAiMemory && (
                      <button
                        onClick={() => onDeleteAiMemory(memory.id)}
                        className="w-5 h-5 rounded-lg flex items-center justify-center text-muted opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-500/10 transition-all"
                      >
                        <Trash2 size={10} />
                      </button>
                    )}
                  </div>
                  <p className="text-2xs text-foreground/80 leading-relaxed">{memory.content}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-xs text-muted">{new Date(memory.updated_at).toLocaleDateString()}</span>
                    <span className="text-xs text-accent/50">{t('chat.sessions.relevance', { score: memory.relevance })}</span>
                  </div>
                </div>
              ))
            )
          ) : (
            chatSessions.length === 0 ? (
              <EmptyState compact icon={<MessageSquare size={20} />} title={t('chat.sessions.empty')} description={t('chat.sessions.emptyDesc')} action={<button onClick={onNewChat} className="text-2xs text-accent hover:text-accent/80 font-bold mt-1">{t('chat.sessions.newChat')}</button>} />
            ) : (
              chatSessions.map((session: any) => (
                <div key={session.id} onClick={() => onSelectSession(session.id)}
                  className={`group relative p-3 rounded-2xl cursor-pointer transition-all ${
                    activeSessionId === session.id ? 'bg-accent/10 border border-accent/20' : 'hover:bg-white/40 border border-transparent'
                  }`}>
                  <div className="flex items-center gap-3">
                    <MessageSquare size={14} className={activeSessionId === session.id ? 'text-accent' : 'text-muted'} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-bold truncate ${activeSessionId === session.id ? 'text-accent' : 'text-foreground'}`}>{session.title || t('chat.sessions.titleDefault')}</p>
                      <p className="text-xs text-muted font-medium mt-0.5">{new Date(session.updated_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={(e) => onRenameSession(e, session.id, session.title || t('chat.sessions.titleDefault'))} className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-accent/10 text-muted hover:text-accent rounded-lg transition-all" title={t('chat.sessions.rename')}><Edit2 size={12} /></button>
                      <button onClick={(e) => onDeleteSession(e, session.id)} className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 text-muted hover:text-red-500 rounded-lg transition-all" title={t('chat.sessions.delete')}><Trash2 size={12} /></button>
                    </div>
                  </div>
                </div>
              ))
            )
          )}
        </div>
      </div>

      <div className="flex-1 relative bg-white/10">
        <div className="absolute top-0 left-0 right-0 h-[104px] p-8 border-b border-teal-900/5 flex items-center justify-between bg-white/20 z-20">
          <div className="flex items-center gap-4">
            <button onClick={() => onSetIsChatSidebarOpen(!isChatSidebarOpen)} className="p-2 hover:bg-accent/10 rounded-xl text-muted hover:text-accent transition-all" title={isChatSidebarOpen ? t('chat.tooltip.hideSidebar') : t('chat.tooltip.showSidebar')}>
              <SidebarIcon size={18} />
            </button>
            <div>
              <h2 className="text-2xl font-display font-bold text-foreground">{t('chat.title')}</h2>
              <p className="text-muted text-xs font-medium mt-1">{t('chat.subtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center bg-accent/5 rounded-2xl border border-accent/10 p-1">
              <button onClick={() => { if (!aiRagReady) return; const n = !isRAGEnabled; onSetIsRAGEnabled(n); localStorage.setItem('isRAGEnabled', String(n)); }}
                disabled={!aiRagReady}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-2xs font-bold uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed ${isRAGEnabled ? 'bg-accent text-white shadow-sm' : 'text-muted hover:text-accent'}`} title={aiRagReady ? (isRAGEnabled ? t('chat.toolbar.aiReadyHint') : t('chat.toolbar.aiReadyHint')) : t('chat.toolbar.aiNotReadyHint')}>
                <Database size={12} /><span>{t('chat.toolbar.rag')}</span>
              </button>
              <button onClick={() => { const n = !isSearchEnabled; onSetIsSearchEnabled(n); localStorage.setItem('isSearchEnabled', String(n)); }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-2xs font-bold uppercase tracking-wider transition-all ${isSearchEnabled ? 'bg-accent text-white shadow-sm' : 'text-muted hover:text-accent'}`} title={isSearchEnabled ? t('chat.toolbar.searchOff') : t('chat.toolbar.searchOn')}>
                <Globe size={12} /><span>{t('chat.toolbar.search')}</span>
              </button>
            </div>
            {chatMessages.length > 0 && (
              <>
                <button onClick={() => setIsMessageSearchOpen(o => !o)} className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-xs font-bold ${isMessageSearchOpen ? 'bg-accent/10 text-accent' : 'text-muted hover:text-accent hover:bg-accent/5'}`} title={t('chat.search.placeholder')} aria-label={t('chat.search.placeholder')}>
                  <Search size={14} />
                </button>
                <button onClick={onRollbackTurn} disabled={isChatLoading} className="flex items-center gap-2 px-4 py-2 text-muted hover:text-accent hover:bg-accent/5 rounded-xl transition-all text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed" title={t('chat.tooltip.rollback')}>
                  <Undo2 size={14} />{t('chat.toolbar.rollback')}
                </button>
                <button onClick={onClearChat} className="flex items-center gap-2 px-4 py-2 text-muted hover:text-red-500 hover:bg-red-50 rounded-xl transition-all text-xs font-bold" title={t('chat.tooltip.clear')}>
                  <RotateCcw size={14} />{t('chat.toolbar.clear')}
                </button>
              </>
            )}
            <div className="relative">
              <button onClick={() => onSetIsModelDropdownOpen(!isModelDropdownOpen)} disabled={availableModels.length === 0} className="px-4 py-2 bg-accent/5 rounded-2xl border border-accent/10 flex items-center gap-2 hover:bg-accent/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                <div className="w-2 h-2 bg-accent rounded-full animate-pulse"></div>
                <span className="text-2xs font-bold text-accent uppercase tracking-widest">
                  {selectedModel ? getModelInfo(selectedModel).alias : t('chat.toolbar.connecting')}
                </span>
                <ChevronDown size={14} className={`text-accent transition-transform duration-200 ${isModelDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {isModelDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-[100]" onClick={() => onSetIsModelDropdownOpen(false)}></div>
                  <div className="absolute right-0 mt-2 w-72 bg-white border border-teal-900/5 rounded-2xl shadow-xl z-[101] p-2 py-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-3 mb-2 text-2xs font-bold text-muted uppercase tracking-wider">{t('chat.toolbar.chooseModel')}</div>
                    {availableModels.length > 0 ? availableModels.map((model) => {
                      const modelInfo = getModelInfo(model);
                      return (
                        <button key={model} onClick={() => { onModelChange(model); onSetIsModelDropdownOpen(false); }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all ${selectedModel === model ? 'bg-accent/10 text-accent font-semibold' : 'text-primary hover:bg-accent/5'}`}>
                          <div className="flex flex-col text-left min-w-0 gap-0.5">
                            <span className="truncate font-medium">{modelInfo.alias}</span>
                            <div className="flex items-center gap-1 flex-wrap">
                              {modelInfo.tags.map((tag, i) => (
                                <span key={i} className="px-1.5 py-0.5 bg-accent/5 text-accent/70 rounded text-2xs">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                          {selectedModel === model && <Check size={14} className="flex-shrink-0" />}
                        </button>
                      );
                    }) : <div className="px-3 py-2 text-2xs text-muted italic">{t('chat.toolbar.noModel')}</div>}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="absolute top-[104px] bottom-[180px] left-0 right-0 overflow-y-auto p-8 space-y-6 custom-scrollbar z-10">
          {/* P3 任务 2：消息内搜索高亮工具栏 */}
          {isMessageSearchOpen && chatMessages.length > 0 && (
            <div className="sticky top-0 z-20 -mx-2">
              <MessageSearchBar
                query={messageSearchQuery}
                onQueryChange={(q) => { setMessageSearchQuery(q); setActiveMatchGlobalIndex(0); }}
                currentMatch={currentMatch}
                totalMatches={totalMatches}
                onPrev={gotoPrev}
                onNext={gotoNext}
                onClose={closeMessageSearch}
              />
            </div>
          )}
          {chatMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-8">
              <div className="space-y-4">
                <div className="w-20 h-20 bg-accent/5 rounded-[2rem] flex items-center justify-center text-accent mx-auto"><BrainCircuit size={40} /></div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">{t('chat.empty.startTitle')}</h3>
                  <p className="text-sm text-muted max-w-xs mx-auto">{t('chat.empty.startDesc')}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 max-w-lg w-full px-4">
                {[
                  { icon: <Sparkles size={14} />, text: t('chat.empty.prompt.summarize'), mode: 'chat' },
                  { icon: <Search size={14} />, text: t('chat.empty.prompt.search'), mode: 'chat' },
                  { icon: <StickyNote size={14} />, text: t('chat.empty.prompt.memos'), mode: 'nav-memos' },
                  { icon: <Database size={14} />, text: t('chat.empty.prompt.kb'), mode: 'nav-kb' }
                ].map((prompt, i) => (
                  <button key={i} onClick={() => {
                    if (prompt.mode === 'nav-memos') { onNavigateToMemos(); return; }
                    if (prompt.mode === 'nav-kb') { onNavigateToKB(); return; }
                    if (!aiChatReady) { onOpenSettings(); return; }
                    onSetChatInput(prompt.text);
                    setTimeout(() => onSendMessage(), 100);
                  }}
                    className="flex items-center gap-3 p-4 bg-white/60 border border-teal-900/5 rounded-2xl hover:bg-white hover:border-accent/30 hover:shadow-md transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed">
                    <div className="w-8 h-8 rounded-lg bg-accent/5 flex items-center justify-center text-accent group-hover:bg-accent group-hover:text-white transition-colors">{prompt.icon}</div>
                    <span className="text-xs font-medium text-foreground/80">{prompt.text}</span>
                  </button>
                ))}
              </div>
              {!aiChatReady && (
                <button
                  onClick={onOpenSettings}
                  className="px-5 py-2.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-700 hover:bg-amber-100 transition-all"
                >
                  {t('chat.empty.diagnose')}
                </button>
              )}
            </div>
          ) : (
            chatMessages.map((msg: any, idx: number) => {
              const assistantParts = msg.role === 'assistant' ? getAssistantMessageParts(msg) : null;
              const copyContent = msg.role === 'assistant' ? assistantParts?.answer || '' : msg.content;
              const isStreamingAssistant = msg.role === 'assistant' && idx === chatMessages.length - 1 && isChatLoading;
              const messageId = String(msg.id ?? idx);
              const assistantPhase = msg.role === 'assistant' ? inferAssistantPhase(msg, isStreamingAssistant, assistantParts) : null;
              const assistantPhaseLabel = msg.role === 'assistant' ? getAssistantPhaseLabel(msg, assistantPhase) : '';
              const isReasoningExpanded = isStreamingAssistant ? true : (expandedReasoningMessages[messageId] ?? false);
              const reasoningText = (assistantParts?.reasoning || '').slice(0, 500);
              const isAgentToolStreaming =
                isStreamingAssistant &&
                (!assistantParts?.answer || assistantParts?.answer?.trim().length === 0) &&
                ((msg.toolCalls && msg.toolCalls.length > 0) || assistantPhase === 'searching' || assistantPhase === 'web-searching' || assistantPhase === 'web-reading');
              const streamingPlaceholder = isAgentToolStreaming
                ? (msg.sources && msg.sources.length > 0
                    ? t('chat.composing.search', { count: msg.sources.length })
                    : msg.toolCalls && msg.toolCalls.length > 0
                      ? t('chat.composing.tool', { displayName: msg.toolCalls[msg.toolCalls.length - 1]?.displayName || t('chat.composing.toolDefault') })
                      : t('chat.composing.searchDefault'))
                : assistantParts?.reasoning
                  ? t('chat.composing.answer')
                  : msg.sources && msg.sources.length > 0
                    ? t('chat.composing.withSources', { count: msg.sources.length })
                    : t('chat.composing.prepare');

              return (
                <div key={messageId} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-6 rounded-[2rem] relative group/msg ${msg.role === 'user' ? 'bg-accent text-white shadow-glass rounded-tr-none' : 'bg-white/80 border border-teal-900/5 text-foreground rounded-tl-none'}`}>
                    <div className={`absolute -right-12 top-0 flex flex-col gap-1 transition-all opacity-0 group-hover/msg:opacity-100 ${msg.role === 'user' ? 'text-accent' : 'text-muted'}`}>
                      <button onClick={() => onCopy(copyContent, `chat-${idx}`)} className={`p-2 rounded-xl transition-all ${msg.role === 'user' ? 'hover:bg-accent/5' : 'hover:bg-teal-900/5'}`} title={t('chat.actions.copy')}>
                        {copiedId === `chat-${idx}` ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                      </button>
                      {msg.role === 'user' && !isChatLoading && (
                        <button onClick={() => onEditMessage(messageId, msg.content)} className={`p-2 rounded-xl transition-all ${msg.role === 'user' ? 'hover:bg-accent/5' : 'hover:bg-teal-900/5'}`} title={t('chat.actions.edit')}><Edit2 size={14} /></button>
                      )}
                      {msg.role === 'assistant' && !isStreamingAssistant && (
                        <button onClick={() => onRegenerateResponse(messageId)} className={`p-2 rounded-xl transition-all ${msg.role === 'user' ? 'hover:bg-accent/5' : 'hover:bg-teal-900/5'}`} title={t('chat.actions.regenerate')}><RotateCcw size={14} /></button>
                      )}
                      {msg.branches && msg.branches.length > 1 && (
                        <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg bg-teal-900/5 text-2xs font-mono font-bold text-muted">
                          <button onClick={() => onBranchMessage(messageId, 'prev')} className="p-0.5 hover:text-accent transition-colors disabled:opacity-30" disabled={(msg.activeBranchIndex ?? msg.branches.length - 1) === 0}><ChevronLeft size={12} /></button>
                          <span className="min-w-[2rem] text-center">{(msg.activeBranchIndex ?? msg.branches.length - 1) + 1}/{msg.branches.length}</span>
                          <button onClick={() => onBranchMessage(messageId, 'next')} className="p-0.5 hover:text-accent transition-colors disabled:opacity-30" disabled={(msg.activeBranchIndex ?? msg.branches.length - 1) === msg.branches.length - 1}><ChevronRight size={12} /></button>
                        </div>
                      )}
                      <button onClick={() => onExportMessage(msg, 'markdown')} className={`p-2 rounded-xl transition-all ${msg.role === 'user' ? 'hover:bg-accent/5' : 'hover:bg-teal-900/5'}`} title={t('chat.actions.export')}><Download size={14} /></button>
                      <button onClick={() => onToggleBookmark(messageId, !!msg.bookmarked)} className={`p-2 rounded-xl transition-all ${msg.bookmarked ? 'text-accent' : 'hover:bg-teal-900/5 text-muted hover:text-accent'}`} title={msg.bookmarked ? t('chat.actions.unbookmark') : t('chat.actions.bookmark')}><Bookmark size={14} className={msg.bookmarked ? 'fill-accent' : ''} /></button>
                      {msg.role === 'assistant' && (
                        <>
                          <button onClick={() => onExtractTodos(msg)} className={`p-2 rounded-xl transition-all hover:bg-teal-900/5`} title={t('chat.actions.extractTodos')}><ListTodo size={14} /></button>
                          <button onClick={() => onCreateMemoFromChat?.(copyContent, msg.content?.substring(0, 30) || '来自AI对话')} className={`p-2 rounded-xl transition-all hover:bg-teal-900/5`} title={t('chat.actions.toMemo')}><FilePlus size={14} /></button>
                          <button onClick={() => onCreateScheduleFromChat?.(copyContent)} className={`p-2 rounded-xl transition-all hover:bg-teal-900/5`} title={t('chat.actions.toSchedule')}><CalendarPlus size={14} /></button>
                        </>
                      )}
                    </div>
                    <div className="text-sm leading-relaxed prose prose-sm max-w-none prose-teal prose-p:my-1 prose-pre:bg-black/5 prose-pre:border prose-pre:border-black/10 prose-code:text-accent prose-code:font-mono">
                      {msg.role === 'assistant' ? (
                        <div className="space-y-4">
                          {assistantPhase && assistantPhase !== 'completed' && (
                            <div className="flex items-center gap-2 not-prose">
                              <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-2xs font-bold tracking-[0.18em] uppercase ${getAssistantPhaseClasses(assistantPhase)}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${assistantPhase === 'error' ? 'bg-red-500' : 'bg-current animate-pulse'}`}></span>
                                {assistantPhaseLabel}
                              </span>
                              {msg.sources && msg.sources.length > 0 && assistantPhase === 'composing' && (
                                <span className="text-2xs font-medium text-muted">已完成 {msg.sources.length} 条资料整理</span>
                              )}
                            </div>
                          )}
                          {showReasoningProcess && (reasoningText || isStreamingAssistant) && (
                            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 overflow-hidden not-prose">
                              <button onClick={() => toggleReasoningExpanded(messageId)} className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-amber-500/5 transition-colors">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="flex items-center gap-2 text-amber-700/80">
                                    <BrainCircuit size={13} className={isStreamingAssistant ? 'animate-pulse' : ''} />
                                    <span className="text-2xs font-bold uppercase tracking-[0.2em]">{t('chat.reasoning.title')}</span>
                                  </div>
                                  <span className="truncate text-2xs text-amber-700/70">{assistantPhaseLabel || (reasoningText ? t('chat.reasoning.generated') : t('chat.reasoning.waiting'))}</span>
                                </div>
                                <div className="flex items-center gap-2 text-amber-700/70">
                                  <span className="text-2xs font-bold uppercase tracking-wider">{isReasoningExpanded ? t('chat.reasoning.collapse') : t('chat.reasoning.expand')}</span>
                                  <ChevronDown size={14} className={`transition-transform duration-200 ${isReasoningExpanded ? 'rotate-180' : ''}`} />
                                </div>
                              </button>
                              {isReasoningExpanded ? (
                                <div className="px-4 pb-4">
                                  <div className="px-4 py-3 max-h-64 overflow-y-auto custom-scrollbar whitespace-pre-wrap text-xs leading-6 text-amber-950/75 font-mono bg-white/40 border border-amber-500/10 rounded-xl">
                                    {reasoningText ? <StreamingReasoningText text={reasoningText} animate={isStreamingAssistant} /> : t('chat.reasoning.empty')}
                                  </div>
                                </div>
                              ) : (
                                <div className="px-4 pb-3 text-2xs text-amber-700/70">{t('chat.reasoning.collapsedHint')}</div>
                              )}
                            </div>
                          )}
                          {msg.toolCalls && msg.toolCalls.length > 0 && (
                            <div className="space-y-2 mb-3 not-prose">
                              {msg.toolCalls.map((tc: any, tcIdx: number) => (
                                <div key={tcIdx} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-accent/5 border border-accent/10">
                                  <Wrench size={12} className="text-accent animate-pulse" />
                                  <span className="text-2xs font-bold text-accent">{tc.displayName}</span>
                                  <span className="text-2xs text-muted">{t('chat.toolCall.executing')}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {assistantParts?.answer ? (
                            <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                              a({ href, children, ...props }: any) {
                                return (
                                  <a
                                    href={href}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      if (href) {
                                        window.ipcRenderer.invoke('open-external', { url: href });
                                      }
                                    }}
                                    className="text-accent hover:underline break-all"
                                    {...props}
                                  >
                                    {children}
                                  </a>
                                );
                              },
                              code({ node, className, children, ...props }: any) {
                                const match = /language-([\w+#+-]+)/.exec(className || '');
                                const codeStr = String(children).replace(/\n$/, '');
                                const isBlock = !!match || codeStr.includes('\n');
                                if (isBlock) {
                                  return (
                                    <CodeBlockRenderer
                                      language={match?.[1] || 'text'}
                                      codeContent={codeStr}
                                      codeId={`code-${messageId}-${match?.[1] || 'text'}-${codeStr.length}`}
                                      copiedCodeId={copiedCodeId}
                                      isStreaming={isStreamingAssistant}
                                      onCopy={(id, text) => {
                                        navigator.clipboard.writeText(text);
                                        onSetCopiedCodeId(id);
                                        setTimeout(() => onSetCopiedCodeId(null), 2000);
                                      }}
                                    />
                                  );
                                }
                                return <code className="bg-black/5 px-1.5 py-0.5 rounded-md text-accent font-mono text-sm" {...props}>{children}</code>;
                              },
                              img({ src, alt }: any) {
                                return <MarkdownImage src={src} alt={alt} />
                              },
                              // P3 任务 2：行内文本节点高亮（用高阶组件包裹 children）
                              p({ children, ...props }: any) {
                                return <p {...props}>{wrapTextChildrenWithHighlight(children, messageSearchQuery, currentMatchEntry?.messageId === messageId ? currentMatchEntry.matchIndex : -1, `md-p-${messageId}`)}</p>;
                              },
                              li({ children, ...props }: any) {
                                return <li {...props}>{wrapTextChildrenWithHighlight(children, messageSearchQuery, currentMatchEntry?.messageId === messageId ? currentMatchEntry.matchIndex : -1, `md-li-${messageId}`)}</li>;
                              },
                              h1({ children, ...props }: any) { return <h1 {...props}>{wrapTextChildrenWithHighlight(children, messageSearchQuery, -1, `md-h1-${messageId}`)}</h1>; },
                              h2({ children, ...props }: any) { return <h2 {...props}>{wrapTextChildrenWithHighlight(children, messageSearchQuery, -1, `md-h2-${messageId}`)}</h2>; },
                              h3({ children, ...props }: any) { return <h3 {...props}>{wrapTextChildrenWithHighlight(children, messageSearchQuery, -1, `md-h3-${messageId}`)}</h3>; },
                            }}>{assistantParts.answer}</ReactMarkdown>
                          ) : (
                            <div className="not-prose space-y-2 py-1">
                              <div className="flex items-center gap-2 text-accent/60">
                                <div className="flex gap-1" aria-hidden="true">
                                  <div className="w-1 h-1 bg-accent/40 rounded-full animate-bounce"></div>
                                  <div className="w-1 h-1 bg-accent/40 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                                  <div className="w-1 h-1 bg-accent/40 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                                </div>
                                <span className="text-2xs font-bold uppercase tracking-wider">
                                  {streamingPlaceholder}
                                </span>
                              </div>
                              <SkeletonText lines={2} lastLineRatio={0.7} className="max-w-md" />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {msg.images && msg.images.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-2">
                              {msg.images.map((img: string, i: number) => <img key={i} src={img} alt="upload" className="max-w-[240px] max-h-[240px] rounded-xl border border-white/20 shadow-sm" />)}
                            </div>
                          )}
                          {editingMessageId === messageId ? (
                            <div className="space-y-2">
                              <textarea value={editingMessageContent} onChange={(e) => onSetEditingMessageContent(e.target.value)} className="w-full min-h-[80px] p-3 rounded-xl bg-white/20 border border-white/30 text-white placeholder-white/50 outline-none focus:border-white/50 resize-none" placeholder={t('chat.editPlaceholder')} />
                              <div className="flex gap-2">
                                <button onClick={() => onSaveEditAndRegenerate(messageId, editingMessageContent)} className="px-4 py-1.5 bg-white text-accent rounded-lg text-xs font-bold hover:bg-white/90 transition-all">{t('chat.actions.saveRegenerate')}</button>
                                <button onClick={onCancelEdit} className="px-4 py-1.5 bg-white/20 text-white rounded-lg text-xs font-bold hover:bg-white/30 transition-all">{t('chat.actions.cancel')}</button>
                              </div>
                            </div>
                          ) : (
                            <p className="whitespace-pre-wrap">
                              {messageSearchQuery.trim() && currentMatchEntry?.messageId === messageId
                                ? highlightMatches(msg.content || '', messageSearchQuery, currentMatchEntry.matchIndex, `user-${messageId}`)
                                : messageSearchQuery.trim()
                                  ? highlightMatches(msg.content || '', messageSearchQuery, -1, `user-${messageId}`)
                                  : msg.content}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    {msg.sources && msg.sources.length > 0 && !isStreamingAssistant && (
                      <div className="mt-3 pt-3 border-t border-teal-900/10 not-prose">
                        <p className="text-2xs font-bold text-muted uppercase tracking-wider mb-2">{t('chat.sources.title')}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.sources.map((source: any, i: number) => (
                            <button
                              key={i}
                              onClick={() => {
                                if (source.type === 'note' || source.type === 'document' || source.type === 'memo') {
                                  window.dispatchEvent(new CustomEvent('navigate-to-source', { detail: { type: source.type, id: source.id } }));
                                }
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-accent/5 hover:bg-accent/10 border border-accent/10 rounded-lg text-xs text-accent transition-all cursor-pointer"
                              title={source.title || source.url || source.id}
                            >
                              <span className="truncate max-w-[200px]">{source.title || source.url || source.id}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {msg.tags && msg.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3 not-prose">
                        {msg.tags.map((tag: string, tagIdx: number) => <span key={tagIdx} className="px-2 py-0.5 rounded-full bg-accent/10 text-accent text-2xs font-bold">{tag}</span>)}
                      </div>
                    )}
                    {msg.role === 'assistant' && !isStreamingAssistant && assistantPhase === 'completed' && (
                      <div className="flex flex-wrap gap-1.5 mt-3 pt-2 border-t border-teal-900/5 not-prose">
                        <button onClick={() => onSendMessage(`请对以下内容做更深入详细的解释：\n\n${msg.content?.substring(0, 500)}`)} className="px-2.5 py-1 rounded-lg bg-accent/5 hover:bg-accent/10 text-accent text-2xs font-bold transition-all flex items-center gap-1"><Zap size={10} />{t('chat.actions.deeper')}</button>
                        <button onClick={() => onSendMessage(`请用更简单易懂的方式重新解释：\n\n${msg.content?.substring(0, 500)}`)} className="px-2.5 py-1 rounded-lg bg-accent/5 hover:bg-accent/10 text-accent text-2xs font-bold transition-all flex items-center gap-1"><Sparkles size={10} />{t('chat.actions.simpler')}</button>
                        <button onClick={() => onSendMessage(`请举一个具体实际的例子来说明：\n\n${msg.content?.substring(0, 500)}`)} className="px-2.5 py-1 rounded-lg bg-accent/5 hover:bg-accent/10 text-accent text-2xs font-bold transition-all flex items-center gap-1"><ListTodo size={10} />{t('chat.actions.example')}</button>
                        <button onClick={() => onSendMessage('请继续')} className="px-2.5 py-1 rounded-lg bg-accent/5 hover:bg-accent/10 text-accent text-2xs font-bold transition-all flex items-center gap-1"><ChevronRight size={10} />{t('chat.actions.continue')}</button>
                      </div>
                    )}
                    {/* P3 任务 3：表情反应 - 仅对已完成消息展示 */}
                    {msg.role === 'assistant' && !isStreamingAssistant && (
                      <MessageReactions
                        messageId={messageId}
                        align="left"
                      />
                    )}
                  </div>
                </div>
              );
            })
          )}
          {agentSteps && agentSteps.length > 0 && (
            <div className="flex justify-start ml-4">
              <AgentStepsView steps={agentSteps} />
            </div>
          )}
          {isChatLoading && (chatMessages.length === 0 || chatMessages[chatMessages.length - 1]?.role === 'user') && (
            <div className="flex justify-start">
              <div className="bg-white/80 border border-teal-900/5 p-6 rounded-[2rem] rounded-tl-none flex items-center gap-3 shadow-sm">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce [animation-delay:0.2s]"></div>
                  <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce [animation-delay:0.4s]"></div>
                </div>
                <span className="text-2xs font-bold text-accent uppercase tracking-widest">{isSearchEnabled ? t('chat.thinking.search') : t('chat.thinking.default')}</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} className="h-4" />
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-[180px] p-8 bg-white/50 border-t border-teal-900/5 z-20 flex flex-col justify-end">
          <div className="relative group pointer-events-auto">
            {chatImages.length > 0 && (
              <div className="absolute bottom-full left-0 mb-4 flex flex-wrap gap-3 p-4 bg-white/80 backdrop-blur-xl border border-teal-900/5 rounded-3xl shadow-glass z-30">
                {chatImages.map((img, idx) => (
                  <div key={idx} className="relative group/img w-20 h-20">
                    <img src={img} alt="preview" className="w-full h-full object-cover rounded-xl border border-teal-900/10" />
                    <button onClick={() => onRemoveImage(idx)} className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity shadow-lg"><X size={14} /></button>
                  </div>
                ))}
              </div>
            )}
            <input type="file" ref={fileInputRef} onChange={onFileSelect} accept="image/*" multiple className="hidden" />
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-2xs font-bold text-muted uppercase tracking-wider shrink-0">{t('chat.role.label')}</span>
                <div className="relative flex-1 min-w-0">
                  <button
                    onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent/10 text-accent text-2xs font-bold hover:bg-accent/20 transition-all w-full"
                  >
                    {(() => {
                      const currentRole = (allRolesProp || aiRoles).find(r => r.id === selectedRole);
                      const IconComponent = currentRole?.icon || Sparkles;
                      return (
                        <>
                          <IconComponent size={12} />
                          <span className="truncate">{currentRole?.name || t('chat.role.default')}</span>
                          {currentRole?.domain && <span className="text-xs text-accent/60 shrink-0">· {currentRole.domain}</span>}
                        </>
                      );
                    })()}
                    <ChevronDown size={10} className="ml-auto shrink-0" />
                  </button>
                  {isRoleDropdownOpen && (
                    <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-teal-900/10 rounded-2xl shadow-xl z-[10] p-3 max-h-[320px] overflow-y-auto animate-in fade-in slide-in-from-bottom-2 duration-200">
                      <div className="space-y-1">
                        {(allRolesProp || aiRoles).map((role) => {
                          const IconComponent = role.icon;
                          const isSelected = selectedRole === role.id;
                          return (
                            <button
                              key={role.id}
                              onClick={() => {
                                onSetSelectedRole(role.id);
                                localStorage.setItem('selectedRole', role.id);
                                setIsRoleDropdownOpen(false);
                              }}
                              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all group ${
                                isSelected ? 'bg-accent/10 text-accent' : 'hover:bg-teal-900/5 text-foreground'
                              }`}
                            >
                              <IconComponent size={14} className={isSelected ? 'text-accent' : 'text-muted group-hover:text-accent'} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-2xs font-bold truncate">{role.name}</span>
                                  {role.builtin && <span className="text-xs px-1 py-0.5 rounded bg-teal-900/5 text-muted font-bold">{t('chat.tags.builtin')}</span>}
                                  {!role.builtin && role.id.startsWith('custom-') && <span className="text-xs px-1 py-0.5 rounded bg-accent/5 text-accent font-bold">{t('chat.tags.custom')}</span>}
                                </div>
                                {role.domain && <p className="text-xs text-muted truncate">{role.domain} · {role.tone || ''}</p>}
                              </div>
                              {isSelected && <Check size={12} className="text-accent shrink-0" />}
                              {!role.builtin && role.id.startsWith('custom-') && onSetEditingCustomRole && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSetEditingCustomRole!(role);
                                    onSetIsRoleEditorOpen?.(true);
                                    setIsRoleDropdownOpen(false);
                                  }}
                                  className="w-5 h-5 rounded-md flex items-center justify-center text-muted opacity-0 group-hover:opacity-100 hover:text-accent hover:bg-accent/10 transition-all shrink-0"
                                >
                                  <Edit2 size={10} />
                                </button>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      <div className="border-t border-teal-900/5 mt-2 pt-2">
                        <button
                          onClick={() => {
                            onSetIsRoleEditorOpen?.(true);
                            onSetEditingCustomRole?.(null);
                            setIsRoleDropdownOpen(false);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-accent hover:bg-accent/10 transition-all"
                        >
                          <PlusCircle size={14} />
                          <span className="text-2xs font-bold">{t('chat.role.manage')}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {/* SearXNG 状态灯 */}
              {isSearchEnabled && (
                <button
                  onClick={() => onCheckSearxng?.()}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold transition-all shrink-0 ${
                    searxngStatus === 'connected' ? 'bg-green-50 text-green-600' :
                    searxngStatus === 'disconnected' ? 'bg-red-50 text-red-500' :
                    searxngStatus === 'checking' ? 'bg-amber-50 text-amber-500' :
                    'bg-teal-900/5 text-muted'
                  }`}
                  title={searxngStatus === 'connected' ? t('chat.searxng.connected') : searxngStatus === 'disconnected' ? t('chat.searxng.disconnected') : t('chat.searxng.checking')}
                >
                  {searxngStatus === 'checking' ? (
                    <div className="w-2 h-2 border border-amber-400 border-t-transparent rounded-full animate-spin" />
                  ) : searxngStatus === 'connected' ? (
                    <Wifi size={10} />
                  ) : (
                    <WifiOff size={10} />
                  )}
                  {searxngStatus === 'disconnected' && <span>{t('chat.searxng.disconnectedLabel')}</span>}
                </button>
              )}
            </div>
            {isPromptSelectorOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-teal-900/10 rounded-2xl shadow-xl z-[10] p-4 animate-in fade-in slide-in-from-bottom-2 duration-200 max-h-[320px] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-foreground">{t('chat.prompt.title')}</span>
                  <button onClick={() => onSetIsPromptSelectorOpen(false)} className="p-1 hover:bg-teal-900/5 rounded-lg text-muted transition-all"><X size={14} /></button>
                </div>
                <input type="text" placeholder={t('chat.prompt.searchPlaceholder')} value={promptSearchQuery} onChange={(e) => onSetPromptSearchQuery(e.target.value)} className="w-full px-3 py-2 mb-3 text-xs bg-teal-900/5 border border-teal-900/10 rounded-xl outline-none focus:border-accent/50 transition-all" />
                <div className="flex gap-1 mb-3 flex-wrap">
                  {[
                    { id: 'all', label: t('chat.prompt.all') }, { id: 'writing', label: t('chat.prompt.writing') }, { id: 'coding', label: t('chat.prompt.coding') }, { id: 'analysis', label: t('chat.prompt.analysis') }, { id: 'productivity', label: t('chat.prompt.productivity') },
                  ].map((cat) => (
                    <button key={cat.id} onClick={() => onSetPromptCategory(cat.id)} className={`px-3 py-1 rounded-lg text-2xs font-bold transition-all ${promptCategory === cat.id ? 'bg-accent text-white' : 'bg-teal-900/5 text-muted hover:bg-teal-900/10'}`}>{cat.label}</button>
                  ))}
                </div>
                <div className="grid grid-cols-4 gap-2 overflow-y-auto custom-scrollbar flex-1">
                  {filteredPromptTemplates.map((prompt) => {
                    const IconComponent = prompt.icon;
                    return (
                      <button key={prompt.id} onClick={() => { onSetChatInput(prompt.template); onSetIsPromptSelectorOpen(false); onSetPromptSearchQuery(''); chatInputRef.current?.focus(); }}
                        className="flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-accent/5 transition-all group text-center">
                        <IconComponent size={20} className="text-muted group-hover:text-accent transition-colors" />
                        <span className="text-2xs font-bold text-muted group-hover:text-accent transition-colors leading-tight">{prompt.name}</span>
                      </button>
                    );
                  })}
                  {filteredPromptTemplates.length === 0 && <div className="col-span-4 text-center py-4 text-xs text-muted">{t('chat.prompt.empty')}</div>}
                </div>
              </div>
            )}
            {!aiChatReady && (
              <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-amber-800">{t('chat.diagnose.title')}</p>
                  <p className="text-2xs text-amber-700/80 mt-1 leading-relaxed">{aiUnavailableMessage}</p>
                </div>
                <button
                  onClick={onOpenSettings}
                  className="shrink-0 px-3 py-2 rounded-xl bg-white border border-amber-200 text-2xs font-bold text-amber-700 hover:bg-amber-100 transition-all"
                >
                  {t('chat.tooltip.diagnose')}
                </button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 shrink-0">
                <button disabled={!aiChatReady} onClick={() => fileInputRef.current?.click()} className="w-11 h-11 flex items-center justify-center text-muted hover:text-accent hover:bg-accent/5 rounded-xl transition-all border border-teal-900/5 disabled:opacity-40 disabled:cursor-not-allowed" title={aiChatReady ? t('chat.input.uploading') : t('chat.input.uploadingHint')}><ImageIcon size={18} /></button>
                <button disabled={!aiChatReady} onClick={() => onSetChatInput('🎨请帮我生成图片：')} className="w-11 h-11 flex items-center justify-center text-muted hover:text-purple-500 hover:bg-purple-500/5 rounded-xl transition-all border border-teal-900/5 disabled:opacity-40 disabled:cursor-not-allowed" title={aiChatReady ? t('chat.input.painting') : t('chat.input.paintingHint')}><Palette size={18} /></button>
              </div>
              <input type="text" ref={chatInputRef} autoFocus value={chatInput} disabled={!aiChatReady} onChange={(e) => onSetChatInput(e.target.value)}
                onKeyDown={(e) => { if (!aiChatReady) return; if (e.key === 'Enter') onSendMessage(); if (e.key === '/' && chatInput === '') { e.preventDefault(); onSetIsPromptSelectorOpen(true); } if (e.key === 'Escape') onSetIsPromptSelectorOpen(false); }}
                placeholder={aiChatReady ? t('chat.placeholder.ready') : t('chat.placeholder.notReady')}
                className="flex-1 bg-white border border-teal-900/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:bg-white transition-all shadow-inner" />
              {isChatLoading ? (
                <button onClick={onStopChat} className="w-11 h-11 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all shadow-glass flex items-center justify-center shrink-0" title={t('chat.input.stop')}><Square size={14} fill="currentColor" /></button>
              ) : (
                <button onClick={() => onSendMessage()} disabled={!aiChatReady || !chatInput.trim()} className="w-11 h-11 bg-accent text-white rounded-xl hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-glass flex items-center justify-center shrink-0" title={t('chat.input.send')}><Zap size={16} /></button>
              )}
            </div>
          </div>
        </div>
      </div>
      </div>
    </motion.div>
  );
};

export default ChatPanel;
