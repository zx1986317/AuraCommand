import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, FileText, BookOpen, Calendar, X, ArrowRight, Hash, Brain, Sparkles, CheckSquare, Clock, Star, Trash2, RotateCcw } from 'lucide-react';

interface SearchResult {
    id: string;
    type: 'memo' | 'file' | 'schedule' | 'task' | 'chat';
    title: string;
    text: string;
    category?: string;
    tags?: string;
    updated_at?: string;
    status?: string;
    snippet?: string;
    rank?: number;
    similarity?: number;
    session_title?: string;
}

interface GlobalSearchProps {
    isOpen: boolean;
    onClose: () => void;
    onNavigateToMemo: (memo: { id: string; title: string; type?: string }) => void;
    onNavigateToKB: () => void;
    onNavigateToSchedule: (schedule: { id: string; title: string }) => void;
    onNavigateToTasks?: () => void;
}

const SEARCH_HISTORY_KEY = 'auracommand_search_history';
const MAX_HISTORY = 8;

function getSearchHistory(): string[] {
    try { return JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || '[]'); }
    catch { return []; }
}
function addSearchHistory(q: string) {
    const h = getSearchHistory().filter(s => s !== q);
    h.unshift(q);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(h.slice(0, MAX_HISTORY)));
}
function clearSearchHistory() {
    localStorage.removeItem(SEARCH_HISTORY_KEY);
}

