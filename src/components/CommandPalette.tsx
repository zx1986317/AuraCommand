import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Calendar, MessageCircle, BookOpen, LayoutGrid,
  Sparkles, Settings, Tag, Plus, Trash2, Edit3, Clock,
  Workflow, Brain, Eye, Search, Zap, ArrowRight, X, Hash
} from 'lucide-react';

interface Command {
  id: string;
  label: string;
  category: string;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: 'memos' | 'chat' | 'tasks' | 'kb' | 'canvas' | 'insight' | 'workflows') => void;
  onCreateMemo: () => void;
  onEditMemo: (memo: any) => void;
  onDeleteMemo: (id: string) => void;
  onAISchedule: () => void;
  onExecuteWorkflow: (id: string) => void;
  onOpenSettings: () => void;
  onOpenTagManager: () => void;
  onOpenSearch: () => void;
  onClipboardOCR: () => void;
  onNewChat: () => void;
  onRefreshInsight: () => void;
  memos: any[];
  workflows: any[];
}

const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen, onClose, onNavigate, onCreateMemo, onEditMemo, onDeleteMemo,
  onAISchedule, onExecuteWorkflow, onOpenSettings, onOpenTagManager,
  onOpenSearch, onClipboardOCR, onNewChat, onRefreshInsight, memos, workflows,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const commands = useMemo<Command[]>(() => {
    const base: Command[] = [
      { id: 'nav-memos', label: '导航到智能便签', category: '导航', icon: <FileText size={14} className="text-teal-600" />, shortcut: '1', action: () => onNavigate('memos') },
      { id: 'nav-chat', label: '导航到 AI 助手', category: '导航', icon: <MessageCircle size={14} className="text-blue-600" />, shortcut: '2', action: () => onNavigate('chat') },
      { id: 'nav-schedules', label: '导航到待办事项', category: '导航', icon: <Calendar size={14} className="text-purple-600" />, shortcut: '3', action: () => onNavigate('tasks') },
      { id: 'nav-kb', label: '导航到知识库', category: '导航', icon: <BookOpen size={14} className="text-orange-600" />, shortcut: '4', action: () => onNavigate('kb') },
      { id: 'nav-canvas', label: '导航到 AI 画布', category: '导航', icon: <LayoutGrid size={14} className="text-pink-600" />, shortcut: '5', action: () => onNavigate('canvas') },
      { id: 'nav-insight', label: '导航到今日洞察', category: '导航', icon: <Sparkles size={14} className="text-amber-600" />, shortcut: '6', action: () => onNavigate('insight') },
      { id: 'nav-workflows', label: '导航到自动化任务', category: '导航', icon: <Workflow size={14} className="text-green-600" />, shortcut: '7', action: () => onNavigate('workflows') },
      { id: 'search', label: '全局搜索', category: '工具', icon: <Search size={14} className="text-teal-600" />, shortcut: 'Ctrl+K', action: () => { onOpenSearch(); onClose(); } },
      { id: 'new-memo', label: '新建便签', category: '便签', icon: <Plus size={14} className="text-teal-600" />, action: () => { onCreateMemo(); onClose(); } },
      { id: 'ocr-clip', label: 'OCR 识别剪贴板', category: '便签', icon: <Eye size={14} className="text-teal-600" />, action: () => { onClipboardOCR(); onClose(); } },
      { id: 'ai-schedule', label: 'AI 生成日程', category: '日程', icon: <Brain size={14} className="text-purple-600" />, action: () => { onNavigate('tasks'); onAISchedule(); onClose(); } },
      { id: 'refresh-insight', label: '刷新今日洞察', category: '工具', icon: <Zap size={14} className="text-amber-600" />, action: () => { onNavigate('insight'); onRefreshInsight(); onClose(); } },
      { id: 'new-chat', label: '新建对话', category: 'AI', icon: <MessageCircle size={14} className="text-blue-600" />, action: () => { onNavigate('chat'); onNewChat(); onClose(); } },
      { id: 'tag-manager', label: '打开标签管理', category: '工具', icon: <Tag size={14} className="text-teal-600" />, action: () => { onOpenTagManager(); onClose(); } },
      { id: 'settings', label: '打开设置', category: '设置', icon: <Settings size={14} className="text-gray-600" />, action: () => { onOpenSettings(); onClose(); } },
    ];

    memos.slice(0, 8).forEach(m => {
      base.push({
        id: `memo-edit-${m.id}`,
        label: `编辑便签: ${m.title || '未命名'}`,
        category: '便签',
        icon: <Edit3 size={14} className="text-teal-600" />,
        action: () => { onNavigate('memos'); onEditMemo(m); onClose(); },
      });
    });

    workflows.forEach(wf => {
      base.push({
        id: `wf-exec-${wf.id}`,
        label: `执行工作流: ${wf.name || '未命名'}`,
        category: '工作流',
        icon: <Workflow size={14} className="text-green-600" />,
        action: () => { onExecuteWorkflow(wf.id); onClose(); },
      });
    });

    return base;
  }, [memos, workflows, onNavigate, onCreateMemo, onClipboardOCR, onAISchedule,
      onEditMemo, onDeleteMemo, onExecuteWorkflow, onOpenSettings, onOpenTagManager,
      onOpenSearch, onNewChat, onRefreshInsight, onClose]);

  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(c => c.label.toLowerCase().includes(q) || c.category.toLowerCase().includes(q));
  }, [commands, query]);

  const grouped = useMemo(() => {
    const groups: Record<string, Command[]> = {};
    const order = ['导航', '便签', '日程', 'AI', '工作流', '工具', '设置'];
    for (const cat of order) {
      const items = filtered.filter(c => c.category === cat);
      if (items.length > 0) groups[cat] = items;
    }
    const rest = filtered.filter(c => !order.includes(c.category));
    if (rest.length > 0) groups['其他'] = rest;
    return groups;
  }, [filtered]);

  const flatList = useMemo(() => {
    const list: Command[] = [];
    for (const items of Object.values(grouped)) list.push(...items);
    return list;
  }, [grouped]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, flatList.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && flatList[selectedIndex]) {
      flatList[selectedIndex].action();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const categoryLabels: Record<string, string> = {
    '导航': '导航', '便签': '便签', '日程': '日程',
    'AI': 'AI', '工作流': '工作流', '工具': '工具', '设置': '设置',
  };

  let globalIndex = 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[10000] flex items-start justify-center pt-[12vh]"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="w-full max-w-xl bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-teal-900/10 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-5 py-4 border-b border-teal-900/5">
              <Zap size={18} className="text-accent shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入指令... (Ctrl+Shift+P)"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-teal-900/30"
              />
              <span className="text-xs text-muted font-mono">{flatList.length} 条指令</span>
              <button onClick={onClose} className="text-muted hover:text-foreground transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="max-h-[45vh] overflow-y-auto custom-scrollbar">
              {flatList.length === 0 && query && (
                <div className="py-12 text-center text-muted text-xs">
                  未找到匹配的指令
                </div>
              )}

              {Object.entries(grouped).map(([cat, items]) => (
                <div key={cat}>
                  <div className="px-5 py-1.5 bg-teal-900/[0.02] border-b border-teal-900/5">
                    <span className="text-xs font-bold text-muted uppercase tracking-wider">{categoryLabels[cat] || cat}</span>
                  </div>
                  {items.map(cmd => {
                    const idx = globalIndex++;
                    const isSelected = idx === selectedIndex;
                    return (
                      <button
                        key={cmd.id}
                        onClick={() => cmd.action()}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`w-full text-left px-5 py-2.5 flex items-center gap-3 transition-all border-b border-teal-900/5 last:border-0 cursor-pointer ${
                          isSelected ? 'bg-accent/5' : 'hover:bg-teal-900/[0.02]'
                        }`}
                      >
                        <div className="shrink-0">{cmd.icon}</div>
                        <span className={`text-xs font-medium flex-1 truncate ${isSelected ? 'text-foreground' : 'text-foreground/80'}`}>
                          {cmd.label}
                        </span>
                        {cmd.shortcut && (
                          <kbd className="px-1.5 py-0.5 bg-teal-900/5 rounded text-xs font-mono text-muted shrink-0">{cmd.shortcut}</kbd>
                        )}
                        {isSelected && <ArrowRight size={12} className="text-accent shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="px-5 py-2 border-t border-teal-900/5 bg-white/50 flex items-center justify-between">
              <span className="text-xs text-muted">↑↓ 导航 · Enter 执行 · Esc 关闭</span>
              <span className="text-xs text-accent/50 flex items-center gap-1">
                <Zap size={9} /> Command Palette
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CommandPalette;