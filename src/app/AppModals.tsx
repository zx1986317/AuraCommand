import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, BrainCircuit, ArrowRight, CheckSquare, X, Loader2 } from 'lucide-react';
import ScheduleEditor from '../components/ScheduleEditor';
import Modal from '../components/Modal';
import SettingsModal from '../components/SettingsModal';
import PDFViewer from '../components/PDFViewer';
import IndexingProgressOverlay from '../components/IndexingProgressOverlay';
import NotificationToast from '../components/NotificationToast';
import GlobalSearch from '../components/GlobalSearch';
import OnboardingModal from '../components/OnboardingModal';
import WeeklyDigestModal from '../components/WeeklyDigestModal';

const PDFViewerFromId: React.FC<{
  fileId: string;
  fileName: string;
  onClose: () => void;
}> = ({ fileId, fileName, onClose }) => {
  const [pdfData, setPdfData] = React.useState<Uint8Array | null>(null);

  React.useEffect(() => {
    window.ipcRenderer.invoke('read-pdf-file', { fileId }).then((result: any) => {
      if (result?.success && result?.data) {
        const binary = atob(result.data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        setPdfData(bytes);
      }
    }).catch(() => {});
  }, [fileId]);

  if (!pdfData) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center">
        <Loader2 className="text-white animate-spin" size={32} />
      </div>
    );
  }

  return <PDFViewer pdfData={pdfData} fileName={fileName} onClose={onClose} />;
};

interface AppModalsProps {
  activeTab: string;
  indexingEntries: any[];
  notification: any;
  setNotification: (val: any) => void;
  isOnboardingOpen: boolean;
  onboardingStep: number;
  aiStatusLabel: string;
  aiStatusHint: string;
  aiChatReady: boolean;
  aiRagReady: boolean;
  isImportingSampleWorkspace: boolean;
  markOnboardingComplete: () => void;
  setOnboardingStep: (fn: (prev: number) => number) => void;
  handleOnboardingImportSample: () => void;
  setIsSettingsModalOpen: (val: boolean) => void;
  setActiveTab: (tab: any) => void;
  setDeskDefaultTab: (tab: any) => void;
  showPostImportGuide: boolean;
  setShowPostImportGuide: (val: boolean) => void;
  openImportedSampleMemo: () => void;
  openSampleQuestionInChat: () => void;
  proactiveNotifications: any[];
  editingSchedule: any;
  handleSaveSchedule: (schedule: any) => Promise<void>;
  setEditingSchedule: (val: any) => void;
  setActiveTabForModal: (tab: any) => void;
  setDeskDefaultTabForModal: (tab: any) => void;
  setSourceNoteToOpen: (val: any) => void;
  modalConfig: any;
  setModalConfig: (val: any) => void;
  isSettingsModalOpen: boolean;
  selectedModel: string;
  handleModelChange: (model: string) => void;
  availableModels: any[];
  vaultPath: string;
  vaultStats: any;
  isSearchEnabled: boolean;
  handleSearchEnabledChange: (val: boolean) => void;
  searxngUrl: string;
  handleSearxngUrlChange: (url: string) => void;
  showReasoningProcess: boolean;
  handleShowReasoningProcessChange: (val: boolean) => void;
  handleVaultSwitched: any;
  ollamaStatus: any;
  activeIndexingCount: number;
  openOnboarding: (step: number) => void;
  chatContextLength: number;
  setChatContextLength: (val: number) => void;
  loadModels: () => void;
  pdfViewerState: any;
  setPdfViewerState: (val: any) => void;
  isGlobalSearchOpen: boolean;
  setIsGlobalSearchOpen: (fn: any) => void;
  isWeeklyDigestOpen: boolean;
  setIsWeeklyDigestOpen: (val: boolean) => void;
}

