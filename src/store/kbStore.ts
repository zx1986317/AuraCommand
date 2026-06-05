import { create } from 'zustand';
import type { IndexingTask } from './types';

export interface KBState {
  indexingFiles: Record<string, IndexingTask>;
  setIndexingFiles: (files: Record<string, IndexingTask>) => void;
  updateIndexingFile: (id: string, task: Partial<IndexingTask>) => void;
  removeIndexingFile: (id: string) => void;

  kbFilter: 'all' | 'indexed' | 'pending';
  setKbFilter: (filter: 'all' | 'indexed' | 'pending') => void;

  kbSort: 'newest' | 'largest';
  setKbSort: (sort: 'newest' | 'largest') => void;
}

export const useKBStore = create<KBState>((set) => ({
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
}));