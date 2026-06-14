/**
 * TTL 缓存单测：覆盖命中/过期/LRU/上限/去重
 */
import { describe, it, expect } from 'vitest';
import { TTLCache, keyOf, asyncMemo } from '../../electron/util/ttlCache';

describe('TTLCache (P1 缓存层)', () => {
  it('set + get 在 TTL 内命中', () => {
    const c = new TTLCache<string, number>({ defaultTtlMs: 1000 });
    c.set('a', 1);
    expect(c.get('a', 0)).toBe(1);
    expect(c.get('a', 999)).toBe(1);
  });

  it('超过 expiresAt 后返回 undefined 并清理', () => {
    const c = new TTLCache<string, number>({ defaultTtlMs: 100 });
    c.set('a', 1, 100, 0);
    expect(c.get('a', 50)).toBe(1);
    expect(c.get('a', 200)).toBeUndefined();
    expect(c.size()).toBe(0);
  });

  it('LRU touch：命中后变最新', () => {
    const c = new TTLCache<string, number>({ defaultTtlMs: 1000, maxEntries: 2 });
    c.set('a', 1);
    c.set('b', 2);
    c.get('a'); // a 变最新
    c.set('c', 3); // b 应被淘汰
    expect(c.get('a', 0)).toBe(1);
    expect(c.get('b', 0)).toBeUndefined();
    expect(c.get('c', 0)).toBe(3);
  });

  it('maxEntries 上限：超出后淘汰最早的', () => {
    const c = new TTLCache<number, number>({ defaultTtlMs: 1000, maxEntries: 2 });
    c.set(1, 1);
    c.set(2, 2);
    c.set(3, 3);
    expect(c.get(1, 0)).toBeUndefined();
    expect(c.get(2, 0)).toBe(2);
    expect(c.get(3, 0)).toBe(3);
  });

  it('keyOf 拼接规则稳定', () => {
    expect(keyOf('a', 1, true, null, undefined)).toBe('a|1|true||');
  });
});

describe('asyncMemo', () => {
  it('同一 key 复用结果', async () => {
    let calls = 0;
    const fn = async (k: string) => { calls++; return k.toUpperCase(); };
    const memo = asyncMemo(fn, { ttlMs: 1000 });
    expect(await memo('hi')).toBe('HI');
    expect(await memo('hi')).toBe('HI');
    expect(calls).toBe(1);
  });

  it('不同 key 独立', async () => {
    const fn = async (k: string) => `v-${k}`;
    const memo = asyncMemo(fn);
    expect(await memo('a')).toBe('v-a');
    expect(await memo('b')).toBe('v-b');
  });

  it('同一 key 并发请求合并为 1 次调用', async () => {
    let calls = 0;
    const fn = async (k: string) => { calls++; await new Promise(r => setTimeout(r, 20)); return k; };
    const memo = asyncMemo(fn, { ttlMs: 1000 });
    const [r1, r2, r3] = await Promise.all([memo('x'), memo('x'), memo('x')]);
    expect([r1, r2, r3]).toEqual(['x', 'x', 'x']);
    expect(calls).toBe(1);
  });

  it('TTL 过期后会重新计算', async () => {
    let calls = 0;
    const fn = async (k: string) => { calls++; return k; };
    const memo = asyncMemo(fn, { ttlMs: 30 });
    await memo('a');
    await memo('a');
    await new Promise(r => setTimeout(r, 50));
    await memo('a');
    expect(calls).toBe(2);
  });
});
