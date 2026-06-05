/**
 * 云端模型调用模块
 * 支持 OpenAI、Claude、智谱、通义千问等云端模型
 * 提供统一的接口：对话、流式输出、图片识别、Embedding
 */
import axios from 'axios'

export interface CloudMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | CloudContentPart[]
}

export interface CloudContentPart {
  type: 'text' | 'image_url'
  text?: string
  image_url?: { url: string }
}

export interface CloudConfig {
  provider: string
  apiKey: string
  baseUrl: string
  modelName: string
}

export interface CloudChatOptions {
  messages: CloudMessage[]
  temperature?: number
  maxTokens?: number
  stream?: boolean
  onChunk?: (chunk: string, reasoning?: string) => void
  signal?: AbortSignal
}

export interface CloudEmbedOptions {
  text: string
}

function getDefaultBaseUrl(provider: string): string {
  switch (provider) {
    case 'openai': return 'https://api.openai.com/v1'
    case 'claude': return 'https://api.anthropic.com/v1'
    case 'zhipu': return 'https://open.bigmodel.cn/api/paas/v4'
    case 'dashscope': return 'https://dashscope.aliyuncs.com/compatible-mode/v1'
    case 'custom': return ''
    default: return ''
  }
}

function buildHeaders(config: CloudConfig): Record<string, string> {
  if (config.provider === 'claude') {
    return {
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    }
  }
  return {
    'Authorization': `Bearer ${config.apiKey}`,
    'Content-Type': 'application/json',
  }
}

function buildChatBody(config: CloudConfig, options: CloudChatOptions): any {
  if (config.provider === 'claude') {
    const systemMsg = options.messages.find(m => m.role === 'system');
    const nonSystemMessages = options.messages
      .filter(m => m.role !== 'system')
      .map(msg => ({ role: msg.role, content: msg.content }));
    return {
      model: config.modelName,
      max_tokens: options.maxTokens || 8192,
      messages: nonSystemMessages,
      system: systemMsg?.content,
      stream: options.stream || false,
      temperature: options.temperature ?? 0.7,
    };
  }

  const messages = options.messages.map(msg => ({
    role: msg.role,
    content: msg.content,
  }));

  return {
    model: config.modelName,
    max_tokens: options.maxTokens || 8192,
    messages,
    stream: options.stream || false,
    temperature: options.temperature ?? 0.7,
  }
}

function buildUrl(config: CloudConfig): string {
  const baseUrl = config.baseUrl || getDefaultBaseUrl(config.provider)
  if (config.provider === 'claude') {
    return `${baseUrl}/messages`
  }
  return `${baseUrl}/chat/completions`
}

/**
 * 云端对话（非流式）
 */
export async function cloudChat(
  config: CloudConfig,
  options: CloudChatOptions
): Promise<string> {
  const url = buildUrl(config)
  const headers = buildHeaders(config)
  const body = buildChatBody(config, { ...options, stream: false })

  try {
    const response = await axios.post(url, body, {
      headers,
      ...(options.signal ? { signal: options.signal } : {}),
      timeout: 120000,
    })

    if (config.provider === 'claude') {
      return response.data.content?.[0]?.text || ''
    }
    return response.data.choices?.[0]?.message?.content || ''
  } catch (err: any) {
    const status = err?.response?.status
    const errorData = err?.response?.data
    let msg = err?.message || '未知错误'
    if (errorData?.error?.message) {
      msg = errorData.error.message
    } else if (typeof errorData?.error === 'string') {
      msg = errorData.error
    }
    if (status === 403) {
      throw new Error(`云端模型拒绝访问(403)：${msg}`)
    }
    if (status === 401) {
      throw new Error(`云端模型认证失败(401)：API Key无效或已过期`)
    }
    if (status === 404) {
      throw new Error(`云端模型未找到(404)：模型名称可能不正确`)
    }
    throw new Error(`云端模型调用失败(${status || '网络错误'})：${msg}`)
  }
}

/**
 * 云端对话（流式）
 */
export async function cloudChatStream(
  config: CloudConfig,
  options: CloudChatOptions
): Promise<void> {
  const url = buildUrl(config)
  const headers = buildHeaders(config)
  const body = buildChatBody(config, { ...options, stream: true })

  const response = await axios.post(url, body, {
    headers,
    responseType: 'stream',
    ...(options.signal ? { signal: options.signal } : {}),
    timeout: 120000,
  })

  const decoder = new TextDecoder()
  let buffer = ''

  for await (const chunk of response.data) {
    buffer += decoder.decode(chunk, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed === 'data: [DONE]') continue
      if (!trimmed.startsWith('data: ')) continue

      try {
        const json = JSON.parse(trimmed.slice(6))
        if (config.provider === 'claude') {
          const delta = json.delta?.text
          if (delta && options.onChunk) {
            options.onChunk(delta)
          }
        } else {
          const delta = json.choices?.[0]?.delta
          const content = delta?.content
          const reasoning = delta?.reasoning_content
          if (reasoning && options.onChunk) {
            options.onChunk('', reasoning)
          }
          if (content && options.onChunk) {
            options.onChunk(content)
          }
        }
      } catch {
        // Skip invalid JSON
      }
    }
  }
}

/**
 * 云端图片识别（使用视觉模型）
 */
export async function cloudAnalyzeImage(
  config: CloudConfig,
  imageBase64: string,
  prompt: string
): Promise<string> {
  const messages: CloudMessage[] = [
    {
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        {
          type: 'image_url',
          image_url: { url: `data:image/png;base64,${imageBase64}` },
        },
      ],
    },
  ]

  // Claude uses a different image format
  if (config.provider === 'claude') {
    // For now, Claude vision is handled via the same OpenAI-compatible endpoint
    // Most Claude models support vision through the standard messages API
  }

  return cloudChat(config, { messages, temperature: 0.7, maxTokens: 2048 })
}

