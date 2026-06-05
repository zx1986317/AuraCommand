import { create } from 'zustand';
import { logger } from '../utils/logger';

export interface SettingsState {
  ollamaStatus: {
    connected: boolean;
    chatModelReady: boolean;
    embeddingModelReady: boolean;
    error?: string;
  } | null;
  setOllamaStatus: (status: SettingsState['ollamaStatus']) => void;

  selectedModel: string;
  setSelectedModel: (model: string) => void;

  availableModels: string[];
  setAvailableModels: (models: string[]) => void;

  cloudModelIdMap: Record<string, string>;
  setCloudModelIdMap: (map: Record<string, string>) => void;

  visionModels: string[];
  setVisionModels: (models: string[]) => void;

  isSearchEnabled: boolean;
  setIsSearchEnabled: (enabled: boolean) => void;

  searxngUrl: string;
  setSearxngUrl: (url: string) => void;

  vaultPath: string;
  setVaultPath: (path: string) => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
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
    set({ selectedModel: model });
  },

  availableModels: [],
  setAvailableModels: (models) => set({ availableModels: models }),

  cloudModelIdMap: {},
  setCloudModelIdMap: (map) => set({ cloudModelIdMap: map }),

  visionModels: [],
  setVisionModels: (models) => set({ visionModels: models }),

  isSearchEnabled: localStorage.getItem('isSearchEnabled') === 'true',
  setIsSearchEnabled: (enabled) => {
    localStorage.setItem('isSearchEnabled', String(enabled));
    set({ isSearchEnabled: enabled });
  },

  searxngUrl: localStorage.getItem('searxngUrl') || 'http://localhost:8080',
  setSearxngUrl: (url) => {
    localStorage.setItem('searxngUrl', url);
    set({ searxngUrl: url });
  },

  vaultPath: '',
  setVaultPath: (path) => set({ vaultPath: path }),
}));