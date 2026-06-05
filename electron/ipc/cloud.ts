/**
 * 云端模型配置 IPC 模块
 * 支持多个云端模型的 CRUD
 */
import { IpcModule, IpcContext } from './index'
import axios from 'axios'
import { getSetting, setSetting } from '../db'
import { v4 as uuidv4 } from 'uuid'
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
  logWarn,
  logError,
  ErrorCategory,
  ErrorLevel,
  AppError,
} from '../errorHandler'

export interface ModelCapabilities {
  chat: boolean           // 对话能力
  vision: boolean         // 图片识别能力
  imageGen: boolean       // 图片生成能力
  embedding: boolean      // 嵌入能力
  videoGen: boolean       // 视频生成能力
}

export interface CloudModelEntry {
  id: string
  name: string
  provider: string
  apiKey: string
  baseUrl: string
  modelName: string
  capabilities: ModelCapabilities
  // 向后兼容
  isVision?: boolean
}

async function getCloudModels(): Promise<CloudModelEntry[]> {
  try {
    const raw = await getSetting('cloud_models')
    if (raw) {
      let models: CloudModelEntry[]
      if (typeof raw === 'string') {
        models = JSON.parse(raw)
      } else {
        models = raw as CloudModelEntry[]
      }
      // 向后兼容：迁移旧数据
      return models.map(m => migrateModelEntry(m))
    }
  } catch {}
  try {
    const provider = await getSetting('cloud_provider')
    const apiKey = await getSetting('cloud_api_key')
    const baseUrl = await getSetting('cloud_base_url')
    const modelName = await getSetting('cloud_model_name')
    if (provider && apiKey && modelName) {
      return [{
        id: uuidv4(),
        name: modelName,
        provider,
        apiKey,
        baseUrl: baseUrl || '',
        modelName,
        capabilities: getDefaultCapabilities(provider, modelName),
      }]
    }
  } catch {}
  return []
}

function migrateModelEntry(model: any): CloudModelEntry {
  const inferredCaps = getDefaultCapabilities(model.provider, model.modelName)
  
  if (!model.capabilities) {
    if (model.isVision) {
      inferredCaps.vision = true
    }
    return { ...model, capabilities: inferredCaps }
  }

  const hasAnyCapability = Object.values(model.capabilities).some(v => v === true)
  if (!hasAnyCapability) {
    return { ...model, capabilities: inferredCaps }
  }

  return model as CloudModelEntry
}

function getDefaultCapabilities(provider: string, modelName: string): ModelCapabilities {
  const modelLower = (modelName || '').toLowerCase()
  const caps: ModelCapabilities = {
    chat: true,
    vision: false,
    imageGen: false,
    embedding: false,
    videoGen: false,
  }
  if (modelLower.includes('embed')) {
    caps.chat = false
    caps.embedding = true
  }
  const visionKeywords = ['vision', 'vl', 'gpt-4o', 'gpt-4-turbo', 'claude-3', 'gemini']
  if (visionKeywords.some(k => modelLower.includes(k))) {
    caps.vision = true
  }
  const imageKeywords = ['dall-e', 'gpt-image', 'wanx', 't2i', 'cogview', '-image']
  if (imageKeywords.some(k => modelLower.includes(k))) {
    caps.chat = false
    caps.imageGen = true
  }
  const videoKeywords = ['t2v', 'i2v', 'video']
  if (videoKeywords.some(k => modelLower.includes(k))) {
    caps.chat = false
    caps.videoGen = true
  }
  return caps
}

async function saveCloudModels(models: CloudModelEntry[]): Promise<void> {
  await setSetting('cloud_models', JSON.stringify(models))
}

