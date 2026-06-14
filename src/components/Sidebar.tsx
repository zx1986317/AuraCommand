import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BrainCircuit, FileText, CheckSquare, Database,
  Settings, LayoutDashboard, BookOpen,
  StickyNote, Zap, MessageSquare, Sparkles,
  FolderKanban, ChevronDown, Plus, MoreHorizontal
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { ipcService } from '../services/ipc';
import { useTranslation } from '../i18n/I18nContext';

interface SidebarProps {
  activeTab: string;
  selectedModel: string;
  availableModels: string[];
  isAIProcessing: boolean;
  ollamaStatus: 'online' | 'offline' | 'checking' | null;
  onTabChange: (tab: string) => void;
  onOpenSettings: () => void;
  onOpenWeeklyDigest: () => void;
  AuraLogo: React.FC;
}

const Sidebar: React.FC<SidebarProps> = ({
  activeTab, selectedModel, availableModels,
  isAIProcessing, ollamaStatus,
  onTabChange, onOpenSettings, onOpenWeeklyDigest, AuraLogo
}) => {
  const { t } = useTranslation();
  const toolTabs = [
    { id: 'workflows', label: t('sidebar.tab.workflows'), icon: Zap },
    { id: 'memory', label: t('sidebar.tab.memory'), icon: BrainCircuit },
  ];

  const {
    currentProjectName,
    setCurrentProjectName,
    projects,
    setProjects,
    addProjectLocal,
    removeProjectLocal,
    renameProjectLocal,
    setNotification,
    setModalConfig,
  } = useAppStore();
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);

  useEffect(() => {
    if (window.ipcRenderer) {
      window.ipcRenderer.invoke('list-projects').then((result: any) => {
        if (Array.isArray(result)) setProjects(result);
      }).catch(() => {});
    }
  }, [setProjects]);

  const handleProjectSelect = (name: string | null) => {
    setCurrentProjectName(name);
    setProjectDropdownOpen(false);
  };

  const openCreateProjectModal = () => {
    setModalConfig({
      isOpen: true,
      title: t('sidebar.project.create'),
      message: t('sidebar.project.createHint'),
      inputDefaultValue: '',
      onConfirm: async (inputValue) => {
        if (!inputValue?.trim()) return
        try {
          await ipcService.projects.create(inputValue.trim())
          addProjectLocal(inputValue.trim())
          setCurrentProjectName(inputValue.trim())
          setNotification({ message: t('sidebar.project.created', { name: inputValue.trim() }), type: 'success' })
        } catch (err: any) {
          setNotification({ message: t('sidebar.project.createFailed', { message: err.message }), type: 'error' })
        }
      },
    });
  };

  const openRenameProjectModal = () => {
    setProjectMenuOpen(false);
    setProjectDropdownOpen(false);
    if (!currentProjectName) return;
    setModalConfig({
      isOpen: true,
      title: t('sidebar.project.rename'),
      message: t('sidebar.project.renameHint'),
      inputDefaultValue: currentProjectName,
      onConfirm: async (inputValue) => {
        if (!inputValue?.trim() || inputValue === currentProjectName) return
        try {
          await ipcService.projects.rename(currentProjectName, inputValue.trim())
          renameProjectLocal(currentProjectName, inputValue.trim())
          setCurrentProjectName(inputValue.trim())
          setNotification({ message: t('sidebar.project.renamed'), type: 'success' })
        } catch (err: any) {
          setNotification({ message: t('sidebar.project.renameFailed', { message: err.message }), type: 'error' })
        }
      },
    });
  };

  const openDeleteProjectModal = () => {
    setProjectMenuOpen(false);
    setProjectDropdownOpen(false);
    if (!currentProjectName) return;
    setModalConfig({
      isOpen: true,
      title: t('sidebar.project.delete'),
      message: t('sidebar.project.deleteHint', { name: currentProjectName }),
      onConfirm: async () => {
        try {
          await ipcService.projects.delete(currentProjectName)
          removeProjectLocal(currentProjectName)
          setCurrentProjectName(null)
          setNotification({ message: t('sidebar.project.deleted'), type: 'success' })
        } catch (err: any) {
          setNotification({ message: t('sidebar.project.deleteFailed', { message: err.message }), type: 'error' })
        }
      },
    });
  };

  const projectMainTabs = [
    { id: 'dashboard', label: t('sidebar.tab.dashboard'), icon: LayoutDashboard },
    { id: 'chat', label: t('sidebar.tab.chat'), icon: MessageSquare },
    { id: 'desk', label: t('sidebar.tab.desk'), icon: BookOpen, desc: t('sidebar.tab.deskDesc') },
    { id: 'tasks', label: t('sidebar.tab.tasks'), icon: CheckSquare },
    { id: 'kb', label: t('sidebar.tab.kb'), icon: Database },
  ];

  const defaultMainTabs = [
    { id: 'dashboard', label: t('sidebar.tab.workbench'), icon: LayoutDashboard },
    { id: 'chat', label: t('sidebar.tab.chat'), icon: MessageSquare },
    { id: 'kb', label: t('sidebar.tab.shelf'), icon: Database, desc: t('sidebar.tab.shelfDesc') },
    { id: 'desk', label: t('sidebar.tab.deskArea'), icon: BookOpen, desc: t('sidebar.tab.deskDesc') },
    { id: 'tasks', label: t('sidebar.tab.taskBoard'), icon: CheckSquare },
  ];

  const mainTabs = currentProjectName ? projectMainTabs : defaultMainTabs;

  return (
    <aside className="w-64 bg-white/40 backdrop-blur-xl border-r border-teal-900/5 flex flex-col z-20">
      <div className="h-20 flex items-center px-6 gap-3">
        <AuraLogo />
        <div className="flex flex-col">
          <span className="font-display font-bold text-xl tracking-tight bg-gradient-to-r from-teal-900 to-teal-900/40 bg-clip-text text-transparent">AURA</span>
          <span className="text-xs font-mono text-accent tracking-[0.2em] uppercase">{t('sidebar.brand.subtitle')}</span>
        </div>
      </div>

      <div className="px-4 pb-2">
        <div className="relative">
          <div
            role="button"
            tabIndex={0}
            onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setProjectDropdownOpen(!projectDropdownOpen); }}
            className={`w-full flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium transition-all border cursor-pointer ${
              currentProjectName
                ? 'bg-accent/10 text-accent border-accent/20'
                : 'bg-white/40 text-muted border-teal-900/5 hover:border-teal-900/10 hover:text-foreground'
            }`}
          >
            <FolderKanban size={14} className={currentProjectName ? 'text-accent' : 'text-muted'} />
            <span className="flex-1 text-left truncate ml-1">{currentProjectName || t('sidebar.project.choose')}</span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); openCreateProjectModal(); }}
              className="p-1 rounded-md hover:bg-accent/10 text-muted hover:text-accent transition-colors"
              title={t('sidebar.project.create')}
            >
              <Plus size={14} />
            </button>
            <button
              type="button"
              disabled={!currentProjectName}
              onClick={(e) => { e.stopPropagation(); if (currentProjectName) setProjectMenuOpen(!projectMenuOpen); }}
              className={`p-1 rounded-md transition-colors ${
                currentProjectName
                  ? 'hover:bg-accent/10 text-muted hover:text-accent'
                  : 'opacity-50 cursor-not-allowed'
              }`}
              title={currentProjectName ? t('sidebar.project.moreActions') : t('sidebar.project.chooseFirst')}
            >
              <MoreHorizontal size={14} />
            </button>
            <ChevronDown size={12} className={`transition-transform ${projectDropdownOpen ? 'rotate-180' : ''}`} />
          </div>
          {projectMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setProjectMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50 min-w-[100px]">
                <button
                  onClick={openRenameProjectModal}
                  className="w-full px-3 py-1.5 text-xs text-left text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  {t('sidebar.project.rename')}
                </button>
                <button
                  onClick={openDeleteProjectModal}
                  className="w-full px-3 py-1.5 text-xs text-left text-red-600 hover:bg-red-50 transition-colors"
                >
                  {t('common.delete')}
                </button>
              </div>
            </>
          )}
          {projectDropdownOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setProjectDropdownOpen(false)} />
              <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
                <button
                  onClick={() => handleProjectSelect(null)}
                  className={`w-full px-3 py-1.5 text-xs text-left transition-colors ${!currentProjectName ? 'text-accent font-semibold bg-accent/5' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  {t('sidebar.project.allContent')}
                </button>
                {projects.length > 0 && <div className="border-t border-gray-100 my-1" />}
                {projects.map(p => (
                  <button
                    key={p}
                    onClick={() => handleProjectSelect(p)}
                    className={`w-full px-3 py-1.5 text-xs text-left transition-colors ${currentProjectName === p ? 'text-accent font-semibold bg-accent/5' : 'text-gray-700 hover:bg-gray-50'}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-2">
        <div className="text-2xs font-bold text-muted uppercase tracking-[0.2em] px-3 mb-4">
          {currentProjectName ? t('sidebar.section.project', { name: currentProjectName }) : t('sidebar.section.core')}
        </div>
        {mainTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative ${isActive ? 'bg-accent/5 text-accent shadow-glass' : 'text-muted hover:text-foreground hover:bg-teal-900/5'}`}
            >
              <Icon size={18} className={isActive ? 'text-accent' : 'group-hover:text-accent transition-colors'} />
              <div className="flex flex-col text-left">
                <span>{tab.label}</span>
                {tab.desc && <span className="text-2xs text-muted font-normal">{tab.desc}</span>}
              </div>
              {isActive && <motion.div layoutId="activeTab" className="absolute left-0 w-1 h-6 bg-accent rounded-r-full" />}
            </button>
          );
        })}

        <div className="pt-4">
          <div className="text-2xs font-bold text-muted uppercase tracking-[0.2em] px-3 mb-4">{t('sidebar.section.tools')}</div>
          {toolTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative mb-0.5 ${isActive ? 'bg-accent/5 text-accent shadow-glass' : 'text-muted hover:text-foreground hover:bg-teal-900/5'}`}
              >
                <Icon size={18} className={isActive ? 'text-accent' : 'group-hover:text-accent transition-colors'} />
                <span>{tab.label}</span>
                {isActive && <motion.div layoutId="activeTab" className="absolute left-0 w-1 h-6 bg-accent rounded-r-full" />}
              </button>
            );
          })}
        </div>

        <div className="pt-4">
          <div className="text-2xs font-bold text-muted uppercase tracking-[0.2em] px-3 mb-4">{t('sidebar.section.smart')}</div>
          <button
            onClick={onOpenWeeklyDigest}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all group bg-gradient-to-r from-amber-50/50 to-teal-50/50 hover:from-amber-100/50 hover:to-teal-100/50 border border-amber-100/50 hover:border-amber-200/80 text-gray-600 hover:text-amber-600"
          >
            <Sparkles size={16} className="text-amber-400 group-hover:text-amber-500 transition-colors" />
            <div className="flex flex-col text-left">
              <span>{t('sidebar.weeklyDigest.title')}</span>
              <span className="text-2xs text-muted font-normal">{t('sidebar.weeklyDigest.subtitle')}</span>
            </div>
          </button>
        </div>

        <div className="pt-4">
          <div className="text-2xs font-bold text-muted uppercase tracking-[0.2em] px-3 mb-4">{t('sidebar.section.system')}</div>
          <button
            onClick={onOpenSettings}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-muted hover:text-foreground hover:bg-teal-900/5 transition-all group"
          >
            <Settings size={18} className="group-hover:rotate-45 transition-transform" />
            <span>{t('sidebar.tab.settings')}</span>
          </button>
        </div>
      </nav>

      <div className="p-4 space-y-3">
        <div className="relative bg-white/40 border border-teal-900/5 p-4 rounded-2xl space-y-3 shadow-glass group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-accent/5 blur-3xl rounded-full -mr-12 -mt-12 group-hover:bg-accent/10 transition-colors" />
          <div className="flex justify-between items-center relative z-10">
            <span className="text-2xs font-bold text-accent uppercase tracking-widest">{t('sidebar.engine.ollama')}</span>
            <div className={`w-2 h-2 rounded-full ${ollamaStatus === 'online' ? 'bg-green-500' : ollamaStatus === 'offline' ? 'bg-gray-400' : 'bg-accent animate-pulse shadow-[0_0_10px_rgba(13,148,136,0.5)]'}`} />
          </div>
          <button
            onClick={() => onTabChange('chat')}
            className="w-full relative z-10 flex items-center gap-2 px-2 py-1.5 bg-white/50 border border-teal-900/5 rounded-xl hover:bg-white/80 transition-all text-left"
          >
            <div className="flex flex-col min-w-0 flex-1">
              <p className="text-2xs font-bold text-foreground truncate">{selectedModel || t('sidebar.engine.noModel')}</p>
              <p className="text-2xs text-muted font-mono">{t('sidebar.engine.status', { status: isAIProcessing ? t('sidebar.engine.processing') : ollamaStatus === 'online' ? t('sidebar.engine.online') : ollamaStatus === 'offline' ? t('sidebar.engine.offline') : t('sidebar.engine.checking') })}</p>
            </div>
            <MessageSquare size={12} className="text-muted" />
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
