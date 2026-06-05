export type AssistantPhase = 'query-expanding' | 'retrieving' | 'web-searching' | 'web-reading' | 'thinking' | 'searching' | 'reasoning' | 'composing' | 'tool-executing' | 'tool-retrying' | 'tool-summarizing' | 'completed' | 'error';

export const parseAssistantMessage = (rawContent: string) => {
  const content = String(rawContent || '');
  const thinkOpenTag = '<think>';
  const thinkCloseTag = '</think>';
  const thinkRegex = new RegExp(`${thinkOpenTag}([\\s\\S]*?)${thinkCloseTag}`, 'gi');
  const thinkOpenRegex = new RegExp(`${thinkOpenTag}[\\s\\S]*$`, 'gi');

  const reasoningParts = Array.from(content.matchAll(thinkRegex))
    .map((match) => String(match[1] || '').trim())
    .filter(Boolean);

  const answer = content
    .replace(thinkRegex, '')
    .replace(thinkOpenRegex, '')
    .trim();

  return {
    reasoning: reasoningParts.join('\n\n'),
    answer
  };
};

export const sanitizeAssistantReasoningText = (text: string) => {
  const raw = String(text || '')
    .replace(/\[\[TOOL_CALL\]\][\s\S]*?\[\[\/TOOL_CALL\]\]/gi, '')
    .replace(/\[TOOL_CALL\][\s\S]*?\[\/TOOL_CALL\]/gi, '')
    .replace(/<tool_call[\s\S]*?<\/tool_call>/gi, '')
    .trim();

  if (!raw) return '';

  const compact = raw.replace(/\s+/g, ' ').trim();
  if (/^\{\s*"tool"\s*:\s*".+?"\s*,\s*"args"\s*:/i.test(compact)) {
    return '';
  }

  const lines = raw.split(/\r?\n/);
  const filtered = lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return true;
    if (/^(推理过程|HTML|代码|预览|复制|下载|参考来源)$/i.test(trimmed)) return false;
    if (/^\{\s*"tool"\s*:\s*".*"\s*,\s*"args"\s*:/i.test(trimmed)) return false;
    if (/^\[\[?TOOL_CALL\]?\]/i.test(trimmed)) return false;
    if (/^<tool_call/i.test(trimmed)) return false;
    return true;
  });

  return filtered.join('\n').replace(/\n{3,}/g, '\n\n').trim();
};

export const getAssistantMessageParts = (msg: any) => {
  const parsed = parseAssistantMessage(msg.content || '');
  const explicitReasoning = typeof msg.reasoning === 'string' ? sanitizeAssistantReasoningText(msg.reasoning) : '';
  const parsedReasoning = sanitizeAssistantReasoningText(parsed.reasoning);

  return {
    reasoning: explicitReasoning || parsedReasoning,
    answer: parsed.answer
  };
};

export const isLikelyIncompleteAssistantAnswer = (text: string) => {
  const content = String(text || '').trim();
  if (!content) return false;

  const fenceCount = (content.match(/^```/gm) || []).length;
  if (fenceCount % 2 !== 0) return true;

  if (/<!DOCTYPE html/i.test(content) && !/<\/html>\s*$/i.test(content)) return true;
  if (/<[^>\n]*$/.test(content)) return true;
  if (/[=:{[(,.\-]\s*$/.test(content)) return true;

  const lastLine = (content.split(/\r?\n/).pop() || '').trim();
  if (/^(<\w+[^>]*|[\w$-]+\s*=\s*|[\w$-]+\s*:\s*|class(Name)?=|style=)/i.test(lastLine)) return true;

  return false;
};

export const getAssistantPhaseLabel = (msg: any, phase: AssistantPhase | null) => {
  if (!phase) return '';

  switch (phase) {
    case 'query-expanding':
      return '优化搜索词';
    case 'retrieving':
      return msg._retrievedCount != null ? `检索知识库 · 已找到 ${msg._retrievedCount} 条` : '检索知识库';
    case 'web-searching':
      return '联网搜索';
    case 'web-reading':
      return '阅读网页';
    case 'thinking':
      return '思考中';
    case 'searching':
      return msg.usesRetrieval ? '检索中' : '准备中';
    case 'reasoning':
      return '推理中';
    case 'composing':
      return '生成回答中，请稍后！';
    case 'tool-executing':
      return msg._toolName
        ? `执行工具 ${msg._toolCurrent || 1}/${msg._toolTotal || 1} · ${msg._toolName}`
        : '执行工具';
    case 'tool-retrying':
      return msg._toolName
        ? `自动纠偏 ${msg._toolCurrent || 1}/${msg._toolTotal || 1} · ${msg._toolName}`
        : '自动纠偏';
    case 'tool-summarizing':
      return msg._toolTotal ? `整理结果 · ${msg._toolTotal} 个工具` : '整理结果';
    case 'error':
      return '生成失败';
    case 'completed':
      return '已完成';
    default:
      return '';
  }
};

export const getAssistantPhaseClasses = (phase: AssistantPhase | null) => {
  switch (phase) {
    case 'query-expanding':
      return 'border-violet-500/20 bg-violet-500/10 text-violet-700';
    case 'retrieving':
      return 'border-sky-500/20 bg-sky-500/10 text-sky-700';
    case 'web-searching':
      return 'border-blue-500/20 bg-blue-500/10 text-blue-700';
    case 'web-reading':
      return 'border-orange-500/20 bg-orange-500/10 text-orange-700';
    case 'thinking':
      return 'border-indigo-500/20 bg-indigo-500/10 text-indigo-700';
    case 'searching':
      return 'border-sky-500/20 bg-sky-500/10 text-sky-700';
    case 'reasoning':
      return 'border-amber-500/20 bg-amber-500/10 text-amber-700';
    case 'composing':
      return 'border-teal-500/20 bg-teal-500/10 text-teal-700';
    case 'tool-executing':
      return 'border-violet-500/20 bg-violet-500/10 text-violet-700';
    case 'tool-retrying':
      return 'border-orange-500/20 bg-orange-500/10 text-orange-700';
    case 'tool-summarizing':
      return 'border-cyan-500/20 bg-cyan-500/10 text-cyan-700';
    case 'error':
      return 'border-red-500/20 bg-red-500/10 text-red-700';
    case 'completed':
      return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700';
    default:
      return 'border-teal-900/10 bg-teal-900/5 text-muted';
  }
};

export const inferAssistantPhase = (msg: any, isStreamingAssistant: boolean, assistantParts: { reasoning: string; answer: string } | null): AssistantPhase | null => {
  if (msg.phase) return msg.phase;
  if (msg.error) return 'error';
  if (isStreamingAssistant) {
    if (assistantParts?.answer) return 'composing';
    if (assistantParts?.reasoning) return 'reasoning';
    return 'searching';
  }
  if (assistantParts?.answer || assistantParts?.reasoning) {
    return 'completed';
  }
  return null;
};
