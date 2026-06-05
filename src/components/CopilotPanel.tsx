import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Send, Sparkles, Loader2, FileText, StickyNote, CheckSquare, Database, ClipboardPaste, Workflow, ArrowRight, Save, X } from 'lucide-react';

export interface RelatedItem {
  id: string;
  type: 'note' | 'document' | 'file' | 'task';
  title: string;
  content?: string | undefined;
  snippet?: string | undefined;
}

interface CopilotPanelProps {
  contextType: 'knowledge' | 'document' | 'note' | 'task';
  contextId?: string | undefined;
  contextTitle?: string | undefined;
  contextContent?: string | undefined;
  selectedText?: string | undefined;

  aiReady: boolean;
  selectedModel: string;
  isProcessing: boolean;

  onAskQuestion: (question: string) => void;

  onAiAsk?: ((question: string) => Promise<string>) | undefined;

  onInsertToEditor?: ((text: string) => void) | undefined;

  onSaveAsNote?: ((content: string) => void) | undefined;
  onSaveAsDocument?: ((content: string) => void) | undefined;
  onSaveAsTask?: ((content: string) => void) | undefined;
  onCreateTask?: ((title: string, source?: { type: 'note' | 'document' | 'chat' | 'manual'; source_id: string; title: string }) => void) | undefined;

  onCreateWorkflow?: ((workflow: any) => void) | undefined;

  result?: string | undefined;
  relatedItems?: RelatedItem[] | undefined;
  onItemClick?: ((item: RelatedItem) => void) | undefined;
}

