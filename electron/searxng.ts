import axios from 'axios';
import log from 'electron-log';
import * as cheerio from 'cheerio';
import * as modelRouter from './modelRouter';
import { net } from 'electron';
import { spawn } from 'child_process';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync } from 'fs';

export interface SearchResult {
  title: string;
  content: string;
  url: string;
  score?: number;
}

export interface SearchProviderConfig {
  searxngUrl?: string | undefined;
  bochaApiKey?: string | undefined;
  selectedProvider?: 'searxng' | 'bocha' | 'bing' | undefined;
  searchMode?: 'fast' | 'deep' | undefined;
}

export async function searchSearxng(
  query: string,
  baseUrl: string,
  limit: number = 8,
  timeRange: string = ''
): Promise<SearchResult[]> {
  try {
    const cleanBaseUrl = baseUrl.replace(/\/search\/?$/, '').replace(/\/+$/, '');
    const fixedUrl = cleanBaseUrl.replace('//localhost:', '//127.0.0.1:');
    log.info('[SearXNG] Searching for:', query, 'with timeRange:', timeRange);
    const response = await axios.get(`${fixedUrl}/search`, {
      params: {
        q: query,
        format: 'json',
        language: 'zh-CN',
        categories: 'general',
        safesearch: 0,
        time_range: timeRange,
        engines: 'google,bing,duckduckgo,baidu',
      },
      timeout: 15000,
    });

    if (response.data && response.data.results) {
      log.info(`[SearXNG] Found ${response.data.results.length} results`);
      const results = response.data.results
        .filter((r: any) => r.content || r.snippet)
        .slice(0, limit)
        .map((r: any) => ({
          title: r.title,
          content: r.content || r.snippet || '',
          url: r.url,
        }));

      if (results.length === 0 && response.data.results.length > 0) {
        log.warn('[SearXNG] No results with content found, returning top results anyway');
        return response.data.results.slice(0, limit).map((r: any) => ({
          title: r.title,
          content: r.content || r.snippet || r.url || '',
          url: r.url,
        }));
      }
      return results;
    }
    return [];
  } catch (error) {
    log.error('SearXNG search failed:', error);
    return [];
  }
}

async function searchBocha(
  query: string,
  apiKey: string,
  limit: number = 8
): Promise<SearchResult[]> {
  try {
    const response = await axios.post('https://api.bochaai.com/v1/web-search', {
      query,
      count: limit,
      fresh: 'noLimit',
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });

    const webPages = response.data?.data?.webPages?.value;
    if (!webPages) return [];

    return webPages.slice(0, limit).map((r: any) => ({
      title: r.name || '',
      content: r.snippet || '',
      url: r.url || '',
    }));
  } catch (error) {
    log.error('Bocha search failed:', error);
    return [];
  }
}

async function findMcporterPath(): Promise<string> {
  const home = homedir()
  if (process.platform === 'win32') {
    const candidates = [
      join(home, '.local', 'bin', 'mcporter.exe'),
      join(home, '.local', 'bin', 'mcporter'),
    ]
    for (const p of candidates) {
      if (existsSync(p)) return p
    }
    // 尝试 npm 全局安装路径
    try {
      const { execSync } = await import('child_process')
      const npmPrefix = execSync('npm config get prefix', { encoding: 'utf-8', timeout: 5000 }).trim()
      if (npmPrefix) {
        const npmMcporter = join(npmPrefix, 'mcporter.cmd')
        if (existsSync(npmMcporter)) return npmMcporter
        const npmMcporterExe = join(npmPrefix, 'mcporter.exe')
        if (existsSync(npmMcporterExe)) return npmMcporterExe
      }
    } catch {}
    // 尝试 where 命令
    try {
      const { execSync } = await import('child_process')
      const result = execSync('where mcporter', { encoding: 'utf-8', timeout: 5000 })
      const line = result.split(/\r?\n/).find(Boolean)?.trim()
      if (line) return line
    } catch {}
    // 尝试 AppData 下的 npm 全局路径
    const appData = process.env.APPDATA || join(home, 'AppData', 'Roaming', 'npm')
    const appDataMcporter = join(appData, 'npm', 'mcporter.cmd')
    if (existsSync(appDataMcporter)) return appDataMcporter
    const localAppDataMcporter = join(home, 'AppData', 'Roaming', 'npm', 'mcporter.cmd')
    if (existsSync(localAppDataMcporter)) return localAppDataMcporter
  } else {
    const candidates = [
      join(home, '.local', 'bin', 'mcporter'),
      '/usr/local/bin/mcporter',
      '/opt/homebrew/bin/mcporter',
    ]
    for (const p of candidates) {
      if (existsSync(p)) return p
    }
    try {
      const { execSync } = await import('child_process')
      const result = execSync('which mcporter', { encoding: 'utf-8', timeout: 5000 })
      const line = result.trim()
      if (line) return line
    } catch {}
  }
  return 'mcporter'
}

