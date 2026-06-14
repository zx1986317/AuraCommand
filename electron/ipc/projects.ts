import { IpcModule, IpcContext } from './index'
import dbHelper from '../db'
import { z } from 'zod'
import { validateInput, CreateProjectSchema, RenameProjectSchema, DeleteProjectSchema } from './schemas'
import { withErrorHandling, logInfo, ErrorCategory, ErrorLevel, AppError } from '../errorHandler'

const AddToProjectSchema = z.object({
  projectName: z.string().min(1).max(100),
  itemType: z.enum(['note', 'document', 'clip', 'task', 'kb_file']),
  itemId: z.string().min(1),
})
const RemoveFromProjectSchema = z.object({
  projectName: z.string().min(1).max(100),
  itemType: z.enum(['note', 'document', 'clip', 'task', 'kb_file']),
  itemId: z.string().min(1),
})

const ListProjectItemsSchema = z.object({
  projectName: z.string().min(1).max(100),
})

const ListProjectsSchema = z.object({}).optional()

function getValidatedProjectName(name: string): string {
  const trimmed = String(name ?? '').trim()
  if (trimmed.length === 0) {
    throw new AppError('项目名不能为空', ErrorCategory.VALIDATION, ErrorLevel.WARNING)
  }
  if (trimmed.length > 100) {
    throw new AppError('项目名最长 100 字符', ErrorCategory.VALIDATION, ErrorLevel.WARNING)
  }
  return trimmed
}

async function listProjectsRaw(): Promise<string[]> {
  const rows = await dbHelper.allQuery(
    'SELECT name FROM projects ORDER BY created_at DESC'
  )
  return rows.map((r: any) => r.name)
}

