import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, RotateCcw, BarChart3, Cloud, Network, TrendingUp, Hash, FileText, StickyNote, Calendar, Clock, CheckCircle, AlertCircle, Activity, Zap, ArrowRight, LayoutDashboard } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { DailyInsight } from '../types';

interface InsightPanelProps {
  insight: DailyInsight | null;
  isLoading: boolean;
  onRefresh: () => void;
  memos?: any[];
  schedules?: any[];
  chatSessions?: any[];
  kbFiles?: any[];
  workflowLogs?: Record<string, any[]>;
  workflows?: any[];
  onNavigateToSchedules?: () => void;
}

type DataView = 'dashboard' | 'insight' | 'wordcloud' | 'stats' | 'graph';

const InsightPanel: React.FC<InsightPanelProps> = ({ 
  insight, isLoading, onRefresh,
  memos = [], schedules = [], chatSessions = [], kbFiles = [],
  workflowLogs = {}, workflows = [], onNavigateToSchedules,
}) => {
  const [dataView, setDataView] = useState<DataView>('dashboard');

  const wordCloud = useMemo(() => {
    const freq: Record<string, number> = {};
    const stopWords = new Set(['的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这', '他', '她', '它', '们', '那', '被', '从', '把', '对', '与', '但', '而', '且', '又', '或', '之', '以', '及', '等', '为', '中', '其', '可以', '这个', '那个', '什么', '怎么', '如何', 'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'and', 'but', 'or', 'nor', 'not', 'so', 'if', 'that', 'it', 'this', 'these', 'those', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her', 'they', 'them', 'their']);

    const text = memos.map(m => `${m.title} ${m.content || ''}`).join(' ');
    const words = text.split(/[\s,，。.!！?？;；:：、\n\r\t]+/).filter(w => w.length >= 2 && !stopWords.has(w.toLowerCase()));
    words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });

    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 40)
      .map(([word, count]) => ({ word, count }));
  }, [memos]);

  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const todayStr = now.toISOString().split('T')[0];

    const memosThisMonth = memos.filter(m => {
      const d = new Date(m.created_at);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    }).length;

    const schedulesThisMonth = schedules.filter(s => {
      const d = new Date(s.start_time);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    }).length;

    const completedSchedules = schedules.filter(s => s.status === 'completed').length;
    const pendingSchedules = schedules.filter(s => s.status === 'pending').length;

    const todaySchedules = schedules.filter(s => s.start_time?.startsWith(todayStr) && s.status !== 'completed');

    const tagCounts: Record<string, number> = {};
    memos.forEach(m => {
      try {
        const tags = typeof m.tags === 'string' ? JSON.parse(m.tags || '[]') : (m.tags || []);
        tags.forEach((t: string) => { tagCounts[t] = (tagCounts[t] || 0) + 1; });
      } catch {}
    });
    const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);

    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(now);
      date.setDate(date.getDate() - (6 - i));
      const dateStr = date.toISOString().split('T')[0];
      return {
        label: `${date.getMonth() + 1}/${date.getDate()}`,
        memos: memos.filter(m => m.created_at?.startsWith(dateStr)).length,
        schedules: schedules.filter(s => s.start_time?.startsWith(dateStr)).length,
      };
    });

    let wfTotal = 0, wfSuccess = 0;
    for (const logs of Object.values(workflowLogs)) {
      wfTotal += logs.length;
      wfSuccess += logs.filter(l => l.status === 'completed' || l.status === 'success').length;
    }
    const wfSuccessRate = wfTotal > 0 ? Math.round((wfSuccess / wfTotal) * 100) : 100;

    return { memosThisMonth, schedulesThisMonth, completedSchedules, pendingSchedules, topTags, last7Days, todaySchedules, wfTotal, wfSuccess, wfSuccessRate };
  }, [memos, schedules, workflowLogs]);

  const maxWordCount = wordCloud.length > 0 ? (wordCloud[0]?.count ?? 1) : 1;
  const maxBarValue = Math.max(...stats.last7Days.map(d => Math.max(d.memos, d.schedules)), 1);

  const navItems = [
    { id: 'dashboard' as const, label: '仪表盘', icon: LayoutDashboard },
    { id: 'insight' as const, label: '洞察', icon: Sparkles },
    { id: 'wordcloud' as const, label: '词云', icon: Cloud },
    { id: 'stats' as const, label: '统计', icon: BarChart3 },
    { id: 'graph' as const, label: '图谱', icon: Network },
  ];

  return (
    <motion.div
      key="insight"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      className="max-w-5xl mx-auto w-full h-full flex flex-col"
    >
      <div className="flex items-center justify-between mb-6 px-2">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center text-accent">
            <LayoutDashboard size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-display font-bold text-foreground tracking-tight">Dashboard</h2>
            <p className="text-xs text-muted font-medium">{new Date().toLocaleDateString('zh-CN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-white/60 border border-teal-900/5 rounded-xl p-1">
            {navItems.map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setDataView(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-2xs font-bold transition-all ${
                    dataView === item.id ? 'bg-accent/10 text-accent' : 'text-muted hover:text-foreground'
                  }`}
                >
                  <Icon size={10} />
                  {item.label}
                </button>
              );
            })}
          </div>
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-white/60 border border-teal-900/5 rounded-xl text-xs font-bold text-muted hover:bg-white hover:text-foreground transition-all disabled:opacity-50"
          >
            <RotateCcw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <AnimatePresence mode="wait">

          {/* Dashboard View */}
          {dataView === 'dashboard' && (
            <motion.div key="dashboard-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: '便签总数', value: memos.length, icon: StickyNote, color: 'text-amber-600 bg-amber-500/10' },
                  { label: '今日待办', value: stats.todaySchedules.length, icon: Clock, color: 'text-blue-600 bg-blue-500/10' },
                  { label: '已完成日程', value: stats.completedSchedules, icon: CheckCircle, color: 'text-green-600 bg-green-500/10' },
                  { label: '知识文件', value: kbFiles.length, icon: FileText, color: 'text-purple-600 bg-purple-500/10' },
                ].map((stat, idx) => {
                  const Icon = stat.icon;
                  return (
                    <motion.div
                      key={stat.label}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="bg-white/60 border border-teal-900/5 rounded-2xl p-5 shadow-glass"
                    >
                      <div className={`w-8 h-8 rounded-xl ${stat.color} flex items-center justify-center mb-3`}>
                        <Icon size={14} />
                      </div>
                      <p className="text-2xl font-display font-bold text-foreground">{stat.value}</p>
                      <p className="text-2xs text-muted font-bold mt-1">{stat.label}</p>
                    </motion.div>
                  );
                })}
              </div>

              {/* Today's Schedule Quick View */}
              {stats.todaySchedules.length > 0 && (
                <div className="bg-white/60 border border-teal-900/5 rounded-[2rem] p-6 shadow-glass">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600"><Clock size={16} /></div>
                      <h3 className="text-sm font-bold text-foreground">今日待办</h3>
                    </div>
                    {onNavigateToSchedules && (
                      <button onClick={onNavigateToSchedules} className="flex items-center gap-1 text-2xs font-bold text-accent hover:text-accent/70 transition-colors">
                        查看全部 <ArrowRight size={10} />
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {stats.todaySchedules.slice(0, 5).map((sch, idx) => (
                      <div key={idx} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-blue-50/30">
                        <span className="text-2xs font-mono text-blue-600 font-bold">
                          {new Date(sch.start_time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="text-xs font-medium text-foreground truncate flex-1">{sch.title}</span>
                        <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${
                          sch.status === 'pending' ? 'bg-amber-100 text-amber-600' : 'bg-teal-100 text-teal-600'
                        }`}>
                          {sch.status === 'pending' ? '待办' : sch.status === 'in_progress' ? '进行中' : sch.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Workflow Stats */}
              {stats.wfTotal > 0 && (
                <div className="bg-white/60 border border-teal-900/5 rounded-[2rem] p-6 shadow-glass">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-xl bg-green-500/10 flex items-center justify-center text-green-600"><Activity size={16} /></div>
                    <h3 className="text-sm font-bold text-foreground">工作流执行</h3>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="flex flex-col items-center">
                      <span className="text-3xl font-display font-bold text-foreground">{stats.wfTotal}</span>
                      <span className="text-2xs text-muted font-bold">总执行</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-3xl font-display font-bold text-green-600">{stats.wfSuccess}</span>
                      <span className="text-2xs text-muted font-bold">成功</span>
                    </div>
                    <div className="flex-1">
                      <div className="h-3 bg-teal-900/5 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${stats.wfSuccessRate}%` }} />
                      </div>
                      <p className="text-2xs text-muted font-bold mt-1">成功率 {stats.wfSuccessRate}%</p>
                    </div>
                  </div>
                </div>
              )}

              {/* 7 Day Trend */}
              <div className="bg-white/60 border border-teal-900/5 rounded-[2rem] p-6 shadow-glass">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center text-accent"><TrendingUp size={16} /></div>
                  <h3 className="text-sm font-bold text-foreground">近7天趋势</h3>
                </div>
                <div className="flex items-end gap-3 h-32">
                  {stats.last7Days.map((day, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex flex-col items-center gap-1 flex-1 justify-end">
                        <div
                          className="w-full max-w-[24px] bg-accent/30 rounded-t-lg transition-all"
                          style={{ height: `${(day.memos / maxBarValue) * 100}%`, minHeight: day.memos > 0 ? 4 : 0 }}
                        />
                        <div
                          className="w-full max-w-[24px] bg-blue-400/30 rounded-t-lg transition-all"
                          style={{ height: `${(day.schedules / maxBarValue) * 100}%`, minHeight: day.schedules > 0 ? 4 : 0 }}
                        />
                      </div>
                      <span className="text-xs text-muted font-mono">{day.label}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-4 mt-3">
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-accent/30" /><span className="text-2xs text-muted">便签</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-blue-400/30" /><span className="text-2xs text-muted">日程</span></div>
                </div>
              </div>

              {/* Quick Tags */}
              {stats.topTags.length > 0 && (
                <div className="bg-white/60 border border-teal-900/5 rounded-[2rem] p-6 shadow-glass">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600"><Hash size={16} /></div>
                    <h3 className="text-sm font-bold text-foreground">热门标签</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {stats.topTags.map(([tag, count], idx) => (
                      <motion.span
                        key={tag}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.05 }}
                        className="px-3 py-1.5 rounded-xl bg-accent/5 border border-accent/10 text-xs font-bold text-accent"
                      >
                        #{tag} <span className="text-accent/50 ml-1">{count}</span>
                      </motion.span>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Insight View */}
          {dataView === 'insight' && (
            <motion.div key="insight-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
              {isLoading && !insight ? (
                <div className="flex items-center justify-center py-20">
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-2xl bg-accent/10 text-accent flex items-center justify-center mx-auto mb-4 animate-pulse">
                      <Sparkles size={28} />
                    </div>
                    <p className="text-lg font-bold mb-2">正在分析今日数据...</p>
                  </div>
                </div>
              ) : !insight ? (
                <div className="flex items-center justify-center py-20">
                  <div className="text-center">
                    <p className="text-lg font-bold mb-2">暂无今日洞察</p>
                    <button onClick={onRefresh} className="px-6 py-2 bg-accent text-white rounded-xl text-sm font-bold hover:bg-accent/90 transition-all">生成洞察</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="bg-white/60 border border-teal-900/5 rounded-[2rem] p-8 shadow-glass">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center text-accent"><Sparkles size={16} /></div>
                      <h3 className="text-sm font-bold text-foreground">今日总结</h3>
                    </div>
                    <p className="text-sm text-foreground/80 leading-relaxed">{insight.summary}</p>
                  </div>
                  {insight.todos && insight.todos.length > 0 && (
                    <div className="bg-white/60 border border-teal-900/5 rounded-[2rem] p-8 shadow-glass">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600"><Hash size={16} /></div>
                        <h3 className="text-sm font-bold text-foreground">建议待办</h3>
                      </div>
                      <ul className="space-y-2">
                        {insight.todos.map((todo, idx) => (
                          <li key={idx} className="flex items-start gap-3 text-sm text-foreground/80">
                            <span className="w-5 h-5 rounded-lg border border-teal-900/10 flex-shrink-0 mt-0.5" />
                            <span>{todo}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {insight.focus && (
                    <div className="bg-gradient-to-br from-accent/5 to-accent/10 border border-accent/20 rounded-[2rem] p-8 shadow-glass">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-xl bg-accent/20 flex items-center justify-center text-accent"><TrendingUp size={16} /></div>
                        <h3 className="text-sm font-bold text-accent">今日焦点</h3>
                      </div>
                      <p className="text-sm text-foreground/80 leading-relaxed">{insight.focus}</p>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}

          {/* Word Cloud View */}
          {dataView === 'wordcloud' && (
            <motion.div key="wordcloud-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="bg-white/60 border border-teal-900/5 rounded-[2rem] p-8 shadow-glass min-h-[400px]">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600"><Cloud size={16} /></div>
                  <h3 className="text-sm font-bold text-foreground">内容词云</h3>
                  <span className="text-2xs text-muted ml-2">基于便签内容自动生成</span>
                </div>
                {wordCloud.length === 0 ? (
                  <div className="text-center py-20 text-muted">
                    <Cloud size={48} className="mx-auto mb-4 opacity-20" />
                    <p className="text-xs font-bold">暂无词云数据</p>
                    <p className="text-2xs mt-1">创建便签后自动生成</p>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 justify-center items-center py-4">
                    {wordCloud.map((item, idx) => {
                      const size = Math.max(12, Math.min(48, (item.count / maxWordCount) * 48));
                      const opacity = Math.max(0.4, Math.min(1, (item.count / maxWordCount)));
                      const colors = ['text-accent', 'text-blue-500', 'text-purple-500', 'text-amber-500', 'text-emerald-500', 'text-rose-500'];
                      const color = colors[idx % colors.length];
                      return (
                        <motion.span
                          key={item.word}
                          initial={{ opacity: 0, scale: 0 }}
                          animate={{ opacity, scale: 1 }}
                          transition={{ delay: idx * 0.02, duration: 0.3 }}
                          className={`${color} font-bold cursor-default hover:scale-110 transition-transform inline-block`}
                          style={{ fontSize: `${size}px` }}
                          title={`${item.word}: ${item.count}次`}
                        >
                          {item.word}
                        </motion.span>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Stats View */}
          {dataView === 'stats' && (
            <motion.div key="stats-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: '便签总数', value: memos.length, icon: StickyNote, color: 'text-amber-600 bg-amber-500/10' },
                  { label: '日程总数', value: schedules.length, icon: Calendar, color: 'text-blue-600 bg-blue-500/10' },
                  { label: '已完成', value: stats.completedSchedules, icon: CheckCircle, color: 'text-green-600 bg-green-500/10' },
                  { label: '知识文件', value: kbFiles.length, icon: FileText, color: 'text-purple-600 bg-purple-500/10' },
                ].map((stat, idx) => {
                  const Icon = stat.icon;
                  return (
                    <motion.div
                      key={stat.label}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="bg-white/60 border border-teal-900/5 rounded-2xl p-5 shadow-glass"
                    >
                      <div className={`w-8 h-8 rounded-xl ${stat.color} flex items-center justify-center mb-3`}>
                        <Icon size={14} />
                      </div>
                      <p className="text-2xl font-display font-bold text-foreground">{stat.value}</p>
                      <p className="text-2xs text-muted font-bold mt-1">{stat.label}</p>
                    </motion.div>
                  );
                })}
              </div>

              <div className="bg-white/60 border border-teal-900/5 rounded-[2rem] p-8 shadow-glass">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center text-accent"><TrendingUp size={16} /></div>
                  <h3 className="text-sm font-bold text-foreground">近7天趋势</h3>
                </div>
                <div className="flex items-end gap-3 h-40">
                  {stats.last7Days.map((day, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex flex-col items-center gap-1 flex-1 justify-end">
                        <div
                          className="w-full max-w-[24px] bg-accent/30 rounded-t-lg transition-all"
                          style={{ height: `${(day.memos / maxBarValue) * 100}%`, minHeight: day.memos > 0 ? 4 : 0 }}
                        />
                        <div
                          className="w-full max-w-[24px] bg-blue-400/30 rounded-t-lg transition-all"
                          style={{ height: `${(day.schedules / maxBarValue) * 100}%`, minHeight: day.schedules > 0 ? 4 : 0 }}
                        />
                      </div>
                      <span className="text-xs text-muted font-mono">{day.label}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-4 mt-3">
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-accent/30" /><span className="text-2xs text-muted">便签</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-blue-400/30" /><span className="text-2xs text-muted">日程</span></div>
                </div>
              </div>

              {stats.topTags.length > 0 && (
                <div className="bg-white/60 border border-teal-900/5 rounded-[2rem] p-8 shadow-glass">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600"><Hash size={16} /></div>
                    <h3 className="text-sm font-bold text-foreground">热门标签</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {stats.topTags.map(([tag, count], idx) => (
                      <motion.span
                        key={tag}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.05 }}
                        className="px-3 py-1.5 rounded-xl bg-accent/5 border border-accent/10 text-xs font-bold text-accent"
                      >
                        #{tag} <span className="text-accent/50 ml-1">{count}</span>
                      </motion.span>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Graph View */}
          {dataView === 'graph' && (
            <motion.div key="graph-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="bg-white/60 border border-teal-900/5 rounded-[2rem] p-8 shadow-glass min-h-[400px]">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600"><Network size={16} /></div>
                  <h3 className="text-sm font-bold text-foreground">知识图谱</h3>
                  <span className="text-2xs text-muted ml-2">便签之间的关系网络</span>
                </div>
                <p className="text-xs text-muted mb-4">完整的知识图谱请前往「知识库」页面查看</p>
                <div className="flex flex-wrap gap-3 justify-center py-8">
                  {memos.slice(0, 12).map((memo, idx) => {
                    const colors = ['bg-amber-400', 'bg-blue-400', 'bg-purple-400', 'bg-emerald-400', 'bg-rose-400'];
                    return (
                      <motion.div
                        key={memo.id}
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.05 }}
                        className="flex flex-col items-center gap-1"
                      >
                        <div className={`w-10 h-10 rounded-xl ${colors[idx % colors.length]} flex items-center justify-center text-white text-2xs font-bold shadow-lg`}>
                          {(memo.title || '?')[0]}
                        </div>
                        <span className="text-xs text-muted max-w-[60px] truncate text-center">{memo.title}</span>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default InsightPanel;