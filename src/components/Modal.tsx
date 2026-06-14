import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, HelpCircle, X } from 'lucide-react';
import { useTranslation } from '../i18n/I18nContext';

interface ModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  type?: 'confirm' | 'alert';
  onConfirm: (inputValue?: string) => void;
  onCancel: () => void;
  inputDefaultValue?: string | undefined;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  title,
  message,
  type = 'confirm',
  onConfirm,
  onCancel,
  inputDefaultValue,
}) => {
  const { t } = useTranslation();
  const isInputMode = inputDefaultValue !== undefined;
  const [inputValue, setInputValue] = useState(inputDefaultValue || '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && isInputMode) {
      setInputValue(inputDefaultValue || '');
      setTimeout(() => inputRef.current?.select(), 50);
    }
  }, [isOpen, inputDefaultValue]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="absolute inset-0 bg-teal-900/20 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-white/90 backdrop-blur-2xl border border-teal-900/10 rounded-[2.5rem] shadow-premium p-8 overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 blur-3xl rounded-full -mr-16 -mt-16"></div>

            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-6">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${type === 'confirm' ? 'bg-amber-500/10 text-amber-500' : 'bg-accent/10 text-accent'}`}>
                  {type === 'confirm' ? <HelpCircle size={24} /> : <AlertCircle size={24} />}
                </div>
                <div>
                  <h3 className="text-xl font-display font-bold text-foreground">{title}</h3>
                  <p className="text-2xs font-mono text-muted uppercase tracking-widest mt-0.5">{t('modal.systemConfirm')}</p>
                </div>
                <button
                  onClick={onCancel}
                  className="ml-auto p-2 rounded-xl hover:bg-teal-900/5 text-muted transition-colors"
                  aria-label={t('common.close')}
                >
                  <X size={18} />
                </button>
              </div>

              <p className="text-sm text-muted font-medium leading-relaxed mb-4">
                {message}
              </p>

              {isInputMode && (
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onConfirm(inputValue);
                  }}
                  className="w-full px-4 py-2.5 mb-4 bg-white border border-teal-900/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
              )}

              <div className="flex gap-3">
                {type === 'confirm' && (
                  <button
                    onClick={onCancel}
                    className="flex-1 px-6 py-3 rounded-2xl text-sm font-bold text-muted hover:text-foreground hover:bg-teal-900/5 transition-all"
                  >
                    {t('common.cancel')}
                  </button>
                )}
                <button
                  onClick={() => onConfirm(isInputMode ? inputValue : undefined)}
                  className={`flex-1 px-6 py-3 rounded-2xl text-sm font-bold text-white shadow-lg transition-all active:scale-95 ${
                    type === 'confirm' ? 'bg-amber-500 shadow-amber-500/20 hover:bg-amber-600' : 'bg-accent shadow-accent/20 hover:bg-accent/90'
                  }`}
                >
                  {t('common.confirm')}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default Modal;
