import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Bot, Send, ClipboardPaste, Sparkles, Eraser, ChevronDown, Lightbulb, BookOpen, PanelRightClose, PanelRightOpen, GripVertical, FileText, Table, Presentation, Database, BrainCircuit, Square, Copy, Check, Globe, RotateCcw, Edit2, Play } from 'lucide-react';
import { getAssistantMessageParts, inferAssistantPhase, getAssistantPhaseLabel, getAssistantPhaseClasses, sanitizeAssistantReasoningText, type AssistantPhase } from '../utils/chat';
import { logger } from '../utils/logger';
import { loadWebSearchSettings } from '../utils/webSearchSettings';
import { useAppStore } from '../store/appStore';
import { CodeBlockRenderer } from './CodeBlockRenderer';
import { MarkdownImage } from './chat/ImagePreview';
import { sanitizeStreamingAssistantText } from '../hooks/useChatStream';

const SyntaxHighlighterAny = SyntaxHighlighter as unknown as React.ComponentType<Record<string, unknown>>;

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  reasoning: string | undefined;
  sources: any[] | undefined;
  phase: AssistantPhase | undefined;
  usesRetrieval: boolean | undefined;
  timestamp: number;
  images?: string[] | undefined;
}

interface AIChatPanelProps {
  contextType: 'note' | 'document';
  contextId: string | undefined;
  contextTitle?: string;
  contextContent?: string;
  selectedText?: string | null;
  aiReady: boolean;
  selectedModel: string;
  onInsertToEditor?: (text: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  width?: number;
  onWidthChange?: (w: number) => void;
}

const SUGGESTED_PROMPTS: Record<string, Array<{ icon: string; label: string; prompt: string }>> = {
  document: [
    { icon: '💡', label: '总结要点', prompt: '请总结当前文档的核心要点，用简洁的列表呈现' },
    { icon: '✍️', label: '续写建议', prompt: '基于当前内容，给出接下来可以写什么的建议' },
    { icon: '🔍', label: '找问题', prompt: '请检查当前文档中可能存在的逻辑问题或不一致之处' },
    { icon: '📋', label: '提取待办', prompt: '从当前内容中提取所有可执行的待办事项' },
  ],
  note: [
    { icon: '📝', label: '整理要点', prompt: '请帮我整理这条便签的核心要点' },
    { icon: '🔄', label: '扩展想法', prompt: '基于这条便签，帮我展开思考，补充更多细节和角度' },
    { icon: '📋', label: '提取行动', prompt: '从这条便签中提取可以立即执行的行动项' },
    { icon: '🏷️', label: '建议标签', prompt: '根据内容，建议合适的标签分类' },
  ],
};

const MIN_WIDTH = 320;
const MAX_WIDTH = 960;
const DEFAULT_WIDTH = 520;

const AIChatPanel: React.FC<AIChatPanelProps> = ({
  contextType,
  contextId,
  contextTitle,
  contextContent,
  selectedText,
  aiReady,
  selectedModel,
  onInsertToEditor,
  collapsed: controlledCollapsed,
  onToggleCollapse,
  width: controlledWidth,
  onWidthChange,
}) => {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const [internalWidth, setInternalWidth] = useState(DEFAULT_WIDTH);
  const collapsed = controlledCollapsed ?? internalCollapsed;
  const width = controlledWidth ?? internalWidth;

  const docSessionId = contextId ? `doc-${contextId}` : null;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const currentProjectName = useAppStore(s => s.currentProjectName);
  const cloudModelIdMap = useAppStore(s => s.cloudModelIdMap);
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [isRAGEnabled, setIsRAGEnabled] = useState(() => localStorage.getItem('aiChatPanel_rag') !== 'false');
  const [isSearchEnabled, setIsSearchEnabled] = useState(() => localStorage.getItem('aiChatPanel_search') === 'true');
  const [searxngUrl, setSearxngUrl] = useState('');
  const [showReasoning, setShowReasoning] = useState(true);
  const [expandedReasoning, setExpandedReasoning] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [isSlashOpen, setIsSlashOpen] = useState(false);
  const slashRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);

