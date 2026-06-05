import React, { useEffect } from 'react';
import { navigateToSource } from '../utils/helpers';

declare global {
  interface Window {
    ipcRenderer: {
      on: (channel: string, listener: (...args: any[]) => void) => void;
      off: (channel: string, listener: (...args: any[]) => void) => void;
      send: (channel: string, ...args: any[]) => void;
      invoke: (channel: string, ...args: any[]) => Promise<any>;
      once: (channel: string, listener: (...args: any[]) => void) => void;
      removeListener: (channel: string, listener: (...args: any[]) => void) => void;
      removeAllListeners: (channel: string) => void;
    };
  }
}

interface AppProvidersProps {
  children: React.ReactNode;
  setActiveTab: (tab: any) => void;
  setDeskDefaultTab: (tab: any) => void;
  setSourceNoteToOpen: (val: any) => void;
  setIsGlobalSearchOpen: (fn: (prev: boolean) => boolean) => void;
}

const AppProviders: React.FC<AppProvidersProps> = ({
  children,
  setActiveTab,
  setDeskDefaultTab,
  setSourceNoteToOpen,
  setIsGlobalSearchOpen,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsGlobalSearchOpen(prev => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        if (e.shiftKey) {
          setActiveTab('chat');
        } else {
          setActiveTab('desk');
          setDeskDefaultTab('notes');
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key >= '1' && e.key <= '5') {
        e.preventDefault();
        const tabs = ['chat', 'knowledge', 'desk', 'tasks', 'schedule'];
        const idx = parseInt(e.key) - 1;
          if (idx >= 0 && idx < tabs.length) {
            setActiveTab(tabs[idx] as string);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveTab, setDeskDefaultTab]);

  useEffect(() => {
    const handleNavigateToSource = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.type && detail?.id) {
        navigateToSource(detail.type, detail.id, {
          setActiveTab: setActiveTab as (tab: string) => void,
          setDeskDefaultTab: setDeskDefaultTab as (tab: string) => void,
          setSourceNoteToOpen: setSourceNoteToOpen as (val: { type: string; id: string }) => void,
        });
      }
    };
    window.addEventListener('navigate-to-source', handleNavigateToSource);
    return () => window.removeEventListener('navigate-to-source', handleNavigateToSource);
  }, []);

  return <>{children}</>;
};

export default AppProviders;