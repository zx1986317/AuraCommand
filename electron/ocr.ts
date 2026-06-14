import { getSetting } from './db'
import * as cloudModel from './cloudModel'
import type { CloudConfig } from './cloudModel'
import log from 'electron-log'

interface CloudModelEntry {
  id: string
  name: string
  provider: string
  apiKey: string
  baseUrl: string
  modelName: string
  isVision?: boolean
  capabilities?: {
    chat: boolean
    vision: boolean
    imageGen: boolean
    embedding: boolean
    videoGen: boolean
  }
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
      return [{ id: '_legacy', name: modelName, provider, apiKey, baseUrl: baseUrl || '', modelName }]
    }
  } catch {}
  return []
}

// 已知支持图片理解的云端模型名称模式
const CLOUD_VISION_PATTERNS = [
  /gpt-4o/i, /gpt-4-turbo/i, /gpt-4-vision/i,
  /claude-3[-.]5/i, /claude-3[-.]7/i, /claude-4/i, /claude-sonnet/i, /claude-opus/i,
  /gemini/i, /qwen-vl/i, /qwen2-vl/i, /glm-4v/i,
  /vision/i, /-vl/i,
]

export function isVisionModel(modelName: string, models?: CloudModelEntry[]): boolean {
  if (models) {
    const found = models.find(m => m.modelName === modelName)
    if (found) {
      // 优先使用 capabilities.vision（新字段）
      if (found.capabilities?.vision !== undefined) {
        return found.capabilities.vision
      }
      // 兼容旧字段 isVision
      if (found.isVision !== undefined) {
        return found.isVision
      }
    }
  }
  // 未标记时根据模型名称推断
  return CLOUD_VISION_PATTERNS.some(p => p.test(modelName))
}

async function findVisionConfig(): Promise<CloudConfig | null> {
  const models = await getCloudModels()
  if (models.length === 0) return null

  const visionModel = models.find(m => m.isVision === true)
  const target = visionModel || models[0]
  if (!target) return null

  return {
    provider: target.provider,
    apiKey: target.apiKey,
    baseUrl: target.baseUrl,
    modelName: target.modelName,
  }
}

export async function performLocalOCR(imageBase64: string): Promise<string> {
  const config = await findVisionConfig()
  if (!config) {
    throw new Error('没有配置云端模型，无法进行OCR识别。请在设置中添加云端模型。')
  }

  // 快速检查 API Key 是否存在，避免无效的网络请求
  if (!config.apiKey || !config.apiKey.trim()) {
    throw new Error('云端模型 API Key 未配置，无法进行OCR识别。')
  }

  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '')

  log.info('[OCR] Using cloud vision model for OCR:', config.modelName)

  const result = await cloudModel.cloudAnalyzeImage(
    config,
    base64Data,
    '请识别这张图片中的所有文字，按原始排版输出。只输出识别到的文字，不要解释。'
  )

  log.info('[OCR] Cloud OCR result length:', result.length)
  return result.trim()
}
