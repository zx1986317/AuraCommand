/**
 * 模型路由器
 * 支持多云端模型，按 cloudModelId 路由到指定模型
 * 失败降级（云端失败→本地）
 */
import { getSetting } from './db'
import * as ollama from './ollama'
import * as cloudModel from './cloudModel'
import type { CloudConfig, CloudMessage, CloudContentPart } from './cloudModel'
import { performLocalOCR, isVisionModel } from './ocr'
import log from 'electron-log'
import { startSpan, endSpan } from './perf'
import { usageTracker } from './util/usageTracker'
import { estimateChatCost } from './util/costEstimate'
import { getRealApiKey } from './util/apiKeyStore'

export interface ModelRouterOptions {
  messages: CloudMessage[]
  model?: string
  temperature?: number
  top_p?: number
  maxTokens?: number
  num_ctx?: number
  onChunk?: (chunk: string, reasoning?: string) => void
  signal?: AbortSignal
  cloudModelId?: string | undefined
  onFallback?: (from: string, to: string) => void
  tools?: any[]
  tool_choice?: any
}

interface ModelCapabilities {
  chat: boolean
  vision: boolean
  imageGen: boolean
  embedding: boolean
  videoGen: boolean
}

interface CloudModelEntry {
  id: string
  name: string
  provider: string
  apiKey: string
  baseUrl: string
  modelName: string
  capabilities: ModelCapabilities
  isVision?: boolean
}

async function getCloudModels(): Promise<CloudModelEntry[]> {
  try {
    const raw = await getSetting('cloud_models')
    if (raw) {
      if (typeof raw === 'string') return JSON.parse(raw)
      return raw as CloudModelEntry[]
    }
  } catch {}
  try {
    const provider = await getSetting('cloud_provider')
    const apiKey = await getSetting('cloud_api_key')
    const baseUrl = await getSetting('cloud_base_url')
    const modelName = await getSetting('cloud_model_name')
    if (provider && apiKey && modelName) {
      return [{
        id: '_legacy',
        name: modelName,
        provider,
        apiKey,
        baseUrl: baseUrl || '',
        modelName,
        capabilities: {
          chat: true,
          vision: false,
          imageGen: false,
          embedding: false,
          videoGen: false,
        },
      }]
    }
  } catch {}
  return []
}

async function getCloudConfigById(id?: string): Promise<CloudConfig | null> {
  const models = await getCloudModels()
  if (models.length === 0) return null
  const target = id ? models.find(m => m.id === id) : models[0]
  if (!target) return null
  
  // P0 #1 修复：API Key 存储在 secretStore 中，需要从密文存储中获取真实值
  let realApiKey = target.apiKey
  if (!realApiKey && target.id) {
    realApiKey = await getRealApiKey(target.id) || ''
  }
  
  log.info(`[ModelRouter] Cloud config for ${id || 'default'}: provider=${target.provider}, apiKey=${realApiKey ? '***' + realApiKey.slice(-4) : 'EMPTY'}, modelName=${target.modelName}`)
  
  if (!realApiKey) {
    log.warn(`[ModelRouter] No API Key found for cloud model ${target.id}, will fallback to local model`)
    return null
  }
  
  return {
    provider: target.provider,
    apiKey: realApiKey,
    baseUrl: target.baseUrl,
    modelName: target.modelName,
  }
}

async function getCloudConfig(): Promise<CloudConfig | null> {
  return getCloudConfigById()
}

/**
 * 解析用户当前选择的模型对应的云端模型ID
 * 如果用户选择的是云端模型，返回对应的云端模型ID
 * 如果用户选择的是本地模型，返回 undefined
 */
export async function resolveCloudModelId(): Promise<string | undefined> {
  try {
    const selectedModel = await getSetting('selectedModel') || await getSetting('selected_model')
    if (!selectedModel) return undefined
    
    const cloudModelIdMapRaw = await getSetting('cloudModelIdMap')
    if (!cloudModelIdMapRaw) return undefined
    
    const cloudModelIdMap: Record<string, string> = typeof cloudModelIdMapRaw === 'string' 
      ? JSON.parse(cloudModelIdMapRaw) 
      : cloudModelIdMapRaw
    
    return cloudModelIdMap[selectedModel as string]
  } catch {
    return undefined
  }
}

