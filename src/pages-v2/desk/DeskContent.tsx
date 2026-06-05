import React from 'react';
import { BookOpen } from 'lucide-react';
import AIChatPanel from '../../components/AIChatPanel';
import CopilotFloatingMenu from '../../components/CopilotFloatingMenu';
import TiptapEditor, { type TiptapEditorHandle } from '../../components/TiptapEditor';
import BacklinkPanel from '../../components/BacklinkPanel';
import type { Note } from '../../hooks/useNotes';

export interface DeskContentProps {
  activeTab: 'documents' | 'notes' | 'clips';
  selectedNote: Note | null;
  selectedDocument: Note | null;
  editorContent: string;
  setEditorContent: (c: string) => void;
  editorTitle: string;
  selectedText: string | null;
  setSelectedText: (t: string | null) => void;
  tiptapRef: React.RefObject<TiptapEditorHandle>;
  aiChatReady: boolean;
  selectedModel: string;
  onAiAsk: ((question: string) => Promise<string>) | undefined;
  onSaveAsTask: ((content: string) => void) | undefined;
  onCreateTask: ((title: string) => void) | undefined;
  copilotCollapsed: boolean;
  setCopilotCollapsed: (v: boolean) => void;
  chatPanelWidth: number;
  setChatPanelWidth: (w: number) => void;
  getTasksBySourceId: (id: string) => any[];
  updateTaskStatus: (id: string, status: 'inbox' | 'today' | 'next' | 'done') => void;
  deleteTask: (id: string) => void;
  handleSelectNote: (note: Note) => void;
  handleSelectDocument: (doc: Note) => void;
  setActiveTab: (tab: 'documents' | 'notes' | 'clips') => void;
}

const DeskContent: React.FC<DeskContentProps> = ({
  activeTab,
  selectedNote, selectedDocument,
  editorContent, setEditorContent,
  editorTitle,
  selectedText, setSelectedText,
  tiptapRef,
  aiChatReady, selectedModel, onAiAsk,
  onSaveAsTask, onCreateTask,
  copilotCollapsed, setCopilotCollapsed,
  chatPanelWidth, setChatPanelWidth,
  getTasksBySourceId, updateTaskStatus, deleteTask,
  handleSelectNote, handleSelectDocument, setActiveTab,
}) => {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 flex min-h-0">
        <div className="flex-1 overflow-auto p-4 relative">
          {selectedText && onAiAsk && (
            <CopilotFloatingMenu
              selectedText={selectedText}
              contextType={activeTab === 'notes' ? 'note' : 'document'}
              onAiAsk={onAiAsk}
              onInsertToEditor={(text) => {
                tiptapRef.current?.insertMarkdown(text);
              }}
              onSaveAsTask={onSaveAsTask}
              onCreateTask={onCreateTask}
              onClose={() => setSelectedText(null)}
            />
          )}
          <TiptapEditor ref={tiptapRef} content={editorContent} onChange={setEditorContent} onTextSelect={(text) => setSelectedText(text && text.length > 0 ? text : null)} placeholder={selectedNote ? '记录你的想法...' : '开始撰写文档...'} />
          {(selectedNote || selectedDocument) && (() => {
            const sourceId = (selectedNote || selectedDocument)?.id || ''
            const relatedTasks = getTasksBySourceId(sourceId)
            if (relatedTasks.length === 0) return null
            return (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-2xs font-semibold text-gray-400 uppercase tracking-wider mb-2">📋 相关待办</p>
                <div className="space-y-1">
                  {relatedTasks.map(task => (
                    <div key={task.id} className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-100 text-xs">
                      <button
                        onClick={() => updateTaskStatus(task.id, task.status === 'done' ? 'inbox' : 'done')}
                        className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${task.status === 'done' ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-green-400'}`}
                      >
                        {task.status === 'done' && '✓'}
                      </button>
                      <span className={`flex-1 truncate ${task.status === 'done' ? 'line-through text-gray-400' : 'text-gray-700'}`}>{task.title}</span>
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="shrink-0 text-gray-300 hover:text-red-400 transition-colors text-2xs"
                      >✕</button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
          {(selectedNote || selectedDocument) && (
            <BacklinkPanel
              memoId={(selectedNote || selectedDocument)!.id}
              onNavigateToMemo={(memo) => {
                if (memo.type === 'document') {
                  handleSelectDocument(memo as Note);
                  setActiveTab('documents');
                } else {
                  handleSelectNote(memo as Note);
                  setActiveTab('notes');
                }
              }}
            />
          )}
        </div>
        <AIChatPanel
          contextType={activeTab === 'notes' ? 'note' : 'document'}
          contextId={selectedNote?.id || selectedDocument?.id || undefined}
          contextTitle={editorTitle}
          contextContent={editorContent}
          selectedText={selectedText}
          aiReady={aiChatReady}
          selectedModel={selectedModel}
          onInsertToEditor={(text) => { tiptapRef.current?.insertMarkdown(text); }}
          collapsed={copilotCollapsed}
          onToggleCollapse={() => setCopilotCollapsed(!copilotCollapsed)}
          width={chatPanelWidth}
          onWidthChange={(w) => {
            setChatPanelWidth(w);
            localStorage.setItem('deskAIChatPanelWidth', String(Math.floor(w)));
          }}
        />
      </div>
    </div>
  );
};

export const DeskEmptyState: React.FC<{ activeTab: 'documents' | 'notes' | 'clips' }> = ({ activeTab }) => (
  <div className="flex-1 flex items-center justify-center">
    <div className="text-center">
      <BookOpen size={40} className="mx-auto text-gray-200 mb-2" />
      <p className="text-xs text-gray-400">选择一个{activeTab === 'notes' ? '便签' : '文档'}开始编辑</p>
    </div>
  </div>
);

export default DeskContent;