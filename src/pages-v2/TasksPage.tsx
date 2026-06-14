import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckSquare, Plus, Calendar, Clock, AlertCircle, CheckCircle2, Circle, Inbox, ArrowRight, Search, ChevronDown, ChevronUp, Pencil, Save, X, XCircle, List, LayoutGrid, FolderKanban, FileText, Hourglass } from 'lucide-react';
import { useTasks, type Task } from '../hooks/useTasks';
import { useAppStore } from '../store/appStore';
import { useConfirmDelete } from '../hooks/useConfirmDelete';
import { EmptyState } from '../components/common/EmptyState';
import CalendarView from '../components/CalendarView';
import Modal from '../components/Modal';

const statusConfig: Record<string, { label: string; icon: React.FC<any>; color: string; accent: string; activeBg: string }> = {
  inbox: { label: '收件箱', icon: Inbox, color: 'slate', accent: 'bg-slate-100 text-slate-700', activeBg: 'bg-slate-100' },
  today: { label: '今天', icon: Calendar, color: 'amber', accent: 'bg-amber-100 text-amber-700', activeBg: 'bg-amber-100' },
  next: { label: '下一步', icon: ArrowRight, color: 'blue', accent: 'bg-blue-100 text-blue-700', activeBg: 'bg-blue-100' },
  waiting: { label: '等待中', icon: Hourglass, color: 'purple', accent: 'bg-purple-100 text-purple-700', activeBg: 'bg-purple-100' },
  done: { label: '已完成', icon: CheckCircle2, color: 'green', accent: 'bg-green-100 text-green-700', activeBg: 'bg-green-100' },
};

const priorityConfig = {
  urgent: { label: '紧急', chipClass: 'bg-red-200 text-red-800' },
  high: { label: '高', chipClass: 'bg-red-100 text-red-700' },
  medium: { label: '中', chipClass: 'bg-amber-100 text-amber-700' },
  low: { label: '低', chipClass: 'bg-slate-100 text-slate-700' },
};

const tagColors = [
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-purple-100 text-purple-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
  'bg-orange-100 text-orange-700',
  'bg-pink-100 text-pink-700',
];

function getTagColor(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  return tagColors[Math.abs(hash) % tagColors.length] ?? 'bg-blue-100 text-blue-700';
}