function hasImageContent(messages: CloudMessage[]): boolean {
  return messages.some(m =>
    Array.isArray(m.content) && m.content.some(p => p.type === 'image_url' && p.image_url)
  )
}

/** 从消息中去掉所有图片，只保留文本部分 */
function stripImages(messages: CloudMessage[]): CloudMessage[] {
  return messages.map(m => {
    if (!Array.isArray(m.content)) return m
    const textParts = m.content.filter(p => p.type === 'text')
    if (textParts.length === 0) {
      return { ...m, content: '[图片已省略]' }
    }
    return { ...m, content: textParts as CloudContentPart[] }
  })
}

function extractImageBase64(part: { image_url?: { url: string } }): string {
  const url = part.image_url?.url || ''
  return url.replace(/^data:image\/\w+;base64,/, '')
}

// 缓存本地视觉模型检测结果
let localVisionModelCache: string | null = null
let localVisionModelCacheTime = 0
const VISION_CACHE_TTL = 60_000 // 1 分钟缓存

async function isLocalVisionModel(model?: string): Promise<boolean> {
  if (!model) return false
  // 先用关键词快速匹配（保持兼容性）
  const normalized = model.trim().toLowerCase()
  if (
    normalized.includes('vl') ||
    normalized.includes('vision') ||
    normalized.includes('llava') ||
    normalized.includes('minicpm-v')
  ) {
    return true
  }
  // 通过 Ollama API 检查模型 families（如 gemma3 支持 clip family）
  const now = Date.now()
  if (localVisionModelCache && now - localVisionModelCacheTime < VISION_CACHE_TTL) {
    return localVisionModelCache === model
  }
  try {
    const visionModel = await ollama.getVisionModel()
    if (visionModel) {
      localVisionModelCache = visionModel
      localVisionModelCacheTime = now
      return visionModel === model
    }
  } catch {}
  return false
}

function toOllamaMessages(messages: CloudMessage[]): ollama.ChatMessage[] {
  return messages.map((msg) => {
    if (typeof msg.content === 'string') {
      return { role: msg.role, content: msg.content }
    }

    const text = msg.content
      .filter((part) => part.type === 'text')
      .map((part) => part.text || '')
      .join('\n')

    const images = msg.content
      .filter((part) => part.type === 'image_url' && part.image_url)
      .map((part) => extractImageBase64(part))
      .filter(Boolean)

    const result: ollama.ChatMessage = { role: msg.role, content: text }
    if (images.length > 0) result.images = images
    return result
  })
}

async function ocrPreprocess(messages: CloudMessage[], modelSupportsImages: boolean): Promise<CloudMessage[]> {
  if (!hasImageContent(messages)) return messages

  if (modelSupportsImages) {
    log.info('[ModelRouter] Model supports images, passing images directly')
    return messages
  }

  log.info('[ModelRouter] Model does not support images, running OCR preprocessing...')
  const result: CloudMessage[] = []

  for (const msg of messages) {
    if (!Array.isArray(msg.content)) {
      result.push(msg)
      continue
    }

    const textParts = msg.content.filter(p => p.type === 'text').map(p => p.text || '').join('\n')
    const imageParts = msg.content.filter(p => p.type === 'image_url' && p.image_url)

    if (imageParts.length === 0) {
      result.push(msg)
      continue
    }

    const ocrTexts: string[] = []
    for (const img of imageParts) {
      try {
        const base64 = extractImageBase64(img)
        const ocrText = await performLocalOCR(base64)
        if (ocrText) ocrTexts.push(ocrText)
      } catch (err: any) {
        log.warn('[ModelRouter] Local OCR failed for one image:', err?.message)
        ocrTexts.push('[图片OCR识别失败，请配置视觉模型以获取更好的图片理解能力]')
      }
    }

    const combined = [textParts, ...ocrTexts.map((t, i) => `[图片${imageParts.length > 1 ? i + 1 : ''}中的文字]\n${t}`)]
      .filter(Boolean)
      .join('\n\n')

    result.push({ role: msg.role, content: combined })
  }

  log.info('[ModelRouter] OCR preprocess complete, images replaced with text')
  return result
}

