/**
 * Ollama / 模型管理相关 IPC 处理器
 */
import { IpcModule, IpcContext } from './index'
import ollama, { getGpuMode, setGpuMode, getOllamaUrl, setOllamaUrl, getModelParams, setModelParams, isChatModelName, isEmbeddingModelName, type GpuMode, type ModelParams } from '../ollama'
import { resolvePreferredModel } from '../modelPreference'
import * as modelRouter from '../modelRouter'
import { isPathWithinVault } from '../pathSecurity'
import {
  OllamaModelNameSchema,
  OllamaGenerateSchema,
  OllamaChatSchema,
  OllamaEmbeddingsSchema,
  AnalyzeImageSchema,
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

export function createOllamaModule(ctx: IpcContext): IpcModule {
  const getWin = () => ctx.getWin()

  return {
    'ollama-status': async () => {
      return withErrorHandling(async () => {
        const isRunning = await ollama.isRunning()
        return { running: isRunning }
      }, 'ollama-status')
    },

    'ollama-models': async () => {
      return withErrorHandling(async () => {
        return await ollama.listModels()
      }, 'ollama-models')
    },

    'get-ollama-models': async () => {
      return withErrorHandling(async () => {
        return await ollama.listModels()
      }, 'get-ollama-models')
    },

    'ollama-pull-model': async (_: any, params: any) => {
      return withErrorHandling(async () => {
        const validated = validateInput(OllamaModelNameSchema, params, 'ollama-pull-model')
        return await ollama.pullModel(validated.modelName)
      }, 'ollama-pull-model', getWin())
    },

    'ollama-delete-model': async (_: any, params: any) => {
      return withErrorHandling(async () => {
        const validated = validateInput(OllamaModelNameSchema, params, 'ollama-delete-model')
        return await ollama.deleteModel(validated.modelName)
      }, 'ollama-delete-model', getWin())
    },

    'ollama-generate': async (_: any, params: any) => {
      return withErrorHandling(async () => {
        const validated = validateInput(OllamaGenerateSchema, params, 'ollama-generate')
        const model = await resolvePreferredModel(validated.model)
        return await ollama.generate(validated.prompt, model)
      }, 'ollama-generate', getWin())
    },

    'ollama-chat': async (_: any, params: any) => {
      return withErrorHandling(async () => {
        const validated = validateInput(OllamaChatSchema, params, 'ollama-chat')
        const model = await resolvePreferredModel(validated.model)
        const result = await modelRouter.chat({
          model,
          messages: validated.messages.map((m: any) => ({
            role: m.role,
            content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
          })),
        })
        return result
      }, 'ollama-chat', getWin())
    },

    'ollama-embeddings': async (_: any, params: any) => {
      return withErrorHandling(async () => {
        const validated = validateInput(OllamaEmbeddingsSchema, params, 'ollama-embeddings')
        return await modelRouter.embedding(validated.text)
      }, 'ollama-embeddings', getWin())
    },

    'analyze-image': async (_: any, params: any) => {
      return withErrorHandling(async () => {
        const validated = validateInput(AnalyzeImageSchema, params, 'analyze-image')
        if (!isPathWithinVault(validated.imagePath, ctx.vaultPath)) {
          throw new AppError('图片路径不在工作区范围内', ErrorCategory.VALIDATION, ErrorLevel.ERROR)
        }
        const fs = await import('fs')
        const imageBuffer = fs.readFileSync(validated.imagePath)
        const base64Image = imageBuffer.toString('base64')
        return await modelRouter.analyzeImage(base64Image, validated.prompt || '请描述这张图片的内容')
      }, 'analyze-image', getWin())
    },

    'get-default-model': async () => {
      return withErrorHandling(async () => {
        return await resolvePreferredModel()
      }, 'get-default-model')
    },

    'ollama-model-info': async (_: any, params: any) => {
      return withErrorHandling(async () => {
        const validated = validateInput(OllamaModelNameSchema, params, 'ollama-model-info')
        return await ollama.getModelInfo(validated.modelName)
      }, 'ollama-model-info', getWin())
    },

    'check-ollama-status': async () => {
      return withErrorHandling(async () => {
        const isRunning = await ollama.isRunning()
        if (!isRunning) {
          return { connected: false, chatModelReady: false, embeddingModelReady: false, error: 'Ollama 未运行' }
        }
        const models = await ollama.listModels()
        return {
          connected: true,
          chatModelReady: models.some((m: string) => isChatModelName(m)),
          embeddingModelReady: models.some((m: string) => isEmbeddingModelName(m)),
        }
      }, 'check-ollama-status')
    },

    'check-models': async () => {
      return withErrorHandling(async () => {
        return await ollama.checkModelsStatus()
      }, 'check-models')
    },

    'generate-report': async (_: any, params: any) => {
      return withErrorHandling(async () => {
        const validated = validateInput(OllamaGenerateSchema, params, 'generate-report')
        const model = await resolvePreferredModel(validated.model)
        return await ollama.generate(validated.prompt, model)
      }, 'generate-report', getWin())
    },

    'generate-image': async (_: any, params: any) => {
      return withErrorHandling(async () => {
        const prompt = typeof params === 'string' ? params : (params?.prompt || params?.query || '');
        if (!prompt) {
          throw new AppError('请提供图片描述/提示词', ErrorCategory.VALIDATION, ErrorLevel.WARNING)
        }
        const capability = await modelRouter.hasImageGenerationCapability()
        if (!capability.available) {
          throw new AppError(
            '没有可用的云端图片生成模型。请在设置中配置支持图片生成的云端模型（OpenAI DALL-E 3、通义万相、智谱 CogView）',
            ErrorCategory.VALIDATION,
            ErrorLevel.WARNING
          )
        }
        return await modelRouter.generateImage(prompt)
      }, 'generate-image', getWin())
    },

    'ollama-gpu-mode': async () => {
      return withErrorHandling(async () => {
        return await getGpuMode()
      }, 'ollama-gpu-mode')
    },

    'ollama-set-gpu-mode': async (_: any, params: any) => {
      return withErrorHandling(async () => {
        const mode = params?.mode as GpuMode
        if (!['auto', 'gpu', 'cpu'].includes(mode)) {
          throw new AppError('无效的 GPU 模式', ErrorCategory.VALIDATION, ErrorLevel.WARNING)
        }
        await setGpuMode(mode)
        return { success: true, mode }
      }, 'ollama-set-gpu-mode', getWin())
    },

    'ollama-url': async () => {
      return withErrorHandling(async () => {
        return await getOllamaUrl()
      }, 'ollama-url')
    },

    'ollama-set-url': async (_: any, params: any) => {
      return withErrorHandling(async () => {
        const url = params?.url as string
        if (!url || !url.trim()) {
          throw new AppError('URL 不能为空', ErrorCategory.VALIDATION, ErrorLevel.WARNING)
        }
        await setOllamaUrl(url)
        return { success: true, url }
      }, 'ollama-set-url', getWin())
    },

    'ollama-model-params': async () => {
      return withErrorHandling(async () => {
        return await getModelParams()
      }, 'ollama-model-params')
    },

    'ollama-set-model-params': async (_: any, params: any) => {
      return withErrorHandling(async () => {
        const p = params?.params as Partial<ModelParams>
        await setModelParams(p)
        return { success: true, params: await getModelParams() }
      }, 'ollama-set-model-params', getWin())
    },

    'check-image-generation-capability': async () => {
      return withErrorHandling(async () => {
        return await modelRouter.hasImageGenerationCapability()
      }, 'check-image-generation-capability')
    },

    'check-whisper-capability': async () => {
      return withErrorHandling(async () => {
        const isRunning = await ollama.isRunning()
        if (!isRunning) return { available: false, reason: 'ollama_not_running' }
        const models = await ollama.listModels()
        const whisperModel = models.find(m => m.toLowerCase().includes('whisper'))
        if (whisperModel) return { available: true, model: whisperModel }
        return { available: false, reason: 'no_whisper_model', installedModels: models }
      }, 'check-whisper-capability')
    },

    'whisper-transcribe': async (_: any, params: any) => {
      return withErrorHandling(async () => {
        const filePath = params?.filePath || params?.path
        if (!filePath) {
          throw new AppError('请提供音频文件路径', ErrorCategory.VALIDATION, ErrorLevel.WARNING)
        }
        const whisperModule = await import('../whisper')
        return await whisperModule.whisperTranscribe(filePath)
      }, 'whisper-transcribe', getWin())
    },
  }
}
