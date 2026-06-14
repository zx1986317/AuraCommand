/**
 * 多模型用量追踪
 *
 * 纯函数和类型定义已迁移至 src/shared/usageTracker.ts（渲染进程安全）。
 * 此文件保留 Electron 依赖的持久化单例 UsageTrackerImpl。
 */
import { app } from 'electron';
import { promises as fs } from 'fs';
import * as path from 'path';

// Re-export 共享类型和纯函数
export {
  aggregateUsage,
  formatRelativeTime,
  type UsageRecord,
  type ModelUsageStats,
  type OverallUsageStats,
} from '../../src/shared/usageTracker';

import type { UsageRecord, OverallUsageStats } from '../../src/shared/usageTracker';
import { aggregateUsage } from '../../src/shared/usageTracker';

const MAX_RECORDS = 5000;
const FLUSH_DEBOUNCE_MS = 2000;

class UsageTrackerImpl {
  private records: UsageRecord[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private loaded = false;
  private storagePath: string | null = null;

  private getStoragePath(): string {
    if (this.storagePath) return this.storagePath;
    try {
      const userData = app.getPath('userData');
      this.storagePath = path.join(userData, 'usage-log.json');
    } catch {
      // 单元测试 / 渲染器进程：app 不可用，回退到 cwd
      this.storagePath = path.join(process.cwd(), 'usage-log.json');
    }
    return this.storagePath;
  }

  async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const buf = await fs.readFile(this.getStoragePath(), 'utf-8');
      const parsed = JSON.parse(buf);
      if (Array.isArray(parsed?.records)) {
        this.records = parsed.records.slice(-MAX_RECORDS);
      }
    } catch {
      // 首次启动 / 文件不存在 → 保持空
    }
    this.loaded = true;
  }

  record(usage: Omit<UsageRecord, 'at'>): void {
    this.records.push({ ...usage, at: Date.now() });
    if (this.records.length > MAX_RECORDS) {
      this.records = this.records.slice(-MAX_RECORDS);
    }
    this.scheduleFlush();
  }

  /** 测试用：替换整条记录流 */
  _setRecords(records: UsageRecord[]): void {
    this.records = records.slice(-MAX_RECORDS);
  }

  getStats(): OverallUsageStats {
    return aggregateUsage(this.records);
  }

  reset(): void {
    this.records = [];
    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flush().catch(() => { /* 静默失败，不影响主流程 */ });
    }, FLUSH_DEBOUNCE_MS);
  }

  async flush(): Promise<void> {
    const payload = JSON.stringify({ records: this.records, savedAt: Date.now() }, null, 2);
    try {
      await fs.writeFile(this.getStoragePath(), payload, 'utf-8');
    } catch {
      // 写入失败（磁盘满、权限不足等）不影响调用方
    }
  }
}

export const usageTracker = new UsageTrackerImpl();