async function searchBing(
  query: string,
  limit: number = 8,
  timeRange: string = ''
): Promise<SearchResult[]> {
  try {
    const params: Record<string, string> = {
      q: query,
      count: String(Math.min(limit, 50)),
    }
    if (timeRange === 'day') params['filters'] = 'ex1:"ez1"'
    else if (timeRange === 'week') params['filters'] = 'ex1:"ez2"'
    else if (timeRange === 'month') params['filters'] = 'ex1:"ez3"'

    const response = await axios.get('https://cn.bing.com/search', {
      params,
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
    })

    const $ = cheerio.load(response.data)
    const results: SearchResult[] = []

    $('#b_results > li.b_algo').each((_, el) => {
      if (results.length >= limit) return false
      const titleEl = $(el).find('h2 a')
      const snippetEl = $(el).find('.b_caption p, .b_lineclamp2')

      const title = titleEl.text().trim()
      const url = titleEl.attr('href') || ''
      const snippet = snippetEl.text().trim()

      if (title && url) {
        results.push({
          title,
          content: snippet,
          url,
        })
      }
    })

    log.info(`[Bing] Found ${results.length} results for: ${query}`)
    return results
  } catch (error) {
    log.error('Bing search failed:', error)
    return []
  }
}

export async function searchWeb(
  query: string,
  config: SearchProviderConfig,
  limit: number = 8,
  timeRange: string = ''
): Promise<SearchResult[]> {
  const provider = config.selectedProvider || (config.bochaApiKey ? 'bocha' : 'bing');
  log.info('[Web Search] remote fetch', { provider, query, limit, timeRange });
  let results: SearchResult[] = [];

  switch (provider) {
    case 'bocha':
      if (config.bochaApiKey) {
        results = await searchBocha(query, config.bochaApiKey, limit);
      }
      break;
    case 'searxng':
      if (config.searxngUrl) {
        results = await searchSearxng(query, config.searxngUrl, limit, timeRange);
      }
      break;
    case 'bing':
    default:
      results = await searchBing(query, limit, timeRange);
      break;
  }

  if (results.length > 0) {
    log.info(`[Web Search] Provider '${provider}' returned ${results.length} results`);
  }
  return results;
}

export interface WebPageContent {
  url: string;
  title: string;
  content: string;
  fetched: boolean;
}

async function fetchWebPageContent(url: string, maxChars = 2000): Promise<string | null> {
  log.info('[Web Page] remote fetch', { url });

  if (!/^https?:\/\//i.test(url)) {
    return null;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await net.fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      log.warn('[Web Page] fetch failed', { url, status: res.status });
      return null;
    }
    const html = await res.text();
    const $ = cheerio.load(html);

    // 获取页面标题
    const title = $('title').text().trim() || $('h1').first().text().trim() || '';

    // 移除无关内容
    $('script,style,nav,footer,header,aside,.ad,.sidebar,.comment,.nav,.menu,.footer').remove();

    // 优先 article/main，兜底取 p 标签段落
    const article = $('article').text().trim();
    const main = $('main').text().trim();
    const paragraphs = $('p').map((_: any, el: any) => $(el).text().trim()).get()
      .filter((t: string) => t.length > 30).join('\n');
    const bodyText = $('body').text().trim();

    const text = article || main || (paragraphs.length > 50 ? paragraphs : bodyText);
    if (!text || text.length < 50) {
      log.info('[Web Page] content rejected', { url, reason: 'too_short_or_empty' });
      return null;
    }

    // 清理：去除多余空白
    const cleaned = text.replace(/\s+/g, ' ').replace(/\n{3,}/g, '\n\n').substring(0, maxChars);
    log.info('[Web Page] fetched', { url, length: cleaned.length });
    return cleaned;
  } catch (error: any) {
    log.warn('[Web Page] fetch exception', { url, error: error?.message || String(error) });
    return null;
  }
}

