import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, isToday, isBefore, parseISO, startOfDay } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { v4 as uuidv4 } from 'uuid';
import FocusMode from './FocusMode';
import CalendarView from './CalendarView';
import {
  ListTodo, Plus, Check, Clock3, Trash2, Sparkles, X, Loader2, Link2, Timer,
  LayoutGrid, Calendar, Inbox, ChevronDown, ChevronRight, AlertTriangle,
  ArrowUp, ArrowRight, ArrowDown, GripVertical, Flag, MoreHorizontal,
  CircleDot, CheckCircle2, Circle
} from 'lucide-react';

interface SchedulesPanelProps {
  schedules: any[];
  selectedDate: Date;
  filteredSchedules: any[];
  onSelectDate: (date: Date) => void;
  onEditSchedule: (schedule: any) => void;
  onToggleStatus: (id: string, status: string) => void;
  onDeleteSchedule: (id: string) => void;
  onAISchedule: () => Promise<any>;
  onSaveTimeLog?: (log: any) => void;
  onQuickAddTodo?: (title: string, priority?: string, category?: string) => Promise<any>;
  onReorderSchedules?: (items: { id: string; sort_order: number }[]) => void;
  onUpdateScheduleStatus?: (id: string, status: string) => void;
}

const priorityConfig: Record<string, { label: string; color: string; icon: React.ReactNode; bg: string }> = {
  high: { label: '高', color: 'text-red-500', icon: <ArrowUp size={12} />, bg: 'bg-red-500/10 border-red-500/20' },
  medium: { label: '中', color: 'text-amber-500', icon: <ArrowRight size={12} />, bg: 'bg-amber-500/10 border-amber-500/20' },
  low: { label: '低', color: 'text-blue-400', icon: <ArrowDown size={12} />, bg: 'bg-blue-400/10 border-blue-400/20' },
};

const categoryColors: Record<string, string> = {
  '会议': 'bg-amber-500',
  '个人': 'bg-accent',
  '工作': 'bg-blue-500',
  '截止日期': 'bg-red-500',
  '学习': 'bg-purple-500',
  '其他': 'bg-zinc-400',
  '收件箱': 'bg-zinc-300',
};

type ViewMode = 'list' | 'kanban' | 'calendar';

