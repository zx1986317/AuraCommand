import React from 'react';
import { X } from 'lucide-react';
import TemplateSelector from '../../components/TemplateSelector';
import AddClipModal from '../../components/AddClipModal';
import ClipPreviewModal from '../../components/ClipPreviewModal';
import VersionHistoryModal from '../../components/VersionHistoryModal';
import type { Note } from '../../hooks/useNotes';
import type { MemoTemplate } from '../../data/memoTemplates';

export interface DeskModalsProps {
  isTemplateSelectorOpen: boolean;
  setIsTemplateSelectorOpen: (v: boolean) => void;
  templateSelectorTarget: 'note' | 'document';
  handleTemplateSelect: (template: MemoTemplate) => void;
  recentNoteTitles: string[];
  recentDocumentTitles: string[];
  onAiAsk: ((question: string) => Promise<string>) | undefined;
  showAddClipModal: boolean;
  setShowAddClipModal: (v: boolean) => void;
  loadClips: () => void;
  loadClipGroups: () => void;
  previewClip: any | null;
  setPreviewClip: (clip: any | null) => void;
  showCreateGroupModal: boolean;
  setShowCreateGroupModal: (v: boolean) => void;
  newGroupName: string;
  setNewGroupName: (v: string) => void;
  showGroupSelector: boolean;
  setShowGroupSelector: (v: boolean) => void;
  clipGroups: any[];
  selectedClipIds: Set<string>;
  setSelectedClipIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setClipSelectionMode: (v: boolean) => void;
  isVersionHistoryOpen: boolean;
  setIsVersionHistoryOpen: (v: boolean) => void;
  selectedNote: Note | null;
  selectedDocument: Note | null;
  editorContent: string;
  editorTitle: string;
  setSelectedNote: React.Dispatch<React.SetStateAction<Note | null>>;
  setSelectedDocument: React.Dispatch<React.SetStateAction<Note | null>>;
  setExportNotification: (n: { message: string; type: 'success' | 'error' } | null) => void;
  exportNotification: { message: string; type: 'success' | 'error' } | null;
}

const DeskModals: React.FC<DeskModalsProps> = ({
  isTemplateSelectorOpen, setIsTemplateSelectorOpen,
  templateSelectorTarget, handleTemplateSelect,
  recentNoteTitles, recentDocumentTitles,
  onAiAsk,
  showAddClipModal, setShowAddClipModal,
  loadClips, loadClipGroups,
  previewClip, setPreviewClip,
  showCreateGroupModal, setShowCreateGroupModal,
  newGroupName, setNewGroupName,
  showGroupSelector, setShowGroupSelector,
  clipGroups,
  selectedClipIds, setSelectedClipIds,
  setClipSelectionMode,
  isVersionHistoryOpen, setIsVersionHistoryOpen,
  selectedNote, selectedDocument,
  editorContent, editorTitle,
  setSelectedNote, setSelectedDocument,
  setExportNotification,
  exportNotification,
}) => {
  return (
    <>
      <TemplateSelector
        isOpen={isTemplateSelectorOpen}
        contextType={templateSelectorTarget}
        onSelect={handleTemplateSelect}
        onClose={() => setIsTemplateSelectorOpen(false)}
        recentTitles={
          templateSelectorTarget === 'note' ? recentNoteTitles : recentDocumentTitles
        }
        aiGenerate={onAiAsk}
      />

      <AddClipModal
        isOpen={showAddClipModal}
        onClose={() => setShowAddClipModal(false)}
        onSaved={() => { loadClips(); loadClipGroups(); }}
      />


      {showCreateGroupModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowCreateGroupModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-80" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-gray-800 mb-4">创建截图组</h3>
            <input
              type="text"
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              placeholder="输入组名称..."
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-purple-300 mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCreateGroupModal(false)}
                className="px-4 py-2 text-xs text-gray-500 hover:bg-gray-50 rounded-lg"
              >
                取消
              </button>
              <button
                onClick={async () => {
                  if (!newGroupName.trim()) return;
                  await window.ipcRenderer.invoke('create-clip-group', { name: newGroupName.trim() });
                  setNewGroupName('');
                  setShowCreateGroupModal(false);
                  loadClipGroups();
                }}
                className="px-4 py-2 text-xs bg-purple-500 text-white rounded-lg hover:bg-purple-600"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {showGroupSelector && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowGroupSelector(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-80" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-gray-800 mb-4">选择截图组</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
              {clipGroups.map(group => (
                <button
                  key={group.id}
                  onClick={async () => {
                    await window.ipcRenderer.invoke('add-clips-to-group', {
                      groupId: group.id,
                      clipIds: Array.from(selectedClipIds)
                    });
                    setShowGroupSelector(false);
                    setSelectedClipIds(new Set());
                    setClipSelectionMode(false);
                    loadClipGroups();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg hover:bg-gray-50 text-left"
                >
                  <span className="text-gray-700">{group.name}</span>
                  <span className="text-2xs text-gray-400">{group.clip_count} 张</span>
                </button>
              ))}
              {clipGroups.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">暂无截图组，请先创建</p>
              )}
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setShowGroupSelector(false)}
                className="px-4 py-2 text-xs font-medium text-gray-500 hover:bg-gray-50 rounded-lg"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      <VersionHistoryModal
        isOpen={isVersionHistoryOpen}
        noteId={(selectedNote || selectedDocument)?.id || null}
        onClose={() => setIsVersionHistoryOpen(false)}
        onRestore={async (versionId) => {
          const currentNote = selectedNote || selectedDocument;
          if (!currentNote || !window.ipcRenderer) return;
          try {
            await window.ipcRenderer.invoke('restore-note-version', { noteId: currentNote.id, versionId });
            if (selectedNote) {
              const updated = { ...selectedNote, content: editorContent, title: editorTitle };
              setSelectedNote(updated);
            } else if (selectedDocument) {
              const updated = { ...selectedDocument, content: editorContent, title: editorTitle };
              setSelectedDocument(updated);
            }
            setExportNotification({ message: '版本已恢复', type: 'success' });
          } catch {
            setExportNotification({ message: '恢复版本失败', type: 'error' });
          }
        }}
      />

      {exportNotification && (
        <div className={`fixed top-12 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-xl shadow-lg border backdrop-blur-xl transition-all ${
          exportNotification.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium">{exportNotification.message}</span>
            <button onClick={() => setExportNotification(null)} className="p-0.5 hover:opacity-70">
              <X size={12} />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default DeskModals;