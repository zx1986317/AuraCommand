/**
 * P1 #6：云端连接测试结果增强
 * - 从 probeCloudConnection 的 axios 响应里提取延迟、HTTP 状态、模型版本
 * - 抽出纯函数便于单测
 */
import type { AxiosResponse } from 'axios';

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

/**
 * 从 axios 响应中尽量提取模型版本信息。
 * 优先级：response.data.model > response.data.model_version >
 *         response.data.choices[0].model > response.headers['x-model-id']
 */
export function extractModelVersion(response: AxiosResponse | undefined | null): string | undefined {
  if (!response) return undefined;
  const data = response.data;
  if (data && typeof data === 'object') {
    if (typeof (data as any).model === 'string' && (data as any).model) return (data as any).model;
    if (typeof (data as any).model_version === 'string' && (data as any).model_version) return (data as any).model_version;
    const choice = (data as any).choices?.[0];
    if (choice && typeof choice.model === 'string' && choice.model) return choice.model;
    const output = (data as any).output;
    if (output && typeof output.model === 'string' && output.model) return output.model;
  }
  const headerModel = response.headers?.['x-model-id'];
  if (typeof headerModel === 'string' && headerModel) return headerModel;
  return undefined;
}

/**
 * 从 axios 错误中识别错误类别。
 * - 401/403 → auth
 * - 400/422 → bad-request
 * - ECONNREFUSED/ENOTFOUND/network → network
 * - timeout/abort → timeout
 * - 其它 → unknown
 *
 * 始终返回非空字符串，避免 caller 在 exactOptionalPropertyTypes 下出现
 * `T | undefined` 不能赋给 `T?` 的报错。
 */
export type ErrorKind = 'network' | 'auth' | 'bad-request' | 'timeout' | 'unknown'
export function classifyError(err: any): ErrorKind {
  if (!err) return 'unknown';
  if (err.name === 'AbortError' || err.code === 'ABORTED' || /timeout|超时/i.test(err.message || '')) {
    return 'timeout';
  }
  const status = err.response?.status;
  if (status === 401 || status === 403) return 'auth';
  if (status === 400 || status === 422) return 'bad-request';
  const code = err.code || '';
  if (
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    /network|fetch failed/i.test(err.message || '')
  ) {
    return 'network';
  }
  return 'unknown';
}

/** 提取可读的 error message，剥离 axios 内部堆栈 */
export function extractErrorMessage(err: any): string {
  if (!err) return '连接失败';
  return (
    err.response?.data?.error?.message ||
    err.response?.data?.message ||
    err.response?.data?.error?.code?.message ||
    err.message ||
    '连接失败'
  );
}
