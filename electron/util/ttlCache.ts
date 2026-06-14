/**
 * P1：通用 TTL + key 缓存工具
 * - 同步版：用于纯函数（如 getKnowledgeStats、token 估算）
 * - 异步版：用于 IPC 包装（避免并发重复请求、避免 TTL 内重复调用）
 */
export interface CacheEntry<V> {
  value: V;
  expiresAt: number;
}

export interface TTLCacheOptions {
  defaultTtlMs?: number;
  maxEntries?: number;
}

export class TTLCache<K, V> {
  private map = new Map<K, CacheEntry<V>>();
  private readonly defaultTtl: number;
  private readonly maxEntries: number;

  constructor(opts: TTLCacheOptions = {}) {
    this.defaultTtl = opts.defaultTtlMs ?? 60_000;
    this.maxEntries = opts.maxEntries ?? 200;
  }

  get(key: K, now: number = Date.now()): V | undefined {
    const e = this.map.get(key);
    if (!e) return undefined;
    if (e.expiresAt < now) {
      this.map.delete(key);
      return undefined;
    }
    // LRU touch
    this.map.delete(key);
    this.map.set(key, e);
    return e.value;
  }

  set(key: K, value: V, ttlMs?: number, now: number = Date.now()): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { value, expiresAt: now + (ttlMs ?? this.defaultTtl) });
    if (this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
  }

  delete(key: K): void { this.map.delete(key); }
  clear(): void { this.map.clear(); }
  size(): number { return this.map.size; }
}

/** 把 (args...) 拼成稳定的 cache key */
export function keyOf(...parts: Array<string | number | boolean | null | undefined>): string {
  return parts
    .map(p => (p === null || p === undefined ? '' : String(p)))
    .join('|');
}

/** 异步 memoize：同一 key + 飞行中请求会被合并 */
export function asyncMemo<K, V>(fn: (key: K) => Promise<V>, opts: { ttlMs?: number; maxEntries?: number } = {}) {
  const cacheOpts: TTLCacheOptions = {};
  if (opts.ttlMs !== undefined) cacheOpts.defaultTtlMs = opts.ttlMs;
  if (opts.maxEntries !== undefined) cacheOpts.maxEntries = opts.maxEntries;
  const cache = new TTLCache<K, V>(cacheOpts);
  const inflight = new Map<K, Promise<V>>();
  return async (key: K): Promise<V> => {
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    const pending = inflight.get(key);
    if (pending) return pending;
    const p = fn(key)
      .then(v => { cache.set(key, v); return v; })
      .finally(() => { inflight.delete(key); });
    inflight.set(key, p);
    return p;
  };
}
