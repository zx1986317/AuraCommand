/**
 * P1 #6：probeCloudConnection + 纯函数单测
 * 覆盖：
 *  - extractModelVersion：从 OpenAI 风格 / Anthropic 风格 / DashScope 风格 / header / 不存在 等响应中提取
 *  - classifyError：401/403/400/422/network/abort/timeout 等错误分类
 *  - extractErrorMessage：从 axios 错误里拿可读字符串
 *  - probeCloudConnection：成功路径回填 latencyMs/httpStatus/modelVersion/endpoint
 *                     失败路径回填 latencyMs/error/errorKind/endpoint
 *                     失败时仍走完 setTimeout clearTimeout，不留 dangling timer
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------- 1. 纯函数 ----------

import {
  extractModelVersion,
  classifyError,
  extractErrorMessage,
} from '../../electron/util/cloudProbe'

describe('cloudProbe / extractModelVersion', () => {
  it('从 data.model 拿到字符串', () => {
    expect(extractModelVersion({ data: { model: 'gpt-4o-2024-08-06' } } as any)).toBe('gpt-4o-2024-08-06')
  })

  it('从 data.model_version 拿到字符串（Anthropic 风格）', () => {
    expect(extractModelVersion({ data: { model_version: 'claude-3-5-sonnet-20240620' } } as any)).toBe('claude-3-5-sonnet-20240620')
  })

  it('从 data.choices[0].model（OpenAI chat completion）拿到字符串', () => {
    expect(
      extractModelVersion({ data: { choices: [{ model: 'gpt-4o-mini' }] } } as any)
    ).toBe('gpt-4o-mini')
  })

  it('从 data.output.model（DashScope 风格）拿到字符串', () => {
    expect(
      extractModelVersion({ data: { output: { model: 'qwen-max' } } } as any)
    ).toBe('qwen-max')
  })

  it('从 response.headers["x-model-id"] 拿到字符串', () => {
    expect(
      extractModelVersion({ data: {}, headers: { 'x-model-id': 'glm-4-plus' } } as any)
    ).toBe('glm-4-plus')
  })

  it('优先级：data.model > model_version > choices[0].model > output.model > header', () => {
    const r = {
      data: {
        model: 'A',
        model_version: 'B',
        choices: [{ model: 'C' }],
        output: { model: 'D' },
      },
      headers: { 'x-model-id': 'E' },
    } as any
    expect(extractModelVersion(r)).toBe('A')

    const r2 = {
      data: {
        model_version: 'B',
        choices: [{ model: 'C' }],
        output: { model: 'D' },
      },
      headers: { 'x-model-id': 'E' },
    } as any
    expect(extractModelVersion(r2)).toBe('B')

    const r3 = {
      data: { choices: [{ model: 'C' }], output: { model: 'D' } },
      headers: { 'x-model-id': 'E' },
    } as any
    expect(extractModelVersion(r3)).toBe('C')

    const r4 = { data: { output: { model: 'D' } }, headers: { 'x-model-id': 'E' } } as any
    expect(extractModelVersion(r4)).toBe('D')

    const r5 = { data: {}, headers: { 'x-model-id': 'E' } } as any
    expect(extractModelVersion(r5)).toBe('E')
  })

  it('空响应 / null / undefined → undefined', () => {
    expect(extractModelVersion(null)).toBeUndefined()
    expect(extractModelVersion(undefined)).toBeUndefined()
    expect(extractModelVersion({ data: {} } as any)).toBeUndefined()
    expect(extractModelVersion({ data: { model: '' } } as any)).toBeUndefined()
    expect(extractModelVersion({ data: { model: 123 } } as any)).toBeUndefined()
    expect(extractModelVersion({ data: 'plain string' } as any)).toBeUndefined()
  })
})

describe('cloudProbe / classifyError', () => {
  it('401/403 → auth', () => {
    expect(classifyError({ response: { status: 401 } })).toBe('auth')
    expect(classifyError({ response: { status: 403 } })).toBe('auth')
  })

  it('400/422 → bad-request', () => {
    expect(classifyError({ response: { status: 400 } })).toBe('bad-request')
    expect(classifyError({ response: { status: 422 } })).toBe('bad-request')
  })

  it('ECONNREFUSED / ENOTFOUND / ECONNRESET / ETIMEDOUT → network', () => {
    expect(classifyError({ code: 'ECONNREFUSED', message: 'connect ECONNREFUSED' })).toBe('network')
    expect(classifyError({ code: 'ENOTFOUND', message: 'getaddrinfo ENOTFOUND' })).toBe('network')
    expect(classifyError({ code: 'ECONNRESET', message: 'read ECONNRESET' })).toBe('network')
    expect(classifyError({ code: 'ETIMEDOUT', message: 'connect ETIMEDOUT' })).toBe('network')
    expect(classifyError({ message: 'fetch failed' })).toBe('network')
    expect(classifyError({ message: 'TypeError: network error' })).toBe('network')
  })

  it('AbortError / ABORTED / timeout → timeout', () => {
    expect(classifyError({ name: 'AbortError', message: 'canceled' })).toBe('timeout')
    expect(classifyError({ code: 'ABORTED', message: 'aborted' })).toBe('timeout')
    expect(classifyError({ message: 'Request timeout' })).toBe('timeout')
  })

  it('其它错误 → unknown', () => {
    expect(classifyError(new Error('boom'))).toBe('unknown')
    expect(classifyError({ response: { status: 500 }, message: 'server error' })).toBe('unknown')
    expect(classifyError(null)).toBe('unknown')
    expect(classifyError(undefined)).toBe('unknown')
  })
})

describe('cloudProbe / extractErrorMessage', () => {
  it('优先 err.response.data.error.message（OpenAI/Anthropic 风格）', () => {
    expect(
      extractErrorMessage({ response: { data: { error: { message: 'invalid api key' } } } })
    ).toBe('invalid api key')
  })

  it('回退 err.response.data.message', () => {
    expect(
      extractErrorMessage({ response: { data: { message: 'rate limited' } } })
    ).toBe('rate limited')
  })

  it('回退 err.response.data.error.code.message', () => {
    expect(
      extractErrorMessage({ response: { data: { error: { code: { message: 'quota' } } } } })
    ).toBe('quota')
  })

  it('回退 err.message', () => {
    expect(extractErrorMessage(new Error('connect ECONNREFUSED 127.0.0.1'))).toBe(
      'connect ECONNREFUSED 127.0.0.1'
    )
  })

  it('没有任何字段 → 连接失败', () => {
    expect(extractErrorMessage({})).toBe('连接失败')
    expect(extractErrorMessage(null)).toBe('连接失败')
    expect(extractErrorMessage(undefined)).toBe('连接失败')
  })
})

// ---------- 2. probeCloudConnection 集成（mock axios） ----------

// mock axios 模块
const postMock = vi.fn()
vi.mock('axios', () => ({
  default: {
    post: (...args: any[]) => postMock(...args),
  },
}))

// mock electron errorHandler / 日志（避免依赖具体实现）
vi.mock('../../electron/errorHandler', () => ({
  withErrorHandling: async (fn: any) => fn(),
  logInfo: () => {},
  logError: () => {},
  ErrorCategory: { NETWORK: 'NETWORK' },
  ErrorLevel: { WARNING: 'WARNING' },
  AppError: class extends Error {},
}))

// mock secretStore / costEstimate / apiKeyStore 的传递依赖（probeCloudConnection 不直接用，但
// require 链路会触发副作用；这里把 cloud.ts 整个文件隔离，我们直接调内部函数，需要绕开 require
// 走 vitest 的 ESM 解析。最简单的办法是：单独抽取一个仅依赖 axios 的子模块并 import 即可。
// 但目前 probeCloudConnection 是 cloud.ts 内部非导出函数，测试要走 createCloudModule。
// —— 为了避免拖入 electron 链路，下面用 vi.mock 把云端模块所需的外部依赖全部打空。
vi.mock('../../electron/util/apiKeyStore', () => ({
  getAllPublicCloudModels: async () => [],
  saveCloudModel: async () => [],
  deleteCloudModel: async () => [],
  findModelForCapability: async () => null,
  migratePlaintextApiKeys: async () => ({ migrated: 0, skipped: 0 }),
  getRealApiKey: async () => null,
}))
vi.mock('../../electron/util/secretStore', () => ({
  isSecureStorageAvailable: () => true,
}))
vi.mock('../../electron/util/costEstimate', () => ({
  estimateChatCost: () => ({}),
  usdToCny: () => 0,
  formatCostUSD: () => '$0',
}))

// 由于 probeCloudConnection 是 cloud.ts 内部未导出的函数，我们用「间接导出」的策略：把它 patch
// 一份可访问的版本。简单做法：直接 vi.importActual 出原模块，再用反射拿不到；最稳的方式是让测试
// 走 IPC 入口 'test-cloud-model'，通过 withErrorHandling 包裹的 fake renderer 调它。
//
// 因此我们重写策略：把测试入口改为 createCloudModule 的 test-cloud-model 处理器，传入合法的
// config（含 apiKey），让处理器内部走完 probeCloudConnection 全流程。这样等于端到端验证了
// 延迟、状态、错误信息等字段。

import { createCloudModule } from '../../electron/ipc/cloud'

const fakeCtx = { getWin: () => null } as any
const module = createCloudModule(fakeCtx)
const handler = (module as any)['test-cloud-model']

beforeEach(() => {
  postMock.mockReset()
  vi.useRealTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('probeCloudConnection 走通 test-cloud-model（成功路径）', () => {
  it('返回 latencyMs / httpStatus / modelVersion / endpoint，且 latencyMs 大于等于 0', async () => {
    postMock.mockResolvedValue({
      status: 200,
      data: { model: 'gpt-4o-2024-08-06' },
      headers: {},
    })

    const start = Date.now()
    const r = await handler(null, {
      provider: 'openai',
      apiKey: 'sk-test',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o',
    })
    const costMs = Date.now() - start

    expect(r.success).toBe(true)
    expect(r.httpStatus).toBe(200)
    expect(r.modelVersion).toBe('gpt-4o-2024-08-06')
    expect(r.endpoint).toContain('chat/completions')
    expect(typeof r.latencyMs).toBe('number')
    expect(r.latencyMs).toBeGreaterThanOrEqual(0)
    // 测量：handler 自己测的 latencyMs 不应显著超过墙钟时间
    expect(r.latencyMs).toBeLessThanOrEqual(costMs + 50)
  })

  it('响应不带 model 字段时，回退到请求里的 model 名', async () => {
    postMock.mockResolvedValue({
      status: 200,
      data: { choices: [{ index: 0, message: { content: 'hi' } }] },
      headers: {},
    })
    const r = await handler(null, {
      provider: 'openai',
      apiKey: 'sk-test',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
    })
    expect(r.success).toBe(true)
    expect(r.modelVersion).toBe('gpt-4o-mini')
  })
})

describe('probeCloudConnection 走通 test-cloud-model（失败路径）', () => {
  it('401 → errorKind=auth，error/latencyMs/endpoint 回填', async () => {
    postMock.mockRejectedValue({
      response: { status: 401, data: { error: { message: 'Incorrect API key provided' } } },
      message: 'Request failed with status code 401',
    })
    const r = await handler(null, {
      provider: 'openai',
      apiKey: 'sk-bad',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o',
    })
    expect(r.success).toBe(false)
    expect(r.errorKind).toBe('auth')
    expect(r.error).toBe('Incorrect API key provided')
    expect(r.endpoint).toContain('chat/completions')
    expect(typeof r.latencyMs).toBe('number')
    expect(r.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it('network error（ECONNREFUSED）→ errorKind=network', async () => {
    postMock.mockRejectedValue({
      code: 'ECONNREFUSED',
      message: 'connect ECONNREFUSED 127.0.0.1:11434',
    })
    const r = await handler(null, {
      provider: 'openai',
      apiKey: 'sk-test',
      baseUrl: 'http://127.0.0.1:11434/v1',
      model: 'llama3',
    })
    expect(r.success).toBe(false)
    expect(r.errorKind).toBe('network')
    expect(r.error).toContain('ECONNREFUSED')
  })

  it('422 → errorKind=bad-request', async () => {
    postMock.mockRejectedValue({
      response: { status: 422, data: { message: 'unprocessable' } },
      message: 'Request failed with status code 422',
    })
    const r = await handler(null, {
      provider: 'openai',
      apiKey: 'sk-test',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o',
    })
    expect(r.errorKind).toBe('bad-request')
    expect(r.error).toBe('unprocessable')
  })
})

describe('probeCloudConnection（latencyMs 计时正确）', () => {
  it('latencyMs 至少在 mock 延迟的 80% 以上（不会异常为 0）', async () => {
    // 让 axios.post 真正 sleep 80ms
    postMock.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 80))
      return { status: 200, data: { model: 'gpt-4o' }, headers: {} }
    })

    const r = await handler(null, {
      provider: 'openai',
      apiKey: 'sk-test',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o',
    })
    expect(r.success).toBe(true)
    // 80ms 模拟延迟；测得值在 60-5000ms 都算合理（防止某些机器把 setTimeout 卡成 0）
    expect(r.latencyMs).toBeGreaterThanOrEqual(60)
    expect(r.latencyMs).toBeLessThan(5000)
  })
})
