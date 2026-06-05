import { logger } from './logger';

type ErrorHandler = (message: string) => void;

let globalErrorHandler: ErrorHandler | null = null;

export function setGlobalErrorHandler(handler: ErrorHandler) {
  globalErrorHandler = handler;
}

export async function safeInvoke<T = any>(
  channel: string,
  args?: any,
  options?: { silent?: boolean; fallback?: T },
): Promise<T | undefined> {
  if (!window.ipcRenderer) {
    if (!options?.silent) {
      globalErrorHandler?.('Electron IPC 不可用');
    }
    return options?.fallback;
  }
  try {
    return await window.ipcRenderer.invoke(channel, args);
  } catch (err) {
    logger.error(`IPC [${channel}] failed`, err);
    if (!options?.silent) {
      globalErrorHandler?.(`操作失败: ${channel}`);
    }
    return options?.fallback;
  }
}
