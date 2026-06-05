import { IpcModule, IpcContext } from './index'
import dbHelper from '../db'
import { z } from 'zod'
import { validateInput } from './schemas'
import { withErrorHandling, logInfo, ErrorCategory } from '../errorHandler'

const AddToProjectSchema = z.object({
  projectName: z.string().min(1).max(100),
  itemType: z.enum(['note', 'clip', 'task', 'kb_file']),
  itemId: z.string().min(1),
})

const RemoveFromProjectSchema = z.object({
  projectName: z.string().min(1).max(100),
  itemType: z.enum(['note', 'clip', 'task', 'kb_file']),
  itemId: z.string().min(1),
})

const ListProjectItemsSchema = z.object({
  projectName: z.string().min(1).max(100),
})

const ListProjectsSchema = z.object({}).optional()

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
        const byType: { note: string[]; clip: string[]; task: string[]; kb_file: string[] } = { note: [], clip: [], task: [], kb_file: [] }
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

        return { notes, clips, tasks, kb_files }
      }, 'list-project-items', _ctx.getWin())
    },

    'list-projects': async (_event: any, _args: any) => {
      return withErrorHandling(async () => {
        const rows = await dbHelper.allQuery(
          'SELECT DISTINCT project_name FROM project_items ORDER BY project_name'
        )
        return rows.map((r: any) => r.project_name)
      }, 'list-projects', _ctx.getWin())
    },
  }
}
