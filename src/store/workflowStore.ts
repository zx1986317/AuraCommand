import { create } from 'zustand';

export interface WorkflowState {
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
}

export const useWorkflowStore = create<WorkflowState>((set) => ({
  selectedDate: new Date(),
  setSelectedDate: (date) => set({ selectedDate: date }),
}));