const contextActionDefs: Record<string, Array<{ label: string; promptTemplate: string }>> = {
  knowledge: [
    { label: '总结资料', promptTemplate: '你是一位信息提炼专家。请对以下资料进行提炼总结，用简洁的要点列表呈现核心信息。每个要点不超过两句话。\n\n待总结内容：\n{content}' },
    { label: '提取关键点', promptTemplate: '你是一位信息分析专家。请从以下资料中提取关键要点，按重要性排序，每点用简洁的语言概括。返回编号列表。\n\n资料内容：\n{content}' },
    { label: '提取待办', promptTemplate: '你是一位任务分析专家。请从以下内容中提取所有可执行的待办事项，每项以"- [ ]"格式列出，包含具体的行动描述。\n\n内容：\n{content}' },
  ],
  document: [
    { label: '续写', promptTemplate: '你是一位专业写作助手。请根据以下已有内容，自然地继续写下去，保持风格、语气和逻辑的一致性。只输出续写内容，不要重复已有内容。\n\n已有内容：\n{content}\n\n请继续写：\n重要：只输出续写结果，不要包含任何分析、说明、标题或格式标注。' },
    { label: '润色', promptTemplate: '你是一位专业文字编辑。请对以下内容进行润色优化，使其表达更加流畅、专业、清晰，但保持原意不变。\n\n原始内容：\n{content}\n\n输出要求：只输出润色后的完整文本，不要包含任何分析、说明、标题或格式标注。' },
    { label: '提炼', promptTemplate: '你是一位信息提炼专家。请对以下内容进行提炼总结，用简洁的要点列表呈现核心信息。每个要点不超过两句话。\n\n待总结内容：\n{content}\n\n输出要求：只输出要点列表，不要包含任何分析、说明或额外格式。' },
    { label: '扩写', promptTemplate: '你是一位专业写作助手。请对以下内容进行扩展详细说明，补充更多细节、例子和解释，使内容更加丰富完整。\n\n原始内容：\n{content}\n\n输出要求：只输出扩写后的完整文本，不要包含任何分析、说明或格式标注。' },
    { label: '缩写', promptTemplate: '你是一位专业文字编辑。请对以下内容进行精简压缩，去除冗余表达，保留核心信息，使内容更加简洁有力。\n\n原始内容：\n{content}\n\n输出要求：只输出缩写后的完整文本，不要包含任何分析、说明或格式标注。' },
    { label: '翻译', promptTemplate: '你是一位专业翻译。请将以下内容翻译成流畅的中文（或从中文翻译成英文，取决于原文语言）。保持原文风格和语气。\n\n原文内容：\n{content}\n\n输出要求：只输出翻译结果，不要包含任何分析、说明或格式标注。' },
    { label: '正式', promptTemplate: '你是一位专业文字编辑。请将以下内容改写成正式风格的文本，使用更规范的语言和表达方式。\n\n原文：\n{content}\n\n输出要求：只输出改写后的文本，不要包含任何分析、说明或格式标注。' },
    { label: '口语', promptTemplate: '你是一位专业文字编辑。请将以下内容改写成轻松口语化的风格，让语言更加亲切自然。\n\n原文：\n{content}\n\n输出要求：只输出改写后的文本，不要包含任何分析、说明或格式标注。' },
    { label: '解释', promptTemplate: '你是一位专业讲解员。请用通俗易懂的语言解释以下内容，可以补充背景知识、举例子说明。\n\n内容：\n{content}\n\n输出要求：直接给出通俗易懂的解释，不要输出"改写说明"或"分析"类的章节标题。' },
    { label: '问答', promptTemplate: '你是一位专业问答专家。请基于以下内容，提出3个有价值的问题并给出简要回答。格式：\nQ1: ...\nA1: ...\n\n内容：\n{content}\n\n重要：只输出问答内容，不要输出任何分析或额外说明。' },
    { label: '脑暴', promptTemplate: '你是一位创意专家。请基于以下内容，发散思维，提出5个相关的创意想法、延伸方向或应用场景。\n\n内容：\n{content}\n\n重要：只输出创意列表，不要输出任何分析或说明。' },
  ],
  note: [
    { label: '打标签', promptTemplate: '你是一位内容分类专家。请为以下内容推荐3-5个合适的标签，每个标签2-4个字，用逗号分隔。\n\n内容：\n{content}\n\n重要：只输出标签，用逗号分隔，不要输出任何分析说明。' },
    { label: '概要整理', promptTemplate: '你是一位信息整理专家。请将以下便签内容整理为结构清晰的概要，用标题和要点列表呈现。\n\n便签内容：\n{content}\n\n输出要求：只输出整理后的概要，不要包含任何分析说明。' },
    { label: '转文档', promptTemplate: '你是一位专业文档撰写助手。请将以下便签内容整理为正式文档格式，包含标题、段落和适当的层级结构。\n\n便签内容：\n{content}\n\n输出要求：只输出文档正文，不要包含任何分析说明。' },
    { label: '转待办', promptTemplate: '你是一位任务管理专家。请将以下内容转换为清晰的待办事项清单，每项以"- [ ]"格式列出，确保每项都是可执行的具体行动。\n\n内容：\n{content}\n\n重要：只输出待办列表，不要输出任何分析说明。' },
  ],
  task: [
    { label: '拆解任务', promptTemplate: '你是一位项目管理专家。请将以下任务拆解为具体的、可执行的子任务步骤，每个步骤都要清晰明确。\n\n任务内容：\n{content}\n\n重要：只输出子任务列表，不要包含任何分析说明。' },
    { label: '补充执行建议', promptTemplate: '你是一位执行顾问。请为以下任务补充具体的执行建议，包括方法、工具、注意事项等实用信息。\n\n任务内容：\n{content}\n\n输出要求：只输出建议内容，不要包含任何分析说明。' },
    { label: '生成准备清单', promptTemplate: '你是一位项目准备专家。请为以下任务生成一份完整的准备清单，包含所需资源、前置条件和注意事项。\n\n任务内容：\n{content}\n\n重要：只输出清单内容，不要包含任何分析说明。' },
  ],
};

const relatedItemIcon = (type: RelatedItem['type']) => {
  switch (type) {
    case 'note': return <StickyNote size={14} className="text-amber-500" />;
    case 'document': return <FileText size={14} className="text-blue-500" />;
    case 'file': return <Database size={14} className="text-slate-500" />;
    case 'task': return <CheckSquare size={14} className="text-green-500" />;
  }
};

