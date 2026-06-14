/**
 * 首启动引导触发条件单测（P0-#3）
 */
import { describe, it, expect } from 'vitest'
import { decideOnboardingTrigger } from '../../electron/util/onboardingTrigger'

describe('decideOnboardingTrigger（P0 #3 引导触发）', () => {
  it('看过：永远不弹', () => {
    expect(
      decideOnboardingTrigger({ hasSeen: true, contentCount: 0, aiConnected: false, chatModelReady: false })
    ).toEqual({ shouldShow: false, step: 0, reason: 'never' })
  })

  it('没看过 + 0 内容 + AI 就绪：从 step 0 弹（首启动）', () => {
    expect(
      decideOnboardingTrigger({ hasSeen: false, contentCount: 0, aiConnected: true, chatModelReady: true })
    ).toEqual({ shouldShow: true, step: 0, reason: 'first-launch' })
  })

  it('没看过 + 有内容 + AI 未连接：从 step 0 弹（AI 卡点）', () => {
    expect(
      decideOnboardingTrigger({ hasSeen: false, contentCount: 5, aiConnected: false, chatModelReady: false })
    ).toEqual({ shouldShow: true, step: 0, reason: 'ai-unready' })
  })

  it('没看过 + 有内容 + 已连接但缺对话模型：从 step 0 弹（AI 卡点）', () => {
    expect(
      decideOnboardingTrigger({ hasSeen: false, contentCount: 5, aiConnected: true, chatModelReady: false })
    ).toEqual({ shouldShow: true, step: 0, reason: 'ai-unready' })
  })

  it('没看过 + 有内容 + AI 全就绪：弹 1 次到 step 1（AI 检查）', () => {
    // P0 #3 修复关键场景：之前会被 hasAnyContent 压制，现在会弹
    expect(
      decideOnboardingTrigger({ hasSeen: false, contentCount: 10, aiConnected: true, chatModelReady: true })
    ).toEqual({ shouldShow: true, step: 1, reason: 'content-but-unseen' })
  })
})
