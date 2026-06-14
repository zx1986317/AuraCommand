/**
 * 密文存储 (SecretStore) — P0 #1 修复：API Key Keychain 加密
 *
 * 封装 Electron safeStorage：
 *  - Windows：DPAPI（与当前用户账户绑定）
 *  - macOS：Keychain
 *  - Linux：kwallet/libsecret（如不可用则降级为本地 AES 提示）
 *
 * 存储位置：app_settings (key=secret:v1:<scope>:<id>, value=base64 密文)
 * 业务层不要直接拼这个前缀，请通过本文件 export 的函数访问。
 */
import { safeStorage } from 'electron'
import log from 'electron-log'
import { getSetting, setSetting } from '../db'

export type SecretScope = 'cloud-api-key' | 'webdav-password' | 's3-secret'

/** secret: 前缀统一在这里维护，方便将来切换到独立表 */
const SECRET_KEY_PREFIX = 'secret:v1:'
const PLAINTEXT_FLAG_SUFFIX = ':was-plaintext' // 迁移标记

/** 简单 base64 编解码（Node Buffer 即可） */
function toBase64(buf: Buffer): string {
  return buf.toString('base64')
}
function fromBase64(s: string): Buffer {
  return Buffer.from(s, 'base64')
}

/**
 * safeStorage 在某些 Linux 环境下不可用（isEncryptionAvailable=false）。
 * 这时使用 DPAPI 不可用的兜底：直接返回明文 + 在 storage key 中加 :plain 标记。
 * 上层在展示/导出时应再次提示用户。
 *
 * 注：Electron 官方 API 中 isEncryptionAvailable 是 **属性**（非方法），
 * 这里直接读属性；mock 在单测里也是 property 而非 method。
 */
function fallbackEnabled(): boolean {
  try {
    return !(safeStorage as any).isEncryptionAvailable
  } catch {
    return true
  }
}

export function isSecureStorageAvailable(): boolean {
  try {
    return !!(safeStorage as any).isEncryptionAvailable
  } catch {
    return false
  }
}

function buildKey(scope: SecretScope, id: string): string {
  if (!scope || !id) throw new Error('SecretStore: scope and id are required')
  // 防止上层把 : 拼进 id 后破坏前缀解析
  const safeId = id.replace(/:/g, '_')
  return `${SECRET_KEY_PREFIX}${scope}:${safeId}`
}

/**
 * 写入一个密文。如果 safeStorage 不可用，降级为明文存储（标记为 :plain）。
 * 返回值：true=已加密，false=降级为明文。
 */
export async function setSecret(scope: SecretScope, id: string, plaintext: string): Promise<boolean> {
  if (typeof plaintext !== 'string') throw new Error('SecretStore: plaintext must be a string')
  const key = buildKey(scope, id)
  if (fallbackEnabled()) {
    log.warn(`[SecretStore] safeStorage 不可用，降级为明文存储: ${scope}:${id}`)
    await setSetting(key, plaintext)
    await setSetting(key + PLAINTEXT_FLAG_SUFFIX, '1')
    return false
  }
  const encrypted = safeStorage.encryptString(plaintext)
  await setSetting(key, toBase64(encrypted))
  // 清除旧的可能存在的明文标记
  await setSetting(key + PLAINTEXT_FLAG_SUFFIX, '')
  return true
}

/**
 * 读取一个密文。如果发现是降级存储的明文，仍然原样返回（但会通过 isPlaintext 提示上层）。
 */
export async function getSecret(scope: SecretScope, id: string): Promise<{ value: string; isPlaintext: boolean } | null> {
  const key = buildKey(scope, id)
  const raw = await getSetting(key)
  // 把 null / undefined / 空串都视为"未存"
  if (raw === null || raw === undefined || raw === '') return null
  const plaintextFlag = await getSetting(key + PLAINTEXT_FLAG_SUFFIX)
  const isPlaintext = plaintextFlag === '1'
  if (isPlaintext) {
    return { value: String(raw), isPlaintext: true }
  }
  if (fallbackEnabled()) {
    // 理论不该走到这里（写入时已设 flag），但保险起见
    return { value: String(raw), isPlaintext: true }
  }
  try {
    const buf = fromBase64(String(raw))
    return { value: safeStorage.decryptString(buf), isPlaintext: false }
  } catch (err: any) {
    log.error(`[SecretStore] decrypt failed for ${scope}:${id}:`, err)
    return null
  }
}

/**
 * 删除一个密文（包括明文标记）。
 */
export async function deleteSecret(scope: SecretScope, id: string): Promise<void> {
  const key = buildKey(scope, id)
  await setSetting(key, '')
  await setSetting(key + PLAINTEXT_FLAG_SUFFIX, '')
}

/**
 * 列出某个 scope 下的所有 id（解析前缀，过滤已删除的空值）。
 */
export async function listSecretIds(scope: SecretScope): Promise<string[]> {
  // 当前 db helper 没有 all-by-prefix，所以这里用一次性的实现：
  // 借由 getSetting 在上层加一个 listSettingByPrefix 不划算，单条 list 用法有限；
  // 因此采用：调用方应自己在业务层维护 id 列表，listSecretIds 仅作为辅助（扫描所有设置不可行）。
  // 这里返回空数组表示"无法列出"，调用方不应依赖此函数。
  void scope
  return []
}

/**
 * 把一个老的明文字符串迁移到加密存储。迁移完成后会清除原明文 key。
 *
 * @param oldSettingKey  原明文 setting 的 key（必填）
 * @param scope           新 scope
 * @param id              新 id
 * @returns true=已迁移，false=原明文不存在或为空，null=无需迁移（已是密文或安全存储不可用）
 */
export async function migratePlaintextToSecret(
  oldSettingKey: string,
  scope: SecretScope,
  id: string
): Promise<boolean | null> {
  const plaintext = await getSetting(oldSettingKey)
  if (!plaintext) return false
  const newKey = buildKey(scope, id)
  const newVal = await getSetting(newKey)
  if (newVal && newVal !== '' && !(await isMarkedPlaintext(newKey))) {
    // 已存在密文，跳过
    await setSetting(oldSettingKey, '')
    return null
  }
  await setSecret(scope, id, String(plaintext))
  await setSetting(oldSettingKey, '')
  return true
}

async function isMarkedPlaintext(key: string): Promise<boolean> {
  const flag = await getSetting(key + PLAINTEXT_FLAG_SUFFIX)
  return flag === '1'
}

/**
 * 对外暴露的纯函数：生成 masked 显示，例如 sk-...1234
 * 不依赖 Electron 任何 API，可纯单测。
 */
export function maskApiKey(plain: string | null | undefined): string {
  if (!plain) return ''
  const s = String(plain)
  if (s.length <= 8) return '•'.repeat(s.length)
  const head = s.slice(0, 4)
  const tail = s.slice(-4)
  return `${head}…${tail}`
}
