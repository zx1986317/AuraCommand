import { v4 as uuidv4 } from 'uuid';
import { useRef } from 'react';
import { getAssistantMessageParts, sanitizeAssistantReasoningText } from '../utils/chat';
import { useAppStore } from '../store/appStore';
import { logger } from '../utils/logger';
import type { ChatMessage, AgentStep } from '../types/chat';
import { loadWebSearchSettings } from '../utils/webSearchSettings';

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

type ChatPhaseData = {
  phase: string;
  retrievedCount?: number;
  webCount?: number;
  currentTool?: number;
  totalTools?: number;
  toolName?: string;
  retryAttempt?: number;
};

export function sanitizeStreamingAssistantText(text: string): string {
  let result = String(text || '')
    .replace(/<think[\s\S]*?<\/think>/gi, '')
    .replace(/<think[\s\S]*$/gi, '')
    .replace(/\[\[TOOL_CALL\]\][\s\S]*?\[\[\/TOOL_CALL\]\]/gi, '')
    .replace(/\[\[TOOL_CALL\]\][\s\S]*$/gi, '')
    .replace(/\[TOOL_CALL\][\s\S]*?\[\/TOOL_CALL\]/gi, '')
    .replace(/\[TOOL_CALL\][\s\S]*$/gi, '')
    .replace(/<tool_call[\s\S]*?<\/tool_call>/gi, '')
    .replace(/<tool_call[\s\S]*$/gi, '')
    .replace(/\n{3,}/g, '\n\n');

  // Close unclosed code fences for streaming rendering
  const fenceCount = (result.match(/^```/gm) || []).length;
  if (fenceCount % 2 !== 0) {
    result += '\n```';
  }

  return result;
}

export function extractMcpRoutingState(data: any): McpRoutingState | null {
  const categoryRouting = Array.isArray(data?.categoryRouting)
    ? data.categoryRouting.filter((r: any) => r?.category && r?.preferredServerId).map((r: any) => ({
        category: String(r.category),
        categoryLabel: String(r.categoryLabel || r.category),
        preferredServerId: String(r.preferredServerId),
        preferredServerName: String(r.preferredMcpServerName || r.preferredServerId),
      }))
    : [];
  const nextState: McpRoutingState = {
    ...(data?.preferredMcpServerId ? { preferredServerId: String(data.preferredMcpServerId) } : {}),
    ...(data?.preferredMcpServerName ? { preferredServerName: String(data.preferredMcpServerName) } : {}),
    ...(data?.lockedMcpServerId ? { lockedServerId: String(data.lockedMcpServerId) } : {}),
    ...(data?.lockedMcpServerName ? { lockedServerName: String(data.lockedMcpServerName) } : {}),
    ...(categoryRouting.length > 0 ? { categoryRouting } : {}),
  };
  return Object.keys(nextState).length > 0 ? nextState : null;
}

interface ChatStreamDeps {
  chatMessages: ChatMessage[];
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  activeSessionId: string | null;
  isChatLoading: boolean;
  setIsChatLoading: React.Dispatch<React.SetStateAction<boolean>>;
  agentSteps: AgentStep[];
  setAgentSteps: React.Dispatch<React.SetStateAction<AgentStep[]>>;
  activeMcpRouting: McpRoutingState | null;
  setActiveMcpRouting: React.Dispatch<React.SetStateAction<McpRoutingState | null>>;
  chatAttachments: Array<{ name: string; text: string; size: number }>;
  setChatAttachments: React.Dispatch<React.SetStateAction<Array<{ name: string; text: string; size: number }>>>;
  chatInput: string;
  setChatInput: React.Dispatch<React.SetStateAction<string>>;
  chatImages: string[];
  setChatImages: React.Dispatch<React.SetStateAction<string[]>>;
  chatContextLength: number;
  manualPreferredMcpServerId: string | null;
  getCurrentSystemPrompt: () => string;
}

export function useChatStream(deps: ChatStreamDeps) {
  const {
    chatMessages, setChatMessages, activeSessionId,
    isChatLoading, setIsChatLoading,
    agentSteps, setAgentSteps,
    activeMcpRouting, setActiveMcpRouting,
    chatAttachments, setChatAttachments,
    chatInput, setChatInput,
    chatImages, setChatImages,
    chatContextLength,
    manualPreferredMcpServerId,
    getCurrentSystemPrompt,
  } = deps;

  const selectedModel = useAppStore(s => s.selectedModel);
  const isRAGEnabled = useAppStore(s => s.isRAGEnabled);
  const chatNetworkMode = useAppStore(s => s.chatNetworkMode);
  const searxngUrl = useAppStore(s => s.searxngUrl);
  const cloudModelIdMap = useAppStore(s => s.cloudModelIdMap);
  const currentProjectName = useAppStore(s => s.currentProjectName);

  const activeCleanupRef = useRef<(() => void) | null>(null);
  const manuallyStoppedRef = useRef(false);
  const streamGenerationRef = useRef(0);

  const getSearchProviders = () => {
    const settings = loadWebSearchSettings();
    return {
      selectedProvider: settings.selectedProvider,
      bochaApiKey: settings.providers.bocha?.bochaApiKey,
      searchMode: settings.searchMode,
    };
  };

  const handleStopChat = async () => {
    manuallyStoppedRef.current = true;

    try {
      // 1. Tell backend to abort
      await window.ipcRenderer.invoke('stop-chat');
    } catch (err) {
      logger.error('Stop chat failed:', err);
    }

    // 2. Clean up frontend state
    activeCleanupRef.current?.();
    activeCleanupRef.current = null;

    // 3. Mark the last assistant message as stopped (not streaming, not error)
    setChatMessages(prev => {
      const lastIdx = prev.length - 1;
      if (lastIdx >= 0 && prev[lastIdx]?.role === 'assistant') {
        const lastMsg = prev[lastIdx]!;
        return [
          ...prev.slice(0, lastIdx),
          {
            ...lastMsg,
            phase: 'completed' as const,
            _rawContent: undefined,
            content: sanitizeStreamingAssistantText(String(lastMsg._rawContent || lastMsg.content || '')),
            toolCalls: ((lastMsg.toolCalls || []) as any[]).map((tc) => ({
              ...tc,
              status: tc.status === 'executing' ? 'done' : tc.status,
            })),
          },
        ];
      }
      return prev;
    });

    // 4. Reset loading state
    setIsChatLoading(false);
  };

  const handleSendMessage = async (overrideMessage?: string) => {
    const inputText = overrideMessage || chatInput;
    const searchProviders = getSearchProviders();
    logger.info('[ChatLogic] handleSendMessage called:', {
      hasInput: !!inputText?.trim(),
      inputLength: inputText?.length,
      hasImages: chatImages.length > 0,
      isChatLoading,
    });
    if ((!inputText.trim() && chatImages.length === 0) || isChatLoading) {
      logger.info('[ChatLogic] handleSendMessage early return');
      return;
    }

    activeCleanupRef.current?.();
    activeCleanupRef.current = null;
    manuallyStoppedRef.current = false;
    streamGenerationRef.current += 1;
    const currentGeneration = streamGenerationRef.current;
    setActiveMcpRouting(null);

    const userMsg = {
      role: 'user',
      content: inputText,
      images: overrideMessage ? [] : [...chatImages],
      id: uuidv4()
    };
    setChatMessages(prev => [...prev, userMsg]);
    if (!overrideMessage) setChatInput('');
    setChatImages([]);
    setChatAttachments([]);
    setIsChatLoading(true);

    try {
      const assistantMsgId = uuidv4();
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: '',
        reasoning: '',
        sources: [],
        id: assistantMsgId,
        phase: 'searching' as const,
        usesRetrieval: chatNetworkMode !== 'off' || isRAGEnabled,
        error: false,
        // P1 #7：给每条 AI 消息打 model badge —— 记录产生该回复的模型和云端条目
        model: selectedModel,
        cloudModelId: cloudModelIdMap[selectedModel] || null,
      }]);

      const updateAssistantMessage = (updater: (message: any) => any) => {
        setChatMessages(prev => prev.map(msg => (
          String(msg.id) === String(assistantMsgId) ? updater(msg) : msg
        )));
      };

      const handleChunk = (_event: any, { chunk, reasoning, agentStep }: { chunk?: string, reasoning?: string, agentStep?: any }) => {
        if (streamGenerationRef.current !== currentGeneration) return;
        if (agentStep) {
          setAgentSteps(prev => [...prev, agentStep]);
        }
        updateAssistantMessage((lastMsg) => {
          const cleanReasoning = sanitizeAssistantReasoningText(reasoning || '');
          const nextRawContent = (lastMsg._rawContent || lastMsg.content || '') + (chunk || '');
          const nextContent = sanitizeStreamingAssistantText(nextRawContent);
          const nextReasoning = (lastMsg.reasoning || '') + cleanReasoning;
          let nextPhase = lastMsg.phase;
          if (cleanReasoning) nextPhase = 'reasoning';
          if (chunk) nextPhase = 'composing';
          return { ...lastMsg, _rawContent: nextRawContent, content: nextContent, reasoning: nextReasoning, phase: nextPhase };
        });
      };

      const handleToolCall = (_event: any, { tool, args }: { tool: string; args: any }) => {
        if (streamGenerationRef.current !== currentGeneration) return;
        const toolNameMap: Record<string, string> = {
          'create_memo': '创建便签',
          'create_schedule': '创建日程',
          'search_knowledge': '搜索知识库',
          'search_memos': '搜索便签',
          'web_search': '联网搜索',
          'clip_web_page': '剪藏网页',
          'generate_image': '生成图片',
        };
        const displayName = toolNameMap[tool] || tool.replace(/^get-/, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        updateAssistantMessage((lastMsg) => ({
          ...lastMsg,
          toolCalls: [...(lastMsg.toolCalls || []), { tool, args, displayName, status: 'executing' as const }]
        }));
      };
      const handleToolResult = (_event: any, { tool, success, message, filePath }: { tool: string; success: boolean; message?: string; filePath?: string }) => {
        if (streamGenerationRef.current !== currentGeneration) return;
        updateAssistantMessage((lastMsg) => {
          const nextToolCalls = [...(lastMsg.toolCalls || [])];
          const targetIndex = nextToolCalls.findIndex((tc: any) => tc.tool === tool && tc.status === 'executing');
          if (targetIndex >= 0) {
            nextToolCalls[targetIndex] = {
              ...nextToolCalls[targetIndex],
              status: success ? 'done' : 'error',
              message: message || nextToolCalls[targetIndex].message,
              ...(filePath ? { filePath } : {}),
            };
          }
          return { ...lastMsg, toolCalls: nextToolCalls };
        });
      };

      const handlePhase = (_event: any, data: { phase: string, retrievedCount?: number, webCount?: number, currentTool?: number, totalTools?: number, toolName?: string, retryAttempt?: number }) => {
        if (streamGenerationRef.current !== currentGeneration) return;
        const routingState = extractMcpRoutingState(data);
        if (routingState) {
          setActiveMcpRouting(routingState);
        }
        updateAssistantMessage((lastMsg) => ({
          ...lastMsg,
          phase: data.phase,
          _retrievedCount: data.retrievedCount,
          _webCount: data.webCount,
          _toolCurrent: data.currentTool,
          _toolTotal: data.totalTools,
          _toolName: data.toolName,
          _toolRetryAttempt: data.retryAttempt,
          ...(routingState?.preferredServerId ? { _preferredMcpServerId: routingState.preferredServerId } : {}),
          ...(routingState?.preferredServerName ? { _preferredMcpServerName: routingState.preferredServerName } : {}),
          ...(routingState?.lockedServerId ? { _lockedMcpServerId: routingState.lockedServerId } : {}),
          ...(routingState?.lockedServerName ? { _lockedMcpServerName: routingState.lockedServerName } : {}),
          ...(routingState?.categoryRouting ? { _categoryRouting: routingState.categoryRouting } : {}),
        }));
      };

      const handleFallback = (_event: any, { from, to, message }: { from: string; to: string; message: string }) => {
        if (streamGenerationRef.current !== currentGeneration) return;
        updateAssistantMessage((lastMsg) => {
          const fallbackText = `\n> ⚠️ 模型降级：${message}\n\n`;
          const nextRawContent = (lastMsg._rawContent || lastMsg.content || '') + fallbackText;
          const nextContent = sanitizeStreamingAssistantText(nextRawContent);
          return { ...lastMsg, _rawContent: nextRawContent, content: nextContent, phase: 'fallback' };
        });
      };

      const cleanupStreamListeners = () => {
        window.ipcRenderer.off('chat-phase', handlePhase);
        window.ipcRenderer.off('chat-chunk', handleChunk);
        window.ipcRenderer.off('chat-end', handleEnd);
        window.ipcRenderer.off('chat-error', handleError);
        window.ipcRenderer.off('tool-call', handleToolCall);
        window.ipcRenderer.off('tool-result', handleToolResult);
        window.ipcRenderer.off('chat-fallback', handleFallback);
      };

      const handleEnd = (_event: any, data?: { sources?: any[]; finalContent?: string }) => {
        if (streamGenerationRef.current !== currentGeneration) { cleanupStreamListeners(); return; }
        if (manuallyStoppedRef.current) { cleanupStreamListeners(); return; }
        updateAssistantMessage((lastMsg) => ({
          ...lastMsg,
          content: data?.finalContent ?? sanitizeStreamingAssistantText(lastMsg._rawContent || lastMsg.content),
          _rawContent: undefined,
          phase: lastMsg.error ? 'error' : 'completed',
          sources: data?.sources || lastMsg.sources || [],
          toolCalls: (lastMsg.toolCalls || []).map((tc: any) => ({ ...tc, status: tc.status === 'executing' ? 'done' : tc.status }))
        }));
        setIsChatLoading(false);
        cleanupStreamListeners();

        setChatMessages(prev => {
          const latestMsg = prev.find(msg => String(msg.id) === String(assistantMsgId));
          if (latestMsg && latestMsg.role === 'assistant' && !latestMsg.error) {
            const assistantParts = getAssistantMessageParts(latestMsg);
            const content = assistantParts?.answer || latestMsg.content;
            if (content && content.length > 10) {
              window.ipcRenderer.invoke('auto-tag-message', {
                messageId: latestMsg.id,
                content: content.substring(0, 500),
                model: selectedModel,
                cloudModelId: cloudModelIdMap[selectedModel],
              }).then((result: any) => {
                if (result.success && result.tags.length > 0) {
                  setChatMessages(inner => inner.map(msg =>
                    msg.id === latestMsg.id ? { ...msg, tags: result.tags } : msg
                  ));
                }
              }).catch((err: any) => {
                logger.error('Auto-tag failed:', err);
              });
            }
          }
          return prev;
        });
      };

      const handleError = (_event: any, { message }: { message: string }) => {
        if (streamGenerationRef.current !== currentGeneration) { cleanupStreamListeners(); return; }
        if (manuallyStoppedRef.current) { cleanupStreamListeners(); return; }
        updateAssistantMessage((lastMsg) => ({
          ...lastMsg,
          content: `抱歉，流式输出出现错误：${message}`,
          phase: 'error',
          error: true
        }));
        setIsChatLoading(false);
        cleanupStreamListeners();
      };

      window.ipcRenderer.on('chat-phase', handlePhase);
      window.ipcRenderer.on('chat-chunk', handleChunk);
      window.ipcRenderer.on('chat-end', handleEnd);
      window.ipcRenderer.on('chat-error', handleError);
      window.ipcRenderer.on('tool-call', handleToolCall);
      window.ipcRenderer.on('tool-result', handleToolResult);
      window.ipcRenderer.on('chat-fallback', handleFallback);
      activeCleanupRef.current = cleanupStreamListeners;

      window.ipcRenderer.invoke('chat-with-kb', {
        query: userMsg.content,
        model: selectedModel,
        sessionId: activeSessionId,
        history: [...chatMessages, userMsg].slice(-chatContextLength).map(m => ({
          role: m.role,
          content: m.content,
        })),
        searchEnabled: chatNetworkMode !== 'off',
        ragEnabled: isRAGEnabled,
        searxngUrl,
        searchProviders,
        images: userMsg.images.map(img => img.split(',')[1]),
        systemPrompt: getCurrentSystemPrompt(),
        agentEnabled: chatNetworkMode !== 'off',
        cloudModelId: cloudModelIdMap[selectedModel],
        projectName: currentProjectName || undefined,
        ...(chatAttachments.length > 0 ? { attachments: chatAttachments.map(a => ({ name: a.name, text: a.text })) } : {}),
        ...(manualPreferredMcpServerId ? { preferredMcpServerId: manualPreferredMcpServerId } : {}),
      }).catch((invokeErr: any) => {
        handleError(null, { message: invokeErr?.message || '请求失败' });
      });

    } catch (err: any) {
      const errMsg = err.message || '未知错误';
      const isOllamaDown = errMsg.includes('ECONNREFUSED') || errMsg.includes('fetch failed') || errMsg.includes('Failed to fetch') || errMsg.includes('net::ERR_CONNECTION_REFUSED');
      const isCloudError = errMsg.includes('云端模型') || errMsg.includes('API Key') || errMsg.includes('401') || errMsg.includes('403') || errMsg.includes('cloud');
      let fallbackMsg: string;
      if (isOllamaDown) {
        fallbackMsg = '⚠️ AI 引擎未连接 — Ollama 服务似乎未启动。请在终端运行 `ollama serve` 后重试。';
      } else if (isCloudError) {
        fallbackMsg = `⚠️ 云端模型调用失败：${errMsg}。请检查 API Key 和网络连接。`;
      } else {
        fallbackMsg = `抱歉，启动对话失败：${errMsg}`;
      }
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: fallbackMsg,
        phase: 'error',
        error: true,
        // P1 #7：失败消息也打 model badge（用户能看到哪个模型炸了）
        model: selectedModel,
        cloudModelId: cloudModelIdMap[selectedModel] || null,
      }]);
      setIsChatLoading(false);
    }
  };

  const handleSaveEditAndRegenerate = async (
    editingMessageId: string | null,
    editingMessageContent: string,
  ) => {
    if (!editingMessageId) return;
    const searchProviders = getSearchProviders();

    const msgIndex = chatMessages.findIndex(m => m.id === editingMessageId);
    if (msgIndex === -1) return;
    const updatedMessages = [...chatMessages];
    updatedMessages[msgIndex] = { ...updatedMessages[msgIndex], content: editingMessageContent };
    const newMessages = updatedMessages.slice(0, msgIndex + 1);
    setChatMessages(newMessages);
    setChatInput('');
    setActiveMcpRouting(null);
    const history = newMessages.slice(0, -1).map(m => ({
      role: m.role,
      content: m.content,
    }));
    setIsChatLoading(true);
    try {
      const assistantMsgId = uuidv4();
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: '',
        reasoning: '',
        sources: [],
        id: assistantMsgId,
        phase: 'searching' as const,
        usesRetrieval: chatNetworkMode !== 'off' || isRAGEnabled,
        error: false,
        // P1 #7：给每条 AI 消息打 model badge —— 记录产生该回复的模型和云端条目
        model: selectedModel,
        cloudModelId: cloudModelIdMap[selectedModel] || null,
      }]);
      const updateAssistantMessage = (updater: (message: any) => any) => {
        setChatMessages(prev => prev.map(msg => (
          String(msg.id) === String(assistantMsgId) ? updater(msg) : msg
        )));
      };
      const handlePhase = (_event: any, data: ChatPhaseData) => {
        const routingState = extractMcpRoutingState(data);
        if (routingState) {
          setActiveMcpRouting(routingState);
        }
        updateAssistantMessage((lastMsg) => ({
          ...lastMsg,
          phase: data.phase,
          _retrievedCount: data.retrievedCount,
          _webCount: data.webCount,
          _toolCurrent: data.currentTool,
          _toolTotal: data.totalTools,
          _toolName: data.toolName,
          _toolRetryAttempt: data.retryAttempt,
          ...(routingState?.preferredServerId ? { _preferredMcpServerId: routingState.preferredServerId } : {}),
          ...(routingState?.preferredServerName ? { _preferredMcpServerName: routingState.preferredServerName } : {}),
          ...(routingState?.lockedServerId ? { _lockedMcpServerId: routingState.lockedServerId } : {}),
          ...(routingState?.lockedServerName ? { _lockedMcpServerName: routingState.lockedServerName } : {}),
          ...(routingState?.categoryRouting ? { _categoryRouting: routingState.categoryRouting } : {}),
        }));
      };
      const handleChunk = (_event: any, { chunk, reasoning }: { chunk?: string, reasoning?: string }) => {
        updateAssistantMessage((lastMsg) => {
          const cleanReasoning = sanitizeAssistantReasoningText(reasoning || '');
          const nextRawContent = (lastMsg._rawContent || lastMsg.content || '') + (chunk || '');
          const nextContent = sanitizeStreamingAssistantText(nextRawContent);
          const nextReasoning = (lastMsg.reasoning || '') + cleanReasoning;
          let nextPhase = lastMsg.phase;
          if (cleanReasoning) nextPhase = 'reasoning';
          if (chunk) nextPhase = 'composing';
          return { ...lastMsg, _rawContent: nextRawContent, content: nextContent, reasoning: nextReasoning, phase: nextPhase };
        });
      };
      const handleToolCall = (_event: any, { tool, args }: { tool: string; args: any }) => {
        const toolNameMap: Record<string, string> = {
          'create_memo': '创建便签',
          'create_schedule': '创建日程',
          'search_knowledge': '搜索知识库',
          'search_memos': '搜索便签',
          'web_search': '联网搜索',
          'clip_web_page': '剪藏网页',
          'generate_image': '生成图片',
        };
        const displayName = toolNameMap[tool] || tool.replace(/^get-/, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        updateAssistantMessage((lastMsg) => ({
          ...lastMsg,
          toolCalls: [...(lastMsg.toolCalls || []), { tool, args, displayName, status: 'executing' as const }]
        }));
      };
      const handleToolResult = (_event: any, { tool, success, message, filePath }: { tool: string; success: boolean; message?: string; filePath?: string }) => {
        updateAssistantMessage((lastMsg) => {
          const nextToolCalls = [...(lastMsg.toolCalls || [])];
          const targetIndex = nextToolCalls.findIndex((tc: any) => tc.tool === tool && tc.status === 'executing');
          if (targetIndex >= 0) {
            nextToolCalls[targetIndex] = {
              ...nextToolCalls[targetIndex],
              status: success ? 'done' : 'error',
              message: message || nextToolCalls[targetIndex].message,
              ...(filePath ? { filePath } : {}),
            };
          }
          return { ...lastMsg, toolCalls: nextToolCalls };
        });
      };
      const handleFallback = (_event: any, { from, to, message }: { from: string; to: string; message: string }) => {
        updateAssistantMessage((lastMsg) => {
          const fallbackText = `\n> ⚠️ 模型降级：${message}\n\n`;
          const nextRawContent = (lastMsg._rawContent || lastMsg.content || '') + fallbackText;
          const nextContent = sanitizeStreamingAssistantText(nextRawContent);
          return { ...lastMsg, _rawContent: nextRawContent, content: nextContent, phase: 'fallback' };
        });
      };
      const cleanupStreamListeners = () => {
        window.ipcRenderer.off('chat-phase', handlePhase);
        window.ipcRenderer.off('chat-chunk', handleChunk);
        window.ipcRenderer.off('chat-end', handleEnd);
        window.ipcRenderer.off('chat-error', handleError);
        window.ipcRenderer.off('tool-call', handleToolCall);
        window.ipcRenderer.off('tool-result', handleToolResult);
        window.ipcRenderer.off('chat-fallback', handleFallback);
      };
      const handleEnd = (_event: any, data?: { sources?: any[]; finalContent?: string }) => {
        if (manuallyStoppedRef.current) { cleanupStreamListeners(); return; }
        updateAssistantMessage((lastMsg) => ({
          ...lastMsg,
          content: data?.finalContent ?? sanitizeStreamingAssistantText(lastMsg._rawContent || lastMsg.content),
          _rawContent: undefined,
          phase: lastMsg.error ? 'error' : 'completed',
          sources: data?.sources || lastMsg.sources || [],
          toolCalls: (lastMsg.toolCalls || []).map((tc: any) => ({ ...tc, status: tc.status === 'executing' ? 'done' : tc.status }))
        }));
        setIsChatLoading(false);
        cleanupStreamListeners();
      };
      const handleError = (_event: any, { message }: { message: string }) => {
        if (manuallyStoppedRef.current) { cleanupStreamListeners(); return; }
        updateAssistantMessage((lastMsg) => ({
          ...lastMsg,
          content: `抱歉，流式输出出现错误：${message}`,
          phase: 'error',
          error: true
        }));
        setIsChatLoading(false);
        cleanupStreamListeners();
      };
      window.ipcRenderer.on('chat-phase', handlePhase);
      window.ipcRenderer.on('chat-chunk', handleChunk);
      window.ipcRenderer.on('chat-end', handleEnd);
      window.ipcRenderer.on('chat-error', handleError);
      window.ipcRenderer.on('tool-call', handleToolCall);
      window.ipcRenderer.on('tool-result', handleToolResult);
      window.ipcRenderer.on('chat-fallback', handleFallback);
      activeCleanupRef.current = cleanupStreamListeners;
      await window.ipcRenderer.invoke('chat-with-kb', {
        query: editingMessageContent,
        model: selectedModel,
        sessionId: activeSessionId,
        history,
        searchEnabled: chatNetworkMode !== 'off',
        ragEnabled: isRAGEnabled,
        searxngUrl,
        searchProviders,
        agentEnabled: chatNetworkMode !== 'off',
        systemPrompt: getCurrentSystemPrompt(),
        cloudModelId: cloudModelIdMap[selectedModel],
        projectName: currentProjectName || undefined,
        ...(manualPreferredMcpServerId ? { preferredMcpServerId: manualPreferredMcpServerId } : {}),
      });
    } catch (err: any) {
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: `抱歉，重新生成失败：${err.message}`,
        phase: 'error',
        error: true,
        // P1 #7：错误消息也带上 model 信息
        model: selectedModel,
        cloudModelId: cloudModelIdMap[selectedModel] || null,
      }]);
      setIsChatLoading(false);
    }
  };

  const handleRegenerateResponse = async (messageId: string) => {
    const searchProviders = getSearchProviders();

    const msgIndex = chatMessages.findIndex(m => m.id === messageId);
    if (msgIndex === -1) return;
    const previousUserMsg = chatMessages.slice(0, msgIndex).reverse().find(m => m.role === 'user');
    if (!previousUserMsg) return;
    const newMessages = chatMessages.slice(0, msgIndex);
    setChatMessages(newMessages);
    setChatInput('');
    setActiveMcpRouting(null);
    setIsChatLoading(true);
    try {
      const assistantMsgId = uuidv4();
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: '',
        reasoning: '',
        sources: [],
        id: assistantMsgId,
        phase: 'searching' as const,
        usesRetrieval: chatNetworkMode !== 'off' || isRAGEnabled,
        error: false,
        // P1 #7：给每条 AI 消息打 model badge —— 记录产生该回复的模型和云端条目
        model: selectedModel,
        cloudModelId: cloudModelIdMap[selectedModel] || null,
      }]);
      const updateAssistantMessage = (updater: (message: any) => any) => {
        setChatMessages(prev => prev.map(msg => (
          String(msg.id) === String(assistantMsgId) ? updater(msg) : msg
        )));
      };
      const handlePhase = (_event: any, data: ChatPhaseData) => {
        const routingState = extractMcpRoutingState(data);
        if (routingState) {
          setActiveMcpRouting(routingState);
        }
        updateAssistantMessage((lastMsg) => ({
          ...lastMsg,
          phase: data.phase,
          _retrievedCount: data.retrievedCount,
          _webCount: data.webCount,
          _toolCurrent: data.currentTool,
          _toolTotal: data.totalTools,
          _toolName: data.toolName,
          _toolRetryAttempt: data.retryAttempt,
          ...(routingState?.preferredServerId ? { _preferredMcpServerId: routingState.preferredServerId } : {}),
          ...(routingState?.preferredServerName ? { _preferredMcpServerName: routingState.preferredServerName } : {}),
          ...(routingState?.lockedServerId ? { _lockedMcpServerId: routingState.lockedServerId } : {}),
          ...(routingState?.lockedServerName ? { _lockedMcpServerName: routingState.lockedServerName } : {}),
          ...(routingState?.categoryRouting ? { _categoryRouting: routingState.categoryRouting } : {}),
        }));
      };
      const handleChunk = (_event: any, { chunk, reasoning }: { chunk?: string, reasoning?: string }) => {
        updateAssistantMessage((lastMsg) => {
          const cleanReasoning = sanitizeAssistantReasoningText(reasoning || '');
          const nextRawContent = (lastMsg._rawContent || lastMsg.content || '') + (chunk || '');
          const nextContent = sanitizeStreamingAssistantText(nextRawContent);
          const nextReasoning = (lastMsg.reasoning || '') + cleanReasoning;
          let nextPhase = lastMsg.phase;
          if (cleanReasoning) nextPhase = 'reasoning';
          if (chunk) nextPhase = 'composing';
          return { ...lastMsg, _rawContent: nextRawContent, content: nextContent, reasoning: nextReasoning, phase: nextPhase };
        });
      };
      const handleToolCall = (_event: any, { tool, args }: { tool: string; args: any }) => {
        const toolNameMap: Record<string, string> = {
          'create_memo': '创建便签',
          'create_schedule': '创建日程',
          'search_knowledge': '搜索知识库',
          'search_memos': '搜索便签',
          'web_search': '联网搜索',
          'clip_web_page': '剪藏网页',
          'generate_image': '生成图片',
        };
        const displayName = toolNameMap[tool] || tool.replace(/^get-/, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        updateAssistantMessage((lastMsg) => ({
          ...lastMsg,
          toolCalls: [...(lastMsg.toolCalls || []), { tool, args, displayName, status: 'executing' as const }]
        }));
      };
      const handleToolResult = (_event: any, { tool, success, message }: { tool: string; success: boolean; message?: string }) => {
        updateAssistantMessage((lastMsg) => {
          const nextToolCalls = [...(lastMsg.toolCalls || [])];
          const targetIndex = nextToolCalls.findIndex((tc: any) => tc.tool === tool && tc.status === 'executing');
          if (targetIndex >= 0) {
            nextToolCalls[targetIndex] = {
              ...nextToolCalls[targetIndex],
              status: success ? 'done' : 'error',
              message: message || nextToolCalls[targetIndex].message,
            };
          }
          return { ...lastMsg, toolCalls: nextToolCalls };
        });
      };
      const handleFallback = (_event: any, { from, to, message }: { from: string; to: string; message: string }) => {
        updateAssistantMessage((lastMsg) => {
          const fallbackText = `\n> ⚠️ 模型降级：${message}\n\n`;
          const nextRawContent = (lastMsg._rawContent || lastMsg.content || '') + fallbackText;
          const nextContent = sanitizeStreamingAssistantText(nextRawContent);
          return { ...lastMsg, _rawContent: nextRawContent, content: nextContent, phase: 'fallback' };
        });
      };
      const cleanupStreamListeners = () => {
        window.ipcRenderer.off('chat-phase', handlePhase);
        window.ipcRenderer.off('chat-chunk', handleChunk);
        window.ipcRenderer.off('chat-end', handleEnd);
        window.ipcRenderer.off('chat-error', handleError);
        window.ipcRenderer.off('tool-call', handleToolCall);
        window.ipcRenderer.off('tool-result', handleToolResult);
        window.ipcRenderer.off('chat-fallback', handleFallback);
      };
      const handleEnd = (_event: any, data?: { sources?: any[]; finalContent?: string }) => {
        if (manuallyStoppedRef.current) { cleanupStreamListeners(); return; }
        updateAssistantMessage((lastMsg) => ({
          ...lastMsg,
          content: data?.finalContent ?? sanitizeStreamingAssistantText(lastMsg._rawContent || lastMsg.content),
          _rawContent: undefined,
          phase: lastMsg.error ? 'error' : 'completed',
          sources: data?.sources || lastMsg.sources || [],
          toolCalls: (lastMsg.toolCalls || []).map((tc: any) => ({ ...tc, status: tc.status === 'executing' ? 'done' : tc.status }))
        }));
        setIsChatLoading(false);
        cleanupStreamListeners();
      };
      const handleError = (_event: any, { message }: { message: string }) => {
        if (manuallyStoppedRef.current) { cleanupStreamListeners(); return; }
        updateAssistantMessage((lastMsg) => ({
          ...lastMsg,
          content: `抱歉，流式输出出现错误：${message}`,
          phase: 'error',
          error: true
        }));
        setIsChatLoading(false);
        cleanupStreamListeners();
      };
      window.ipcRenderer.on('chat-phase', handlePhase);
      window.ipcRenderer.on('chat-chunk', handleChunk);
      window.ipcRenderer.on('chat-end', handleEnd);
      window.ipcRenderer.on('chat-error', handleError);
      window.ipcRenderer.on('tool-call', handleToolCall);
      window.ipcRenderer.on('tool-result', handleToolResult);
      window.ipcRenderer.on('chat-fallback', handleFallback);
      activeCleanupRef.current = cleanupStreamListeners;
      const history = newMessages.slice(-chatContextLength).map(m => ({
        role: m.role,
        content: m.content,
      }));
      await window.ipcRenderer.invoke('chat-with-kb', {
        query: previousUserMsg.content,
        model: selectedModel,
        sessionId: activeSessionId,
        history,
        searchEnabled: chatNetworkMode !== 'off',
        ragEnabled: isRAGEnabled,
        searxngUrl,
        searchProviders,
        agentEnabled: chatNetworkMode !== 'off',
        systemPrompt: getCurrentSystemPrompt(),
        cloudModelId: cloudModelIdMap[selectedModel],
        projectName: currentProjectName || undefined,
        ...(manualPreferredMcpServerId ? { preferredMcpServerId: manualPreferredMcpServerId } : {}),
      });
    } catch (err: any) {
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: `抱歉，重新生成失败：${err.message}`,
        phase: 'error',
        error: true,
        // P1 #7：错误消息也带上 model 信息
        model: selectedModel,
        cloudModelId: cloudModelIdMap[selectedModel] || null,
      }]);
      setIsChatLoading(false);
    }
  };

  const handleContinueResponse = async (messageId: string) => {
    const searchProviders = getSearchProviders();
    const msgIndex = chatMessages.findIndex(m => String(m.id) === String(messageId));
    if (msgIndex === -1 || isChatLoading) return;

    const targetMessage = chatMessages[msgIndex];
    if (!targetMessage || targetMessage.role !== 'assistant') return;

    const continuePrompt = '请继续输出，从你上次中断的地方继续，不要重复已输出的内容。';
    const history = chatMessages.slice(0, msgIndex + 1).map(m => ({
      role: m.role,
      content: m.content,
    }));

    setActiveMcpRouting(null);
    setIsChatLoading(true);

    const updateAssistantMessage = (updater: (message: any) => any) => {
      setChatMessages(prev => prev.map(msg => (
        String(msg.id) === String(messageId) ? updater(msg) : msg
      )));
    };

    updateAssistantMessage((lastMsg) => ({
      ...lastMsg,
      _rawContent: lastMsg.content || '',
      phase: 'composing',
      error: false,
    }));

    const handlePhase = (_event: any, data: ChatPhaseData) => {
      const routingState = extractMcpRoutingState(data);
      if (routingState) {
        setActiveMcpRouting(routingState);
      }
      updateAssistantMessage((lastMsg) => ({
        ...lastMsg,
        phase: data.phase,
        _retrievedCount: data.retrievedCount,
        _webCount: data.webCount,
        _toolCurrent: data.currentTool,
        _toolTotal: data.totalTools,
        _toolName: data.toolName,
        _toolRetryAttempt: data.retryAttempt,
        ...(routingState?.preferredServerId ? { _preferredMcpServerId: routingState.preferredServerId } : {}),
        ...(routingState?.preferredServerName ? { _preferredMcpServerName: routingState.preferredServerName } : {}),
        ...(routingState?.lockedServerId ? { _lockedMcpServerId: routingState.lockedServerId } : {}),
        ...(routingState?.lockedServerName ? { _lockedMcpServerName: routingState.lockedServerName } : {}),
        ...(routingState?.categoryRouting ? { _categoryRouting: routingState.categoryRouting } : {}),
      }));
    };

    const handleChunk = (_event: any, { chunk, reasoning }: { chunk?: string, reasoning?: string }) => {
      updateAssistantMessage((lastMsg) => {
        const cleanReasoning = sanitizeAssistantReasoningText(reasoning || '');
        const nextRawContent = (lastMsg._rawContent || lastMsg.content || '') + (chunk || '');
        const nextContent = sanitizeStreamingAssistantText(nextRawContent);
        const nextReasoning = (lastMsg.reasoning || '') + cleanReasoning;
        let nextPhase = lastMsg.phase;
        if (cleanReasoning) nextPhase = 'reasoning';
        if (chunk) nextPhase = 'composing';
        return { ...lastMsg, _rawContent: nextRawContent, content: nextContent, reasoning: nextReasoning, phase: nextPhase };
      });
    };

    const handleToolCall = (_event: any, { tool, args }: { tool: string; args: any }) => {
      const toolNameMap: Record<string, string> = {
        'create_memo': '创建便签',
        'create_schedule': '创建日程',
        'search_knowledge': '搜索知识库',
        'search_memos': '搜索便签',
        'web_search': '联网搜索',
        'clip_web_page': '剪藏网页',
        'generate_image': '生成图片',
      };
      const displayName = toolNameMap[tool] || tool.replace(/^get-/, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      updateAssistantMessage((lastMsg) => ({
        ...lastMsg,
        toolCalls: [...(lastMsg.toolCalls || []), { tool, args, displayName, status: 'executing' as const }]
      }));
    };

    const handleToolResult = (_event: any, { tool, success, message }: { tool: string; success: boolean; message?: string }) => {
      updateAssistantMessage((lastMsg) => {
        const nextToolCalls = [...(lastMsg.toolCalls || [])];
        const targetIndex = nextToolCalls.findIndex((tc: any) => tc.tool === tool && tc.status === 'executing');
        if (targetIndex >= 0) {
          nextToolCalls[targetIndex] = {
            ...nextToolCalls[targetIndex],
            status: success ? 'done' : 'error',
            message: message || nextToolCalls[targetIndex].message,
          };
        }
        return { ...lastMsg, toolCalls: nextToolCalls };
      });
    };

    const handleFallback = (_event: any, { from, to, message }: { from: string; to: string; message: string }) => {
      updateAssistantMessage((lastMsg) => {
        const fallbackText = `\n> ⚠️ 模型降级：${message}\n\n`;
        const nextRawContent = (lastMsg._rawContent || lastMsg.content || '') + fallbackText;
        const nextContent = sanitizeStreamingAssistantText(nextRawContent);
        return { ...lastMsg, _rawContent: nextRawContent, content: nextContent, phase: 'fallback' };
      });
    };

    const cleanupStreamListeners = () => {
      window.ipcRenderer.off('chat-phase', handlePhase);
      window.ipcRenderer.off('chat-chunk', handleChunk);
      window.ipcRenderer.off('chat-end', handleEnd);
      window.ipcRenderer.off('chat-error', handleError);
      window.ipcRenderer.off('tool-call', handleToolCall);
      window.ipcRenderer.off('tool-result', handleToolResult);
      window.ipcRenderer.off('chat-fallback', handleFallback);
    };

    const handleEnd = async (_event: any, data?: { sources?: any[]; finalContent?: string }) => {
      if (manuallyStoppedRef.current) { cleanupStreamListeners(); return; }
      let persistedContent = '';
      let persistedSources: any[] = [];
      updateAssistantMessage((lastMsg) => {
        persistedContent = sanitizeStreamingAssistantText(lastMsg._rawContent || lastMsg.content || '');
        persistedSources = data?.sources || lastMsg.sources || [];
        return {
          ...lastMsg,
          content: persistedContent,
          _rawContent: undefined,
          phase: lastMsg.error ? 'error' : 'completed',
          sources: persistedSources,
          toolCalls: (lastMsg.toolCalls || []).map((tc: any) => ({ ...tc, status: tc.status === 'executing' ? 'done' : tc.status }))
        };
      });
      try {
        await window.ipcRenderer.invoke('update-chat-message', {
          messageId,
          content: persistedContent,
          sources: persistedSources,
        });
      } catch (err) {
        logger.error('Continue persist failed:', err);
      }
      setIsChatLoading(false);
      cleanupStreamListeners();
    };

    const handleError = (_event: any, { message }: { message: string }) => {
      if (manuallyStoppedRef.current) { cleanupStreamListeners(); return; }
      updateAssistantMessage((lastMsg) => ({
        ...lastMsg,
        phase: 'error',
        error: true,
        _rawContent: undefined,
      }));
      logger.error('Continue generation failed:', message);
      setIsChatLoading(false);
      cleanupStreamListeners();
    };

    window.ipcRenderer.on('chat-phase', handlePhase);
    window.ipcRenderer.on('chat-chunk', handleChunk);
    window.ipcRenderer.on('chat-end', handleEnd);
    window.ipcRenderer.on('chat-error', handleError);
    window.ipcRenderer.on('tool-call', handleToolCall);
    window.ipcRenderer.on('tool-result', handleToolResult);
    window.ipcRenderer.on('chat-fallback', handleFallback);
    activeCleanupRef.current = cleanupStreamListeners;

    try {
      await window.ipcRenderer.invoke('chat-with-kb', {
        query: continuePrompt,
        model: selectedModel,
        sessionId: activeSessionId,
        history: history.slice(-chatContextLength),
        searchEnabled: chatNetworkMode !== 'off',
        ragEnabled: isRAGEnabled,
        searxngUrl,
        searchProviders,
        images: [],
        systemPrompt: getCurrentSystemPrompt(),
        agentEnabled: chatNetworkMode !== 'off',
        noPersist: true,
        cloudModelId: cloudModelIdMap[selectedModel],
        projectName: currentProjectName || undefined,
        ...(manualPreferredMcpServerId ? { preferredMcpServerId: manualPreferredMcpServerId } : {}),
      });
    } catch (invokeErr: any) {
      handleError(null, { message: invokeErr?.message || '继续生成失败' });
    }
  };

  const cleanupAllStreamListeners = () => {
    if (activeCleanupRef.current) {
      activeCleanupRef.current();
      activeCleanupRef.current = null;
    }
  };

  return {
    handleSendMessage,
    handleSaveEditAndRegenerate,
    handleRegenerateResponse,
    handleContinueResponse,
    handleStopChat,
    cleanupAllStreamListeners,
  };
}
