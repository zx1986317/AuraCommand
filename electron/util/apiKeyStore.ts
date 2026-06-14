/**
 * API Key Store — P0 #1 修复：在云端模型配置场景下统一管理 API Key 的密文存取与迁移
 *
 * 业务约定：
 *  - cloud_models 列表里不再以明文形式保存 apiKey 字段
 *  - 真实 Key 通过 secretStore 加密保存，scope='cloud-api-key', id=model.id
 *  - 暴露给前端的 CloudModelEntry.apiKeyMasked 永远只是脱敏后的"头4…尾4"
 *  - 真值只在 IPC 内部（主进程 → 外部 HTTP 请求）使用
 *
 * 旧数据兼容：
 *  - getAllCloudModelsWithKeys() 启动时会把旧 cloud_models 里残留的明文迁移到密文存储
 */
import { v4 as uuidv4 } from 'uuid'
import { getSetting, setSetting } from '../db'
import {
  setSecret,
  getSecret,
  deleteSecret,
  isSecureStorageAvailable,
  maskApiKey,
} from './secretStore'

export type ModelCapabilities = {
  chat: boolean
  vision: boolean
  imageGen: boolean
  embedding: boolean
  videoGen: boolean
}

export interface CloudModelEntry {
  id: string
  name: string
  provider: string
  apiKey: string // 已弃用：保留字段仅作历史兼容；新数据应为空
  apiKeyMasked: string // 前端展示用
  baseUrl: string
  modelName: string
  capabilities: ModelCapabilities
  isVision?: boolean
}

const SETTING_KEY = 'cloud_models'
const MIGRATION_DONE_KEY = 'cloud_models:secret-migrated:v1'

/** 给前端的安全视图：不包含明文 */
export interface PublicCloudModelEntry
  extends Omit<CloudModelEntry, 'apiKey'> {}

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
  if (['vision', 'vl', 'gpt-4o', 'gpt-4-turbo', 'claude-3', 'gemini'].some(k => modelLower.includes(k))) {
    caps.vision = true
  }
  if (['dall-e', 'gpt-image', 'wanx', 't2i', 'cogview', '-image'].some(k => modelLower.includes(k))) {
    caps.chat = false
    caps.imageGen = true
  }
  if (['t2v', 'i2v', 'video'].some(k => modelLower.includes(k))) {
    caps.chat = false
    caps.videoGen = true
  }
  return caps
}

function migrateModelEntry(model: any): CloudModelEntry {
  const inferredCaps = model.capabilities ?? getDefaultCapabilities(model.provider, model.modelName)
  if (!model.capabilities) {
    if (model.isVision) inferredCaps.vision = true
  }
  return {
    id: model.id || uuidv4(),
    name: model.name || model.modelName,
    provider: model.provider || '',
    apiKey: model.apiKey || '', // 历史明文，迁移后会清空
    apiKeyMasked: maskApiKey(model.apiKey),
    baseUrl: model.baseUrl || '',
    modelName: model.modelName || '',
    capabilities: inferredCaps,
    ...(model.isVision !== undefined ? { isVision: model.isVision } : {}),
  }
}

async function loadRawModels(): Promise<CloudModelEntry[]> {
  try {
    const raw = await getSetting(SETTING_KEY)
    if (raw) {
      const arr = typeof raw === 'string' ? JSON.parse(raw) : raw
      return (arr as any[]).map(migrateModelEntry)
    }
  } catch {}
  // 旧 schema 兼容
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
        apiKeyMasked: maskApiKey(apiKey),
        baseUrl: baseUrl || '',
        modelName,
        capabilities: getDefaultCapabilities(provider, modelName),
      }]
    }
  } catch {}
  return []
}

async function saveRawModels(models: CloudModelEntry[]): Promise<void> {
  // 持久化前把 apiKey 清空，只保留密文引用
  const toStore = models.map(m => {
    const { apiKey: _ignore, ...rest } = m
    return { ...rest, apiKey: '' }
  })
  await setSetting(SETTING_KEY, JSON.stringify(toStore))
}

/**
 * 启动时调用一次：把旧的 cloud_models 里的明文 apiKey 迁移到 secretStore。
 * 幂等，可重复执行。
 */
export async function migratePlaintextApiKeys(): Promise<{ migrated: number; secure: boolean }> {
  const flag = await getSetting(MIGRATION_DONE_KEY)
  if (flag === '1' && isSecureStorageAvailable()) {
    return { migrated: 0, secure: true }
  }
  const models = await loadRawModels()
  let migrated = 0
  for (const m of models) {
    if (m.apiKey) {
      await setSecret('cloud-api-key', m.id, m.apiKey)
      m.apiKey = ''
      m.apiKeyMasked = ''
      migrated++
    }
  }
  if (migrated > 0 || models.length > 0) {
    await saveRawModels(models)
  }
  await setSetting(MIGRATION_DONE_KEY, '1')
  return { migrated, secure: isSecureStorageAvailable() }
}

/** 公开：返回给前端的视图（不含明文） */
export async function getAllPublicCloudModels(): Promise<PublicCloudModelEntry[]> {
  const models = await loadRawModels()
  const out: PublicCloudModelEntry[] = []
  for (const m of models) {
    const { apiKey: _ignore, ...pub } = m
    // 始终用密文里的真值生成最新 mask
    const secret = await getSecret('cloud-api-key', m.id)
    const masked = maskApiKey(secret?.value || m.apiKeyMasked || m.apiKey)
    out.push({ ...pub, apiKeyMasked: masked })
  }
  return out
}

/** 主进程内部用：拿真实 apiKey（给 HTTP 请求用），绝不打 log */
export async function getRealApiKey(modelId: string): Promise<string | null> {
  const r = await getSecret('cloud-api-key', modelId)
  return r?.value ?? null
}

/** 保存或更新一个模型：明文 apiKey 通过参数传入，内部立刻转密文 */
export async function saveCloudModel(input: {
  id?: string
  name: string
  provider: string
  apiKey: string
  baseUrl: string
  modelName: string
  capabilities?: ModelCapabilities
  isVision?: boolean
}): Promise<PublicCloudModelEntry[]> {
  const models = await loadRawModels()
  const caps = input.capabilities ?? getDefaultCapabilities(input.provider, input.modelName)
  const id = input.id || uuidv4()
  // 写密文
  if (input.apiKey) {
    await setSecret('cloud-api-key', id, input.apiKey)
  }
  const next: CloudModelEntry = {
    id,
    name: input.name || input.modelName,
    provider: input.provider,
    apiKey: '', // 不再持久化
    apiKeyMasked: maskApiKey(input.apiKey),
    baseUrl: input.baseUrl || '',
    modelName: input.modelName,
    capabilities: caps,
    ...(input.isVision !== undefined ? { isVision: input.isVision } : {}),
  }
  const idx = models.findIndex(m => m.id === id)
  if (idx >= 0) {
    models[idx] = next
  } else {
    models.push(next)
  }
  await saveRawModels(models)
  return getAllPublicCloudModels()
}

export async function deleteCloudModel(modelId: string): Promise<PublicCloudModelEntry[]> {
  const models = await loadRawModels()
  const filtered = models.filter(m => m.id !== modelId)
  await saveRawModels(filtered)
  await deleteSecret('cloud-api-key', modelId)
  return getAllPublicCloudModels()
}

export async function findModelForCapability(capability: keyof ModelCapabilities): Promise<PublicCloudModelEntry | null> {
  const all = await getAllPublicCloudModels()
  return all.find(m => m.capabilities[capability]) || null
}