/**
 * 统一对话接口（非流式）
 * 根据用户选择的模型路由，支持双向降级（云端↔本地）
 */
export async function chat(
  options: ModelRouterOptions
): Promise<string> {
  const spanId = startSpan('modelRouter:chat', { cloudModelId: options.cloudModelId, model: options.model })
  const cloudId = options.cloudModelId ?? await resolveCloudModelId()
  const cloudConfig = cloudId ? await getCloudConfigById(cloudId) : null
  const models = await getCloudModels()
  const modelSupportsImages = cloudConfig
    ? isVisionModel(cloudConfig.modelName, models)
    : await isLocalVisionModel(options.model)
  
  const processed = await ocrPreprocess(options.messages, modelSupportsImages)
  const opts = { ...options, messages: processed }

  const isCloud = !!cloudId
  log.info('[ModelRouter] chat called, isCloud:', isCloud, 'cloudId:', cloudId, 'hasImages:', hasImageContent(options.messages), 'modelSupportsImages:', modelSupportsImages)

  if (isCloud) {
    const cloudConfig = await getCloudConfigById(cloudId!)
    if (cloudConfig) {
      try {
        log.info('[ModelRouter] Trying cloud model:', cloudConfig.modelName)
        const cloudOptions: any = {
          messages: opts.messages,
          signal: opts.signal,
        }
        if (opts.temperature !== undefined) cloudOptions.temperature = opts.temperature
        if (opts.top_p !== undefined) cloudOptions.top_p = opts.top_p
        if (opts.maxTokens !== undefined) cloudOptions.maxTokens = opts.maxTokens
        if (opts.tools !== undefined) cloudOptions.tools = opts.tools
        if (opts.tool_choice !== undefined) cloudOptions.tool_choice = opts.tool_choice
        const result = await cloudModel.cloudChat(cloudConfig, cloudOptions)
        // P2 #3：用量面板 - 记录云端调用（基于 token 估算 + 价格表）
        try {
          const est = estimateChatCost(cloudConfig.provider, cloudConfig.modelName, opts.messages, {
            ...(opts.maxTokens !== undefined ? { expectedOutputTokens: opts.maxTokens } : {}),
          })
          usageTracker.record({
            modelId: (cloudConfig as any).id || `${cloudConfig.provider}:${cloudConfig.modelName}`,
            modelName: cloudConfig.modelName,
            provider: cloudConfig.provider,
            inputTokens: est.inputTokens,
            outputTokens: est.outputTokens,
            costUSD: est.totalUSD,
            estimated: true,
          })
        } catch (e) {
          log.warn('[ModelRouter] usageTracker.record failed:', e)
        }
        endSpan(spanId, { provider: 'cloud', model: cloudConfig.modelName })
        return result
      } catch (err: any) {
        const msg = err?.message || ''
        if (
          msg.includes('Unexpected item type in content') ||
          msg.includes('input content must be a string') ||
          msg.includes('InvalidParameter')
        ) {
          endSpan(spanId, { provider: 'cloud', success: false })
          throw err
        }
        log.warn('[ModelRouter] Cloud model failed, falling back to Ollama:', err)
      }
    }
    log.info('[ModelRouter] Falling back to Ollama')
    if (opts.onFallback) opts.onFallback(cloudConfig?.modelName || 'cloud', opts.model || 'ollama')
    const ollamaResult = await chatWithOllama(opts)
    endSpan(spanId, { provider: 'ollama' })
    return ollamaResult
  }

  try {
    log.info('[ModelRouter] Trying Ollama first')
    const ollamaResult = await chatWithOllama(opts)
    endSpan(spanId, { provider: 'ollama' })
    return ollamaResult
  } catch (err: any) {
    log.warn('[ModelRouter] Ollama failed, attempting cloud fallback:', err)
    let cloudConfig = await getCloudConfigById(await resolveCloudModelId())
    log.info('[ModelRouter] Mapped cloud config:', cloudConfig ? cloudConfig.modelName : 'null')
    if (!cloudConfig) {
      cloudConfig = await getCloudConfig()
      log.info('[ModelRouter] First available cloud config:', cloudConfig ? cloudConfig.modelName : 'null')
    }
    if (cloudConfig) {
      try {
        log.info('[ModelRouter] Trying cloud fallback:', cloudConfig.modelName)
        if (opts.onFallback) opts.onFallback(opts.model || 'ollama', cloudConfig.modelName)
        const cloudOptions: any = {
          messages: opts.messages,
          signal: opts.signal,
        }
        if (opts.temperature !== undefined) cloudOptions.temperature = opts.temperature
        if (opts.top_p !== undefined) cloudOptions.top_p = opts.top_p
        if (opts.maxTokens !== undefined) cloudOptions.maxTokens = opts.maxTokens
        if (opts.tools !== undefined) cloudOptions.tools = opts.tools
        if (opts.tool_choice !== undefined) cloudOptions.tool_choice = opts.tool_choice
        const cloudResult = await cloudModel.cloudChat(cloudConfig, cloudOptions)
        endSpan(spanId, { provider: 'cloud-fallback', model: cloudConfig.modelName })
        return cloudResult
      } catch (cloudErr: any) {
        log.error('[ModelRouter] Cloud fallback also failed:', cloudErr)
        const cloudMsg = cloudErr?.response?.data?.error?.message || cloudErr?.message || '未知错误'
        const cloudStatus = cloudErr?.response?.status
        if (cloudStatus === 403) {
          throw new Error(`云端模型拒绝访问(403)：${cloudMsg}。可能原因：模型不支持图片识别或API Key无效`)
        }
        throw new Error(`云端模型调用失败：${cloudMsg}`)
      }
    } else {
      log.error('[ModelRouter] No cloud model configured for fallback')
      throw new Error('本地Ollama未运行，且未配置云端模型。请启动Ollama或配置云端模型。')
    }
  }
}

