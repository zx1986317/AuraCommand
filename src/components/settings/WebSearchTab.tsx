import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Globe,
  Wifi,
  WifiOff,
  Loader2,
  Search,
  Server,
  Key,
  Info,
  AlertCircle,
} from 'lucide-react';
import {
  type ProviderConfig,
  type SearchProviderId as ProviderId,
  type WebSearchSettings,
  loadWebSearchSettings,
  saveWebSearchSettings,
  getSearchProviderLabel,
} from '../../utils/webSearchSettings';

interface WebSearchTabProps {
  isSearchEnabled: boolean;
  onSearchEnabledChange: (enabled: boolean) => void;
  searxngUrl: string;
  onSearxngUrlChange: (url: string) => void;
}

const SEARCH_PROVIDERS = [
  { id: 'searxng', label: 'SearXNG', desc: '自建元搜索引擎，聚合多个搜索引擎结果', icon: Server },
  { id: 'bocha', label: '博查搜索', desc: '国内 AI 搜索 API，开箱即用', icon: Key },
  { id: 'bing', label: 'Bing', desc: '免费搜索引擎，无需 API Key，国内直连', icon: Globe },
] as const;

const WebSearchTab: React.FC<WebSearchTabProps> = ({
  isSearchEnabled,
  onSearchEnabledChange,
  searxngUrl,
  onSearxngUrlChange,
}) => {
  const [config, setConfig] = useState<WebSearchSettings>(loadWebSearchSettings);
  const [searxngTestStatus, setSearxngTestStatus] = useState<'idle' | 'testing' | 'connected' | 'failed'>('idle');
  const [bochaTestStatus, setBochaTestStatus] = useState<'idle' | 'testing' | 'connected' | 'failed'>('idle');
  const [expandedProvider, setExpandedProvider] = useState<ProviderId | null>('searxng');
  const selectedProvider = config.selectedProvider;
  const searchMode = config.searchMode;

  const updateConfig = (id: ProviderId, patch: Partial<ProviderConfig>) => {
    setConfig(prev => {
      const next = {
        ...prev,
        providers: {
          ...prev.providers,
          [id]: { ...prev.providers[id], ...patch },
        },
      };
      saveWebSearchSettings(next);
      return next;
    });
  };

  const selectProvider = (id: ProviderId) => {
    setConfig(prev => {
      const next = { ...prev, selectedProvider: id };
      saveWebSearchSettings(next);
      return next;
    });
  };

  const selectSearchMode = (mode: 'fast' | 'deep') => {
    setConfig(prev => {
      const next = { ...prev, searchMode: mode };
      saveWebSearchSettings(next);
      return next;
    });
  };

  const testSearxngConnection = async () => {
    setSearxngTestStatus('testing');
    try {
      const url = config.providers.searxng?.searxngUrl || searxngUrl;
      const cleanUrl = url.replace(/\/search\/?$/, '').replace(/\/+$/, '');
      const resp = await fetch(`${cleanUrl}/search?q=test&format=json`, { signal: AbortSignal.timeout(5000) });
      setSearxngTestStatus(resp.ok ? 'connected' : 'failed');
    } catch {
      setSearxngTestStatus('failed');
    }
  };

  const testBochaConnection = async () => {
    setBochaTestStatus('testing');
    try {
      const apiKey = config.providers.bocha?.bochaApiKey;
      if (!apiKey) {
        setBochaTestStatus('failed');
        return;
      }
      const resp = await fetch('https://api.bochaai.com/v1/web-search', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: 'test', count: 1 }),
        signal: AbortSignal.timeout(8000),
      });
      setBochaTestStatus(resp.ok ? 'connected' : 'failed');
    } catch {
      setBochaTestStatus('failed');
    }
  };

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Search size={16} className="text-accent" />
          <h4 className="text-xs font-bold text-muted uppercase tracking-widest">联网搜索总开关</h4>
        </div>

        <div className="bg-teal-900/5 p-6 rounded-2xl border border-teal-900/5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-foreground">启用联网搜索</p>
              <p className="text-xs text-muted mt-1">允许 AI 在回答时搜索互联网获取实时信息</p>
            </div>
            <button
              onClick={() => onSearchEnabledChange(!isSearchEnabled)}
              className={`w-12 h-6 rounded-full relative transition-all duration-300 ${isSearchEnabled ? 'bg-accent' : 'bg-teal-900/10'}`}
            >
              <motion.div
                animate={{ x: isSearchEnabled ? 24 : 4 }}
                className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
              />
            </button>
          </div>

          {isSearchEnabled && (
            <div className="flex items-center gap-2 text-2xs text-muted">
              <Info size={12} />
              <span>当前默认搜索引擎：{SEARCH_PROVIDERS.find(p => p.id === selectedProvider)?.label} · {searchMode === 'fast' ? '极速模式' : '深度模式'}</span>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Search size={16} className="text-accent" />
          <h4 className="text-xs font-bold text-muted uppercase tracking-widest">搜索模式</h4>
        </div>

        <div className={`grid grid-cols-2 gap-3 transition-all duration-300 ${isSearchEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
          <button
            onClick={() => selectSearchMode('fast')}
            className={`text-left p-4 rounded-2xl border transition-all ${searchMode === 'fast' ? 'border-accent bg-accent/5' : 'border-teal-900/5 bg-teal-900/5 hover:bg-teal-900/8'}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-bold text-foreground">极速模式</span>
              {searchMode === 'fast' && <span className="text-2xs font-mono text-accent bg-accent/10 px-1.5 py-0.5 rounded">当前</span>}
            </div>
            <p className="text-2xs text-muted">只直搜原问题，默认不扩词、不抓全文，优先更快出结果。</p>
          </button>
          <button
            onClick={() => selectSearchMode('deep')}
            className={`text-left p-4 rounded-2xl border transition-all ${searchMode === 'deep' ? 'border-accent bg-accent/5' : 'border-teal-900/5 bg-teal-900/5 hover:bg-teal-900/8'}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-bold text-foreground">深度模式</span>
              {searchMode === 'deep' && <span className="text-2xs font-mono text-accent bg-accent/10 px-1.5 py-0.5 rounded">当前</span>}
            </div>
            <p className="text-2xs text-muted">结果不足时补充扩词，细节型问题会抓少量网页全文，信息更完整。</p>
          </button>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Globe size={16} className="text-accent" />
          <h4 className="text-xs font-bold text-muted uppercase tracking-widest">搜索引擎配置</h4>
        </div>

        <div className={`space-y-3 transition-all duration-300 ${isSearchEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
          {SEARCH_PROVIDERS.map((provider) => {
            const Icon = provider.icon;
            const cfg = config.providers[provider.id];
            const isExpanded = expandedProvider === provider.id;
            const isSelected = selectedProvider === provider.id;

            return (
              <div key={provider.id} className="bg-teal-900/5 rounded-2xl border border-teal-900/5 overflow-hidden">
                <div
                  className="flex items-center gap-4 p-4 cursor-pointer hover:bg-teal-900/3 transition-colors"
                  onClick={() => setExpandedProvider(isExpanded ? null : provider.id)}
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); selectProvider(provider.id); }}
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                      isSelected ? 'border-accent' : 'border-teal-900/20'
                    }`}
                  >
                    <div className={`w-2.5 h-2.5 rounded-full ${isSelected ? 'bg-accent' : 'bg-transparent'}`} />
                  </button>

                  <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center text-accent shrink-0">
                    <Icon size={16} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-foreground">{provider.label}</p>
                      {isSelected && (
                        <span className="text-2xs font-mono text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                          当前使用
                        </span>
                      )}
                    </div>
                    <p className="text-2xs text-muted mt-0.5">{provider.desc}</p>
                  </div>

                  <svg
                    width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    className={`text-muted shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-0 border-t border-teal-900/5 mt-0">
                    <div className="pt-3 space-y-3">
                      {provider.id === 'searxng' && (
                        <>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={cfg.searxngUrl ?? searxngUrl}
                              onChange={(e) => {
                                const val = e.target.value;
                                updateConfig('searxng', { searxngUrl: val });
                                onSearxngUrlChange(val);
                                setSearxngTestStatus('idle');
                              }}
                              placeholder="例如: http://localhost:8080"
                              className="flex-1 bg-white border border-teal-900/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-accent/50 transition-all font-mono"
                            />
                            <button
                              onClick={testSearxngConnection}
                              className="shrink-0 px-4 py-2.5 rounded-xl border border-teal-900/10 text-xs font-bold hover:bg-teal-900/5 transition-all flex items-center gap-2 cursor-pointer"
                            >
                              {searxngTestStatus === 'testing' ? <Loader2 size={14} className="animate-spin" /> : searxngTestStatus === 'connected' ? <Wifi size={14} className="text-green-500" /> : searxngTestStatus === 'failed' ? <WifiOff size={14} className="text-red-500" /> : <Globe size={14} className="text-muted" />}
                              {searxngTestStatus === 'testing' ? '检测中' : searxngTestStatus === 'connected' ? '已连接' : searxngTestStatus === 'failed' ? '未连接' : '测试'}
                            </button>
                          </div>
                          <p className="text-2xs text-muted">请确保 SearXNG 实例启用了 JSON 格式输出。推荐使用 Docker 部署。</p>
                        </>
                      )}

                      {provider.id === 'bocha' && (
                        <>
                          <div className="flex gap-2">
                            <input
                              type="password"
                              value={cfg.bochaApiKey ?? ''}
                              onChange={(e) => {
                                updateConfig('bocha', { bochaApiKey: e.target.value });
                                setBochaTestStatus('idle');
                              }}
                              placeholder="输入博查搜索 API Key"
                              className="flex-1 bg-white border border-teal-900/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-accent/50 transition-all font-mono"
                            />
                            <button
                              onClick={testBochaConnection}
                              className="shrink-0 px-4 py-2.5 rounded-xl border border-teal-900/10 text-xs font-bold hover:bg-teal-900/5 transition-all flex items-center gap-2 cursor-pointer"
                            >
                              {bochaTestStatus === 'testing' ? <Loader2 size={14} className="animate-spin" /> : bochaTestStatus === 'connected' ? <Wifi size={14} className="text-green-500" /> : bochaTestStatus === 'failed' ? <WifiOff size={14} className="text-red-500" /> : <Globe size={14} className="text-muted" />}
                              {bochaTestStatus === 'testing' ? '检测中' : bochaTestStatus === 'connected' ? '已连接' : bochaTestStatus === 'failed' ? '未连接' : '测试'}
                            </button>
                          </div>
                          <p className="text-2xs text-muted">
                            前往 <span className="text-accent font-medium">bochaai.com</span> 注册获取 API Key，国内直连，专为 AI 搜索优化。
                          </p>
                        </>
                      )}

                      {provider.id === 'bing' && (
                        <>
                          <div className="bg-green-50 border border-green-100 rounded-xl p-3 flex items-start gap-2">
                            <Globe size={14} className="text-green-600 mt-0.5 shrink-0" />
                            <div className="text-2xs text-green-800">
                              <p className="font-bold mb-1">零配置，开箱即用</p>
                              <p>Bing 无需 API Key、无需自建服务、国内直连，选中即可使用。适合快速启用联网搜索的场景。</p>
                            </div>
                          </div>
                          <p className="text-2xs text-muted">
                            基于 Bing 搜索引擎（cn.bing.com），支持中英文搜索，国内可直连。
                          </p>
                        </>
                      )}
                      <div className="flex items-center gap-2 pt-1">
                        <AlertCircle size={12} className="text-muted" />
                        <span className="text-2xs text-muted">
                          联网时只会使用当前选中的这一种搜索方式，不会自动切换到另一种。
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Info size={16} className="text-accent" />
          <h4 className="text-xs font-bold text-muted uppercase tracking-widest">工作原理</h4>
        </div>
        <div className="bg-teal-900/5 p-5 rounded-2xl border border-teal-900/5 space-y-3 text-2xs text-muted">
          <div className="flex items-start gap-3">
            <span className="w-5 h-5 rounded-full bg-accent/10 text-accent flex items-center justify-center text-xs font-bold shrink-0">1</span>
            <p>AI Chat 开启联网后，使用 {getSearchProviderLabel(selectedProvider)} 作为搜索引擎。</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="w-5 h-5 rounded-full bg-accent/10 text-accent flex items-center justify-center text-xs font-bold shrink-0">2</span>
            <p>{searchMode === 'fast' ? '默认优先使用用户原问题直接搜索，不做额外扩词' : '默认先直搜原问题，结果不足时再补充少量扩词'}</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="w-5 h-5 rounded-full bg-accent/10 text-accent flex items-center justify-center text-xs font-bold shrink-0">3</span>
            <p>{searchMode === 'fast' ? '直接搜索优先使用搜索摘要组织回答，不抓网页全文' : '直接搜索的细节型问题会抓取少量网页全文，补充更深入的信息'}</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default WebSearchTab;
