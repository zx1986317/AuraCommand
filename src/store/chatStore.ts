import { create } from 'zustand';

export interface ChatState {
  isAIProcessing: boolean;
  setIsAIProcessing: (processing: boolean) => void;

  isRAGEnabled: boolean;
  setIsRAGEnabled: (enabled: boolean) => void;

  chatNetworkMode: 'off' | 'direct';
  setChatNetworkMode: (mode: 'off' | 'direct') => void;

  showReasoningProcess: boolean;
  setShowReasoningProcess: (enabled: boolean) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  isAIProcessing: false,
  setIsAIProcessing: (processing) => set({ isAIProcessing: processing }),

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

  showReasoningProcess: localStorage.getItem('showReasoningProcess') !== 'false',
  setShowReasoningProcess: (enabled) => {
    localStorage.setItem('showReasoningProcess', String(enabled));
    set({ showReasoningProcess: enabled });
  },
}));