function chatWithOllama(options: ModelRouterOptions): Promise<string> {
  const ollamaOptions: ollama.OllamaChatOptions = {}
  if (options.temperature !== undefined) ollamaOptions.temperature = options.temperature
  if (options.top_p !== undefined) ollamaOptions.top_p = options.top_p
  if (options.maxTokens !== undefined) ollamaOptions.num_predict = options.maxTokens
  return ollama.generateChat(toOllamaMessages(options.messages), options.model, ollamaOptions)
}

function chatStreamWithOllama(options: ModelRouterOptions): Promise<void> {
  const ollamaOptions: ollama.OllamaChatOptions = {}
  if (options.temperature !== undefined) ollamaOptions.temperature = options.temperature
  if (options.top_p !== undefined) ollamaOptions.top_p = options.top_p
  if (options.maxTokens !== undefined) ollamaOptions.num_predict = options.maxTokens
  if (options.num_ctx !== undefined) ollamaOptions.num_ctx = options.num_ctx
  return ollama.generateChatStream(
    toOllamaMessages(options.messages),
    options.model,
    (data) => {
      if (options.onChunk) options.onChunk(data.content || '', data.reasoning)
    },
    options.signal,
    ollamaOptions
  )
}

/**
 * 统一对话接口（流式）
 */