const highlightText = (text: string, query: string): React.ReactNode => {
    if (!query.trim() || !text) return text;
    const keywords = query.split(/\s+/).filter(Boolean);
    if (keywords.length === 0) return text;

    const regex = new RegExp(`(${keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, i) => {
        const isMatch = keywords.some(k => part.toLowerCase() === k.toLowerCase());
        if (isMatch) {
            return <mark key={i} className="bg-amber-200/80 text-amber-900 rounded-sm px-0.5">{part}</mark>;
        }
        return part;
    });
};

const getSnippet = (text: string, query: string, maxLen = 120): string => {
    if (!text || !query.trim()) return (text || '').substring(0, maxLen);
    const lower = text.toLowerCase();
    const keywords = query.split(/\s+/).filter(Boolean);
    let bestPos = 0;
    for (const kw of keywords) {
        const idx = lower.indexOf(kw.toLowerCase());
        if (idx !== -1) { bestPos = idx; break; }
    }
    const start = Math.max(0, bestPos - 30);
    const end = Math.min(text.length, start + maxLen);
    let snippet = text.substring(start, end);
    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet = snippet + '...';
    return snippet;
};

const GlobalSearch: React.FC<GlobalSearchProps> = ({
    isOpen,
    onClose,
    onNavigateToMemo,
    onNavigateToKB,
    onNavigateToSchedule,
    onNavigateToTasks,
}) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [filter, setFilter] = useState<'all' | 'memo' | 'file' | 'schedule' | 'task' | 'chat'>('all');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isSearching, setIsSearching] = useState(false);
    const [semanticResults, setSemanticResults] = useState<SearchResult[]>([]);
    const [showSemantic, setShowSemantic] = useState(false);
    const [searchHistory, setSearchHistory] = useState<string[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);
    const searchTimer = useRef<ReturnType<typeof setTimeout>>();

    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setResults([]);
            setSemanticResults([]);
            setFilter('all');
            setSelectedIndex(0);
            setShowSemantic(false);
            setSearchHistory(getSearchHistory());
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const performFTSSearch = useCallback(async (searchQuery: string) => {
        if (!searchQuery.trim()) {
            setResults([]);
            return;
        }
        setIsSearching(true);
        try {
            const [searchRes, taskResults, hybridResults, chatResults] = await Promise.all([
                window.ipcRenderer.invoke('global-search', { query: searchQuery }),
                window.ipcRenderer.invoke('search-tasks', searchQuery).catch(() => []),
                window.ipcRenderer.invoke('global-hybrid-search', { query: searchQuery }).catch(() => []),
                window.ipcRenderer.invoke('search-chat-messages', { query: searchQuery }).catch(() => []),
            ]);
            const merged: SearchResult[] = [];
            if (Array.isArray(searchRes)) {
                merged.push(...searchRes);
            } else if (searchRes?.success && searchRes.results) {
                merged.push(...searchRes.results);
            }
            if (Array.isArray(taskResults)) {
                for (const t of taskResults) {
                    if (!merged.some(r => r.id === t.id)) {
                        merged.push({
                            id: t.id,
                            type: 'task',
                            title: t.title || '未命名任务',
                            text: t.description || '',
                            status: t.status,
                            tags: t.tags,
                            updated_at: t.updated_at,
                        });
                    }
                }
            }
            if (Array.isArray(hybridResults)) {
                for (const hr of hybridResults) {
                    if (!merged.some(r => r.id === hr.id)) {
                        const type = hr.source_type === 'file' || hr.source_type === 'vector' ? 'file' : 'memo';
                        merged.push({
                            id: hr.id,
                            type: type as 'file' | 'memo',
                            title: hr.title || '未命名',
                            text: hr.content || '',
                        });
                    }
                }
            }
            if (Array.isArray(chatResults)) {
                for (const msg of chatResults) {
                    if (!merged.some(r => r.id === msg.id)) {
                        merged.push({
                            id: msg.id,
                            type: 'chat',
                            title: msg.session_title || '对话记录',
                            text: msg.content || '',
                            session_title: msg.session_title,
                            updated_at: msg.created_at,
                        });
                    }
                }
            }
            const filtered = filter === 'all' ? merged : merged.filter(r => r.type === filter);
            setResults(filtered);
            setSelectedIndex(0);
        } catch {
            setResults([]);
        }
        setIsSearching(false);
    }, [filter]);

    const performSemanticSearch = useCallback(async (searchQuery: string) => {
        if (!searchQuery.trim()) return;
        try {
            const vectorResults = await window.ipcRenderer.invoke('search-memos', searchQuery);
            if (vectorResults && vectorResults.length > 0) {
                const mapped: SearchResult[] = vectorResults.slice(0, 8).map((r: any) => ({
                    id: r.id,
                    type: r.type === 'memo' ? 'memo' : 'file',
                    title: r.title || '未命名',
                    text: r.text || r.content || '',
                    category: r.metadata?.category,
                    rank: r._distance !== undefined ? 1 - r._distance : undefined,
                    similarity: r._distance !== undefined ? Math.round((1 - r._distance) * 100) : undefined,
                }));
                setSemanticResults(mapped);
            } else {
                setSemanticResults([]);
            }
        } catch {
            setSemanticResults([]);
        }
    }, []);

    useEffect(() => {
        if (searchTimer.current) clearTimeout(searchTimer.current);
        if (!query.trim()) {
            setResults([]);
            setSemanticResults([]);
            setShowSemantic(false);
            return;
        }
        searchTimer.current = setTimeout(() => {
            performFTSSearch(query);
            addSearchHistory(query.trim());
            setSearchHistory(getSearchHistory());
        }, 200);
        return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
    }, [query, filter, performFTSSearch]);

    useEffect(() => {
        if (query.trim() && showSemantic) {
            performSemanticSearch(query);
        }
    }, [query, showSemantic, performSemanticSearch]);

    const handleSelect = (result: SearchResult) => {
        if (result.type === 'memo') {
            onNavigateToMemo({ id: result.id, title: result.title, type: 'note' });
        } else if (result.type === 'file') {
            onNavigateToKB();
        } else if (result.type === 'schedule') {
            onNavigateToSchedule({ id: result.id, title: result.title });
        } else if (result.type === 'task') {
            onNavigateToTasks?.();
        }
        onClose();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        const allVisible = showSemantic ? [...results, ...semanticResults.filter(sr => !results.some(r => r.id === sr.id))] : results;
        const maxIdx = Math.max(0, allVisible.length - 1);
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => Math.min(prev + 1, maxIdx));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
            const safeIdx = Math.min(selectedIndex, maxIdx);
            if (allVisible[safeIdx]) {
                handleSelect(allVisible[safeIdx]);
            }
        } else if (e.key === 'Escape') {
            onClose();
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'memo': return <FileText size={14} className="text-teal-600" />;
            case 'file': return <BookOpen size={14} className="text-blue-600" />;
            case 'schedule': return <Calendar size={14} className="text-purple-600" />;
            case 'task': return <CheckSquare size={14} className="text-emerald-600" />;
            default: return <FileText size={14} />;
        }
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'memo': return '便签';
            case 'file': return '知识库';
            case 'schedule': return '日程';
            case 'task': return '待办';
            case 'chat': return '对话';
            default: return '';
        }
    };

    const renderResultItem = (result: SearchResult, index: number, isSemantic = false) => (
        <button
            key={`${result.type}-${result.id}${isSemantic ? '-sem' : ''}`}
            onClick={() => handleSelect(result)}
            className={`w-full text-left px-5 py-3 flex items-start gap-3 transition-all border-b border-teal-900/5 last:border-0 cursor-pointer ${
                index === selectedIndex ? 'bg-accent/5' : 'hover:bg-teal-900/[0.02]'
            }`}
        >
            <div className="mt-0.5 shrink-0">
                {isSemantic ? <Brain size={14} className="text-amber-500" /> : getTypeIcon(result.type)}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-bold text-foreground truncate">
                        {highlightText(result.title || '无标题', query)}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                        result.type === 'memo' ? 'bg-teal-50 text-teal-700' :
                        result.type === 'file' ? 'bg-blue-50 text-blue-700' :
                        result.type === 'task' ? 'bg-emerald-50 text-emerald-700' :
                        'bg-purple-50 text-purple-700'
                    }`}>
                        {getTypeLabel(result.type)}
                    </span>
                    {result.category && (
                        <span className="text-xs text-muted flex items-center gap-0.5">
                            <Hash size={8} />{result.category}
                        </span>
                    )}
                    {result.status && result.type === 'task' && (
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                            result.status === 'done' ? 'bg-emerald-50 text-emerald-600' :
                            result.status === 'today' ? 'bg-blue-50 text-blue-600' :
                            'bg-slate-50 text-slate-600'
                        }`}>
                            {result.status === 'inbox' ? '收集箱' : result.status === 'today' ? '今日' : result.status === 'next' ? '稍后' : '已完成'}
                        </span>
                    )}
                    {isSemantic && (
                        <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 flex items-center gap-0.5">
                            <Sparkles size={8} />{result.similarity !== undefined ? `${result.similarity}%` : '语义'}
                        </span>
                    )}
                </div>
                {result.text && (
                    <p className="text-2xs text-muted leading-relaxed line-clamp-2">
                        {highlightText(getSnippet(result.snippet || result.text, query), query)}
                    </p>
                )}
            </div>
            <ArrowRight size={12} className="text-muted/50 mt-1.5 shrink-0" />
        </button>
    );

    const uniqueSemanticResults = semanticResults.filter(sr => !results.some(r => r.id === sr.id));
    const allCount = results.length + (showSemantic ? uniqueSemanticResults.length : 0);

    const noQuery = !query.trim();

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[9999] flex items-start justify-center pt-[15vh]"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ opacity: 0, y: -20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="w-full max-w-2xl bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-teal-900/10 overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-3 px-5 py-4 border-b border-teal-900/5">
                            <Search size={18} className="text-accent shrink-0" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="搜索便签、知识库、日程、待办... (Ctrl+K)"
                                className="flex-1 bg-transparent text-sm outline-none placeholder:text-teal-900/30"
                            />
                            {isSearching && (
                                <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                            )}
                            <button
                                onClick={() => setShowSemantic(prev => !prev)}
                                className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-colors ${showSemantic ? 'bg-amber-100 text-amber-600' : 'text-muted hover:text-foreground hover:bg-teal-900/5'}`}
                                title="语义搜索 (需要 Ollama)"
                            >
                                <Brain size={13} />
                                <span className="text-2xs font-medium">语义</span>
                            </button>
                            <button onClick={onClose} className="text-muted hover:text-foreground transition-colors">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="flex items-center gap-1 px-5 py-2 border-b border-teal-900/5 bg-white/50">
                            {(['all', 'memo', 'file', 'task', 'schedule', 'chat'] as const).map(f => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    className={`px-3 py-1 rounded-lg text-2xs font-medium transition-all ${
                                        filter === f 
                                            ? 'bg-accent/10 text-accent' 
                                            : 'text-muted hover:text-foreground hover:bg-teal-900/5'
                                    }`}
                                >
                                    {f === 'all' ? '全部' : f === 'memo' ? '便签' : f === 'file' ? '知识库' : f === 'task' ? '待办' : f === 'schedule' ? '日程' : '对话'}
                                </button>
                            ))}
                            <span className="ml-auto text-xs text-muted font-mono">
                                {allCount > 0 ? `${allCount} 条结果` : query ? '无结果' : '输入关键词开始搜索'}
                            </span>
                        </div>

                        <div className="max-h-[40vh] overflow-y-auto custom-scrollbar">
                            {noQuery && searchHistory.length > 0 && (
                                <div className="px-5 py-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-2xs font-medium text-muted flex items-center gap-1">
                                            <Clock size={10} /> 搜索历史
                                        </span>
                                        <button
                                            onClick={() => { clearSearchHistory(); setSearchHistory([]); }}
                                            className="text-xs text-muted hover:text-red-500 transition-colors"
                                        >
                                            清除
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {searchHistory.map((h, i) => (
                                            <button
                                                key={i}
                                                onClick={() => setQuery(h)}
                                                className="px-2.5 py-1 bg-teal-900/5 rounded-lg text-2xs text-muted hover:text-accent hover:bg-accent/10 transition-all"
                                            >
                                                {h}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {results.length === 0 && (!showSemantic || uniqueSemanticResults.length === 0) && query && !isSearching && (
                                <div className="py-12 text-center text-muted text-xs">
                                    未找到与「{query}」相关的内容
                                </div>
                            )}

                            {results.length > 0 && (
                                <div className="px-5 py-1.5 bg-slate-50/50 border-b border-teal-900/5">
                                    <span className="text-xs font-bold text-slate-500">精确匹配</span>
                                </div>
                            )}
                            {results.map((result, index) => renderResultItem(result, index))}

                            {showSemantic && uniqueSemanticResults.length > 0 && (
                                <>
                                    <div className="px-5 py-1.5 bg-amber-50/50 border-b border-amber-100">
                                        <span className="text-xs font-bold text-amber-600 flex items-center gap-1">
                                            <Brain size={10} /> 语义搜索结果
                                        </span>
                                    </div>
                                    {uniqueSemanticResults.map((result, index) =>
                                        renderResultItem(result, results.length + index, true)
                                    )}
                                </>
                            )}
                        </div>

                        {(query && allCount > 0) && (
                            <div className="px-5 py-2 border-t border-teal-900/5 bg-white/50 flex items-center justify-between">
                                <span className="text-xs text-muted">↑↓ 导航 · Enter 打开 · Esc 关闭</span>
                                {showSemantic && (
                                    <span className="text-xs text-amber-500 flex items-center gap-1">
                                        <Brain size={9} /> 语义搜索已开启
                                    </span>
                                )}
                            </div>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default GlobalSearch;
