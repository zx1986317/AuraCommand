import React, { useState, useMemo, useRef, useEffect } from 'react';
import { BookOpen, FileText, StickyNote, Plus, Trash2, Clipboard, FolderOpen, List, LayoutGrid, Pin, Search, ChevronDown, ChevronRight, ArrowUpDown, Settings2, Pencil, X } from 'lucide-react';
import type { Note } from '../../hooks/useNotes';
import type { DocCategory } from '../../types';
import { VirtualList } from '../../components/common/VirtualList';
import { EmptyState } from '../../components/common/EmptyState';

export interface DeskSidebarProps {
  activeTab: 'content' | 'clips';
  setActiveTab: (tab: 'content' | 'clips') => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedTag: string | null;
  setSelectedTag: (tag: string | null) => void;
  selectedNote: Note | null;
  selectedDocument: Note | null;
  documents: Note[];
  quickNotes: Note[];
  clips: any[];
  allTagsMemo: string[];
  filteredNotesMemo: Note[];
  filteredDocumentsMemo: Note[];
  docCategories: DocCategory[];
  selectedCategory: string | null;
  handleSelectCategory: (id: string | null) => void;
  categoryDocCounts: Map<string, number>;
  editingCategoryId: string | null;
  setEditingCategoryId: (id: string | null) => void;
  editingCategoryName: string;
  setEditingCategoryName: (name: string) => void;
  newCategoryName: string;
  setNewCategoryName: (name: string) => void;
  handleCreateDocCategory: (name: string, color: string) => void;
  handleUpdateDocCategory: (id: string, name: string, color: string) => void;
  handleDeleteDocCategory: (id: string) => void;
  handleSelectNote: (note: Note) => void;
  handleSelectDocument: (doc: Note) => void;
  handleDeleteNote: (id: string) => void;
  handleDeleteDocument: (id: string) => void;
  handleCreateNewNote: () => void;
  handleCreateNewDocument: () => void;
  setShowAddClipModal: (v: boolean) => void;
  loadNotes: () => void;
  setSelectedNote: React.Dispatch<React.SetStateAction<Note | null>>;
  setSelectedDocument: React.Dispatch<React.SetStateAction<Note | null>>;
  clipGroups: any[];
  selectedClipGroupId: string | null;
  setSelectedClipGroupId: (id: string | null) => void;
  setShowCreateGroupModal: (v: boolean) => void;
  loadClipGroups: () => void;
  onOpenTagManager?: () => void;
}

const stripHtml = (s: string) => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

function getProjectColor(name: string | undefined | null): string {
  if (!name) return '#6b7280';
  const colors: string[] = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16','#f97316','#14b8a6','#6366f1','#d946ef','#0ea5e9','#22c55e','#eab308'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) { hash = ((hash << 5) - hash) + name.charCodeAt(i); hash = hash & hash; }
  return colors[Math.abs(hash) % colors.length]!;
}

function getTimeGroup(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = today.getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.floor(diff / 86400000);
  if (days <= 0) return '今天';
  if (days === 1) return '昨天';
  if (days < 7) return '近7天';
  if (days < 30) return '近30天';
  if (d.getFullYear() === now.getFullYear()) return `${d.getMonth() + 1}月`;
  return `${d.getFullYear()}年${d.getMonth() + 1}月`;
}

const TIME_GROUP_ORDER = ['今天', '昨天', '近7天', '近30天'];

function sortTimeGroups(a: string, b: string): number {
  const ai = TIME_GROUP_ORDER.indexOf(a);
  const bi = TIME_GROUP_ORDER.indexOf(b);
  if (ai !== -1 && bi !== -1) return ai - bi;
  if (ai !== -1) return -1;
  if (bi !== -1) return 1;
  return b.localeCompare(a, 'zh-CN');
}

type SortMode = 'time' | 'title';

