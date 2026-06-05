import React from 'react';

export interface CopilotAction {
  id: string;
  label: string;
  icon?: string;
}

interface CopilotFloatingMenuProps {
  selectedText: string | null;
  contextType: 'note' | 'document';
  onAiAsk?: (question: string) => Promise<string>;
  onInsertToEditor?: (text: string) => void;
  onSaveAsTask?: ((content: string) => void) | undefined;
  onCreateTask?: ((title: string) => void) | undefined;
  onClose: () => void;
}

const NOTE_ACTIONS: CopilotAction[] = [
  { id: 'summarize', label: '总结', icon: '📝' },
  { id: 'polish', label: '润色', icon: '✏️' },
  { id: 'translate', label: '翻译', icon: '🌐' },
  { id: 'extract_tasks', label: '转待办', icon: '📋' },
];

const DOC_ACTIONS: CopilotAction[] = [
  { id: 'summarize', label: '总结', icon: '📝' },
  { id: 'polish', label: '润色', icon: '✏️' },
  { id: 'translate', label: '翻译', icon: '🌐' },
  { id: 'improve', label: '改进', icon: '✨' },
  { id: 'extract_tasks', label: '转待办', icon: '📋' },
];

export const CopilotFloatingMenu: React.FC<CopilotFloatingMenuProps> = ({
  selectedText,
  contextType,
  onAiAsk,
  onInsertToEditor,
  onSaveAsTask,
  onCreateTask,
  onClose,
}) => {
  if (!selectedText || selectedText.trim().length === 0) {
    return null;
  }

  const actions = contextType === 'note' ? NOTE_ACTIONS : DOC_ACTIONS;

  const handleAction = async (action: CopilotAction) => {
    const text = selectedText.trim();

    switch (action.id) {
      case 'summarize':
        if (onAiAsk) {
          const result = await onAiAsk(`请总结以下内容：\n${text}`);
          if (result && onInsertToEditor) {
            onInsertToEditor(result);
          }
        }
        break;
      case 'polish':
        if (onAiAsk) {
          const result = await onAiAsk(`请润色以下内容：\n${text}`);
          if (result && onInsertToEditor) {
            onInsertToEditor(result);
          }
        }
        break;
      case 'translate':
        if (onAiAsk) {
          const result = await onAiAsk(`请翻译成中文：\n${text}`);
          if (result && onInsertToEditor) {
            onInsertToEditor(result);
          }
        }
        break;
      case 'improve':
        if (onAiAsk) {
          const result = await onAiAsk(`请改进以下内容：\n${text}`);
          if (result && onInsertToEditor) {
            onInsertToEditor(result);
          }
        }
        break;
      case 'extract_tasks':
        if (onSaveAsTask && onCreateTask) {
          const firstLine = text.split('\n')[0]?.slice(0, 50) || '新建任务';
          onSaveAsTask(text);
          onCreateTask(firstLine);
        }
        break;
      default:
        break;
    }

    onClose();
  };

  return (
    <div className="absolute z-50 top-[-48px] left-1/2 -translate-x-1/2 flex items-center gap-0.5 px-2 py-1.5 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-100 whitespace-nowrap">
      {actions.map((action) => (
        <button
          key={action.id}
          onClick={() => handleAction(action)}
          className="flex items-center gap-1 px-2.5 py-1.5 text-2xs font-medium text-gray-600 hover:text-accent hover:bg-accent/5 rounded-lg transition-all"
        >
          {action.icon && <span className="text-2xs">{action.icon}</span>}
          <span>{action.label}</span>
        </button>
      ))}
      <div className="w-px h-4 bg-gray-200 mx-0.5" />
      <button
        onClick={onClose}
        className="p-1 text-gray-300 hover:text-gray-500 rounded transition-colors"
      >
        ✕
      </button>
    </div>
  );
};

export default CopilotFloatingMenu;
