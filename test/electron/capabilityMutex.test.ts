/**
 * 能力 chip 互斥逻辑单测（P0-#4）
 *
 * 纯函数：从 AiTab.tsx 提取出来的 applyCapabilityMutex 工具函数
 * 规则：
 *   - 选中 chat → 关闭 imageGen / embedding / videoGen
 *   - 选中 imageGen / embedding / videoGen → 关闭 chat（vision 可保留）
 *   - 取消选中 → 无副作用
 */
import { describe, it, expect } from 'vitest'
import { applyCapabilityMutex, type Caps } from '../../electron/util/capabilityMutex'

describe('applyCapabilityMutex（P0 #4 能力互斥）', () => {
  it('初始空 caps：toggle 任意键正常（启用 chat 自动清空专用能力）', () => {
    expect(applyCapabilityMutex({}, 'chat', true)).toEqual({ chat: true, imageGen: false, embedding: false, videoGen: false })
    expect(applyCapabilityMutex({}, 'imageGen', true)).toEqual({ imageGen: true, chat: false })
  })

  it('启用 chat：自动关闭 imageGen/embedding/videoGen', () => {
    const before: Caps = { chat: false, imageGen: true, embedding: true, videoGen: true, vision: true }
    const after = applyCapabilityMutex(before, 'chat', true)
    expect(after.chat).toBe(true)
    expect(after.imageGen).toBe(false)
    expect(after.embedding).toBe(false)
    expect(after.videoGen).toBe(false)
    expect(after.vision).toBe(true) // vision 不受 chat 影响
  })

  it('启用 imageGen：自动关闭 chat', () => {
    const before: Caps = { chat: true, vision: true, imageGen: false, embedding: false, videoGen: false }
    const after = applyCapabilityMutex(before, 'imageGen', true)
    expect(after.imageGen).toBe(true)
    expect(after.chat).toBe(false)
    expect(after.vision).toBe(true) // vision 保留
  })

  it('启用 embedding：自动关闭 chat', () => {
    const before: Caps = { chat: true, vision: false, imageGen: false, embedding: false, videoGen: false }
    const after = applyCapabilityMutex(before, 'embedding', true)
    expect(after.embedding).toBe(true)
    expect(after.chat).toBe(false)
  })

  it('启用 videoGen：自动关闭 chat', () => {
    const before: Caps = { chat: true, vision: false, imageGen: false, embedding: false, videoGen: false }
    const after = applyCapabilityMutex(before, 'videoGen', true)
    expect(after.videoGen).toBe(true)
    expect(after.chat).toBe(false)
  })

  it('取消启用（false）：保持原值不动（不触发互斥）', () => {
    const before: Caps = { chat: true, vision: true, imageGen: false, embedding: false, videoGen: false }
    const after = applyCapabilityMutex(before, 'imageGen', false)
    expect(after).toEqual(before)
  })

  it('vision 单独 toggle：不受互斥影响', () => {
    const before: Caps = { chat: true, vision: false, imageGen: false, embedding: false, videoGen: false }
    const after = applyCapabilityMutex(before, 'vision', true)
    expect(after.vision).toBe(true)
    expect(after.chat).toBe(true) // 保留
  })

  it('从 imageGen=true 切到 chat=true 后再切回 imageGen：能正确恢复', () => {
    let caps: Caps = { chat: false, imageGen: true, vision: false, embedding: false, videoGen: false }
    caps = applyCapabilityMutex(caps, 'chat', true) // 切到 chat，imageGen 应被关
    expect(caps).toEqual({ chat: true, imageGen: false, vision: false, embedding: false, videoGen: false })
    caps = applyCapabilityMutex(caps, 'imageGen', true) // 再切回 imageGen，chat 应被关
    expect(caps).toEqual({ chat: false, imageGen: true, vision: false, embedding: false, videoGen: false })
  })
})
