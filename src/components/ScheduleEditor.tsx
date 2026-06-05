import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Save, Clock, Tag, AlignLeft, Calendar, Repeat, Link2, Flag, ArrowUp, ArrowRight, ArrowDown } from 'lucide-react';

interface Schedule {
    id: string;
    title: string;
    content: string;
    start_time: string;
    end_time?: string;
    memo_id?: string;
    status: string;
    category: string;
    recurrence?: string;
    linked_memos?: string[];
    priority?: string;
    due_date?: string;
    parent_id?: string;
    sort_order?: number;
}

interface ScheduleEditorProps {
    schedule: Schedule;
    onSave: (schedule: Schedule) => void;
    onClose: () => void;
    memos?: any[];
    onNavigateToMemo?: (memo: any) => void;
    allSchedules?: any[];
}

const priorityOptions = [
    { key: 'high', label: '高优先级', icon: <ArrowUp size={14} />, color: 'bg-red-500 text-white' },
    { key: 'medium', label: '中优先级', icon: <ArrowRight size={14} />, color: 'bg-amber-500 text-white' },
    { key: 'low', label: '低优先级', icon: <ArrowDown size={14} />, color: 'bg-blue-400 text-white' },
];

const ScheduleEditor: React.FC<ScheduleEditorProps> = ({ schedule, onSave, onClose, memos = [], onNavigateToMemo, allSchedules = [] }) => {
    const [formData, setFormData] = useState<Schedule>(() => {
        const s: Schedule = {
            ...schedule,
            recurrence: schedule.recurrence || 'none',
            priority: schedule.priority || 'medium',
            due_date: schedule.due_date || '',
            parent_id: schedule.parent_id || '',
            sort_order: schedule.sort_order || 0,
        };
        const rawLinkedMemos = (s as unknown as Record<string, unknown>).linked_memos;
        if (typeof rawLinkedMemos === 'string') {
            try { s.linked_memos = JSON.parse(rawLinkedMemos); } catch { s.linked_memos = []; }
        }
        if (!s.linked_memos) {
            s.linked_memos = s.memo_id ? [s.memo_id] : [];
        }
        return s;
    });

    const categories = ['收件箱', '会议', '个人', '工作', '截止日期', '学习', '其他'];
    const statusOptions = [
        { key: 'inbox', label: '收件箱' },
        { key: 'today', label: '今日' },
        { key: 'next', label: '下一步' },
        { key: 'waiting', label: '等待' },
        { key: 'done', label: '已完成' },
    ];
    const parentCandidates = allSchedules.filter(s => s.id !== schedule.id && (!s.parent_id || s.parent_id === ''));

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-teal-900/10 backdrop-blur-md"
        >
            <motion.div
                initial={{ scale: 0.95, y: 20, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.95, y: 20, opacity: 0 }}
                className="w-full max-w-lg bg-white/90 backdrop-blur-2xl border border-teal-900/10 rounded-[2.5rem] shadow-premium p-10 relative overflow-hidden max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
                <div className="absolute top-0 right-0 w-48 h-48 bg-accent/5 blur-3xl rounded-full -mr-24 -mt-24"></div>

                <div className="relative z-10">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <span className="text-2xs font-black uppercase tracking-[0.2em] text-accent mb-1 block">Todo Editor</span>
                            <h2 className="text-2xl font-display font-bold text-foreground">
                                {schedule.title ? '编辑待办' : '新增待办'}
                            </h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-10 h-10 flex items-center justify-center rounded-xl text-muted hover:text-foreground hover:bg-teal-900/5 transition-all"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-2xs font-bold text-muted uppercase tracking-widest px-1">待办名称</label>
                            <div className="relative group">
                                <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-accent transition-colors" />
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    placeholder="输入待办事项..."
                                    className="w-full pl-12 pr-4 py-3 bg-white/50 border border-teal-900/5 rounded-2xl outline-none focus:border-accent/30 focus:bg-white transition-all text-sm font-medium"
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-2xs font-bold text-muted uppercase tracking-widest px-1">优先级</label>
                            <div className="flex gap-2">
                                {priorityOptions.map(opt => (
                                    <button
                                        key={opt.key}
                                        onClick={() => setFormData({ ...formData, priority: opt.key })}
                                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                                            formData.priority === opt.key
                                                ? `${opt.color} shadow-sm`
                                                : 'bg-white/50 text-muted border border-teal-900/5 hover:border-accent/30'
                                        }`}
                                    >
                                        {opt.icon}{opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-2xs font-bold text-muted uppercase tracking-widest px-1">状态</label>
                            <div className="flex gap-2">
                                {statusOptions.map(opt => (
                                    <button
                                        key={opt.key}
                                        onClick={() => setFormData({ ...formData, status: opt.key })}
                                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                                            formData.status === opt.key
                                                ? 'bg-accent text-white shadow-sm'
                                                : 'bg-white/50 text-muted border border-teal-900/5 hover:border-accent/30'
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <label className="text-2xs font-bold text-muted uppercase tracking-widest px-1">开始时间</label>
                                <div className="relative group">
                                    <Clock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-accent transition-colors" />
                                    <input
                                        type="datetime-local"
                                        value={formData.start_time.slice(0, 16)}
                                        onChange={(e) => setFormData({ ...formData, start_time: new Date(e.target.value).toISOString() })}
                                        className="w-full pl-12 pr-4 py-3 bg-white/50 border border-teal-900/5 rounded-2xl outline-none focus:border-accent/30 focus:bg-white transition-all text-sm font-medium"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-2xs font-bold text-muted uppercase tracking-widest px-1 flex items-center gap-1"><Flag size={10} />截止日期</label>
                                <div className="relative group">
                                    <Flag size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-red-500 transition-colors" />
                                    <input
                                        type="date"
                                        value={formData.due_date ? formData.due_date.slice(0, 10) : ''}
                                        onChange={(e) => setFormData({ ...formData, due_date: e.target.value ? new Date(e.target.value).toISOString() : '' })}
                                        className="w-full pl-12 pr-4 py-3 bg-white/50 border border-teal-900/5 rounded-2xl outline-none focus:border-accent/30 focus:bg-white transition-all text-sm font-medium"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-2xs font-bold text-muted uppercase tracking-widest px-1">分类标签</label>
                            <div className="flex flex-wrap gap-2">
                                {categories.map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => setFormData({ ...formData, category: cat })}
                                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                            formData.category === cat
                                                ? 'bg-accent text-white shadow-sm'
                                                : 'bg-white/50 text-muted border border-teal-900/5 hover:border-accent/30'
                                        }`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-2xs font-bold text-muted uppercase tracking-widest px-1 flex items-center gap-1"><Repeat size={10} />重复</label>
                            <div className="flex flex-wrap gap-2">
                                {[['none', '不重复'], ['daily', '每天'], ['weekdays', '工作日'], ['weekly', '每周'], ['monthly', '每月']].map(([val, label]) => (
                                    <button
                                        key={val}
                                        onClick={() => setFormData({ ...formData, recurrence: val as string })}
                                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                            (formData.recurrence || 'none') === val
                                                ? 'bg-accent text-white shadow-sm'
                                                : 'bg-white/50 text-muted border border-teal-900/5 hover:border-accent/30'
                                        }`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {parentCandidates.length > 0 && (
                            <div className="space-y-2">
                                <label className="text-2xs font-bold text-muted uppercase tracking-widest px-1">父级任务</label>
                                <select
                                    value={formData.parent_id || ''}
                                    onChange={(e) => setFormData({ ...formData, parent_id: e.target.value })}
                                    className="w-full px-4 py-3 bg-white/50 border border-teal-900/5 rounded-2xl outline-none focus:border-accent/30 focus:bg-white transition-all text-sm font-medium"
                                >
                                    <option value="">无（顶级任务）</option>
                                    {parentCandidates.map(s => (
                                        <option key={s.id} value={s.id}>{s.title || '无标题'}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-2xs font-bold text-muted uppercase tracking-widest px-1 flex items-center gap-1"><Link2 size={10} />关联便签</label>
                            {(formData.linked_memos || []).length > 0 && (
                                <div className="space-y-1.5">
                                    {(formData.linked_memos || []).map((memoId: string) => {
                                        const linkedMemo = memos.find(m => m.id === memoId);
                                        return (
                                            <div key={memoId} className="flex items-center gap-2 px-3 py-2 bg-accent/5 border border-accent/20 rounded-xl">
                                                <span className="text-xs font-medium text-accent truncate flex-1">
                                                    {linkedMemo?.title || '未找到便签'}
                                                </span>
                                                {onNavigateToMemo && linkedMemo && (
                                                    <button
                                                        onClick={() => { onClose(); onNavigateToMemo(linkedMemo); }}
                                                        className="text-accent hover:text-accent/70 transition-colors text-2xs font-bold"
                                                    >
                                                        查看
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => setFormData({ ...formData, linked_memos: (formData.linked_memos || []).filter(id => id !== memoId) })}
                                                    className="text-muted hover:text-red-500 transition-colors"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            <div className="relative group">
                                <select
                                    value=""
                                    onChange={(e) => {
                                        if (e.target.value && !(formData.linked_memos || []).includes(e.target.value)) {
                                            setFormData({ ...formData, linked_memos: [...(formData.linked_memos || []), e.target.value] });
                                        }
                                    }}
                                    className="w-full pl-10 pr-4 py-3 bg-white/50 border border-teal-900/5 rounded-2xl outline-none focus:border-accent/30 focus:bg-white transition-all text-sm font-medium appearance-none cursor-pointer"
                                >
                                    <option value="">添加关联便签...</option>
                                    {memos.filter(m => !(formData.linked_memos || []).includes(m.id)).slice(0, 20).map(m => (
                                        <option key={m.id} value={m.id}>{m.title || '无标题'}</option>
                                    ))}
                                </select>
                                <Link2 size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-accent transition-colors pointer-events-none" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-2xs font-bold text-muted uppercase tracking-widest px-1">补充描述</label>
                            <div className="relative group">
                                <AlignLeft size={16} className="absolute left-4 top-4 text-muted group-focus-within:text-accent transition-colors" />
                                <textarea
                                    value={formData.content}
                                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                    placeholder="添加备注信息..."
                                    rows={3}
                                    className="w-full pl-12 pr-4 py-3 bg-white/50 border border-teal-900/5 rounded-2xl outline-none focus:border-accent/30 focus:bg-white transition-all text-sm font-medium resize-none"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="mt-10 flex gap-4">
                        <button
                            onClick={() => onSave(formData)}
                            disabled={!formData.title}
                            className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-accent text-white rounded-2xl text-sm font-bold hover:bg-accent/90 transition-all shadow-premium disabled:opacity-30 active:scale-95"
                        >
                            <Save size={18} />
                            保存待办
                        </button>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default ScheduleEditor;
