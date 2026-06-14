import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useTranslation } from '../i18n/I18nContext';

interface NotificationToastProps {
  notification: { message: string; type: 'info' | 'error' | 'warning' | 'success' } | null;
  onClose?: () => void;
}

const NotificationToast: React.FC<NotificationToastProps> = ({ notification, onClose }) => {
  const { t } = useTranslation();
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (notification && onClose) {
      const duration = notification.type === 'error' ? 6000 : 4000;
      timerRef.current = setTimeout(() => {
        onClose();
      }, duration);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [notification, onClose]);

  const typeConfig = {
    info: {
      bg: 'bg-accent',
      border: 'border-accent',
      text: 'text-white',
      iconBg: 'bg-white/20',
      icon: <Zap size={22} className="fill-white animate-pulse" />,
      label: t('toast.label.info'),
      shadow: 'shadow-[0_20px_60px_rgba(13,148,136,0.5)]',
    },
    error: {
      bg: 'bg-red-600',
      border: 'border-red-400',
      text: 'text-white',
      iconBg: 'bg-white/20',
      icon: <X size={22} />,
      label: t('toast.label.error'),
      shadow: 'shadow-[0_20px_60px_rgba(220,38,38,0.5)]',
    },
    warning: {
      bg: 'bg-orange-500',
      border: 'border-orange-300',
      text: 'text-white',
      iconBg: 'bg-white/20',
      icon: <AlertCircle size={22} />,
      label: t('toast.label.warning'),
      shadow: 'shadow-[0_20px_60px_rgba(249,115,22,0.5)]',
    },
    success: {
      bg: 'bg-green-600',
      border: 'border-green-400',
      text: 'text-white',
      iconBg: 'bg-white/20',
      icon: <CheckCircle2 size={22} />,
      label: t('toast.label.success'),
      shadow: 'shadow-[0_20px_60px_rgba(22,163,74,0.5)]',
    },
  };

  const config = typeConfig[notification?.type || 'info'];

  return (
    <AnimatePresence>
      {notification && (
        <motion.div
          initial={{ opacity: 0, y: -60, x: '-50%', scale: 0.9 }}
          animate={{ opacity: 1, y: 0, x: '-50%', scale: 1 }}
          exit={{ opacity: 0, y: -60, x: '-50%', scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className={`fixed top-8 left-1/2 z-[100] px-8 py-4 rounded-2xl ${config.shadow} ${config.bg} ${config.border} border-2 ${config.text}`}
        >
          <div className="flex items-center gap-4">
            <div className={`p-2.5 rounded-xl ${config.iconBg}`}>
              {config.icon}
            </div>
            <div className="flex flex-col">
              <span className="text-2xs font-black uppercase tracking-[0.2em] opacity-90">
                {config.label}
              </span>
              <span className="text-base font-black tracking-tight mt-0.5">{notification.message}</span>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="ml-4 p-2 rounded-xl hover:bg-white/20 transition-colors"
                title={t('common.close')}
              >
                <X size={18} />
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default NotificationToast;
