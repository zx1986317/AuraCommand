import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, X, Hash, Zap, BrainCircuit, FileSearch, FileText, Database
} from 'lucide-react';
import type { KBSearchMode, KBSearchResult } from '../../types';

function highlightSnippet(text: string): React.ReactNode {
  if (!text) return text;
  const parts = text.split(/⟨([^⟩]*)⟩/);
  return parts.map((part, i) =>
    i % 2 === 1
      ? <mark key={i} className="bg-accent/20 text-accent font-bold rounded px-0.5">{part}</mark>
      : <span key={i}>{part}</span>
  );
}

interface KBSearchPanelProps {
  kbSearchQuery: string;
  kbSearchMode: KBSearchMode;
  kbSearchResults: KBSearchResult[];
  isKbSearching: boolean;
  onKbSearch: (query: string, mode?: KBSearchMode) => void;
  onSetKbSearchQuery: (q: string) => void;
  onSetKbSearchMode: (m: KBSearchMode) => void;
  onSetKbSearchResults: (r: KBSearchResult[]) => void;
  showSearchPanel: boolean;
  onToggleSearchPanel: (show: boolean) => void;
}

const KBSearchPanel: React.FC<KBSearchPanelProps> = ({
  kbSearchQuery, kbSearchMode, kbSearchResults, isKbSearching,
  onKbSearch, onSetKbSearchQuery, onSetKbSearchMode, onSetKbSearchResults,
  showSearchPanel, onToggleSearchPanel,
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showSearchPanel) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [showSearchPanel]);

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && kbSearchQuery.trim()) {
      onKbSearch(kbSearchQuery);
    }
    if (e.key === 'Escape') {
      onSetKbSearchQuery('');
      onSetKbSearchResults([]);
      onToggleSearchPanel(false);
    }
  };

  return (
    <>
      {/* Collapsible search input area (rendered inside header) */}
      <AnimatePresence>
        {showSearchPanel && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden mb-4"
          >
            <div className="flex gap-2 mb-3">
              <div className="flex-1 relative">
                <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={kbSearchQuery}
                  onChange={(e) => onSetKbSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="搜索知识库内容... (Enter 执行)"
                  className="w-full pl-10 pr-4 py-3 bg-white/80 border border-teal-900/10 rounded-2xl text-sm outline-none focus:border-accent/40 transition-all placeholder:text-muted/40"
                />
                {kbSearchQuery && (
                  <button
                    onClick={() => { onSetKbSearchQuery(''); onSetKbSearchResults([]); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <div className="flex rounded-2xl border border-teal-900/10 overflow-hidden">
                {([
                  { key: 'keyword' as const, label: '关键词', icon: <Hash size={12} /> },
                  { key: 'hybrid' as const, label: '混合', icon: <Zap size={12} /> },
                  { key: 'semantic' as const, label: '语义', icon: <BrainCircuit size={12} /> },
                ]).map(m => (
                  <button
                    key={m.key}
                    onClick={() => onSetKbSearchMode(m.key)}
                    className={`px-3 py-3 text-xs font-bold flex items-center gap-1 transition-colors ${
                      kbSearchMode === m.key ? 'bg-accent text-white' : 'bg-white/60 text-muted hover:text-foreground'
                    }`}
                  >
                    {m.icon}{m.label}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search results (rendered outside header) */}
      {showSearchPanel && kbSearchQuery && kbSearchResults.length > 0 && (
        <div className="mb-6 bg-white/80 border border-accent/20 rounded-3xl shadow-glass p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileSearch size={16} className="text-accent" />
              <h3 className="text-sm font-black uppercase tracking-[0.15em] text-muted">搜索结果</h3>
              <span className="text-2xs px-2 py-0.5 rounded-full bg-accent/10 text-accent font-bold">
                {kbSearchResults.length} 条
              </span>
              <span className="text-2xs px-2 py-0.5 rounded-full bg-white/60 text-muted font-bold border border-teal-900/10">
                {kbSearchMode === 'keyword' ? '关键词搜索' : kbSearchMode === 'semantic' ? '语义搜索' : '混合搜索'}
              </span>
            </div>
            <button
              onClick={() => { onSetKbSearchQuery(''); onSetKbSearchResults([]); }}
              className="p-2 rounded-lg hover:bg-red-500/10 text-muted hover:text-red-500 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
          <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar">
            {kbSearchResults.map((result, idx) => (
              <div key={result.id || idx} className="p-4 rounded-2xl bg-white/90 border border-teal-900/5 hover:border-accent/20 transition-all">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {result.type === 'memo' ? (
                      <FileText size={14} className="text-amber-500 flex-shrink-0" />
                    ) : result.type === 'file_chunk' ? (
                      <FileSearch size={14} className="text-teal-500 flex-shrink-0" />
                    ) : (
                      <Database size={14} className="text-accent flex-shrink-0" />
                    )}
                    <span className="text-sm font-bold truncate">
                      {result.title || result.file_name || '未知'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-black ${
                      result.type === 'memo' ? 'bg-amber-500/10 text-amber-600' :
                      result.type === 'file_chunk' ? 'bg-teal-500/10 text-teal-600' :
                      'bg-accent/10 text-accent'
                    }`}>
                      {result.type === 'memo' ? '便签' : result.type === 'file_chunk' ? '文档片段' : '文件'}
                    </span>
                    {result.source && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/60 text-muted border border-teal-900/10">
                        {result.source === 'semantic' ? '语义' : result.source === 'hybrid' ? '混合' : '关键词'}
                      </span>
                    )}
                  </div>
                </div>
                {result.snippet && (
                  <p className="text-xs text-muted leading-relaxed mb-1">
                    {highlightSnippet(result.snippet)}
                  </p>
                )}
                {!result.snippet && (result.content || result.text) && (
                  <p className="text-xs text-muted leading-relaxed mb-1 line-clamp-3">
                    {(result.content || result.text || '').substring(0, 200)}
                  </p>
                )}
                {(result.file_name || result.category) && (
                  <div className="flex items-center gap-2 text-2xs text-muted mt-1">
                    {result.file_name && <span>📄 {result.file_name}</span>}
                    {result.category && <span>📂 {result.category}</span>}
                    {result.file_type && <span>{String(result.file_type).replace('.', '').toUpperCase()}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {showSearchPanel && kbSearchQuery && !isKbSearching && kbSearchResults.length === 0 && (
        <div className="mb-6 bg-white/60 border border-dashed border-teal-900/10 rounded-3xl p-8 flex flex-col items-center justify-center text-muted">
          <FileSearch size={20} className="mb-2" />
          <p className="text-xs font-bold">未找到相关内容</p>
          <p className="text-2xs mt-1">试试切换搜索模式或调整关键词</p>
        </div>
      )}

      {/* Searching state */}
      {showSearchPanel && isKbSearching && (
        <div className="mb-6 bg-white/60 border border-dashed border-accent/20 rounded-3xl p-8 flex flex-col items-center justify-center text-accent">
          <BrainCircuit size={20} className="mb-2 animate-pulse" />
          <p className="text-xs font-bold">正在搜索中...</p>
        </div>
      )}
    </>
  );
};

export default KBSearchPanel;