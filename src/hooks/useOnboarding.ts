import { useState, useEffect } from 'react';
import { SAMPLE_WORKSPACE_MEMOS, SAMPLE_WORKSPACE_DOCS } from '../data/sampleData';
import type { Notification, ActiveTab } from '../store/appStore';

export const ONBOARDING_STORAGE_KEY = 'auracommand:onboarding:v1';
export const SAMPLE_WORKSPACE_PROJECT = 'AuraCommand 示例工作区';
export const SAMPLE_FIRST_QUESTION = '请基于我当前的本地知识库，帮我总结这个示例工作区的核心目标和下一步建议。';

interface UseOnboardingProps {
  files: any[];
  loadFiles: () => Promise<void>;
  loadFileTags: () => Promise<void>;
  setNotification: (notification: Notification | null) => void;
  setActiveTab: (tab: ActiveTab) => void;
  setDeskDefaultTab: (tab: 'documents' | 'notes') => void;
  setSourceNoteToOpen: (source: { type: 'note' | 'document'; id: string } | undefined) => void;
}

export function useOnboarding({
  files,
  loadFiles,
  loadFileTags,
  setNotification,
  setActiveTab,
  setDeskDefaultTab,
  setSourceNoteToOpen
}: UseOnboardingProps) {
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [isImportingSampleWorkspace, setIsImportingSampleWorkspace] = useState(false);
  const [hasEvaluatedOnboarding, setHasEvaluatedOnboarding] = useState(false);
  const [showPostImportGuide, setShowPostImportGuide] = useState(false);
  const [highlightedSampleMemoIds, setHighlightedSampleMemoIds] = useState<string[]>([]);
  const [highlightedSampleFileIds, setHighlightedSampleFileIds] = useState<string[]>([]);

  const handleImportSampleWorkspace = async () => {
    try {
      const importedFileIds: string[] = [];
      for (const memo of SAMPLE_WORKSPACE_MEMOS) {
        await window.ipcRenderer.invoke('save-note', {
          ...memo,
          type: 'quick_note',
          images: [],
          created_at: new Date().toISOString()
        });
      }

      for (const doc of SAMPLE_WORKSPACE_DOCS) {
        const result = await window.ipcRenderer.invoke('store-text-as-file', {
          title: doc.title,
          content: doc.content
        });
        if (result?.id) {
          importedFileIds.push(result.id);
        }
      }

      await Promise.all([loadFiles(), loadFileTags()]);
      setHighlightedSampleMemoIds(SAMPLE_WORKSPACE_MEMOS.map((memo) => memo.id));
      setHighlightedSampleFileIds(importedFileIds);
      setShowPostImportGuide(true);
      setNotification({ message: '示例工作区已导入，可直接体验便签、知识库和 AI 联动', type: 'info' });
      setTimeout(() => setNotification(null), 4000);
    } catch (error) {
      console.error('Failed to import sample workspace:', error);
      setNotification({ message: '示例工作区导入失败，请重试', type: 'error' });
      setTimeout(() => setNotification(null), 4000);
    }
  };

  const markOnboardingComplete = () => {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, 'seen');
    setIsOnboardingOpen(false);
  };

  const openOnboarding = (step: number = 0) => {
    setOnboardingStep(step);
    setIsOnboardingOpen(true);
  };

  const openImportedSampleMemo = () => {
    const firstSampleId = SAMPLE_WORKSPACE_MEMOS[0]?.id;
    if (!firstSampleId) return;

    setActiveTab('desk');
    setDeskDefaultTab('notes');
    setSourceNoteToOpen({ type: 'note', id: firstSampleId });
  };

  const openSampleQuestionInChat = async () => {
    setShowPostImportGuide(false);
    setNotification({ message: '示例问题功能将在后续版本中提供', type: 'info' });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleOnboardingImportSample = async () => {
    try {
      setIsImportingSampleWorkspace(true);
      await handleImportSampleWorkspace();
      localStorage.setItem(ONBOARDING_STORAGE_KEY, 'seen');
      setActiveTab('kb');
      setIsOnboardingOpen(false);
      setShowPostImportGuide(true);
    } finally {
      setIsImportingSampleWorkspace(false);
    }
  };

  useEffect(() => {
    if (hasEvaluatedOnboarding) return;
    const timer = window.setTimeout(() => {
      const hasSeen = localStorage.getItem(ONBOARDING_STORAGE_KEY) === 'seen';
      const hasAnyContent = files.length > 0;
      if (!hasSeen && !hasAnyContent) {
        openOnboarding(0);
      }
      setHasEvaluatedOnboarding(true);
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [files.length, hasEvaluatedOnboarding]);

  return {
    isGlobalSearchOpen,
    setIsGlobalSearchOpen,
    isOnboardingOpen,
    setIsOnboardingOpen,
    onboardingStep,
    setOnboardingStep,
    isImportingSampleWorkspace,
    setIsImportingSampleWorkspace,
    hasEvaluatedOnboarding,
    setHasEvaluatedOnboarding,
    showPostImportGuide,
    setShowPostImportGuide,
    highlightedSampleMemoIds,
    setHighlightedSampleMemoIds,
    highlightedSampleFileIds,
    setHighlightedSampleFileIds,
    markOnboardingComplete,
    openOnboarding,
    openImportedSampleMemo,
    openSampleQuestionInChat,
    handleImportSampleWorkspace,
    handleOnboardingImportSample
  };
}