export async function chatStream(
  options: ModelRouterOptions
): Promise<void> {
  const cloudId = options.cloudModelId ?? await resolveCloudModelId()
  const cloudConfig = cloudId ? await getCloudConfigById(cloudId) : null
  const models = await getCloudModels()
  const modelSupportsImages = cloudConfig
    ? isVisionModel(cloudConfig.modelName, models)
    : await isLocalVisionModel(options.model)
  
  const processed = await ocrPreprocess(options.messages, modelSupportsImages)
  const opts = { ...options, messages: processed }

  const isCloud = !!cloudId

  if (isCloud) {
    const cloudConfig = await getCloudConfigById(cloudId!)
    if (cloudConfig) {
      try {
        const cloudOptions: any = {
          messages: opts.messages,
          onChunk: opts.onChunk,
          signal: opts.signal,
        }
        if (opts.temperature !== undefined) cloudOptions.temperature = opts.temperature
        if (opts.top_p !== undefined) cloudOptions.top_p = opts.top_p
        if (opts.maxTokens !== undefined) cloudOptions.maxTokens = opts.maxTokens
        if (opts.tools !== undefined) cloudOptions.tools = opts.tools
        if (opts.tool_choice !== undefined) cloudOptions.tool_choice = opts.tool_choice
        await cloudModel.cloudChatStream(cloudConfig, cloudOptions)
        return
      } catch (err) {
        log.warn('[ModelRouter] Cloud stream failed, falling back to Ollama:', err)
      }
    }
    if (opts.onFallback) opts.onFallback(cloudConfig?.modelName || 'cloud', opts.model || 'ollama')
    return chatStreamWithOllama(opts)
  }

  try {
    await chatStreamWithOllama(opts)
  } catch (err: any) {
    // 如果是本地视觉模型的 400 错误，可能是图片格式不支持，依次尝试：1) 去掉图片重试 2) OCR 预处理
    const is400 = err?.message?.includes('(400)') || err?.message?.includes('status code 400')
    if (is400 && modelSupportsImages && hasImageContent(opts.messages)) {
      // 方案1：直接去掉图片，只保留文本
      log.warn('[ModelRouter] Ollama vision model 400 error, retrying without images')
      try {
        const textOnlyMessages = stripImages(opts.messages)
        await chatStreamWithOllama({ ...opts, messages: textOnlyMessages })
        return
      } catch (stripErr: unknown) {
        log.warn('[ModelRouter] Strip-images retry also failed:', stripErr instanceof Error ? stripErr.message : stripErr)
      }
      // 方案2：OCR 预处理
      try {
        const ocrMessages = await ocrPreprocess(options.messages, false)
        await chatStreamWithOllama({ ...opts, messages: ocrMessages })
        return
      } catch (ocrErr) {
        log.warn('[ModelRouter] OCR fallback also failed:', ocrErr)
      }
    }
    log.warn('[ModelRouter] Ollama stream failed, falling back to cloud:', err)
    const fallbackCloudId = await resolveCloudModelId()
    if (fallbackCloudId) {
      const cloudConfig = await getCloudConfigById(fallbackCloudId)
      if (cloudConfig) {
        try {
          if (opts.onFallback) opts.onFallback(opts.model || 'ollama', cloudConfig.modelName)
          const cloudOptions: any = {
            messages: opts.messages,
            onChunk: opts.onChunk,
            signal: opts.signal,
          }
          if (opts.temperature !== undefined) cloudOptions.temperature = opts.temperature
          if (opts.top_p !== undefined) cloudOptions.top_p = opts.top_p
          if (opts.maxTokens !== undefined) cloudOptions.maxTokens = opts.maxTokens
          if (opts.tools !== undefined) cloudOptions.tools = opts.tools
          if (opts.tool_choice !== undefined) cloudOptions.tool_choice = opts.tool_choice
          await cloudModel.cloudChatStream(cloudConfig, cloudOptions)
          return
        } catch (cloudErr) {
          log.error('[ModelRouter] Cloud fallback also failed:', cloudErr)
        }
      }
    }
    throw err
  }
}

/**
 * 统一图片识别接口
 */