export function createProjectsModule(_ctx: IpcContext): IpcModule {
  return {
    'add-to-project': async (_event: any, args: any) => {
      return withErrorHandling(async () => {
        const validated = validateInput(AddToProjectSchema, args, 'add-to-project')
        await dbHelper.runQuery(
          'INSERT OR IGNORE INTO project_items (project_name, item_type, item_id) VALUES (?, ?, ?)',
          [validated.projectName, validated.itemType, validated.itemId]
        )
        if (validated.itemType === 'note') {
          await dbHelper.runQuery(
            'UPDATE notes SET project = ? WHERE id = ?',
            [validated.projectName, validated.itemId]
          )
        } else if (validated.itemType === 'document') {
          await dbHelper.runQuery(
            "UPDATE notes SET project = ? WHERE type='document' AND id = ?",
            [validated.projectName, validated.itemId]
          )
        }
        logInfo('Item added to project', { projectName: validated.projectName, itemType: validated.itemType, itemId: validated.itemId })
        return { success: true }
      }, 'add-to-project', _ctx.getWin())
    },

    'remove-from-project': async (_event: any, args: any) => {
      return withErrorHandling(async () => {
        const validated = validateInput(RemoveFromProjectSchema, args, 'remove-from-project')
        await dbHelper.runQuery(
          'DELETE FROM project_items WHERE project_name = ? AND item_type = ? AND item_id = ?',
          [validated.projectName, validated.itemType, validated.itemId]
        )
        if (validated.itemType === 'note') {
          const otherProjects = await dbHelper.allQuery(
            "SELECT DISTINCT project_name FROM project_items WHERE item_type = 'note' AND item_id = ?",
            [validated.itemId]
          )
          if (otherProjects.length === 0) {
            await dbHelper.runQuery('UPDATE notes SET project = \'\' WHERE id = ?', [validated.itemId])
          } else {
            await dbHelper.runQuery('UPDATE notes SET project = ? WHERE id = ?', [otherProjects[0].project_name, validated.itemId])
          }
        } else if (validated.itemType === 'document') {
          const otherProjects = await dbHelper.allQuery(
            "SELECT DISTINCT project_name FROM project_items WHERE item_type = 'document' AND item_id = ?",
            [validated.itemId]
          )
          if (otherProjects.length === 0) {
            await dbHelper.runQuery("UPDATE notes SET project = '' WHERE type='document' AND id = ?", [validated.itemId])
          } else {
            await dbHelper.runQuery("UPDATE notes SET project = ? WHERE type='document' AND id = ?", [otherProjects[0].project_name, validated.itemId])
          }
        }
        logInfo('Item removed from project', { projectName: validated.projectName, itemType: validated.itemType, itemId: validated.itemId })
        return { success: true }
      }, 'remove-from-project', _ctx.getWin())
    },

    'list-project-items': async (_event: any, args: any) => {
      return withErrorHandling(async () => {
        const validated = validateInput(ListProjectItemsSchema, args, 'list-project-items')
        const rows = await dbHelper.allQuery(
          'SELECT item_type, item_id FROM project_items WHERE project_name = ?',
          [validated.projectName]
        )
        const byType: { note: string[]; document: string[]; clip: string[]; task: string[]; kb_file: string[] } = { note: [], document: [], clip: [], task: [], kb_file: [] }
        for (const row of rows) {
          const t = row.item_type as string
          if (t in byType) byType[t as keyof typeof byType].push(row.item_id as string)
        }

        let notes: any[] = []
        if (byType.note.length > 0) {
          const placeholders = byType.note.map(() => '?').join(',')
          notes = await dbHelper.allQuery(
            `SELECT id, title, type, updated_at FROM notes WHERE id IN (${placeholders})`,
            byType.note
          )
        }

        let documents: any[] = []
        if (byType.document.length > 0) {
          const placeholders = byType.document.map(() => '?').join(',')
          documents = await dbHelper.allQuery(
            `SELECT id, title, category, updated_at FROM notes WHERE type='document' AND id IN (${placeholders})`,
            byType.document
          )
        }

        let clips: any[] = []
        if (byType.clip.length > 0) {
          const placeholders = byType.clip.map(() => '?').join(',')
          clips = await dbHelper.allQuery(
            `SELECT id, content, ocr_text, created_at FROM clips WHERE id IN (${placeholders})`,
            byType.clip
          )
        }

        let tasks: any[] = []
        if (byType.task.length > 0) {
          const placeholders = byType.task.map(() => '?').join(',')
          tasks = await dbHelper.allQuery(
            `SELECT id, title, status, priority, due_date FROM tasks WHERE id IN (${placeholders})`,
            byType.task
          )
        }

        let kb_files: any[] = []
        if (byType.kb_file.length > 0) {
          const placeholders = byType.kb_file.map(() => '?').join(',')
          kb_files = await dbHelper.allQuery(
            `SELECT id, title, file_name, updated_at FROM file_metadata WHERE id IN (${placeholders})`,
            byType.kb_file
          )
        }

        return { notes, documents, clips, tasks, kb_files }
      }, 'list-project-items', _ctx.getWin())
    },

    'list-projects': async (_event: any, _args: any) => {
      return withErrorHandling(async () => {
        return await listProjectsRaw()
      }, 'list-projects', _ctx.getWin())
    },

    'create-project': async (_event: any, args: any) => {
      return withErrorHandling(async () => {
        const validated = validateInput(CreateProjectSchema, args, 'create-project')
        const name = getValidatedProjectName(validated.name)
        const existing = await dbHelper.getQuery(
          'SELECT 1 FROM projects WHERE name = ? LIMIT 1',
          [name]
        )
        if (existing) {
          throw new AppError('项目已存在', ErrorCategory.VALIDATION, ErrorLevel.WARNING)
        }
        await dbHelper.runQuery(
          "INSERT INTO projects (name, created_at, updated_at) VALUES (?, datetime('now'), datetime('now'))",
          [name]
        )
        const projects = await listProjectsRaw()
        logInfo('Project created', { name })
        return { success: true, projects }
      }, 'create-project', _ctx.getWin())
    },

    'rename-project': async (_event: any, args: any) => {
      return withErrorHandling(async () => {
        const validated = validateInput(RenameProjectSchema, args, 'rename-project')
        const oldName = getValidatedProjectName(validated.oldName)
        const newName = getValidatedProjectName(validated.newName)
        if (oldName === newName) {
          throw new AppError('项目已存在', ErrorCategory.VALIDATION, ErrorLevel.WARNING)
        }
        const conflict = await dbHelper.getQuery(
          'SELECT 1 FROM projects WHERE name = ? AND name != ? LIMIT 1',
          [newName, oldName]
        )
        if (conflict) {
          throw new AppError('项目已存在', ErrorCategory.VALIDATION, ErrorLevel.WARNING)
        }
        const existing = await dbHelper.getQuery(
          'SELECT 1 FROM projects WHERE name = ? LIMIT 1',
          [oldName]
        )
        if (!existing) {
          throw new AppError('项目不存在', ErrorCategory.VALIDATION, ErrorLevel.WARNING)
        }
        await dbHelper.runQuery(
          "UPDATE projects SET name = ?, updated_at = datetime('now') WHERE name = ?",
          [newName, oldName]
        )
        await dbHelper.runQuery(
          'UPDATE project_items SET project_name = ? WHERE project_name = ?',
          [newName, oldName]
        )
        await dbHelper.runQuery(
          'UPDATE notes SET project = ? WHERE project = ?',
          [newName, oldName]
        )
        const projects = await listProjectsRaw()
        logInfo('Project renamed', { oldName, newName })
        return { success: true, projects }
      }, 'rename-project', _ctx.getWin())
    },

    'delete-project': async (_event: any, args: any) => {
      return withErrorHandling(async () => {
        const validated = validateInput(DeleteProjectSchema, args, 'delete-project')
        const name = getValidatedProjectName(validated.name)
        const existing = await dbHelper.getQuery(
          'SELECT 1 FROM projects WHERE name = ? LIMIT 1',
          [name]
        )
        if (!existing) {
          throw new AppError('项目不存在', ErrorCategory.VALIDATION, ErrorLevel.WARNING)
        }
        await dbHelper.runQuery('DELETE FROM projects WHERE name = ?', [name])
        await dbHelper.runQuery('DELETE FROM project_items WHERE project_name = ?', [name])
        await dbHelper.runQuery("UPDATE notes SET project = '' WHERE project = ?", [name])
        const projects = await listProjectsRaw()
        logInfo('Project deleted', { name })
        return { success: true, projects }
      }, 'delete-project', _ctx.getWin())
    },
  }
}
