/**
 * 知识库管理相关 IPC 处理器
 */
import { IpcModule, IpcContext } from './index'
import { createKnowledgeFilesModule } from './knowledgeFiles'
import { createKnowledgeIndexModule } from './knowledgeIndex'
import { createKnowledgeSearchModule } from './knowledgeSearch'

export function createKnowledgeModule(ctx: IpcContext): IpcModule {
  const filesModule = createKnowledgeFilesModule(ctx)
  const indexModule = createKnowledgeIndexModule(ctx)
  const searchModule = createKnowledgeSearchModule(ctx)
  return { ...filesModule, ...indexModule, ...searchModule }
}
