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

export function isVisionModel(modelName: string, models?: CloudModelEntry[]): boolean {
  if (models) {
    const found = models.find(m => m.modelName === modelName)
    if (found && found.isVision !== undefined) {
      return found.isVision
    }
  }
  return false
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
