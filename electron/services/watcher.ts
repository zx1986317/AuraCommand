/**
 * 文件监听服务
 * 管理知识库文件变更的自动索引和引用目录监听
 */
import { BrowserWindow } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { v4 as uuidv4 } from 'uuid'
import chokidar from 'chokidar'
import log from 'electron-log'
import dbHelper from '../db'
import ollama from '../ollama'
import * as modelRouter from '../modelRouter'
import { resolvePreferredModel } from '../modelPreference'
import vectorDb from '../vectorDb'
import { processFileForRAG } from '../fileProcessor'
import { incrementalDigest } from './knowledgeDigest'

let watcher: chokidar.FSWatcher | null = null
let referenceWatchers: Map<string, chokidar.FSWatcher> = new Map()

const processingQueue: (() => Promise<void>)[] = []
let isProcessing = false

function sendQueueStatus() {
  const targetWin = BrowserWindow.getAllWindows()[0]
  if (targetWin) {
    targetWin.webContents.send('indexing-queue-status', {
      processing: isProcessing,
      queueLength: processingQueue.length,
      total: processingQueue.length + (isProcessing ? 1 : 0)
    })
  }
}

export function enqueueTask(task: () => Promise<void>) {
  processingQueue.push(task)
  sendQueueStatus()
  drainQueue()
}

async function drainQueue() {
  if (isProcessing || processingQueue.length === 0) return
  isProcessing = true
  sendQueueStatus()
  while (processingQueue.length > 0) {
    const task = processingQueue.shift()!
    sendQueueStatus()
    try {
      await task()
    } catch (err) {
      log.error('[Queue] Task failed:', err)
    }
  }
  isProcessing = false
  sendQueueStatus()
}

export function getWatcher() { return watcher }
export function setWatcher(w: chokidar.FSWatcher | null) { watcher = w }

