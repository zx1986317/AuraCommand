/**
 * P2 #2：批量测试 + 健康度报告 - 单测
 */
import { describe, it, expect } from 'vitest';
import { computeHealthReport, runWithConcurrency, toFailedProbeResult, BatchTestItemResult } from '../../electron/util/batchHealth';

const success = (latencyMs: number) => ({ success: true, latencyMs, httpStatus: 200 });
const failure = (errorKind: 'network' | 'auth' | 'timeout' | 'unknown' = 'unknown', error = 'fail') => ({
  success: false, error, errorKind,
});

describe('computeHealthReport', () => {
  it('空数组：total=0, score=0, status=healthy', () => {
    const r = computeHealthReport([]);
    expect(r.total).toBe(0);
    expect(r.passed).toBe(0);
    expect(r.failed).toBe(0);
    expect(r.score).toBe(0);
    expect(r.status).toBe('healthy');
    expect(r.avgLatencyMs).toBeNull();
  });

  it('全部成功：healthy + 100 分 + 平均延迟', () => {
    const items: BatchTestItemResult[] = [
      { id: 'a', name: 'A', provider: 'openai', result: success(100) },
      { id: 'b', name: 'B', provider: 'claude', result: success(200) },
      { id: 'c', name: 'C', provider: 'zhipu', result: success(300) },
    ];
    const r = computeHealthReport(items);
    expect(r.passed).toBe(3);
    expect(r.failed).toBe(0);
    expect(r.score).toBe(100);
    expect(r.status).toBe('healthy');
    expect(r.avgLatencyMs).toBe(200);
  });

  it('部分失败：degraded + 中间分 + 错误分布', () => {
    const items: BatchTestItemResult[] = [
      { id: 'a', name: 'A', provider: 'openai', result: success(100) },
      { id: 'b', name: 'B', provider: 'claude', result: failure('auth', 'invalid api key') },
      { id: 'c', name: 'C', provider: 'zhipu', result: failure('network', 'ECONNREFUSED') },
      { id: 'd', name: 'D', provider: 'dashscope', result: success(150) },
    ];
    const r = computeHealthReport(items);
    expect(r.passed).toBe(2);
    expect(r.failed).toBe(2);
    expect(r.score).toBe(50);
    expect(r.status).toBe('degraded');
    expect(r.avgLatencyMs).toBe(125);
    expect(r.errorBreakdown).toEqual({ auth: 1, network: 1 });
  });

  it('全部失败：down + 0 分', () => {
    const items: BatchTestItemResult[] = [
      { id: 'a', name: 'A', provider: 'openai', result: failure('timeout') },
      { id: 'b', name: 'B', provider: 'claude', result: failure('network') },
    ];
    const r = computeHealthReport(items);
    expect(r.passed).toBe(0);
    expect(r.failed).toBe(2);
    expect(r.score).toBe(0);
    expect(r.status).toBe('down');
    expect(r.avgLatencyMs).toBeNull();
  });

  it('成功结果没有 latency 字段时不计入平均', () => {
    const items: BatchTestItemResult[] = [
      { id: 'a', name: 'A', provider: 'openai', result: { success: true } },
      { id: 'b', name: 'B', provider: 'claude', result: success(200) },
    ];
    const r = computeHealthReport(items);
    expect(r.avgLatencyMs).toBe(200);
  });

  it('未分类错误归为 unknown', () => {
    const items: BatchTestItemResult[] = [
      { id: 'a', name: 'A', provider: 'openai', result: { success: false, error: 'mystery' } },
    ];
    const r = computeHealthReport(items);
    expect(r.errorBreakdown).toEqual({ unknown: 1 });
  });
});

describe('runWithConcurrency', () => {
  it('空数组：返回空', async () => {
    const r = await runWithConcurrency([], 3, async x => x);
    expect(r).toEqual([]);
  });

  it('并发度=3：6 个任务都能完成', async () => {
    const items = [1, 2, 3, 4, 5, 6];
    const r = await runWithConcurrency(items, 3, async x => {
      await new Promise(res => setTimeout(res, 5));
      return x * 2;
    });
    expect(r).toEqual([2, 4, 6, 8, 10, 12]);
  });

  it('并发度大于任务数：仍能完成', async () => {
    const items = [1, 2];
    const r = await runWithConcurrency(items, 10, async x => x + 100);
    expect(r).toEqual([101, 102]);
  });

  it('并发度=1：串行执行', async () => {
    const order: number[] = [];
    const items = [1, 2, 3];
    await runWithConcurrency(items, 1, async x => {
      order.push(x);
      await new Promise(res => setTimeout(res, 1));
      return x;
    });
    expect(order).toEqual([1, 2, 3]);
  });
});

describe('toFailedProbeResult', () => {
  it('从 Error 对象提取 message', () => {
    const r = toFailedProbeResult(new Error('连接超时'));
    expect(r.success).toBe(false);
    expect(r.error).toBe('连接超时');
    expect(r.errorKind).toBe('timeout');
  });

  it('识别 ECONNREFUSED → network', () => {
    const r = toFailedProbeResult({ message: 'connect ECONNREFUSED', code: 'ECONNREFUSED' });
    expect(r.errorKind).toBe('network');
  });

  it('识别 ABORTED → timeout', () => {
    const r = toFailedProbeResult({ message: 'aborted', code: 'ABORTED' });
    expect(r.errorKind).toBe('timeout');
  });

  it('空错误 → unknown', () => {
    const r = toFailedProbeResult(null);
    expect(r.errorKind).toBe('unknown');
    expect(r.error).toBe('测试失败');
  });
});