function useGroupedList<T extends Note>(items: T[], listSearch: string, sortMode: SortMode, getDate: (item: T) => string) {
  return useMemo(() => {
    let filtered = items;
    if (listSearch) {
      const q = listSearch.toLowerCase();
      filtered = items.filter(item => {
        const title = (item.title || '').toLowerCase();
        const content = stripHtml(item.content || '').toLowerCase();
        return title.includes(q) || content.includes(q);
      });
    }
    if (sortMode === 'title') {
      filtered = [...filtered].sort((a, b) => (a.title || '').localeCompare(b.title || '', 'zh-CN'));
      return { groups: null, sorted: filtered };
    }
    const grouped = new Map<string, T[]>();
    for (const item of filtered) {
      const group = getTimeGroup(getDate(item));
      if (!grouped.has(group)) grouped.set(group, []);
      grouped.get(group)!.push(item);
    }
    const sortedKeys = Array.from(grouped.keys()).sort(sortTimeGroups);
    return { groups: sortedKeys.map(k => ({ key: k, items: grouped.get(k)! })), sorted: null as T[] | null };
  }, [items, listSearch, sortMode, getDate]);
}


const GroupedListView: React.FC<{
  groups: { key: string; items: Note[] }[];
  renderItem: (item: Note) => React.ReactNode;
}> = ({ groups, renderItem }) => {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  return (
    <div className="space-y-1">
      {groups.map(g => (
        <div key={g.key}>
          <button
            onClick={() => setCollapsedGroups(prev => {
              const next = new Set(prev);
              if (next.has(g.key)) next.delete(g.key);
              else next.add(g.key);
              return next;
            })}
            className="w-full flex items-center gap-1.5 px-2 py-1 text-2xs font-semibold text-gray-400 hover:text-gray-600 transition-colors"
          >
            {collapsedGroups.has(g.key) ? <ChevronRight size={10} /> : <ChevronDown size={10} />}
            <span className="flex-1 text-left">{g.key}</span>
            <span className="opacity-50">{g.items.length}</span>
          </button>
          {!collapsedGroups.has(g.key) && (
            <div className="space-y-0.5 pl-1">
              {g.items.map(item => renderItem(item))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

const DeskSidebar: React.FC<DeskSidebarProps> = ({
  activeTab, setActiveTab,
  searchQuery, setSearchQuery,
  selectedTag, setSelectedTag,
  selectedNote, selectedDocument,
  documents, quickNotes, clips,
  allTagsMemo, filteredNotesMemo,   filteredDocumentsMemo,
  docCategories, selectedCategory, handleSelectCategory, categoryDocCounts,
  editingCategoryId, setEditingCategoryId,
  editingCategoryName, setEditingCategoryName,
  newCategoryName, setNewCategoryName,
  handleCreateDocCategory, handleUpdateDocCategory, handleDeleteDocCategory,
  handleSelectNote, handleSelectDocument,
  handleDeleteNote, handleDeleteDocument,
  handleCreateNewNote, handleCreateNewDocument,
  setShowAddClipModal,
  loadNotes,
  setSelectedNote, setSelectedDocument,
  clipGroups, selectedClipGroupId, setSelectedClipGroupId,
  setShowCreateGroupModal, loadClipGroups,
  onOpenTagManager,
}) => {
  const notes = quickNotes;
  const [viewMode, setViewMode] = useState<'list' | 'card'>('list');
  const [sortMode, setSortMode] = useState<SortMode>('time');
  const [listSearch, setListSearch] = useState('');
  const [showListSearch, setShowListSearch] = useState(false);
  const [showNewDropdown, setShowNewDropdown] = useState(false);
  const newDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (newDropdownRef.current && !newDropdownRef.current.contains(e.target as Node)) setShowNewDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const mergedItems = useMemo(() => {
    const items: (Note & { _itemType: 'note' | 'document' })[] = [
      ...filteredNotesMemo.map(n => ({ ...n, _itemType: 'note' as const })),
      ...filteredDocumentsMemo.map(d => ({ ...d, _itemType: 'document' as const })),
    ];
    if (sortMode === 'title') {
      return items.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'zh-CN'));
    }
    return items.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }, [filteredNotesMemo, filteredDocumentsMemo, sortMode]);

  const mergedGrouped = useGroupedList(
    mergedItems, listSearch, sortMode,
    useMemo(() => (item: Note & { _itemType: string }) => item.updated_at, [])
  );

  return (
    <div className="w-60 flex-shrink-0 flex flex-col bg-white/60 backdrop-blur-sm rounded-l-2xl border border-r-0 border-gray-100 shadow-sm overflow-hidden">
      <div className="px-3 pt-4 pb-3">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded-lg bg-accent shadow-sm">
            <BookOpen size={14} className="text-white" />
          </div>
          <span className="text-sm font-bold text-gray-800">书桌</span>
        </div>

        <div className="space-y-0.5">
          <button
            onClick={() => { setActiveTab('content'); setSearchQuery(''); setSelectedTag(null); setSelectedNote(null); setSelectedDocument(null); handleSelectCategory(null); setListSearch(''); }}
            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-all ${activeTab === 'content' ? 'bg-accent/10 text-accent' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`}
          >
            <FileText size={13} />
            <span className="flex-1 text-left">内容</span>
            <span className="text-2xs opacity-50">{notes.length + documents.length}</span>
          </button>
          <button
            onClick={() => { setActiveTab('clips'); setSearchQuery(''); setSelectedNote(null); setSelectedDocument(null); }}
            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-all ${activeTab === 'clips' ? 'bg-purple-50 text-purple-700' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`}
          >
            <Clipboard size={13} />
            <span className="flex-1 text-left">剪贴板</span>
            <span className="text-2xs opacity-50">{clips.length}</span>
          </button>
        </div>
      </div>

      {activeTab === 'content' && (
        <div className="px-3 pb-2">
          <div className="pb-1">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-2xs font-semibold text-gray-400 uppercase tracking-wider">分类</span>
              {selectedCategory && (() => {
                const cat = docCategories.find(c => c.id === selectedCategory);
                return cat ? (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-2xs font-medium text-white" style={{ backgroundColor: cat.color }}>
                    {cat.name}
                    <X size={8} className="opacity-60 hover:opacity-100 cursor-pointer" onClick={() => handleSelectCategory(null)} />
                  </span>
                ) : null;
              })()}
            </div>

            {editingCategoryId === '__new__' ? (
              <div className="flex items-center gap-1.5 px-1 py-0.5">
                <span className="w-2 h-2 rounded-full bg-accent/40 flex-shrink-0" />
                <input
                  autoFocus
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newCategoryName.trim()) {
                      handleCreateDocCategory(newCategoryName.trim(), '#2dd4bf');
                      setEditingCategoryId(null);
                    } else if (e.key === 'Escape') { setEditingCategoryId(null); }
                  }}
                  placeholder="输入分类名称..."
                  className="flex-1 min-w-0 text-2xs bg-gray-50 border border-accent/30 rounded px-2 py-0.5 outline-none focus:border-accent/60"
                />
                <button onClick={() => { if (newCategoryName.trim()) { handleCreateDocCategory(newCategoryName.trim(), '#2dd4bf'); } setEditingCategoryId(null); }} className="p-0.5 text-accent hover:bg-accent/10 rounded" title="确认"><Plus size={10} /></button>
                <button onClick={() => setEditingCategoryId(null)} className="p-0.5 text-gray-400 hover:bg-gray-100 rounded" title="取消"><X size={10} /></button>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-1">
              {docCategories.map(cat => {
                const count = categoryDocCounts.get(cat.id) || 0;
                if (editingCategoryId === cat.id) {
                  return (
                      <div key={cat.id} className="flex items-center gap-1 px-1.5 py-0.5 rounded-full" style={{ backgroundColor: cat.color + '15' }}>
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                        <input
                          autoFocus
                          value={editingCategoryName}
                          onChange={e => setEditingCategoryName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && editingCategoryName.trim()) {
                              handleUpdateDocCategory(cat.id, editingCategoryName.trim(), cat.color);
                              setEditingCategoryId(null);
                            } else if (e.key === 'Escape') { setEditingCategoryId(null); }
                          }}
                          className="min-w-[40px] max-w-[80px] text-2xs bg-transparent outline-none"
                          style={{ color: cat.color }}
                        />
                        <button onClick={() => { if (editingCategoryName.trim()) { handleUpdateDocCategory(cat.id, editingCategoryName.trim(), cat.color); } setEditingCategoryId(null); }} className="p-0.5 rounded hover:bg-white/50" title="确认" style={{ color: cat.color }}><Plus size={8} /></button>
                        <button onClick={() => setEditingCategoryId(null)} className="p-0.5 rounded hover:bg-white/50 text-gray-400" title="取消"><X size={8} /></button>
                      </div>
                    );
                  }
                  return (
                    <div key={cat.id} className="group/cat relative">
                      <button
                        onClick={() => handleSelectCategory(selectedCategory === cat.id ? null : cat.id)}
                        className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-2xs font-medium transition-all ${selectedCategory === cat.id ? 'ring-1 ring-offset-1' : 'hover:opacity-80'}`}
                        style={{
                          backgroundColor: selectedCategory === cat.id ? cat.color : cat.color + '20',
                          color: selectedCategory === cat.id ? '#fff' : cat.color,
                          ...{ '--tw-ring-color': cat.color } as React.CSSProperties,
                        }}
                        title={`${cat.name} (${count})`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: selectedCategory === cat.id ? '#fff' : cat.color }} />
                        <span className="truncate max-w-[60px]">{cat.name}</span>
                        <span className="opacity-50">{count}</span>
                      </button>
                      <div className="absolute -top-1 -right-1 flex items-center gap-0 opacity-0 group-hover/cat:opacity-100 transition-opacity z-10">
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingCategoryId(cat.id); setEditingCategoryName(cat.name); }}
                          className="p-0.5 rounded-full bg-white shadow-sm border border-gray-200 text-gray-400 hover:text-accent hover:border-accent/30"
                          title="编辑"
                        >
                          <Pencil size={8} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteDocCategory(cat.id); }}
                          className="p-0.5 rounded-full bg-white shadow-sm border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200"
                          title="删除"
                        >
                          <Trash2 size={8} />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {editingCategoryId !== '__new__' && (
                  <button
                    onClick={() => { setNewCategoryName(''); setEditingCategoryId('__new__'); }}
                    className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-2xs text-gray-300 hover:text-accent hover:bg-accent/5 transition-all border border-dashed border-gray-200 hover:border-accent/30"
                    title="新建分类"
                  >
                    <Plus size={9} />
                    新建
                  </button>
                )}
              </div>
            </div>

          {allTagsMemo.length > 0 && (
            <div className="mt-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-2xs font-semibold text-gray-400 uppercase tracking-wider">标签</span>
                <button
                  onClick={() => onOpenTagManager?.()}
                  className="text-2xs text-gray-400 hover:text-accent transition-colors"
                  title="管理标签"
                >管理</button>
              </div>
              <div className="flex flex-wrap gap-1">
                <button onClick={() => setSelectedTag(null)} className={`px-2 py-1 rounded text-2xs font-medium transition-all ${!selectedTag ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>全部</button>
                {allTagsMemo.map(tag => (
                  <button key={tag} onClick={() => setSelectedTag(selectedTag === tag ? null : tag)} className={`px-2 py-1 rounded text-2xs font-medium transition-all ${selectedTag === tag ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{tag}</button>
                ))}
            </div>
          </div>
        )}
        </div>
      )}

      {activeTab === 'clips' && (
        <div className="px-3 pb-2">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-2xs font-semibold text-gray-400 uppercase tracking-wider">截图组</span>
            <button onClick={() => setShowCreateGroupModal(true)} className="p-0.5 text-gray-300 hover:text-purple-500 transition-colors"><Plus size={12} /></button>
          </div>
          <div className="space-y-0.5">
            <button onClick={() => setSelectedClipGroupId(null)} className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-all ${!selectedClipGroupId ? 'bg-purple-50 text-purple-700 font-medium' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`}>
              <Clipboard size={13} />
              <span className="flex-1 text-left">全部截图</span>
              <span className="text-2xs opacity-50">{clips.length}</span>
            </button>
            {clipGroups.map(group => (
              <div key={group.id} className="group/grp flex items-center">
                <button onClick={() => setSelectedClipGroupId(selectedClipGroupId === group.id ? null : group.id)} className={`flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-all ${selectedClipGroupId === group.id ? 'bg-purple-50 text-purple-700 font-medium' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`}>
                  <FolderOpen size={13} />
                  <span className="truncate">{group.name}</span>
                  <span className="text-2xs opacity-50 ml-auto">{group.clip_count}</span>
                </button>
                <button onClick={async (e) => { e.stopPropagation(); if (!confirm(`确定删除组"${group.name}"吗？组内截图不会删除。`)) return; await window.ipcRenderer.invoke('delete-clip-group', group.id); loadClipGroups(); if (selectedClipGroupId === group.id) setSelectedClipGroupId(null); }} className="p-1 rounded opacity-0 group-hover/grp:opacity-100 hover:bg-red-50 text-red-400">
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-2 pb-2 custom-scrollbar">
        {activeTab === 'content' && (
          <>
            <div className="flex items-center gap-1 mb-1 px-0.5">
              <button onClick={() => setShowListSearch(!showListSearch)} className={`p-1 rounded transition-colors ${showListSearch ? 'text-accent bg-accent/10' : 'text-gray-300 hover:text-gray-500'}`} title="搜索">
                <Search size={12} />
              </button>
              <button onClick={() => setSortMode(sortMode === 'time' ? 'title' : 'time')} className={`p-1 rounded transition-colors ${sortMode === 'title' ? 'text-accent bg-accent/10' : 'text-gray-300 hover:text-gray-500'}`} title={sortMode === 'time' ? '按时间排序' : '按标题排序'}>
                <ArrowUpDown size={12} />
              </button>
              <div className="flex-1" />
              <button onClick={() => setViewMode('list')} className={`p-1 rounded transition-colors ${viewMode === 'list' ? 'text-accent bg-accent/10' : 'text-gray-300 hover:text-gray-500'}`} title="列表视图"><List size={12} /></button>
              <button onClick={() => setViewMode('card')} className={`p-1 rounded transition-colors ${viewMode === 'card' ? 'text-accent bg-accent/10' : 'text-gray-300 hover:text-gray-500'}`} title="卡片视图"><LayoutGrid size={12} /></button>
            </div>
            {showListSearch && (
              <input
                autoFocus
                value={listSearch}
                onChange={e => setListSearch(e.target.value)}
                placeholder="搜索内容..."
                className="w-full px-2.5 py-1.5 mb-1 text-2xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20"
              />
            )}
            {mergedItems.length === 0 ? (
              listSearch ? (
                <EmptyState
                  compact
                  icon={<Search size={20} />}
                  title="未找到匹配内容"
                  description={`没有匹配 "${listSearch}" 的便签或文档`}
                />
              ) : (
                <EmptyState
                  compact
                  icon={<FileText size={20} />}
                  title="暂无内容"
                  description="创建便签或文档开始记录"
                  action={
                    <div className="flex gap-2">
                      <button
                        onClick={handleCreateNewNote}
                        className="px-3 py-1.5 bg-amber-50 text-amber-600 text-2xs rounded-lg hover:bg-amber-100 transition-all"
                      >
                        + 新建便签
                      </button>
                      <button
                        onClick={handleCreateNewDocument}
                        className="px-3 py-1.5 bg-accent/10 text-accent text-2xs rounded-lg hover:bg-accent/20 transition-all"
                      >
                        + 新建文档
                      </button>
                    </div>
                  }
                />
              )
            ) : viewMode === 'list' ? (
              sortMode === 'time' && mergedGrouped.groups ? (
                <GroupedListView
                  groups={mergedGrouped.groups}
                  renderItem={(item) => {
                    const ext = item as Note & { _itemType: string };
                    return (
                    <div key={item.id} className="group/item">
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => { ext._itemType === 'note' ? handleSelectNote(item) : handleSelectDocument(item); }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { ext._itemType === 'note' ? handleSelectNote(item) : handleSelectDocument(item); } }}
                        className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-all cursor-pointer ${(ext._itemType === 'note' ? selectedNote?.id : selectedDocument?.id) === item.id ? 'bg-accent/5 text-accent' : 'text-gray-600 hover:bg-gray-50'}`}
                      >
                        <span className={`px-1 py-0.5 rounded text-2xs font-medium ${ext._itemType === 'note' ? 'bg-amber-100 text-amber-700' : 'bg-accent/10 text-accent'}`}>
                          {ext._itemType === 'note' ? '便签' : '文档'}
                        </span>
                        <span className="flex-1 truncate text-left">{item.title || '无标题'}</span>
                        {item.pinned && <Pin size={10} className="text-amber-400 flex-shrink-0" />}
                        <button
                          onClick={(e) => { e.stopPropagation(); ext._itemType === 'note' ? handleDeleteNote(item.id) : handleDeleteDocument(item.id); }}
                          className="p-0.5 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover/item:opacity-100 transition-all flex-shrink-0"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    </div>
                    );
                  }}
                />
              ) : (
                mergedItems.length > 80 ? (
                  <VirtualList<(Note & { _itemType: 'note' | 'document' })>
                    items={mergedGrouped.sorted || mergedItems}
                    itemHeight={36}
                    height="100%"
                    renderItem={(item) => {
                      const isNote = item._itemType === 'note';
                      const isSelected = isNote ? selectedNote?.id === item.id : selectedDocument?.id === item.id;
                      return (
                        <div className="group/item h-full">
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => { isNote ? handleSelectNote(item) : handleSelectDocument(item); }}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { isNote ? handleSelectNote(item) : handleSelectDocument(item); } }}
                            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${isSelected ? 'bg-accent/5 text-accent' : 'text-gray-600 hover:bg-gray-50'}`}
                          >
                            <span className={`px-1 py-0.5 rounded text-2xs font-medium ${isNote ? 'bg-amber-100 text-amber-700' : 'bg-accent/10 text-accent'}`}>
                              {isNote ? '便签' : '文档'}
                            </span>
                            <span className="flex-1 truncate text-left">{item.title || '无标题'}</span>
                            {item.pinned && <Pin size={10} className="text-amber-400 flex-shrink-0" />}
                            <button
                              onClick={(e) => { e.stopPropagation(); isNote ? handleDeleteNote(item.id) : handleDeleteDocument(item.id); }}
                              className="p-0.5 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover/item:opacity-100 transition-all flex-shrink-0"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        </div>
                      );
                    }}
                  />
                ) : (
                <div className="space-y-0.5">
                  {(mergedGrouped.sorted || mergedItems).map((item: any) => (
                    <div key={item.id} className="group/item">
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => { item._itemType === 'note' ? handleSelectNote(item) : handleSelectDocument(item); }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { item._itemType === 'note' ? handleSelectNote(item) : handleSelectDocument(item); } }}
                        className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-all cursor-pointer ${(item._itemType === 'note' ? selectedNote?.id : selectedDocument?.id) === item.id ? 'bg-accent/5 text-accent' : 'text-gray-600 hover:bg-gray-50'}`}
                      >
                        <span className={`px-1 py-0.5 rounded text-2xs font-medium ${item._itemType === 'note' ? 'bg-amber-100 text-amber-700' : 'bg-accent/10 text-accent'}`}>
                          {item._itemType === 'note' ? '便签' : '文档'}
                        </span>
                        <span className="flex-1 truncate text-left">{item.title || '无标题'}</span>
                        {item.pinned && <Pin size={10} className="text-amber-400 flex-shrink-0" />}
                        <button
                          onClick={(e) => { e.stopPropagation(); item._itemType === 'note' ? handleDeleteNote(item.id) : handleDeleteDocument(item.id); }}
                          className="p-0.5 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover/item:opacity-100 transition-all flex-shrink-0"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                )
              )
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {mergedItems.map(item => {
                  const isNote = item._itemType === 'note';
                  const isSelected = isNote ? selectedNote?.id === item.id : selectedDocument?.id === item.id;
                  return (
                    <div key={item.id} className={`group/${isNote ? 'note' : 'doc'} relative`}>
                      <button
                        onClick={() => isNote ? handleSelectNote(item) : handleSelectDocument(item)}
                        className={`w-full text-left px-3 py-3 rounded-xl transition-all ${isSelected
                          ? 'bg-accent/10 border-2 border-accent/30 shadow-md'
                          : isNote
                            ? 'bg-amber-50/80 border border-amber-200 hover:border-amber-300 hover:shadow-md'
                            : 'bg-gray-50/80 border border-gray-200 hover:border-accent/20 hover:shadow-md'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className={`px-1.5 py-0.5 rounded text-2xs font-medium ${isNote ? 'bg-amber-100 text-amber-700' : 'bg-accent/10 text-accent'}`}>
                            {isNote ? '便签' : '文档'}
                          </span>
                          {item.pinned && <Pin size={10} className="text-amber-400" />}
                          <span className={`text-xs font-bold truncate flex-1 ${isSelected ? 'text-accent' : isNote ? 'text-amber-700' : 'text-gray-700'}`}>{item.title || '无标题'}</span>
                        </div>
                        {item.content && <p className="text-xs text-gray-500 line-clamp-2 mb-2 leading-relaxed">{stripHtml(item.content).slice(0, 120)}</p>}
                        <div className="flex items-center justify-between">
                          <span className="text-2xs text-gray-400">{new Date(item.updated_at).toLocaleDateString('zh-CN')}</span>
                          <div className="flex items-center gap-1">
                            {item.project && <span className="px-1.5 py-0.5 rounded text-2xs font-medium text-white" style={{ backgroundColor: getProjectColor(item.project) }}>{item.project}</span>}
                            {isNote && item.tags && item.tags.length > 0 && (
                              <div className="flex gap-0.5">{item.tags.slice(0, 2).map((tag: string) => (<span key={tag} className="px-1.5 py-0.5 bg-amber-200/50 text-amber-600 text-2xs rounded-full">{tag}</span>))}</div>
                            )}
                            {!isNote && item.category && (() => { const cat = docCategories.find(c => c.id === item.category); return cat ? (<span className="flex items-center gap-1 text-2xs text-gray-400"><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color }} />{cat.name}</span>) : null; })()}
                          </div>
                        </div>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); isNote ? handleDeleteNote(item.id) : handleDeleteDocument(item.id); }}
                        className="absolute top-2 right-2 p-1 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                        title={isNote ? '删除便签' : '删除文档'}
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <div className="px-2 pb-2 relative" ref={newDropdownRef}>
        {activeTab !== 'clips' && (
          <>
            <button
              onClick={() => setShowNewDropdown(!showNewDropdown)}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-white rounded-xl text-2xs font-medium hover:shadow-lg transition-all bg-accent hover:shadow-accent/20"
            >
              <Plus size={13} />
              新建
            </button>
            {showNewDropdown && (
              <div className="absolute bottom-full left-2 right-2 mb-1 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-20">
                <button onClick={() => { setShowNewDropdown(false); handleCreateNewNote(); }} className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-gray-600 hover:bg-amber-50 hover:text-amber-700 transition-all">
                  <StickyNote size={13} />
                  新建便签
                </button>
                <button onClick={() => { setShowNewDropdown(false); handleCreateNewDocument(); }} className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-gray-600 hover:bg-accent/5 hover:text-accent transition-all border-t border-gray-50">
                  <FileText size={13} />
                  新建文档
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default DeskSidebar;
