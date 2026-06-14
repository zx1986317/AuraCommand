/**
 * 云端模型配置 IPC 模块
 * 支持多个云端模型的 CRUD
 *
 * P0 #1 修复：API Key 一律走 Keychain 加密（safeStorage）。
 * 本文件只负责 IPC 协议；真实密文存取封装在 ../util/apiKeyStore.ts。
 */
import { IpcModule, IpcContext } from './index'
import axios from 'axios'
import {
  SaveCloudConfigSchema,
  SaveCloudModelSchema,
  DeleteCloudModelSchema,
  TestCloudModelSchema,
  validateInput,
} from './schemas'
import {
  withErrorHandling,
  logInfo,
  logError,
  ErrorCategory,
  ErrorLevel,
  AppError,
} from '../errorHandler'
import {
  getAllPublicCloudModels,
  saveCloudModel as storeSave,
  deleteCloudModel as storeDelete,
  findModelForCapability,
  migratePlaintextApiKeys,
  getRealApiKey,
  type PublicCloudModelEntry,
  type ModelCapabilities,
} from '../util/apiKeyStore'
import { isSecureStorageAvailable } from '../util/secretStore'
import {
  estimateChatCost,
  usdToCny,
  formatCostUSD,
  type ChatMessageLite,
} from '../util/costEstimate'
import {
  extractModelVersion,
  classifyError,
  extractErrorMessage,
  type ProbeResult,
} from '../util/cloudProbe'
import { usageTracker } from '../util/usageTracker'
import type { OverallUsageStats } from '../util/usageTracker'

export type { ModelCapabilities, PublicCloudModelEntry, OverallUsageStats }

/**
 * 业务：发一次最小化测试请求
 * 这里只依赖 apiKey 字符串，不依赖 CloudModelEntry，调用方决定从哪里取 key
 *
 * P1 #6：返回更丰富的诊断信息（latencyMs / httpStatus / modelVersion / errorKind），
 * 让 UI 不再只能看到 success / fail 二元结果。
 */
async function probeCloudConnection(opts: {
  provider: string
  apiKey: string
  baseUrl: string
  model: string
}): Promise<ProbeResult> {
  const { provider, apiKey, baseUrl, model } = opts
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)

  const imageKeywords = ['dall-e', 'gpt-image', 'wanx', 't2i', 'cogview', '-image']
  const isImageModel = imageKeywords.some(k => model.toLowerCase().includes(k))
  const embedKeywords = ['embed', 'embedding', 'text-embedding']
  const isEmbeddingModel = embedKeywords.some(k => model.toLowerCase().includes(k))

  let url: string
  let headers: Record<string, string>
  let body: any

  if (isEmbeddingModel) {
    if (provider === 'dashscope') {
      const isMM = model.includes('vision') || model.includes('multimodal')
      url = isMM
        ? 'https://dashscope.aliyuncs.com/api/v1/services/embeddings/multimodal-embedding/multimodal-embedding'
        : 'https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding'
      body = isMM
        ? { model, input: { contents: [{ text: 'test' }] } }
        : { model, input: { texts: ['test'] }, parameters: { text_type: 'query' } }
    } else if (provider === 'zhipu') {
      url = 'https://open.bigmodel.cn/api/paas/v4/embeddings'
      body = { model, input: 'test' }
    } else {
      url = `${baseUrl || 'https://api.openai.com/v1'}/embeddings`
      body = { model, input: 'test' }
    }
    headers = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
  } else if (isImageModel) {
    if (provider === 'dashscope') {
      url = `https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation`
    } else if (provider === 'zhipu') {
      url = `https://open.bigmodel.cn/api/paas/v4/images/generations`
    } else {
      url = `${baseUrl || 'https://api.openai.com/v1'}/images/generations`
    }
    headers = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
    if (provider === 'dashscope') {
      body = { model, input: { messages: [{ role: 'user', content: [{ text: 'test' }] }] }, parameters: { n: 1, size: '1024*1024' } }
    } else {
      body = { model, prompt: 'test', n: 1, size: '256x256' }
    }
  } else {
    if (provider === 'claude') {
      url = `${baseUrl || 'https://api.anthropic.com/v1'}/messages`
      headers = { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }
      body = { model, max_tokens: 10, messages: [{ role: 'user', content: 'Hi' }] }
    } else if (provider === 'zhipu') {
      url = `${baseUrl || 'https://open.bigmodel.cn/api/paas/v4'}/chat/completions`
      headers = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
      body = { model, max_tokens: 10, messages: [{ role: 'user', content: 'Hi' }] }
    } else if (provider === 'dashscope') {
      url = `${baseUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1'}/chat/completions`
      headers = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
      body = { model, max_tokens: 10, messages: [{ role: 'user', content: 'Hi' }] }
    } else {
      url = `${baseUrl || 'https://api.openai.com/v1'}/chat/completions`
      headers = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
      body = { model, max_tokens: 10, messages: [{ role: 'user', content: 'Hi' }] }
    }
  }

  logInfo('[Cloud Test] Testing connection', { url, model, provider, isImageModel, isEmbeddingModel })

  const startedAt = Date.now()
  try {
    const response = await axios.post(url, body, { headers, signal: controller.signal })
    const latencyMs = Date.now() - startedAt
    const modelVersion = extractModelVersion(response) || model
    logInfo('[Cloud Test] Connection successful', { status: response.status, latencyMs, modelVersion })
    return {
      success: true,
      latencyMs,
      httpStatus: response.status,
      modelVersion,
      endpoint: url,
    }
  } catch (err: any) {
    const latencyMs = Date.now() - startedAt
    return {
      success: false,
      latencyMs,
      error: extractErrorMessage(err),
      errorKind: classifyError(err),
      endpoint: url,
    }
  } finally {
    clearTimeout(timeout)
  }
}