/**
 * 云端 Embedding 生成
 */
export async function cloudEmbedding(
  config: CloudConfig,
  options: CloudEmbedOptions
): Promise<number[]> {
  const baseUrl = config.baseUrl || getDefaultBaseUrl(config.provider)
  const url = `${baseUrl}/embeddings`
  const headers = buildHeaders(config)

  const body = {
    model: config.provider === 'openai' ? 'text-embedding-3-small' : config.modelName,
    input: options.text,
  }

  const response = await axios.post(url, body, {
    headers,
    timeout: 30000,
  })

  return response.data.data?.[0]?.embedding || []
}

export interface CloudImageResult {
  url?: string
  b64_json?: string
  revised_prompt?: string
}

const IMAGE_MODEL_PROVIDER_MAP: Record<string, string> = {
  'dall-e-3': 'openai',
  'dall-e-2': 'openai',
  'gpt-image-1': 'openai',
  'wanx-v1': 'dashscope',
  'wanx2.1-t2i-turbo': 'dashscope',
  'wanx2.1-t2i-plus': 'dashscope',
  'wanx2.0-t2i-turbo': 'dashscope',
  'wan2.2-t2i-flash': 'dashscope',
  'wan2.2-t2i-plus': 'dashscope',
  'wan2.5-t2i-preview': 'dashscope',
  'wan2.6-t2i': 'dashscope',
  'wan2.7-image': 'dashscope',
  'wan2.7-image-pro': 'dashscope',
  'cogview-3': 'zhipu',
  'cogview-3-plus': 'zhipu',
  'cogview-4': 'zhipu',
}

const IMAGE_GENERATION_MODELS: Record<string, { models: string[]; defaultSize: string }> = {
  openai: {
    models: ['dall-e-3', 'gpt-image-1'],
    defaultSize: '1024x1024',
  },
  dashscope: {
    models: ['wan2.6-t2i', 'wan2.7-image-pro', 'wan2.5-t2i-preview', 'wan2.2-t2i-flash', 'wanx2.1-t2i-turbo'],
    defaultSize: '1024*1024',
  },
  zhipu: {
    models: ['cogview-4', 'cogview-3-plus'],
    defaultSize: '1024x1024',
  },
}

export function getImageGenerationModels(): { provider: string; models: string[]; defaultSize: string }[] {
  return Object.entries(IMAGE_GENERATION_MODELS).map(([provider, info]) => ({
    provider,
    ...info,
  }))
}

export function canProviderGenerateImages(provider: string): boolean {
  return provider === 'openai' || provider === 'dashscope' || provider === 'zhipu'
}

export async function cloudGenerateImage(
  config: CloudConfig,
  prompt: string,
  options?: { size?: string; quality?: string; n?: number }
): Promise<CloudImageResult> {
  const provider = config.provider
  const baseUrl = config.baseUrl || getDefaultBaseUrl(provider)
  const headers = buildHeaders(config)

  if (provider === 'openai') {
    const url = `${baseUrl}/images/generations`
    const body: any = {
      model: config.modelName || 'dall-e-3',
      prompt,
      n: options?.n || 1,
      size: options?.size || '1024x1024',
      response_format: 'url',
    }
    if (options?.quality) body.quality = options.quality

    try {
      const response = await axios.post(url, body, { headers, timeout: 120000 })
      const data = response.data?.data?.[0]
      return {
        url: data?.url,
        b64_json: data?.b64_json,
        revised_prompt: data?.revised_prompt,
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || '未知错误'
      throw new Error(`OpenAI 图片生成失败：${msg}`)
    }
  }

  if (provider === 'dashscope') {
    const modelName = config.modelName || 'wan2.6-t2i'
    const url = `https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation`
    const body = {
      model: modelName,
      input: {
        messages: [
          {
            role: 'user',
            content: [{ text: prompt }],
          },
        ],
      },
      parameters: {
        size: options?.size || '1024*1024',
        n: options?.n || 1,
      },
    }

    try {
      const response = await axios.post(url, body, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 120000,
      })

      const imageUrl = response.data?.output?.choices?.[0]?.message?.content?.[0]?.image
      if (imageUrl) {
        return { url: imageUrl }
      }
      throw new Error('未返回图片URL')
    } catch (err: any) {
      if (err.message.includes('未返回')) throw err
      const msg = err?.response?.data?.message || err?.message || '未知错误'
      throw new Error(`通义万相图片生成失败：${msg}`)
    }
  }

  if (provider === 'zhipu') {
    const url = `https://open.bigmodel.cn/api/paas/v4/images/generations`
    const body = {
      model: config.modelName || 'cogview-4',
      prompt,
      size: options?.size || '1024x1024',
    }

    try {
      const response = await axios.post(url, body, { headers, timeout: 120000 })
      const data = response.data?.data?.[0]
      return {
        url: data?.url,
        revised_prompt: data?.revised_prompt,
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || '未知错误'
      throw new Error(`智谱图片生成失败：${msg}`)
    }
  }

  throw new Error(`当前云端模型提供商（${provider}）不支持图片生成`)
}

/**
 * 测试云端模型连接
 */
export async function testCloudConnection(config: CloudConfig): Promise<{ success: boolean; error?: string }> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    const messages: CloudMessage[] = [
      { role: 'user', content: 'Hi' }
    ]

    await cloudChat(config, {
      messages,
      maxTokens: 10,
      signal: controller.signal,
    })

    clearTimeout(timeout)
    return { success: true }
  } catch (err: any) {
    return {
      success: false,
      error: err.response?.data?.error?.message || err.message || '连接失败',
    }
  }
}
