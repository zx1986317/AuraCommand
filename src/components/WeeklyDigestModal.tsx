import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, FileText, X, Loader2, BookOpen, CheckSquare, MessageSquare, AlertCircle } from 'lucide-react';

interface NoteItem { id: string; title: string; type: string; updated_at: string; }
interface KbItem { id: string; file_name: string; file_type: string; }
interface TaskItem { id: string; title: string; }

interface DigestStats {
  rangeLabel: string;
  notes: any[];
  taskCompleted: TaskItem[];
  taskCreated: TaskItem[];
  taskIncomplete: TaskItem[];
  chatCount: number;
  chatTopics: string[];
  kbFiles: KbItem[];
}

interface WeeklyDigestData {
  summary: string;
  stats: DigestStats | null;
  noteItems: NoteItem[];
  kbItems: KbItem[];
  taskItems: { completed: TaskItem[]; incomplete: TaskItem[] };
}

interface WeeklyDigestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToMemo: (memo: { id: string; title: string; type: string }) => void;
}

type RangeType = 'week' | 'month' | 'custom';

const WeeklyDigestModal: React.FC<WeeklyDigestModalProps> = ({ isOpen, onClose, onNavigateToMemo }) => {
  const [data, setData] = useState<WeeklyDigestData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<RangeType>('week');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const loadDigest = (r: RangeType) => {
    setLoading(true);
    setError(null);
    const params: any = { range: r };
    if (r === 'custom') {
      params.startDate = startDate;
      params.endDate = endDate;
    }
    window.ipcRenderer.invoke('get-weekly-digest', params).then(res => {
      setData(res);
      setLoading(false);
    }).catch((err: any) => {
      setError(err.message || '加载失败');
      setLoading(false);
    });
  };

  useEffect(() => {
    if (isOpen) {
      loadDigest(range);
    }
  }, [isOpen, range]);

  useEffect(() => {
    if (range === 'custom' && startDate && endDate) {
      loadDigest('custom');
    }
  }, [range, startDate, endDate]);

  const stats = data?.stats;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className="relative bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden"
          >
            <div className="bg-gradient-to-r from-amber-50 via-teal-50 to-white border-b border-amber-100/60 px-6 py-5 shrink-0">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-100 to-teal-100 flex items-center justify-center shadow-sm">
                    <Sparkles size={20} className="text-amber-500" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-gray-800">AI 回顾</h2>
                    <p className="text-2xs text-muted">
                      {loading ? '正在生成...' : stats ? `${stats.rangeLabel}数据全览` : '加载中...'}
                    </p>
                  </div>
                </div>
                <button onClick={onClose} className="p-2 rounded-xl hover:bg-black/5 text-muted transition-colors">
                  <X size={18} />
                </button>
              </div>

              <div className="flex gap-1.5">
                {(['week', 'month', 'custom'] as RangeType[]).map(r => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    className={`px-3 py-1.5 rounded-lg text-2xs font-medium transition-all ${range === r ? 'bg-accent text-white shadow-sm' : 'bg-white border border-gray-100 text-gray-500 hover:bg-teal-50'}`}
                  >
                    {r === 'week' ? '本周' : r === 'month' ? '本月' : '自定义'}
                  </button>
                ))}
              </div>

              {range === 'custom' && (
                <div className="flex gap-2 mt-3">
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-accent/30"
                  />
                  <span className="flex items-center text-xs text-gray-400">至</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-accent/30"
                  />
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {loading && (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 size={28} className="text-amber-400 animate-spin" />
                  <p className="text-xs text-muted">AI 正在整理你的数据...</p>
                </div>
              )}

              {error && (
                <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
                  <p className="text-xs text-red-400">{error}</p>
                  <button onClick={() => loadDigest(range)} className="text-2xs text-accent hover:underline">重试</button>
                </div>
              )}

              {data && !loading && (
                <>
                  {data.summary && (
                    <div className="bg-gradient-to-br from-amber-50 via-teal-50 to-white rounded-2xl border border-amber-100/80 p-4">
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{data.summary}</p>
                    </div>
                  )}

                  {stats && (
                    <div className="grid grid-cols-2 gap-2.5">
                      <StatCard
                        icon={<BookOpen size={14} />}
                        label="便签/文档"
                        value={`${stats.notes.length} 篇`}
                        color="text-teal-500"
                        bg="bg-teal-50"
                      />
                      <StatCard
                        icon={<CheckSquare size={14} />}
                        label="待办"
                        value={`${stats.taskCreated.length} 新建 · ${stats.taskCompleted.length} 完成`}
                        color="text-blue-500"
                        bg="bg-blue-50"
                      />
                      <StatCard
                        icon={<MessageSquare size={14} />}
                        label="AI 对话"
                        value={`${stats.chatCount} 条提问`}
                        color="text-amber-500"
                        bg="bg-amber-50"
                      />
                    </div>
                  )}

                  {stats && stats.kbFiles.length > 0 && (
                    <div>
                      <p className="text-2xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <BookOpen size={10} /> 知识库新增/索引
                      </p>
                      <div className="space-y-1.5">
                        {stats.kbFiles.map(f => (
                          <div key={f.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 border border-gray-100">
                            <FileText size={12} className="text-gray-400 shrink-0" />
                            <span className="text-xs text-gray-600 truncate flex-1">{f.file_name}</span>
                            <span className="text-xs text-gray-300 shrink-0">{f.file_type}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {stats && stats.taskIncomplete.length > 0 && (
                    <div>
                      <p className="text-2xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <AlertCircle size={10} className="text-orange-400" /> 未完成待办
                      </p>
                      <div className="space-y-1.5">
                        {stats.taskIncomplete.map(t => (
                          <div key={t.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-50 border border-orange-100">
                            <CheckSquare size={12} className="text-orange-300 shrink-0" />
                            <span className="text-xs text-gray-600 truncate">{t.title || '无标题'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {data.noteItems.length > 0 && (
                    <div>
                      <p className="text-2xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <FileText size={10} /> 最近文档
                      </p>
                      <div className="space-y-1.5">
                        {data.noteItems.map(n => (
                          <button
                            key={n.id}
                            onClick={() => { onNavigateToMemo({ id: n.id, title: n.title, type: n.type }); onClose(); }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border border-gray-100 bg-white hover:bg-teal-50 hover:border-teal-100 transition-all text-left"
                          >
                            <FileText size={12} className="text-teal-400 shrink-0" />
                            <span className="text-xs text-gray-700 truncate flex-1">{n.title || '无标题'}</span>
                            <span className="text-2xs text-gray-400 shrink-0">{n.type === 'document' ? '文档' : '便签'}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {stats && stats.chatTopics.length > 0 && (
                    <div>
                      <p className="text-2xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <MessageSquare size={10} /> AI 对话主题
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {stats.chatTopics.slice(0, 8).map((topic, i) => (
                          <span key={i} className="px-2.5 py-1 bg-amber-50 border border-amber-100 rounded-lg text-2xs text-gray-600 truncate max-w-[200px]">{topic}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string; color: string; bg: string; subValue?: string; subColor?: string }> =
  ({ icon, label, value, color, bg, subValue, subColor }) => (
    <div className={`${bg} rounded-2xl p-3 border border-gray-100`}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className={color}>{icon}</span>
        <span className="text-2xs font-medium text-gray-400">{label}</span>
      </div>
      <p className={`text-sm font-bold ${color}`}>{value}</p>
      {subValue && <p className={`text-2xs ${subColor || 'text-gray-400'} mt-0.5`}>{subValue}</p>}
    </div>
  );

export default WeeklyDigestModal;