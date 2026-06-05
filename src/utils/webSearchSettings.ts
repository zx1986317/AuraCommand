export type SearchProviderId = 'searxng' | 'bocha' | 'bing';
export type SearchMode = 'fast' | 'deep';

export interface ProviderConfig {
  searxngUrl?: string;
  bochaApiKey?: string;
}

export interface WebSearchSettings {
  selectedProvider: SearchProviderId;
  providers: Record<SearchProviderId, ProviderConfig>;
  searchMode: SearchMode;
}

export const WEB_SEARCH_SETTINGS_KEY = 'webSearchProviders';

export const DEFAULT_WEB_SEARCH_SETTINGS: WebSearchSettings = {
  selectedProvider: 'searxng',
  searchMode: 'fast',
  providers: {
    searxng: {},
    bocha: {},
    bing: {},
  },
};

export function loadWebSearchSettings(): WebSearchSettings {
  try {
    const saved = localStorage.getItem(WEB_SEARCH_SETTINGS_KEY);
    if (!saved) return DEFAULT_WEB_SEARCH_SETTINGS;

    const parsed = JSON.parse(saved);
    const selectedProvider: SearchProviderId = parsed.selectedProvider === 'bocha' ? 'bocha' : parsed.selectedProvider === 'bing' ? 'bing' : 'searxng';
    const searchMode: SearchMode = parsed.searchMode === 'deep' ? 'deep' : 'fast';
    const providers = parsed.providers || parsed;

    return {
      selectedProvider,
      searchMode,
      providers: {
        ...DEFAULT_WEB_SEARCH_SETTINGS.providers,
        ...(providers || {}),
      },
    };
  } catch {
    return DEFAULT_WEB_SEARCH_SETTINGS;
  }
}

export function saveWebSearchSettings(config: WebSearchSettings) {
  localStorage.setItem(WEB_SEARCH_SETTINGS_KEY, JSON.stringify(config));
}

export function updateWebSearchSettings(updater: (current: WebSearchSettings) => WebSearchSettings): WebSearchSettings {
  const next = updater(loadWebSearchSettings());
  saveWebSearchSettings(next);
  return next;
}

export function getSearchProviderLabel(provider: SearchProviderId): string {
  if (provider === 'bocha') return '博查搜索';
  if (provider === 'bing') return 'Bing';
  return 'SearXNG';
}
