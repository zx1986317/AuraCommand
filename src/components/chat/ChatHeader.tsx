import React from 'react';
import {
  Database, Globe, ChevronDown, Check, Download,
  RotateCcw, PanelLeftClose, PanelLeftOpen, FileDown, Undo2
} from 'lucide-react';
import { getModelInfo } from '../../config/modelConfig';
import { useMcpServers } from '../../hooks/useMcpServers';
import { useChatCostEstimate } from '../../hooks/useChatCostEstimate';
import McpPanel from './McpPanel';
import CostEstimateBadge from './CostEstimateBadge';

type SearchMode = 'fast' | 'deep';

interface ChatHeaderProps {
  isChatSidebarOpen: boolean;
  isRAGEnabled: boolean;
  chatNetworkMode: 'off' | 'direct';
  searchMode: SearchMode;
  activeMcpRouting?: {
    preferredServerId?: string;
    preferredServerName?: string;
    lockedServerId?: string;
    lockedServerName?: string;
    categoryRouting?: Array<{
      category: string;
      categoryLabel: string;
      preferredServerId: string;
      preferredServerName: string;
    }>;
  } | null;
  isModelOpen: boolean;
  selectedModel: string;
  availableModels: string[];
  chatMessages: any[];
  onToggleSidebar: () => void;
  onToggleRAG: () => void;
  onNetworkModeChange: (mode: 'off' | 'direct', searchMode?: SearchMode) => void;
  onToggleModel: (open: boolean) => void;
  onModelChange: (model: string) => void;
  onExportChat: (format: 'markdown' | 'json') => void;
  onExportChatToDocx?: () => void;
  onClearChat: () => void;
  onRollbackTurn: () => void;
  manualPreferredMcpServerId?: string | null;
  manualPreferredMcpServerName?: string | null;
  onManualPreferredMcpChange?: (serverId: string | null, serverName?: string | null) => void;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
  isChatSidebarOpen, isRAGEnabled, chatNetworkMode, searchMode,
  activeMcpRouting, isModelOpen, selectedModel, availableModels, chatMessages,
  onToggleSidebar, onToggleRAG, onNetworkModeChange,
  onToggleModel, onModelChange, onExportChat, onExportChatToDocx, onClearChat, onRollbackTurn,
  manualPreferredMcpServerId, manualPreferredMcpServerName, onManualPreferredMcpChange
}) => {
  const { servers, loadServers } = useMcpServers();
  const [isNetworkDropdownOpen, setIsNetworkDropdownOpen] = React.useState(false);
  const networkDropdownRef = React.useRef<HTMLDivElement>(null);

  // P1：云端模型费用预估（仅云端模型返回有效 breakdown）
  const costLiteMessages = React.useMemo(
    () =>
      (chatMessages || []).map((m: any) => ({
        role: m?.role || 'user',
        content: typeof m?.content === 'string' ? m.content : Array.isArray(m?.content) ? m.content : '',
      })),
    [chatMessages]
  );
  const { breakdown: costBreakdown, loading: costLoading, enabled: costEnabled } = useChatCostEstimate(
    selectedModel,
    costLiteMessages
  );

  const connectedServers = React.useMemo(
    () => servers.filter(server => server.enabled && server.status === 'connected'),
    [servers]
  );
  const enabledServers = React.useMemo(
    () => servers.filter(server => server.enabled),
    [servers]
  );
  const connectedTools = React.useMemo(
    () => connectedServers.reduce((total, server) => total + (server.tools?.length || 0), 0),
    [connectedServers]
  );
  const enabledServerCount = React.useMemo(
    () => servers.filter(server => server.enabled).length,
    [servers]
  );
  const activeMcpBadge = activeMcpRouting?.lockedServerName
    ? `锁定 ${activeMcpRouting.lockedServerName}`
    : activeMcpRouting?.preferredServerName
      ? `优先 ${activeMcpRouting.preferredServerName}`
      : null;

  React.useEffect(() => {
    if (!window.ipcRenderer) return;
    loadServers();
    const timer = window.setInterval(() => {
      loadServers();
    }, 10000);
    return () => window.clearInterval(timer);
  }, [loadServers]);

  React.useEffect(() => {
    if (!isNetworkDropdownOpen) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (!networkDropdownRef.current?.contains(event.target as Node)) {
        setIsNetworkDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isNetworkDropdownOpen]);

  return (
    <div className="flex-shrink-0 px-6 py-3 border-b border-teal-900/5 bg-white/20 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-2 hover:bg-accent/10 rounded-xl text-muted hover:text-accent transition-all cursor-pointer"
          title={isChatSidebarOpen ? '收起侧栏' : '展开侧栏'}
        >
          {isChatSidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
        </button>
        <div>
          <h2 className="text-sm font-bold text-foreground">AI 对话</h2>
          <p className="text-2xs text-muted">基于本地知识库的智能对话</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center bg-accent/5 rounded-xl border border-accent/10 p-0.5">
          <button
            onClick={onToggleRAG}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-2xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              isRAGEnabled ? 'bg-accent text-white shadow-sm' : 'text-muted hover:text-accent'
            }`}
            title={isRAGEnabled ? '关闭知识库检索' : '开启知识库检索'}
          >
            <Database size={10} />
            <span>RAG</span>
          </button>

          <div className="relative" ref={networkDropdownRef}>
            <button
              onClick={() => setIsNetworkDropdownOpen(open => !open)}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-2xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                chatNetworkMode !== 'off' ? 'bg-accent text-white shadow-sm' : 'text-muted hover:text-accent'
              }`}
              title="选择联网模式"
            >
              <Globe size={10} />
              <span>联网</span>
              <ChevronDown size={10} className={`transition-transform ${isNetworkDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isNetworkDropdownOpen && (
              <div className="absolute left-0 mt-2 w-48 bg-white border border-teal-900/10 rounded-xl shadow-xl z-50 p-1">
                <button
                  onClick={() => { onNetworkModeChange('off'); setIsNetworkDropdownOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all cursor-pointer ${
                    chatNetworkMode === 'off' ? 'bg-accent/10 text-accent font-semibold' : 'text-primary hover:bg-accent/5'
                  }`}
                >
                  <span>关闭</span>
                  {chatNetworkMode === 'off' && <Check size={12} className="ml-auto" />}
                </button>
                <div className="my-1 border-t border-slate-100" />
                <div className="px-3 py-1.5 text-2xs font-bold text-muted uppercase tracking-wider">直接搜索</div>
                <button
                  onClick={() => { onNetworkModeChange('direct', 'fast'); setIsNetworkDropdownOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all cursor-pointer ${
                    chatNetworkMode === 'direct' && searchMode === 'fast' ? 'bg-accent/10 text-accent font-semibold' : 'text-primary hover:bg-accent/5'
                  }`}
                >
                  <span>极速模式</span>
                  <span className="text-2xs text-muted ml-1">快速返回</span>
                  {chatNetworkMode === 'direct' && searchMode === 'fast' && <Check size={12} className="ml-auto" />}
                </button>
                <button
                  onClick={() => { onNetworkModeChange('direct', 'deep'); setIsNetworkDropdownOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all cursor-pointer ${
                    chatNetworkMode === 'direct' && searchMode === 'deep' ? 'bg-accent/10 text-accent font-semibold' : 'text-primary hover:bg-accent/5'
                  }`}
                >
                  <span>深度模式</span>
                  <span className="text-2xs text-muted ml-1">信息更完整</span>
                  {chatNetworkMode === 'direct' && searchMode === 'deep' && <Check size={12} className="ml-auto" />}
                </button>
              </div>
            )}
          </div>
        </div>

        <McpPanel
          servers={servers}
          connectedServers={connectedServers}
          enabledServers={enabledServers}
          connectedTools={connectedTools}
          enabledServerCount={enabledServerCount}
          activeMcpRouting={activeMcpRouting}
          activeMcpBadge={activeMcpBadge}
          manualPreferredMcpServerId={manualPreferredMcpServerId}
          manualPreferredMcpServerName={manualPreferredMcpServerName}
          onManualPreferredMcpChange={onManualPreferredMcpChange}
          onRefresh={loadServers}
        />

        {/* P1：云端模型费用预估徽章 */}
        <CostEstimateBadge
          breakdown={costBreakdown}
          loading={costLoading}
          enabled={costEnabled}
        />

        {chatMessages.length > 0 && (
          <>
            <button
              onClick={() => onExportChat('markdown')}
              className="p-2 text-muted hover:text-accent hover:bg-accent/5 rounded-xl transition-all cursor-pointer"
              title="导出对话"
            >
              <Download size={14} />
            </button>
            {onExportChatToDocx && (
              <button
                onClick={onExportChatToDocx}
                className="p-2 text-muted hover:text-accent hover:bg-accent/5 rounded-xl transition-all cursor-pointer"
                title="导出为 DOCX"
              >
                <FileDown size={14} />
              </button>
            )}
            <button
              onClick={onRollbackTurn}
              className="p-2 text-muted hover:text-accent hover:bg-accent/5 rounded-xl transition-all cursor-pointer"
              title="回退上一轮对话"
            >
              <Undo2 size={14} />
            </button>
            <button
              onClick={onClearChat}
              className="p-2 text-muted hover:text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
              title="清空对话"
            >
              <RotateCcw size={14} />
            </button>
          </>
        )}

        <div className="relative">
          <button
            onClick={() => onToggleModel(!isModelOpen)}
            className="px-3 py-1.5 bg-accent/5 rounded-xl border border-accent/10 flex items-center gap-2 hover:bg-accent/10 transition-all cursor-pointer"
          >
            <div className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
            <span className="text-2xs font-bold text-accent uppercase tracking-widest">
              {selectedModel ? getModelInfo(selectedModel).alias : '连接中...'}
            </span>
            <ChevronDown size={12} className={`text-accent transition-transform ${isModelOpen ? 'rotate-180' : ''}`} />
          </button>
          {isModelOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => onToggleModel(false)} />
              <div className="absolute right-0 mt-2 w-80 bg-white border border-teal-900/5 rounded-xl shadow-xl z-50 p-1.5">
                <div className="px-2.5 mb-1.5 text-2xs font-bold text-muted uppercase tracking-wider">选择模型</div>
                {availableModels.length > 0 ? availableModels.map((model) => {
                  const modelInfo = getModelInfo(model);
                  return (
                    <button
                      key={model}
                      onClick={() => { onModelChange(model); onToggleModel(false); }}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-all cursor-pointer ${
                        selectedModel === model ? 'bg-accent/10 text-accent font-semibold' : 'text-primary hover:bg-accent/5'
                      }`}
                    >
                      <div className="flex flex-col text-left min-w-0 gap-0.5">
                        <span className="truncate font-medium">{modelInfo.alias}</span>
                        <div className="flex items-center gap-1 flex-wrap">
                          {modelInfo.tags.map((tag, i) => (
                            <span key={i} className="px-1.5 py-0.5 bg-accent/5 text-accent/70 rounded text-2xs">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                      {selectedModel === model && <Check size={12} className="flex-shrink-0" />}
                    </button>
                  );
                }) : (
                  <div className="px-2.5 py-2 text-2xs text-muted italic">未找到模型</div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatHeader;
