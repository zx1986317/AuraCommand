import React, { useMemo, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Database, BrainCircuit, CheckSquare,
  Upload, Plus, Sparkles, ArrowRight, Clock, AlertTriangle,
  FileText, StickyNote, ChevronRight, FolderKanban
} from 'lucide-react';
import { EmptyState } from '../components/common/EmptyState';
import { logger } from '../utils/logger';
import { useAppStore } from '../store/appStore';

const card = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
};

const priorityLabel: Record<string, { text: string; cls: string }> = {
  high: { text: '高', cls: 'bg-red-50 text-red-600 border-red-200' },
  medium: { text: '中', cls: 'bg-amber-50 text-amber-600 border-amber-200' },
  low: { text: '低', cls: 'bg-slate-50 text-slate-500 border-slate-200' },
};

interface ProjectDashboardPageProps {
  files: any[];
  onNavigateToKB: () => void;
  onNavigateToNotes: () => void;
  onNavigateToTasks: () => void;
  onCreateMemo: () => void;
  onCreateTask: () => void;
  onImportFiles: () => void;
  aiChatReady: boolean;
  aiRagReady: boolean;
}

const ProjectDashboardPage: React.FC<ProjectDashboardPageProps> = ({
  files,
  onNavigateToKB, onNavigateToNotes, onNavigateToTasks,
  onCreateMemo, onCreateTask, onImportFiles,
  aiChatReady, aiRagReady,
}) => {
  const setActiveTab = useAppStore(s => s.setActiveTab);
  const setDeskDefaultTab = useAppStore(s => s.setDeskDefaultTab);
  const setSourceNoteToOpen = useAppStore(s => s.setSourceNoteToOpen);
  const setEditingSchedule = useAppStore(s => s.setEditingSchedule);
  const currentProjectName = useAppStore(s => s.currentProjectName);

  const [tasks, setTasks] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [projectTaskIds, setProjectTaskIds] = useState<string[]>([]);
  const [projectNoteIds, setProjectNoteIds] = useState<string[]>([]);
  const [projectKbFileIds, setProjectKbFileIds] = useState<string[]>([]);

  useEffect(() => {
    if (!currentProjectName || !window.ipcRenderer) {
      setProjectTaskIds([]); setProjectNoteIds([]); setProjectKbFileIds([]);
      return;
    }
    window.ipcRenderer.invoke('list-project-items', { projectName: currentProjectName })
      .then((r: any) => {
        setProjectTaskIds((r.tasks || []).map((t: any) => t.id));
        setProjectNoteIds([...(r.notes || []).map((n: any) => n.id), ...(r.documents || []).map((d: any) => d.id)]);
        setProjectKbFileIds((r.kb_files || []).map((f: any) => f.id));
      })
      .catch(() => {});
  }, [currentProjectName]);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        if (!window.ipcRenderer) return;
        const [taskList, noteList] = await Promise.all([
          window.ipcRenderer.invoke('get-tasks'),
          window.ipcRenderer.invoke('get-notes'),
        ]);
        setTasks(taskList || []);
        setNotes(noteList || []);
      } catch (err) {
        logger.error('Failed to load dashboard data:', err);
      }
    };
    loadDashboardData();
  }, []);

  const projectTasks = useMemo(() =>
    projectTaskIds.length > 0 ? tasks.filter(t => projectTaskIds.includes(t.id)) : [],
    [tasks, projectTaskIds]
  );

  const projectNotes = useMemo(() =>
    projectNoteIds.length > 0 ? notes.filter(n => projectNoteIds.includes(n.id)) : [],
    [notes, projectNoteIds]
  );

  const projectFiles = useMemo(() =>
    projectKbFileIds.length > 0 ? files.filter(f => projectKbFileIds.includes(f.id)) : [],
    [files, projectKbFileIds]
  );

  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const todayTasks = useMemo(() =>
    projectTasks.filter(t => {
      if (t.status === 'done') return false;
      if (!t.due_date) return false;
      return t.due_date.startsWith(today);
    }),
    [projectTasks, today]
  );

  const overdueTasks = useMemo(() =>
    projectTasks.filter(t => {
      if (t.status === 'done') return false;
      if (!t.due_date) return false;
      return t.due_date < today;
    }),
    [projectTasks, today]
  );

  const recentNotes = useMemo(() =>
    [...projectNotes]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5),
    [projectNotes]
  );

  const recentFiles = useMemo(() => {
    const seen = new Set<string>();
    return projectFiles.filter(f => {
      if (seen.has(f.id)) return false;
      seen.add(f.id);
      return true;
    }).sort((a, b) => new Date(b.created_at || b.added_at || 0).getTime() - new Date(a.created_at || a.added_at || 0).getTime())
      .slice(0, 5);
  }, [projectFiles]);

  const fmtTime = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return '刚刚';
    if (diffMin < 60) return `${diffMin}分钟前`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}小时前`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD}天前`;
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  const handleNewDocument = () => {
    setDeskDefaultTab('documents');
    setActiveTab('desk');
  };

  const handleNewTask = () => {
    onCreateTask();
    setActiveTab('tasks');
  };

  const handleAskAI = () => {
    setActiveTab('chat');
  };

  const quickActions = [
    { icon: FileText, title: '新建文档', desc: '创建项目文档', action: handleNewDocument, color: 'bg-accent/10 text-accent' },
    { icon: CheckSquare, title: '新建待办', desc: '创建项目任务', action: handleNewTask, color: 'bg-emerald-50 text-emerald-600' },
    { icon: Upload, title: '导入资料', desc: '加入项目知识库', action: onImportFiles, color: 'bg-blue-50 text-blue-600' },
    { icon: Sparkles, title: '问 AI', desc: aiRagReady ? '基于项目内容问答' : aiChatReady ? 'AI 对话就绪' : 'AI 未连接', action: handleAskAI, color: 'bg-amber-50 text-amber-600' },
  ];

  return (
    <motion.div variants={card} initial="initial" animate="animate" className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/10 text-accent">
          <FolderKanban size={20} />
        </div>
        <div>
          <h1 className="text-xl font-display font-bold text-foreground">{currentProjectName}</h1>
          <p className="text-2xs text-muted mt-0.5">项目概览 · 集中管理</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: '今日待办', value: todayTasks.length, icon: Clock, color: 'text-accent' },
          { label: '逾期待办', value: overdueTasks.length, icon: AlertTriangle, color: overdueTasks.length > 0 ? 'text-red-500' : 'text-muted' },
          { label: '项目文档', value: projectNotes.length, icon: FileText, color: 'text-blue-500' },
          { label: '知识库文件', value: projectFiles.length, icon: Database, color: 'text-amber-500' },
        ].map((item) => (
          <motion.div
            key={item.label}
            variants={card}
            className="bg-white/60 border border-teal-900/10 rounded-xl p-4 flex items-center gap-3"
          >
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-teal-900/5 ${item.color}`}>
              <item.icon size={18} />
            </div>
            <div>
              <p className="text-2xl font-display font-bold text-foreground">{item.value}</p>
              <p className="text-2xs text-muted uppercase tracking-wider">{item.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-[1fr_1fr_1fr] gap-6">

        <div className="bg-white/60 border border-teal-900/10 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Clock size={14} className="text-accent" />
              待办提醒
            </h2>
            <button
              onClick={onNavigateToTasks}
              className="text-2xs text-accent hover:text-accent/80 font-bold uppercase tracking-wider flex items-center gap-1 transition-colors"
            >
              全部 <ChevronRight size={10} />
            </button>
          </div>

          {overdueTasks.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50/50 p-3 space-y-2">
              <p className="text-2xs font-bold text-red-600 uppercase tracking-wider">逾期</p>
              {overdueTasks.slice(0, 2).map(t => (
                <div key={t.id} className="flex items-center justify-between gap-2">
                  <span className="text-xs text-red-700 truncate">{t.title}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full border ${priorityLabel[t.priority]?.cls || 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                    {priorityLabel[t.priority]?.text || '中'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {todayTasks.length > 0 ? (
            <div className="space-y-2.5">
              {todayTasks.slice(0, 5).map(t => (
                <div
                  key={t.id}
                  onClick={onNavigateToTasks}
                  className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg hover:bg-teal-900/5 cursor-pointer transition-colors"
                >
                  <span className="text-xs text-foreground truncate">{t.title}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full border shrink-0 ${priorityLabel[t.priority]?.cls || 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                    {priorityLabel[t.priority]?.text || '中'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center">
              <p className="text-xs text-muted">项目内没有待办</p>
              <button
                onClick={handleNewTask}
                className="mt-2 text-2xs text-accent hover:text-accent/80 font-medium transition-colors"
              >
                创建一个待办
              </button>
            </div>
          )}
        </div>

        <div className="bg-white/60 border border-teal-900/10 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Sparkles size={14} className="text-accent" />
            快速操作
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map(item => (
              <button
                key={item.title}
                onClick={item.action}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-teal-900/10 bg-white/40 hover:bg-white/80 hover:border-accent/20 transition-all group text-center"
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.color} group-hover:scale-110 transition-transform`}>
                  <item.icon size={20} />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">{item.title}</p>
                  <p className="text-2xs text-muted mt-0.5">{item.desc}</p>
                </div>
              </button>
            ))}
          </div>

          <div className={`rounded-xl border p-3 flex items-center gap-2 ${
            aiRagReady ? 'border-emerald-200 bg-emerald-50/50' :
            aiChatReady ? 'border-blue-200 bg-blue-50/50' :
            'border-amber-200 bg-amber-50/50'
          }`}>
            <div className={`w-2 h-2 rounded-full shrink-0 ${
              aiRagReady ? 'bg-emerald-500' :
              aiChatReady ? 'bg-blue-400 animate-pulse' :
              'bg-amber-400'
            }`} />
            <span className={`text-2xs font-medium ${
              aiRagReady ? 'text-emerald-700' :
              aiChatReady ? 'text-blue-700' :
              'text-amber-700'
            }`}>
              {aiRagReady ? 'AI 已就绪，可基于项目内容问答' :
               aiChatReady ? 'AI 对话就绪，知识检索待完善' :
               'AI 未连接，请在设置中配置 Ollama'}
            </span>
          </div>
        </div>

        <div className="bg-white/60 border border-teal-900/10 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <FileText size={14} className="text-accent" />
            最近动态
          </h2>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-2xs font-bold text-muted uppercase tracking-wider">文档</p>
              <button
                onClick={onNavigateToNotes}
                className="text-2xs text-accent hover:text-accent/80 font-bold transition-colors"
              >
                查看全部
              </button>
            </div>
            {recentNotes.length > 0 ? (
              <div className="space-y-1.5">
                {recentNotes.map(n => (
                  <div
                    key={n.id}
                    onClick={onNavigateToNotes}
                    className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg hover:bg-teal-900/5 cursor-pointer transition-colors"
                  >
                    <span className="text-xs text-foreground truncate">{n.title}</span>
                    <span className="text-2xs text-muted shrink-0">{fmtTime(n.created_at)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-2xs text-muted/70 py-2 text-center">项目暂无文档</p>
            )}
          </div>

          <div className="border-t border-teal-900/5" />

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-2xs font-bold text-muted uppercase tracking-wider">知识库</p>
              <button
                onClick={onNavigateToKB}
                className="text-2xs text-accent hover:text-accent/80 font-bold transition-colors"
              >
                查看全部
              </button>
            </div>
            {recentFiles.length > 0 ? (
              <div className="space-y-1.5">
                {recentFiles.map(f => (
                  <div
                    key={f.id}
                    onClick={onNavigateToKB}
                    className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg hover:bg-teal-900/5 cursor-pointer transition-colors"
                  >
                    <span className="text-xs text-foreground truncate">{f.title || f.file_name}</span>
                    <span className="text-2xs text-muted shrink-0">
                      {fmtTime(f.created_at || f.added_at || '')}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState compact icon={<FileText size={20} />} title="项目暂无文件" description="从知识库或书桌添加资料到当前项目" />
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default ProjectDashboardPage;
