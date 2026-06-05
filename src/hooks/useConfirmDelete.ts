import { useState, useCallback } from 'react';

interface ConfirmState {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
}

export function useConfirmDelete() {
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const requestConfirm = useCallback((opts: { title?: string; message: string; onConfirm: () => void }) => {
    setConfirmState({
      isOpen: true,
      title: opts.title || '确认删除',
      message: opts.message,
      onConfirm: opts.onConfirm,
    });
  }, []);

  const handleConfirm = useCallback(() => {
    confirmState.onConfirm();
    setConfirmState(prev => ({ ...prev, isOpen: false }));
  }, [confirmState.onConfirm]);

  const handleCancel = useCallback(() => {
    setConfirmState(prev => ({ ...prev, isOpen: false }));
  }, []);

  return {
    confirmState,
    requestConfirm,
    handleConfirm,
    handleCancel,
  };
}
