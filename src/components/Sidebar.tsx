import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BrainCircuit, FileText, CheckSquare, Database,
  Settings, LayoutDashboard, BookOpen,
  StickyNote, Zap, MessageSquare, Sparkles
} from 'lucide-react';

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
  const mainTabs = [
    { id: 'dashboard', label: '工作台', icon: LayoutDashboard },
    { id: 'chat', label: '对话', icon: MessageSquare },
    { id: 'kb', label: '书架', icon: Database, desc: '知识库' },
    { id: 'desk', label: '书桌', icon: BookOpen, desc: '文档 · 便签' },
    { id: 'tasks', label: '待办板', icon: CheckSquare },
  ];

  const toolTabs = [
    { id: 'workflows', label: '工作流', icon: Zap },
  ];

  return (
    <aside className="w-64 bg-white/40 backdrop-blur-xl border-r border-teal-900/5 flex flex-col z-20">
      <div className="h-20 flex items-center px-6 gap-3">
        <AuraLogo />
        <div className="flex flex-col">
          <span className="font-display font-bold text-xl tracking-tight bg-gradient-to-r from-teal-900 to-teal-900/40 bg-clip-text text-transparent">AURA</span>
          <span className="text-xs font-mono text-accent tracking-[0.2em] uppercase">指令中心</span>
        </div>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-2">
        <div className="text-2xs font-bold text-muted uppercase tracking-[0.2em] px-3 mb-4">核心</div>
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
          <div className="text-2xs font-bold text-muted uppercase tracking-[0.2em] px-3 mb-4">工具</div>
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
          <div className="text-2xs font-bold text-muted uppercase tracking-[0.2em] px-3 mb-4">智能</div>
          <button
            onClick={onOpenWeeklyDigest}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all group bg-gradient-to-r from-amber-50/50 to-teal-50/50 hover:from-amber-100/50 hover:to-teal-100/50 border border-amber-100/50 hover:border-amber-200/80 text-gray-600 hover:text-amber-600"
          >
            <Sparkles size={16} className="text-amber-400 group-hover:text-amber-500 transition-colors" />
            <div className="flex flex-col text-left">
              <span>AI 周回顾</span>
              <span className="text-2xs text-muted font-normal">你这周的记录摘要</span>
            </div>
          </button>
        </div>

        <div className="pt-4">
          <div className="text-2xs font-bold text-muted uppercase tracking-[0.2em] px-3 mb-4">系统</div>
          <button
            onClick={onOpenSettings}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-muted hover:text-foreground hover:bg-teal-900/5 transition-all group"
          >
            <Settings size={18} className="group-hover:rotate-45 transition-transform" />
            <span>系统设置</span>
          </button>
        </div>
      </nav>

      <div className="p-4 space-y-3">
        <div className="relative bg-white/40 border border-teal-900/5 p-4 rounded-2xl space-y-3 shadow-glass group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-accent/5 blur-3xl rounded-full -mr-12 -mt-12 group-hover:bg-accent/10 transition-colors" />
          <div className="flex justify-between items-center relative z-10">
            <span className="text-2xs font-bold text-accent uppercase tracking-widest">Ollama 引擎</span>
            <div className={`w-2 h-2 rounded-full ${ollamaStatus === 'online' ? 'bg-green-500' : ollamaStatus === 'offline' ? 'bg-gray-400' : 'bg-accent animate-pulse shadow-[0_0_10px_rgba(13,148,136,0.5)]'}`} />
          </div>
          <button
            onClick={() => onTabChange('chat')}
            className="w-full relative z-10 flex items-center gap-2 px-2 py-1.5 bg-white/50 border border-teal-900/5 rounded-xl hover:bg-white/80 transition-all text-left"
          >
            <div className="flex flex-col min-w-0 flex-1">
              <p className="text-2xs font-bold text-foreground truncate">{selectedModel || '未选择模型'}</p>
              <p className="text-2xs text-muted font-mono">状态: {isAIProcessing ? '处理中...' : ollamaStatus === 'online' ? '在线' : ollamaStatus === 'offline' ? '离线' : '检测中'}</p>
            </div>
            <MessageSquare size={12} className="text-muted" />
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
