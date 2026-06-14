/**
 * P1：聊天费用预估 hook
 * - 调用主进程 estimate-chat-cost IPC
 * - 用 600ms 防抖 + 简易 TTL 缓存避免每次输入都打后端
 * - 仅在 modelName 属于云端（Ollama 不计费）时启用
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { logger } from '../utils/logger';
import { getModelKind } from '../utils/modelKind';

export interface ChatMessageLite {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

export interface CostBreakdownFE {
  inputTokens: number;
  outputTokens: number;
  inputUSD: number;
  outputUSD: number;
  totalUSD: number;
  cny: number;
  inputUSDFmt: string;
  outputUSDFmt: string;
  totalUSDFmt: string;
  priceKnown: boolean;
  priceLabel?: string;
  priceNote?: string;
}

export interface UseChatCostEstimateOptions {
  /** 是否启用；默认 true */
  enabled?: boolean;
  /** 防抖 ms；默认 600 */
  debounceMs?: number;
  /** 输出 token 预估；默认 1000 */
  expectedOutputTokens?: number;
  /** provider 字符串；默认 'cloud'（由后端做模糊匹配） */
  provider?: string;
}

interface CacheKey {
  m: string;        // model
  h: string;        // hash(messages)
  o: number;        // outputTokens
}

const CACHE_TTL_MS = 5_000;

function hashMessages(msgs: ChatMessageLite[] | undefined): string {
  if (!msgs || msgs.length === 0) return '0';
  // 用长度 + 首尾 token 做指纹，碰撞概率可接受（仅用于缓存键）
  let s = `${msgs.length}|`;
  for (let i = 0; i < msgs.length; i++) {
    const c = msgs[i]?.content;
    if (typeof c === 'string') {
      s += `${i}:${c.length}:${c.slice(0, 16)};`;
    } else if (Array.isArray(c)) {
      s += `${i}:arr${c.length};`;
    }
  }
  return s;
}

function isCloudModel(modelName: string): boolean {
  return getModelKind(modelName) === 'cloud';
}

// 暴露纯函数以便单测；仅供内部/测试使用
export const __test__ = { hashMessages, isCloudModel };

export function useChatCostEstimate(
  modelName: string,
  messages: ChatMessageLite[] | undefined,
  options: UseChatCostEstimateOptions = {}
) {
  const { enabled = true, debounceMs = 600, expectedOutputTokens = 1000, provider = 'cloud' } = options;

  const [breakdown, setBreakdown] = useState<CostBreakdownFE | null>(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<number | null>(null);
  const reqIdRef = useRef(0);
  const cacheRef = useRef<Map<string, { at: number; value: CostBreakdownFE }>>(new Map());

  const enabledFinal = enabled && isCloudModel(modelName);

  useEffect(() => {
    if (!enabledFinal) {
      setBreakdown(null);
      return;
    }
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const key: CacheKey = {
      m: modelName,
      h: hashMessages(messages),
      o: expectedOutputTokens,
    };
    const cacheKey = `${key.m}#${key.h}#${key.o}`;
    const now = Date.now();
    const cached = cacheRef.current.get(cacheKey);
    if (cached && now - cached.at < CACHE_TTL_MS) {
      setBreakdown(cached.value);
      setLoading(false);
      return;
    }

    timerRef.current = window.setTimeout(async () => {
      const myReq = ++reqIdRef.current;
      setLoading(true);
      try {
        if (!window.ipcRenderer) {
          setBreakdown(null);
          return;
        }
        const result = await window.ipcRenderer.invoke('estimate-chat-cost', {
          provider,
          modelName,
          messages: messages || [],
          expectedOutputTokens,
        });
        if (myReq !== reqIdRef.current) return; // 被更新的请求覆盖
        if (!result) {
          setBreakdown(null);
          return;
        }
        const value: CostBreakdownFE = {
          inputTokens: result.inputTokens || 0,
          outputTokens: result.outputTokens || 0,
          inputUSD: result.inputUSD || 0,
          outputUSD: result.outputUSD || 0,
          totalUSD: result.totalUSD || 0,
          cny: result.cny || 0,
          inputUSDFmt: result.inputUSDFmt || '$0',
          outputUSDFmt: result.outputUSDFmt || '$0',
          totalUSDFmt: result.totalUSDFmt || '$0',
          priceKnown: !!result.priceKnown,
          priceLabel: result.priceLabel,
          priceNote: result.priceNote,
        };
        cacheRef.current.set(cacheKey, { at: Date.now(), value });
        // 控制缓存大小
        if (cacheRef.current.size > 32) {
          const firstKey = cacheRef.current.keys().next().value;
          if (firstKey !== undefined) cacheRef.current.delete(firstKey);
        }
        setBreakdown(value);
      } catch (err) {
        logger.warn('[useChatCostEstimate] failed:', err);
        if (myReq === reqIdRef.current) {
          setBreakdown(null);
        }
      } finally {
        if (myReq === reqIdRef.current) {
          setLoading(false);
        }
      }
    }, debounceMs);

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [enabledFinal, modelName, provider, debounceMs, expectedOutputTokens, messages]);

  return useMemo(
    () => ({
      breakdown,
      loading,
      enabled: enabledFinal,
    }),
    [breakdown, loading, enabledFinal]
  );
}