export function setupWatcher(vaultPath: string, win: BrowserWindow | null) {
  if (!vaultPath) return

  log.info('Setting up file watcher at:', vaultPath)
  watcher = chokidar.watch(vaultPath, {
    ignored: /(^|[\/\\])\../,
    persistent: true,
    depth: 2,
    ignoreInitial: true
  })

  loadReferenceWatchers()

  watcher.on('add', async (filePath) => {
    if (filePath.includes('Memos') || filePath.includes('Files')) {
      enqueueTask(async () => {
        log.info(`File added to vault: ${filePath}`)

        const existingFile = await dbHelper.getQuery('SELECT id, is_indexed FROM file_metadata WHERE file_path = ?', [filePath])
        if (existingFile && Number(existingFile.is_indexed) === 1) {
          log.info(`File already indexed: ${filePath}, skipping.`)
          return
        }

        const stats = fs.statSync(filePath)
        const fileName = path.basename(filePath)
        const fileType = path.extname(filePath).toLowerCase()
        const fileId = existingFile ? existingFile.id : uuidv4()

        const sendProgress = (data: any) => {
          const targetWin = win || BrowserWindow.getAllWindows()[0]
          if (targetWin) {
            targetWin.webContents.send('indexing-progress', { fileId, fileName, ...data })
          }
        }

        try {
          log.info(`Starting processing for file: ${fileName}, fileId: ${fileId}`)
          sendProgress({ status: 'parsing', progress: 0 })

          if (!existingFile) {
            await dbHelper.runQuery(`
              INSERT OR REPLACE INTO file_metadata (id, file_path, file_name, file_type, file_size, last_modified)
              VALUES (?, ?, ?, ?, ?, ?)
            `, [fileId, filePath, fileName, fileType, stats.size, stats.mtime.toISOString()])
          }

          let chunks: any[] = []
          try {
            chunks = await processFileForRAG(filePath)
          } catch (procErr: any) {
            log.error(`[KB Watcher] Failed to process file ${fileName}:`, procErr.message)
            sendProgress({ status: 'error', message: `文件处理失败: ${procErr.message}` })
            return
          }

          if (chunks.length > 0) {
            sendProgress({ status: 'vectorizing', progress: 0, totalChunks: chunks.length })

            for (let i = 0; i < chunks.length; i++) {
              await dbHelper.insertFileChunk(fileId, chunks[i]!.metadata.chunk_index, chunks[i]!.text)
            }

            await vectorDb.addFileChunksToVectorDb(fileId, chunks, (current: number, total: number) => {
              sendProgress({ status: 'vectorizing', progress: Math.round((current / total) * 100), current, total })
            })

            await dbHelper.runQuery('UPDATE file_metadata SET is_indexed = 1, folder_path = ? WHERE id = ?', [path.dirname(filePath), fileId])
            log.info(`File ${fileName} vectorized with ${chunks.length} chunks.`)
            sendProgress({ status: 'completed', progress: 100 })

            try {
              const fullText = chunks.map((c: any) => c.text).join('\n')
              const prompt = `你是一位知识管理专家。请为以下文档内容生成：\n1. 一段50-100字的摘要（用中文）\n2. 3-5个标签（每个标签2-4个字）\n\n文档名：${fileName}\n内容：${fullText.substring(0, 3000)}\n\n请按以下格式输出，不要添加其他内容：\n摘要：xxx\n标签：标签1,标签2,标签3`
              let responseText = ''
              try {
                responseText = await modelRouter.chat({ messages: [{ role: 'user' as const, content: prompt }] })
              } catch (err: any) {
                log.error('[KB] Summary failed:', err.message)
                responseText = ''
              }
              let summary = ''
              let tags: string[] = []
              const summaryMatch = responseText.match(/摘要[：:]\s*(.+)/)
              if (summaryMatch && summaryMatch[1]) summary = summaryMatch[1].trim()
              const tagsMatch = responseText.match(/标签[：:]\s*(.+)/)
              if (tagsMatch && tagsMatch[1]) {
                tags = tagsMatch[1].split(/[,，、]/).map((t: string) => t.trim()).filter(Boolean)
              }
              if (summary) await dbHelper.updateFileSummary(fileId, summary)
              if (tags.length > 0) {
                const existingTagsRow = await dbHelper.getQuery('SELECT tags FROM file_metadata WHERE id = ?', [fileId])
                let existingTags: string[] = []
                try { existingTags = existingTagsRow?.tags ? JSON.parse(existingTagsRow.tags) : [] } catch {}
                await dbHelper.updateFileTags(fileId, [...new Set([...existingTags, ...tags])])
              }
              log.info(`[KB] Auto summary/tags for ${fileName}: ${summary.substring(0, 30)}... | ${tags.join(',')}`)
              const notifyWin = win || BrowserWindow.getAllWindows()[0]
              notifyWin?.webContents.send('file-summary-ready', { fileId, summary, tags })
            } catch (sumErr: any) {
              log.warn(`[KB] Auto summary failed for ${fileName}:`, sumErr.message)
            }

            try {
              await incrementalDigest([fileId])
            } catch (digestErr: any) {
              log.warn(`[KB Watcher] Incremental digest failed for ${fileName}:`, digestErr.message)
            }
          } else {
            sendProgress({ status: 'error', message: '未能从文件中提取有效文本' })
          }
        } catch (err: any) {
          log.error('Failed to process added file:', err)
          sendProgress({ status: 'error', message: err.message })
        }

        const targetWin = win || BrowserWindow.getAllWindows()[0]
        targetWin?.webContents.send('vault-file-added', { filePath, fileName })
      })
    }
  })

  watcher.on('change', async (filePath) => {
    if (!filePath.includes('Files') && !filePath.includes('Memos')) return
    if (filePath.endsWith('.db') || filePath.includes('VectorDB') || filePath.includes('lancedb')) return

    enqueueTask(async () => {
      log.info(`[KB Watcher] File changed: ${filePath}, re-indexing...`)

      const existingFile = await dbHelper.getQuery('SELECT id, is_indexed FROM file_metadata WHERE file_path = ?', [filePath])
      if (!existingFile) {
        log.info(`[KB Watcher] File not in DB, skipping: ${filePath}`)
        return
      }

      const fileId = existingFile.id
      const fileName = path.basename(filePath)

      const sendProgress = (data: any) => {
        const targetWin = win || BrowserWindow.getAllWindows()[0]
        if (targetWin) {
          targetWin.webContents.send('indexing-progress', { fileId, fileName, ...data })
        }
      }

      try {
        await dbHelper.deleteFileChunks(fileId)
        await vectorDb.deleteFileFromVectorDb(fileId)
        sendProgress({ status: 'parsing', progress: 0 })

        const chunks = await processFileForRAG(filePath)
        if (chunks.length > 0) {
          sendProgress({ status: 'vectorizing', progress: 0, totalChunks: chunks.length })
          for (let i = 0; i < chunks.length; i++) {
            await dbHelper.insertFileChunk(fileId, chunks[i]!.metadata.chunk_index, chunks[i]!.text)
          }
          await vectorDb.addFileChunksToVectorDb(fileId, chunks, (current: number, total: number) => {
            sendProgress({ status: 'vectorizing', progress: Math.round((current / total) * 100), current, total })
          })
          const stats = fs.statSync(filePath)
          await dbHelper.runQuery('UPDATE file_metadata SET is_indexed = 1, file_size = ?, last_modified = ? WHERE id = ?', [stats.size, stats.mtime.toISOString(), fileId])
          sendProgress({ status: 'completed', progress: 100 })
          log.info(`[KB Watcher] Re-indexed ${fileName}: ${chunks.length} chunks`)
          try {
            await incrementalDigest([fileId])
          } catch (digestErr: any) {
            log.warn(`[KB Watcher] Incremental digest failed for ${fileName}:`, digestErr.message)
          }
        } else {
          sendProgress({ status: 'error', message: '未能从修改后的文件中提取有效文本' })
        }
      } catch (err: any) {
        log.error('[KB Watcher] Re-index failed:', err)
        sendProgress({ status: 'error', message: err.message })
      }

      const targetWin = win || BrowserWindow.getAllWindows()[0]
      targetWin?.webContents.send('vault-file-added', { filePath, fileName })
    })
  })
}

