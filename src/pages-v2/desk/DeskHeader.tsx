import React from 'react';
import { Save, Wand2, Languages, Sparkles, Trash2, FolderKanban, History, Download, Database } from 'lucide-react';
import type { Note } from '../../hooks/useNotes';
import type { DocCategory } from '../../types';

export interface DeskHeaderProps {
  activeTab: 'documents' | 'notes' | 'clips';
  selectedNote: Note | null;
  selectedDocument: Note | null;
  editorTitle: string;
  editorContent: string;
  setEditorTitle: (t: string) => void;
  isDirty: boolean;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  aiActionLoading: string | null;
  onAiAsk: ((question: string) => Promise<string>) | undefined;
  handleInlineAiAction: (action: string) => void;
  handleSaveCurrentNote: () => void;
  handleSaveCurrentDocument: () => void;
  handleDeleteNote: (id: string) => void;
  handleDeleteDocument: (id: string) => void;
  handleTogglePin: (note: Note) => void;
  setIsVersionHistoryOpen: (v: boolean) => void;
  setExportNotification: (n: { message: string; type: 'success' | 'error' } | null) => void;
  docCategories: DocCategory[];
  catDropdownOpen: boolean;
  setCatDropdownOpen: (v: boolean) => void;
  catDropdownRef: React.RefObject<HTMLDivElement>;
  setSelectedDocument: React.Dispatch<React.SetStateAction<Note | null>>;
  setIsDirty: (v: boolean) => void;
  showProjectPickerFor: { type: string; id: string } | null;
  setShowProjectPickerFor: (v: { type: string; id: string } | null) => void;
  newProjectName: string;
  setNewProjectName: (v: string) => void;
  projects: string[];
  handleAssignProject: (itemType: string, itemId: string, projectName: string) => void;
}

