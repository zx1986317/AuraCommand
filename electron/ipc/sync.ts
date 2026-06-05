/**
 * 同步（WebDAV / S3）相关 IPC 处理器
 */
import { IpcModule, IpcContext } from './index'
import dbHelper from '../db'
import {
  SaveSyncConfigSchema,
  WebDavConfigSchema,
  S3ConfigSchema,
  SyncImportSchema,
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

export function createSyncModule(ctx: IpcContext): IpcModule {
  const getWin = () => ctx.getWin()

  return {
    'get-sync-config': async () => {
      return withErrorHandling(async () => {
        const config = await dbHelper.getQuery('SELECT * FROM sync_config WHERE id = 1')
        return config || { type: 'none', autoSync: false, lastSync: null }
      }, 'get-sync-config')
    },
    'save-sync-config': async (_: any, config: any) => {
      return withErrorHandling(async () => {
        const validated = validateInput(SaveSyncConfigSchema, config, 'save-sync-config')
        const existing = await dbHelper.getQuery('SELECT id FROM sync_config WHERE id = 1')
        if (existing) {
          await dbHelper.runQuery('UPDATE sync_config SET type = ?, config = ?, auto_sync = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1', [validated.type, JSON.stringify(validated.config), validated.autoSync ? 1 : 0])
        } else {
          await dbHelper.runQuery('INSERT INTO sync_config (id, type, config, auto_sync, created_at, updated_at) VALUES (1, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)', [validated.type, JSON.stringify(validated.config), validated.autoSync ? 1 : 0])
        }
        logInfo('Sync config saved', { type: validated.type })
        return { success: true }
      }, 'save-sync-config', getWin())
    },
    'sync-now': async () => {
      return withErrorHandling(async () => {
        const config = await dbHelper.getQuery('SELECT * FROM sync_config WHERE id = 1')
        if (!config || config.type === 'none') {
          throw new AppError('未配置同步', ErrorCategory.VALIDATION, ErrorLevel.WARNING)
        }
        const syncConfig = typeof config.config === 'string' ? JSON.parse(config.config) : config.config

        if (config.type === 'webdav') {
          const { createClient } = await import('webdav')
          const client = createClient(syncConfig.url, { username: syncConfig.username, password: syncConfig.password })
          const exists = await client.exists('/auracommand-sync')
          if (!exists) { await client.createDirectory('/auracommand-sync') }
          const notesList = await dbHelper.allQuery('SELECT * FROM notes')
          const data = JSON.stringify({ notes: notesList, version: 2, timestamp: Date.now() })
          await client.putFileContents('/auracommand-sync/notes.json', data, { overwrite: true })
          await dbHelper.runQuery('UPDATE sync_config SET last_sync = CURRENT_TIMESTAMP WHERE id = 1')
          logInfo('Sync completed', { type: 'webdav', count: notesList.length })
          return { success: true, direction: 'upload', count: notesList.length }
        } else if (config.type === 's3') {
          const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3')
          const s3 = new S3Client({ region: syncConfig.region || 'us-east-1', endpoint: syncConfig.endpoint, credentials: { accessKeyId: syncConfig.accessKeyId, secretAccessKey: syncConfig.secretAccessKey } })
          const notesList = await dbHelper.allQuery('SELECT * FROM notes')
          const data = JSON.stringify({ notes: notesList, version: 2, timestamp: Date.now() })
          await s3.send(new PutObjectCommand({ Bucket: syncConfig.bucket, Key: 'auracommand-sync/notes.json', Body: data }))
          await dbHelper.runQuery('UPDATE sync_config SET last_sync = CURRENT_TIMESTAMP WHERE id = 1')
          logInfo('Sync completed', { type: 's3', count: notesList.length })
          return { success: true, direction: 'upload', count: notesList.length }
        }
        throw new AppError(`未知的同步类型: ${config.type}`, ErrorCategory.VALIDATION, ErrorLevel.WARNING)
      }, 'sync-now', getWin())
    },
    'sync-download': async () => {
      return withErrorHandling(async () => {
        const config = await dbHelper.getQuery('SELECT * FROM sync_config WHERE id = 1')
        if (!config || config.type === 'none') {
          throw new AppError('未配置同步', ErrorCategory.VALIDATION, ErrorLevel.WARNING)
        }
        const syncConfig = typeof config.config === 'string' ? JSON.parse(config.config) : config.config

        if (config.type === 'webdav') {
          const { createClient } = await import('webdav')
          const client = createClient(syncConfig.url, { username: syncConfig.username, password: syncConfig.password })
          const exists = await client.exists('/auracommand-sync/notes.json')
          if (!exists) throw new AppError('未找到远程数据', ErrorCategory.NETWORK, ErrorLevel.WARNING)
          const data = JSON.parse(await client.getFileContents('/auracommand-sync/notes.json', { format: 'text' }) as string)
          const notesToRestore = data.notes || data.memos
          if (notesToRestore) {
            for (const note of notesToRestore) {
              try { await dbHelper.saveMemo(note) } catch {}
            }
          }
          await dbHelper.runQuery('UPDATE sync_config SET last_sync = CURRENT_TIMESTAMP WHERE id = 1')
          logInfo('Sync download completed', { type: 'webdav', count: notesToRestore?.length || 0 })
          return { success: true, direction: 'download', count: notesToRestore?.length || 0 }
        } else if (config.type === 's3') {
          const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3')
          const s3 = new S3Client({ region: syncConfig.region || 'us-east-1', endpoint: syncConfig.endpoint, credentials: { accessKeyId: syncConfig.accessKeyId, secretAccessKey: syncConfig.secretAccessKey } })
          const response = await s3.send(new GetObjectCommand({ Bucket: syncConfig.bucket, Key: 'auracommand-sync/notes.json' }))
          const body = await response.Body!.transformToString()
          const data = JSON.parse(body)
          const notesToRestore = data.notes || data.memos
          if (notesToRestore) {
            for (const note of notesToRestore) {
              try { await dbHelper.saveMemo(note) } catch {}
            }
          }
          await dbHelper.runQuery('UPDATE sync_config SET last_sync = CURRENT_TIMESTAMP WHERE id = 1')
          logInfo('Sync download completed', { type: 's3', count: notesToRestore?.length || 0 })
          return { success: true, direction: 'download', count: notesToRestore?.length || 0 }
        }
        throw new AppError(`未知的同步类型: ${config.type}`, ErrorCategory.VALIDATION, ErrorLevel.WARNING)
      }, 'sync-download', getWin())
    },
    'get-sync-status': async () => {
      return withErrorHandling(async () => {
        const config = await dbHelper.getQuery('SELECT * FROM sync_config WHERE id = 1')
        return { configured: !!config && config.type !== 'none', type: config?.type || 'none', lastSync: config?.last_sync || null, autoSync: !!config?.auto_sync }
      }, 'get-sync-status')
    },
    'sync-export': async () => {
      return withErrorHandling(async () => {
        const notesList = await dbHelper.allQuery('SELECT * FROM notes')
        const schedules = await dbHelper.allQuery('SELECT * FROM schedules')
        logInfo('Sync export completed', { notesCount: notesList.length })
        return JSON.stringify({ notes: notesList, schedules, version: 2, timestamp: Date.now() })
      }, 'sync-export')
    },
    'sync-import': async (_: any, params: any) => {
      return withErrorHandling(async () => {
        const validated = validateInput(SyncImportSchema, params, 'sync-import')
        const parsed = JSON.parse(validated.data)
        const notesToImport = parsed.notes || parsed.memos
        if (notesToImport) { for (const m of notesToImport) { try { await dbHelper.runQuery('INSERT OR REPLACE INTO notes (id, type, title, content, tags, project, category, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [m.id, m.type || 'quick_note', m.title, m.content, m.tags, m.project, m.category, m.updated_at]) } catch {} } }
        if (parsed.schedules) { for (const s of parsed.schedules) { try { await dbHelper.runQuery('INSERT OR REPLACE INTO schedules (id, title, date, time, category, status, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [s.id, s.title, s.date, s.time, s.category, s.status, s.description, s.created_at, s.updated_at]) } catch {} } }
        logInfo('Sync import completed')
        return { success: true }
      }, 'sync-import', getWin())
    },
    'sync-to-webdav': async (_: any, params: any) => {
      return withErrorHandling(async () => {
        const validated = validateInput(WebDavConfigSchema, params, 'sync-to-webdav')
        const { createClient } = await import('webdav')
        const client = createClient(validated.url, { username: validated.username, password: validated.password })
        const exists = await client.exists('/auracommand-sync')
        if (!exists) { await client.createDirectory('/auracommand-sync') }
        const notesList = await dbHelper.allQuery('SELECT * FROM notes')
        const data = JSON.stringify({ notes: notesList, version: 2, timestamp: Date.now() })
        await client.putFileContents('/auracommand-sync/notes.json', data, { overwrite: true })
        await dbHelper.runQuery('UPDATE sync_config SET last_sync = CURRENT_TIMESTAMP WHERE id = 1')
        logInfo('WebDAV sync completed', { count: notesList.length })
        return { success: true, count: notesList.length }
      }, 'sync-to-webdav', getWin())
    },
    'sync-from-webdav': async (_: any, params: any) => {
      return withErrorHandling(async () => {
        const validated = validateInput(WebDavConfigSchema, params, 'sync-from-webdav')
        const { createClient } = await import('webdav')
        const client = createClient(validated.url, { username: validated.username, password: validated.password })
        const exists = await client.exists('/auracommand-sync/notes.json')
        if (!exists) throw new AppError('未找到远程数据', ErrorCategory.NETWORK, ErrorLevel.WARNING)
        const data = JSON.parse(await client.getFileContents('/auracommand-sync/notes.json', { format: 'text' }) as string)
        const notesToImport = data.notes || data.memos
        if (notesToImport) { for (const note of notesToImport) { try { await dbHelper.runQuery('INSERT OR REPLACE INTO notes (id, type, title, content, tags, project, category, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [note.id, note.type || 'quick_note', note.title, note.content, note.tags, note.project, note.category, note.updated_at]) } catch {} } }
        await dbHelper.runQuery('UPDATE sync_config SET last_sync = CURRENT_TIMESTAMP WHERE id = 1')
        logInfo('WebDAV download completed', { count: notesToImport?.length || 0 })
        return { success: true, count: notesToImport?.length || 0 }
      }, 'sync-from-webdav', getWin())
    },
    'sync-to-s3': async (_: any, params: any) => {
      return withErrorHandling(async () => {
        const validated = validateInput(S3ConfigSchema, params, 'sync-to-s3')
        const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3')
        const s3 = new S3Client({ region: validated.region || 'us-east-1', endpoint: validated.endpoint, credentials: { accessKeyId: validated.accessKeyId, secretAccessKey: validated.secretAccessKey } })
        const notesList = await dbHelper.allQuery('SELECT * FROM notes')
        const data = JSON.stringify({ notes: notesList, version: 2, timestamp: Date.now() })
        await s3.send(new PutObjectCommand({ Bucket: validated.bucket, Key: 'auracommand-sync/notes.json', Body: data }))
        await dbHelper.runQuery('UPDATE sync_config SET last_sync = CURRENT_TIMESTAMP WHERE id = 1')
        logInfo('S3 sync completed', { count: notesList.length })
        return { success: true, count: notesList.length }
      }, 'sync-to-s3', getWin())
    },
  }
}
