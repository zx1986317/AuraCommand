import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { StickyNote, Search } from 'lucide-react';
import { ipcService } from '../services/ipc';

interface WikiLinkSuggestionProps {
  searchQuery: string;
  position: { top: number; left: number };
  onSelect: (title: string) => void;
  onClose: () => void;
  excludeId?: string;
}

const WikiLinkSuggestion: React.FC<WikiLinkSuggestionProps> = ({
  searchQuery,
  position,
  onSelect,
  onClose,
  excludeId,
}) => {
  const [results, setResults] = useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const searchMemos = useCallback(async (query: string) => {
    if (!query.trim()) {
      try {
        const allMemos = await ipcService.memos.getAll();
        const filtered = (allMemos || []).filter((m: any) => m.id !== excludeId).slice(0, 8);
        setResults(filtered);
      } catch {
        setResults([]);
      }
      return;
    }
    setLoading(true);
    try {
      const searchResults = await ipcService.memos.searchByTitle(query);
      const filtered = (searchResults || []).filter((m: any) => m.id !== excludeId).slice(0, 8);
      setResults(filtered);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [excludeId]);

  useEffect(() => {
    searchMemos(searchQuery);
  }, [searchQuery, searchMemos]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (results[selectedIndex]) {
          onSelect(results[selectedIndex].title);
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [results, selectedIndex, onSelect, onClose]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <AnimatePresence>
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0, y: -8, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.96 }}
        transition={{ duration: 0.15 }}
        className="fixed z-[200] w-72 bg-white/95 backdrop-blur-xl border border-teal-900/10 rounded-2xl shadow-xl overflow-hidden"
        style={{ top: position.top, left: position.left }}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-teal-900/5 bg-teal-900/[0.02]">
          <Search size={12} className="text-accent" />
          <span className="text-2xs font-bold text-muted uppercase tracking-widest">
            {searchQuery ? '搜索便签...' : '选择便签链接...'}
          </span>
        </div>
        <div className="max-h-64 overflow-y-auto custom-scrollbar py-1">
          {loading ? (
            <div className="px-4 py-6 text-center">
              <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-2xs text-muted">
                {searchQuery ? `未找到 "${searchQuery}" 相关便签` : '暂无可链接的便签'}
              </p>
              {searchQuery && (
                <button
                  onClick={() => onSelect(searchQuery)}
                  className="mt-2 text-2xs text-accent hover:underline font-bold"
                >
                  创建新链接: [[{searchQuery}]]
                </button>
              )}
            </div>
          ) : (
            results.map((memo, idx) => (
              <button
                key={memo.id}
                onClick={() => onSelect(memo.title)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all ${
                  idx === selectedIndex
                    ? 'bg-accent/10 text-accent'
                    : 'hover:bg-teal-900/5 text-foreground'
                }`}
              >
                <StickyNote size={14} className={idx === selectedIndex ? 'text-accent' : 'text-muted'} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate">{memo.title || '无标题'}</p>
                  {memo.tags && (
                    <p className="text-xs text-muted truncate mt-0.5">
                      {memo.tags.split(',').map((t: string) => `#${t.trim()}`).join(' ')}
                    </p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
        <div className="px-4 py-2 border-t border-teal-900/5 bg-teal-900/[0.02]">
          <p className="text-xs text-muted">
            <kbd className="px-1 py-0.5 bg-teal-900/5 border border-teal-900/10 rounded text-xs">↑↓</kbd> 导航
            <kbd className="px-1 py-0.5 bg-teal-900/5 border border-teal-900/10 rounded text-xs ml-2">Enter</kbd> 选择
            <kbd className="px-1 py-0.5 bg-teal-900/5 border border-teal-900/10 rounded text-xs ml-2">Esc</kbd> 关闭
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default WikiLinkSuggestion;