  // 当 contextId 变化时，加载该文档/便签的历史对话
  useEffect(() => {
    if (!docSessionId || !window.ipcRenderer) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    window.ipcRenderer.invoke('get-chat-messages', { sessionId: docSessionId }).then((history: any[]) => {
      if (cancelled) return;
      if (history && history.length > 0) {
        const restored = history.map((m: any) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          reasoning: undefined as string | undefined,
          sources: m.sources || undefined,
          phase: m.role === 'assistant' ? ('completed' as AssistantPhase) : undefined,
          usesRetrieval: !!(m.sources && m.sources.length > 0),
          timestamp: new Date(m.created_at || Date.now()).getTime(),
        }));
        setMessages(restored);
      } else {
        setMessages([]);
      }
    }).catch(() => setMessages([]));
    return () => { cancelled = true; };
  }, [docSessionId]);

  const suggestions = useMemo(() => SUGGESTED_PROMPTS[contextType] || SUGGESTED_PROMPTS['document'] || [], [contextType]);

  useEffect(() => {
    if (window.ipcRenderer) {
      window.ipcRenderer.invoke('get-setting', 'searxngUrl').then((val: any) => {
        const url = typeof val === 'string' ? val : (val?.value || val?.url || '');
        if (url) setSearxngUrl(url);
      }).catch(() => {});
    }
  }, []);

  const scrollToBottom = () => {
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (!showScrollBtn) {
      scrollToBottom();
    }
  }, [messages, isProcessing]);

  // 加载历史消息后滚动到底部（仅在初始加载时）
  const prevMsgCount = useRef(0);
  useEffect(() => {
    if (messages.length > 0 && prevMsgCount.current === 0) {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      });
    }
    prevMsgCount.current = messages.length;
  }, [messages.length]);

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 100);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setPendingImages(prev => [...prev, result]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const buildContextPrefix = (): string => {
    const typeLabel = contextType === 'note' ? '便签' : '文档';
    const plainContent = (contextContent || '').replace(/<[^>]*>/g, '').slice(0, 1500);
    if (!contextTitle && !plainContent) return '';

    let prefix = `[当前编辑的${typeLabel}]\n标题: ${contextTitle || '未命名'}`;
    if (selectedText) {
      prefix += `\n用户选中的文本: ${selectedText.slice(0, 500)}`;
    } else if (plainContent) {
      prefix += `\n内容摘要: ${plainContent.slice(0, 500)}`;
    }
    prefix += '\n\n';
    return prefix;
  };

  const sendChatRequest = async (
    query: string,
    historyMessages: ChatMessage[],
    assistantMsgId: string,
    sessionId: string | null,
    images: string[],
  ) => {
    if (!window.ipcRenderer) return;

    const contextPrefix = buildContextPrefix();
    const fullPrompt = contextPrefix + query;

    const history = historyMessages.slice(-10).map(m => ({
      role: m.role,
      content: m.content,
    }));

    let currentContent = '';
    let currentReasoning = '';

    const updateAssistantMessage = (updater: (msg: ChatMessage) => ChatMessage) => {
      setMessages(prev => prev.map(msg =>
        msg.id === assistantMsgId ? updater(msg) : msg
      ));
    };

    const handleChunk = (_event: any, data: { chunk?: string; reasoning?: string; sources?: any[]; phase?: string }) => {
      const cleanReasoning = sanitizeAssistantReasoningText(data.reasoning || '');
      if (cleanReasoning) {
        currentReasoning += cleanReasoning;
      }
      if (data.chunk) {
        currentContent += data.chunk;
      }
      updateAssistantMessage(msg => ({
        ...msg,
        content: sanitizeStreamingAssistantText(currentContent),
        reasoning: currentReasoning || msg.reasoning || undefined,
        sources: data.sources?.length ? data.sources : msg.sources,
        phase: cleanReasoning ? 'reasoning' : data.chunk ? 'composing' : msg.phase,
        usesRetrieval: !!(data.sources && data.sources.length > 0) || !!msg.usesRetrieval,
      }));
    };

    const handleEnd = (_event: any, data?: { finalContent?: string; sources?: any[] }) => {
      logger.info('[AIChatPanel] chat-end received', { sourcesCount: data?.sources?.length, hasFinalContent: !!data?.finalContent });
      updateAssistantMessage(msg => ({
        ...msg,
        content: data?.finalContent ?? sanitizeStreamingAssistantText(msg.content),
        sources: data?.sources?.length ? data.sources : msg.sources,
        phase: 'completed',
      }));
      setIsProcessing(false);
      cleanupListeners();
    };

    const handleError = (_event: any, { message }: { message: string }) => {
      updateAssistantMessage(msg => ({
        ...msg,
        content: `抱歉，生成失败：${message}`,
        phase: 'error',
      }));
      setIsProcessing(false);
      cleanupListeners();
    };

    const cleanupListeners = () => {
      window.ipcRenderer?.removeListener('chat-chunk', handleChunk);
      window.ipcRenderer?.removeListener('chat-end', handleEnd);
      window.ipcRenderer?.removeListener('chat-error', handleError);
    };

    window.ipcRenderer.on('chat-chunk', handleChunk);
    window.ipcRenderer.on('chat-end', handleEnd);
    window.ipcRenderer.on('chat-error', handleError);

    try {
      const webSearchSettings = loadWebSearchSettings();
      await window.ipcRenderer.invoke('chat-with-kb', {
        query: fullPrompt,
        model: selectedModel,
        sessionId,
        history,
        images,
        searchEnabled: isSearchEnabled,
        ragEnabled: isRAGEnabled,
        searxngUrl: isSearchEnabled ? searxngUrl : undefined,
        searchProviders: isSearchEnabled ? {
          selectedProvider: webSearchSettings.selectedProvider,
          bochaApiKey: webSearchSettings.providers.bocha?.bochaApiKey,
          searchMode: webSearchSettings.searchMode,
        } : undefined,
        cloudModelId: cloudModelIdMap[selectedModel],
        systemPrompt: contextPrefix ? `你是一个智能助手，正在协助用户编辑${contextType === 'note' ? '便签' : '文档'}。请基于提供的内容上下文来回答问题。` : '',
        projectName: currentProjectName || undefined,
      });
    } catch (invokeErr: any) {
      handleError(null, { message: invokeErr?.message || '请求失败' });
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = input.trim();
    logger.info('[AIChatPanel] handleSubmit called:', { 
      hasInput: !!q, 
      hasImages: pendingImages.length > 0, 
      isProcessing, 
      aiReady, 
      hasIpcRenderer: !!window.ipcRenderer 
    });
    if ((!q && pendingImages.length === 0) || isProcessing || !aiReady || !window.ipcRenderer) {
      logger.info('[AIChatPanel] handleSubmit early return');
      return;
    }

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: q,
      reasoning: undefined,
      sources: undefined,
      phase: undefined,
      usesRetrieval: isRAGEnabled || isSearchEnabled,
      timestamp: Date.now(),
      images: pendingImages.length > 0 ? [...pendingImages] : undefined,
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setPendingImages([]);
    setIsProcessing(true);

    const assistantMsgId = `assistant-${Date.now()}`;
    const initialAssistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      reasoning: '',
      sources: [],
      phase: 'searching',
      usesRetrieval: isRAGEnabled,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, initialAssistantMsg]);

    try {
      await sendChatRequest(
        q,
        [...messages, userMsg],
        assistantMsgId,
        docSessionId,
        (userMsg.images || []).map((img: string) => img.split(',')[1] || img)
      );
    } catch (err: any) {
      const errMsg = err?.message || '未知错误';
      const isOllamaDown = errMsg.includes('ECONNREFUSED') || errMsg.includes('fetch failed') || errMsg.includes('Failed to fetch');
      setMessages(prev => prev.map(msg =>
        msg.id === assistantMsgId
          ? {
              ...msg,
              content: isOllamaDown
                ? 'AI 引擎未连接，请确保 Ollama 服务已启动。'
                : `请求失败：${errMsg}`,
              phase: 'error' as AssistantPhase,
            }
          : msg
      ));
      setIsProcessing(false);
    }
  };

  const handleStop = async () => {
    if (!window.ipcRenderer) return;
    await window.ipcRenderer.invoke('stop-chat');
    setIsProcessing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  const handleRegenerate = async (msgId: string) => {
    const msgIndex = messages.findIndex(m => m.id === msgId);
    if (msgIndex === -1) return;
    const prevUserMsg = messages.slice(0, msgIndex).reverse().find(m => m.role === 'user');
    if (!prevUserMsg || isProcessing || !aiReady) return;

    const trimmedMessages = messages.slice(0, msgIndex);
    setMessages(trimmedMessages);
    setIsProcessing(true);

    const assistantMsgId = `assistant-${Date.now()}`;
    const initialAssistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      reasoning: '',
      sources: [],
      phase: 'searching',
      usesRetrieval: isRAGEnabled,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, initialAssistantMsg]);

    try {
      await sendChatRequest(prevUserMsg.content, trimmedMessages, assistantMsgId, docSessionId, []);
    } catch {
      setMessages(prev => prev.map(msg =>
        msg.id === assistantMsgId ? { ...msg, content: '重新生成失败', phase: 'error' as AssistantPhase } : msg
      ));
      setIsProcessing(false);
    }
  };

  const isTruncated = (content: string): boolean => {
    const trimmed = content.trimEnd();
    if (!trimmed) return false;
    const lastLine = trimmed.split('\n').pop() || '';
    const hasUnclosedFence = (trimmed.match(/^```/gm) || []).length % 2 !== 0;
    const endsMidCode = lastLine.endsWith('{') || lastLine.endsWith('(') || lastLine.endsWith('[') || lastLine.endsWith(',') || lastLine.endsWith(':') || lastLine.endsWith('=');
    const endsWithEllipsis = trimmed.endsWith('...') || trimmed.endsWith('…');
    const looksLikeCutoff = /[a-zA-Z\u4e00-\u9fff]$/.test(trimmed) && !trimmed.endsWith('```') && !trimmed.endsWith('.');
    return hasUnclosedFence || endsMidCode || endsWithEllipsis || looksLikeCutoff;
  };

  const handleContinue = async (msg: ChatMessage) => {
    if (isProcessing || !aiReady) return;
    setIsProcessing(true);

    const continuePrompt = '请继续输出，从你上次中断的地方继续，不要重复已输出的内容。';
    const assistantMsgId = `assistant-${Date.now()}`;
    const initialAssistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      reasoning: '',
      sources: [],
      phase: 'composing',
      usesRetrieval: false,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, initialAssistantMsg]);

    try {
      const continueMessages = [
        ...messages.filter(m => m.role === 'user' || m.role === 'assistant'),
        { role: 'user' as const, content: continuePrompt, id: `continue-${Date.now()}`, reasoning: undefined, sources: undefined, phase: undefined, usesRetrieval: false, timestamp: Date.now() },
      ];
      await sendChatRequest(continuePrompt, continueMessages, assistantMsgId, docSessionId, []);
    } catch {
      setMessages(prev => prev.map(m =>
        m.id === assistantMsgId ? { ...m, content: '继续生成失败', phase: 'error' as AssistantPhase } : m
      ));
      setIsProcessing(false);
    }
  };

  const handleEditAndResend = async (msgId: string, newContent: string) => {
    const msgIndex = messages.findIndex(m => m.id === msgId);
    if (msgIndex === -1 || isProcessing || !aiReady) return;

    const trimmedMessages = messages.slice(0, msgIndex);
    const targetMsg = messages[msgIndex];
    if (!targetMsg) return;
    const editedUserMsg: ChatMessage = {
      ...targetMsg,
      content: newContent,
    };
    const newMessages = [...trimmedMessages, editedUserMsg];
    setMessages(newMessages);
    setEditingMsgId(null);
    setIsProcessing(true);

    const assistantMsgId = `assistant-${Date.now()}`;
    const initialAssistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      reasoning: '',
      sources: [],
      phase: 'searching',
      usesRetrieval: isRAGEnabled,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, initialAssistantMsg]);

    try {
      await sendChatRequest(newContent, newMessages, assistantMsgId, docSessionId, []);
    } catch {
      setMessages(prev => prev.map(msg =>
        msg.id === assistantMsgId ? { ...msg, content: '重新生成失败', phase: 'error' as AssistantPhase } : msg
      ));
      setIsProcessing(false);
    }
  };

  const handleExport = async (content: string, format: 'docx' | 'xlsx' | 'pptx') => {
    if (!window.ipcRenderer) return;
    try {
      await window.ipcRenderer.invoke('export-file', { content, format, title: contextTitle });
    } catch (err) {
      logger.error('Export failed', err);
    }
  };

  const toggleCollapse = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalCollapsed(!collapsed);
    }
  };

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    const startX = e.clientX;
    const startWidth = width;

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = startX - ev.clientX;
      const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth + delta));
      if (onWidthChange) {
        onWidthChange(newWidth);
      } else {
        setInternalWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      isResizing.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [width, onWidthChange]);

  useEffect(() => {
    if (!isSlashOpen) return;
    const handler = (e: MouseEvent) => {
      if (slashRef.current && !slashRef.current.contains(e.target as Node)) {
        setIsSlashOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isSlashOpen]);

  const handleInputChange = (value: string) => {
    setInput(value);
    if (value === '/' || value.endsWith(' /')) {
      setIsSlashOpen(true);
    } else {
      setIsSlashOpen(false);
    }
  };

  const toggleRAG = () => {
    const next = !isRAGEnabled;
    setIsRAGEnabled(next);
    localStorage.setItem('aiChatPanel_rag', String(next));
  };

  const toggleSearch = () => {
    const next = !isSearchEnabled;
    setIsSearchEnabled(next);
    localStorage.setItem('aiChatPanel_search', String(next));
  };

  const toggleReasoningExpand = (msgId: string) => {
    setExpandedReasoning(prev => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (collapsed) {
    return (
      <div className="flex-shrink-0 flex flex-col items-center py-3 gap-3 border-l border-teal-900/10 bg-white/30">
        <button
          onClick={toggleCollapse}
          className="p-2 rounded-lg text-muted hover:text-accent hover:bg-accent/10 transition-all"
          title="展开 AI Chat"
        >
          <PanelRightOpen size={16} />
        </button>
        <div className="relative">
          <Bot size={18} className="text-accent/60" />
          <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border-[1.5px] border-white ${aiReady ? 'bg-green-500' : 'bg-slate-300'}`} />
        </div>
        {messages.length > 0 && (
          <span className="text-xs bg-accent/10 text-accent rounded-full px-1.5 py-0.5 font-medium">
            {messages.length}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className="flex-shrink-0 border-l border-teal-900/10 bg-white/30 backdrop-blur-xl flex flex-col h-full relative"
      style={{ width }}
    >
      <div
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-accent/20 transition-colors z-10 group"
        onMouseDown={handleResizeStart}
      >
        <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical size={10} className="text-accent/60" />
        </div>
      </div>

      <div className="p-3 border-b border-teal-900/10">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Bot size={18} className="text-accent" />
            <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border-[1.5px] border-white ${aiReady ? 'bg-green-500' : 'bg-slate-300'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground">AI Chat</p>
            <p className="text-2xs text-muted truncate">{selectedModel || '未选择模型'}</p>
          </div>
          <button
            onClick={toggleSearch}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-2xs font-bold transition-all ${
              isSearchEnabled
                ? 'bg-blue-500 text-white'
                : 'bg-blue-500/5 text-muted hover:text-blue-500'
            }`}
            title={isSearchEnabled ? '关闭联网搜索' : '开启联网搜索'}
          >
            <Globe size={10} />
            <span>联网</span>
          </button>
          <button
            onClick={toggleRAG}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-2xs font-bold transition-all ${
              isRAGEnabled
                ? 'bg-accent text-white'
                : 'bg-accent/5 text-muted hover:text-accent'
            }`}
            title={isRAGEnabled ? '关闭知识库检索' : '开启知识库检索'}
          >
            <Database size={10} />
            <span>RAG</span>
          </button>
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="p-1.5 rounded-lg text-muted hover:text-red-500 hover:bg-red-50 transition-all"
              title="清空对话"
            >
              <Eraser size={13} />
            </button>
          )}
          <button
            onClick={toggleCollapse}
            className="p-1.5 rounded-lg text-muted hover:text-accent hover:bg-accent/10 transition-all"
            title="收起面板"
          >
            <PanelRightClose size={14} />
          </button>
        </div>
        {contextTitle && (
          <p className="mt-1.5 text-2xs text-muted truncate px-0.5">
            {contextType === 'note' ? '📝' : '📄'} {contextTitle}
          </p>
        )}
      </div>

      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar relative"
      >
        <AnimatePresence mode="popLayout">
          {messages.length === 0 && !isProcessing && (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center pt-6 text-center"
            >
              <Sparkles size={24} className="text-accent/30 mb-2" />
              <p className="text-2xs text-muted font-medium mb-1">开始对话</p>
              <p className="text-2xs text-muted/60 mb-4 max-w-[200px]">
                {aiReady ? '输入问题，AI 会结合当前内容回答' : '请先配置 AI 模型'}
              </p>
              {aiReady && (
                <div className="w-full px-2 space-y-1.5">
                  {suggestions.map((s, i) => (
                    <motion.button
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => setInput(s.prompt)}
                      className="w-full flex items-center gap-2 px-3 py-2 bg-white/60 border border-teal-900/8 rounded-xl text-2xs text-muted hover:text-accent hover:bg-accent/5 hover:border-accent/20 transition-all text-left"
                    >
                      <span className="text-sm">{s.icon}</span>
                      <span className="flex-1 font-medium">{s.label}</span>
                      <Lightbulb size={10} className="text-muted/40" />
                    </motion.button>
                  ))}
                </div>
              )}
              {isSearchEnabled && (
                <div className="flex items-center gap-1 mt-2 px-2 py-1 bg-blue-50/50 rounded-full">
                  <Globe size={10} className="text-blue-500" />
                  <span className="text-xs text-blue-600">联网搜索已启用</span>
                </div>
              )}
              {isRAGEnabled && (
                <div className="flex items-center gap-1 mt-2 px-2 py-1 bg-amber-50/50 rounded-full">
                  <BookOpen size={10} className="text-amber-500" />
                  <span className="text-xs text-amber-600">RAG 上下文已启用</span>
                </div>
              )}
            </motion.div>
          )}

          {messages.map((msg) => {
            const assistantParts = msg.role === 'assistant' ? getAssistantMessageParts(msg) : null;
            const isStreaming = msg.role === 'assistant' && msg.phase && msg.phase !== 'completed' && msg.phase !== 'error';
            const phase = msg.role === 'assistant' ? inferAssistantPhase(msg, !!isStreaming, assistantParts) : null;
            const phaseLabel = phase ? getAssistantPhaseLabel(msg, phase) : '';
            const reasoningText = assistantParts?.reasoning || msg.reasoning || '';
            const answerText = assistantParts?.answer || '';
            const isReasoningExpanded = isStreaming ? true : (expandedReasoning[msg.id] ?? false);
            const displayContent = answerText || (isStreaming ? '' : msg.content);
            const completedWithoutAnswer = !isStreaming && !!reasoningText && !displayContent;
            const streamingPlaceholder =
              phase === 'searching' || phase === 'web-searching' || phase === 'web-reading'
                ? (msg.sources && msg.sources.length > 0
                    ? `正在整理 ${msg.sources.length} 条资料结果...`
                    : '正在整理资料结果...')
                : reasoningText
                  ? '整理答案中...'
                  : '思考中...';

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[90%] rounded-2xl px-3 py-2.5 text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-accent text-white rounded-br-sm [&::selection]:bg-black/40 [&::selection]:text-white'
                      : 'bg-white/80 border border-teal-900/10 text-foreground rounded-bl-sm'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <div className="space-y-2">
                      {phase && phase !== 'completed' && (
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-2xs font-bold tracking-widest uppercase ${getAssistantPhaseClasses(phase)}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${phase === 'error' ? 'bg-red-500' : 'bg-current animate-pulse'}`} />
                          {phaseLabel}
                        </span>
                      )}

                      {showReasoning && (reasoningText || isStreaming) && (
                        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 overflow-hidden">
                          <button
                            onClick={() => toggleReasoningExpand(msg.id)}
                            className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-amber-500/5 transition-colors"
                          >
                            <div className="flex items-center gap-2 text-amber-700/80">
                              <BrainCircuit size={11} className={isStreaming ? 'animate-pulse' : ''} />
                              <span className="text-2xs font-bold uppercase tracking-wider">推理过程</span>
                            </div>
                            <ChevronDown size={12} className={`transition-transform ${isReasoningExpanded ? 'rotate-180' : ''}`} />
                          </button>
                          {isReasoningExpanded && reasoningText && (
                            <div className="px-3 pb-3">
                              <div className="px-3 py-2 max-h-48 overflow-y-auto custom-scrollbar whitespace-pre-wrap text-2xs leading-5 text-amber-950/75 font-mono bg-white/40 border border-amber-500/10 rounded-lg">
                                {reasoningText.length > 500 ? reasoningText.slice(0, 500) + '…' : reasoningText}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {displayContent ? (
                        <div className="prose prose-sm max-w-none prose-p:my-1 prose-pre:bg-transparent prose-pre:border-0 prose-pre:p-0 prose-code:text-accent prose-code:font-mono prose-code:text-2xs prose-headings:my-1.5 prose-ul:my-1 prose-ol:my-1 prose-li:my-0">
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
                              const codeContent = String(children).replace(/\n$/, '');
                              const isBlock = !!match || codeContent.includes('\n');
                              if (isBlock) {
                                return (
                                  <CodeBlockRenderer
                                    language={match?.[1] || 'text'}
                                    codeContent={codeContent}
                                    codeId={`code-${msg.id}-${match?.[1] || 'text'}`}
                                    copiedCodeId={copiedCodeId}
                                    isStreaming={!!isStreaming}
                                    onCopy={(id, text) => {
                                      navigator.clipboard.writeText(text);
                                      setCopiedCodeId(id);
                                      setTimeout(() => setCopiedCodeId(null), 2000);
                                    }}
                                  />
                                );
                              }
                              return <code className="bg-black/5 px-1.5 py-0.5 rounded-md text-accent font-mono text-sm" {...props}>{children}</code>;
                            },
                            img({ src, alt }: any) {
                              return <MarkdownImage src={src} alt={alt} />
                            }
                          }}>
                            {displayContent}
                          </ReactMarkdown>
                        </div>
                      ) : isStreaming ? (
                        <div className="flex items-center gap-2 text-accent/60">
                          <div className="flex gap-1">
                            <div className="w-1 h-1 bg-accent/40 rounded-full animate-bounce" />
                            <div className="w-1 h-1 bg-accent/40 rounded-full animate-bounce [animation-delay:0.2s]" />
                            <div className="w-1 h-1 bg-accent/40 rounded-full animate-bounce [animation-delay:0.4s]" />
                          </div>
                          <span className="text-2xs font-bold uppercase tracking-wider">
                            {streamingPlaceholder}
                          </span>
                        </div>
                      ) : completedWithoutAnswer ? (
                        <div className="rounded-xl border border-amber-500/20 bg-amber-50/60 px-3 py-2 text-2xs text-amber-800">
                          模型本轮只返回了推理过程，没有产出最终回答。
                        </div>
                      ) : null}

                      {!isStreaming && msg.sources && msg.sources.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-teal-900/10">
                          <p className="text-2xs font-bold text-muted uppercase tracking-wider mb-1.5">参考来源</p>
                          <div className="flex flex-wrap gap-1.5">
                            {msg.sources.map((source: any, i: number) => (
                              <button
                                key={i}
                                onClick={() => {
                                  if (source.type === 'note' || source.type === 'document' || source.type === 'memo') {
                                    window.dispatchEvent(new CustomEvent('navigate-to-source', { detail: { type: source.type, id: source.id } }));
                                  }
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-accent/5 hover:bg-accent/10 border border-accent/10 rounded-md text-xs text-accent transition-all cursor-pointer"
                                title={source.title || source.url || source.id}
                              >
                                <span className="truncate max-w-[200px]">{source.title || source.url || source.id}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {!isStreaming && displayContent && (
                        <div className="mt-2 pt-2 border-t border-teal-900/10 flex items-center gap-1.5 flex-wrap">
                          <button
                            onClick={() => handleRegenerate(msg.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-2xs font-medium rounded-lg bg-violet-50 text-violet-700 hover:bg-violet-100 transition-all"
                          >
                            <RotateCcw size={10} />
                            重新生成
                          </button>
                          {isTruncated(displayContent) && (
                            <button
                              onClick={() => handleContinue(msg)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-2xs font-medium rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-all"
                            >
                              <Play size={10} />
                              继续生成
                            </button>
                          )}
                          {onInsertToEditor && (
                            <button
                              onClick={() => onInsertToEditor(displayContent)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-2xs font-medium rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 transition-all"
                            >
                              <ClipboardPaste size={10} />
                              插入编辑器
                            </button>
                          )}
                          <button
                            onClick={() => handleCopy(displayContent, `ai-${msg.id}`)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-2xs font-medium rounded-lg bg-gray-50 text-gray-700 hover:bg-gray-100 transition-all"
                          >
                            {copiedId === `ai-${msg.id}` ? <Check size={10} /> : <Copy size={10} />}
                            复制
                          </button>
                          <button
                            onClick={() => handleExport(displayContent, 'docx')}
                            className="inline-flex items-center gap-1 px-2 py-1 text-2xs font-medium rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all"
                            title="导出为 Word"
                          >
                            <FileText size={10} />
                            Word
                          </button>
                          <button
                            onClick={() => handleExport(displayContent, 'xlsx')}
                            className="inline-flex items-center gap-1 px-2 py-1 text-2xs font-medium rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-all"
                            title="导出为 Excel"
                          >
                            <Table size={10} />
                            Excel
                          </button>
                          <button
                            onClick={() => handleExport(displayContent, 'pptx')}
                            className="inline-flex items-center gap-1 px-2 py-1 text-2xs font-medium rounded-lg bg-orange-50 text-orange-700 hover:bg-orange-100 transition-all"
                            title="导出为 PowerPoint"
                          >
                            <Presentation size={10} />
                            PPT
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="group/user">
                      {editingMsgId === msg.id ? (
                        <div className="space-y-1.5">
                          <textarea
                            autoFocus
                            value={editingContent}
                            onChange={e => setEditingContent(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleEditAndResend(msg.id, editingContent.trim());
                              } else if (e.key === 'Escape') {
                                setEditingMsgId(null);
                              }
                            }}
                            className="w-full px-2 py-1.5 bg-white/20 border border-white/30 rounded-lg text-xs text-white resize-none focus:outline-none min-h-[36px] max-h-24"
                          />
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleEditAndResend(msg.id, editingContent.trim())}
                              disabled={!editingContent.trim()}
                              className="px-2 py-0.5 text-2xs font-medium bg-white/20 text-white rounded hover:bg-white/30 transition-all disabled:opacity-30"
                            >
                              发送
                            </button>
                            <button
                              onClick={() => setEditingMsgId(null)}
                              className="px-2 py-0.5 text-2xs font-medium text-white/60 rounded hover:text-white transition-all"
                            >
                              取消
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {msg.images && msg.images.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-1.5">
                              {msg.images.map((img: string, i: number) => (
                                <img key={i} src={img} alt="upload" className="max-w-[200px] max-h-[200px] rounded-lg" />
                              ))}
                            </div>
                          )}
                          <div className="flex items-start gap-1.5">
                            {msg.content && <p className="whitespace-pre-wrap text-white flex-1">{msg.content}</p>}
                            {!isProcessing && (
                              <button
                                onClick={() => { setEditingMsgId(msg.id); setEditingContent(msg.content); }}
                                className="shrink-0 opacity-0 group-hover/user:opacity-100 p-0.5 rounded text-white/50 hover:text-white hover:bg-white/20 transition-all"
                                title="编辑消息"
                              >
                                <Edit2 size={10} />
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        <div ref={messagesEndRef} />

        {showScrollBtn && (
          <button
            onClick={scrollToBottom}
            className="sticky bottom-2 left-1/2 -translate-x-1/2 mx-auto flex items-center gap-1 px-3 py-1.5 bg-white/90 border border-teal-900/10 rounded-full text-2xs text-muted hover:text-accent shadow-sm transition-all z-10"
          >
            <ChevronDown size={12} /> 回到底部
          </button>
        )}
      </div>

      <div className="p-3 border-t border-teal-900/10">
        {pendingImages.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {pendingImages.map((img, idx) => (
              <div key={idx} className="relative group/img w-12 h-12">
                <img src={img} alt="preview" className="w-full h-full object-cover rounded-lg border border-teal-900/10" />
                <button
                  type="button"
                  onClick={() => setPendingImages(prev => prev.filter((_, i) => i !== idx))}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity shadow"
                >
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ))}
          </div>
        )}
        <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" multiple className="hidden" />
        <div className="relative">
          {isSlashOpen && (
            <div ref={slashRef} className="absolute bottom-full left-0 right-0 mb-1.5 bg-white border border-gray-100 rounded-xl shadow-lg py-1.5 z-20 max-h-56 overflow-y-auto">
              {suggestions.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    const newInput = input === '/' ? item.prompt : input.replace(/ \/$/, ' ' + item.prompt);
                    setInput(newInput);
                    setIsSlashOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-2xs text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <span className="text-base">{item.icon}</span>
                  <span>{item.label}</span>
                  <span className="ml-auto text-2xs text-gray-300">{item.prompt.slice(0, 20)}...</span>
                </button>
              ))}
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={!aiReady || isProcessing}
            className="p-2 rounded-xl text-gray-400 hover:text-accent hover:bg-accent/5 transition-all shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
            title="上传图片"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </button>
          <textarea
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={aiReady ? '输入问题...' : 'AI 未就绪'}
            disabled={!aiReady || isProcessing}
            rows={1}
            className="flex-1 px-3 py-2 bg-white/60 border border-teal-900/10 rounded-xl text-xs resize-none focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-40 max-h-24 overflow-y-auto"
            style={{ minHeight: '36px' }}
          />
          {isProcessing ? (
            <button
              type="button"
              onClick={handleStop}
              className="p-2 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-all shrink-0"
              title="停止生成"
            >
              <Square size={14} fill="currentColor" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={(!input.trim() && pendingImages.length === 0) || !aiReady}
              className="p-2 rounded-xl bg-accent text-white hover:bg-accent/90 transition-all disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
              onClick={(e) => {
                if ((!input.trim() && pendingImages.length === 0) || !aiReady) {
                  logger.info('[AIChatPanel] Send button disabled:', { 
                    emptyInput: !input.trim(), 
                    noImages: pendingImages.length === 0, 
                    aiNotReady: !aiReady 
                  });
                  e.preventDefault();
                }
              }}
            >
              <Send size={14} />
            </button>
          )}
        </form>
        </div>
      </div>
    </div>
  );
};

export default AIChatPanel;
