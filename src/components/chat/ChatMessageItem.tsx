import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  BrainCircuit, ChevronDown, ChevronRight,
  Check, Copy, RotateCcw, Download, Edit2, Bookmark, RotateCw, Zap, Wrench
} from 'lucide-react';
import { getAssistantMessageParts, inferAssistantPhase, getAssistantPhaseLabel, getAssistantPhaseClasses, isLikelyIncompleteAssistantAnswer } from '../../utils/chat';
import { logger } from '../../utils/logger';
import { CodeBlockRenderer } from '../CodeBlockRenderer';
import { MarkdownImage } from './ImagePreview';

const copiedIdAffectsMessage = (copiedId: string | null, messageId: string, idx: number) => {
  if (!copiedId) return false;
  return copiedId === `chat-${idx}` || copiedId.startsWith(`code-${messageId}-`);
};

const getRelevantCopiedId = (copiedId: string | null, messageId: string, idx: number) => (
  copiedIdAffectsMessage(copiedId, messageId, idx) ? copiedId : null
);

const getStableCodeBlockId = (messageId: string, language: string, codeContent: string, node: any) => {
  const positionKey = node?.position?.start?.offset ?? node?.position?.start?.line ?? 0;
  return `code-${messageId}-${language}-${positionKey}-${codeContent.length}`;
};

interface AssistantMarkdownContentProps {
  messageId: string;
  answer: string;
  copiedId: string | null;
  isStreaming: boolean;
  onCopy: (content: string, id: string) => void;
  onOpenInCanvas?: ((htmlContent: string, title?: string) => void) | undefined;
  isCanvasOpen?: boolean | undefined;
}

