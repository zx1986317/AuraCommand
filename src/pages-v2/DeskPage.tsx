import React from 'react';
import { motion } from 'framer-motion';
import type { MemoTemplate } from '../data/memoTemplates';
import { useNotes, type Note } from '../hooks/useNotes';
import { useTasks } from '../hooks/useTasks';
import { useAppStore } from '../store/appStore';
import { useDeskProjects } from '../hooks/useDeskProjects';
import { useDeskCategories } from '../hooks/useDeskCategories';
import { useDeskEditor } from '../hooks/useDeskEditor';
import { useDeskClips } from '../hooks/useDeskClips';
import DeskSidebar from './desk/DeskSidebar';
import DeskSearchBar from './desk/DeskSearchBar';
import DeskHeader from './desk/DeskHeader';
import DeskContent, { DeskEmptyState } from './desk/DeskContent';
import DeskClipsPanel from './desk/DeskClipsPanel';
import DeskClipList from './desk/DeskClipList';
import DeskModals from './desk/DeskModals';
import TagManager from '../components/TagManager';

interface DeskPageProps {
  documents?: Note[];
  notes?: Note[];
  defaultTab?: 'content';
  aiChatReady?: boolean;
  selectedModel?: string;
  onAiAsk?: ((question: string) => Promise<string>) | undefined;
  onSaveAsTask?: ((content: string) => void) | undefined;
  onCreateTask?: ((title: string) => void) | undefined;
}