export async function analyzeImage(
  imageBase64: string,
  prompt: string
): Promise<string> {
  const cloudConfig = await getCloudConfig()

  if (cloudConfig) {
    try {
      return await cloudModel.cloudAnalyzeImage(cloudConfig, imageBase64, prompt)
    } catch (err) {
      log.warn('[ModelRouter] Cloud image analysis failed, falling back to Ollama:', err)
    }
  }

  const visionModel = await ollama.getVisionModel()
  if (visionModel) {
    return ollama.analyzeScreenshot([imageBase64], visionModel, prompt)
  }

  throw new Error('无可用的视觉模型')
}

/**
 * 统一 Embedding 接口
 */
export async function embedding(text: string): Promise<number[]> {
  // 优先使用标记了 embedding: true 的云端模型
  const models = await getCloudModels()
  const embedModel = models.find(m => m.capabilities?.embedding)
  if (embedModel) {
    try {
      return await cloudModel.cloudEmbedding({
        provider: embedModel.provider,
        apiKey: embedModel.apiKey,
        baseUrl: embedModel.baseUrl,
        modelName: embedModel.modelName,
      }, { text })
    } catch (err) {
      log.warn('[ModelRouter] Cloud embedding model failed, falling back to Ollama:', err)
    }
  }

  // 再尝试第一个可用云端模型
  const cloudConfig = await getCloudConfig()
  if (cloudConfig) {
    try {
      return await cloudModel.cloudEmbedding(cloudConfig, { text })
    } catch (err) {
      log.warn('[ModelRouter] Cloud embedding failed, falling back to Ollama:', err)
    }
  }

  return ollama.getEmbeddings(text)
}

/**
 * 统一图片生成接口（仅云端支持）
 * 自动从当前配置的云端模型中选择支持图片生成的 provider
 */
export async function generateImage(
  prompt: string,
  options?: { size?: string; quality?: string }
): Promise<cloudModel.CloudImageResult> {
  const models = await getCloudModels()

  // 优先使用标记了 imageGen 能力的模型
  const imageModel = models.find(m => m.capabilities?.imageGen)
  if (imageModel) {
    const config: CloudConfig = {
      provider: imageModel.provider,
      apiKey: imageModel.apiKey,
      baseUrl: imageModel.baseUrl,
      modelName: imageModel.modelName,
    }
    log.info('[ModelRouter] generateImage using model with imageGen capability:', imageModel.modelName)
    return cloudModel.cloudGenerateImage(config, prompt, options)
  }

  throw new Error('没有可用的云端图片生成模型。请在设置中为模型勾选"图片生成"能力标签')
}

/**
 * 检查是否有支持图片生成的云端模型
 */
export async function hasImageGenerationCapability(): Promise<{ available: boolean; provider?: string; model?: string }> {
  const models = await getCloudModels()

  const imageModel = models.find(m => m.capabilities?.imageGen)
  if (imageModel) {
    return { available: true, provider: imageModel.provider, model: imageModel.modelName }
  }

  return { available: false }
}

/**
 * 根据能力类型查找模型
 */
export async function findModelForCapability(capability: string): Promise<CloudModelEntry | null> {
  const models = await getCloudModels()
  return models.find(m => m.capabilities?.[capability as keyof typeof m.capabilities]) || null
}

/**
 * 检查云端模型是否可用
 */
export async function isCloudAvailable(): Promise<boolean> {
  const models = await getCloudModels()
  return models.length > 0
}

/**
 * 获取当前使用的模型类型
 */
export async function getCurrentModelType(): Promise<'cloud' | 'local'> {
  const config = await getCloudConfig()
  return config ? 'cloud' : 'local'
}

/**
 * 获取当前模型名称
 */
export async function getCurrentModelName(): Promise<string> {
  const cloudConfig = await getCloudConfig()
  if (cloudConfig) return cloudConfig.modelName

  const ollamaModels = await ollama.listModels()
  return ollamaModels[0] || 'unknown'
}

/**
 * 获取所有云端模型列表（供前端下拉使用）
 */
export async function getCloudModelList(): Promise<CloudModelEntry[]> {
  return getCloudModels()
}
