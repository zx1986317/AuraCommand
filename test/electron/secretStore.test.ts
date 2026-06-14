/**
 * P0 #1 修复：SecretStore 单测
 * 测试 maskApiKey 纯函数 + set/get/delete/migrate 在 mock 下的行为
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// mock electron safeStorage（用 base64 做可逆编码，纯 ASCII 字符，UTF-8 roundtrip 安全）
const safeState: { available: boolean } = { available: true }
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

// mock db setting layer
const settingStore: Map<string, string> = new Map()
vi.mock('../../electron/db', () => ({
  getSetting: vi.fn(async (key: string) => settingStore.has(key) ? settingStore.get(key)! : null),
  setSetting: vi.fn(async (key: string, value: string) => { settingStore.set(key, value) }),
}))

import { maskApiKey, setSecret, getSecret, deleteSecret, isSecureStorageAvailable, migratePlaintextToSecret } from '../../electron/util/secretStore'

beforeEach(() => {
  safeState.available = true
  settingStore.clear()
})

describe('maskApiKey（P0 #1 纯函数）', () => {
  it('空值 / null / undefined → 空串', () => {
    expect(maskApiKey('')).toBe('')
    expect(maskApiKey(null as any)).toBe('')
    expect(maskApiKey(undefined as any)).toBe('')
  })
  it('长度 ≤ 8：全部遮罩', () => {
    expect(maskApiKey('abc')).toBe('•••')
    expect(maskApiKey('sk-1234')).toBe('•••••••')
  })
  it('长度 > 8：头4…尾4', () => {
    expect(maskApiKey('sk-abcdefghijkl1234')).toBe('sk-a…1234')
  })
})

describe('setSecret + getSecret + deleteSecret', () => {
  it('加密路径：明文写入 → 取出后明文一致', async () => {
    const ok = await setSecret('cloud-api-key', 'm1', 'sk-real-key-1234567890')
    expect(ok).toBe(true)
    const r = await getSecret('cloud-api-key', 'm1')
    expect(r?.value).toBe('sk-real-key-1234567890')
    expect(r?.isPlaintext).toBe(false)
  })

  it('写入密文 ≠ 明文（确保不是明文落盘）', async () => {
    await setSecret('cloud-api-key', 'm1', 'sk-real-key-1234567890')
    const keyInDb = settingStore.get('secret:v1:cloud-api-key:m1')
    expect(keyInDb).toBeDefined()
    expect(keyInDb).not.toBe('sk-real-key-1234567890')
  })

  it('safeStorage 不可用时降级为明文 + 标记', async () => {
    safeState.available = false
    const ok = await setSecret('cloud-api-key', 'm2', 'sk-plain')
    expect(ok).toBe(false)
    const r = await getSecret('cloud-api-key', 'm2')
    expect(r?.value).toBe('sk-plain')
    expect(r?.isPlaintext).toBe(true)
  })

  it('id 中包含 : 自动转 _，防止前缀解析冲突', async () => {
    await setSecret('cloud-api-key', 'abc:123', 'val')
    expect(settingStore.has('secret:v1:cloud-api-key:abc_123')).toBe(true)
    const r = await getSecret('cloud-api-key', 'abc:123')
    expect(r?.value).toBe('val')
  })

  it('deleteSecret 清理值和明文标记', async () => {
    await setSecret('cloud-api-key', 'm1', 'val')
    await deleteSecret('cloud-api-key', 'm1')
    const r = await getSecret('cloud-api-key', 'm1')
    expect(r).toBeNull()
  })

  it('空 scope / id 抛错', async () => {
    await expect(setSecret('' as any, 'x', 'v')).rejects.toThrow()
    await expect(setSecret('cloud-api-key', '', 'v')).rejects.toThrow()
  })

  it('isSecureStorageAvailable 反映 mock 状态', () => {
    safeState.available = true
    expect(isSecureStorageAvailable()).toBe(true)
    safeState.available = false
    expect(isSecureStorageAvailable()).toBe(false)
  })
})

describe('migratePlaintextToSecret（P0 #1 迁移）', () => {
  it('有明文：迁移到 Keychain 并清空原 setting', async () => {
    settingStore.set('cloud_api_key', 'sk-old-plain-1234567890')
    const r = await migratePlaintextToSecret('cloud_api_key', 'cloud-api-key', 'm-legacy')
    expect(r).toBe(true)
    expect(settingStore.get('cloud_api_key')).toBe('') // 已清空
    const secret = await getSecret('cloud-api-key', 'm-legacy')
    expect(secret?.value).toBe('sk-old-plain-1234567890')
  })

  it('无明文：返回 false（不报错）', async () => {
    const r = await migratePlaintextToSecret('cloud_api_key', 'cloud-api-key', 'm-x')
    expect(r).toBe(false)
  })

  it('密文已存在：跳过迁移但仍清空原明文', async () => {
    await setSecret('cloud-api-key', 'm-1', 'sk-new')
    settingStore.set('cloud_api_key', 'sk-old')
    const r = await migratePlaintextToSecret('cloud_api_key', 'cloud-api-key', 'm-1')
    expect(r).toBeNull()
    expect(settingStore.get('cloud_api_key')).toBe('') // 明文清掉了
    const secret = await getSecret('cloud-api-key', 'm-1')
    expect(secret?.value).toBe('sk-new') // 仍是新密文
  })
})
