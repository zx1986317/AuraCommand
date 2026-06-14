/**
 * P0 #1 修复：ApiKeyStore 单测
 * 验证：
 *  - 保存模型时 API Key 自动加密，列表中只返回 apiKeyMasked
 *  - 删除模型时同步删除密文
 *  - 启动迁移把老数据从明文搬到 Keychain
 *  - getRealApiKey 走 Keychain
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const safeState = { available: true }
vi.mock('electron', () => ({
  safeStorage: {
    get isEncryptionAvailable() { return safeState.available },
    encryptString: (plain: string) => Buffer.from('ENC1:' + plain, 'utf8'),
    decryptString: (buf: Buffer) => {
      const s = buf.toString('utf8')
      return s.startsWith('ENC1:') ? s.slice(5) : ''
    },
  },
}))

const settingStore: Map<string, string> = new Map()
vi.mock('../../electron/db', () => ({
  getSetting: vi.fn(async (key: string) => settingStore.has(key) ? settingStore.get(key)! : null),
  setSetting: vi.fn(async (key: string, value: string) => { settingStore.set(key, value) }),
}))

import {
  saveCloudModel,
  deleteCloudModel,
  getAllPublicCloudModels,
  getRealApiKey,
  migratePlaintextApiKeys,
  findModelForCapability,
} from '../../electron/util/apiKeyStore'

beforeEach(() => {
  safeState.available = true
  settingStore.clear()
})

describe('apiKeyStore（P0 #1）', () => {
  it('saveCloudModel：写入密文，公开列表中 apiKeyMasked 存在且不含明文', async () => {
    const models = await saveCloudModel({
      name: 'GPT-4o',
      provider: 'openai',
      apiKey: 'sk-supersecret-1234567890',
      baseUrl: '',
      modelName: 'gpt-4o',
    })
    expect(models).toHaveLength(1)
    expect((models[0] as any).apiKey).toBeUndefined() // 公开视图不带 apiKey 字段
    expect(models[0]!.apiKeyMasked).toBe('sk-s…7890')
  })

  it('saveCloudModel：原始 setting 中不含明文 apiKey 字段', async () => {
    await saveCloudModel({
      name: 'GPT-4o',
      provider: 'openai',
      apiKey: 'sk-supersecret-1234567890',
      baseUrl: '',
      modelName: 'gpt-4o',
    })
    const raw = settingStore.get('cloud_models')
    expect(raw).toBeDefined()
    expect(raw!).not.toContain('sk-supersecret-1234567890') // 关键断言
  })

  it('getRealApiKey：从密文解出真值', async () => {
    const models = await saveCloudModel({
      name: 'Claude', provider: 'claude',
      apiKey: 'sk-ant-secret-9999999999',
      baseUrl: '', modelName: 'claude-3-5',
    })
    const real = await getRealApiKey(models[0]!.id)
    expect(real).toBe('sk-ant-secret-9999999999')
  })

  it('deleteCloudModel：同步删除 Keychain 中的密文', async () => {
    const models = await saveCloudModel({
      name: 'X', provider: 'openai',
      apiKey: 'sk-del-1234567890', baseUrl: '', modelName: 'x',
    })
    const id = models[0]!.id
    await deleteCloudModel(id)
    const real = await getRealApiKey(id)
    expect(real).toBeNull()
  })

  it('saveCloudModel 二次：覆盖更新', async () => {
    const m1 = await saveCloudModel({
      name: 'A', provider: 'openai', apiKey: 'sk-aaa-1111', baseUrl: '', modelName: 'a',
    })
    const id = m1[0]!.id
    await saveCloudModel({
      id, name: 'A2', provider: 'openai', apiKey: 'sk-bbb-2222', baseUrl: '', modelName: 'a2',
    })
    const list = await getAllPublicCloudModels()
    expect(list).toHaveLength(1)
    expect(list[0]!.name).toBe('A2')
    expect(await getRealApiKey(id)).toBe('sk-bbb-2222')
  })

  it('findModelForCapability：根据能力匹配', async () => {
    await saveCloudModel({
      name: 'Chat', provider: 'openai', apiKey: 'sk-c-1111', baseUrl: '', modelName: 'gpt-4o',
      capabilities: { chat: true, vision: false, imageGen: false, embedding: false, videoGen: false },
    })
    await saveCloudModel({
      name: 'Embed', provider: 'openai', apiKey: 'sk-e-1111', baseUrl: '', modelName: 'text-embedding-3-small',
      capabilities: { chat: false, vision: false, imageGen: false, embedding: true, videoGen: false },
    })
    const found = await findModelForCapability('embedding')
    expect(found?.name).toBe('Embed')
  })
})

describe('migratePlaintextApiKeys（P0 #1 迁移）', () => {
  it('老数据：从 cloud_models 明文搬到 Keychain，并清空 apiKey 字段', async () => {
    settingStore.set('cloud_models', JSON.stringify([
      {
        id: 'old-1', name: 'Old', provider: 'openai',
        apiKey: 'sk-old-plain-1234567890',
        baseUrl: '', modelName: 'gpt-4',
        capabilities: { chat: true, vision: false, imageGen: false, embedding: false, videoGen: false },
      },
    ]))
    const r = await migratePlaintextApiKeys()
    expect(r.migrated).toBe(1)
    const real = await getRealApiKey('old-1')
    expect(real).toBe('sk-old-plain-1234567890')
    const list = await getAllPublicCloudModels()
    expect((list[0] as any).apiKey).toBeUndefined()
    // 二次调用应幂等
    const r2 = await migratePlaintextApiKeys()
    expect(r2.migrated).toBe(0)
  })

  it('空库：migrated=0，不报错', async () => {
    const r = await migratePlaintextApiKeys()
    expect(r.migrated).toBe(0)
  })
})