const DeskHeader: React.FC<DeskHeaderProps> = ({
  activeTab,
  selectedNote, selectedDocument,
  editorTitle, editorContent, setEditorTitle,
  isDirty, saveStatus,
  aiActionLoading, onAiAsk,
  handleInlineAiAction,
  handleSaveCurrentNote, handleSaveCurrentDocument,
  handleDeleteNote, handleDeleteDocument,
  handleTogglePin,
  setIsVersionHistoryOpen, setExportNotification,
  docCategories, catDropdownOpen, setCatDropdownOpen, catDropdownRef,
  setSelectedDocument, setIsDirty,
  showProjectPickerFor, setShowProjectPickerFor,
  newProjectName, setNewProjectName,
  projects, handleAssignProject,
}) => {
  return (
    <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-3">
      <div className="flex-1 flex items-center gap-2">
        <input
          type="text"
          value={editorTitle}
          onChange={e => setEditorTitle(e.target.value)}
          placeholder="输入标题..."
          className="flex-1 text-sm font-semibold text-gray-900 bg-transparent outline-none placeholder-gray-300"
        />
        {isDirty && <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" title="有未保存的修改" />}
        {saveStatus === 'saved' && (
          <button
            onClick={() => setIsVersionHistoryOpen(true)}
            className="text-2xs text-emerald-500 font-medium shrink-0 flex items-center gap-1 hover:text-accent transition-colors"
            title="点击查看版本历史"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
            已保存
          </button>
        )}
        {saveStatus === 'saving' && (
          <span className="text-2xs text-gray-400 font-medium shrink-0 flex items-center gap-1">
            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            保存中
          </span>
        )}
        {saveStatus === 'error' && (
          <span className="text-2xs text-red-500 font-medium shrink-0">保存失败</span>
        )}
        {selectedDocument && (() => {
          const currentCatId = selectedDocument.category || docCategories[0]?.id || '';
          const currentCat = docCategories.find(c => c.id === currentCatId);
          return (
            <div ref={catDropdownRef} className="relative ml-1.5">
              <button
                type="button"
                onClick={() => setCatDropdownOpen(!catDropdownOpen)}
                className="flex items-center gap-1.5 text-2xs text-gray-500 hover:text-gray-700 bg-gray-50/80 hover:bg-gray-100/80 rounded-md px-2 py-0.5 transition-colors duration-150 cursor-pointer"
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: currentCat?.color ?? '#94a3b8' }} />
                <span>{currentCat?.name ?? '未分类'}</span>
                <svg className="w-3 h-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {catDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-36 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-50">
                  {docCategories.map(cat => {
                    const isSelected = cat.id === currentCatId;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          setSelectedDocument(prev => prev ? { ...prev, category: cat.id } : prev);
                          setIsDirty(true);
                          setCatDropdownOpen(false);
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 text-2xs transition-colors duration-100 cursor-pointer ${isSelected ? 'bg-gray-50 text-gray-900 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
                      >
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                        <span className="flex-1 text-left">{cat.name}</span>
                        {isSelected && (
                          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}
      </div>
      <div className="flex items-center gap-1">
        {onAiAsk && (
          <>
            <button
              onClick={() => handleInlineAiAction('continue')}
              disabled={!!aiActionLoading}
              className="flex items-center gap-1 px-2 py-1.5 text-2xs font-medium text-violet-600 bg-violet-50 rounded-lg hover:bg-violet-100 transition-all disabled:opacity-50"
              title="AI 续写"
            >
              {aiActionLoading === 'continue' ? <Sparkles size={11} className="animate-spin" /> : <Wand2 size={11} />}
              续写
            </button>
            <button
              onClick={() => handleInlineAiAction('polish')}
              disabled={!!aiActionLoading}
              className="flex items-center gap-1 px-2 py-1.5 text-2xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-all disabled:opacity-50"
              title="AI 润色"
            >
              {aiActionLoading === 'polish' ? <Sparkles size={11} className="animate-spin" /> : <Wand2 size={11} />}
              润色
            </button>
            <button
              onClick={() => handleInlineAiAction('translate')}
              disabled={!!aiActionLoading}
              className="flex items-center gap-1 px-2 py-1.5 text-2xs font-medium text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-all disabled:opacity-50"
              title="AI 翻译"
            >
              {aiActionLoading === 'translate' ? <Sparkles size={11} className="animate-spin" /> : <Languages size={11} />}
              翻译
            </button>
          </>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        {selectedNote && (
          <>
            <button onClick={() => handleTogglePin(selectedNote)} className={`p-1.5 rounded-lg transition-all ${selectedNote.pinned ? 'text-amber-500 bg-amber-50' : 'text-gray-300 hover:text-amber-400 hover:bg-amber-50'}`}>📌</button>
            <button onClick={handleSaveCurrentNote} className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 text-amber-600 rounded-lg text-2xs font-medium hover:bg-amber-100 transition-all"><Save size={11} /> 保存</button>
            <div className="relative">
              <button onClick={() => setShowProjectPickerFor(showProjectPickerFor ? null : { type: 'note', id: selectedNote.id })} className="p-1.5 text-gray-300 hover:text-accent hover:bg-accent/5 rounded-lg transition-all" title="归入项目"><FolderKanban size={13} /></button>
              {showProjectPickerFor && showProjectPickerFor.type === 'note' && showProjectPickerFor.id === selectedNote.id && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-50">
                  {projects.map(p => (
                    <button key={p} onClick={() => handleAssignProject('note', selectedNote.id, p)} className="w-full px-3 py-1.5 text-xs text-gray-700 hover:bg-accent/5 text-left">{p}</button>
                  ))}
                  <div className="border-t border-gray-100 mt-1 pt-1 px-2">
                    <input value={newProjectName} onChange={e => setNewProjectName(e.target.value)} placeholder="新建项目..." className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-accent/30" onKeyDown={e => { if (e.key === 'Enter' && newProjectName.trim()) handleAssignProject('note', selectedNote.id, newProjectName.trim()) }} />
                  </div>
                </div>
              )}
            </div>
            <button onClick={() => handleDeleteNote(selectedNote.id)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" title="删除便签"><Trash2 size={13} /></button>
          </>
        )}
        {selectedDocument && (
          <>
            <button onClick={handleSaveCurrentDocument} className="flex items-center gap-1 px-2.5 py-1.5 bg-accent/10 text-accent rounded-lg text-2xs font-medium hover:bg-accent/20 transition-all"><Save size={11} /> 保存</button>
            <button
              onClick={async () => {
                if (!selectedDocument || !window.ipcRenderer) return;
                const title = editorTitle || selectedDocument.title || '未命名文档';
                const content = editorContent || selectedDocument.content || '';
                if (!content.trim()) { setExportNotification({ message: '文档内容为空，无法导入', type: 'error' }); return; }
                try {
                  const result = await window.ipcRenderer.invoke('store-text-as-file', { title: title + '.md', content });
                  if (result?.success) {
                    setExportNotification({ message: '已导入知识库', type: 'success' });
                  } else {
                    setExportNotification({ message: '导入知识库失败', type: 'error' });
                  }
                } catch {
                  setExportNotification({ message: '导入知识库失败', type: 'error' });
                }
              }}
              className="p-1.5 text-gray-300 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-all"
              title="导入知识库"
            >
              <Database size={13} />
            </button>
            <div className="relative">
              <button onClick={() => setShowProjectPickerFor(showProjectPickerFor ? null : { type: 'note', id: selectedDocument.id })} className="p-1.5 text-gray-300 hover:text-accent hover:bg-accent/5 rounded-lg transition-all" title="归入项目"><FolderKanban size={13} /></button>
              {showProjectPickerFor && showProjectPickerFor.type === 'note' && showProjectPickerFor.id === selectedDocument.id && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-50">
                  {projects.map(p => (
                    <button key={p} onClick={() => handleAssignProject('note', selectedDocument.id, p)} className="w-full px-3 py-1.5 text-xs text-gray-700 hover:bg-accent/5 text-left">{p}</button>
                  ))}
                  <div className="border-t border-gray-100 mt-1 pt-1 px-2">
                    <input value={newProjectName} onChange={e => setNewProjectName(e.target.value)} placeholder="新建项目..." className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-accent/30" onKeyDown={e => { if (e.key === 'Enter' && newProjectName.trim()) handleAssignProject('note', selectedDocument.id, newProjectName.trim()) }} />
                  </div>
                </div>
              )}
            </div>
            <button onClick={() => handleDeleteDocument(selectedDocument.id)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" title="删除文档"><Trash2 size={13} /></button>
          </>
        )}
        {(selectedNote || selectedDocument) && (
          <>
            <button
              onClick={() => setIsVersionHistoryOpen(true)}
              className="p-1.5 text-gray-300 hover:text-accent hover:bg-accent/5 rounded-lg transition-all"
              title="版本历史"
            >
              <History size={13} />
            </button>
            <button
              onClick={async () => {
                const currentNote = selectedNote || selectedDocument;
                if (!currentNote || !window.ipcRenderer) return;
                try {
                  const result = await window.ipcRenderer.invoke('export-document-to-docx', { noteId: currentNote.id });
                  if (result?.success) {
                    setExportNotification({ message: '文档已成功导出为 DOCX', type: 'success' });
                  } else {
                    setExportNotification({ message: result?.error || '导出失败', type: 'error' });
                  }
                } catch (err) {
                  setExportNotification({ message: '导出失败', type: 'error' });
                }
              }}
              className="p-1.5 text-gray-300 hover:text-accent hover:bg-accent/5 rounded-lg transition-all"
              title="导出为 DOCX"
            >
              <Download size={13} />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default DeskHeader;