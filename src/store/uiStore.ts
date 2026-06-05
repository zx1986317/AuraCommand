import { create } from 'zustand';
import type { ActiveTab, Notification } from './types';

export interface UIState {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;

  deskDefaultTab: 'documents' | 'notes';
  setDeskDefaultTab: (tab: 'documents' | 'notes') => void;

  currentTheme: string;
  setCurrentTheme: (theme: string) => void;

  isMaximized: boolean;
  setIsMaximized: (maximized: boolean) => void;

  isDragging: boolean;
  setIsDragging: (dragging: boolean) => void;

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

  modalConfig: {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: (inputValue?: string) => void;
    inputDefaultValue?: string | undefined;
  } | null;
  setModalConfig: (config: UIState['modalConfig']) => void;

  sourceNoteToOpen: { type: 'note' | 'document'; id: string } | undefined;
  setSourceNoteToOpen: (source: { type: 'note' | 'document'; id: string } | undefined) => void;

  isMemoryPanelOpen: boolean;
  setIsMemoryPanelOpen: (open: boolean) => void;

  proactiveNotifications: any[];
  addProactiveNotification: (notification: any) => void;
  removeProactiveNotification: (timestamp: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeTab: 'dashboard',
  setActiveTab: (tab) => set({ activeTab: tab }),

  deskDefaultTab: 'documents',
  setDeskDefaultTab: (tab) => set({ deskDefaultTab: tab }),

  currentTheme: localStorage.getItem('theme') || 'default',
  setCurrentTheme: (theme) => {
    localStorage.setItem('theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    set({ currentTheme: theme, isThemeDropdownOpen: false });
  },

  isMaximized: false,
  setIsMaximized: (maximized) => set({ isMaximized: maximized }),

  isDragging: false,
  setIsDragging: (dragging) => set({ isDragging: dragging }),

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
}));