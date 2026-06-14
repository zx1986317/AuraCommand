/**
 * 模型能力互斥工具（P0-#4 修复提取）
 *
 * 规则来源：`docs/UX-Analysis-Report.md` §6.3 能力路由
 *   "imageGen/embedding/videoGen 三者**与 chat 互斥**（代码 `caps.chat = false`）"
 *
 * 设计原则：
 *   - 选中专用能力时自动关闭 chat
 *   - 选中 chat 时自动关闭专用能力
 *   - vision 与 chat 可同时存在（视觉模型通常也能做对话）
 *   - 取消选中（false）不触发互斥，避免误清空
 *
 * 从 electron/util/capabilityMutex.ts 迁移至 src/shared/，
 * 供渲染进程直接引用，避免 Vite 打包时触发 require('electron')。
 */
export interface Caps {
  chat?: boolean
  vision?: boolean
  imageGen?: boolean
  embedding?: boolean
  videoGen?: boolean
  [k: string]: boolean | undefined
}

const MUTEX_GROUP: Array<keyof Caps> = ['imageGen', 'embedding', 'videoGen']

export function applyCapabilityMutex(
  current: Caps,
  key: keyof Caps,
  willEnable: boolean
): Caps {
  if (!willEnable) {
    // 取消选中 → 不触发互斥
    return { ...current, [key]: false }
  }
  if (key === 'chat') {
    // 启用 chat → 关闭专用能力（vision 保留）
    return { ...current, chat: true, imageGen: false, embedding: false, videoGen: false }
  }
  if (MUTEX_GROUP.includes(key)) {
    // 启用专用能力 → 关闭 chat
    return { ...current, [key]: true, chat: false }
  }
  // vision 或其他：直接切换
  return { ...current, [key]: true }
}

/**
 * 判断某个能力 chip 当前是否应该被禁用（互斥状态）
 */
export function isCapabilityDisabled(caps: Caps, key: keyof Caps): boolean {
  if (key === 'chat') return MUTEX_GROUP.some((k) => !!caps[k])
  if (MUTEX_GROUP.includes(key)) return !!caps.chat
  return false
}
