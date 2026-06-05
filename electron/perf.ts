/**
 * 性能埋点工具：为关键路径添加耗时追踪
 */
import log from 'electron-log'

interface PerfSpan {
  name: string
  startTime: number
  endTime: number | undefined
  metadata: Record<string, unknown> | undefined
}

const activeSpans = new Map<string, PerfSpan>()

export function startSpan(name: string, metadata?: Record<string, unknown>): string {
  const spanId = `${name}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`
  activeSpans.set(spanId, {
    name,
    startTime: performance.now(),
    endTime: undefined,
    metadata: metadata ?? undefined,
  })
  return spanId
}

export function endSpan(spanId: string, additionalMetadata?: Record<string, unknown>): number | null {
  const span = activeSpans.get(spanId)
  if (!span) {
    log.warn('[Perf] Unknown span:', spanId)
    return null
  }

  span.endTime = performance.now()
  const duration = span.endTime - span.startTime
  activeSpans.delete(spanId)

  const metadata = { ...span.metadata, ...additionalMetadata }

  if (duration > 5000) {
    log.warn(`[Perf] SLOW: ${span.name} took ${duration.toFixed(1)}ms`, metadata)
  } else if (duration > 1000) {
    log.info(`[Perf] ${span.name} took ${duration.toFixed(1)}ms`, metadata)
  } else {
    log.debug(`[Perf] ${span.name} took ${duration.toFixed(1)}ms`, metadata)
  }

  return duration
}

export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>,
  metadata?: Record<string, unknown>
): Promise<T> {
  const spanId = startSpan(name, metadata)
  try {
    const result = await fn()
    endSpan(spanId, { success: true })
    return result
  } catch (err) {
    endSpan(spanId, { success: false, error: err instanceof Error ? err.message : String(err) })
    throw err
  }
}

export function measureSync<T>(
  name: string,
  fn: () => T,
  metadata?: Record<string, unknown>
): T {
  const spanId = startSpan(name, metadata)
  try {
    const result = fn()
    endSpan(spanId, { success: true })
    return result
  } catch (err) {
    endSpan(spanId, { success: false, error: err instanceof Error ? err.message : String(err) })
    throw err
  }
}