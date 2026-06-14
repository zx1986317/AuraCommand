import { IpcModule, IpcContext } from './index'
import {
  startFullDigest,
  cancelDigest,
  getDigestSummary,
  getDigestByCategory,
  getDigestForPrompt,
  clearDigest,
  incrementalDigest,
} from '../services/knowledgeDigest'
import { withErrorHandling, logInfo } from '../errorHandler'

export function createKnowledgeDigestModule(ctx: IpcContext): IpcModule {
  const getWin = () => ctx.getWin()

  return {
    'start-digest': async (_event: any) => {
      return withErrorHandling(async () => {
        const win = getWin()
        await startFullDigest((current, total, fileName) => {
          try {
            win?.webContents?.send('digest-progress', { current, total, fileName })
          } catch {}
        })
        logInfo('Knowledge digest completed')
        return { success: true }
      }, 'start-digest', getWin())
    },

    'cancel-digest': async () => {
      cancelDigest()
      return { success: true }
    },

    'get-digest-summary': async () => {
      return withErrorHandling(async () => {
        return getDigestSummary()
      }, 'get-digest-summary')
    },

    'get-digest-detail': async (_event: any, category?: string) => {
      return withErrorHandling(async () => {
        return getDigestByCategory(category)
      }, 'get-digest-detail')
    },

    'get-digest-prompt': async () => {
      return withErrorHandling(async () => {
        return getDigestForPrompt()
      }, 'get-digest-prompt')
    },

    'clear-digest': async () => {
      return withErrorHandling(async () => {
        await clearDigest()
        return { success: true }
      }, 'clear-digest', getWin())
    },

    'incremental-digest': async (_event: any, fileIds: string[]) => {
      return withErrorHandling(async () => {
        await incrementalDigest(fileIds)
        return { success: true }
      }, 'incremental-digest', getWin())
    },
  }
}