export async function fetchAndExtractPages(
  candidates: { url: string; title: string; snippet: string }[],
  maxPages = 10,
  query = ''
): Promise<WebPageContent[]> {
  const top = candidates.slice(0, maxPages);
  const results = await Promise.allSettled(
    top.map(async ({ url, title, snippet }) => {
      const fullText = await fetchWebPageContent(url);
      return {
        url,
        title,
        content: fullText || snippet,
        fetched: !!fullText,
      };
    })
  );
  let fetched = results
    .filter((r): r is PromiseFulfilledResult<WebPageContent> => r.status === 'fulfilled' && !!r.value?.content)
    .map(r => r.value);

  // 如果提供了查询关键词，过滤不相关的内容
  if (query && fetched.length > 0) {
    fetched = filterRelevantContent(fetched, query);
  }

  return fetched;
}

export async function selectRelevantUrls(
  query: string,
  candidates: { url: string; title: string; snippet: string }[],
  topK = 10,
  cloudModelId?: string
): Promise<{ url: string; title: string; snippet: string }[]> {
  if (candidates.length <= topK) return candidates;

  try {
    const candidateText = candidates
      .map((c, i) => `[${i + 1}] ${c.title}\n    ${c.snippet}\n    ${c.url}`)
      .join('\n');

    const response = await modelRouter.chat({
      messages: [{
        role: 'user',
        content: `用户问题：${query}

以下是搜索结果列表，请选出最相关、最有信息量的 ${topK} 条，返回序号即可（用逗号分隔）。
优先选择：官方文档 > 专业媒体 > 博客 > 论坛

${candidateText}

最相关的${topK}条序号：`
      }],
      cloudModelId,
    });

    const indices = (response.match(/\d+/g) || [])
      .map((n: string) => parseInt(n, 10))
      .filter((n: number) => n >= 1 && n <= candidates.length);
    const uniqueIndices = [...new Set(indices)].slice(0, topK);

    if (uniqueIndices.length === 0) return candidates.slice(0, topK);

    return uniqueIndices.map((i: number) => candidates[i - 1]).filter((x): x is { url: string; title: string; snippet: string } => !!x);
  } catch (err) {
    log.warn('[Web Search] selectRelevantUrls failed, fallback to top results', err);
    return candidates.slice(0, topK);
  }
}

/**
 * 过滤与查询不相关的网页内容
 * 例如搜索"利达主机"时，过滤掉"利"字解释、"火灾"新闻等无关页面
 */
function filterRelevantContent(contents: WebPageContent[], query: string): WebPageContent[] {
  // 提取查询中的关键实体词（2字以上的连续词组）
  const keywords = extractKeywords(query);
  if (keywords.length === 0) return contents;

  return contents.filter(item => {
    const text = (item.title + ' ' + item.content).toLowerCase();
    // 至少有一个关键词出现在内容中
    return keywords.some(kw => text.includes(kw.toLowerCase()));
  });
}

/**
 * 从查询中提取关键实体词
 * 策略：2字以上的连续词组，排除常见停用词
 */
function extractKeywords(query: string): string[] {
  const stopwords = new Set([
    '是什么', '怎么用', '如何使用', '什么意思', '为什么', '怎么样',
    '有哪些', '多少钱', '好不好', '怎么样', '哪个', '哪些',
    '的', '了', '在', '是', '我', '有', '和', '就', '不', '人',
    '都', '一', '一个', '上', '也', '很', '到', '说', '要',
    '去', '你', '会', '着', '没有', '看', '好', '自己', '这',
  ]);

  // 先按空格/标点拆分
  const tokens = query.split(/[\s,，。！？、；：""''（）()【】\[\]{}]/).filter(t => t.length > 0);

  // 过滤停用词，保留2字以上的词
  const keywords = tokens.filter(t => t.length >= 2 && !stopwords.has(t));

  // 如果没提取到关键词，用原始查询兜底
  return keywords.length > 0 ? keywords : [query];
}
