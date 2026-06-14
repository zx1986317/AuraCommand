import { create } from 'zustand';
import { logger } from '../utils/logger';
import type { ActiveTab, AssistantPhase, IndexingTask, Notification, NotificationType, OllamaStatus } from './types';

export type { ActiveTab, AssistantPhase, IndexingTask, Notification, NotificationType, OllamaStatus };

export { useChatStore } from './chatStore';
export type { ChatState } from './chatStore';

export { useKBStore } from './kbStore';
export type { KBState } from './kbStore';

export { useWorkflowStore } from './workflowStore';
export type { WorkflowState } from './workflowStore';

export { useSettingsStore } from './settingsStore';
export type { SettingsState } from './settingsStore';

export { useUIStore } from './uiStore';
export type { UIState } from './uiStore';

export interface AppState {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;

  deskDefaultTab: 'documents' | 'notes';
  setDeskDefaultTab: (tab: 'documents' | 'notes') => void;

  ollamaStatus: {
    connected: boolean;
    chatModelReady: boolean;
    embeddingModelReady: boolean;
    error?: string;
  } | null;
  setOllamaStatus: (status: AppState['ollamaStatus']) => void;

  selectedModel: string;
  setSelectedModel: (model: string) => void;

  availableModels: string[];
  setAvailableModels: (models: string[]) => void;

  cloudModelIdMap: Record<string, string>;
  setCloudModelIdMap: (map: Record<string, string>) => void;

  visionModels: string[];
  setVisionModels: (models: string[]) => void;

  currentTheme: string;
  setCurrentTheme: (theme: string) => void;

  vaultPath: string;
  setVaultPath: (path: string) => void;

  isMaximized: boolean;
  setIsMaximized: (maximized: boolean) => void;

  isDragging: boolean;
  setIsDragging: (dragging: boolean) => void;

  isAIProcessing: boolean;
  setIsAIProcessing: (processing: boolean) => void;

  notification: Notification | null;
  setNotification: (notification: Notification | null) => void;

  searchQuery: string;
  setSearchQuery: (query: string) => void;

  isModelDropdownOpen: boolean;
  setIsModelDropdownOpen: (open: boolean) => void;

  isThemeDropdownOpen: boolean;
  setIsThemeDropdownOpen: (open: boolean) => void;

  isSettingsModalOpen: boolean;
  setIsSettingsModalOpen: (open: boolean) => void;

  isSearchEnabled: boolean;
  setIsSearchEnabled: (enabled: boolean) => void;

  isRAGEnabled: boolean;
  setIsRAGEnabled: (enabled: boolean) => void;

  chatNetworkMode: 'off' | 'direct';
  setChatNetworkMode: (mode: 'off' | 'direct') => void;

  searxngUrl: string;
  setSearxngUrl: (url: string) => void;

  showReasoningProcess: boolean;
  setShowReasoningProcess: (enabled: boolean) => void;

  indexingFiles: Record<string, IndexingTask>;
  setIndexingFiles: (files: Record<string, IndexingTask>) => void;
  updateIndexingFile: (id: string, task: Partial<IndexingTask>) => void;
  removeIndexingFile: (id: string) => void;

  kbFilter: 'all' | 'indexed' | 'pending';
  setKbFilter: (filter: 'all' | 'indexed' | 'pending') => void;

  kbSort: 'newest' | 'largest';
  setKbSort: (sort: 'newest' | 'largest') => void;

  editingSchedule: any | null;
  setEditingSchedule: (schedule: any | null) => void;

  selectedDate: Date;
  setSelectedDate: (date: Date) => void;

  modalConfig: {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: (inputValue?: string) => void;
    inputDefaultValue?: string | undefined;
  } | null;
  setModalConfig: (config: AppState['modalConfig']) => void;

  sourceNoteToOpen: { type: 'note' | 'document'; id: string } | undefined;
  setSourceNoteToOpen: (source: { type: 'note' | 'document'; id: string } | undefined) => void;

  isMemoryPanelOpen: boolean;
  setIsMemoryPanelOpen: (open: boolean) => void;

  proactiveNotifications: any[];
  addProactiveNotification: (notification: any) => void;
  removeProactiveNotification: (timestamp: string) => void;

  currentProjectName: string | null;
  setCurrentProjectName: (name: string | null) => void;

  projects: string[];
  setProjects: (projects: string[]) => void;
  addProjectLocal: (name: string) => void;
  removeProjectLocal: (name: string) => void;
  renameProjectLocal: (oldName: string, newName: string) => void;

  // P0 #5 修复：降级透明横幅
  fallbackEvent: { from: string; to: string; message: string; timestamp: number } | null;
  setFallbackEvent: (event: AppState['fallbackEvent']) => void;
  clearFallbackEvent: () => void;
}