export function createCloudModule(ctx: IpcContext): IpcModule {
  const getWin = () => ctx.getWin()

  return {
    'get-cloud-config': async () => {
      return withErrorHandling(async () => {
        const models = await getCloudModels()
        const first = models[0]
        if (first) {
          return { provider: first.provider, apiKey: first.apiKey, baseUrl: first.baseUrl, modelName: first.modelName }
        }
        return { provider: '', apiKey: '', baseUrl: '', modelName: '' }
      }, 'get-cloud-config')
    },

    'get-cloud-models': async () => {
      return withErrorHandling(async () => {
        return getCloudModels()
      }, 'get-cloud-models')
    },

    'find-model-for-capability': async (_event: any, capability: string) => {
      return withErrorHandling(async () => {
        const models = await getCloudModels()
        const validCapabilities = ['chat', 'vision', 'imageGen', 'embedding', 'videoGen']
        if (!validCapabilities.includes(capability)) {
          throw new AppError(`无效的能力类型: ${capability}`, ErrorCategory.VALIDATION, ErrorLevel.WARNING)
        }
        const model = models.find(m => m.capabilities[capability as keyof ModelCapabilities])
        return model || null
      }, 'find-model-for-capability')
    },

    'save-cloud-model': async (_event: any, entry: Omit<CloudModelEntry, 'id'> & { id?: string }) => {
      return withErrorHandling(async () => {
        const validated = validateInput(SaveCloudModelSchema, entry, 'save-cloud-model')
        const models = await getCloudModels()
        if (validated.id) {
          const idx = models.findIndex(m => m.id === validated.id)
          if (idx >= 0) {
            models[idx] = { ...models[idx], ...validated } as CloudModelEntry
          } else {
            models.push({ ...validated, id: validated.id } as CloudModelEntry)
          }
        } else {
          models.push({ ...validated, id: uuidv4() } as CloudModelEntry)
        }
        await saveCloudModels(models)
        logInfo('Cloud model saved', { id: validated.id, name: validated.name })
        return { success: true, models }
      }, 'save-cloud-model', getWin())
    },

    'delete-cloud-model': async (_event: any, id: string) => {
      return withErrorHandling(async () => {
        const validated = validateInput(DeleteCloudModelSchema, { id }, 'delete-cloud-model')
        const models = await getCloudModels()
        const filtered = models.filter(m => m.id !== validated.id)
        await saveCloudModels(filtered)
        logInfo('Cloud model deleted', { id: validated.id })
        return { success: true, models: filtered }
      }, 'delete-cloud-model', getWin())
    },

    'is-cloud-ai-enabled': async () => {
      return withErrorHandling(async () => {
        const models = await getCloudModels()
        return models.length > 0
      }, 'is-cloud-ai-enabled')
    },

    'save-cloud-config': async (_event: any, config: {
      provider: string
      apiKey: string
      baseUrl: string
      modelName: string
    }) => {
      return withErrorHandling(async () => {
        const validated = validateInput(SaveCloudConfigSchema, config, 'save-cloud-config')
        const models = await getCloudModels()
        if (models.length > 0) {
          const first = models[0]!
          models[0] = { id: first.id, name: first.name, provider: validated.provider, apiKey: validated.apiKey, baseUrl: validated.baseUrl, modelName: validated.modelName, capabilities: first.capabilities || getDefaultCapabilities(validated.provider, validated.modelName) }
          await saveCloudModels(models)
        } else {
          await saveCloudModels([{ id: uuidv4(), name: validated.modelName, provider: validated.provider, apiKey: validated.apiKey, baseUrl: validated.baseUrl, modelName: validated.modelName, capabilities: getDefaultCapabilities(validated.provider, validated.modelName) }])
        }
        logInfo('Cloud config saved', { provider: validated.provider, modelName: validated.modelName })
        return { success: true }
      }, 'save-cloud-config', getWin())
    },

    'test-cloud-model': async (_event: any, config: {
      provider: string
      apiKey: string
      baseUrl: string
      model: string
    }) => {
      return withErrorHandling(async () => {
        const validated = validateInput(TestCloudModelSchema, config, 'test-cloud-model')

        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 30000)

        const imageModelKeywords = ['dall-e', 'gpt-image', 'wanx', 't2i', 'cogview', '-image']
        const isImageModel = imageModelKeywords.some(k => validated.model.toLowerCase().includes(k))
        const embeddingKeywords = ['embed', 'embedding', 'text-embedding']
        const isEmbeddingModel = embeddingKeywords.some(k => validated.model.toLowerCase().includes(k))

        let url: string
        let headers: Record<string, string>
        let body: any

        if (isEmbeddingModel) {
          if (validated.provider === 'dashscope') {
            const isMultimodalModel = validated.model.includes('vision') || validated.model.includes('multimodal');
            if (isMultimodalModel) {
              url = 'https://dashscope.aliyuncs.com/api/v1/services/embeddings/multimodal-embedding/multimodal-embedding';
              body = {
                model: validated.model,
                input: { contents: [{ text: 'test' }] },
              };
            } else {
              url = 'https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding';
              body = {
                model: validated.model,
                input: { texts: ['test'] },
                parameters: { text_type: 'query' },
              };
            }
            headers = {
              'Authorization': `Bearer ${validated.apiKey}`,
              'Content-Type': 'application/json',
            };
          } else if (validated.provider === 'zhipu') {
            url = 'https://open.bigmodel.cn/api/paas/v4/embeddings';
            headers = {
              'Authorization': `Bearer ${validated.apiKey}`,
              'Content-Type': 'application/json',
            };
            body = {
              model: validated.model,
              input: 'test',
            };
          } else {
            url = `${validated.baseUrl || 'https://api.openai.com/v1'}/embeddings`;
            headers = {
              'Authorization': `Bearer ${validated.apiKey}`,
              'Content-Type': 'application/json',
            };
            body = {
              model: validated.model,
              input: 'test',
            };
          }
        } else if (isImageModel) {
          if (validated.provider === 'dashscope') {
            url = `https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation`
          } else if (validated.provider === 'zhipu') {
            url = `https://open.bigmodel.cn/api/paas/v4/images/generations`
          } else {
            url = `${validated.baseUrl || 'https://api.openai.com/v1'}/images/generations`
          }

          headers = {
            'Authorization': `Bearer ${validated.apiKey}`,
            'Content-Type': 'application/json',
          }

          if (validated.provider === 'dashscope') {
            body = {
              model: validated.model,
              input: {
                messages: [{ role: 'user', content: [{ text: 'test' }] }],
              },
              parameters: { n: 1, size: '1024*1024' },
            }
          } else {
            body = {
              model: validated.model,
              prompt: 'test',
              n: 1,
              size: '256x256',
            }
          }
        } else {
          if (validated.provider === 'claude') {
            url = `${validated.baseUrl || 'https://api.anthropic.com/v1'}/messages`
            headers = {
              'x-api-key': validated.apiKey,
              'anthropic-version': '2023-06-01',
              'content-type': 'application/json',
            }
            body = {
              model: validated.model,
              max_tokens: 10,
              messages: [{ role: 'user', content: 'Hi' }],
            }
          } else if (validated.provider === 'zhipu') {
            url = `${validated.baseUrl || 'https://open.bigmodel.cn/api/paas/v4'}/chat/completions`
            headers = {
              'Authorization': `Bearer ${validated.apiKey}`,
              'Content-Type': 'application/json',
            }
            body = {
              model: validated.model,
              max_tokens: 10,
              messages: [{ role: 'user', content: 'Hi' }],
            }
          } else if (validated.provider === 'dashscope') {
            url = `${validated.baseUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1'}/chat/completions`
            headers = {
              'Authorization': `Bearer ${validated.apiKey}`,
              'Content-Type': 'application/json',
            }
            body = {
              model: validated.model,
              max_tokens: 10,
              messages: [{ role: 'user', content: 'Hi' }],
            }
          } else {
            url = `${validated.baseUrl || 'https://api.openai.com/v1'}/chat/completions`
            headers = {
              'Authorization': `Bearer ${validated.apiKey}`,
              'Content-Type': 'application/json',
            }
            body = {
              model: validated.model,
              max_tokens: 10,
              messages: [{ role: 'user', content: 'Hi' }],
            }
          }
        }

        logInfo('[Cloud Test] Testing connection', { url, model: validated.model, provider: validated.provider, isImageModel, isEmbeddingModel })

        const response = await axios.post(url, body, {
          headers,
          signal: controller.signal,
        })

        clearTimeout(timeout)

        logInfo('[Cloud Test] Connection successful', { status: response.status })
        return { success: true }
      }, 'test-cloud-model', getWin()).catch((err: any) => {
        logError(err, ErrorCategory.NETWORK, {
          provider: config.provider,
          model: config.model,
        })
        return {
          success: false,
          error: err.response?.data?.error?.message || err.response?.data?.message || err.message || '连接失败',
        }
      })
    },
  }
}
