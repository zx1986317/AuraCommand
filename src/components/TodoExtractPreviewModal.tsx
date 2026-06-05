import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckSquare, Square, Loader2, Check, ListTodo } from 'lucide-react';

interface ExtractedTodo {
  title: string;
  description?: string;
  priority?: 'high' | 'medium' | 'low';
  selected: boolean;
}

interface TodoExtractPreviewModalProps {
  isOpen: boolean;
  messageContent: string;
  onClose: () => void;
  onConfirm: (todos: { title: string; description?: string; priority?: string }[]) => void;
}

const TodoExtractPreviewModal: React.FC<TodoExtractPreviewModalProps> = ({
  isOpen,
  messageContent,
  onClose,
  onConfirm,
}) => {
  const [todos, setTodos] = useState<ExtractedTodo[]>([]);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);

  useEffect(() => {
    if (isOpen && messageContent) {
      extractTodos();
    }
  }, [isOpen, messageContent]);

  const extractTodos = async () => {
    setExtracting(true);
    try {
      const prompt = `请从以下内容中提取待办事项，以JSON数组格式返回，每个待办包含 title（必填）、description（可选）、priority（high/medium/low，可选）字段。只返回JSON，不要其他文字：\n\n${messageContent.substring(0, 2000)}`;
      const result = await window.ipcRenderer.invoke('ask-ai', prompt);
      if (result?.success) {
        try {
          const jsonMatch = result.answer.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            setTodos(parsed.map((t: any) => ({
              title: t.title || t.name || '',
              description: t.description || t.desc || '',
              priority: t.priority || 'medium',
              selected: true,
            })));
          } else {
            setTodos([{ title: messageContent.substring(0, 100), priority: 'medium', selected: true }]);
          }
        } catch {
          setTodos([{ title: messageContent.substring(0, 100), priority: 'medium', selected: true }]);
        }
      } else {
        setTodos([{ title: messageContent.substring(0, 100), priority: 'medium', selected: true }]);
      }
    } catch {
      setTodos([{ title: messageContent.substring(0, 100), priority: 'medium', selected: true }]);
    }
    setExtracting(false);
  };

  const toggleTodo = (index: number) => {
    setTodos(prev => prev.map((t, i) => i === index ? { ...t, selected: !t.selected } : t));
  };

  const updateTodoTitle = (index: number, title: string) => {
    setTodos(prev => prev.map((t, i) => i === index ? { ...t, title } : t));
  };

  const updateTodoPriority = (index: number, priority: string) => {
    setTodos(prev => prev.map((t, i) => i === index ? { ...t, priority: priority as 'low' | 'medium' | 'high' } : t));
  };

  const removeTodo = (index: number) => {
    setTodos(prev => prev.filter((_, i) => i !== index));
  };

  const handleConfirm = () => {
    const selectedTodos = todos.filter(t => t.selected && t.title.trim());
    if (selectedTodos.length > 0) {
      onConfirm(selectedTodos.map(t => ({
        title: t.title,
        ...(t.description ? { description: t.description } : {}),
        ...(t.priority ? { priority: t.priority } : {}),
      })));
    }
    onClose();
  };

  const selectedCount = todos.filter(t => t.selected).length;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-2xl shadow-2xl w-[500px] max-h-[70vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <ListTodo size={18} className="text-accent" />
              <h2 className="text-sm font-bold text-gray-800">提取待办事项</h2>
              <span className="text-2xs text-gray-400">({selectedCount} 项选中)</span>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all">
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {extracting ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 size={24} className="text-accent animate-spin mb-3" />
                <p className="text-xs text-gray-400">正在分析内容，提取待办...</p>
              </div>
            ) : todos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-300">
                <CheckSquare size={24} className="mb-2" />
                <p className="text-xs">未提取到待办事项</p>
              </div>
            ) : (
              <div className="space-y-2">
                {todos.map((todo, idx) => (
                  <div
                    key={idx}
                    className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                      todo.selected ? 'bg-accent/5 border-accent/20' : 'bg-gray-50 border-gray-100'
                    }`}
                  >
                    <button
                      onClick={() => toggleTodo(idx)}
                      className="mt-0.5 shrink-0"
                    >
                      {todo.selected ? (
                        <CheckSquare size={16} className="text-accent" />
                      ) : (
                        <Square size={16} className="text-gray-300" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <input
                        type="text"
                        value={todo.title}
                        onChange={(e) => updateTodoTitle(idx, e.target.value)}
                        className="w-full text-xs font-medium text-gray-700 bg-transparent border-none outline-none"
                        placeholder="待办标题"
                      />
                      {todo.description && (
                        <p className="text-2xs text-gray-400 mt-0.5">{todo.description}</p>
                      )}
                    </div>
                    <select
                      value={todo.priority || 'medium'}
                      onChange={(e) => updateTodoPriority(idx, e.target.value)}
                      className="text-2xs text-gray-500 bg-transparent border border-gray-200 rounded-lg px-2 py-1 outline-none"
                    >
                      <option value="high">高</option>
                      <option value="medium">中</option>
                      <option value="low">低</option>
                    </select>
                    <button
                      onClick={() => removeTodo(idx)}
                      className="text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs text-gray-500 hover:bg-gray-100 rounded-lg transition-all"
            >
              取消
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedCount === 0}
              className="flex items-center gap-1.5 px-4 py-2 bg-accent text-white text-xs font-medium rounded-lg hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <Check size={14} />
              确认添加 ({selectedCount})
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default TodoExtractPreviewModal;
