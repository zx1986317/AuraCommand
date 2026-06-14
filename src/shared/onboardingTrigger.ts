/**
 * 首启动引导触发条件判断（P0-#3 修复提取）
 *
 * 规则来源：`docs/UX-Analysis-Report.md` §5.2 痛点 #2
 *   "无系统级 Onboarding 引导，70% 用户不会用'工作流/记忆'，模型配置界面劝退非技术用户"
 *
 * 修复前逻辑：`!hasSeen && !hasAnyContent` → 已有内容时永远不弹
 * 修复后逻辑：
 *   - 用户没看过（!hasSeen）→ 必弹
 *   - AI 引擎未就绪 → 必弹
 *   - 已有内容 + AI 就绪 + 用户没看过 → 弹一次（落到第 1 步"AI 检查"）
 *   - 看过 → 不弹
 *
 * 从 electron/util/onboardingTrigger.ts 迁移至 src/shared/，
 * 供渲染进程直接引用，避免 Vite 打包时触发 require('electron')。
 */

export interface OnboardingTriggerInput {
  hasSeen: boolean
  contentCount: number
  aiConnected: boolean
  chatModelReady: boolean
}

export interface OnboardingTriggerResult {
  shouldShow: boolean
  step: 0 | 1
  reason: 'never' | 'first-launch' | 'ai-unready' | 'content-but-unseen'
}

export function decideOnboardingTrigger(input: OnboardingTriggerInput): OnboardingTriggerResult {
  const { hasSeen, contentCount, aiConnected, chatModelReady } = input
  if (hasSeen) {
    return { shouldShow: false, step: 0, reason: 'never' }
  }
  const aiNotReady = !aiConnected || !chatModelReady
  const contentEmpty = contentCount === 0
  if (contentEmpty || aiNotReady) {
    return { shouldShow: true, step: 0, reason: contentEmpty ? 'first-launch' : 'ai-unready' }
  }
  // 已有内容 + AI 就绪 + 没看过：弹一次，落"AI 检查"步
  return { shouldShow: true, step: 1, reason: 'content-but-unseen' }
}