const useAppStore = create<AppState>((set) => ({
  activeTab: 'dashboard',
  setActiveTab: (tab) => set({ activeTab: tab }),

  deskDefaultTab: 'documents',
  setDeskDefaultTab: (tab) => set({ deskDefaultTab: tab }),

  ollamaStatus: null,
  setOllamaStatus: (status) => set({ ollamaStatus: status }),

  selectedModel: localStorage.getItem('selectedModel') || '',
  setSelectedModel: (model) => {
    localStorage.setItem('selectedModel', model);
    if (window.ipcRenderer) {
      void Promise.all([
        window.ipcRenderer.invoke('set-setting', { key: 'selectedModel', value: model }),
        window.ipcRenderer.invoke('set-setting', { key: 'selected_model', value: model })
      ]).catch((err) => {

        logger.warn('Failed to sync selected model preference:', err);
      });
    }
    set({ selectedModel: model, isModelDropdownOpen: false });
  },

  availableModels: [],
  setAvailableModels: (models) => set({ availableModels: models }),

  cloudModelIdMap: {},
  setCloudModelIdMap: (map) => set({ cloudModelIdMap: map }),

  visionModels: [],
  setVisionModels: (models) => set({ visionModels: models }),

  currentTheme: localStorage.getItem('theme') || 'default',
  setCurrentTheme: (theme) => {
    localStorage.setItem('theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    set({ currentTheme: theme, isThemeDropdownOpen: false });
  },

  vaultPath: '',
  setVaultPath: (path) => set({ vaultPath: path }),

  isMaximized: false,
  setIsMaximized: (maximized) => set({ isMaximized: maximized }),

  isDragging: false,
  setIsDragging: (dragging) => set({ isDragging: dragging }),

  isAIProcessing: false,
  setIsAIProcessing: (processing) => set({ isAIProcessing: processing }),

  notification: null,
  setNotification: (notification) => set({ notification }),

  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),

  isModelDropdownOpen: false,
  setIsModelDropdownOpen: (open) => set({ isModelDropdownOpen: open }),

  isThemeDropdownOpen: false,
  setIsThemeDropdownOpen: (open) => set({ isThemeDropdownOpen: open }),

  isSettingsModalOpen: false,
  setIsSettingsModalOpen: (open) => set({ isSettingsModalOpen: open }),

  isSearchEnabled: localStorage.getItem('isSearchEnabled') === 'true',
  setIsSearchEnabled: (enabled) => {
    localStorage.setItem('isSearchEnabled', String(enabled));
    set({ isSearchEnabled: enabled });
  },

  isRAGEnabled: localStorage.getItem('isRAGEnabled') !== 'false',
  setIsRAGEnabled: (enabled) => {
    localStorage.setItem('isRAGEnabled', String(enabled));
    set({ isRAGEnabled: enabled });
  },

  chatNetworkMode: (localStorage.getItem('chatNetworkMode') as 'off' | 'direct') || 'off',
  setChatNetworkMode: (mode) => {
    localStorage.setItem('chatNetworkMode', mode);
    set({ chatNetworkMode: mode });
  },

  searxngUrl: localStorage.getItem('searxngUrl') || 'http://localhost:8080',
  setSearxngUrl: (url) => {
    localStorage.setItem('searxngUrl', url);
    set({ searxngUrl: url });
  },

  showReasoningProcess: localStorage.getItem('showReasoningProcess') !== 'false',
  setShowReasoningProcess: (enabled) => {
    localStorage.setItem('showReasoningProcess', String(enabled));
    set({ showReasoningProcess: enabled });
  },

  indexingFiles: {},
  setIndexingFiles: (files) => set({ indexingFiles: files }),
  updateIndexingFile: (id, task) =>
    set((state) => ({
      indexingFiles: {
        ...state.indexingFiles,
        [id]: { ...state.indexingFiles[id], ...task } as IndexingTask,
      },
    })),
  removeIndexingFile: (id) =>
    set((state) => {
      const next = { ...state.indexingFiles };
      delete next[id];
      return { indexingFiles: next };
    }),

  kbFilter: 'all',
  setKbFilter: (filter) => set({ kbFilter: filter }),

  kbSort: 'newest',
  setKbSort: (sort) => set({ kbSort: sort }),

  editingSchedule: null,
  setEditingSchedule: (schedule) => set({ editingSchedule: schedule }),

  selectedDate: new Date(),
  setSelectedDate: (date) => set({ selectedDate: date }),

  modalConfig: null,
  setModalConfig: (config) => set({ modalConfig: config }),

  sourceNoteToOpen: undefined,
  setSourceNoteToOpen: (source) => set({ sourceNoteToOpen: source }),

  isMemoryPanelOpen: false,
  setIsMemoryPanelOpen: (open) => set({ isMemoryPanelOpen: open }),

  proactiveNotifications: [],
  addProactiveNotification: (notification) =>
    set((state) => ({
      proactiveNotifications: [...state.proactiveNotifications.slice(-4), notification],
    })),
  removeProactiveNotification: (timestamp) =>
    set((state) => ({
      proactiveNotifications: state.proactiveNotifications.filter(n => n.timestamp !== timestamp),
    })),

  currentProjectName: null,
  setCurrentProjectName: (name) => set({ currentProjectName: name }),

  projects: [],
  setProjects: (projects) => set({ projects }),
  addProjectLocal: (name) =>
    set((state) =>
      state.projects.includes(name) ? state : { projects: [name, ...state.projects] }
    ),
  removeProjectLocal: (name) =>
    set((state) => ({ projects: state.projects.filter((p) => p !== name) })),
  renameProjectLocal: (oldName, newName) =>
    set((state) => ({
      projects: state.projects.map((p) => (p === oldName ? newName : p)),
    })),

  // P0 #5 修复：降级透明横幅
  fallbackEvent: null,
  setFallbackEvent: (event) => set({ fallbackEvent: event }),
  clearFallbackEvent: () => set({ fallbackEvent: null }),
}));

export { useAppStore };