const TasksPage: React.FC = () => {
  const { tasks, tasksByStatus, saveTask, deleteTask, updateTaskStatus, createTask } = useTasks();
  const { confirmState, requestConfirm, handleConfirm, handleCancel } = useConfirmDelete();

  const [quickAddTitle, setQuickAddTitle] = React.useState('');
  const [quickAddPriority, setQuickAddPriority] = React.useState<'high' | 'medium' | 'low'>('medium');
  const [quickAddDueDate, setQuickAddDueDate] = React.useState('');
  const [quickAddExpanded, setQuickAddExpanded] = React.useState(false);
  const [selectedStatus, setSelectedStatus] = React.useState<Task['status'] | 'all'>('all');
  const [selectedTask, setSelectedTask] = React.useState<Task | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isEditing, setIsEditing] = React.useState(false);
  const [editDraft, setEditDraft] = React.useState<Partial<Task>>({});
  const [selectedTagFilter, setSelectedTagFilter] = React.useState<string | null>(null);
  const [tagInput, setTagInput] = React.useState('');

  const allTaskTags = React.useMemo(() => {
    const tagSet = new Set<string>();
    tasks.forEach(task => {
      if (task.tags && Array.isArray(task.tags)) {
        task.tags.forEach((t: string) => tagSet.add(t));
      }
    });
    return Array.from(tagSet).sort();
  }, [tasks]);
  const [taskView, setTaskView] = React.useState<'list' | 'calendar' | 'kanban'>('list');
  const [calendarSelectedDate, setCalendarSelectedDate] = React.useState(new Date());

  const [projects, setProjects] = React.useState<string[]>([]);
  const { setCurrentProjectName, currentProjectName } = useAppStore();
  const selectedProject = currentProjectName;
  const setSelectedProject = React.useCallback((name: string | null) => setCurrentProjectName(name), [setCurrentProjectName]);
  const [projectTaskIds, setProjectTaskIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!window.ipcRenderer) return;
    window.ipcRenderer.invoke('list-projects').then((r: string[]) => setProjects(r || [])).catch(() => {});
  }, []);

  React.useEffect(() => {
    if (!selectedProject || !window.ipcRenderer) { setProjectTaskIds([]); return; }
    window.ipcRenderer.invoke('list-project-items', { projectName: selectedProject })
      .then((r: any) => { setProjectTaskIds((r.tasks || []).map((t: any) => t.id)); })
      .catch(() => {});
  }, [selectedProject]);

  const [showProjectPickerFor, setShowProjectPickerFor] = React.useState<{ type: string; id: string } | null>(null);
  const [newProjectName, setNewProjectName] = React.useState('');

  React.useEffect(() => {
    const handler = () => {
      setQuickAddExpanded(true);
      setTimeout(() => {
        const input = document.querySelector<HTMLInputElement>('[data-quick-add-task]');
        input?.focus();
      }, 50);
    };
    window.addEventListener('focus-quick-add-task', handler);
    return () => window.removeEventListener('focus-quick-add-task', handler);
  }, []);

  const filteredTasks = React.useMemo(() => {
    let result = tasks;
    if (selectedStatus !== 'all') {
      result = result.filter(task => task.status === selectedStatus);
    }
    if (selectedTagFilter) {
      result = result.filter(task => task.tags && Array.isArray(task.tags) && task.tags.includes(selectedTagFilter));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(task =>
        task.title.toLowerCase().includes(q) ||
        (task.description || '').toLowerCase().includes(q) ||
        (task.source_title || '').toLowerCase().includes(q)
      );
    }
    if (selectedProject) {
      result = result.filter(task => projectTaskIds.includes(task.id));
    }
    return result.sort((a, b) => {
      const priorityOrder: Record<string, number> = { urgent: -1, high: 0, medium: 1, low: 2 };
      const aP = priorityOrder[a.priority || 'medium'] ?? 1;
      const bP = priorityOrder[b.priority || 'medium'] ?? 1;
      if (aP !== bP) return aP - bP;
      if (a.due_date && b.due_date) return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [tasks, selectedStatus, searchQuery, selectedTagFilter, projectTaskIds]);

  const overdueTasks = React.useMemo(() => {
    const now = new Date();
    return tasks.filter(t => t.status !== 'done' && t.due_date && new Date(t.due_date) < now);
  }, [tasks]);

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAddTitle.trim()) return;
    const newTask = createTask({
      title: quickAddTitle.trim(),
      status: 'inbox',
      priority: quickAddPriority,
      ...(quickAddDueDate ? { due_date: quickAddDueDate } : {}),
    });
    await saveTask(newTask);
    setQuickAddTitle('');
    setQuickAddDueDate('');
    setQuickAddPriority('medium');
    setQuickAddExpanded(false);
  };

  const handleDeleteTask = async (id: string) => {
    await deleteTask(id);
    if (selectedTask?.id === id) setSelectedTask(null);
  };

  const handleMoveStatus = async (id: string, status: Task['status']) => {
    await updateTaskStatus(id, status);
    if (selectedTask?.id === id) {
      setSelectedTask(prev => prev ? { ...prev, status } : null);
    }
  };

  const handleSelectTask = (task: Task) => {
    setSelectedTask(task);
    setIsEditing(false);
    setEditDraft({});
  };

  const startEditing = () => {
    if (!selectedTask) return;
    setEditDraft({
      title: selectedTask.title,
      description: selectedTask.description || '',
      priority: selectedTask.priority || 'medium',
      due_date: selectedTask.due_date || '',
      tags: selectedTask.tags || [],
    });
    setTagInput('');
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditDraft({});
  };

  const saveEditing = async () => {
    if (!selectedTask) return;
    const updated = {
      ...selectedTask,
      title: editDraft.title || selectedTask.title,
      ...(editDraft.description !== undefined ? { description: editDraft.description } : {}),
      ...(editDraft.priority ? { priority: editDraft.priority } : {}),
      ...(editDraft.due_date ? { due_date: editDraft.due_date } : {}),
      ...(editDraft.tags !== undefined ? { tags: editDraft.tags } : {}),
      updated_at: new Date().toISOString(),
    } as Task;
    await saveTask(updated);

    setSelectedTask(updated);
    setIsEditing(false);
    setEditDraft({});
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
    } catch { return ''; }
  };

  const isOverdue = (task: Task) => {
    if (task.status === 'done' || !task.due_date) return false;
    return new Date(task.due_date) < new Date();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="h-full flex gap-3"
    >
      {/* 左侧：状态筛选 */}
      <div className="w-52 flex-shrink-0 bg-white/40 border border-teal-900/10 rounded-xl p-3 flex flex-col">
        <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3 px-1">待办板</h3>

        <div className="space-y-0.5">
          <button
            onClick={() => setSelectedStatus('all')}
            className={`w-full text-left px-2.5 py-2 rounded-lg text-sm transition-all flex items-center justify-between ${selectedStatus === 'all' ? 'bg-accent/10 text-accent font-medium' : 'text-muted hover:bg-teal-900/5'}`}
          >
            <span>全部</span>
            <span className="text-xs">{tasks.length}</span>
          </button>
          {Object.entries(statusConfig).map(([status, config]) => {
            const count = tasks.filter(t => t.status === status).length;
            const Icon = config.icon;
            return (
              <button
                key={status}
                onClick={() => setSelectedStatus(status as Task['status'])}
                className={`w-full text-left px-2.5 py-2 rounded-lg text-sm transition-all flex items-center justify-between ${
                  selectedStatus === status ? `${config.activeBg} text-${config.color}-700 font-medium` : 'text-muted hover:bg-teal-900/5'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Icon size={14} />
                  {config.label}
                </span>
                <span className="text-xs">{count}</span>
              </button>
            );
          })}
        </div>

        {overdueTasks.length > 0 && (
          <div className="mt-auto pt-3 border-t border-teal-900/10">
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl">
              <div className="flex items-center gap-1.5 text-red-700 text-xs font-medium">
                <AlertCircle size={12} />
                {overdueTasks.length} 项已逾期
              </div>
            </div>
          </div>
        )}

        {allTaskTags.length > 0 && (
          <div className="mt-3 pt-3 border-t border-teal-900/10">
            <p className="text-2xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 px-1">标签筛选</p>
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setSelectedTagFilter(null)}
                className={`px-2 py-0.5 rounded text-2xs font-medium transition-all ${!selectedTagFilter ? 'bg-accent text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
              >
                全部
              </button>
              {allTaskTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setSelectedTagFilter(selectedTagFilter === tag ? null : tag)}
                  className={`px-2 py-0.5 rounded text-2xs font-medium transition-all ${selectedTagFilter === tag ? getTagColor(tag) + ' ring-1 ring-current/20' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 中间：任务列表 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 增强快速添加 */}
        <form onSubmit={handleQuickAdd} className="mb-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Plus size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                data-quick-add-task
                type="text"
                value={quickAddTitle}
                onChange={(e) => setQuickAddTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown' && !quickAddExpanded) {
                    e.preventDefault();
                    setQuickAddExpanded(true);
                  }
                }}
                placeholder="添加待办，回车保存；↓ 展开更多选项..."
                className="w-full pl-9 pr-10 py-2 bg-white/60 border border-teal-900/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
              <button
                type="button"
                onClick={() => setQuickAddExpanded(!quickAddExpanded)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-teal-900/5 text-muted transition-colors"
              >
                {quickAddExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>
          </div>

          {/* 展开区域：优先级 + 截止日期 */}
          <AnimatePresence>
            {quickAddExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-teal-900/5">
                  <div className="flex items-center gap-1">
                    {(Object.entries(priorityConfig) as Array<[string, typeof priorityConfig.high]>).map(([key, cfg]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setQuickAddPriority(key as 'high' | 'medium' | 'low')}
                        className={`px-2 py-1 rounded-lg text-2xs font-medium transition-all ${
                          quickAddPriority === key ? cfg.chipClass + ' ring-1 ring-current/20' : 'bg-white/60 text-muted hover:bg-teal-900/5'
                        }`}
                      >
                        {cfg.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 flex-1">
                    <Calendar size={12} className="text-muted" />
                    <input
                      type="date"
                      value={quickAddDueDate}
                      onChange={(e) => setQuickAddDueDate(e.target.value)}
                      className="flex-1 px-2 py-1 text-2xs bg-white/60 border border-teal-900/10 rounded-lg focus:outline-none focus:ring-1 focus:ring-accent/20"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!quickAddTitle.trim()}
                    className="px-3 py-1.5 bg-accent text-white rounded-lg text-2xs font-medium hover:bg-accent/90 transition-all disabled:opacity-40"
                  >
                    添加
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </form>

        {/* 搜索栏 */}
        <div className="mb-3 relative flex items-center gap-2">
          <div className="flex-1 relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索待办..."
              className="w-full pl-9 pr-4 py-1.5 bg-white/40 border border-teal-900/10 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </div>
          <div className="flex bg-teal-900/5 rounded-lg p-0.5 border border-teal-900/5">
            <button
              onClick={() => setTaskView('list')}
              className={`p-1.5 rounded-md transition-all ${taskView === 'list' ? 'bg-white shadow-sm text-accent' : 'text-muted hover:text-accent'}`}
              title="列表视图"
            >
              <List size={14} />
            </button>
            <button
              onClick={() => setTaskView('kanban')}
              className={`p-1.5 rounded-md transition-all ${taskView === 'kanban' ? 'bg-white shadow-sm text-accent' : 'text-muted hover:text-accent'}`}
              title="看板视图"
            >
              <FolderKanban size={14} />
            </button>
            <button
              onClick={() => setTaskView('calendar')}
              className={`p-1.5 rounded-md transition-all ${taskView === 'calendar' ? 'bg-white shadow-sm text-accent' : 'text-muted hover:text-accent'}`}
              title="日历视图"
            >
              <LayoutGrid size={14} />
            </button>
          </div>
        </div>

        {taskView === 'calendar' ? (
          <div className="flex-1 overflow-hidden">
            <CalendarView
              schedules={[]}
              selectedDate={calendarSelectedDate}
              onSelectDate={setCalendarSelectedDate}
              onAddSchedule={() => {}}
              onEditSchedule={() => {}}
              tasks={filteredTasks}
              onToggleTask={(taskId: string) => handleMoveStatus(taskId, tasks.find(t => t.id === taskId)?.status === 'done' ? 'inbox' : 'done')}
            />
          </div>
        ) : taskView === 'kanban' ? (
          <div className="flex-1 overflow-x-auto">
            <div className="flex gap-3 min-w-max p-1">
              {Object.entries(statusConfig).map(([status, config]) => {
                const statusTasks = filteredTasks.filter(t => t.status === status);
                const StatusIcon = config.icon;
                return (
                  <div key={status} className="w-64 flex-shrink-0">
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-t-xl ${config.accent}`}>
                      <StatusIcon size={14} />
                      <span className="text-xs font-bold">{config.label}</span>
                      <span className="text-2xs opacity-60 ml-auto">{statusTasks.length}</span>
                    </div>
                    <div className="bg-gray-50 rounded-b-xl p-2 min-h-[200px] space-y-1.5">
                      {statusTasks.length === 0 ? (
                        <EmptyState compact icon={<CheckSquare size={20} />} title="暂无任务" />
                      ) : (
                        statusTasks.map(task => {
                          const priorityInfo = priorityConfig[task.priority || 'medium'];
                          const overdue = isOverdue(task);
                          return (
                            <motion.div
                              key={task.id}
                              whileHover={{ scale: 1.02 }}
                              onClick={() => handleSelectTask(task)}
                              className={`p-2.5 bg-white rounded-lg border cursor-pointer transition-all ${
                                selectedTask?.id === task.id ? 'border-accent/30 shadow-sm' : 'border-gray-100 hover:border-gray-200 hover:shadow-sm'
                              }`}
                            >
                              <p className="text-xs font-medium text-gray-800 line-clamp-2 mb-1.5">{task.title}</p>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`px-1.5 py-0.5 text-2xs rounded-full ${priorityInfo.chipClass}`}>{priorityInfo.label}</span>
                                {task.due_date && (
                                  <span className={`text-2xs ${overdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                                    {new Date(task.due_date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                                  </span>
                                )}
                                {task.tags && task.tags.length > 0 && task.tags[0] && (
                                  <span className={`px-1.5 py-0.5 text-2xs rounded-full ${getTagColor(task.tags[0])}`}>{task.tags[0]}</span>
                                )}
                              </div>
                            </motion.div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-sm">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-accent/10 flex items-center justify-center">
                <CheckSquare size={28} className="text-accent" />
              </div>
              <h3 className="text-base font-bold text-foreground mb-1.5">
                {selectedStatus === 'all' ? '还没有待办' : `没有${statusConfig[selectedStatus]?.label || ''}任务`}
              </h3>
              <p className="text-sm text-muted mb-4">
                {selectedStatus === 'all' ? '便签和文档都可以转为待办，或在上方直接创建' : '试试调整筛选条件'}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-1.5">
            {filteredTasks.map(task => {
              const statusInfo = (statusConfig[task.status] || statusConfig.inbox)!;
              const priorityInfo = priorityConfig[task.priority || 'medium' as keyof typeof priorityConfig] || priorityConfig.medium;
              const StatusIcon = statusInfo.icon;
              const overdue = isOverdue(task);

              return (
                <motion.div
                  key={task.id}
                  whileHover={{ x: 2 }}
                  onClick={() => handleSelectTask(task)}
                  className={`flex items-start gap-3 px-3 py-3 rounded-xl cursor-pointer transition-all ${
                    selectedTask?.id === task.id ? 'bg-accent/5 border border-accent/20' : 'hover:bg-white/60 border border-transparent'
                  }`}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMoveStatus(task.id, task.status === 'done' ? 'inbox' : 'done');
                    }}
                    className={`mt-0.5 p-1 rounded-lg transition-all ${task.status === 'done' ? 'text-green-500' : 'text-muted hover:text-accent'}`}
                  >
                    <StatusIcon size={16} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`px-1.5 py-0.5 text-2xs rounded-full ${priorityInfo.chipClass}`}>
                        {priorityInfo.label}
                      </span>
                      <span className={`px-1.5 py-0.5 text-2xs rounded-full ${statusInfo.accent}`}>
                        {statusInfo.label}
                      </span>
                      {overdue && (
                        <span className="px-1.5 py-0.5 text-2xs rounded-full bg-red-100 text-red-700">逾期</span>
                      )}
                    </div>
                    <h3 className={`text-sm font-medium ${task.status === 'done' ? 'text-muted line-through' : 'text-foreground'}`}>
                      {task.title}
                    </h3>
                    {task.due_date && (
                      <div className="flex items-center gap-1 mt-1 text-2xs text-muted">
                        <Calendar size={10} /> {formatDate(task.due_date)}
                      </div>
                    )}
                    {task.tags && task.tags.length > 0 && (
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        {task.tags.slice(0, 3).map((tag: string) => (
                          <span key={tag} className={`px-1.5 py-0.5 rounded text-xs font-medium ${getTagColor(tag)}`}>{tag}</span>
                        ))}
                        {task.tags.length > 3 && <span className="text-xs text-muted">+{task.tags.length - 3}</span>}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <select
                      value={task.status}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => handleMoveStatus(task.id, e.target.value as Task['status'])}
                      className="px-1.5 py-1 text-2xs bg-white/60 border border-teal-900/10 rounded-lg focus:outline-none"
                    >
                      {Object.entries(statusConfig).map(([s, cfg]) => (
                        <option key={s} value={s}>{cfg.label}</option>
                      ))}
                    </select>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        requestConfirm({
                          message: `确定要删除任务「${task.title}」吗？此操作不可撤销。`,
                          onConfirm: () => handleDeleteTask(task.id),
                        });
                      }}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-muted hover:text-red-500 transition-all"
                    >
                      <span className="text-2xs">✕</span>
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* 右侧：任务详情（可编辑） */}
      <div className="w-80 flex-shrink-0 flex flex-col gap-3 overflow-hidden">
        {selectedTask ? (
          <div className="bg-white/40 border border-teal-900/10 rounded-xl p-4 flex-shrink-0">
            {/* 标题区域 */}
            <div className="flex items-start gap-2 mb-2">
              {isEditing ? (
                <input
                  type="text"
                  value={editDraft.title || ''}
                  onChange={(e) => setEditDraft(prev => ({ ...prev, title: e.target.value }))}
                  className="flex-1 text-sm font-semibold text-foreground bg-white border border-accent/30 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-accent/20"
                  autoFocus
                />
              ) : (
                <h3 className="flex-1 text-sm font-semibold text-foreground">{selectedTask.title}</h3>
              )}
              {isEditing ? (
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={saveEditing} className="p-1.5 rounded-lg bg-accent text-white hover:bg-accent/90 transition-all" title="保存">
                    <Save size={12} />
                  </button>
                  <button onClick={cancelEditing} className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition-all" title="取消">
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1 shrink-0">
                  <div className="relative">
                    <button onClick={() => setShowProjectPickerFor(showProjectPickerFor ? null : { type: 'task', id: selectedTask.id })} className="p-1.5 rounded-lg hover:bg-accent/5 text-muted hover:text-accent transition-all" title="归入项目"><FolderKanban size={12} /></button>
                    {showProjectPickerFor && showProjectPickerFor.type === 'task' && showProjectPickerFor.id === selectedTask.id && (
                      <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-50">
                        {projects.map(p => (
                          <button key={p} onClick={async () => { if (window.ipcRenderer) { await window.ipcRenderer.invoke('add-to-project', { projectName: p, itemType: 'task', itemId: selectedTask.id }); setShowProjectPickerFor(null); } }} className="w-full px-3 py-1.5 text-xs text-gray-700 hover:bg-accent/5 text-left">{p}</button>
                        ))}
                        <div className="border-t border-gray-100 mt-1 pt-1 px-2">
                          <input value={newProjectName} onChange={e => setNewProjectName(e.target.value)} placeholder="新建项目..." className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-accent/30" onKeyDown={e => { if (e.key === 'Enter' && newProjectName.trim() && window.ipcRenderer) { window.ipcRenderer.invoke('add-to-project', { projectName: newProjectName.trim(), itemType: 'task', itemId: selectedTask.id }); setShowProjectPickerFor(null); setNewProjectName(''); } }} />
                        </div>
                      </div>
                    )}
                  </div>
                  <button onClick={startEditing} className="p-1.5 rounded-lg hover:bg-teal-900/5 text-muted hover:text-accent transition-all" title="编辑">
                    <Pencil size={12} />
                  </button>
                </div>
              )}
            </div>

            {/* 优先级 */}
            <div className="mb-2">
              <p className="text-2xs text-muted font-medium uppercase tracking-wider mb-1">优先级</p>
              {isEditing ? (
                <div className="flex items-center gap-1">
                  {(Object.entries(priorityConfig) as Array<[string, typeof priorityConfig.high]>).map(([key, cfg]) => (
                    <button
                      key={key}
                      onClick={() => setEditDraft(prev => ({ ...prev, priority: key as 'high' | 'medium' | 'low' }))}
                      className={`px-2.5 py-1 rounded-lg text-2xs font-medium transition-all ${
                        editDraft.priority === key ? cfg.chipClass + ' ring-1 ring-current/20' : 'bg-white/60 text-muted hover:bg-teal-900/5'
                      }`}
                    >
                      {cfg.label}
                    </button>
                  ))}
                </div>
              ) : (
                <span className={`inline-block px-2 py-0.5 rounded-full text-2xs font-medium ${priorityConfig[selectedTask.priority || 'medium'].chipClass}`}>
                  {priorityConfig[selectedTask.priority || 'medium'].label}优先级
                </span>
              )}
            </div>

            {/* 截止日期 */}
            <div className="mb-2">
              <p className="text-2xs text-muted font-medium uppercase tracking-wider mb-1">截止日期</p>
              {isEditing ? (
                <input
                  type="date"
                  value={editDraft.due_date || ''}
                  onChange={(e) => setEditDraft(prev => ({ ...prev, due_date: e.target.value }))}
                  className="w-full px-2 py-1 text-2xs bg-white border border-teal-900/10 rounded-lg focus:outline-none focus:ring-1 focus:ring-accent/20"
                />
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-muted">
                  <Calendar size={11} />
                  {selectedTask.due_date ? (
                    <>
                      {formatDate(selectedTask.due_date)}
                      {isOverdue(selectedTask) && <span className="text-red-600 text-2xs">(已逾期)</span>}
                    </>
                  ) : (
                    <span className="text-muted/50">未设置</span>
                  )}
                </div>
              )}
            </div>

            {/* 备注 */}
            <div className="mb-3">
              <p className="text-2xs text-muted font-medium uppercase tracking-wider mb-1">备注</p>
              {isEditing ? (
                <textarea
                  value={editDraft.description || ''}
                  onChange={(e) => setEditDraft(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="添加备注..."
                  rows={3}
                  className="w-full px-2 py-1.5 text-2xs bg-white border border-teal-900/10 rounded-lg focus:outline-none focus:ring-1 focus:ring-accent/20 resize-none"
                />
              ) : (
                <p className="text-xs text-muted leading-relaxed">
                  {selectedTask.description || <span className="text-muted/50">无备注</span>}
                </p>
              )}
            </div>

            {/* 标签 */}
            <div className="mb-3">
              <p className="text-2xs text-muted font-medium uppercase tracking-wider mb-1">标签</p>
              {isEditing ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1">
                    {(editDraft.tags || []).map((tag: string, idx: number) => (
                      <span key={idx} className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-2xs font-medium ${getTagColor(tag)}`}>
                        {tag}
                        <button
                          onClick={() => setEditDraft(prev => ({ ...prev, tags: (prev.tags || []).filter((_, i) => i !== idx) }))}
                          className="ml-0.5 hover:opacity-70"
                        >
                          <XCircle size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && tagInput.trim()) {
                          e.preventDefault();
                          const newTags = [...(editDraft.tags || []), ...tagInput.split(',').map(t => t.trim()).filter(Boolean)];
                          setEditDraft(prev => ({ ...prev, tags: newTags }));
                          setTagInput('');
                        }
                      }}
                      placeholder="输入标签，逗号分隔，回车确认"
                      className="flex-1 px-2 py-1 text-2xs bg-white border border-teal-900/10 rounded-lg focus:outline-none focus:ring-1 focus:ring-accent/20"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {selectedTask.tags && selectedTask.tags.length > 0 ? (
                    selectedTask.tags.map((tag: string, idx: number) => (
                      <span key={idx} className={`px-2 py-0.5 rounded text-2xs font-medium ${getTagColor(tag)}`}>{tag}</span>
                    ))
                  ) : (
                    <span className="text-muted/50 text-2xs">无标签</span>
                  )}
                </div>
              )}
            </div>

            {/* 状态切换 */}
            {!isEditing && (
              <div className="flex items-center gap-1.5">
                {Object.entries(statusConfig).filter(([key]) => key !== selectedTask.status).map(([status, config]) => (
                  <button
                    key={status}
                    onClick={() => handleMoveStatus(selectedTask.id, status as Task['status'])}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 border border-teal-900/10 bg-white rounded-lg text-2xs font-medium text-foreground hover:bg-teal-900/5 transition-all"
                  >
                    <config.icon size={10} /> {config.label}
                  </button>
                ))}
              </div>
            )}

            {/* 来源关联 */}
            {selectedTask.source_type && selectedTask.source_id && (
              <div className="mt-3 pt-3 border-t border-teal-900/10">
                <p className="text-2xs text-muted font-medium uppercase tracking-wider mb-1.5">关联来源</p>
                <button
                  onClick={() => {
                    if (selectedTask.source_type === 'note' || selectedTask.source_type === 'document') {
                      window.dispatchEvent(new CustomEvent('navigate-to-source', { 
                        detail: { type: selectedTask.source_type, id: selectedTask.source_id } 
                      }));
                    }
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 bg-accent/5 hover:bg-accent/10 border border-accent/10 rounded-lg text-xs text-accent transition-all"
                >
                  <FileText size={12} />
                  <span className="truncate">{selectedTask.source_title || '查看原文'}</span>
                  <ArrowRight size={10} className="ml-auto flex-shrink-0" />
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white/40 border border-teal-900/10 rounded-xl p-6 flex-shrink-0 text-center">
            <CheckSquare size={24} className="mx-auto text-muted mb-2" />
            <p className="text-xs text-muted">选择任务查看详情</p>
          </div>
        )}
      </div>

      <Modal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        type="confirm"
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </motion.div>
  );
};

export default TasksPage;