const AppModals: React.FC<AppModalsProps> = ({
  activeTab,
  indexingEntries,
  notification,
  setNotification,
  isOnboardingOpen,
  onboardingStep,
  aiStatusLabel,
  aiStatusHint,
  aiChatReady,
  aiRagReady,
  isImportingSampleWorkspace,
  markOnboardingComplete,
  setOnboardingStep,
  handleOnboardingImportSample,
  setIsSettingsModalOpen,
  setActiveTab,
  setDeskDefaultTab,
  showPostImportGuide,
  setShowPostImportGuide,
  openImportedSampleMemo,
  openSampleQuestionInChat,
  proactiveNotifications,
  editingSchedule,
  handleSaveSchedule,
  setEditingSchedule,
  setActiveTabForModal,
  setDeskDefaultTabForModal,
  setSourceNoteToOpen,
  modalConfig,
  setModalConfig,
  isSettingsModalOpen,
  selectedModel,
  handleModelChange,
  availableModels,
  vaultPath,
  vaultStats,
  isSearchEnabled,
  handleSearchEnabledChange,
  searxngUrl,
  handleSearxngUrlChange,
  showReasoningProcess,
  handleShowReasoningProcessChange,
  handleVaultSwitched,
  ollamaStatus,
  activeIndexingCount,
  openOnboarding,
  chatContextLength,
  setChatContextLength,
  loadModels,
  pdfViewerState,
  setPdfViewerState,
  isGlobalSearchOpen,
  setIsGlobalSearchOpen,
  isWeeklyDigestOpen,
  setIsWeeklyDigestOpen,
}) => {
  return (
    <>
      {activeTab !== 'dashboard' && (
        <IndexingProgressOverlay entries={indexingEntries} />
      )}

      <NotificationToast notification={notification} onClose={() => setNotification(null)} />

      <OnboardingModal
        isOpen={isOnboardingOpen}
        step={onboardingStep}
        aiStatusLabel={aiStatusLabel}
        aiStatusHint={aiStatusHint}
        aiChatReady={aiChatReady}
        aiRagReady={aiRagReady}
        isImporting={isImportingSampleWorkspace}
        onClose={markOnboardingComplete}
        onNext={() => setOnboardingStep((prev) => Math.min(prev + 1, 2))}
        onPrev={() => setOnboardingStep((prev) => Math.max(prev - 1, 0))}
        onImportSample={handleOnboardingImportSample}
        onOpenSettings={() => {
          markOnboardingComplete();
          setIsSettingsModalOpen(true);
        }}
        onGoToKB={() => {
          markOnboardingComplete();
          setActiveTab('kb');
        }}
        onGoToNotes={() => {
          markOnboardingComplete();
          setActiveTab('desk');
          setDeskDefaultTab('notes');
        }}
        onGoToTasks={() => {
          markOnboardingComplete();
          setActiveTab('tasks');
        }}
      />

      <AnimatePresence>
        {showPostImportGuide && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            className="fixed bottom-6 right-6 z-[220] w-[380px] rounded-[2rem] border border-accent/15 bg-white/95 p-6 shadow-2xl backdrop-blur-xl"
          >
            <button
              onClick={() => setShowPostImportGuide(false)}
              className="absolute right-4 top-4 rounded-xl p-2 text-muted hover:bg-teal-900/5 hover:text-foreground transition-all"
            >
              <X size={16} />
            </button>
            <div className="inline-flex items-center gap-2 rounded-full bg-accent/5 px-3 py-1 text-2xs font-bold uppercase tracking-[0.2em] text-accent">
              <Sparkles size={12} />
              下一步建议
            </div>
            <h3 className="mt-4 text-lg font-bold text-foreground">示例工作区已就绪，建议你立刻完成这两步</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">先打开一条示例便签理解资料结构，再去 AI 助手发起第一次基于知识库的提问。</p>
            <div className="mt-5 space-y-3">
              <button
                onClick={() => {
                  setShowPostImportGuide(false);
                  openImportedSampleMemo();
                }}
                className="w-full flex items-center justify-between gap-3 rounded-2xl border border-teal-900/10 bg-white px-4 py-3 text-left hover:bg-teal-900/5 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                    <BrainCircuit size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">打开示例便签</p>
                    <p className="text-2xs text-muted mt-1">先看"项目例会纪要"，理解内容如何串起来。</p>
                  </div>
                </div>
                <ArrowRight size={16} className="text-accent" />
              </button>
              <button
                onClick={openSampleQuestionInChat}
                className="w-full flex items-center justify-between gap-3 rounded-2xl border border-accent/15 bg-accent/5 px-4 py-3 text-left hover:bg-accent/10 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-accent">
                    <CheckSquare size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">去待办创建任务</p>
                    <p className="text-2xs text-muted mt-1">把想法变成行动，跟踪执行进度。</p>
                  </div>
                </div>
                <ArrowRight size={16} className="text-accent" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="fixed top-4 right-4 z-[200] space-y-2 pointer-events-none">
        <AnimatePresence>
          {proactiveNotifications.map((n: any) => (
            <motion.div
              key={n.timestamp}
              initial={{ opacity: 0, x: 100, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.9 }}
              className="pointer-events-auto max-w-sm bg-white/95 backdrop-blur-xl rounded-2xl border border-teal-900/10 shadow-2xl p-4"
            >
              <div className="flex items-start gap-3">
                <span className="text-lg shrink-0">{n.type === 'schedule_reminder' ? '⏰' : '💡'}</span>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-foreground">{n.title}</h4>
                  <p className="text-2xs text-muted mt-1 leading-relaxed">{n.message}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {editingSchedule && (
          <ScheduleEditor
            schedule={editingSchedule}
            onSave={handleSaveSchedule}
            onClose={() => setEditingSchedule(null)}
            memos={[]}
            onNavigateToMemo={(memo) => { setActiveTabForModal('desk'); setDeskDefaultTabForModal('notes'); setSourceNoteToOpen({ type: 'note', id: memo.id }); }}
            allSchedules={[]}
          />
        )}
      </AnimatePresence>

      <Modal
        isOpen={modalConfig?.isOpen || false}
        title={modalConfig?.title || ''}
        message={modalConfig?.message || ''}
        onConfirm={modalConfig?.onConfirm || (() => {})}
        onCancel={() => setModalConfig(null)}
        inputDefaultValue={modalConfig?.inputDefaultValue}
      />

      <SettingsModal
            isOpen={isSettingsModalOpen}
            onClose={() => setIsSettingsModalOpen(false)}
            currentModel={selectedModel}
            onModelChange={handleModelChange}
            availableModels={availableModels}
            vaultPath={vaultPath}
            vaultStats={vaultStats}
            isSearchEnabled={isSearchEnabled}
            onSearchEnabledChange={handleSearchEnabledChange}
            searxngUrl={searxngUrl}
            onSearxngUrlChange={handleSearxngUrlChange}
            showReasoningProcess={showReasoningProcess}
            onShowReasoningProcessChange={handleShowReasoningProcessChange}
            onVaultSwitched={handleVaultSwitched}
            ollamaStatus={ollamaStatus}
            activeIndexingCount={activeIndexingCount}
            onOpenOnboarding={() => {
              setIsSettingsModalOpen(false);
              openOnboarding(0);
            }}
            chatContextLength={chatContextLength}
            onChatContextLengthChange={(len) => {
              setChatContextLength(len);
              localStorage.setItem('chatContextLength', String(len));
            }}
            onCloudModelsChanged={loadModels}
          />

      {pdfViewerState && (
        <PDFViewerFromId
          fileId={pdfViewerState.fileId}
          fileName={pdfViewerState.fileName}
          onClose={() => setPdfViewerState(null)}
        />
      )}

      <GlobalSearch
        isOpen={isGlobalSearchOpen}
        onClose={() => setIsGlobalSearchOpen(false)}
        onNavigateToMemo={(memo) => { setActiveTab('desk'); setDeskDefaultTab(memo.type === 'document' ? 'documents' : 'notes'); setSourceNoteToOpen({ type: memo.type === 'document' ? 'document' : 'note', id: memo.id }); }}
        onNavigateToKB={() => setActiveTab('kb')}
        onNavigateToSchedule={(sch) => { setActiveTab('tasks'); }}
        onNavigateToTasks={() => setActiveTab('tasks')}
      />

      <WeeklyDigestModal
        isOpen={isWeeklyDigestOpen}
        onClose={() => setIsWeeklyDigestOpen(false)}
        onNavigateToMemo={(memo) => { setActiveTab('desk'); setDeskDefaultTab(memo.type === 'document' ? 'documents' : 'notes'); setSourceNoteToOpen({ type: memo.type === 'document' ? 'document' : 'note', id: memo.id }); }}
      />
    </>
  );
};

export default AppModals;