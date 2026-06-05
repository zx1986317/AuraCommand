import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Zap, Image as ImageIcon, Hash, Link2, X, FileText, Users, BookOpen, Briefcase, Lightbulb, Pin, ArrowUpDown, Filter, Settings, CheckSquare, Square, Edit3, Tag } from 'lucide-react';
import { logger } from '../utils/logger';

const memoTemplates = [
  { id: 'blank', name: '空白便签', icon: FileText, title: '', content: '', category: '收件箱', tags: [] },
  { id: 'meeting', name: '会议记录', icon: Users, title: '会议记录', content: '## 会议信息\n- 日期：\n- 参会人：\n- 主题：\n\n## 讨论要点\n1. \n2. \n3. \n\n## 决议与行动项\n- [ ] \n- [ ] \n\n## 下次会议\n- 时间：\n- 议题：', category: '会议', tags: ['会议'] },
  { id: 'reading', name: '读书笔记', icon: BookOpen, title: '读书笔记', content: '## 书籍信息\n- 书名：\n- 作者：\n- 读完日期：\n\n## 核心观点\n1. \n2. \n3. \n\n## 精彩摘录\n> \n\n## 我的思考\n', category: '学习', tags: ['读书'] },
  { id: 'project', name: '项目日志', icon: Briefcase, title: '项目日志', content: '## 项目名称\n\n## 今日进展\n- \n\n## 遇到的问题\n- \n\n## 明日计划\n- [ ] \n\n## 相关链接\n- ', category: '项目', tags: ['项目'] },
  { id: 'idea', name: '灵感闪念', icon: Lightbulb, title: '灵感记录', content: '## 灵感描述\n\n## 触发场景\n\n## 可能的应用\n1. \n2. \n\n## 相关资料\n- [[', category: '灵感', tags: ['灵感'] },
];

interface MemosPanelProps {
  memos: any[];
  searchQuery: string;
  isAIProcessing: boolean;
  highlightedMemoIds?: string[];
  sampleProjectName?: string;
  onCreateMemo: (template?: any) => void;
  onEditMemo: (memo: any) => void;
  onDeleteMemo: (id: string) => void;
  onClipboardOCR: () => void;
  onTogglePin: (id: string) => void;
}

const renderWikilinks = (text: string, onLinkClick: (title: string) => void) => {
  const parts = text.split(/(\[\[.*?\]\])/g);
  return parts.map((part, i) => {
    const match = part.match(/^\[\[(.*?)\]\]$/);
    if (match) {
      return (
        <span key={i} onClick={(e) => { e.stopPropagation(); onLinkClick(match[1]!); }}
          className="text-accent underline decoration-accent/30 underline-offset-2 cursor-pointer hover:bg-accent/10 px-0.5 rounded transition-colors">
          {match[1]}
        </span>
      );
    }
    return part;
  });
};

