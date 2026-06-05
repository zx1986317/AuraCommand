import React, { useState, useMemo } from 'react';
import { BookOpen, FileText, StickyNote, Plus, Trash2, Clipboard, FolderOpen, List, LayoutGrid, Pin, Search, ChevronDown, ChevronRight, ArrowUpDown, Settings2, Pencil, X } from 'lucide-react';
import type { Note } from '../../hooks/useNotes';
import type { DocCategory } from '../../types';

export interface DeskSidebarProps {
  activeTab: 'documents' | 'notes' | 'clips';
  setActiveTab: (tab: 'documents' | 'notes' | 'clips') => void;
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
  projects: string[];
  selectedProject: string | null;
  setSelectedProject: (p: string | null) => void;
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
}

const stripHtml = (s: string) => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

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

const CompactNoteRow: React.FC<{
  note: Note;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}> = ({ note, isSelected, onSelect, onDelete }) => {
  const [hover, setHover] = useState(false);
  const summary = note.content ? stripHtml(note.content).slice(0, 60) : '';
  return (
    <div
      className="group/note relative"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        onClick={onSelect}
        className={`w-full text-left px-2.5 py-2 rounded-lg transition-all ${
          isSelected
            ? 'bg-amber-50 border border-amber-300'
            : 'hover:bg-gray-50 border border-transparent'
        }`}
      >
        <div className="flex items-center gap-1.5 mb-0.5">
          {note.pinned && <Pin size={10} className="text-amber-500 flex-shrink-0" />}
          <span className={`text-2xs font-medium truncate flex-1 ${isSelected ? 'text-amber-800' : 'text-gray-800'}`}>
            {note.title || '无标题'}
          </span>
        </div>
        {summary && <p className="text-xs text-gray-400 truncate">{summary}</p>}
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-xs text-gray-300">{new Date(note.created_at).toLocaleDateString('zh-CN')}</span>
          {note.tags && note.tags.length > 0 && (
            <div className="flex gap-0.5">
              {note.tags.slice(0, 2).map(tag => (
                <span key={tag} className="px-1 py-0.5 bg-amber-100/60 text-amber-600 text-2xs rounded-full">{tag}</span>
              ))}
            </div>
          )}
        </div>
      </button>
      {hover && (
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="absolute top-1.5 right-1.5 p-1 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all" title="删除便签">
          <Trash2 size={10} />
        </button>
      )}
    </div>
  );
};

