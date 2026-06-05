/**
 * 统一错误处理工具
 * 提供标准化的错误分类、日志记录和用户通知机制
 */
import log from 'electron-log'
import { BrowserWindow } from 'electron'

// ─── 错误分类 ────────────────────────────────────────────────
export enum ErrorLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

export enum ErrorCategory {
  VALIDATION = 'validation',      // 参数验证失败
  DATABASE = 'database',          // 数据库操作失败
  NETWORK = 'network',            // 网络请求失败
  FILE_SYSTEM = 'file_system',    // 文件系统操作失败
  AI_SERVICE = 'ai_service',      // AI 服务调用失败
  IPC = 'ipc',                    // IPC 通信失败
  UNKNOWN = 'unknown',            // 未知错误
}

export class AppError extends Error {
  constructor(
    message: string,
    public category: ErrorCategory,
    public level: ErrorLevel = ErrorLevel.ERROR,
    public originalError?: unknown,
    public context?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'AppError'
  }
}

// ─── 日志记录 ────────────────────────────────────────────────
export function logError(
  error: unknown,
  category: ErrorCategory = ErrorCategory.UNKNOWN,
  context?: Record<string, unknown>
): void {
  const err = error instanceof AppError ? error : new AppError(
    error instanceof Error ? error.message : String(error),
    category,
    ErrorLevel.ERROR,
    error,
    context
  )

  const logData = {
    message: err.message,
    category: err.category,
    level: err.level,
    context: err.context,
    stack: err.stack,
  }

  switch (err.level) {
    case ErrorLevel.DEBUG:
      log.debug('[AppError]', logData)
      break
    case ErrorLevel.INFO:
      log.info('[AppError]', logData)
      break
    case ErrorLevel.WARNING:
      log.warn('[AppError]', logData)
      break
    case ErrorLevel.ERROR:
    case ErrorLevel.CRITICAL:
      log.error('[AppError]', logData)
      break
  }
}

export function logInfo(message: string, context?: Record<string, unknown>): void {
  log.info(message, context || {})
}

export function logDebug(message: string, context?: Record<string, unknown>): void {
  log.debug(message, context || {})
}

export function logWarn(message: string, context?: Record<string, unknown>): void {
  log.warn(message, context || {})
}

// ─── 用户通知 ────────────────────────────────────────────────
export function notifyUser(
  win: BrowserWindow | null,
  message: string,
  type: 'info' | 'warning' | 'error' | 'success' = 'error'
): void {
  if (!win || win.isDestroyed()) return

  win.webContents.send('app-error', {
    message,
    type,
    timestamp: Date.now(),
  })
}

// ─── 安全错误消息（不暴露内部细节给用户） ─────────────────────
export function getSafeErrorMessage(error: unknown): string {
  if (error instanceof AppError) {
    switch (error.category) {
      case ErrorCategory.VALIDATION:
        return '参数无效，请检查输入'
      case ErrorCategory.DATABASE:
        return '数据库操作失败，请重试'
      case ErrorCategory.NETWORK:
        return '网络连接失败，请检查设置'
      case ErrorCategory.FILE_SYSTEM:
        return '文件操作失败，请检查文件是否存在'
      case ErrorCategory.AI_SERVICE:
        return 'AI 服务调用失败，请检查模型配置'
      default:
        return '操作失败，请重试'
    }
  }
  return '未知错误，请重试'
}

// ─── IPC Handler 统一错误包装器 ───────────────────────────────
export async function withErrorHandling<T>(
  handler: () => Promise<T>,
  context: string,
  win?: BrowserWindow | null
): Promise<T> {
  try {
    return await handler()
  } catch (error) {
    if (error instanceof AppError) {
      logError(error, error.category, { context, ...error.context })
      notifyUser(win || null, error.message, error.level === ErrorLevel.WARNING ? 'warning' : 'error')
    } else {
      const appError = new AppError(
        error instanceof Error ? error.message : String(error),
        ErrorCategory.UNKNOWN,
        ErrorLevel.ERROR,
        error,
        { context }
      )
      logError(appError)
      notifyUser(win || null, getSafeErrorMessage(error), 'error')
    }
    throw error
  }
}