const AssistantMarkdownContent: React.FC<AssistantMarkdownContentProps> = React.memo(({
  messageId,
  answer,
  copiedId,
  isStreaming,
  onCopy,
  onOpenInCanvas,
  isCanvasOpen,
}) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    components={{
      a({ href, children, ...props }) {
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
      code({ node, className, children, ...props }) {
        const match = /language-([\w+#+-]+)/.exec(className || '');
        const codeStr = String(children).replace(/\n$/, '');
        const isBlock = !!match || codeStr.includes('\n');

        if (isBlock) {
          return (
            <CodeBlockRenderer
              language={match?.[1] || 'text'}
              codeContent={codeStr}
              codeId={getStableCodeBlockId(messageId, match?.[1] || 'text', codeStr, node)}
              copiedCodeId={copiedId}
              isStreaming={isStreaming}
              onCopy={(id, text) => onCopy(text, id)}
              onOpenInCanvas={onOpenInCanvas}
              isCanvasOpen={isCanvasOpen}
            />
          );
        }

        return <code className="bg-black/5 px-1.5 py-0.5 rounded-md text-accent font-mono text-sm" {...props}>{children}</code>;
      },
      img({ src, alt }) {
        return <MarkdownImage src={src} alt={alt} />;
      }
    }}
  >
    {answer}
  </ReactMarkdown>
));

interface ChatMessageItemProps {
  msg: any;
  idx: number;
  isLastInList: boolean;
  isChatLoading: boolean;
  agentSteps: any[];
  showReasoningProcess: boolean;
  expandedReasoningMessages: Record<string, boolean>;
  copiedId: string | null;
  editingMessageId: string | null;
  editingMessageContent: string;
  editingIdx: number | null;
  editContent: string;
  onCopy: (content: string, id: string) => void;
  onContinueMessage: (messageId: string) => void;
  onOpenInCanvas?: ((htmlContent: string, title?: string) => void) | undefined;
  isCanvasOpen?: boolean | undefined;
  onEditMessage: (id: string, content: string) => void;
  onCancelEdit: () => void;
  onSaveEditAndRegenerate: (id: string, content: string) => void;
  onRegenerateResponse: (id: string) => void;
  onBranchMessage: (id: string, direction: 'prev' | 'next') => void;
  onToggleBookmark: (messageId: string, currentBookmarked: boolean) => void;
  onExtractTodos: (msg: any) => void;
  onToggleReasoning: (msgId: string) => void;
  onSetChatMessages: (msgs: any[] | ((prev: any[]) => any[])) => void;
  onSetEditingIdx: (idx: number | null) => void;
  onSetEditContent: (content: string) => void;
}

const ChatMessageItem: React.FC<ChatMessageItemProps> = ({
  msg, idx, isLastInList, isChatLoading, agentSteps,
  showReasoningProcess, expandedReasoningMessages, copiedId,
  editingMessageId, editingMessageContent, editingIdx, editContent,
  onCopy, onContinueMessage, onOpenInCanvas, isCanvasOpen, onEditMessage, onCancelEdit, onSaveEditAndRegenerate,
  onRegenerateResponse, onBranchMessage, onToggleBookmark, onExtractTodos,
  onToggleReasoning, onSetChatMessages, onSetEditingIdx, onSetEditContent
}) => {
  const assistantParts = msg.role === 'assistant' ? getAssistantMessageParts(msg) : undefined;
  const answerContent = assistantParts?.answer || '';
  const copyContent = msg.role === 'assistant' ? answerContent : msg.content;
  const isStreaming = msg.role === 'assistant' && isLastInList && isChatLoading;
  const messageId = String(msg.id ?? idx);
  const relevantCopiedId = getRelevantCopiedId(copiedId, messageId, idx);
  const phase = msg.role === 'assistant' ? inferAssistantPhase(msg, isStreaming, assistantParts ?? null) : null;
  const phaseLabel = msg.role === 'assistant' ? getAssistantPhaseLabel(msg, phase) : '';
  const reasoningExpanded = isStreaming ? true : (expandedReasoningMessages[messageId] ?? false);
  const reasoningText = (assistantParts?.reasoning || '').slice(0, 500);
  const [toolCallsExpanded, setToolCallsExpanded] = React.useState(false);
  const toolCalls: Array<{ tool: string; args: any; displayName: string; status: string; message?: string; filePath?: string }> = msg.toolCalls || [];
  const hasExecutingTools = toolCalls.some(tc => tc.status === 'executing');

  // 有工具正在执行时自动展开，完成后自动折叠
  React.useEffect(() => {
    if (hasExecutingTools) {
      setToolCallsExpanded(true);
    }
  }, [hasExecutingTools]);
  const categoryRouting: Array<{ category: string; categoryLabel: string; preferredServerId: string; preferredServerName: string }> = msg._categoryRouting || [];
  const routingLabel = msg._lockedMcpServerName
    ? `本轮已锁定 MCP：${msg._lockedMcpServerName}`
    : msg._preferredMcpServerName
      ? `本轮优先 MCP：${msg._preferredMcpServerName}`
      : '';

  const isLastMessage = msg.role === 'assistant' && isLastInList;
  const actualIsStreaming = isStreaming;
  const isAgentToolStreaming =
    actualIsStreaming &&
    (!assistantParts?.answer || assistantParts?.answer?.trim().length === 0) &&
    (toolCalls.length > 0 || phase === 'searching' || phase === 'web-searching' || phase === 'web-reading');
  const streamingPlaceholder = isAgentToolStreaming
    ? (msg.sources && msg.sources.length > 0
        ? `正在整理 ${msg.sources.length} 条联网结果...`
        : toolCalls.length > 0
          ? `正在处理${toolCalls[toolCalls.length - 1]?.displayName || '工具'}结果...`
          : '正在整理联网结果...')
    : assistantParts?.reasoning
      ? '整理答案中...'
      : '思考中...';
  const isIncompleteAnswer = msg.role === 'assistant' && !actualIsStreaming && isLikelyIncompleteAssistantAnswer(answerContent);

  return (
    <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} group/msg`}>
      <div className={`max-w-[70%] px-6 py-4 rounded-2xl relative ${
        msg.role === 'user'
          ? 'bg-accent text-white shadow-glass rounded-tr-md selection:bg-white/25 selection:text-white'
          : 'bg-white/80 border border-teal-900/5 text-foreground rounded-tl-md'
      }`}>
        <div className={`text-sm leading-relaxed prose prose-sm max-w-none ${
          msg.role === 'user'
            ? 'prose-invert prose-p:my-1 prose-headings:text-white prose-p:text-white prose-strong:text-white prose-li:text-white prose-code:text-white prose-code:font-mono prose-pre:bg-white/10 prose-pre:border prose-pre:border-white/15 prose-a:text-white'
            : 'prose-teal prose-p:my-1 prose-pre:bg-black/5 prose-pre:border prose-pre:border-black/10 prose-code:text-accent prose-code:font-mono'
        }`}>
          {msg.role === 'assistant' ? (
            <div className="space-y-3">
              {phase && phase !== 'completed' && (
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-2xs font-bold tracking-widest uppercase ${getAssistantPhaseClasses(phase)}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${phase === 'error' ? 'bg-red-500' : 'bg-current animate-pulse'}`} />
                  {phaseLabel}
                </span>
              )}

              {isLastMessage && agentSteps.length > 0 && (
                <div className="not-prose space-y-1">
                  {agentSteps.map((step: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-2xs text-violet-600 bg-violet-50 rounded-lg px-2.5 py-1">
                      <Zap size={10} className="animate-pulse" />
                      <span className="font-medium">{step.tool || step.action || '执行中...'}</span>
                      {step.status === 'done' && <Check size={10} className="text-emerald-500" />}
                    </div>
                  ))}
                </div>
              )}

              {showReasoningProcess && (reasoningText || actualIsStreaming) && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 overflow-hidden not-prose">
                  <button
                    onClick={() => onToggleReasoning(messageId)}
                    className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-amber-500/5 transition-colors"
                  >
                    <div className="flex items-center gap-2 text-amber-700/80">
                      <BrainCircuit size={11} className={actualIsStreaming ? 'animate-pulse' : ''} />
                      <span className="text-2xs font-bold uppercase tracking-wider">推理过程</span>
                    </div>
                    <ChevronDown size={12} className={`transition-transform ${reasoningExpanded ? 'rotate-180' : ''}`} />
                  </button>
                  {reasoningExpanded && reasoningText && (
                    <div className="px-3 pb-3">
                      <div className="px-3 py-2 max-h-48 overflow-y-auto custom-scrollbar whitespace-pre-wrap text-2xs leading-5 text-amber-950/75 font-mono bg-white/40 border border-amber-500/10 rounded-lg">
                        {reasoningText}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {toolCalls.length > 0 && (
                <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 overflow-hidden not-prose">
                  <button
                    onClick={() => setToolCallsExpanded(!toolCallsExpanded)}
                    className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-violet-500/5 transition-colors"
                  >
                    <div className="flex items-center gap-2 text-violet-700/80">
                      <Wrench size={11} />
                      <span className="text-2xs font-bold uppercase tracking-wider">工具调用 ({toolCalls.length})</span>
                    </div>
                    {toolCallsExpanded ? <ChevronDown size={12} className="text-violet-700/80" /> : <ChevronRight size={12} className="text-violet-700/80" />}
                  </button>
                  {toolCallsExpanded && (
                    <div className="px-3 pb-3 space-y-2">
                      {routingLabel && (
                        <div className="px-3 py-2 bg-violet-50 border border-violet-500/10 rounded-lg text-2xs text-violet-700">
                          {routingLabel}
                        </div>
                      )}
                      {categoryRouting.length > 0 && (
                        <div className="px-3 py-2 bg-violet-50/50 border border-violet-500/10 rounded-lg">
                          <p className="text-2xs font-bold text-violet-600 mb-1">类别路由</p>
                          <div className="flex flex-wrap gap-1.5">
                            {categoryRouting.map((cr, i) => (
                              <span key={i} className="inline-flex items-center gap-1 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] text-violet-700">
                                <span className="font-bold">{cr.categoryLabel}</span>
                                <span>→</span>
                                <span>{cr.preferredServerName}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {toolCalls.map((tc, i) => (
                        <div key={i} className={`px-3 py-2 bg-white/40 border rounded-lg ${tc.status === 'executing' ? 'border-violet-400/30 bg-violet-50/60' : 'border-violet-500/10'}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <Zap size={10} className={tc.status === 'executing' ? 'text-violet-600 animate-pulse' : 'text-violet-600'} />
                            <span className="text-2xs font-bold text-violet-700">{tc.displayName}</span>
                            {tc.status === 'executing' && (
                              <span className="px-1.5 py-0.5 text-xs bg-violet-100 text-violet-600 rounded-full animate-pulse">执行中</span>
                            )}
                            {tc.status === 'done' && (
                              <span className="px-1.5 py-0.5 text-xs bg-emerald-100 text-emerald-600 rounded-full">完成</span>
                            )}
                            {tc.status === 'error' && (
                              <span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-600 rounded-full">失败</span>
                            )}
                          </div>
                          {tc.status === 'executing' && tc.tool === 'generate_image' && (
                            <div className="flex items-center gap-2 px-2 py-1.5 bg-violet-100/50 rounded-lg mt-1">
                              <div className="h-3 w-3 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" />
                              <span className="text-2xs text-violet-700 font-medium">正在调用 AI 模型生成图片，通常需要 10-30 秒，请耐心等待...</span>
                            </div>
                          )}
                          {tc.status === 'executing' && tc.tool !== 'generate_image' && (
                            <div className="flex items-center gap-2 px-2 py-1.5 bg-violet-100/50 rounded-lg mt-1">
                              <div className="h-3 w-3 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" />
                              <span className="text-2xs text-violet-700 font-medium">正在执行，请稍候...</span>
                            </div>
                          )}
                          {tc.message && (
                            <p className="text-2xs text-violet-950/65 mb-1 whitespace-pre-wrap break-words">{tc.message}</p>
                          )}
                          {tc.status === 'done' && tc.filePath && (
                            <button
                              onClick={() => window.ipcRenderer.invoke('open-file-path', { filePath: tc.filePath })}
                              className="mt-1.5 flex items-center gap-1.5 px-2.5 py-1.5 bg-violet-100 hover:bg-violet-200 text-violet-700 rounded-lg text-2xs font-medium transition-colors"
                            >
                              <Download size={11} />
                              打开文件
                            </button>
                          )}
                          {tc.args && (
                            <div className="mt-1">
                              <p className="text-xs text-muted font-bold uppercase tracking-wider mb-0.5">输入参数</p>
                              <pre className="text-2xs text-violet-950/70 font-mono whitespace-pre-wrap break-all max-h-24 overflow-y-auto bg-violet-50/50 rounded px-2 py-1">
                                {typeof tc.args === 'string' ? tc.args : JSON.stringify(tc.args, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {assistantParts?.answer ? (
                <AssistantMarkdownContent
                  messageId={messageId}
                  answer={assistantParts.answer}
                  copiedId={relevantCopiedId}
                  isStreaming={isStreaming}
                  onCopy={onCopy}
                  onOpenInCanvas={onOpenInCanvas}
                />
              ) : (
                <div className="flex items-center gap-2 text-accent/60 not-prose">
                  <div className="flex gap-1">
                    <div className="w-1 h-1 bg-accent/40 rounded-full animate-bounce" />
                    <div className="w-1 h-1 bg-accent/40 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <div className="w-1 h-1 bg-accent/40 rounded-full animate-bounce [animation-delay:0.4s]" />
                  </div>
                  <span className="text-2xs font-bold uppercase tracking-wider">
                    {streamingPlaceholder}
                  </span>
                </div>
              )}
              {isIncompleteAnswer && (
                <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 px-3 py-2 not-prose">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-2xs font-bold text-orange-700 uppercase tracking-wider">输出可能未完成</span>
                    <button
                      onClick={() => onContinueMessage(String(msg.id))}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-500/10 hover:bg-orange-500/15 text-orange-700 text-2xs font-bold transition-all"
                    >
                      <ChevronRight size={10} />
                      继续生成
                    </button>
                  </div>
                </div>
              )}
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-3 pt-3 border-t border-teal-900/10 not-prose">
                  <p className="text-2xs font-bold text-muted uppercase tracking-wider mb-2">参考来源</p>
                  <div className="flex flex-wrap gap-1.5">
                    {msg.sources.map((source: any, i: number) => (
                      <button
                        key={i}
                        onClick={() => {
                          if (source.type === 'note' || source.type === 'document') {
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
            </div>
          ) : (
            <div className="space-y-2">
              {msg.images && msg.images.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {msg.images.map((img: string, i: number) => (
                    <img key={i} src={img} alt="upload" className="max-w-[200px] max-h-[200px] rounded-xl border border-white/20" />
                  ))}
                </div>
              )}
              {editingMessageId === String(msg.id) ? (
                <div className="space-y-2">
                  <textarea
                    value={editingMessageContent}
                    onChange={(e) => onEditMessage(String(msg.id), e.target.value)}
                    className="w-full bg-white/50 border border-accent/30 rounded-xl p-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-accent/20 resize-none"
                    rows={3}
                    autoFocus
                  />
                  <div className="flex items-center gap-2">
                    <button onClick={() => onSaveEditAndRegenerate(String(msg.id), editingMessageContent)} className="px-3 py-1 bg-accent text-white rounded-lg text-xs font-bold hover:bg-accent/90 transition-all">保存重发</button>
                    <button onClick={onCancelEdit} className="px-3 py-1 bg-teal-900/5 text-muted rounded-lg text-xs font-bold hover:bg-teal-900/10 transition-all">取消</button>
                  </div>
                </div>
              ) : editingIdx === idx ? (
                <div className="space-y-2">
                  <textarea
                    value={editContent}
                    onChange={(e) => onSetEditContent(e.target.value)}
                    className="w-full bg-white/50 border border-accent/30 rounded-xl p-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-accent/20 resize-none"
                    rows={3}
                    autoFocus
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { if (editContent.trim()) { onSetChatMessages((prev: any[]) => [...prev.slice(0, idx), { ...msg, content: editContent.trim() }]); onSetEditingIdx(null); } }}
                      className="px-3 py-1 bg-accent text-white rounded-lg text-xs font-bold hover:bg-accent/90 transition-all"
                    >保存</button>
                    <button onClick={() => onSetEditingIdx(null)} className="px-3 py-1 bg-teal-900/5 text-muted rounded-lg text-xs font-bold hover:bg-teal-900/10 transition-all">取消</button>
                  </div>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          )}
        </div>

        {!actualIsStreaming && msg.role === 'assistant' && (
          <div className="mt-2 pt-2 border-t border-teal-900/5 opacity-0 group-hover/msg:opacity-100 transition-opacity flex items-center gap-1">
            <button onClick={() => onCopy(copyContent, `chat-${idx}`)} className="p-1.5 hover:bg-teal-900/5 rounded text-muted hover:text-accent transition-all" title="复制">
              {relevantCopiedId === `chat-${idx}` ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
            </button>
            {msg.branches && msg.branches.length > 1 && (
              <div className="flex items-center gap-0.5 mx-1">
                <button onClick={() => onBranchMessage(String(msg.id), 'prev')} className="p-1 hover:bg-teal-900/5 rounded text-muted" title="上一分支">
                  <RotateCw size={10} className="rotate-180" />
                </button>
                <span className="text-xs text-muted font-mono px-1">{(msg.activeBranchIndex ?? 0) + 1}/{msg.branches.length}</span>
                <button onClick={() => onBranchMessage(String(msg.id), 'next')} className="p-1 hover:bg-teal-900/5 rounded text-muted" title="下一分支">
                  <RotateCw size={10} />
                </button>
              </div>
            )}
            {idx === -1 && isChatLoading ? null : idx >= 0 && (
              <button onClick={() => onRegenerateResponse(String(msg.id))} className="p-1.5 hover:bg-teal-900/5 rounded text-muted hover:text-accent transition-all" title="重新生成">
                <RotateCcw size={12} />
              </button>
            )}
            <button
              onClick={() => onContinueMessage(String(msg.id))}
              className="p-1.5 hover:bg-teal-900/5 rounded text-muted hover:text-accent transition-all"
              title="继续生成"
            >
              <ChevronRight size={12} />
            </button>
            <button onClick={() => onToggleBookmark(String(msg.id), !!msg.bookmarked)} className={`p-1.5 hover:bg-teal-900/5 rounded transition-all ${msg.bookmarked ? 'text-amber-500' : 'text-muted hover:text-amber-500'}`} title="收藏">
              <Bookmark size={12} fill={msg.bookmarked ? 'currentColor' : 'none'} />
            </button>
            <button onClick={() => onExtractTodos(msg)} className="p-1.5 hover:bg-teal-900/5 rounded text-muted hover:text-accent transition-all" title="提取待办">
              <Zap size={12} />
            </button>
            <button onClick={async () => {
              try {
                const b64 = await window.ipcRenderer.invoke('export-chat-to-docx', { title: '对话导出', content: copyContent });
                const binary = atob(b64);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `chat-export-${Date.now()}.docx`;
                a.click();
                URL.revokeObjectURL(url);
              } catch (e) { logger.error('Export docx failed', e); }
            }} className="p-1.5 hover:bg-teal-900/5 rounded text-muted hover:text-accent transition-all" title="导出Word">
              <Download size={12} />
            </button>
          </div>
        )}

        {!actualIsStreaming && msg.role === 'user' && (
          <div className="mt-2 pt-2 border-t border-white/20 flex items-center gap-1">
            <button onClick={() => onCopy(msg.content, `chat-${idx}`)} className="p-1.5 hover:bg-white/20 rounded text-white/50 hover:text-white transition-all" title="复制">
              {relevantCopiedId === `chat-${idx}` ? <Check size={12} /> : <Copy size={12} />}
            </button>
            <button onClick={() => { onSetEditingIdx(idx); onSetEditContent(msg.content); }} className="p-1.5 hover:bg-white/20 rounded text-white/50 hover:text-white transition-all" title="编辑">
              <Edit2 size={12} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const areChatMessageItemPropsEqual = (prev: ChatMessageItemProps, next: ChatMessageItemProps) => {
  if (prev.msg !== next.msg) return false;
  if (prev.idx !== next.idx) return false;
  if (prev.isLastInList !== next.isLastInList) return false;
  if (prev.isChatLoading !== next.isChatLoading) return false;
  if (prev.showReasoningProcess !== next.showReasoningProcess) return false;
  if (prev.isCanvasOpen !== next.isCanvasOpen) return false;

  const prevMessageId = String(prev.msg.id ?? prev.idx);
  const nextMessageId = String(next.msg.id ?? next.idx);
  const prevReasoningExpanded = prev.expandedReasoningMessages[prevMessageId] ?? false;
  const nextReasoningExpanded = next.expandedReasoningMessages[nextMessageId] ?? false;
  if (prevReasoningExpanded !== nextReasoningExpanded) return false;

  const prevRelevantCopiedId = getRelevantCopiedId(prev.copiedId, prevMessageId, prev.idx);
  const nextRelevantCopiedId = getRelevantCopiedId(next.copiedId, nextMessageId, next.idx);
  if (prevRelevantCopiedId !== nextRelevantCopiedId) return false;

  const prevEditingMessage = prev.editingMessageId === prevMessageId;
  const nextEditingMessage = next.editingMessageId === nextMessageId;
  if (prevEditingMessage || nextEditingMessage) {
    if (prev.editingMessageId !== next.editingMessageId) return false;
    if (prev.editingMessageContent !== next.editingMessageContent) return false;
  }

  const prevInlineEditing = prev.editingIdx === prev.idx;
  const nextInlineEditing = next.editingIdx === next.idx;
  if (prevInlineEditing || nextInlineEditing) {
    if (prev.editingIdx !== next.editingIdx) return false;
    if (prev.editContent !== next.editContent) return false;
  }

  const prevNeedsAgentSteps = prev.msg.role === 'assistant' && prev.agentSteps.length > 0;
  const nextNeedsAgentSteps = next.msg.role === 'assistant' && next.agentSteps.length > 0;
  if (prevNeedsAgentSteps || nextNeedsAgentSteps) {
    if (prev.agentSteps !== next.agentSteps) return false;
  }

  return true;
};

export default React.memo(ChatMessageItem, areChatMessageItemPropsEqual);
