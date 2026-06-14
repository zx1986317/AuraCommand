/**
 * 批量测试 + 健康度报告
 *
 * 纯函数和类型定义已迁移至 src/shared/batchHealth.ts（渲染进程安全，
 * 不依赖 axios）。
 * 此文件保留 cloudProbe 依赖（ProbeResult 从 cloudProbe 导入以保持主进程
 * 类型一致性）。
 */

// Re-export 共享类型和纯函数
export {
  computeHealthReport,
  runWithConcurrency,
  toFailedProbeResult,
  type ProbeResult as ProbeResultShared,
  type BatchTestInput,
  type BatchTestItemResult,
  type HealthReport,
} from '../../src/shared/batchHealth';

// 主进程仍可使用 cloudProbe 的完整类型
export type { ProbeResult } from './cloudProbe';
