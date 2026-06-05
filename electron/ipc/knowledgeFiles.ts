/**
 * 知识库文件管理相关 IPC 处理器
 */
import path from 'path'
import fs from 'fs'
import { dialog } from 'electron'
import { IpcModule, IpcContext } from './index'
import dbHelper from '../db'
import vectorDb from '../vectorDb'
import ollama from '../ollama'
import { resolvePreferredModel } from '../modelPreference'
import { enqueueTask } from '../services/watcher'
import {
  ImportFilesSchema,
  ImportFolderSchema,
  DeleteFileSchema,
  UpdateFileTagsSchema,
  MoveFileToFolderSchema,
  validateInput,
} from './schemas'
import {
  withErrorHandling,
  logError,
  logInfo,
  logWarn,
  ErrorCategory,
} from '../errorHandler'
import {
  validateFileAccess,
  sanitizeFileName,
  validateImportPaths,
} from '../pathSecurity'

function getVaultFilesPath(vaultPath: string): string {
    return path.join(vaultPath, 'Files')
}

async function copyFileToVault(originalPath: string, vaultPath: string): Promise<string> {
    validateFileAccess(originalPath)
    
    const filesDir = getVaultFilesPath(vaultPath)
    if (!fs.existsSync(filesDir)) {
        fs.mkdirSync(filesDir, { recursive: true })
    }

    const fileName = sanitizeFileName(path.basename(originalPath))
    const ext = path.extname(fileName)
    const baseName = path.basename(fileName, ext)
    const timestamp = Date.now()
    let destFileName = `${baseName}_${timestamp}${ext}`
    let destPath = path.join(filesDir, destFileName)

    let counter = 1
    while (fs.existsSync(destPath)) {
        destFileName = `${baseName}_${timestamp}_${counter}${ext}`
        destPath = path.join(filesDir, destFileName)
        counter++
    }

    fs.copyFileSync(originalPath, destPath)
    logInfo('File copied to Vault', { originalPath, destPath })
    return destPath
}

