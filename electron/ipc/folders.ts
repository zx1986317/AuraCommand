/**
 * 虚拟文件夹管理相关 IPC 处理器
 */
import { IpcModule, IpcContext } from './index'
import dbHelper from '../db'
import {
  CreateFolderSchema,
  RenameFolderSchema,
  DeleteFolderSchema,
  MoveFileToFolderSchema,
  validateInput,
} from './schemas'
import {
  withErrorHandling,
  logInfo,
  logWarn,
  ErrorCategory,
  ErrorLevel,
  AppError,
} from '../errorHandler'

export function createFoldersModule(ctx: IpcContext): IpcModule {
  const getWin = () => ctx.getWin()

  return {
    'get-folders': async () => {
      return withErrorHandling(async () => {
        const folders = await dbHelper.allQuery('SELECT * FROM kb_folders ORDER BY name ASC')
        return folders
      }, 'get-folders')
    },

    'create-folder': async (_: any, params: any) => {
      return withErrorHandling(async () => {
        const validated = validateInput(CreateFolderSchema, params, 'create-folder')
        const id = `folder-${Date.now()}`
        await dbHelper.runQuery(
          'INSERT INTO kb_folders (id, name, parent_id, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
          [id, validated.name, validated.parentId || null]
        )
        logInfo('Folder created', { id, name: validated.name })
        return { success: true, id, name: validated.name }
      }, 'create-folder', getWin())
    },

    'update-folder': async (_: any, params: any) => {
      return withErrorHandling(async () => {
        const { id, name, parentId } = params
        if (!id || typeof id !== 'string') {
          throw new AppError('无效的文件夹 ID', ErrorCategory.VALIDATION, ErrorLevel.WARNING)
        }
        const updates: string[] = []
        const updateParams: any[] = []
        if (name !== undefined) {
          if (typeof name !== 'string' || name.trim().length === 0) {
            throw new AppError('文件夹名称不能为空', ErrorCategory.VALIDATION, ErrorLevel.WARNING)
          }
          if (name.length > 100) {
            throw new AppError('文件夹名称过长', ErrorCategory.VALIDATION, ErrorLevel.WARNING)
          }
          updates.push('name = ?')
          updateParams.push(name)
        }
        if (parentId !== undefined) {
          updates.push('parent_id = ?')
          updateParams.push(parentId)
        }
        if (updates.length > 0) {
          updateParams.push(id)
          await dbHelper.runQuery(`UPDATE kb_folders SET ${updates.join(', ')} WHERE id = ?`, updateParams)
        }
        logInfo('Folder updated', { id })
        return { success: true }
      }, 'update-folder', getWin())
    },

    'delete-folder': async (_: any, params: any) => {
      return withErrorHandling(async () => {
        const validated = validateInput(DeleteFolderSchema, params, 'delete-folder')
        await dbHelper.runQuery('DELETE FROM file_folder WHERE folder_id = ?', [validated.id])
        await dbHelper.runQuery('DELETE FROM kb_folders WHERE id = ?', [validated.id])
        logInfo('Folder deleted', { id: validated.id })
        return { success: true }
      }, 'delete-folder', getWin())
    },

    'move-memo-to-folder': async (_: any, params: any) => {
      return withErrorHandling(async () => {
        const { memoId, folderId } = params
        if (!memoId || typeof memoId !== 'string') {
          throw new AppError('无效的便签 ID', ErrorCategory.VALIDATION, ErrorLevel.WARNING)
        }
        if (folderId !== null && folderId !== undefined && typeof folderId !== 'string') {
          throw new AppError('无效的文件夹 ID', ErrorCategory.VALIDATION, ErrorLevel.WARNING)
        }
        if (folderId) {
          await dbHelper.runQuery('INSERT OR REPLACE INTO file_folder (file_id, folder_id) VALUES (?, ?)', [memoId, folderId])
        } else {
          await dbHelper.runQuery('DELETE FROM file_folder WHERE file_id = ?', [memoId])
        }
        logInfo('Memo moved to folder', { memoId, folderId })
        return { success: true }
      }, 'move-memo-to-folder', getWin())
    },

    'get-folder-memos': async (_: any, { folderId }: { folderId: string }) => {
      return withErrorHandling(async () => {
        if (!folderId || typeof folderId !== 'string') {
          throw new AppError('无效的文件夹 ID', ErrorCategory.VALIDATION, ErrorLevel.WARNING)
        }
        const memos = await dbHelper.allQuery(
          'SELECT fm.* FROM file_metadata fm JOIN file_folder ff ON fm.id = ff.file_id WHERE ff.folder_id = ? ORDER BY fm.file_name ASC',
          [folderId]
        )
        return memos
      }, 'get-folder-memos')
    },

    'reorder-folders': async (_: any, { folderIds }: { folderIds: string[] }) => {
      return withErrorHandling(async () => {
        if (!Array.isArray(folderIds) || folderIds.length === 0) {
          throw new AppError('无效的文件夹 ID 列表', ErrorCategory.VALIDATION, ErrorLevel.WARNING)
        }
        for (let i = 0; i < folderIds.length; i++) {
          await dbHelper.runQuery('UPDATE kb_folders SET sort_order = ? WHERE id = ?', [i, folderIds[i]])
        }
        logInfo('Folders reordered', { count: folderIds.length })
        return { success: true }
      }, 'reorder-folders', getWin())
    },

    'get-kb-folders': async () => {
      return withErrorHandling(async () => {
        const folders = await dbHelper.allQuery('SELECT * FROM kb_folders ORDER BY name ASC')
        logInfo('KB folders retrieved', { count: folders.length })
        return { success: true, folders }
      }, 'get-kb-folders')
    },

    'create-kb-folder': async (_: any, params: any) => {
      return withErrorHandling(async () => {
        const validated = validateInput(CreateFolderSchema, params, 'create-kb-folder')
        const { v4: uuidv4 } = await import('uuid')
        const id = uuidv4()
        await dbHelper.runQuery(
          'INSERT INTO kb_folders (id, name, parent_id, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
          [id, validated.name, validated.parentId || null]
        )
        logInfo('KB folder created', { id, name: validated.name })
        return { success: true, id }
      }, 'create-kb-folder', getWin())
    },

    'rename-kb-folder': async (_: any, params: any) => {
      return withErrorHandling(async () => {
        const validated = validateInput(RenameFolderSchema, params, 'rename-kb-folder')
        await dbHelper.runQuery('UPDATE kb_folders SET name = ? WHERE id = ?', [validated.name, validated.id])
        logInfo('KB folder renamed', { id: validated.id, name: validated.name })
        return { success: true }
      }, 'rename-kb-folder', getWin())
    },

    'delete-kb-folder': async (_: any, params: any) => {
      return withErrorHandling(async () => {
        const validated = validateInput(DeleteFolderSchema, params, 'delete-kb-folder')
        await dbHelper.runQuery('DELETE FROM file_folder WHERE folder_id = ?', [validated.id])
        await dbHelper.runQuery('DELETE FROM kb_folders WHERE id = ?', [validated.id])
        logInfo('KB folder deleted', { id: validated.id })
        return { success: true }
      }, 'delete-kb-folder', getWin())
    },

    'move-file-to-folder': async (_: any, params: any) => {
      return withErrorHandling(async () => {
        const validated = validateInput(MoveFileToFolderSchema, params, 'move-file-to-folder')
        await dbHelper.runQuery('INSERT OR REPLACE INTO file_folder (file_id, folder_id) VALUES (?, ?)', [validated.fileId, validated.folderId])
        logInfo('File moved to folder', { fileId: validated.fileId, folderId: validated.folderId })
        return { success: true }
      }, 'move-file-to-folder', getWin())
    },

    'get-files-in-folder': async (_: any, { folderId }: { folderId: string }) => {
      return withErrorHandling(async () => {
        if (!folderId || typeof folderId !== 'string') {
          throw new AppError('无效的文件夹 ID', ErrorCategory.VALIDATION, ErrorLevel.WARNING)
        }
        const files = await dbHelper.allQuery(
          'SELECT fm.* FROM file_metadata fm JOIN file_folder ff ON fm.id = ff.file_id WHERE ff.folder_id = ? ORDER BY fm.file_name ASC',
          [folderId]
        )
        return files
      }, 'get-files-in-folder')
    },
  }
}