const SchedulesPanel: React.FC<SchedulesPanelProps> = ({
  schedules, selectedDate, filteredSchedules,
  onSelectDate, onEditSchedule, onToggleStatus, onDeleteSchedule, onAISchedule,
  onSaveTimeLog, onQuickAddTodo, onReorderSchedules, onUpdateScheduleStatus,
}) => {
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<{ success: boolean; suggestions?: string; error?: string } | null>(null);
  const [focusModeOpen, setFocusModeOpen] = useState(false);
  const [focusSchedule, setFocusSchedule] = useState<any>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [quickInput, setQuickInput] = useState('');
  const [quickPriority, setQuickPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [showCompleted, setShowCompleted] = useState(false);
  const [kanbanDragItem, setKanbanDragItem] = useState<string | null>(null);

  const rootSchedules = useMemo(() =>
    schedules.filter((s: any) => !s.parent_id || s.parent_id === ''),
    [schedules]);

  const getSubTasks = useCallback((parentId: string) =>
    schedules.filter((s: any) => s.parent_id === parentId),
    [schedules]);

  const toggleExpand = (id: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const pendingTodos = useMemo(() =>
    rootSchedules.filter((s: any) => s.status === 'pending' || s.status === 'in_progress'),
    [rootSchedules]);

  const completedTodos = useMemo(() =>
    rootSchedules.filter((s: any) => s.status === 'completed'),
    [rootSchedules]);

  const overdueTodos = useMemo(() => {
    const today = startOfDay(new Date());
    return pendingTodos.filter((s: any) => {
      const due = s.due_date ? parseISO(s.due_date) : s.start_time ? parseISO(s.start_time) : null;
      return due && isBefore(due, today);
    });
  }, [pendingTodos]);

  const todayTodos = useMemo(() => {
    const today = new Date();
    return pendingTodos.filter((s: any) => {
      const start = s.start_time ? parseISO(s.start_time) : null;
      const due = s.due_date ? parseISO(s.due_date) : null;
      return (start && isToday(start)) || (due && isToday(due));
    });
  }, [pendingTodos]);

  const inboxTodos = useMemo(() =>
    rootSchedules.filter((s: any) =>
      (s.status === 'pending' || s.status === 'in_progress') &&
      (!s.category || s.category === '收件箱') && !s.parent_id),
    [rootSchedules]);

  const groupedByPriority = useMemo(() => ({
    high: pendingTodos.filter((s: any) => s.priority === 'high'),
    medium: pendingTodos.filter((s: any) => s.priority === 'medium'),
    low: pendingTodos.filter((s: any) => s.priority === 'low' || !s.priority),
  }), [pendingTodos]);

  const handleQuickAdd = async () => {
    if (!quickInput.trim() || !onQuickAddTodo) return;
    await onQuickAddTodo(quickInput.trim(), quickPriority);
    setQuickInput('');
  };

  const handleAIClick = async () => {
    setAiLoading(true);
    setAiResult(null);
    try {
      const result = await onAISchedule();
      setAiResult(result);
    } catch {
      setAiResult({ success: false, error: 'AI排程请求失败' });
    } finally {
      setAiLoading(false);
    }
  };

  const handleKanbanDrop = (targetStatus: string) => {
    if (kanbanDragItem && onUpdateScheduleStatus) {
      onUpdateScheduleStatus(kanbanDragItem, targetStatus);
    }
    setKanbanDragItem(null);
  };

  const renderTodoItem = (item: any, isSubTask: boolean = false) => {
    const subTasks = getSubTasks(item.id);
    const hasSubTasks = subTasks.length > 0;
    const isExpanded = expandedTasks.has(item.id);
    const isOverdue = (() => {
      if (item.status === 'completed') return false;
      const due = item.due_date ? parseISO(item.due_date) : item.start_time ? parseISO(item.start_time) : null;
      return due && isBefore(due, startOfDay(new Date()));
    })();
    const pri = priorityConfig[item.priority || 'medium'] ?? { label: '中', color: 'text-amber-500', icon: <ArrowRight size={12} />, bg: 'bg-amber-500/10 border-amber-500/20' };
    const linkedMemoIds = (() => {
      const lm = item.linked_memos;
      return lm ? (typeof lm === 'string' ? JSON.parse(lm) : lm) : (item.memo_id ? [item.memo_id] : []);
    })();
    const catColor = categoryColors[item.category] || 'bg-zinc-400';

    return (
      <motion.div
        key={item.id}
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={`group rounded-2xl border transition-all duration-200 ${
          isSubTask ? 'ml-8 border-teal-900/5 bg-white/50' :
          item.status === 'completed' ? 'border-teal-900/5 bg-white/30' :
          isOverdue ? 'border-red-500/30 bg-red-50/50' :
          'border-teal-900/10 bg-white hover:border-accent/20 hover:shadow-sm'
        }`}
      >
        <div className={`flex items-center gap-3 ${isSubTask ? 'px-3 py-2.5' : 'px-4 py-3.5'}`}>
          <button
            onClick={() => onToggleStatus(item.id, item.status)}
            className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all shrink-0 ${
              item.status === 'completed'
                ? 'bg-green-500 border-green-600 text-white'
                : item.status === 'in_progress'
                ? 'bg-accent/10 border-accent text-accent'
                : 'bg-white border-teal-900/15 text-transparent hover:border-accent hover:text-accent/30'
            }`}
          >
            {item.status === 'completed' ? <Check size={11} /> :
             item.status === 'in_progress' ? <CircleDot size={11} /> :
             <Circle size={11} />}
          </button>

          {!isSubTask && (
            <span className={`flex items-center gap-0.5 text-2xs font-bold px-1.5 py-0.5 rounded-md border ${pri.bg} ${pri.color} shrink-0`}>
              {pri.icon}{pri.label}
            </span>
          )}

          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onEditSchedule(item)}>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium truncate ${item.status === 'completed' ? 'line-through text-muted' : 'text-foreground'}`}>
                {item.title}
              </span>
              {!isSubTask && (
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${catColor}`} title={item.category} />
              )}
            </div>
            <div className="flex items-center gap-2 text-2xs font-medium text-muted mt-0.5">
              {item.start_time && (
                <span className="flex items-center gap-0.5">
                  <Clock3 size={9} />{format(parseISO(item.start_time), 'MM/dd HH:mm')}
                </span>
              )}
              {item.due_date && (
                <span className={`flex items-center gap-0.5 ${isOverdue ? 'text-red-500 font-bold' : ''}`}>
                  <Flag size={9} />截止 {format(parseISO(item.due_date), 'MM/dd')}
                </span>
              )}
              {linkedMemoIds.length > 0 && (
                <span className="flex items-center gap-0.5 border-l border-teal-900/10 pl-2 text-accent/70">
                  <Link2 size={9} />{linkedMemoIds.length}
                </span>
              )}
              {hasSubTasks && (
                <span className="border-l border-teal-900/10 pl-2">
                  {subTasks.filter((st: any) => st.status === 'completed').length}/{subTasks.length}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {hasSubTasks && (
              <button onClick={() => toggleExpand(item.id)} className="p-1.5 rounded-lg hover:bg-accent/10 text-muted hover:text-accent transition-colors" title={isExpanded ? '收起子任务' : '展开子任务'}>
                {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </button>
            )}
            <button
              onClick={() => { setFocusSchedule(item); setFocusModeOpen(true); }}
              className="p-1.5 rounded-lg hover:bg-accent/10 text-muted hover:text-accent transition-colors"
              title="专注模式"
            >
              <Timer size={13} />
            </button>
            <button
              onClick={() => onDeleteSchedule(item.id)}
              className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted hover:text-red-500 transition-colors"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        <AnimatePresence>
          {isExpanded && hasSubTasks && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden pb-2"
            >
              {subTasks.map((st: any) => renderTodoItem(st, true))}
              <div className="ml-8 px-3 py-1">
                <button
                  onClick={() => onEditSchedule({
                    id: uuidv4(), title: '', content: '',
                    start_time: new Date().toISOString(), status: 'pending',
                    category: item.category || '工作', parent_id: item.id, priority: 'medium'
                  })}
                  className="text-2xs font-bold text-muted hover:text-accent transition-colors flex items-center gap-1"
                >
                  <Plus size={10} />添加子任务
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  const renderListView = () => (
    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pb-4">
      {overdueTodos.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2 px-1">
            <AlertTriangle size={13} className="text-red-500" />
            <span className="text-2xs font-black uppercase tracking-wider text-red-500">已逾期</span>
            <span className="text-2xs px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500 font-bold">{overdueTodos.length}</span>
          </div>
          <div className="space-y-2">{overdueTodos.map(item => renderTodoItem(item))}</div>
        </div>
      )}

      {inboxTodos.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2 px-1">
            <Inbox size={13} className="text-muted" />
            <span className="text-2xs font-black uppercase tracking-wider text-muted">收件箱</span>
            <span className="text-2xs px-1.5 py-0.5 rounded-full bg-zinc-100 text-muted font-bold">{inboxTodos.length}</span>
          </div>
          <div className="space-y-2">{inboxTodos.map(item => renderTodoItem(item))}</div>
        </div>
      )}

      {groupedByPriority.high.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2 px-1">
            <ArrowUp size={13} className="text-red-500" />
            <span className="text-2xs font-black uppercase tracking-wider text-red-500">高优先级</span>
            <span className="text-2xs px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500 font-bold">{groupedByPriority.high.length}</span>
          </div>
          <div className="space-y-2">{groupedByPriority.high.map(item => renderTodoItem(item))}</div>
        </div>
      )}

      {groupedByPriority.medium.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2 px-1">
            <ArrowRight size={13} className="text-amber-500" />
            <span className="text-2xs font-black uppercase tracking-wider text-amber-500">中优先级</span>
            <span className="text-2xs px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-bold">{groupedByPriority.medium.length}</span>
          </div>
          <div className="space-y-2">{groupedByPriority.medium.map(item => renderTodoItem(item))}</div>
        </div>
      )}

      {groupedByPriority.low.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2 px-1">
            <ArrowDown size={13} className="text-blue-400" />
            <span className="text-2xs font-black uppercase tracking-wider text-blue-400">低优先级</span>
            <span className="text-2xs px-1.5 py-0.5 rounded-full bg-blue-400/10 text-blue-400 font-bold">{groupedByPriority.low.length}</span>
          </div>
          <div className="space-y-2">{groupedByPriority.low.map(item => renderTodoItem(item))}</div>
        </div>
      )}

      {completedTodos.length > 0 && (
        <div>
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="flex items-center gap-2 mb-2 px-1 text-muted hover:text-foreground transition-colors"
          >
            <CheckCircle2 size={13} />
            <span className="text-2xs font-black uppercase tracking-wider">已完成</span>
            <span className="text-2xs px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600 font-bold">{completedTodos.length}</span>
            {showCompleted ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
          <AnimatePresence>
            {showCompleted && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden space-y-2"
              >
                {completedTodos.map(item => renderTodoItem(item))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {pendingTodos.length === 0 && completedTodos.length === 0 && (
        <div className="h-56 flex flex-col items-center justify-center text-muted">
          <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-3">
            <CheckCircle2 size={24} className="text-accent" />
          </div>
          <p className="text-sm font-bold">太棒了，没有待办事项！</p>
          <p className="text-xs mt-1">在上方输入框快速添加</p>
        </div>
      )}
    </div>
  );

  const renderKanbanView = () => {
    const columns = [
      { key: 'pending', label: '待办', items: rootSchedules.filter((s: any) => s.status === 'pending'), color: 'border-blue-400', bg: 'bg-blue-50' },
      { key: 'in_progress', label: '进行中', items: rootSchedules.filter((s: any) => s.status === 'in_progress'), color: 'border-amber-400', bg: 'bg-amber-50' },
      { key: 'completed', label: '已完成', items: rootSchedules.filter((s: any) => s.status === 'completed'), color: 'border-green-400', bg: 'bg-green-50' },
    ];
    return (
      <div className="flex-1 grid grid-cols-3 gap-4 overflow-hidden">
        {columns.map(col => (
          <div
            key={col.key}
            className={`flex flex-col rounded-2xl border ${col.color}/30 bg-white/50 overflow-hidden`}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
            onDrop={() => handleKanbanDrop(col.key)}
          >
            <div className={`px-4 py-3 border-b ${col.color}/20 ${col.bg}/50 flex items-center gap-2`}>
              <span className="text-xs font-black">{col.label}</span>
              <span className="text-2xs px-1.5 py-0.5 rounded-full bg-white/80 font-bold text-muted">{col.items.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
              {col.items.map(item => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => setKanbanDragItem(item.id)}
                  onDragEnd={() => setKanbanDragItem(null)}
                  className="p-3 rounded-xl bg-white border border-teal-900/5 cursor-grab active:cursor-grabbing hover:border-accent/20 hover:shadow-sm transition-all"
                  onClick={() => onEditSchedule(item)}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`text-xs font-bold px-1 py-0.5 rounded ${priorityConfig[item.priority || 'medium']?.bg || 'bg-amber-500/10'} ${priorityConfig[item.priority || 'medium']?.color || 'text-amber-500'}`}>
                      {priorityConfig[item.priority || 'medium']?.label || '中'}
                    </span>
                    <div className={`w-1.5 h-1.5 rounded-full ${categoryColors[item.category] || 'bg-zinc-400'}`} />
                    <span className="text-xs font-medium text-foreground truncate flex-1">{item.title}</span>
                  </div>
                  {item.due_date && (
                    <div className="text-2xs text-muted flex items-center gap-1">
                      <Flag size={9} />截止 {format(parseISO(item.due_date), 'MM/dd')}
                    </div>
                  )}
                  {getSubTasks(item.id).length > 0 && (
                    <div className="text-2xs text-muted mt-1">
                      子任务 {getSubTasks(item.id).filter((st: any) => st.status === 'completed').length}/{getSubTasks(item.id).length}
                    </div>
                  )}
                </div>
              ))}
              {col.items.length === 0 && (
                <div className="h-24 flex items-center justify-center text-muted/30 text-xs">
                  拖拽到这里
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderCalendarView = () => (
    <div className="flex-1 flex gap-6 min-h-0 overflow-hidden">
      <div className="flex-[1.8] flex flex-col min-h-0">
        <CalendarView
          schedules={schedules}
          selectedDate={selectedDate}
          onSelectDate={onSelectDate}
          onAddSchedule={(date) => {
            onSelectDate(date);
            onEditSchedule({
              id: uuidv4(), title: '', content: '',
              start_time: date.toISOString(), status: 'pending', category: '工作', priority: 'medium'
            });
          }}
          onEditSchedule={onEditSchedule}
        />
      </div>
      <div className="flex-1 flex flex-col min-h-0 bg-white/40 backdrop-blur-xl rounded-[2rem] border border-teal-900/10 shadow-glass overflow-hidden">
        <div className="px-6 py-5 border-b border-teal-900/5 bg-white/20 flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">日程详情</h3>
          <span className="px-2 py-0.5 rounded-lg bg-accent/10 text-2xs font-bold text-accent uppercase tracking-wider">
            {format(selectedDate, 'EEEE', { locale: zhCN })}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
          <AnimatePresence mode="popLayout">
            {filteredSchedules.length === 0 ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="h-full flex flex-col items-center justify-center text-muted gap-3 py-10">
                <div className="w-12 h-12 rounded-2xl bg-teal-900/5 flex items-center justify-center"><ListTodo size={24} className="opacity-20" /></div>
                <p className="text-xs font-medium">该日暂无安排</p>
              </motion.div>
            ) : (
              filteredSchedules.map((item: any) => renderTodoItem(item))
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );

  return (
    <motion.div
      key="schedules"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      className="max-w-7xl mx-auto h-full flex flex-col w-full px-4"
    >
      <div className="mb-4 flex items-center justify-between px-2">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
            <ListTodo size={20} />
          </div>
          <div>
            <h2 className="text-2xl font-display font-bold text-foreground tracking-tight">待办事项</h2>
            <p className="text-2xs text-muted font-medium mt-0.5">
              {pendingTodos.length} 待办 · {todayTodos.length} 今日 · {overdueTodos.length} 逾期 · {completedTodos.length} 完成
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-teal-900/10 overflow-hidden">
            {([
              { key: 'list' as ViewMode, icon: <ListTodo size={14} />, label: '清单' },
              { key: 'kanban' as ViewMode, icon: <LayoutGrid size={14} />, label: '看板' },
              { key: 'calendar' as ViewMode, icon: <Calendar size={14} />, label: '日历' },
            ]).map(v => (
              <button
                key={v.key}
                onClick={() => setViewMode(v.key)}
                className={`px-3 py-2 text-xs font-bold flex items-center gap-1 transition-colors ${
                  viewMode === v.key ? 'bg-accent text-white' : 'bg-white/60 text-muted hover:text-foreground'
                }`}
              >
                {v.icon}{v.label}
              </button>
            ))}
          </div>
          <button
            onClick={handleAIClick}
            disabled={aiLoading}
            className="flex items-center gap-2 px-4 py-2.5 bg-accent/10 text-accent rounded-xl text-xs font-bold hover:bg-accent/20 transition-all active:scale-95 disabled:opacity-50"
          >
            {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {aiLoading ? '分析中...' : 'AI 排程'}
          </button>
          <button
            onClick={() => onEditSchedule({
              id: uuidv4(), title: '', content: '',
              start_time: new Date().toISOString(), status: 'pending', category: '工作', priority: 'medium'
            })}
            className="flex items-center gap-2 px-5 py-2.5 bg-accent text-white rounded-xl text-xs font-bold hover:bg-accent/90 transition-all shadow-premium active:scale-95"
          >
            <Plus size={16} />
            新增待办
          </button>
        </div>
      </div>

      {viewMode === 'list' && (
        <div className="mb-4 flex gap-2">
          <div className="flex-1 relative">
            <Plus size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={quickInput}
              onChange={(e) => setQuickInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleQuickAdd()}
              placeholder="快速添加待办，回车创建..."
              className="w-full pl-10 pr-4 py-3 bg-white/60 border border-teal-900/5 rounded-2xl text-sm outline-none focus:border-accent/30 focus:bg-white transition-all placeholder:text-muted/40"
            />
          </div>
          <div className="flex rounded-2xl border border-teal-900/10 overflow-hidden">
            {(['high', 'medium', 'low'] as const).map(p => (
              <button
                key={p}
                onClick={() => setQuickPriority(p)}
                className={`px-3 py-3 text-xs font-bold flex items-center gap-1 transition-colors ${
                  quickPriority === p ? `${priorityConfig[p]?.bg ?? ''} ${priorityConfig[p]?.color ?? ''}` : 'bg-white/60 text-muted hover:text-foreground'
                }`}
              >
                {priorityConfig[p]?.icon}
              </button>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence>
        {aiResult && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 overflow-hidden"
          >
            <div className={`mx-2 p-4 rounded-2xl border ${aiResult.success ? 'bg-accent/5 border-accent/20' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles size={14} className={aiResult.success ? 'text-accent' : 'text-red-500'} />
                    <h4 className={`text-xs font-bold ${aiResult.success ? 'text-accent' : 'text-red-600'}`}>
                      {aiResult.success ? 'AI 排程建议' : '排程失败'}
                    </h4>
                  </div>
                  {aiResult.success && aiResult.suggestions ? (
                    <div className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto custom-scrollbar">
                      {aiResult.suggestions}
                    </div>
                  ) : (
                    <p className="text-xs text-red-600">{aiResult.error || '未知错误'}</p>
                  )}
                </div>
                <button onClick={() => setAiResult(null)} className="w-6 h-6 rounded-lg flex items-center justify-center text-muted hover:text-foreground hover:bg-black/5 transition-all shrink-0">
                  <X size={14} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {viewMode === 'list' && renderListView()}
      {viewMode === 'kanban' && renderKanbanView()}
      {viewMode === 'calendar' && renderCalendarView()}

      <FocusMode
        isOpen={focusModeOpen}
        onClose={() => setFocusModeOpen(false)}
        schedule={focusSchedule}
        onSaveTimeLog={(log: any) => { onSaveTimeLog?.(log); setFocusModeOpen(false); }}
      />
    </motion.div>
  );
};

export default SchedulesPanel;