const MemosPanel: React.FC<MemosPanelProps> = ({
  memos, searchQuery, highlightedMemoIds = [], sampleProjectName, onCreateMemo, onEditMemo, onDeleteMemo, onClipboardOCR, onTogglePin
}) => {
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [tagFilteredMemos, setTagFilteredMemos] = useState<any[] | null>(null);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<'updated' | 'created' | 'title'>('updated');
  const [showTagManager, setShowTagManager] = useState(false);
  const [editingTagName, setEditingTagName] = useState<string | null>(null);
  const [newTagNameInput, setNewTagNameInput] = useState('');
  const [batchSelectMode, setBatchSelectMode] = useState(false);
  const [selectedMemoIds, setSelectedMemoIds] = useState<Set<string>>(new Set());
  const highlightedMemoIdSet = new Set(highlightedMemoIds);

  const allCategories = Array.from(new Set(memos.map(m => m.category || '收件箱').filter(Boolean))).sort();

  const tagUsageCount: Record<string, number> = {};
  memos.forEach(m => {
    if (m.tags && Array.isArray(m.tags)) {
      m.tags.forEach((t: string) => { tagUsageCount[t] = (tagUsageCount[t] || 0) + 1; });
    }
  });

  useEffect(() => {
    const tagSet = new Set<string>();
    memos.forEach(m => {
      if (m.tags && Array.isArray(m.tags)) {
        m.tags.forEach((t: string) => tagSet.add(t));
      }
    });
    const nextTags = Array.from(tagSet).sort();
    setAllTags(prev =>
      prev.length === nextTags.length && prev.every((tag, index) => tag === nextTags[index])
        ? prev
        : nextTags
    );
  }, [memos]);

  const handleTagClick = async (tag: string) => {
    if (activeTag === tag) {
      setActiveTag(null);
      setTagFilteredMemos(null);
      return;
    }
    setActiveTag(tag);
    try {
      const results = await window.ipcRenderer.invoke('search-memos-by-tag', { tag });
      setTagFilteredMemos(results);
    } catch (err) {
      logger.error('Failed to search by tag:', err);
      setActiveTag(null);
      setTagFilteredMemos(null);
    }
  };

  const handleWikilinkClick = (title: string) => {
    const found = memos.find(m => m.title === title);
    if (found) {
      onEditMemo(found);
    }
  };

  const handleDeleteTag = async (tagName: string) => {
    if (!window.confirm(`确定删除标签 "${tagName}"？该标签将从所有便签中移除。`)) return;
    try {
      const result = await window.ipcRenderer.invoke('delete-tag', tagName);
      if (result?.success) {
        setAllTags(allTags.filter(t => t !== tagName));
        if (activeTag === tagName) { setActiveTag(null); setTagFilteredMemos(null); }
        window.alert(`已从 ${result.affectedCount} 个便签中移除标签 "${tagName}"`);
      }
    } catch (err) { logger.error('Failed to delete tag:', err); }
  };

  const handleRenameTag = async (oldName: string) => {
    const newName = newTagNameInput.trim();
    if (!newName || newName === oldName) { setEditingTagName(null); setNewTagNameInput(''); return; }
    try {
      const result = await window.ipcRenderer.invoke('rename-tag', { oldName, newName });
      if (result?.success) {
        setAllTags(allTags.map(t => t === oldName ? newName : t));
        if (activeTag === oldName) setActiveTag(newName);
        setEditingTagName(null); setNewTagNameInput('');
      }
    } catch (err) { logger.error('Failed to rename tag:', err); }
  };

  const handleBatchDelete = async () => {
    if (selectedMemoIds.size === 0) return;
    if (!window.confirm(`确定删除选中的 ${selectedMemoIds.size} 个便签？此操作不可恢复。`)) return;
    try {
      const result = await window.ipcRenderer.invoke('batch-delete-memos', Array.from(selectedMemoIds));
      if (result?.success) {
        setSelectedMemoIds(new Set());
        setBatchSelectMode(false);
      }
    } catch (err) { logger.error('Failed to batch delete:', err); }
  };

  const toggleMemoSelection = (id: string) => {
    const newSet = new Set(selectedMemoIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedMemoIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedMemoIds.size === sortedMemos.length) setSelectedMemoIds(new Set());
    else setSelectedMemoIds(new Set(sortedMemos.map(m => m.id)));
  };

  const displayedMemos = tagFilteredMemos || memos;
  const categoryFiltered = activeCategory
    ? displayedMemos.filter(m => (m.category || '收件箱') === activeCategory)
    : displayedMemos;
  const filteredMemos = searchQuery
    ? categoryFiltered.filter(m =>
        m.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.tags && m.tags.some((t: string) => t.toLowerCase().includes(searchQuery.toLowerCase())))
      )
    : categoryFiltered;
  const sortedMemos = [...filteredMemos].sort((a, b) => {
    const aHighlighted = highlightedMemoIdSet.has(a.id);
    const bHighlighted = highlightedMemoIdSet.has(b.id);
    if (aHighlighted && !bHighlighted) return -1;
    if (!aHighlighted && bHighlighted) return 1;
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    if (sortMode === 'title') return (a.title || '').localeCompare(b.title || '');
    if (sortMode === 'created') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  return (
    <motion.div
      key="memos"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      className="max-w-5xl mx-auto w-full"
    >
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-5xl font-display font-bold tracking-tight mb-2">智能便签</h2>
          <p className="text-muted text-sm font-medium">记录灵感，AI 助力提炼。使用 <span className="text-accent font-bold">[[便签名]]</span> 创建双向链接</p>
        </div>
        <div className="flex gap-3 relative">
          <div className="relative">
            <button
              onClick={() => setShowTemplatePicker(!showTemplatePicker)}
              className="relative group px-8 py-3 bg-accent text-white text-sm font-bold rounded-2xl hover:bg-accent/90 transition-all active:scale-95 shadow-glass overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
              <span className="relative flex items-center gap-2">
                <Plus size={18} />
                新建记录
              </span>
            </button>
            <AnimatePresence>
              {showTemplatePicker && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="absolute top-full left-0 mt-2 w-64 bg-white border border-teal-900/10 rounded-2xl shadow-xl p-3 z-50"
                >
                  <p className="text-2xs font-bold text-muted uppercase tracking-wider mb-2 px-2">选择模板</p>
                  {memoTemplates.map(tpl => (
                    <button
                      key={tpl.id}
                      onClick={() => { setShowTemplatePicker(false); onCreateMemo(tpl); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-accent/5 transition-all text-left group/tpl"
                    >
                      <div className="p-2 rounded-xl bg-accent/5 group-hover/tpl:bg-accent/10 transition-colors">
                        <tpl.icon size={14} className="text-accent" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground">{tpl.name}</p>
                        {tpl.id !== 'blank' && <p className="text-xs text-muted">{tpl.category} · {tpl.tags.join(', ')}</p>}
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button
            onClick={onClipboardOCR}
            className="relative group px-6 py-3 bg-white border border-teal-900/10 text-foreground text-sm font-bold rounded-2xl hover:bg-teal-900/5 transition-all active:scale-95"
          >
            <span className="relative flex items-center gap-2">
              <ImageIcon size={18} />
              贴图识别
            </span>
          </button>
        </div>
      </div>

      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4 items-center">
          <button
            onClick={() => { setActiveTag(null); setTagFilteredMemos(null); }}
            className={`px-3 py-1.5 rounded-xl text-2xs font-bold transition-all ${!activeTag ? 'bg-accent text-white' : 'bg-accent/5 text-accent hover:bg-accent/10'}`}
          >
            全部
          </button>
          {allTags.slice(0, 10).map(tag => (
            <button
              key={tag}
              onClick={() => handleTagClick(tag)}
              className={`px-3 py-1.5 rounded-xl text-2xs font-bold transition-all flex items-center gap-1 ${activeTag === tag ? 'bg-accent text-white' : 'bg-accent/5 text-accent hover:bg-accent/10'}`}
            >
              <Hash size={10} />{tag}<span className="text-xs opacity-60">{tagUsageCount[tag]}</span>
            </button>
          ))}
          {allTags.length > 10 && <span className="text-2xs text-muted px-2">+{allTags.length - 10}</span>}
          {activeTag && (
            <button onClick={() => { setActiveTag(null); setTagFilteredMemos(null); }} className="p-1.5 rounded-lg hover:bg-red-50 text-muted hover:text-red-500 transition-all">
              <X size={12} />
            </button>
          )}
          <button
            onClick={() => setShowTagManager(!showTagManager)}
            className={`ml-2 p-1.5 rounded-lg transition-all ${showTagManager ? 'bg-accent text-white' : 'bg-teal-900/5 text-muted hover:bg-teal-900/10 hover:text-foreground'}`}
            title="管理标签"
          >
            <Settings size={14} />
          </button>
        </div>
      )}

      <AnimatePresence>
        {showTagManager && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 overflow-hidden"
          >
            <div className="bg-white/60 border border-teal-900/10 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Tag size={16} className="text-accent" />
                  <span className="text-xs font-bold text-foreground">标签管理</span>
                </div>
                <button onClick={() => setShowTagManager(false)} className="p-1 rounded-lg hover:bg-teal-900/5 text-muted">
                  <X size={14} />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {allTags.map(tag => (
                  <div key={tag} className="flex items-center gap-1 bg-teal-900/5 rounded-lg px-2 py-1 group">
                    {editingTagName === tag ? (
                      <input
                        autoFocus
                        value={newTagNameInput}
                        onChange={e => setNewTagNameInput(e.target.value)}
                        onBlur={() => handleRenameTag(tag)}
                        onKeyDown={e => { if (e.key === 'Enter') handleRenameTag(tag); if (e.key === 'Escape') { setEditingTagName(null); setNewTagNameInput(''); } }}
                        className="w-20 px-1 py-0.5 text-2xs font-bold bg-white border border-accent/30 rounded focus:outline-none focus:border-accent"
                      />
                    ) : (
                      <span className="text-2xs font-bold text-foreground">{tag}</span>
                    )}
                    <span className="text-xs text-muted">{tagUsageCount[tag]}</span>
                    <button
                      onClick={() => { setEditingTagName(tag); setNewTagNameInput(tag); }}
                      className="p-0.5 rounded hover:bg-accent/10 text-muted hover:text-accent opacity-0 group-hover:opacity-100 transition-all"
                      title="重命名"
                    >
                      <Edit3 size={10} />
                    </button>
                    <button
                      onClick={() => handleDeleteTag(tag)}
                      className="p-0.5 rounded hover:bg-red-50 text-muted hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                      title="删除"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                ))}
              </div>
              {allTags.length === 0 && <p className="text-xs text-muted text-center py-4">暂无标签</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-muted" />
          {allCategories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
              className={`px-3 py-1.5 rounded-xl text-2xs font-bold transition-all ${activeCategory === cat ? 'bg-accent text-white' : 'bg-teal-900/5 text-muted hover:bg-teal-900/10 hover:text-foreground'}`}
            >
              {cat}
            </button>
          ))}
          {activeCategory && (
            <button onClick={() => setActiveCategory(null)} className="p-1 rounded-lg hover:bg-red-50 text-muted hover:text-red-500 transition-all">
              <X size={12} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ArrowUpDown size={14} className="text-muted" />
          {([
            { id: 'updated' as const, label: '最近更新' },
            { id: 'created' as const, label: '创建时间' },
            { id: 'title' as const, label: '标题排序' },
          ]).map(s => (
            <button
              key={s.id}
              onClick={() => setSortMode(s.id)}
              className={`px-3 py-1.5 rounded-xl text-2xs font-bold transition-all ${sortMode === s.id ? 'bg-accent text-white' : 'bg-teal-900/5 text-muted hover:bg-teal-900/10 hover:text-foreground'}`}
            >
              {s.label}
            </button>
          ))}
          <div className="w-px h-4 bg-teal-900/10 mx-2"></div>
          <button
            onClick={() => { setBatchSelectMode(!batchSelectMode); if (batchSelectMode) setSelectedMemoIds(new Set()); }}
            className={`px-3 py-1.5 rounded-xl text-2xs font-bold transition-all flex items-center gap-1 ${batchSelectMode ? 'bg-red-500 text-white' : 'bg-teal-900/5 text-muted hover:bg-teal-900/10 hover:text-foreground'}`}
          >
            {batchSelectMode ? <X size={12} /> : <CheckSquare size={12} />}
            {batchSelectMode ? '取消' : '批量'}
          </button>
          {batchSelectMode && selectedMemoIds.size > 0 && (
            <button
              onClick={handleBatchDelete}
              className="px-3 py-1.5 rounded-xl text-2xs font-bold bg-red-500 text-white hover:bg-red-600 transition-all flex items-center gap-1"
            >
              <Trash2 size={12} />删除 ({selectedMemoIds.size})
            </button>
          )}
        </div>
      </div>

      <div>
      {highlightedMemoIds.length > 0 && (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-[1.75rem] border border-accent/15 bg-accent/5 px-5 py-4">
          <div>
            <p className="text-sm font-bold text-foreground">已为你高亮本次导入的示例便签</p>
            <p className="mt-1 text-2xs leading-relaxed text-muted">这些内容可直接用来体验双向链接、便签沉淀和 AI 问答。</p>
          </div>
          <span className="shrink-0 rounded-full bg-white px-3 py-1 text-2xs font-bold text-accent">{highlightedMemoIds.length} 条示例</span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-8">
        {sortedMemos.map((memo: any, idx: number) => {
          const isHighlighted = highlightedMemoIdSet.has(memo.id);
          const isSampleProject = sampleProjectName ? memo.project === sampleProjectName : false;
          return (
          <motion.div
            key={memo.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            onClick={() => { if (!batchSelectMode) onEditMemo(memo); }}
            className={`group p-8 rounded-[2rem] transition-all cursor-pointer shadow-glass relative overflow-hidden ${
              isHighlighted
                ? 'bg-accent/5 border border-accent/30 hover:bg-accent/10'
                : 'bg-white/40 border border-teal-900/5 hover:border-accent/30 hover:bg-white/60'
            } ${selectedMemoIds.has(memo.id) ? 'ring-2 ring-red-500' : ''}`}
          >
            {batchSelectMode && (
              <button
                onClick={(e) => { e.stopPropagation(); toggleMemoSelection(memo.id); }}
                className="absolute top-4 left-4 z-10 p-1 rounded-lg bg-white/80 hover:bg-white transition-all"
              >
                {selectedMemoIds.has(memo.id) ? <CheckSquare size={18} className="text-red-500" /> : <Square size={18} className="text-muted" />}
              </button>
            )}
            <div className="absolute top-0 left-0 w-1 h-full bg-accent scale-y-0 group-hover:scale-y-100 transition-transform origin-top duration-300"></div>
            {memo.pinned && (
              <div className="absolute top-4 left-4 text-accent/60">
                <Pin size={12} className="fill-accent/30" />
              </div>
            )}
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="px-3 py-1 bg-accent/5 rounded-full">
                  <span className="text-2xs font-bold text-accent uppercase tracking-wider">{memo.category || '收件箱'}</span>
                </div>
                {(isHighlighted || isSampleProject) && (
                  <div className={`px-3 py-1 rounded-full ${
                    isHighlighted ? 'bg-accent text-white' : 'bg-white border border-accent/15'
                  }`}>
                    <span className={`text-2xs font-bold uppercase tracking-wider ${
                      isHighlighted ? 'text-white' : 'text-accent'
                    }`}>示例工作区</span>
                  </div>
                )}
                {memo.tags && Array.isArray(memo.tags) && memo.tags.map((tag: string, i: number) => (
                  <span key={i} className="px-2 py-0.5 bg-teal-900/5 rounded-md text-xs font-bold text-muted flex items-center gap-0.5">
                    <Hash size={8} />{tag}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={(e) => { e.stopPropagation(); onTogglePin(memo.id); }}
                  className={`p-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100 ${memo.pinned ? 'text-accent bg-accent/10' : 'text-muted hover:text-accent hover:bg-accent/10'}`}
                  title={memo.pinned ? '取消置顶' : '置顶'}
                >
                  <Pin size={14} className={memo.pinned ? 'fill-accent/30' : ''} />
                </button>
                <span className="text-2xs font-mono text-muted font-bold">{new Date(memo.updated_at).toLocaleDateString()}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteMemo(memo.id); }}
                  className="p-1.5 rounded-lg text-muted hover:text-red-500 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <h3 className="text-xl font-bold mb-4 group-hover:text-accent transition-colors leading-tight text-foreground flex items-center gap-2">
              {memo.title || '无标题'}
              {memo.content && /\[\[.*?\]\]/.test(memo.content) && (
                <Link2 size={14} className="text-accent/50" />
              )}
              {memo.images && Array.isArray(memo.images) && memo.images.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-accent/10 text-accent text-2xs font-bold">
                  <ImageIcon size={10} />
                  {memo.images.length}
                </span>
              )}
            </h3>
            <p className="text-sm text-muted line-clamp-3 font-medium leading-relaxed group-hover:text-foreground transition-colors">
              {memo.content ? renderWikilinks(memo.content.substring(0, 200), handleWikilinkClick) : '暂无内容...'}
            </p>

            <div className="mt-8 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="flex gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-teal-900/10"></div>
                <div className="w-1.5 h-1.5 rounded-full bg-teal-900/10"></div>
                <div className="w-1.5 h-1.5 rounded-full bg-teal-900/10"></div>
              </div>
              <div className="text-2xs font-bold text-accent uppercase tracking-widest flex items-center gap-1">
                打开编辑器 <Zap size={10} className="fill-accent" />
              </div>
            </div>
          </motion.div>
          );
        })}
      </div>

      {sortedMemos.length === 0 && (
        <div className="text-center py-20">
          <p className="text-muted text-sm font-bold">{activeTag ? `没有标签为 "${activeTag}" 的便签` : '暂无便签'}</p>
        </div>
      )}
      </div>
    </motion.div>
  );
};

export default MemosPanel;
