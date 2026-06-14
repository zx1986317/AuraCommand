/**
 * 批量测试 + 健康度报告 - 纯函数与类型定义
 *
 * 从 electron/util/batchHealth.ts 迁移纯函数部分至 src/shared/，
 * 供渲染进程直接引用，避免 Vite 打包时触发 require('electron')。
 *
 * ProbeResult 类型在此处自包含定义（原版从 cloudProbe 导入，
 * cloudProbe 依赖 axios 不适合渲染进程）。
 */

/** 云端探测结果（与 electron/util/cloudProbe.ts 的 ProbeResult 一致） */
export interface ProbeResult {
  success: boolean;
  error?: string;
  /** 整个测试请求往返耗时（毫秒） */
  latencyMs?: number;
  /** 远端实际响应的 HTTP 状态码（仅成功时存在） */
  httpStatus?: number;
  /** 从响应体里提取的模型版本字符串（best-effort） */
  modelVersion?: string;
  /** 完整 endpoint（用于 UI 透出"测试的是哪条 URL"） */
  endpoint?: string;
  /** 失败时的错误类别（network / auth / bad-request / timeout / unknown） */
  errorKind?: 'network' | 'auth' | 'bad-request' | 'timeout' | 'unknown';
}

export interface BatchTestInput {
  id: string;
  name: string;
  provider: string;
  baseUrl: string;
  model: string;
}

export interface BatchTestItemResult {
  id: string;
  name: string;
  provider: string;
  result: ProbeResult;
}

export interface HealthReport {
  total: number;
  passed: number;
  failed: number;
  /** 成功测试的平均延迟（毫秒） */
  avgLatencyMs: number | null;
  /** 失败测试的错误分布 */
  errorBreakdown: Record<string, number>;
  /** 健康度评分 0-100 */
  score: number;
  /** 给用户的整体状态描述 */
  status: 'healthy' | 'degraded' | 'down';
  testedAt: number;
}

/**
 * 从批量结果计算健康度报告（纯函数）
 *  - 全部通过 → healthy
 *  - 部分通过 → degraded
 *  - 全部失败 → down
 */
export function computeHealthReport(items: BatchTestItemResult[]): HealthReport {
  const total = items.length;
  const passed = items.filter(i => i.result.success).length;
  const failed = total - passed;
  const latencies = items
    .filter(i => i.result.success && typeof i.result.latencyMs === 'number')
    .map(i => i.result.latencyMs as number);
  const avgLatencyMs = latencies.length > 0
    ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
    : null;

  const errorBreakdown: Record<string, number> = {};
  for (const item of items) {
    if (item.result.success) continue;
    const kind = item.result.errorKind || 'unknown';
    errorBreakdown[kind] = (errorBreakdown[kind] || 0) + 1;
  }

  const score = total > 0 ? Math.round((passed / total) * 100) : 0;
  const status: HealthReport['status'] =
    failed === 0 ? 'healthy' : passed === 0 ? 'down' : 'degraded';

  return {
    total,
    passed,
    failed,
    avgLatencyMs,
    errorBreakdown,
    score,
    status,
    testedAt: Date.now(),
  };
}

/** 简单的并发限制器：最多 maxConcurrent 个 promise 同时跑 */
export async function runWithConcurrency<T, R>(
  items: T[],
  maxConcurrent: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const runners: Promise<void>[] = [];
  for (let i = 0; i < Math.min(maxConcurrent, items.length); i++) {
    runners.push((async () => {
      while (true) {
        const idx = cursor++;
        if (idx >= items.length) return;
        results[idx] = await worker(items[idx]!, idx);
      }
    })());
  }
  await Promise.all(runners);
  return results;
}

/**
 * 将错误降级为 ProbeResult
 * - 不会抛错，所有分支都返回结构化结果
 */
export function toFailedProbeResult(err: any): ProbeResult {
  if (!err) {
    return { success: false, error: '测试失败', errorKind: 'unknown' };
  }
  const message = err?.message || '测试失败';
  let errorKind: ProbeResult['errorKind'] = 'unknown';
  if (err?.name === 'AbortError' || err?.code === 'ABORTED' || /timeout|超时/i.test(message)) {
    errorKind = 'timeout';
  } else {
    const status = err?.response?.status;
    if (status === 401 || status === 403) errorKind = 'auth';
    else if (status === 400 || status === 422) errorKind = 'bad-request';
    else {
      const code = err?.code || '';
      if (
        code === 'ECONNREFUSED' || code === 'ENOTFOUND' ||
        code === 'ECONNRESET' || code === 'ETIMEDOUT' ||
        /network|fetch failed/i.test(message)
      ) {
        errorKind = 'network';
      }
    }
  }
  return { success: false, error: message, errorKind };
}
