import React from 'react';
import { motion } from 'framer-motion';
import { Search, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import WindowControls from '../components/WindowControls';

interface AiStatusInfo {
  tone: 'ready' | 'warning' | 'error' | 'checking';
  label: string;
  hint: string;
}

interface AppLayoutProps {
  activeTab: string;
  selectedModel: string;
  availableModels: any[];
  isAIProcessing: boolean;
  ollamaStatus: any;
  isMaximized: boolean;
  aiStatus: AiStatusInfo;
  AuraLogo: React.FC;
  onTabChange: (tab: string) => void;
  onOpenSettings: () => void;
  onOpenGlobalSearch: () => void;
  onOpenWeeklyDigest: () => void;
  children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({
  activeTab,
  selectedModel,
  availableModels,
  isAIProcessing,
  ollamaStatus,
  isMaximized,
  aiStatus,
  AuraLogo,
  onTabChange,
  onOpenSettings,
  onOpenGlobalSearch,
  onOpenWeeklyDigest,
  children,
}) => {
  return (
    <div
      className="h-screen bg-background text-foreground flex font-sans overflow-hidden selection:bg-accent/30 selection:text-accent"
      onScroll={(e) => {
        (e.target as HTMLElement).scrollTop = 0;
      }}
    >
      <Sidebar
        activeTab={activeTab}
        selectedModel={selectedModel}
        availableModels={availableModels}
        isAIProcessing={isAIProcessing}
        ollamaStatus={ollamaStatus?.connected ? 'online' : ollamaStatus ? 'offline' : null}
        onTabChange={(tab: string) => onTabChange(tab)}
        onOpenSettings={onOpenSettings}
        onOpenWeeklyDigest={onOpenWeeklyDigest}
        AuraLogo={AuraLogo}
      />

      <main
        className="flex-1 min-h-0 flex flex-col relative overflow-hidden bg-background"
        onScroll={(e) => {
          (e.target as HTMLElement).scrollTop = 0;
        }}
      >
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/5 blur-[120px] rounded-full pointer-events-none z-0"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[30%] h-[30%] bg-blue-500/5 blur-[100px] rounded-full pointer-events-none z-0"></div>

        {ollamaStatus && !ollamaStatus.connected && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-amber-50 border-b border-amber-200 px-6 py-2 flex items-center gap-3 z-50"
          >
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
            <span className="text-xs font-medium text-amber-800">
              AI 引擎未连接 — 便签、日程等基础功能正常使用，AI 对话和知识检索需要启动 Ollama
            </span>
            <span className="text-2xs text-amber-600 font-mono ml-auto">
              {ollamaStatus.error || '请在终端运行 ollama serve'}
            </span>
          </motion.div>
        )}

        {ollamaStatus && ollamaStatus.connected && !ollamaStatus.chatModelReady && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-blue-50 border-b border-blue-200 px-6 py-2 flex items-center gap-3 z-50"
          >
            <div className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
            <span className="text-xs font-medium text-blue-800">
              Ollama 已连接，但未检测到对话模型 — 请先在设置中安装至少一个本地对话模型
            </span>
          </motion.div>
        )}

        {ollamaStatus && ollamaStatus.connected && !ollamaStatus.embeddingModelReady && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-orange-50 border-b border-orange-200 px-6 py-2 flex items-center gap-3 z-50"
          >
            <div className="w-2 h-2 rounded-full bg-orange-400 shrink-0" />
            <span className="text-xs font-medium text-orange-800">
              向量模型未就绪 — 知识库检索和 RAG 增强功能暂不可用，请先安装至少一个本地嵌入模型
            </span>
          </motion.div>
        )}

        <header
          onDoubleClick={() => window.ipcRenderer.invoke('window-max')}
          className="h-16 shrink-0 border-b border-teal-900/5 flex items-center px-8 drag z-[999] backdrop-blur-md bg-white/30"
        >
          <div className="flex items-center gap-4 no-drag">
            <div className="text-2xs font-mono text-muted uppercase tracking-[0.3em] flex items-center gap-2">
              <span className="opacity-30">根目录</span>
              <span className="text-teal-900/20">/</span>
              <span className="text-accent/80 font-bold">
                {activeTab === 'dashboard' ? '工作台' :
                 activeTab === 'kb' ? '知识库' :
                 activeTab === 'desk' ? '书桌' :
                 activeTab === 'documents' ? '文档' :
                 activeTab === 'tasks' ? '待办板' :
                 activeTab === 'workflows' ? '工作流' :
                 activeTab === 'memory' ? '记忆' : '待办'}
              </span>
            </div>
          </div>

          <div className="flex-1 flex justify-center px-12 no-drag">
             <div className="relative w-full max-w-lg group cursor-pointer" onClick={onOpenGlobalSearch}>
                <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-accent transition-colors" />
                <div
                  className="w-full bg-white/40 border border-teal-900/5 rounded-2xl py-2 pl-11 pr-20 text-xs text-teal-900/20 shadow-glass hover:bg-white/60 transition-all"
                >
                  搜索便签、知识库、日程、待办...
                </div>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-teal-900/5 rounded text-xs font-mono text-muted">Ctrl</kbd>
                  <kbd className="px-1.5 py-0.5 bg-teal-900/5 rounded text-xs font-mono text-muted">K</kbd>
                </div>
             </div>
          </div>
          <div className="ml-6 flex items-center gap-3 no-drag">
            <button
              onClick={onOpenSettings}
              className={`hidden xl:flex items-center gap-2 px-3 py-2 rounded-2xl border text-2xs font-bold tracking-[0.18em] uppercase transition-all ${
                aiStatus.tone === 'ready'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : aiStatus.tone === 'error'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : aiStatus.tone === 'checking'
                      ? 'bg-slate-50 text-slate-600 border-slate-200'
                      : 'bg-blue-50 text-blue-700 border-blue-200'
              }`}
              title={aiStatus.hint}
            >
              {aiStatus.tone === 'ready' ? <CheckCircle2 size={12} /> : aiStatus.tone === 'checking' ? <Loader2 size={12} className="animate-spin" /> : <AlertCircle size={12} />}
              <span>{aiStatus.label}</span>
            </button>
            <WindowControls isMaximized={isMaximized} />
          </div>
        </header>

        <div
          className="flex-1 relative z-10 min-h-0 overflow-y-auto p-12 pt-20 custom-scrollbar"
        >
          {children}
        </div>
      </main>
    </div>
  );
};

export default AppLayout;