const CompactDocRow: React.FC<{
  doc: Note;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  docCategories: DocCategory[];
}> = ({ doc, isSelected, onSelect, onDelete, docCategories }) => {
  const [hover, setHover] = useState(false);
  const summary = doc.content ? stripHtml(doc.content).slice(0, 60) : '';
  return (
    <div
      className="group/doc relative"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        onClick={onSelect}
        className={`w-full text-left px-2.5 py-2 rounded-lg transition-all ${
          isSelected ? 'bg-accent/10 border border-accent/20' : 'hover:bg-gray-50 border border-transparent'
        }`}
      >
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-2xs font-medium text-gray-800 truncate flex-1">{doc.title || '无标题'}</span>

        </div>
        {summary && <p className="text-xs text-gray-400 truncate">{summary}</p>}
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-xs text-gray-300">{new Date(doc.updated_at).toLocaleDateString('zh-CN')}</span>
          {doc.category && (() => {
            const cat = docCategories.find(c => c.id === doc.category);
            return cat ? <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} /> : null;
          })()}
        </div>
      </button>
      {hover && (
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="absolute top-1.5 right-1.5 p-1 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all" title="删除文档">
          <Trash2 size={10} />
        </button>
      )}
    </div>
  );
};

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
  allTagsMemo, filteredNotesMemo, filteredDocumentsMemo,
  projects, selectedProject, setSelectedProject,
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
}) => {
  const notes = quickNotes;
  const [viewMode, setViewMode] = useState<'list' | 'card'>('list');
  const [sortMode, setSortMode] = useState<SortMode>('time');
  const [listSearch, setListSearch] = useState('');
  const [showListSearch, setShowListSearch] = useState(false);


  const noteGrouped = useGroupedList(
    filteredNotesMemo, listSearch, sortMode,
    useMemo(() => (n: Note) => n.created_at, [])
  );
  const docGrouped = useGroupedList(
    filteredDocumentsMemo, listSearch, sortMode,
    useMemo(() => (d: Note) => d.updated_at, [])
  );

  const toolbarColor = activeTab === 'notes' ? 'amber' : 'accent';

  return (
    <div className="w-60 flex-shrink-0 flex flex-col bg-white/60 backdrop-blur-sm rounded-l-2xl border border-r-0 border-gray-100 shadow-sm overflow-hidden">
      <div className="px-3 pt-4 pb-3">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded-lg bg-accent shadow-sm">
            <BookOpen size={14} className="text-white" />
          </div>
          <span className="text-sm font-bold text-gray-800">书桌</span>
        </div>

        {projects.length > 0 && (
          <div className="mb-2">
            <select
              value={selectedProject || ''}
              onChange={(e) => { setSelectedProject(e.target.value || null); setSearchQuery(''); }}
              className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-accent/30"
            >
              <option value="">全部项目</option>
              {projects.map(p => (<option key={p} value={p}>{p}</option>))}
            </select>
          </div>
        )}

        <div className="space-y-0.5">
          <button
            onClick={() => { setActiveTab('documents'); setSearchQuery(''); setSelectedTag(null); setSelectedNote(null); setListSearch(''); }}
            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-all ${activeTab === 'documents' ? 'bg-accent/10 text-accent' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`}
          >
            <FileText size={13} />
            <span className="flex-1 text-left">文档</span>
            <span className="text-2xs opacity-50">{documents.length}</span>
          </button>
          <button
            onClick={() => { setActiveTab('notes'); setSearchQuery(''); setSelectedTag(null); setSelectedDocument(null); handleSelectCategory(null); setListSearch(''); }}
            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-all ${activeTab === 'notes' ? 'bg-amber-50 text-amber-700' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`}
          >
            <StickyNote size={13} />
            <span className="flex-1 text-left">便签</span>
            <span className="text-2xs opacity-50">{notes.length}</span>
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

      {(activeTab === 'documents' || activeTab === 'notes') && (
        <div className="px-3 pb-2">

          {activeTab === 'documents' && (
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
          )}

          {activeTab === 'notes' && allTagsMemo.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <button onClick={() => setSelectedTag(null)} className={`px-2 py-1 rounded text-2xs font-medium transition-all ${!selectedTag ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>全部</button>
              {allTagsMemo.map(tag => (
                <button key={tag} onClick={() => setSelectedTag(selectedTag === tag ? null : tag)} className={`px-2 py-1 rounded text-2xs font-medium transition-all ${selectedTag === tag ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{tag}</button>
              ))}
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
        {activeTab === 'notes' ? (
          <>
            <div className="flex items-center gap-1 mb-1 px-0.5">
              <button onClick={() => setShowListSearch(!showListSearch)} className={`p-1 rounded transition-colors ${showListSearch ? `text-${toolbarColor}-600 bg-${toolbarColor}-50` : 'text-gray-300 hover:text-gray-500'}`} title="搜索">
                <Search size={12} />
              </button>
              <button onClick={() => setSortMode(sortMode === 'time' ? 'title' : 'time')} className={`p-1 rounded transition-colors ${sortMode === 'title' ? `text-${toolbarColor}-600 bg-${toolbarColor}-50` : 'text-gray-300 hover:text-gray-500'}`} title={sortMode === 'time' ? '按时间排序' : '按标题排序'}>
                <ArrowUpDown size={12} />
              </button>
              <div className="flex-1" />
              <button onClick={() => setViewMode('list')} className={`p-1 rounded transition-colors ${viewMode === 'list' ? 'text-amber-600 bg-amber-50' : 'text-gray-300 hover:text-gray-500'}`} title="列表视图"><List size={12} /></button>
              <button onClick={() => setViewMode('card')} className={`p-1 rounded transition-colors ${viewMode === 'card' ? 'text-amber-600 bg-amber-50' : 'text-gray-300 hover:text-gray-500'}`} title="卡片视图"><LayoutGrid size={12} /></button>
            </div>
            {showListSearch && (
              <input
                autoFocus
                value={listSearch}
                onChange={e => setListSearch(e.target.value)}
                placeholder="搜索便签..."
                className="w-full px-2.5 py-1.5 mb-1 text-2xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-amber-300 focus:ring-1 focus:ring-amber-100"
              />
            )}
            {filteredNotesMemo.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-8 text-gray-300">
                <StickyNote size={24} className="mb-1.5" />
                <p className="text-2xs">暂无便签</p>
                <button onClick={handleCreateNewNote} className="mt-2 px-3 py-1.5 bg-amber-50 text-amber-600 text-2xs rounded-lg hover:bg-amber-100 transition-all">+ 新建便签</button>
              </div>
            ) : viewMode === 'list' ? (
              sortMode === 'time' && noteGrouped.groups ? (
                <GroupedListView
                  groups={noteGrouped.groups}
                  renderItem={(note) => (
                    <CompactNoteRow key={note.id} note={note} isSelected={selectedNote?.id === note.id} onSelect={() => handleSelectNote(note)} onDelete={() => handleDeleteNote(note.id)} />
                  )}
                />
              ) : (
                <div className="space-y-0.5">
                  {(noteGrouped.sorted || filteredNotesMemo).map(note => (
                    <CompactNoteRow key={note.id} note={note} isSelected={selectedNote?.id === note.id} onSelect={() => handleSelectNote(note)} onDelete={() => handleDeleteNote(note.id)} />
                  ))}
                </div>
              )
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {filteredNotesMemo.map(note => (
                  <div key={note.id} className="group/note relative">
                    <button onClick={() => handleSelectNote(note)} className={`w-full text-left px-3 py-3 rounded-xl transition-all ${selectedNote?.id === note.id ? 'bg-amber-100/80 border-2 border-amber-400 shadow-md' : 'bg-amber-50/80 border border-amber-200 hover:border-amber-300 hover:shadow-md hover:-rotate-1'}`}>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        {note.pinned && <span className="text-sm">📌</span>}
                        <span className={`text-xs font-bold truncate flex-1 ${selectedNote?.id === note.id ? 'text-amber-800' : 'text-amber-700'}`}>{note.title || '无标题'}</span>
                      </div>
                      {note.content && <p className="text-xs text-amber-600/70 line-clamp-2 mb-2 leading-relaxed">{stripHtml(note.content).slice(0, 120)}</p>}
                      <div className="flex items-center justify-between">
                        <span className="text-2xs text-amber-500/60">{new Date(note.created_at).toLocaleDateString('zh-CN')}</span>
                        {note.tags && note.tags.length > 0 && (
                          <div className="flex gap-0.5">{note.tags.slice(0, 2).map(tag => (<span key={tag} className="px-1.5 py-0.5 bg-amber-200/50 text-amber-600 text-2xs rounded-full">{tag}</span>))}</div>
                        )}
                      </div>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteNote(note.id); }} className="absolute top-2 right-2 p-1 rounded-md text-amber-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover/note:opacity-100 transition-all" title="删除便签"><Trash2 size={11} /></button>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : activeTab === 'documents' ? (
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
                placeholder="搜索文档..."
                className="w-full px-2.5 py-1.5 mb-1 text-2xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20"
              />
            )}
            {filteredDocumentsMemo.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-8 text-gray-300">
                <FileText size={24} className="mb-1.5" />
                <p className="text-2xs">暂无文档</p>
                <button onClick={handleCreateNewDocument} className="mt-2 px-3 py-1.5 bg-accent/10 text-accent text-2xs rounded-lg hover:bg-accent/20 transition-all">+ 新建文档</button>
              </div>
            ) : viewMode === 'list' ? (
              sortMode === 'time' && docGrouped.groups ? (
                <GroupedListView
                  groups={docGrouped.groups}
                  renderItem={(doc) => (
                    <CompactDocRow key={doc.id} doc={doc} isSelected={selectedDocument?.id === doc.id} onSelect={() => handleSelectDocument(doc)} onDelete={() => handleDeleteDocument(doc.id)} docCategories={docCategories} />
                  )}
                />
              ) : (
                <div className="space-y-0.5">
                  {(docGrouped.sorted || filteredDocumentsMemo).map(doc => (
                    <CompactDocRow key={doc.id} doc={doc} isSelected={selectedDocument?.id === doc.id} onSelect={() => handleSelectDocument(doc)} onDelete={() => handleDeleteDocument(doc.id)} docCategories={docCategories} />
                  ))}
                </div>
              )
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {filteredDocumentsMemo.map(doc => (
                  <div key={doc.id} className="group/doc relative">
                    <button onClick={() => handleSelectDocument(doc)} className={`w-full text-left px-3 py-3 rounded-xl transition-all ${selectedDocument?.id === doc.id ? 'bg-accent/10 border-2 border-accent/30 shadow-md' : 'bg-gray-50/80 border border-gray-200 hover:border-accent/20 hover:shadow-md'}`}>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className={`text-xs font-bold truncate flex-1 ${selectedDocument?.id === doc.id ? 'text-accent' : 'text-gray-700'}`}>{doc.title || '无标题'}</span>

                      </div>
                      {doc.content && <p className="text-xs text-gray-500 line-clamp-2 mb-2 leading-relaxed">{stripHtml(doc.content).slice(0, 120)}</p>}
                      <div className="flex items-center justify-between">
                        <span className="text-2xs text-gray-400">{new Date(doc.updated_at).toLocaleDateString('zh-CN')}</span>
                        {doc.category && (() => { const cat = docCategories.find(c => c.id === doc.category); return cat ? (<span className="flex items-center gap-1 text-2xs text-gray-400"><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color }} />{cat.name}</span>) : null; })()}
                      </div>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteDocument(doc.id); }} className="absolute top-2 right-2 p-1 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover/doc:opacity-100 transition-all" title="删除文档"><Trash2 size={11} /></button>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>

      <div className="px-2 pb-2 space-y-2">
        {activeTab !== 'clips' && (
          <button
            onClick={activeTab === 'notes' ? handleCreateNewNote : handleCreateNewDocument}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-white rounded-xl text-2xs font-medium hover:shadow-lg transition-all bg-accent hover:shadow-accent/20"
          >
            <Plus size={13} />
            {activeTab === 'notes' ? '新建便签' : '新建文档'}
          </button>
        )}
        {activeTab === 'notes' && quickNotes.length > 0 && (
          <button
            onClick={async () => {
              if (!window.ipcRenderer) return;
              if (!confirm('确定要清空所有便签吗？此操作不可撤销。')) return;
              try {
                const result = await window.ipcRenderer.invoke('clear-all-memos');
                if (result?.success) { loadNotes(); }
              } catch (err) {
                console.error('Failed to clear memos:', err);
              }
            }}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-500 rounded-lg text-2xs hover:bg-red-50 transition-all"
          >
            <Trash2 size={11} /> 清空所有便签
          </button>
        )}
      </div>
    </div>
  );
};

export default DeskSidebar;