export function createCloudModule(ctx: IpcContext): IpcModule {
  const getWin = () => ctx.getWin()

  return {
    // P0 #1：暴露安全状态给前端，让 UI 可以决定是否显示"明文降级"提示
    'secret-store-status': async () => {
      return withErrorHandling(async () => {
        return { secure: isSecureStorageAvailable() }
      }, 'secret-store-status')
    },

    // 启动时迁移老数据（幂等）；UI 可在 "保存" 失败时主动触发
    'migrate-cloud-api-keys': async () => {
      return withErrorHandling(async () => {
        const r = await migratePlaintextApiKeys()
        logInfo('[Cloud] migrate-cloud-api-keys', r)
        return r
      }, 'migrate-cloud-api-keys', getWin())
    },

    'get-cloud-config': async () => {
      return withErrorHandling(async () => {
        const models = await getAllPublicCloudModels()
        const first = models[0]
        if (first) {
          // P0 #1：永远不返回明文 apiKey
          return { provider: first.provider, apiKey: '', baseUrl: first.baseUrl, modelName: first.modelName, apiKeyMasked: first.apiKeyMasked }
        }
        return { provider: '', apiKey: '', baseUrl: '', modelName: '', apiKeyMasked: '' }
      }, 'get-cloud-config')
    },

    'get-cloud-models': async () => {
      return withErrorHandling(async () => {
        // 公开视图：永远不包含明文
        return getAllPublicCloudModels()
      }, 'get-cloud-models')
    },

    'find-model-for-capability': async (_event: any, capability: string) => {
      return withErrorHandling(async () => {
        const validCapabilities = ['chat', 'vision', 'imageGen', 'embedding', 'videoGen']
        if (!validCapabilities.includes(capability)) {
          throw new AppError(`无效的能力类型: ${capability}`, ErrorCategory.VALIDATION, ErrorLevel.WARNING)
        }
        return findModelForCapability(capability as keyof ModelCapabilities)
      }, 'find-model-for-capability')
    },

    'save-cloud-model': async (_event: any, entry: any) => {
      return withErrorHandling(async () => {
        const validated = validateInput(SaveCloudModelSchema, entry, 'save-cloud-model')
        const models = await storeSave({
          ...(validated.id ? { id: validated.id } : {}),
          name: validated.name,
          provider: validated.provider,
          apiKey: validated.apiKey,
          baseUrl: validated.baseUrl,
          modelName: validated.modelName,
          ...(validated.capabilities ? { capabilities: validated.capabilities } : {}),
          ...(validated.isVision !== undefined ? { isVision: validated.isVision } : {}),
        })
        logInfo('Cloud model saved', { id: validated.id, name: validated.name })
        return { success: true, models }
      }, 'save-cloud-model', getWin())
    },

    'delete-cloud-model': async (_event: any, id: string) => {
      return withErrorHandling(async () => {
        const validated = validateInput(DeleteCloudModelSchema, { id }, 'delete-cloud-model')
        const models = await storeDelete(validated.id)
        logInfo('Cloud model deleted', { id: validated.id })
        return { success: true, models }
      }, 'delete-cloud-model', getWin())
    },

    'is-cloud-ai-enabled': async () => {
      return withErrorHandling(async () => {
        const models = await getAllPublicCloudModels()
        return models.length > 0
      }, 'is-cloud-ai-enabled')
    },

    // P1：费用预估（仅展示，不发起真实请求）
    'estimate-chat-cost': async (_event: any, payload: {
      provider: string;
      modelName: string;
      messages: ChatMessageLite[];
      expectedOutputTokens?: number;
    }) => {
      return withErrorHandling(async () => {
        const opt: { expectedOutputTokens?: number } = {};
        if (payload.expectedOutputTokens !== undefined) opt.expectedOutputTokens = payload.expectedOutputTokens;
        const r = estimateChatCost(payload.provider, payload.modelName, payload.messages || [], opt);
        return {
          ...r,
          cny: usdToCny(r.totalUSD),
          inputUSDFmt: formatCostUSD(r.inputUSD),
          outputUSDFmt: formatCostUSD(r.outputUSD),
          totalUSDFmt: formatCostUSD(r.totalUSD),
        };
      }, 'estimate-chat-cost')
    },

    'save-cloud-config': async (_event: any, config: any) => {
      return withErrorHandling(async () => {
        const validated = validateInput(SaveCloudConfigSchema, config, 'save-cloud-config')
        const models = await getAllPublicCloudModels()
        if (models.length > 0) {
          const first = models[0]!
          await storeSave({
            id: first.id,
            name: first.name,
            provider: validated.provider,
            apiKey: validated.apiKey,
            baseUrl: validated.baseUrl,
            modelName: validated.modelName,
            capabilities: first.capabilities,
          })
        } else {
          await storeSave({
            name: validated.modelName,
            provider: validated.provider,
            apiKey: validated.apiKey,
            baseUrl: validated.baseUrl,
            modelName: validated.modelName,
          })
        }
        logInfo('Cloud config saved', { provider: validated.provider, modelName: validated.modelName })
        return { success: true }
      }, 'save-cloud-config', getWin())
    },

    'test-cloud-model': async (_event: any, config: any) => {
      return withErrorHandling(async () => {
        const validated = validateInput(TestCloudModelSchema, config, 'test-cloud-model')

        // P0 #1：测试时如果用户没传 apiKey，从 Keychain 取真值
        let apiKey = validated.apiKey
        if (!apiKey && (config as any).modelId) {
          const real = await getRealApiKey((config as any).modelId)
          if (real) apiKey = real
        }
        if (!apiKey) {
          return { success: false, error: '未提供 API Key', errorKind: 'auth' as const }
        }

        return probeCloudConnection({
          provider: validated.provider,
          apiKey,
          baseUrl: validated.baseUrl,
          model: validated.model,
        })
      }, 'test-cloud-model', getWin()).catch((err: any) => {
        logError(err, ErrorCategory.NETWORK, { provider: config?.provider, model: config?.model })
        return {
          success: false,
          error: extractErrorMessage(err),
          errorKind: classifyError(err),
        }
      })
    },

    /**
     * P0 #1 专用：从 Keychain 读真值，仅在主进程 → 外部 HTTP 时内部使用。
     * 任何前端调用都应被前端白名单拒绝（仅暴露给主进程内部模块）。
     */
    'internal-resolve-api-key': async (_event: any, modelId: string) => {
      return withErrorHandling(async () => {
        const real = await getRealApiKey(modelId)
        return { apiKey: real || '' }
      }, 'internal-resolve-api-key')
    },

    /**
     * P2 #3：用量面板 - 返回累计统计
     */
    'get-usage-stats': async (): Promise<OverallUsageStats> => {
      return withErrorHandling(async () => {
        return usageTracker.getStats()
      }, 'get-usage-stats')
    },

    /**
     * P2 #3：用量面板 - 清空历史
     */
    'reset-usage-stats': async (): Promise<{ success: boolean }> => {
      return withErrorHandling(async () => {
        usageTracker.reset()
        return { success: true }
      }, 'reset-usage-stats')
    },
  }
}
