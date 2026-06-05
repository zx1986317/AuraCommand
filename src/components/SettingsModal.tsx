import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings, Monitor, Cpu, Database, FolderOpen, ShieldCheck, ChevronRight, Cable, Globe } from 'lucide-react';
import GeneralTab from './settings/GeneralTab';
import AiTab from './settings/AiTab';
import StorageTab from './settings/StorageTab';
import DataTab from './settings/DataTab';
import McpTab from './settings/McpTab';
import WebSearchTab from './settings/WebSearchTab';
import type { VaultStats, OllamaReadiness } from './settings/SettingsTypes';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentModel: string;
  onModelChange: (model: string) => void;
  availableModels: string[];
  vaultPath: string;
  vaultStats?: VaultStats;
  ollamaStatus?: OllamaReadiness | null;
  activeIndexingCount?: number;
  isSearchEnabled: boolean;
  onSearchEnabledChange: (enabled: boolean) => void;
  searxngUrl: string;
  onSearxngUrlChange: (url: string) => void;
  showReasoningProcess: boolean;
  onShowReasoningProcessChange: (enabled: boolean) => void;
  onVaultSwitched?: (newPath: string) => Promise<void> | void;
  onOpenOnboarding?: () => void;
  onCloudModelsChanged?: () => void;
  chatContextLength?: number;
  onChatContextLengthChange?: (length: number) => void;
}

const tabs = [
  { id: 'general', label: '通用设置', icon: Monitor },
  { id: 'ai', label: 'AI 模型', icon: Cpu },
  { id: 'websearch', label: '联网搜索', icon: Globe },
  { id: 'storage', label: '存储与库', icon: Database },
  { id: 'data', label: '数据管理', icon: ShieldCheck },
  { id: 'mcp', label: 'MCP 服务', icon: Cable },
];

type TabId = 'general' | 'ai' | 'websearch' | 'storage' | 'data' | 'mcp';

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentModel,
  onModelChange,
  availableModels,
  vaultPath,
  vaultStats,
  ollamaStatus,
  activeIndexingCount = 0,
  isSearchEnabled,
  onSearchEnabledChange,
  searxngUrl,
  onSearxngUrlChange,
  showReasoningProcess,
  onShowReasoningProcessChange,
  onVaultSwitched,
  onOpenOnboarding,
  onCloudModelsChanged,
  chatContextLength,
  onChatContextLengthChange,
}) => {
  const [activeTab, setActiveTab] = useState<TabId>('general');

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-teal-900/40 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="relative w-[1100px] max-w-[95vw] h-[80vh] bg-white rounded-[2rem] shadow-2xl overflow-hidden flex border border-teal-900/5"
          >
            <div className="w-64 bg-teal-900/5 border-r border-teal-900/5 p-8 flex flex-col">
              <div className="flex items-center gap-3 mb-10 px-2">
                <div className="w-10 h-10 rounded-2xl bg-accent/10 flex items-center justify-center text-accent">
                  <Settings size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">系统设置</h2>
                  <p className="text-2xs font-mono text-muted uppercase tracking-widest">Settings</p>
                </div>
              </div>

              <nav className="space-y-2 flex-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as TabId)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all ${
                        activeTab === tab.id
                          ? 'bg-white text-accent shadow-sm'
                          : 'text-muted hover:text-foreground hover:bg-white/50'
                      }`}
                    >
                      <Icon size={18} />
                      <span>{tab.label}</span>
                      {activeTab === tab.id && <ChevronRight size={14} className="ml-auto" />}
                    </button>
                  );
                })}
              </nav>

              <div className="mt-auto pt-6 border-t border-teal-900/5 px-2">
                <p className="text-2xs text-muted font-medium">AuraCommand v1.0.0</p>
                <p className="text-2xs text-muted/50 mt-1">本地 AI 驱动的指挥座舱</p>
              </div>
            </div>

            <div className="flex-1 flex flex-col min-w-0 bg-white">
              <div className="flex items-center justify-between px-10 py-8 border-b border-teal-900/5">
                <h3 className="text-xl font-bold text-foreground">
                  {tabs.find(t => t.id === activeTab)?.label}
                </h3>
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl hover:bg-teal-900/5 text-muted transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
                {activeTab === 'general' && <GeneralTab onOpenOnboarding={onOpenOnboarding} />}
                {activeTab === 'ai' && (
                  <AiTab
                    currentModel={currentModel}
                    onModelChange={onModelChange}
                    availableModels={availableModels}
                    ollamaStatus={ollamaStatus}
                    vaultStats={vaultStats}
                    activeIndexingCount={activeIndexingCount}
                    showReasoningProcess={showReasoningProcess}
                    onShowReasoningProcessChange={onShowReasoningProcessChange}
                    onCloudModelsChanged={onCloudModelsChanged}
                    chatContextLength={chatContextLength ?? 10}
                    onChatContextLengthChange={onChatContextLengthChange ?? (() => {})}
                  />
                )}
                {activeTab === 'websearch' && (
                  <WebSearchTab
                    isSearchEnabled={isSearchEnabled}
                    onSearchEnabledChange={onSearchEnabledChange}
                    searxngUrl={searxngUrl}
                    onSearxngUrlChange={onSearxngUrlChange}
                  />
                )}
                {activeTab === 'storage' && (
                  <StorageTab vaultPath={vaultPath} vaultStats={vaultStats} onVaultSwitched={onVaultSwitched} />
                )}
                {activeTab === 'data' && <DataTab />}
                {activeTab === 'mcp' && <McpTab vaultPath={vaultPath} />}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default SettingsModal;
