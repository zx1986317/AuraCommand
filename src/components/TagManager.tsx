import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Hash, FileText, Calendar, BookOpen, Search, Tag, ChevronRight, Sparkles, Check } from 'lucide-react';

interface TagInfo {
    name: string;
    memoCount: number;
    scheduleCount: number;
}

interface TagManagerProps {
    isOpen: boolean;
    onClose: () => void;
    memos: any[];
    schedules: any[];
    onNavigateToMemo: (memo: any) => void;
    onNavigateToSchedule: (schedule: any) => void;
    onNavigateToKB: () => void;
    aiSuggestedTags?: Record<string, { tags: string[]; category?: string }>;
    onAcceptAiTags?: (noteId: string, tags: string[]) => void;
}

const TagManager: React.FC<TagManagerProps> = ({
    isOpen,
    onClose,
    memos,
    schedules,
    onNavigateToMemo,
    onNavigateToSchedule,
    onNavigateToKB,
    aiSuggestedTags = {},
    onAcceptAiTags,
}) => {
    const [tags, setTags] = useState<TagInfo[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedTag, setExpandedTag] = useState<string | null>(null);
    const [tagItems, setTagItems] = useState<{ memos: any[]; schedules: any[] }>({ memos: [], schedules: [] });
    const [showAiSuggestions, setShowAiSuggestions] = useState(false);

    const buildTagIndex = useCallback(() => {
        const tagMap = new Map<string, TagInfo>();

        memos.forEach((memo: any) => {
            const memoTags = Array.isArray(memo.tags) ? memo.tags : [];
            memoTags.forEach((tag: string) => {
                const t = tag.trim();
                if (!t) return;
                if (!tagMap.has(t)) tagMap.set(t, { name: t, memoCount: 0, scheduleCount: 0 });
                tagMap.get(t)!.memoCount++;
            });
            if (memo.category) {
                const cat = memo.category.trim();
                if (cat && !tagMap.has(cat)) tagMap.set(cat, { name: cat, memoCount: 0, scheduleCount: 0 });
                if (cat) tagMap.get(cat)!.memoCount++;
            }
        });

        schedules.forEach((sch: any) => {
            if (sch.category) {
                const cat = sch.category.trim();
                if (!cat) return;
                if (!tagMap.has(cat)) tagMap.set(cat, { name: cat, memoCount: 0, scheduleCount: 0 });
                tagMap.get(cat)!.scheduleCount++;
            }
        });

        const sorted = Array.from(tagMap.values()).sort((a, b) => (b.memoCount + b.scheduleCount) - (a.memoCount + a.scheduleCount));
        setTags(sorted);
    }, [memos, schedules]);

    useEffect(() => {
        if (isOpen) buildTagIndex();
    }, [isOpen, buildTagIndex]);

    const handleExpandTag = (tagName: string) => {
        if (expandedTag === tagName) {
            setExpandedTag(null);
            setTagItems({ memos: [], schedules: [] });
            return;
        }
        setExpandedTag(tagName);
        const relatedMemos = memos.filter((m: any) => {
            const mTags = Array.isArray(m.tags) ? m.tags : [];
            return mTags.includes(tagName) || m.category === tagName;
        });
        const relatedSchedules = schedules.filter((s: any) => s.category === tagName);
        setTagItems({ memos: relatedMemos, schedules: relatedSchedules });
    };

    const filteredTags = searchQuery
        ? tags.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()))
        : tags;

    const totalTags = tags.length;
    const totalMemos = memos.length;
    const totalSchedules = schedules.length;

    const aiSuggestionEntries = Object.entries(aiSuggestedTags).filter(([, v]) => v.tags?.length > 0);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[9998] flex items-center justify-center"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="w-full max-w-3xl max-h-[80vh] bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-teal-900/10 flex flex-col overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-6 py-4 border-b border-teal-900/5">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
                                    <Tag size={18} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-display font-bold">标签管理器</h2>
                                    <p className="text-2xs text-muted">{totalTags} 个标签 · {totalMemos} 条便签 · {totalSchedules} 个日程</p>
                                </div>
                            </div>
                            <button onClick={onClose} className="p-2 rounded-xl hover:bg-teal-900/5 text-muted hover:text-foreground transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="px-6 py-3 border-b border-teal-900/5">
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="搜索标签..."
                                    className="w-full pl-10 pr-4 py-2 bg-white/60 border border-teal-900/5 rounded-xl text-sm outline-none focus:border-accent/30 transition-all placeholder:text-muted/40"
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                            {aiSuggestionEntries.length > 0 && (
                                <div className="mb-6">
                                    <button
                                        onClick={() => setShowAiSuggestions(!showAiSuggestions)}
                                        className="flex items-center gap-2 mb-3 text-sm font-bold text-amber-600 hover:text-amber-700 transition-colors"
                                    >
                                        <Sparkles size={14} />
                                        AI 推荐标签 ({aiSuggestionEntries.length})
                                        <ChevronRight size={14} className={`transition-transform ${showAiSuggestions ? 'rotate-90' : ''}`} />
                                    </button>
                                    <AnimatePresence>
                                        {showAiSuggestions && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden space-y-2"
                                            >
                                                {aiSuggestionEntries.map(([noteId, data]) => {
                                                    const memo = memos.find(m => m.id === noteId)
                                                    return (
                                                        <div key={noteId} className="flex items-center gap-3 px-4 py-3 bg-amber-50/50 rounded-xl border border-amber-100">
                                                            <FileText size={12} className="text-amber-500 shrink-0" />
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-xs font-medium text-foreground truncate">{memo?.title || '未知笔记'}</p>
                                                                <div className="flex flex-wrap gap-1 mt-1">
                                                                    {data.tags.map(tag => (
                                                                        <span key={tag} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-2xs bg-amber-100 text-amber-700">
                                                                            <Sparkles size={8} />
                                                                            {tag}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={() => onAcceptAiTags?.(noteId, data.tags)}
                                                                className="p-1.5 rounded-lg bg-amber-100 text-amber-600 hover:bg-amber-200 transition-colors"
                                                                title="采纳标签"
                                                            >
                                                                <Check size={12} />
                                                            </button>
                                                        </div>
                                                    )
                                                })}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                    <div className="border-b border-teal-900/5 my-4" />
                                </div>
                            )}

                            {filteredTags.length === 0 && (
                                <div className="py-12 text-center text-muted text-sm">
                                    {searchQuery ? `未找到标签「${searchQuery}」` : '暂无标签数据'}
                                </div>
                            )}

                            <div className="space-y-2">
                                {filteredTags.map(tag => (
                                    <div key={tag.name}>
                                        <button
                                            onClick={() => handleExpandTag(tag.name)}
                                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                                                expandedTag === tag.name
                                                    ? 'bg-accent/5 border border-accent/20'
                                                    : 'hover:bg-teal-900/[0.03] border border-transparent'
                                            }`}
                                        >
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                                                tag.memoCount > 0 && tag.scheduleCount > 0
                                                    ? 'bg-gradient-to-br from-teal-100 to-purple-100 text-teal-700'
                                                    : tag.memoCount > 0
                                                    ? 'bg-teal-50 text-teal-700'
                                                    : 'bg-purple-50 text-purple-700'
                                            }`}>
                                                <Hash size={14} />
                                            </div>
                                            <span className="text-sm font-bold text-foreground flex-1 text-left">{tag.name}</span>
                                            <div className="flex items-center gap-2">
                                                {tag.memoCount > 0 && (
                                                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 text-2xs font-bold">
                                                        <FileText size={10} />{tag.memoCount}
                                                    </span>
                                                )}
                                                {tag.scheduleCount > 0 && (
                                                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-2xs font-bold">
                                                        <Calendar size={10} />{tag.scheduleCount}
                                                    </span>
                                                )}
                                                <ChevronRight size={14} className={`text-muted transition-transform ${expandedTag === tag.name ? 'rotate-90' : ''}`} />
                                            </div>
                                        </button>

                                        <AnimatePresence>
                                            {expandedTag === tag.name && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="pl-12 pr-4 py-2 space-y-2">
                                                        {tagItems.memos.length > 0 && (
                                                            <div>
                                                                <p className="text-xs font-bold text-muted uppercase tracking-wider mb-1.5">便签</p>
                                                                {tagItems.memos.map((memo: any) => (
                                                                    <button
                                                                        key={memo.id}
                                                                        onClick={() => { onNavigateToMemo(memo); onClose(); }}
                                                                        className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-teal-50 transition-colors group"
                                                                    >
                                                                        <FileText size={12} className="text-teal-500 shrink-0" />
                                                                        <span className="text-xs font-medium text-foreground group-hover:text-accent truncate">{memo.title || '无标题'}</span>
                                                                        <span className="text-xs text-muted ml-auto">{memo.category}</span>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {tagItems.schedules.length > 0 && (
                                                            <div>
                                                                <p className="text-xs font-bold text-muted uppercase tracking-wider mb-1.5">日程</p>
                                                                {tagItems.schedules.map((sch: any) => (
                                                                    <button
                                                                        key={sch.id}
                                                                        onClick={() => { onNavigateToSchedule(sch); onClose(); }}
                                                                        className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-purple-50 transition-colors group"
                                                                    >
                                                                        <Calendar size={12} className="text-purple-500 shrink-0" />
                                                                        <span className="text-xs font-medium text-foreground group-hover:text-accent truncate">{sch.title}</span>
                                                                        <span className="text-xs text-muted ml-auto">{sch.start_time?.substring(0, 10)}</span>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default TagManager;
