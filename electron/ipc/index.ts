/**
 * IPC 统一注册入口
 * 收集所有 IPC 模块并统一注册
 */
import { ipcMain } from 'electron'
import { logError, logInfo, logWarn, ErrorCategory } from '../errorHandler'
import { createSchedulesModule } from './schedules'
import { createChatModule } from './chat'
import { createChatSessionModule } from './chatSession'
import { createKnowledgeModule } from './knowledge'
import { createOllamaModule } from './ollama'
import { createWorkflowsModule } from './workflows'
import { createSyncModule } from './sync'
import { createSystemModule } from './system'
import { createFoldersModule } from './folders'
import { createMcpModule } from './mcp'
import { createNotesModule } from './notes'
import { createTasksModule } from './tasks'
import { createExportModule } from './export'
import { createClipsModule } from './clips'
import { createCloudModule } from './cloud'
import { createProjectsModule } from './projects'

export type IpcHandler = (event: any, ...args: any[]) => Promise<any>
export type IpcModule = Record<string, IpcHandler>

export interface IpcContext {
  vaultPath: string
  getWin: () => any
  chatAbortController: { current: AbortController | null }
  setChatAbortController: (ac: AbortController | null) => void
  currentChatRequestId: { current: string | null }
}

export function registerAllIpcHandlers(ctx: IpcContext) {
  logInfo('Starting to register IPC handlers...')
  
  try {
    const modules: IpcModule[] = [
      createSchedulesModule(ctx),
      createChatModule(ctx),
      createChatSessionModule(ctx),
      createKnowledgeModule(ctx),
      createOllamaModule(ctx),
      createWorkflowsModule(ctx),
      createSyncModule(ctx),
      createSystemModule(ctx),
      createFoldersModule(ctx),
      createMcpModule(ctx),
      createNotesModule(ctx),
      createTasksModule(ctx),
      createExportModule(ctx),
      createClipsModule(ctx),
      createCloudModule(ctx),
      createProjectsModule(ctx),
    ]

    logInfo(`Loaded ${modules.length} IPC modules`)

    let totalHandlers = 0
    const registeredChannels: string[] = []
    
    for (const mod of modules) {
      const channels = Object.keys(mod)
      logInfo(`Registering module with ${channels.length} handlers:`, { channels })
      
      Object.entries(mod).forEach(([channel, handler]) => {
        // 清理可能存在的旧处理程序
        ipcMain.removeHandler(channel)
        // 注册新的处理程序
        ipcMain.handle(channel, handler)
        totalHandlers++
        registeredChannels.push(channel)
      })
    }

    logInfo(`All ${totalHandlers} IPC Handlers registered successfully.`)
    logInfo('Registered IPC channels', { channels: registeredChannels })
  } catch (error) {
    logError('Error during IPC handler registration:', ErrorCategory.IPC, { error })
    throw error
  }
}