const CopilotPanel: React.FC<CopilotPanelProps> = ({
  contextType,
  contextId,
  contextTitle,
  contextContent,
  selectedText,
  aiReady,
  selectedModel,
  isProcessing,
  onAskQuestion,
  onAiAsk,
  onInsertToEditor,
  onSaveAsNote,
  onSaveAsDocument,
  onSaveAsTask,
  onCreateTask,
  onCreateWorkflow,
  result,
  relatedItems,
  onItemClick,
}) => {
  const [question, setQuestion] = React.useState('');
  const [localResult, setLocalResult] = React.useState<string | undefined>();
  const [localIsProcessing, setLocalIsProcessing] = React.useState(false);
  const [workflowPreview, setWorkflowPreview] = React.useState<any | null>(null);

  const WORKFLOW_KEYWORDS = ['每天', '每周', '每月', '定时', '自动化', '自动', '创建工作流', '帮我自动', '定时任务', '工作流', '汇总', '定期'];

  const detectWorkflowIntent = (text: string): boolean => {
    const lower = text.toLowerCase();
    return WORKFLOW_KEYWORDS.some(kw => lower.includes(kw));
  };

  const handleGenerateWorkflow = async (prompt: string) => {
    if (!window.ipcRenderer) return;
    setLocalIsProcessing(true);
    try {
      const workflow = await window.ipcRenderer.invoke('generate-workflow-from-prompt', { prompt });
      if (workflow && workflow.name) {
        setWorkflowPreview(workflow);
      } else {
        setLocalResult('无法生成工作流，请尝试更详细地描述你的需求。');
      }
    } catch {
      setLocalResult('工作流生成失败，请重试。');
    } finally {
      setLocalIsProcessing(false);
    }
  };

  const handleSaveWorkflow = () => {
    if (workflowPreview && onCreateWorkflow) {
      onCreateWorkflow(workflowPreview);
      setWorkflowPreview(null);
      setLocalResult(`✅ 工作流「${workflowPreview.name}」已创建！你可以在「工作流」页面查看和管理。`);
    }
  };

  // 当外部result变化时同步到localResult
  React.useEffect(() => {
    setLocalResult(result);
  }, [result]);

  // 切换上下文时清空本地结果，避免上一条结果串到新对象上
  React.useEffect(() => {
    setLocalResult(result ? result.replace(/【结果开始】[\s\S]*?【结果结束】/g, '').replace(/【结果开始】\s*/g, '').replace(/\s*【结果结束】/g, '').trim() : result);
    setQuestion('');
  }, [contextType, contextTitle, selectedText]);

  // 合并内部和外部processing状态
  const effectiveIsProcessing = localIsProcessing || isProcessing;

  const handleQuickAction = async (promptTemplate: string) => {
    if (!aiReady) return;
    // 如果没有当前内容，提示用户
    const effectiveContent = selectedText || contextContent;
    if (!effectiveContent || !effectiveContent.replace(/<[^>]*>/g, '').trim()) {
      alert('请先选择或打开一个文档/便签');
      return;
    }
    // 构建带上下文的prompt
    const typeLabel = contextType === 'document' ? '文档' : contextType === 'note' ? '便签' : contextType === 'task' ? '待办' : '内容';
    const plainContent = effectiveContent.replace(/<[^>]*>/g, '');
    // promptTemplate中的{content}替换为实际内容（续写/润色需要完整内容，限制在3000字）
    const contentForPrompt = plainContent.slice(0, 3000);
    const prompt = promptTemplate.replace('{content}', contentForPrompt);
    // 添加上下文标题
    const fullPrompt = selectedText
      ? `[当前操作]\n选中文本：${plainContent.slice(0, 500)}${plainContent.length > 500 ? '...' : ''}\n\n[任务指令]\n${prompt}`
      : contextTitle
        ? `[当前上下文]\n正在编辑：${typeLabel} - ${contextTitle}\n内容摘要：${plainContent.slice(0, 500)}\n\n[任务指令]\n${prompt}`
        : prompt;

    // 在最末尾追加硬约束——LLM 对结尾的指令最敏感
    // 用分隔符确保能精确提取结果——AI 可能不听话，但标记内的内容最纯净
    const constrainedPrompt = fullPrompt + '\n\n重要：将你的输出包裹在标记之间：\n【结果开始】\n（你的输出）\n【结果结束】\n\n只输出结果，不要输出任何分析、说明或格式标注。你的分析不会被展示给用户。';

    setLocalIsProcessing(true);
    try {
      const extractResult = (raw: string) => {
        // 1. 优先取标记内的内容
        const startTag = '【结果开始】';
        const endTag = '【结果结束】';
        const startIdx = raw.indexOf(startTag);
        const endIdx = raw.indexOf(endTag);
        if (startIdx !== -1 && endIdx !== -1) {
          return raw.substring(startIdx + startTag.length, endIdx).trim();
        }
        // 2. 剥离常见分析模板（多个模型输出格式）
        const sectionHeaders = ['改写结果', '润色结果', '润色后文本', '润色稿', '续写结果', '总结结果'];
        for (const header of sectionHeaders) {
          const match = raw.match(new RegExp(`${header}[：:中]?\\s*([\\s\\S]*?)(?:\\n\\n\\n(?:改写说明|优化说明|原文问题点)|(?:改写说明|优化说明))`));
          if (match && match[1]) return match[1].trim();
          const simpleMatch = raw.match(new RegExp(`${header}[：:中]?\\s*([\\s\\S]*$)`));
          if (simpleMatch && simpleMatch[1]) {
            const text = simpleMatch[1].trim();
            const explainIdx = text.search(/改写说明|优化说明[（(]供参考[）)]|原文问题点|润色策略/);
            return explainIdx !== -1 ? text.substring(0, explainIdx).trim() : text;
          }
        }
        // 3. 通用正则：剥离 "以下是对原文的..." 类开头 + 尾部分析
        const stripped = raw.replace(/^[\s\S]*?(改写结果|润色后文本|润色结果)[：:]\s*/, '').trim();
        if (stripped !== raw.trim()) {
          const explainIdx = stripped.search(/改写说明|优化说明|原文问题点|润色策略/);
          return explainIdx !== -1 ? stripped.substring(0, explainIdx).trim() : stripped;
        }
        // 4. 暴力裁剪：去除所有 "风格分析"+"改写结果" 前缀 + 尾部说明
        return raw
          .replace(/^风格分析[\s\S]*?(改写结果|润色后文本|润色结果)[：:]\s*/, '')
          .replace(/改写说明[\s\S]*$/, '')
          .replace(/优化说明[\s\S]*$/, '')
          .replace(/原文问题点[\s\S]*$/, '')
          .trim() || raw;
      };

      if (onAiAsk) {
        const res = await onAiAsk(constrainedPrompt);
        setLocalResult(extractResult(res));
      } else {
        onAskQuestion(constrainedPrompt);
      }
    } catch {
      setLocalResult('AI 处理失败，请重试');
    } finally {
      setLocalIsProcessing(false);
    }
  };

  const actions = contextActionDefs[contextType] ?? [];

  // 构建带上下文的prompt
  const buildPromptWithContext = (q: string): string => {
    const typeLabel = contextType === 'document' ? '文档' : contextType === 'note' ? '便签' : contextType === 'task' ? '待办' : '内容';
    const contentSnippet = contextContent ? contextContent.replace(/<[^>]*>/g, '').slice(0, 500) : '';
    if (!contextTitle && !contentSnippet) return q;
    let contextPrefix = `[当前上下文]\n正在编辑：${typeLabel} - ${contextTitle || '未命名'}`;
    if (contentSnippet) {
      contextPrefix += `\n内容摘要：${contentSnippet}`;
    }
    contextPrefix += '\n\n[用户问题]\n';
    return contextPrefix + q;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || effectiveIsProcessing) return;
    const q = question.trim();
    if (detectWorkflowIntent(q)) {
      await handleGenerateWorkflow(q);
      return;
    }
    const promptWithContext = buildPromptWithContext(q);
    if (onAiAsk) {
      setLocalIsProcessing(true);
      try {
        const res = await onAiAsk(promptWithContext);
        setLocalResult(res);
      } catch {
        setLocalResult('AI 处理失败，请重试');
      } finally {
        setLocalIsProcessing(false);
      }
    } else {
      onAskQuestion(promptWithContext);
    }
    setQuestion('');
  };

  const displayResultRaw = localResult ?? result;
  const displayResult = displayResultRaw
    ? displayResultRaw
        .replace(/【结果开始】\s*/g, '')
        .replace(/\s*【结果结束】/g, '')
        .replace(/^[\s\S]*?【结果开始】/g, '')  // 如果【结果开始】出现在了中间也能清理
        .trim()
    : undefined;

  const buildTaskTitle = (text?: string) => {
    if (!text) return '';
    const firstMeaningfulLine = text
      .split('\n')
      .map(line => line.trim())
      .find(line => line.length > 0);
    if (!firstMeaningfulLine) return '';
    return firstMeaningfulLine
      .replace(/^[-*]\s*\[\s?\]\s*/, '')
      .replace(/^[-*]\s+/, '')
      .replace(/^#+\s*/, '')
      .trim()
      .slice(0, 80);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="w-80 flex-shrink-0 border-l border-teal-900/10 bg-white/30 backdrop-blur-xl flex flex-col h-full"
    >
      {/* 顶部：AI 状态 */}
      <div className="p-4 border-b border-teal-900/10">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Bot size={20} className="text-accent" />
            <span
              className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
                aiReady ? 'bg-green-500' : 'bg-slate-300'
              }`}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">AI Copilot</p>
            <p className="text-xs text-muted truncate">{selectedModel || '未选择模型'}</p>
          </div>
          <Sparkles size={16} className="text-accent/60" />
        </div>
        {contextTitle && (
          <p className="mt-2 text-xs text-muted truncate">
            当前上下文: {contextTitle}
          </p>
        )}
      </div>

      {/* 快捷操作 */}
      <div className="p-4 border-b border-teal-900/10">
        <p className="text-xs font-medium text-muted mb-2">快捷操作</p>
        <div className="flex flex-wrap gap-2">
          {actions.map((act) => (
            <button
              key={act.label}
              onClick={() => handleQuickAction(act.promptTemplate)}
              disabled={effectiveIsProcessing || !aiReady}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {act.label}
            </button>
          ))}
          <button
            onClick={() => { setQuestion('帮我创建一个定时工作流：'); }}
            disabled={effectiveIsProcessing || !aiReady}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
          >
            <Workflow size={11} /> 创建工作流
          </button>
        </div>
      </div>

      {/* 问答输入框 */}
      <div className="p-4 border-b border-teal-900/10">
        <form onSubmit={handleSubmit} className="relative">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={aiReady ? '向 AI 提问...' : 'AI 未就绪'}
            disabled={!aiReady || effectiveIsProcessing}
            className="w-full pl-4 pr-10 py-2.5 bg-white/60 border border-teal-900/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-40"
          />
          <button
            type="submit"
            disabled={!question.trim() || effectiveIsProcessing || !aiReady}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-accent hover:bg-accent/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Send size={14} />
          </button>
        </form>
      </div>

      {/* 结果展示区 */}
      <div className="flex-1 overflow-y-auto p-4">
        <AnimatePresence mode="wait">
          {effectiveIsProcessing ? (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 text-sm text-muted"
            >
              <Loader2 size={16} className="animate-spin text-accent" />
              AI 正在处理...
            </motion.div>
          ) : displayResult ? (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              <div className="prose prose-sm max-w-none text-sm text-foreground whitespace-pre-wrap">
                {displayResult}
              </div>
              {/* 联动操作 */}
              {(onInsertToEditor || onSaveAsNote || onSaveAsDocument || onSaveAsTask || onCreateTask) && (
                <div className="flex flex-wrap gap-2 pt-2 border-t border-teal-900/10">
                  {onInsertToEditor && (
                    <button
                      onClick={() => onInsertToEditor(displayResult)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 transition-all"
                    >
                      <ClipboardPaste size={12} />
                      插入到编辑器
                    </button>
                  )}
                  {onSaveAsNote && (
                    <button
                      onClick={() => onSaveAsNote(displayResult)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-all"
                    >
                      <StickyNote size={12} />
                      保存为便签
                    </button>
                  )}
                  {onSaveAsDocument && (
                    <button
                      onClick={() => onSaveAsDocument(displayResult)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all"
                    >
                      <FileText size={12} />
                      保存为文档
                    </button>
                  )}
                  {onSaveAsTask && (
                    <button
                      onClick={() => onSaveAsTask(displayResult)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-all"
                    >
                      <CheckSquare size={12} />
                      保存为待办
                    </button>
                  )}
                  {onCreateTask && (
                    <button
                      onClick={() => onCreateTask(buildTaskTitle(displayResult), contextId ? {
                        type: (contextType === 'document' ? 'document' : contextType === 'note' ? 'note' : 'manual') as 'document' | 'note' | 'chat' | 'manual',
                        source_id: contextId,
                        title: contextTitle || '',
                      } : undefined)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-orange-50 text-orange-700 hover:bg-orange-100 transition-all"
                    >
                      <CheckSquare size={12} />
                      创建待办
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          ) : workflowPreview ? (
            <motion.div
              key="workflow-preview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              <div className="flex items-center gap-2 p-3 bg-purple-50 rounded-xl border border-purple-100">
                <Workflow size={16} className="text-purple-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-purple-700 truncate">{workflowPreview.name}</p>
                  <p className="text-xs text-purple-500/70 truncate">{workflowPreview.description}</p>
                </div>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-muted">触发方式：</span>
                  <span className="px-2 py-0.5 bg-teal-50 text-teal-700 rounded-full font-medium">
                    {workflowPreview.trigger_type === 'cron' ? '⏰ 定时' : workflowPreview.trigger_type === 'event' ? '⚡ 事件' : '🔘 手动'}
                  </span>
                </div>
                {workflowPreview.action_type && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted">执行动作：</span>
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-medium">
                      {workflowPreview.action_type}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex gap-2 pt-2 border-t border-teal-900/10">
                <button
                  onClick={handleSaveWorkflow}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-purple-600 text-white hover:bg-purple-700 transition-all"
                >
                  <Save size={12} /> 保存工作流
                </button>
                <button
                  onClick={() => setWorkflowPreview(null)}
                  className="px-3 py-2 text-xs font-medium rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 transition-all"
                >
                  <X size={12} />
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-8 text-center"
            >
              <Bot size={32} className="text-slate-300 mb-3" />
              <p className="text-xs text-muted">选择快捷操作或提问</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 底部：相关内容推荐 */}
      {relatedItems && relatedItems.length > 0 && (
        <div className="p-4 border-t border-teal-900/10">
          <p className="text-xs font-medium text-muted mb-2">相关内容</p>
          <div className="space-y-2">
            {relatedItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onItemClick?.(item)}
                className="w-full text-left p-2 rounded-lg hover:bg-teal-900/5 transition-all"
              >
                <div className="flex items-center gap-2">
                  {relatedItemIcon(item.type)}
                  <span className="text-xs font-medium text-foreground truncate">{item.title}</span>
                </div>
                {item.snippet && (
                  <p className="text-xs text-muted mt-1 line-clamp-1 pl-5">{item.snippet}</p>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default CopilotPanel;
