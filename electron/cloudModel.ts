/**
 * 云端模型调用模块
 * 支持 OpenAI、Claude、智谱、通义千问等云端模型
 * 提供统一的接口：对话、流式输出、图片识别、Embedding
 */
import axios from 'axios'

// 云端模型超时策略（毫秒）
const CLOUD_TIMEOUTS = {
  chat: 60000,          // 对话（非流式）
  chatStream: 120000,   // 流式对话
  imageGen: 120000,     // 图片生成
  embedding: 30000,     // Embedding
  analyzeImage: 60000,  // 图片分析
  testConnection: 10000,// 连接测试
}

// 清洗模型输出中的特殊 token（与 Ollama 保持一致）
function sanitizeContent(text: string): string {
  let content = text
  // 移除 <think>...</think> 块（与前端 sanitizeStreamingAssistantText 一致）
  content = content.replace(/<think[\s\S]*?<\/think>/gi, '')
  // 移除 <|endoftext|> token（与 ollama 一致）
  const endTokenIdx = content.indexOf('<|endoftext|>')
  if (endTokenIdx !== -1) {
    content = content.substring(0, endTokenIdx)
  }
  content = content.replace(/<\|im_start\|>|<\|im_end\|>/g, '')
  return content.trim()
}

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
  onChunk?: (chunk: string, reasoning?: string, toolCalls?: any[]) => void
  signal?: AbortSignal
  tools?: any[]
  tool_choice?: any
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
      .map(msg => {
        // Claude 不接受 content 为数组时含空 text part；确保 content 格式正确
        let content = msg.content
        if (Array.isArray(content)) {
          content = content.filter((p: CloudContentPart) => {
            if (p.type === 'text' && !p.text?.trim()) return false
            return true
          })
          // 如果过滤后只剩 image 且没有 text，添加占位文本避免 400
          if (content.length > 0 && !content.some((p: CloudContentPart) => p.type === 'text')) {
            content = [{ type: 'text', text: '请描述这张图片' }, ...content]
          }
        }
        return { role: msg.role, content }
      });
    // Claude system 字段只接受字符串，不接受数组
    let systemContent: string | undefined
    if (systemMsg) {
      if (typeof systemMsg.content === 'string') {
        systemContent = systemMsg.content
      } else if (Array.isArray(systemMsg.content)) {
        systemContent = systemMsg.content
          .filter((p: CloudContentPart) => p.type === 'text')
          .map((p: CloudContentPart) => p.text || '')
          .join('\n')
      }
    }
    const body: any = {
      model: config.modelName,
      max_tokens: options.maxTokens || 8192,
      messages: nonSystemMessages,
      system: systemContent,
      stream: options.stream || false,
      temperature: options.temperature ?? 0.7,
    };
    // Claude extended thinking 支持：对 claude-3.5/3.7/4 等模型启用 thinking
    const thinkingModels = /claude-3[-.]5|claude-3[-.]7|claude-4|claude-sonnet-4|claude-opus-4/i;
    if (thinkingModels.test(config.modelName)) {
      body.thinking = { type: 'enabled', budget_tokens: 10000 };
      // 启用 thinking 时 temperature 必须为 1
      body.temperature = 1;
    }
    // Claude 原生工具调用
    if (options.tools && options.tools.length > 0) {
      body.tools = options.tools.map((t: any) => ({
        name: t.function?.name || t.name,
        description: t.function?.description || t.description || '',
        input_schema: t.function?.parameters || t.input_schema || {},
      }));
      if (options.tool_choice) {
        body.tool_choice = options.tool_choice;
      }
    }
    return body;
  }

  const messages = options.messages.map(msg => {
    // 清理数组 content 中的空 text part，避免 400
    if (Array.isArray(msg.content)) {
      const cleaned = msg.content.filter((p: CloudContentPart) => {
        if (p.type === 'text' && !p.text?.trim()) return false
        return true
      })
      return { role: msg.role, content: cleaned.length > 0 ? cleaned : msg.content }
    }
    return { role: msg.role, content: msg.content }
  });

  const body: any = {
    model: config.modelName,
    max_tokens: options.maxTokens || 8192,
    messages,
    stream: options.stream || false,
    temperature: options.temperature ?? 0.7,
  };

  // OpenAI 兼容格式原生工具调用
  if (options.tools && options.tools.length > 0) {
    body.tools = options.tools;
    if (options.tool_choice) {
      body.tool_choice = options.tool_choice;
    }
  }

  return body;
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
      timeout: CLOUD_TIMEOUTS.chat,
    })

    if (config.provider === 'claude') {
      // Claude 响应可能包含 thinking、text 和 tool_use 三种 content block
      const contentBlocks = response.data.content || [];
      let textResult = '';
      let reasoningResult = '';
      const toolCalls: any[] = [];
      for (const block of contentBlocks) {
        if (block.type === 'thinking' && block.thinking) {
          reasoningResult += block.thinking;
        } else if (block.type === 'text' && block.text) {
          textResult += block.text;
        } else if (block.type === 'tool_use' && block.name) {
          toolCalls.push({
            id: block.id,
            type: 'function',
            function: {
              name: block.name,
              arguments: typeof block.input === 'object' ? JSON.stringify(block.input) : String(block.input || '{}'),
            },
          });
        }
      }
      if (toolCalls.length > 0) {
        // 将原生工具调用转为内部文本格式
        const toolText = toolCalls.map((tc: any) => {
          return `[TOOL_CALL]\n${JSON.stringify({ tool: tc.function.name, args: JSON.parse(tc.function.arguments || '{}') })}\n[/TOOL_CALL]`;
        }).join('\n');
        const combinedText = textResult ? `${textResult}\n\n${toolText}` : toolText;
        if (options.onChunk) {
          options.onChunk(combinedText, reasoningResult || undefined);
        }
        return sanitizeContent(combinedText);
      }
      if (reasoningResult && options.onChunk) {
        options.onChunk('', reasoningResult);
      }
      return sanitizeContent(textResult);
    }
    // OpenAI 兼容格式：提取 reasoning_content 和 tool_calls
    const message = response.data.choices?.[0]?.message;
    if (message?.reasoning_content && options.onChunk) {
      options.onChunk('', message.reasoning_content);
    }
    // 检测原生 tool_calls
    if (message?.tool_calls && message.tool_calls.length > 0) {
      const toolText = message.tool_calls.map((tc: any) => {
        let args: any;
        try { args = JSON.parse(tc.function.arguments); } catch { args = tc.function.arguments; }
        return `[TOOL_CALL]\n${JSON.stringify({ tool: tc.function.name, args })}\n[/TOOL_CALL]`;
      }).join('\n');
      const content = message?.content || '';
      const combinedText = content ? `${content}\n\n${toolText}` : toolText;
      if (options.onChunk) {
        options.onChunk(combinedText, message?.reasoning_content || undefined);
      }
      return sanitizeContent(combinedText);
    }
    return sanitizeContent(message?.content || '')
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
    timeout: CLOUD_TIMEOUTS.chatStream,
  })

  const decoder = new TextDecoder()
  let buffer = ''

  // 工具调用累积（OpenAI 流式）
  let accumulatedToolCalls: Map<number, { id: string; type: string; name: string; arguments: string }> = new Map()
  let hasToolCalls = false
  let finishReason: string | null = null
  let deltaBuffer = ''

  for await (const chunk of response.data) {
    buffer += decoder.decode(chunk, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed === 'data: [DONE]' || trimmed === 'event: message_stop' || trimmed === 'event: message_start' || trimmed.startsWith('event:')) continue
      if (!trimmed.startsWith('data: ')) continue

      try {
        const json = JSON.parse(trimmed.slice(6))
        if (config.provider === 'claude') {
          // Claude SSE 事件类型：content_block_start / content_block_delta / message_stop
          if (json.type === 'content_block_start') {
            if (json.content_block?.type === 'tool_use') {
              const cb = json.content_block
              const idx = accumulatedToolCalls.size
              accumulatedToolCalls.set(idx, {
                id: cb.id || '',
                type: 'function',
                name: cb.name || '',
                arguments: typeof cb.input === 'object' ? JSON.stringify(cb.input) : String(cb.input || ''),
              })
              hasToolCalls = true
              // Claude tool_use 是完整的，立即发送
              const toolText = Array.from(accumulatedToolCalls.values()).map((tc: any) => {
                let args: any
                try { args = JSON.parse(tc.arguments) } catch { args = tc.arguments }
                return `[TOOL_CALL]\n${JSON.stringify({ tool: tc.name, args })}\n[/TOOL_CALL]`
              }).join('\n')
              if (options.onChunk) {
                const fullText = deltaBuffer ? `${deltaBuffer}\n\n${toolText}` : toolText
                options.onChunk(fullText)
              }
              return
            }
          } else if (json.type === 'content_block_delta') {
            const delta = json.delta
            if (delta?.type === 'thinking_delta' && delta?.thinking && options.onChunk) {
              options.onChunk('', delta.thinking)
            } else if (delta?.type === 'text_delta' && delta?.text && options.onChunk) {
              options.onChunk(delta.text)
            }
          }
          // 兼容旧版 Claude API 格式
          const fallbackDelta = json.delta?.text
          if (fallbackDelta && options.onChunk && json.type !== 'content_block_delta') {
            options.onChunk(fallbackDelta)
          }
        } else {
          const delta = json.choices?.[0]?.delta
          const content = delta?.content
          const reasoning = delta?.reasoning_content

          // 累积工具调用
          if (delta?.tool_calls) {
            hasToolCalls = true
            for (const tc of delta.tool_calls) {
              const idx = tc.index
              if (!accumulatedToolCalls.has(idx)) {
                accumulatedToolCalls.set(idx, { id: '', type: 'function', name: '', arguments: '' })
              }
              const existing = accumulatedToolCalls.get(idx)!
              if (tc.id) existing.id = tc.id
              if (tc.type) existing.type = tc.type
              if (tc.function?.name) existing.name = tc.function.name
              if (tc.function?.arguments) existing.arguments += tc.function.arguments
            }
          }

          finishReason = json.choices?.[0]?.finish_reason || null

          if (finishReason === 'tool_calls' && hasToolCalls && accumulatedToolCalls.size > 0) {
            // 流结束触发工具调用，立即发送完整的 tool_calls
            const toolText = Array.from(accumulatedToolCalls.values()).map((tc: any) => {
              let args: any
              try { args = JSON.parse(tc.arguments) } catch { args = tc.arguments }
              return `[TOOL_CALL]\n${JSON.stringify({ tool: tc.name, args })}\n[/TOOL_CALL]`
            }).join('\n')
            if (options.onChunk) {
              const fullText = deltaBuffer ? `${deltaBuffer}\n\n${toolText}` : toolText
              options.onChunk(fullText, reasoning || undefined)
            }
            return
          }

          if (reasoning && options.onChunk) {
            options.onChunk('', reasoning)
          }
          if (content && options.onChunk) {
            deltaBuffer += content
            options.onChunk(content)
          }
        }
      } catch {
        // Skip invalid JSON
      }
    }
  }

  // 流结束后检查是否有未发送的工具调用（兜底）
  if (hasToolCalls && accumulatedToolCalls.size > 0 && options.onChunk) {
    const toolText = Array.from(accumulatedToolCalls.values()).map((tc: any) => {
      let args: any
      try { args = JSON.parse(tc.arguments) } catch { args = tc.arguments }
      return `[TOOL_CALL]\n${JSON.stringify({ tool: tc.name, args })}\n[/TOOL_CALL]`
    }).join('\n')
    const fullText = deltaBuffer ? `${deltaBuffer}\n\n${toolText}` : toolText
    options.onChunk(fullText)
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
    timeout: CLOUD_TIMEOUTS.embedding,
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
      const response = await axios.post(url, body, { headers, timeout: CLOUD_TIMEOUTS.imageGen })
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
        timeout: CLOUD_TIMEOUTS.imageGen,
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
      const response = await axios.post(url, body, { headers, timeout: CLOUD_TIMEOUTS.imageGen })
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
    const timeout = setTimeout(() => controller.abort(), CLOUD_TIMEOUTS.testConnection)

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