export async function ensureWatcherForDir(dirPath: string) {
  if (!dirPath || referenceWatchers.has(dirPath)) return

  try {
    const refWatcher = chokidar.watch(dirPath, {
      ignored: /(^|[\/\\])\../,
      persistent: true,
      depth: 0,
      ignoreInitial: true
    })

    refWatcher.on('change', async (changedPath) => {
      const fileMeta = await dbHelper.getQuery(
        'SELECT id, storage_mode, link_status FROM file_metadata WHERE file_path = ? AND storage_mode = ?',
        [changedPath, 'reference']
      )
      if (!fileMeta) return

      enqueueTask(async () => {
        log.info(`[RefWatcher] File changed: ${changedPath}`)
        const existingFile = await dbHelper.getQuery('SELECT id, is_indexed FROM file_metadata WHERE file_path = ?', [changedPath])
        if (!existingFile) return

        const fileId = existingFile.id
        const fileName = path.basename(changedPath)

        try {
          await dbHelper.deleteFileChunks(fileId)
          await vectorDb.deleteFileFromVectorDb(fileId)
          const chunks = await processFileForRAG(changedPath)
          if (chunks.length > 0) {
            for (let i = 0; i < chunks.length; i++) {
              await dbHelper.insertFileChunk(fileId, chunks[i]!.metadata.chunk_index, chunks[i]!.text)
            }
            await vectorDb.addFileChunksToVectorDb(fileId, chunks)
            const stats = fs.statSync(changedPath)
            await dbHelper.runQuery('UPDATE file_metadata SET is_indexed = 1, file_size = ?, last_modified = ?, link_status = ? WHERE id = ?', [stats.size, stats.mtime.toISOString(), 'active', fileId])
            log.info(`[RefWatcher] Re-indexed ${fileName}: ${chunks.length} chunks`)
          }
        } catch (err: any) {
          log.error('[RefWatcher] Re-index failed:', err)
        }
      })
    })

    refWatcher.on('unlink', async (unlinkedPath) => {
      const fileMeta = await dbHelper.getQuery(
        'SELECT id FROM file_metadata WHERE file_path = ? AND storage_mode = ?',
        [unlinkedPath, 'reference']
      )
      if (fileMeta) {
        log.info(`[RefWatcher] File deleted: ${unlinkedPath}, marking as missing`)
        await dbHelper.runQuery('UPDATE file_metadata SET link_status = ? WHERE id = ?', ['deleted', fileMeta.id])
        const targetWin = BrowserWindow.getAllWindows()[0]
        targetWin?.webContents.send('file-link-broken', { fileId: fileMeta.id, filePath: unlinkedPath, reason: 'deleted' })
      }
    })

    referenceWatchers.set(dirPath, refWatcher)
    log.info(`[RefWatcher] Started watching: ${dirPath}`)
  } catch (err) {
    log.error(`[RefWatcher] Failed to watch ${dirPath}:`, err)
  }
}

export function removeReferenceWatcher(dirPath: string) {
  const watcher = referenceWatchers.get(dirPath)
  if (watcher) {
    watcher.close()
    referenceWatchers.delete(dirPath)
  }
}

export function closeAllReferenceWatchers() {
  for (const [, watcher] of referenceWatchers) {
    watcher.close()
  }
  referenceWatchers.clear()
}

export async function loadReferenceWatchers() {
  try {
    const refFiles = await dbHelper.allQuery(
      'SELECT DISTINCT folder_path FROM file_metadata WHERE storage_mode = ? AND link_status = ?',
      ['reference', 'active']
    )
    for (const row of refFiles) {
      if (row.folder_path) {
        ensureWatcherForDir(row.folder_path)
      }
    }
    log.info(`[RefWatcher] Loaded ${refFiles.length} reference directories`)
  } catch (err) {
    log.error('[RefWatcher] Failed to load reference watchers:', err)
  }
}
