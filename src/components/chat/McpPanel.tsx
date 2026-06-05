import React from 'react';
import { ChevronDown, Cable } from 'lucide-react';
import type { McpServerStatus } from '../../types';

interface ActiveMcpRouting {
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
}

interface McpPanelProps {
  servers: McpServerStatus[];
  connectedServers: McpServerStatus[];
  enabledServers: McpServerStatus[];
  connectedTools: number;
  enabledServerCount: number;
  activeMcpRouting?: ActiveMcpRouting | null | undefined;
  activeMcpBadge: string | null;
  manualPreferredMcpServerId?: string | null | undefined;
  manualPreferredMcpServerName?: string | null | undefined;
  onManualPreferredMcpChange?: ((serverId: string | null, serverName?: string | null) => void) | undefined;
  onRefresh: () => void;
}

const McpPanel: React.FC<McpPanelProps> = ({
  connectedServers,
  enabledServers,
  connectedTools,
  enabledServerCount,
  activeMcpRouting,
  activeMcpBadge,
  manualPreferredMcpServerId,
  manualPreferredMcpServerName,
  onManualPreferredMcpChange,
  onRefresh,
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const panelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setIsOpen(open => !open)}
        className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-2xs font-bold transition-all hover:shadow-sm cursor-pointer ${
          connectedServers.length > 0
            ? 'border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100'
            : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'
        }`}
        title={
          enabledServerCount > 0
            ? `已启用 ${enabledServerCount} 个 MCP 服务，当前连接 ${connectedServers.length} 个，可用工具 ${connectedTools} 个`
            : '当前未启用 MCP 服务'
        }
      >
        <Cable size={12} />
        <span>
          {enabledServerCount > 0
            ? `MCP ${connectedServers.length}/${enabledServerCount}`
            : 'MCP 未配置'}
        </span>
        {connectedServers.length > 0 && (
          <span className="rounded-md bg-white/70 px-1.5 py-0.5 text-[10px] leading-none">
            {connectedTools} 工具
          </span>
        )}
        {activeMcpBadge && (
          <span className="rounded-md bg-white/80 px-1.5 py-0.5 text-[10px] leading-none text-violet-700">
            {activeMcpBadge}
          </span>
        )}
        <ChevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-[360px] max-h-[420px] overflow-y-auto rounded-2xl border border-teal-900/10 bg-white/95 p-3 shadow-xl backdrop-blur z-50">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-foreground">MCP 服务状态</p>
              <p className="mt-1 text-2xs text-muted">
                已启用 {enabledServerCount} 个，已连接 {connectedServers.length} 个，可用工具 {connectedTools} 个
              </p>
            </div>
            <button
              onClick={() => onRefresh()}
              className="rounded-lg border border-teal-900/10 px-2 py-1 text-2xs font-bold text-muted hover:text-accent hover:border-accent/20 hover:bg-accent/5 transition-all cursor-pointer"
            >
              刷新
            </button>
          </div>

          {activeMcpBadge && (
            <div className="mb-3 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2">
              <p className="text-2xs font-bold text-violet-700">本轮 MCP 路由</p>
              <p className="mt-1 text-2xs text-violet-700/80">
                {activeMcpRouting?.lockedServerName
                  ? `当前已锁定到 ${activeMcpRouting.lockedServerName}`
                  : `当前优先使用 ${activeMcpRouting?.preferredServerName}`}
              </p>
              {activeMcpRouting?.categoryRouting && activeMcpRouting.categoryRouting.length > 0 && (
                <div className="mt-2 space-y-1">
                  {activeMcpRouting.categoryRouting.map((cr, i) => (
                    <div key={i} className="flex items-center gap-2 text-2xs text-violet-600">
                      <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold">{cr.categoryLabel}</span>
                      <span>→</span>
                      <span className="font-medium">{cr.preferredServerName}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {connectedServers.length > 0 && onManualPreferredMcpChange && (
            <div className="mb-3 rounded-xl border border-teal-900/10 bg-white/80 px-3 py-2">
              <p className="text-2xs font-bold text-foreground mb-2">本轮首选 MCP</p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => onManualPreferredMcpChange(null)}
                  className={`rounded-lg px-2 py-1 text-2xs font-bold transition-all cursor-pointer ${
                    !manualPreferredMcpServerId
                      ? 'bg-accent text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-accent/10 hover:text-accent'
                  }`}
                >
                  自动
                </button>
                {connectedServers.map(server => (
                  <button
                    key={server.id}
                    onClick={() => onManualPreferredMcpChange(server.id, server.name)}
                    className={`rounded-lg px-2 py-1 text-2xs font-bold transition-all cursor-pointer ${
                      manualPreferredMcpServerId === server.id
                        ? 'bg-violet-500 text-white'
                        : 'bg-violet-50 text-violet-600 hover:bg-violet-100'
                    }`}
                  >
                    {server.name}
                  </button>
                ))}
              </div>
              {manualPreferredMcpServerName && (
                <p className="mt-1.5 text-2xs text-muted">
                  已手动指定 <span className="font-bold text-violet-600">{manualPreferredMcpServerName}</span>，本轮所有 MCP 调用优先使用此服务
                </p>
              )}
            </div>
          )}

          {enabledServers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-2xs text-muted">
              还没有启用 MCP 服务，可在设置页的 MCP 服务里添加。
            </div>
          ) : (
            <div className="space-y-2">
              {enabledServers.map(server => {
                const isConnected = server.status === 'connected';
                const tools = server.tools || [];
                const isLockedServer = activeMcpRouting?.lockedServerId === server.id;
                const isPreferredServer = !isLockedServer && activeMcpRouting?.preferredServerId === server.id;
                return (
                  <div
                    key={server.id}
                    className={`rounded-xl border bg-white/80 px-3 py-3 ${
                      isLockedServer
                        ? 'border-violet-300 bg-violet-50/70'
                        : isPreferredServer
                          ? 'border-violet-200 bg-violet-50/40'
                          : 'border-teal-900/8'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-foreground">{server.name}</p>
                        <p className="mt-1 text-2xs text-muted">
                          {isConnected ? '已连接' : server.status === 'connecting' ? '连接中' : server.status === 'error' ? '连接异常' : '未连接'}
                          {server.transport ? ` · ${server.transport.toUpperCase()}` : ''}
                        </p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        isLockedServer
                          ? 'bg-violet-100 text-violet-700'
                          : isConnected
                          ? 'bg-green-100 text-green-700'
                          : server.status === 'error'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-slate-100 text-slate-600'
                      }`}>
                        {isLockedServer ? '已锁定' : isPreferredServer ? '优先' : `${tools.length} 工具`}
                      </span>
                    </div>

                    {server.error && (
                      <p className="mt-2 rounded-lg bg-red-50 px-2 py-1.5 text-2xs text-red-600">
                        {server.error}
                      </p>
                    )}

                    {tools.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {tools.map((tool: { name: string; description?: string }) => (
                          <span
                            key={`${server.id}-${tool.name}`}
                            className="rounded-md bg-violet-50 px-2 py-1 text-[10px] font-medium text-violet-700"
                            title={tool.description || tool.name}
                          >
                            {tool.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-2xs text-muted">当前没有可用工具。</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default McpPanel;
