/**
 * P3 任务 2：消息搜索高亮 - 文本处理工具
 *
 * 设计目标：
 *  - 在不破坏 React 树结构的前提下，把匹配关键词替换为 <mark> 高亮节点
 *  - 兼容中文 / 英文 / 数字混合（query 整词匹配，忽略大小写）
 *  - 转义 HTML 字符避免 XSS
 *  - 提供纯字符串版本（用于复制 / 导出场景下回退到原文）
 */
import React from 'react';

/** 转义 HTML 特殊字符 */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 转义正则元字符
 */
export function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 在纯文本中查找 query 的所有匹配位置（大小写不敏感）
 *  - 跳过纯空白 query
 *  - 返回基于原字符串 charIndex 的区间列表
 */
export interface SearchMatch {
  start: number;
  end: number;
  text: string;
}

export function findMatches(text: string, query: string): SearchMatch[] {
  if (!text || !query || !query.trim()) return [];
  const trimmed = query.trim();
  const lower = text.toLowerCase();
  const needle = trimmed.toLowerCase();
  const out: SearchMatch[] = [];
  let from = 0;
  while (from < lower.length) {
    const idx = lower.indexOf(needle, from);
    if (idx < 0) break;
    out.push({ start: idx, end: idx + needle.length, text: text.slice(idx, idx + needle.length) });
    from = idx + needle.length;
  }
  return out;
}

/**
 * 把命中区间插入到 React 节点数组中，每个匹配段用 <mark class="chat-search-highlight"> 包裹
 *
 *  - input 可以是纯字符串，也可以是已经分段好的 React 节点
 *  - 避免 highlight 跨过 React 元素边界 - 我们只在最外层字符串中查找
 */
export function highlightMatches(
  text: string,
  query: string,
  activeIndex: number = -1,
  baseKey: string = 'h'
): React.ReactNode[] {
  const matches = findMatches(text, query);
  if (matches.length === 0) return [text];

  const result: React.ReactNode[] = [];
  let cursor = 0;
  matches.forEach((m, i) => {
    if (m.start > cursor) {
      result.push(text.slice(cursor, m.start));
    }
    result.push(
      <mark
        key={`${baseKey}-${i}`}
        className={`chat-search-highlight${activeIndex === i ? ' chat-search-highlight-active' : ''}`}
        data-match-index={i}
      >
        {text.slice(m.start, m.end)}
      </mark>
    );
    cursor = m.end;
  });
  if (cursor < text.length) {
    result.push(text.slice(cursor));
  }
  return result;
}

/** 把全文中所有匹配累计到消息级列表（每条消息内的偏移），用于导航上一个/下一个 */
export interface MessageMatch {
  messageId: string;
  matchIndex: number;
  globalIndex: number;
}

export function collectMessageMatches(
  messages: Array<{ id: string; content: string }>,
  query: string
): MessageMatch[] {
  if (!query.trim()) return [];
  const out: MessageMatch[] = [];
  let global = 0;
  for (const m of messages) {
    const matches = findMatches(m.content || '', query);
    matches.forEach((_, i) => {
      out.push({ messageId: m.id, matchIndex: i, globalIndex: global++ });
    });
  }
  return out;
}