export function createKnowledgeFilesModule(ctx: IpcContext): IpcModule {
  return {
    'import-files': async (event: any, { filePaths, folderId }: { filePaths: string[], folderId?: string }) => {
      return withErrorHandling(async () => {
        const validated = validateInput(ImportFilesSchema, { filePaths, folderId }, 'import-files')
        const vaultPath = ctx.vaultPath
        const safePaths = validateImportPaths(validated.filePaths, vaultPath)

        const results: any[] = []
        for (const filePath of safePaths) {
          try {
            const baseName = path.basename(filePath)
            if (baseName.startsWith('~$')) {
              logWarn('Skipping temporary file', { filePath })
              continue
            }

            const ext = path.extname(filePath).toLowerCase()
            const originalFileName = sanitizeFileName(baseName)
            const stats = fs.statSync(filePath)
            const id = path.basename(filePath, ext) + '-' + Date.now()

            const vaultFilePath = await copyFileToVault(filePath, vaultPath)

            await dbHelper.runQuery(
              'INSERT OR IGNORE INTO file_metadata (id, file_path, original_path, file_name, file_type, file_size, added_at, is_indexed) VALUES (?, ?, ?, ?, ?, ?, ?, 0)',
              [id, vaultFilePath, filePath, originalFileName, ext, stats.size, new Date().toISOString()]
            )

            if (validated.folderId) {
              await dbHelper.runQuery('INSERT OR REPLACE INTO file_folder (file_id, folder_id) VALUES (?, ?)', [id, validated.folderId])
            }

            results.push({ originalPath: filePath, vaultFilePath, success: true, id, indexed: false })
          } catch (err: any) {
            logError(err, ErrorCategory.FILE_SYSTEM, { filePath })
            results.push({ filePath, success: false, error: err.message })
          }
        }

        logInfo('File import completed', { imported: results.filter(r => r.success).length, total: safePaths.length })
        return results
      }, 'import-files')
    },
    'import-folder': async (event: any, { folderPath, folderId }: { folderPath: string, folderId?: string }) => {
      const supportedExts = ['.md', '.txt', '.json', '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.pdf', '.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac', '.wma', '.opus', '.webm', '.mp4']
      const files: string[] = []
      const preferredModel = await resolvePreferredModel()
      const MAX_WALK_DEPTH = 10
      const MAX_WALK_FILES = 1000
      function walkDir(dir: string, depth: number = 0) {
        if (depth > MAX_WALK_DEPTH || files.length >= MAX_WALK_FILES) return
        let entries: fs.Dirent[]
        try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
        for (const entry of entries) {
          if (files.length >= MAX_WALK_FILES) return
          const fullPath = path.join(dir, entry.name)
          if (entry.isDirectory() && !entry.isSymbolicLink()) { walkDir(fullPath, depth + 1) }
          else if (supportedExts.includes(path.extname(entry.name).toLowerCase())) { files.push(fullPath) }
        }
      }
      walkDir(folderPath)
      const results: any[] = []
      for (const filePath of files) {
        try {
          const ext = path.extname(filePath).toLowerCase()
          const fileName = path.basename(filePath)
          const stats = fs.statSync(filePath)
          let content = ''
          let fileType = 'document'
          if (ext === '.md') { content = fs.readFileSync(filePath, 'utf-8'); fileType = 'markdown' }
          else if (ext === '.txt') { content = fs.readFileSync(filePath, 'utf-8'); fileType = 'text' }
          else if (ext === '.json') { content = fs.readFileSync(filePath, 'utf-8'); fileType = 'json' }
          else if (['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'].includes(ext)) {
            fileType = 'image'
            const imageBuffer = fs.readFileSync(filePath)
            const base64Image = imageBuffer.toString('base64')
            try { content = await ollama.analyzeImage(base64Image, `请详细描述这张图片的内容。`, preferredModel) }
            catch { content = `[图片文件: ${fileName}, OCR识别失败]` }
          } else if (['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac', '.wma', '.opus', '.webm', '.mp4'].includes(ext)) {
            fileType = 'audio'
            try {
              const { whisperTranscribe } = await import('../whisper')
              const result = await whisperTranscribe(filePath)
              content = result.text ? `[音频转写] ${result.text}` : `[音频文件: ${fileName}, 转写结果为空]`
            } catch (whisperErr: any) {
              content = `[音频文件: ${fileName}, 转写失败: ${whisperErr?.message || '未知错误'}]`
            }
          } else { try { content = fs.readFileSync(filePath, 'utf-8') } catch { content = `[二进制文件: ${fileName}]`; fileType = 'binary' } }
          const id = path.basename(filePath, ext) + '-' + Date.now()
          await dbHelper.saveMemo({ id, title: fileName, content, type: fileType, folder_id: folderId || null, file_path: filePath, size: stats.size })
          results.push({ filePath, success: true })
          const win = ctx.getWin()
          if (win && !win.isDestroyed()) { win.send('indexing-progress', { file: fileName, current: results.length, total: files.length }) }
        } catch (err: any) { results.push({ filePath, success: false, error: err.message }) }
      }
      return results
    },
    'export-memo': async (_: any, { memoId, format = 'markdown' }: { memoId: string, format?: string }) => {
      const memo = await dbHelper.getQuery('SELECT * FROM notes WHERE id = ?', [memoId])
      if (!memo) throw new Error('Memo not found')
      const win = ctx.getWin()
      if (!win) throw new Error('No window available')
      const { canceled, filePath } = await dialog.showSaveDialog(win, { defaultPath: `${memo.title || memo.id}.${format === 'json' ? 'json' : 'md'}`, filters: [{ name: format === 'json' ? 'JSON' : 'Markdown', extensions: [format === 'json' ? 'json' : 'md'] }] })
      if (canceled || !filePath) return { success: false, canceled: true }
      let exportContent = ''
      if (format === 'json') { exportContent = JSON.stringify(memo, null, 2) }
      else { exportContent = `# ${memo.title}\n\n${memo.content || memo.text || ''}` }
      fs.writeFileSync(filePath, exportContent, 'utf-8')
      return { success: true, filePath }
    },
    'export-memos': async (_: any, { memoIds, format = 'markdown' }: { memoIds: string[], format?: string }) => {
      const memos = await dbHelper.allQuery(`SELECT * FROM notes WHERE id IN (${memoIds.map(() => '?').join(',')})`, memoIds)
      const win = ctx.getWin()
      if (!win) throw new Error('No window available')
      const { canceled, filePath } = await dialog.showSaveDialog(win, { defaultPath: `memos-export.${format === 'json' ? 'json' : 'md'}`, filters: [{ name: format === 'json' ? 'JSON' : 'Markdown', extensions: [format === 'json' ? 'json' : 'md'] }] })
      if (canceled || !filePath) return { success: false, canceled: true }
      let exportContent = ''
      if (format === 'json') { exportContent = JSON.stringify(memos, null, 2) }
      else { exportContent = memos.map((m: any) => `# ${m.title}\n\n${m.content || m.text || ''}`).join('\n\n---\n\n') }
      fs.writeFileSync(filePath, exportContent, 'utf-8')
      return { success: true, filePath }
    },
    'get-all-tags': async () => {
      try {
        const tags = await dbHelper.allQuery("SELECT DISTINCT json_each.value as tag FROM notes, json_each(notes.tags) WHERE notes.tags IS NOT NULL AND notes.tags != '[]'")
        return tags.map((t: any) => t.tag)
      } catch { return [] }
    },
    'get-reference-folders': async () => {
      try { return await dbHelper.allQuery('SELECT * FROM reference_folders ORDER BY name ASC') }
      catch (err) { logError('Failed to get reference folders:', ErrorCategory.DATABASE, { err }); return [] }
    },
    'add-reference-folder': async (_: any, { name, path: folderPath, recursive = true }: { name: string, path: string, recursive?: boolean }) => {
      try { return await dbHelper.addReferenceFolder(name, folderPath, recursive) }
      catch (err: any) { logError('Failed to add reference folder:', ErrorCategory.DATABASE, { err }); throw err }
    },
    'remove-reference-folder': async (_: any, { id }: { id: string }) => {
      try { await dbHelper.runQuery('DELETE FROM reference_folders WHERE id = ?', [id]); return { success: true } }
      catch (err: any) { logError('Failed to remove reference folder:', ErrorCategory.DATABASE, { err }); throw err }
    },
    'get-vault-files': async (_: any, { page = 1, pageSize = 20, folderId, tag, search }: { page?: number; pageSize?: number; folderId?: string; tag?: string; search?: string } = {}) => {
      try {
        let where = '1=1'
        const params: any[] = []
        if (folderId) {
          where += ' AND fm.id IN (SELECT ff.file_id FROM file_folder ff WHERE ff.folder_id = ?)'
          params.push(folderId)
        }
        if (tag) {
          where += ' AND fm.tags LIKE ?'
          params.push(`%"${tag}"%`)
        }
        if (search) {
          where += ' AND (fm.file_name LIKE ? OR fm.summary LIKE ?)'
          params.push(`%${search}%`, `%${search}%`)
        }
        const totalRes = await dbHelper.getQuery(`SELECT COUNT(*) as cnt FROM file_metadata fm WHERE ${where}`, params)
        const total = totalRes?.cnt || 0
        const offset = (page - 1) * pageSize
        const files = await dbHelper.allQuery(
          `SELECT fm.*, (SELECT ff.folder_id FROM file_folder ff WHERE ff.file_id = fm.id ORDER BY ff.rowid DESC LIMIT 1) as folder_id FROM file_metadata fm WHERE ${where} ORDER BY fm.file_name ASC LIMIT ? OFFSET ?`,
          [...params, pageSize, offset]
        )
        return { files, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
      } catch (err) { logError('Failed to get vault files:', ErrorCategory.DATABASE, { err }); return { files: [], total: 0, page: 1, pageSize: 20, totalPages: 0 } }
    },
    'delete-file': async (_: any, { id }: { id: string }) => {
      return new Promise((resolve, reject) => {
        enqueueTask(async () => {
          try {
            try {
              await vectorDb.deleteFileFromVectorDb(id)
              logInfo(`[Knowledge] Deleted vectors for file: ${id}`)
            } catch (vectorErr: any) {
              logWarn('[Knowledge] Failed to delete vectors', { err: vectorErr })
            }
            await dbHelper.runQuery('DELETE FROM file_folder WHERE file_id = ?', [id])
            await dbHelper.runQuery('DELETE FROM file_metadata WHERE id = ?', [id])
            resolve({ success: true })
          } catch (err: any) {
            logError('Failed to delete file:', ErrorCategory.DATABASE, { err })
            reject(err)
          }
        })
      })
    },
    'get-kb-graph-data': async () => {
      try {
        const files = await dbHelper.allQuery('SELECT id, file_name, file_type, is_indexed FROM file_metadata')
        const folders = await dbHelper.allQuery('SELECT id, name, parent_id FROM kb_folders')
        const fileFolderRelations = await dbHelper.allQuery('SELECT file_id, folder_id FROM file_folder')

        const nodes: any[] = []
        const edges: any[] = []

        for (const folder of folders) {
          nodes.push({
            id: `folder-${folder.id}`,
            label: folder.name,
            type: 'folder',
            parentId: folder.parent_id
          })
          if (folder.parent_id) {
            edges.push({ source: `folder-${folder.parent_id}`, target: `folder-${folder.id}`, linkType: 'parent' })
          }
        }

        for (const file of files) {
          nodes.push({
            id: `file-${file.id}`,
            label: file.file_name,
            type: 'file',
            fileType: file.file_type,
            isIndexed: file.is_indexed
          })
        }

        for (const relation of fileFolderRelations) {
          edges.push({ source: `folder-${relation.folder_id}`, target: `file-${relation.file_id}`, linkType: 'belongs' })
        }

        return { nodes, edges }
      } catch (err) { logError('Failed to get KB graph data:', ErrorCategory.DATABASE, { err }); return { nodes: [], edges: [] } }
    },
    'export-vault': async (_: any, { format }: { format?: string } = {}) => {
      try {
        const notesList = await dbHelper.allQuery('SELECT * FROM notes')
        const schedules = await dbHelper.allQuery('SELECT * FROM schedules')
        return JSON.stringify({ notes: notesList, schedules, version: 2, exportedAt: new Date().toISOString() })
      } catch (err: any) { logError('Export vault failed:', ErrorCategory.DATABASE, { err }); throw err }
    },
    'store-text-as-file': async (_: any, { title, content, folderId }: { title: string, content: string, folderId?: string }) => {
      try {
        const id = `text-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        const now = new Date().toISOString()
        const safeTitle = title || `未命名资料-${Date.now()}`
        const text = String(content || '')
        const chunks = text
          .split(/\n{2,}/)
          .map((chunk: string) => chunk.trim())
          .filter(Boolean)
          .slice(0, 20)

        await dbHelper.runQuery(
          'INSERT INTO file_metadata (id, file_name, file_type, file_size, last_modified, is_indexed, summary, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [id, safeTitle, safeTitle.endsWith('.md') ? 'text/markdown' : 'text/plain', text.length, now, 0, text.slice(0, 180), now]
        )

        for (const [index, chunk] of chunks.entries()) {
          await dbHelper.insertFileChunk(id, index, chunk)
        }

        return { success: true, id, folderId: folderId || null }
      }
      catch (err: any) { logError('Store text as file failed:', ErrorCategory.DATABASE, { err }); throw err }
    },
    'list-kb-files': async () => {
      try { return await dbHelper.allQuery('SELECT id, file_name, file_type, file_size, added_at FROM file_metadata ORDER BY file_name ASC') }
      catch (err) { logError('Failed to list KB files:', ErrorCategory.DATABASE, { err }); return [] }
    },
    'export-memos-markdown': async () => {
      try {
        const notesList = await dbHelper.allQuery("SELECT * FROM notes WHERE type = 'quick_note'")
        return notesList.map((m: any) => `# ${m.title}\n\n${m.content}`).join('\n\n---\n\n')
      } catch (err: any) { logError('Export notes markdown failed:', ErrorCategory.DATABASE, { err }); throw err }
    },
    'export-schedules-markdown': async () => {
      try {
        const schedules = await dbHelper.allQuery('SELECT * FROM schedules')
        return schedules.map((s: any) => `- [${s.status === 'completed' ? 'x' : ' '}] ${s.title} (${s.date || ''})`).join('\n')
      } catch (err: any) { logError('Export schedules markdown failed:', ErrorCategory.DATABASE, { err }); throw err }
    },
    'backup-vault': async () => {
      try {
        const notesList = await dbHelper.allQuery('SELECT * FROM notes')
        const schedules = await dbHelper.allQuery('SELECT * FROM schedules')
        const files = await dbHelper.allQuery('SELECT * FROM file_metadata')
        return JSON.stringify({ notes: notesList, schedules, files, version: 2, timestamp: Date.now() })
      } catch (err: any) { logError('Backup vault failed:', ErrorCategory.DATABASE, { err }); throw err }
    },
    'restore-vault': async (_: any, { data }: { data: string }) => {
      try {
        const parsed = JSON.parse(data)
        let notesCount = 0
        let schedulesCount = 0
        let filesCount = 0
        const notesToRestore = parsed.notes || parsed.memos
        if (notesToRestore && Array.isArray(notesToRestore)) {
          for (const note of notesToRestore) {
            try {
              await dbHelper.runQuery(
                'INSERT OR REPLACE INTO notes (id, type, title, content, project, category, tags, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [note.id, note.type || 'quick_note', note.title, note.content || '', note.project || '默认项目', note.category || '个人', note.tags || '[]', note.updated_at || new Date().toISOString()]
              )
              notesCount++
            } catch (e: any) { logWarn('Failed to restore note', { noteId: note.id, error: e.message }) }
          }
        }
        if (parsed.schedules && Array.isArray(parsed.schedules)) {
          for (const schedule of parsed.schedules) {
            try {
              await dbHelper.runQuery(
                'INSERT OR REPLACE INTO schedules (id, title, content, start_time, end_time, memo_id, status, category, recurrence, linked_memos, priority, due_date, parent_id, sort_order, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [schedule.id, schedule.title, schedule.content || '', schedule.start_time, schedule.end_time || '', schedule.memo_id || '', schedule.status || 'pending', schedule.category || '工作', schedule.recurrence || 'none', JSON.stringify(schedule.linked_memos || []), schedule.priority || 'medium', schedule.due_date || '', schedule.parent_id || '', schedule.sort_order || 0, schedule.updated_at || new Date().toISOString()]
              )
              schedulesCount++
            } catch (e: any) { logWarn('Failed to restore schedule', { scheduleId: schedule.id, error: e.message }) }
          }
        }
        if (parsed.files && Array.isArray(parsed.files)) {
          for (const file of parsed.files) {
            try {
              await dbHelper.runQuery(
                'INSERT OR REPLACE INTO file_metadata (id, file_name, file_path, file_type, file_size, summary, tags, indexed_at, folder_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [file.id, file.file_name, file.file_path, file.file_type, file.file_size, file.summary || '', file.tags || '[]', file.indexed_at || new Date().toISOString(), file.folder_id || '']
              )
              filesCount++
            } catch (e: any) { logWarn('Failed to restore file', { fileId: file.id, error: e.message }) }
          }
        }
        return { success: true, notesCount, schedulesCount, filesCount }
      } catch (err: any) { logError('Restore vault failed:', ErrorCategory.DATABASE, { err }); return { success: false, error: err.message } }
    },
    'import-memos-markdown': async (_: any, { content }: { content: string }) => {
      try {
        const sections = content.split(/^---$/m)
        let count = 0
        for (const section of sections) {
          const titleMatch = section.match(/^#\s+(.+)$/m)
          if (titleMatch) {
            const title = titleMatch[1]?.trim() || ''
            const body = section.replace(titleMatch[0], '').trim()
            const id = `import-${Date.now()}-${count}`
            await dbHelper.runQuery('INSERT OR IGNORE INTO notes (id, type, title, content, updated_at) VALUES (?, ?, ?, ?, ?)', [id, 'quick_note', title, body, new Date().toISOString()])
            count++
          }
        }
        return { success: true, count }
      } catch (err: any) { logError('Import memos markdown failed:', ErrorCategory.DATABASE, { err }); throw err }
    },
    'get-file-tags': async () => {
      try {
        const files = await dbHelper.allQuery('SELECT id, tags FROM file_metadata WHERE tags IS NOT NULL AND tags != "[]" AND tags != ""')
        const allTags = new Set<string>()
        files.forEach((f: any) => { try { const t = JSON.parse(f.tags); if (Array.isArray(t)) t.forEach((tag: string) => allTags.add(tag)) } catch {} })
        return [...allTags].sort()
      } catch (err) { logError('Failed to get file tags:', ErrorCategory.DATABASE, { err }); return [] }
    },
    'update-file-tags': async (_: any, { fileId, tags }: { fileId: string, tags: string[] }) => {
      try { await dbHelper.runQuery('UPDATE file_metadata SET tags = ? WHERE id = ?', [JSON.stringify(tags), fileId]); return { success: true } }
      catch (err: any) { logError('Failed to update file tags:', ErrorCategory.DATABASE, { err }); throw err }
    },
    'relink-file': async (_: any, { fileId, newFolderPath }: { fileId: string, newFolderPath: string }) => {
      try { await dbHelper.runQuery('UPDATE file_metadata SET folder_path = ? WHERE id = ?', [newFolderPath, fileId]); return { success: true } }
      catch (err: any) { logError('Failed to relink file:', ErrorCategory.DATABASE, { err }); throw err }
    },
    'get-kb-folders': async () => {
      try {
        const folders = await dbHelper.allQuery('SELECT * FROM kb_folders ORDER BY sort_order ASC, name ASC')
        return { success: true, folders }
      } catch (err: any) { logError('Failed to get KB folders:', ErrorCategory.DATABASE, { err }); return { success: false, folders: [], error: err.message } }
    },
    'create-kb-folder': async (_: any, { name, parentId }: { name: string, parentId?: string }) => {
      try {
        const id = `folder-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        const maxOrder = await dbHelper.getQuery('SELECT MAX(sort_order) as max_order FROM kb_folders')
        const sortOrder = (maxOrder?.max_order || 0) + 1
        await dbHelper.runQuery(
          'INSERT INTO kb_folders (id, name, parent_id, sort_order, created_at) VALUES (?, ?, ?, ?, ?)',
          [id, name, parentId || null, sortOrder, new Date().toISOString()]
        )
        return { success: true, folder: { id, name, parent_id: parentId || null, sort_order: sortOrder } }
      } catch (err: any) { logError('Failed to create KB folder:', ErrorCategory.DATABASE, { err }); return { success: false, error: err.message } }
    },
    'delete-kb-folder': async (_: any, { id }: { id: string }) => {
      try {
        await dbHelper.runQuery('DELETE FROM kb_folders WHERE id = ?', [id])
        return { success: true }
      } catch (err: any) { logError('Failed to delete KB folder:', ErrorCategory.DATABASE, { err }); return { success: false, error: err.message } }
    },
    'move-file-to-folder': async (_: any, { fileId, folderId }: { fileId: string, folderId: string }) => {
      try {
        await dbHelper.runQuery('DELETE FROM file_folder WHERE file_id = ?', [fileId])
        await dbHelper.runQuery('INSERT INTO file_folder (file_id, folder_id) VALUES (?, ?)', [fileId, folderId])
        return { success: true }
      } catch (err: any) { logError('Failed to move file to folder:', ErrorCategory.DATABASE, { err }); return { success: false, error: err.message } }
    },
    'clear-all-memos': async () => {
      try {
        await dbHelper.runQuery('DELETE FROM notes WHERE type = ?', ['quick_note'])
        logInfo('[KB] All notes (quick_note) cleared')
        return { success: true }
      } catch (err: any) {
        logError('Failed to clear notes:', ErrorCategory.DATABASE, { err })
        return { success: false, error: err.message }
      }
    },
    'save-note-version': async (_: any, { noteId, title, content, tags }: { noteId: string, title: string, content: string, tags?: string }) => {
      try {
        const { v4: uuidv4 } = await import('uuid');
        const id = uuidv4();
        await dbHelper.runQuery(
          'INSERT INTO note_versions (id, note_id, title, content, tags, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          [id, noteId, title, content, tags || '[]', new Date().toISOString()]
        );
        const count = await dbHelper.getQuery('SELECT COUNT(*) as cnt FROM note_versions WHERE note_id = ?', [noteId]);
        if (count && Number(count.cnt) > 50) {
          await dbHelper.runQuery(
            'DELETE FROM note_versions WHERE note_id = ? AND id NOT IN (SELECT id FROM note_versions WHERE note_id = ? ORDER BY created_at DESC LIMIT 50)',
            [noteId, noteId]
          );
        }
        return { success: true, versionId: id };
      } catch (err: any) {
        logError('Failed to save note version:', ErrorCategory.DATABASE, { err });
        return { success: false, error: err.message };
      }
    },
    'get-note-versions': async (_: any, { noteId }: { noteId: string }) => {
      try {
        const versions = await dbHelper.allQuery(
          'SELECT id, note_id, title, tags, created_at FROM note_versions WHERE note_id = ? ORDER BY created_at DESC LIMIT 50',
          [noteId]
        );
        return versions || [];
      } catch (err: any) {
        logError('Failed to get note versions:', ErrorCategory.DATABASE, { err });
        return [];
      }
    },
    'get-note-version-content': async (_: any, { versionId }: { versionId: string }) => {
      try {
        const version = await dbHelper.getQuery('SELECT * FROM note_versions WHERE id = ?', [versionId]);
        return version || null;
      } catch (err: any) {
        logError('Failed to get version content:', ErrorCategory.DATABASE, { err });
        return null;
      }
    },
    'restore-note-version': async (_: any, { versionId }: { versionId: string }) => {
      try {
        const version = await dbHelper.getQuery('SELECT * FROM note_versions WHERE id = ?', [versionId]);
        if (!version) return { success: false, error: 'Version not found' };
        await dbHelper.runQuery(
          'UPDATE notes SET title = ?, content = ?, tags = ?, updated_at = ? WHERE id = ?',
          [version.title, version.content, version.tags, new Date().toISOString(), version.note_id]
        );
        return { success: true, note: { id: version.note_id, title: version.title, content: version.content, tags: version.tags } };
      } catch (err: any) {
        logError('Failed to restore note version:', ErrorCategory.DATABASE, { err });
        return { success: false, error: err.message };
      }
    },
    'upgrade-note-to-document': async (_: any, { noteId }: { noteId: string }) => {
      try {
        const note = await dbHelper.getQuery('SELECT * FROM notes WHERE id = ?', [noteId]);
        if (!note) return { success: false, error: 'Note not found' };
        if (note.type === 'document') return { success: false, error: 'Already a document' };
        await dbHelper.runQuery(
          'UPDATE notes SET type = ?, updated_at = ? WHERE id = ?',
          ['document', new Date().toISOString(), noteId]
        );
        return { success: true, note: { ...note, type: 'document' } };
      } catch (err: any) {
        logError('Failed to upgrade note to document:', ErrorCategory.DATABASE, { err });
        return { success: false, error: err.message };
      }
    },
    'get-file-preview': async (_: any, { fileId }: { fileId: string }) => {
      try {
        const file = await dbHelper.getQuery('SELECT * FROM file_metadata WHERE id = ?', [fileId]);
        if (!file) return { success: false, error: '文件不存在' };

        const ext = (file.file_type || '').toLowerCase();
        if (['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.pdf'].includes(ext)) {
          return {
            success: true,
            isMedia: true,
            filePath: file.file_path,
            fileName: file.file_name,
            fileType: ext
          };
        }

        const chunks = await dbHelper.allQuery(
          'SELECT text FROM file_chunks WHERE file_id = ? ORDER BY chunk_index',
          [fileId]
        );
        const content = (chunks || []).map((c: any) => c.text).join('\n');

        return {
          success: true,
          isMedia: false,
          fileName: file.file_name,
          fileType: ext,
          content: content,
          summary: file.summary || ''
        };
      } catch (err: any) {
        logError('Failed to get file preview:', ErrorCategory.DATABASE, { err });
        return { success: false, error: err.message };
      }
    },
    'read-pdf-file': async (_: any, { fileId }: { fileId: string }) => {
      try {
        const file = await dbHelper.getQuery('SELECT * FROM file_metadata WHERE id = ?', [fileId]);
        if (!file) return { success: false, error: '文件不存在' };
        const fs = require('fs');
        if (!fs.existsSync(file.file_path)) return { success: false, error: '文件路径不存在' };
        const buffer = fs.readFileSync(file.file_path);
        return { success: true, data: buffer.toString('base64'), fileName: file.file_name };
      } catch (err: any) {
        logError('Failed to read PDF file:', ErrorCategory.FILE_SYSTEM, { err });
        return { success: false, error: err.message };
      }
    },
    'save-ai-response-as-document': async (_: any, { title, content, source }: { title: string; content: string; source?: string }) => {
      try {
        const { v4: uuidv4 } = await import('uuid');
        const id = uuidv4();
        const now = new Date().toISOString();
        await dbHelper.runQuery(
          'INSERT INTO notes (id, title, content, tags, type, pinned, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [id, title, content, JSON.stringify(source ? [source] : []), 'document', 0, now, now]
        );
        return { success: true, id };
      } catch (err: any) {
        logError('Failed to save AI response as document:', ErrorCategory.DATABASE, { err });
        return { success: false, error: err.message };
      }
    },
    'extract-tasks-from-file': async (_: any, { fileId }: { fileId: string }) => {
      try {
        const file = await dbHelper.getQuery('SELECT * FROM file_metadata WHERE id = ?', [fileId]);
        if (!file) return { success: false, error: 'File not found' };
        const chunks = await dbHelper.allQuery(
          'SELECT text FROM file_chunks WHERE file_id = ? ORDER BY chunk_index LIMIT 10',
          [fileId]
        );
        const content = (chunks || []).map((c: any) => c.text).join('\n');
        return { success: true, fileName: file.file_name, content: content.substring(0, 5000) };
      } catch (err: any) {
        logError('Failed to extract tasks from file:', ErrorCategory.DATABASE, { err });
        return { success: false, error: err.message };
      }
    },
    'sync-checkbox-to-tasks': async (_: any, { noteId, checkboxes }: { noteId: string; checkboxes: { text: string; checked: boolean }[] }) => {
      try {
        const { v4: uuidv4 } = await import('uuid');
        const note = await dbHelper.getQuery('SELECT title FROM notes WHERE id = ?', [noteId]);
        const noteTitle = note?.title || '便签';
        let added = 0;
        for (const cb of checkboxes) {
          if (!cb.checked && cb.text.trim()) {
            const existing = await dbHelper.getQuery(
              "SELECT id FROM tasks WHERE title = ? AND status != 'done' LIMIT 1",
              [cb.text.trim()]
            );
            if (!existing) {
              const id = uuidv4();
              await dbHelper.runQuery(
                'INSERT INTO tasks (id, title, description, status, priority, source_type, source_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [id, cb.text.trim(), `来自便签: ${noteTitle}`, 'inbox', 'medium', 'note', noteId, new Date().toISOString(), new Date().toISOString()]
              );
              added++;
            }
          }
        }
        return { success: true, added };
      } catch (err: any) {
        logError('Failed to sync checkbox to tasks:', ErrorCategory.DATABASE, { err });
        return { success: false, error: err.message };
      }
    },
  }
}