const DeskPage: React.FC<DeskPageProps> = ({
  aiChatReady = false, selectedModel = '',
  onAiAsk,
  onSaveAsTask, onCreateTask,
  defaultTab = 'content',
}) => {
  const projects = useDeskProjects();
  const {
    notesByType, searchQuery, setSearchQuery, loadNotes,
    saveNote, saveDocument, deleteNote, deleteDocument, createNote,
  } = useNotes();
  const sourceNoteToOpen = useAppStore(s => s.sourceNoteToOpen);
  const setSourceNoteToOpen = useAppStore(s => s.setSourceNoteToOpen);
  const { getTasksBySourceId, updateTaskStatus, deleteTask } = useTasks();

  const quickNotes = notesByType.quick_notes;
  const documents = notesByType.documents;

  const categories = useDeskCategories(documents);
  const editor = useDeskEditor(saveNote, saveDocument, onAiAsk);

  const [activeTab, setActiveTab] = React.useState<'content' | 'clips'>(defaultTab);
  const [selectedTag, setSelectedTag] = React.useState<string | null>(null);
  const [selectedNote, setSelectedNote] = React.useState<Note | null>(null);
  const [selectedDocument, setSelectedDocument] = React.useState<Note | null>(null);
  const [isTemplateSelectorOpen, setIsTemplateSelectorOpen] = React.useState(false);
  const [templateSelectorTarget, setTemplateSelectorTarget] = React.useState<'note' | 'document'>('note');
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = React.useState(false);
  const [exportNotification, setExportNotification] = React.useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isTagManagerOpen, setIsTagManagerOpen] = React.useState(false);
  const [aiSuggestedTags, setAiSuggestedTags] = React.useState<Record<string, { tags: string[]; category?: string }>>({});

  const clips = useDeskClips(activeTab, projects.projectItemIds.clip || []);

  // --- Selection handlers ---
  const handleSelectNote = React.useCallback((note: Note) => {
    editor.flushCurrentNote();
    setSelectedNote(note);
    setSelectedDocument(null);
    editor.setCurrentItem({ id: note.id, type: 'note', title: note.title, content: note.content, pinned: note.pinned ?? false, tags: note.tags });
  }, [editor.flushCurrentNote, editor.setCurrentItem]);

  const handleSelectDocument = React.useCallback((doc: Note) => {
    editor.flushCurrentNote();
    setSelectedDocument(doc);
    setSelectedNote(null);
    editor.setCurrentItem({ id: doc.id, type: 'document', title: doc.title, content: doc.content, category: doc.category ?? 'uncategorized', tags: doc.tags });
  }, [editor.flushCurrentNote, editor.setCurrentItem]);

  const handleCreateBlankNote = React.useCallback(() => {
    const newNote = createNote('quick_note');
    setSelectedNote(newNote);
    setSelectedDocument(null);
    editor.setCurrentItem({ id: newNote.id, type: 'note', title: newNote.title, content: newNote.content, pinned: false, tags: newNote.tags });
  }, [createNote, editor.setCurrentItem]);

  const handleCreateBlankDocument = React.useCallback(() => {
    const newDoc = createNote('document');
    const cat = categories.selectedCategory || 'uncategorized';
    setSelectedDocument({ ...newDoc, category: cat });
    setSelectedNote(null);
    editor.setCurrentItem({ id: newDoc.id, type: 'document', title: newDoc.title, content: newDoc.content, category: cat, tags: newDoc.tags });
  }, [createNote, categories.selectedCategory, editor.setCurrentItem]);

  const handleCreateNewNote = React.useCallback(() => {
    editor.flushCurrentNote();
    setTemplateSelectorTarget('note');
    setIsTemplateSelectorOpen(true);
  }, [editor.flushCurrentNote]);

  const handleCreateNewDocument = React.useCallback(() => {
    editor.flushCurrentNote();
    setTemplateSelectorTarget('document');
    setIsTemplateSelectorOpen(true);
  }, [editor.flushCurrentNote]);

  const handleTemplateSelect = React.useCallback(async (template: MemoTemplate) => {
    setIsTemplateSelectorOpen(false);
    await editor.flushCurrentNote();
    if (template.id === 'blank-note' || template.id === 'blank-document') {
      if (template.type === 'note' || template.id === 'blank-note') handleCreateBlankNote();
      else handleCreateBlankDocument();
      return;
    }
    const type = templateSelectorTarget === 'note' ? 'quick_note' : 'document';
    const newItem = createNote(type);
    newItem.title = template.title || '';
    newItem.content = template.content || '';
    newItem.tags = template.tags ? template.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
    if (type === 'document') newItem.category = categories.selectedCategory || 'uncategorized';
    if (type === 'quick_note') { setSelectedNote(newItem); setSelectedDocument(null); }
    else { setSelectedDocument(newItem); setSelectedNote(null); }
    editor.setCurrentItem({ id: newItem.id, type: templateSelectorTarget, title: newItem.title, content: newItem.content, category: newItem.category ?? 'uncategorized', tags: newItem.tags }, true);
  }, [editor.flushCurrentNote, editor.setCurrentItem, createNote, templateSelectorTarget, categories.selectedCategory, handleCreateBlankNote, handleCreateBlankDocument]);

  const handleDeleteNote = React.useCallback(async (id: string) => {
    await deleteNote(id);
    if (selectedNote?.id === id) { setSelectedNote(null); editor.setCurrentItem(null); }
  }, [deleteNote, selectedNote, editor.setCurrentItem]);

  const handleDeleteDocument = React.useCallback(async (id: string) => {
    await deleteDocument(id);
    if (selectedDocument?.id === id) { setSelectedDocument(null); editor.setCurrentItem(null); }
  }, [deleteDocument, selectedDocument, editor.setCurrentItem]);

  const handleTogglePin = React.useCallback(async (note: Note) => {
    await saveNote({ ...note, pinned: !note.pinned });
  }, [saveNote]);

  // --- Filtering ---
  const allTagsMemo = React.useMemo(() => {
    const tagSet = new Set<string>();
    [...quickNotes, ...documents].forEach(item => {
      if (item.tags && Array.isArray(item.tags)) {
        item.tags.forEach((t: string) => tagSet.add(t));
      }
    });
    return Array.from(tagSet);
  }, [quickNotes, documents]);

  const filteredNotesMemo = React.useMemo(() => {
    return quickNotes.filter(note => {
      const matchSearch = !searchQuery || note.title.toLowerCase().includes(searchQuery.toLowerCase()) || note.content.toLowerCase().includes(searchQuery.toLowerCase());
      const matchTag = !selectedTag || note.tags.includes(selectedTag);
      const matchProject = !projects.selectedProject || (projects.projectItemIds.note || []).includes(note.id);
      return matchSearch && matchTag && matchProject;
    }).sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [quickNotes, searchQuery, selectedTag, projects.selectedProject, projects.projectItemIds.note]);

  const filteredDocumentsMemo = React.useMemo(() => {
    return documents.filter(doc => {
      const matchSearch = !searchQuery || doc.title.toLowerCase().includes(searchQuery.toLowerCase());
      const docCat = doc.category || 'uncategorized';
      const matchCategory = !categories.selectedCategory || docCat === categories.selectedCategory;
      const matchProject = !projects.selectedProject || (projects.projectItemIds.document || []).includes(doc.id);
      return matchSearch && matchCategory && matchProject;
    });
  }, [documents, searchQuery, categories.selectedCategory, projects.selectedProject, projects.projectItemIds.document]);

  const recentNoteTitles = React.useMemo(() =>
    [...quickNotes].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 10).map(n => n.title || '无标题'),
    [quickNotes]
  );
  const recentDocumentTitles = React.useMemo(() =>
    [...documents].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 10).map(d => d.title || '无标题'),
    [documents]
  );

  // --- Auto-tag suggestion listener ---
  React.useEffect(() => {
    const handler = (_: any, data: { noteId: string; tags: string[]; category?: string }) => {
      if (data.noteId && data.tags?.length > 0) {
        setAiSuggestedTags(prev => ({ ...prev, [data.noteId]: { tags: data.tags, ...(data.category ? { category: data.category } : {}) } }))
      }
    }
    if (window.ipcRenderer) {
      window.ipcRenderer.on('auto-tag-suggestion', handler)
    }
    return () => {
      if (window.ipcRenderer) {
        window.ipcRenderer.removeListener?.('auto-tag-suggestion', handler)
      }
    }
  }, [])

  // --- Source note navigation ---
  React.useEffect(() => {
    if (!sourceNoteToOpen) return;
    setActiveTab('content');
    if (sourceNoteToOpen.type === 'note') {
      const target = quickNotes.find(n => n.id === sourceNoteToOpen.id);
      if (target) handleSelectNote(target);
    } else if (sourceNoteToOpen.type === 'document') {
      const target = documents.find(n => n.id === sourceNoteToOpen.id);
      if (target) handleSelectDocument(target);
    }
    setSourceNoteToOpen?.(undefined);
  }, [sourceNoteToOpen]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full flex flex-col bg-gradient-to-br from-accent/5 via-white to-accent/3"
    >
      <div className="flex-1 flex min-h-0 p-4 gap-0">
        <DeskSidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedTag={selectedTag}
          setSelectedTag={setSelectedTag}
          selectedNote={selectedNote}
          selectedDocument={selectedDocument}
          documents={documents}
          quickNotes={quickNotes}
          clips={clips.clips}
          allTagsMemo={allTagsMemo}
          filteredNotesMemo={filteredNotesMemo}
          filteredDocumentsMemo={filteredDocumentsMemo}
          docCategories={categories.docCategories}
          selectedCategory={categories.selectedCategory}
          handleSelectCategory={categories.handleSelectCategory}
          categoryDocCounts={categories.categoryDocCounts}
          editingCategoryId={categories.editingCategoryId}
          setEditingCategoryId={categories.setEditingCategoryId}
          editingCategoryName={categories.editingCategoryName}
          setEditingCategoryName={categories.setEditingCategoryName}
          newCategoryName={categories.newCategoryName}
          setNewCategoryName={categories.setNewCategoryName}
          handleCreateDocCategory={categories.handleCreateDocCategory}
          handleUpdateDocCategory={categories.handleUpdateDocCategory}
          handleDeleteDocCategory={categories.handleDeleteDocCategory}
          handleSelectNote={handleSelectNote}
          handleSelectDocument={handleSelectDocument}
          handleDeleteNote={handleDeleteNote}
          handleDeleteDocument={handleDeleteDocument}
          handleCreateNewNote={handleCreateNewNote}
          handleCreateNewDocument={handleCreateNewDocument}
          setShowAddClipModal={clips.setShowAddClipModal}
          loadNotes={loadNotes}
          setSelectedNote={setSelectedNote}
          setSelectedDocument={setSelectedDocument}
          clipGroups={clips.clipGroups}
          selectedClipGroupId={clips.selectedClipGroupId}
          setSelectedClipGroupId={clips.setSelectedClipGroupId}
          setShowCreateGroupModal={clips.setShowCreateGroupModal}
          loadClipGroups={clips.loadClipGroups}
          onOpenTagManager={() => setIsTagManagerOpen(true)}
        />

        <div className="flex-1 flex flex-col min-w-0">
          {activeTab !== 'clips' && (
            <DeskSearchBar
              activeTab={activeTab}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
            />
          )}

          {activeTab === 'clips' ? (
            <div className="flex-1 flex min-w-0">
              <DeskClipList
                clips={clips.filteredClips}
                clipsLoading={clips.clipsLoading}
                clipSelectionMode={clips.clipSelectionMode}
                setClipSelectionMode={clips.setClipSelectionMode}
                selectedClipIds={clips.selectedClipIds}
                setSelectedClipIds={clips.setSelectedClipIds}
                previewClip={clips.previewClip}
                setPreviewClip={clips.setPreviewClip}
                setShowAddClipModal={clips.setShowAddClipModal}
              />
              <DeskClipsPanel
                previewClip={clips.previewClip}
                setPreviewClip={clips.setPreviewClip}
                clipSelectionMode={clips.clipSelectionMode}
                selectedClipIds={clips.selectedClipIds}
                setShowGroupSelector={clips.setShowGroupSelector}
                clipGroups={clips.clipGroups}
                loadClips={clips.loadClips}
              />
            </div>
          ) : (selectedNote || selectedDocument) ? (
            <>
              <DeskHeader
                activeTab={activeTab}
                selectedNote={selectedNote}
                selectedDocument={selectedDocument}
                editorTitle={editor.editorTitle}
                setEditorTitle={editor.setEditorTitle}
                editorContent={editor.editorContent}
                isDirty={editor.isDirty}
                saveStatus={editor.saveStatus}
                aiActionLoading={editor.aiActionLoading}
                onAiAsk={onAiAsk}
                handleInlineAiAction={editor.handleInlineAiAction}
                handleSaveCurrentNote={editor.handleSaveCurrent}
                handleSaveCurrentDocument={editor.handleSaveCurrent}
                handleDeleteNote={handleDeleteNote}
                handleDeleteDocument={handleDeleteDocument}
                handleTogglePin={handleTogglePin}
                setIsVersionHistoryOpen={setIsVersionHistoryOpen}
                setExportNotification={setExportNotification}
                docCategories={categories.docCategories}
                catDropdownOpen={categories.catDropdownOpen}
                setCatDropdownOpen={categories.setCatDropdownOpen}
                catDropdownRef={categories.catDropdownRef}
                setSelectedDocument={setSelectedDocument}
                setIsDirty={editor.setIsDirty}
                updateCurrentCategory={editor.updateCurrentCategory}
                showProjectPickerFor={projects.showProjectPickerFor}
                setShowProjectPickerFor={projects.setShowProjectPickerFor}
                newProjectName={projects.newProjectName}
                setNewProjectName={projects.setNewProjectName}
                projects={projects.projects}
                handleAssignProject={async (itemType: string, itemId: string, projectName: string) => {
                  await projects.handleAssignProject(itemType, itemId, projectName);
                  if (itemType === 'document') {
                    setSelectedDocument(prev => prev ? { ...prev, project: projectName } : prev);
                  }
                }}
              />
              <DeskContent
                activeTab={activeTab}
                selectedNote={selectedNote}
                selectedDocument={selectedDocument}
                editorContent={editor.editorContent}
                setEditorContent={editor.setEditorContent}
                editorTitle={editor.editorTitle}
                selectedText={editor.selectedText}
                setSelectedText={editor.setSelectedText}
                tiptapRef={editor.tiptapRef}
                aiChatReady={aiChatReady}
                selectedModel={selectedModel}
                onAiAsk={onAiAsk}
                onSaveAsTask={onSaveAsTask}
                onCreateTask={onCreateTask!}
                copilotCollapsed={editor.copilotCollapsed}
                setCopilotCollapsed={editor.setCopilotCollapsed}
                chatPanelWidth={editor.chatPanelWidth}
                setChatPanelWidth={editor.setChatPanelWidth}
                getTasksBySourceId={getTasksBySourceId}
                updateTaskStatus={updateTaskStatus}
                deleteTask={deleteTask}
                handleSelectNote={handleSelectNote}
                handleSelectDocument={handleSelectDocument}
                setActiveTab={setActiveTab}
              />
            </>
          ) : (
            <DeskEmptyState activeTab={activeTab} />
          )}
        </div>
      </div>

      <TagManager
        isOpen={isTagManagerOpen}
        onClose={() => setIsTagManagerOpen(false)}
        memos={[...quickNotes, ...documents]}
        schedules={[]}
        onNavigateToMemo={(memo) => { handleSelectNote(memo); setIsTagManagerOpen(false); }}
        onNavigateToSchedule={() => {}}
        onNavigateToKB={() => {}}
        aiSuggestedTags={aiSuggestedTags}
        onAcceptAiTags={(noteId, tags) => {
          const note = [...quickNotes, ...documents].find(n => n.id === noteId)
          if (note) {
            const merged = [...new Set([...(Array.isArray(note.tags) ? note.tags : []), ...tags])]
            saveNote({ ...note, tags: merged })
            setAiSuggestedTags(prev => { const next = { ...prev }; delete next[noteId]; return next })
          }
        }}
      />
      <DeskModals
        isTemplateSelectorOpen={isTemplateSelectorOpen}
        setIsTemplateSelectorOpen={setIsTemplateSelectorOpen}
        templateSelectorTarget={templateSelectorTarget}
        handleTemplateSelect={handleTemplateSelect}
        recentNoteTitles={recentNoteTitles}
        recentDocumentTitles={recentDocumentTitles}
        onAiAsk={onAiAsk}
        showAddClipModal={clips.showAddClipModal}
        setShowAddClipModal={clips.setShowAddClipModal}
        loadClips={clips.loadClips}
        loadClipGroups={clips.loadClipGroups}
        previewClip={clips.previewClip}
        setPreviewClip={clips.setPreviewClip}
        showCreateGroupModal={clips.showCreateGroupModal}
        setShowCreateGroupModal={clips.setShowCreateGroupModal}
        newGroupName={clips.newGroupName}
        setNewGroupName={clips.setNewGroupName}
        showGroupSelector={clips.showGroupSelector}
        setShowGroupSelector={clips.setShowGroupSelector}
        clipGroups={clips.clipGroups}
        selectedClipIds={clips.selectedClipIds}
        setSelectedClipIds={clips.setSelectedClipIds}
        setClipSelectionMode={clips.setClipSelectionMode}
        isVersionHistoryOpen={isVersionHistoryOpen}
        setIsVersionHistoryOpen={setIsVersionHistoryOpen}
        selectedNote={selectedNote}
        selectedDocument={selectedDocument}
        editorContent={editor.editorContent}
        editorTitle={editor.editorTitle}
        setSelectedNote={setSelectedNote}
        setSelectedDocument={setSelectedDocument}
        setExportNotification={setExportNotification}
        exportNotification={exportNotification}
      />
    </motion.div>
  );
};

export default DeskPage;
