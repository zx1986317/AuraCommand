/**
 * 知识库搜索/检索相关 IPC 处理器
 */
import { IpcModule, IpcContext } from './index'
import dbHelper from '../db'
import vectorDb from '../vectorDb'
import { escapeFts5Query } from '../db/search'
import { parseSearchQuery, applyTagFilter, applyProjectFilter, applyDateFilter } from '../search/queryParser'
import {
  SearchKnowledgeSchema,
  validateInput,
} from './schemas'
import {
  logError,
  ErrorCategory,
} from '../errorHandler'

export function createKnowledgeSearchModule(ctx: IpcContext): IpcModule {
  return {
    'search-vector': async (_: any, { query, limit = 10 }: { query: string, limit?: number }) => {
      try { return await vectorDb.searchKnowledgeBase(query, limit) }
      catch (err: any) { logError('Vector search failed:', ErrorCategory.UNKNOWN, { err }); return [] }
    },
    'get-memos-by-tag': async (_: any, { tag }: { tag: string }) => {
      try {
        const ftsQuery = escapeFts5Query(tag)
        return await dbHelper.allQuery(
          `SELECT n.* FROM notes n JOIN notes_fts fts ON n.rowid = fts.rowid WHERE notes_fts MATCH ? ORDER BY fts.rank`,
          [ftsQuery]
        )
      }
      catch (err) { logError('Failed to get notes by tag:', ErrorCategory.DATABASE, { err }); return [] }
    },
    'global-search': async (_: any, { query, projectName }: { query: string, projectName?: string }) => {
      try {
        const { cleanQuery, filters } = parseSearchQuery(query)
        const effectiveProject = projectName || filters.project
        const ftsQuery = escapeFts5Query(cleanQuery || query)

        let notesSql = `SELECT n.id, n.title, n.content, n.type FROM notes n JOIN notes_fts fts ON n.rowid = fts.rowid WHERE notes_fts MATCH ?`
        const notesParams: any[] = [ftsQuery]
        if (effectiveProject) {
          notesSql += ` AND (n.project = ? OR n.id IN (SELECT item_id FROM project_items WHERE project_name = ? AND item_type IN ('note','document')))`
          notesParams.push(effectiveProject, effectiveProject)
        }
        const tagFilter = applyTagFilter('n', filters.tag || [])
        if (tagFilter.clause) { notesSql += tagFilter.clause; notesParams.push(...tagFilter.params) }
        const dateFilter = applyDateFilter('n', filters)
        if (dateFilter.clause) { notesSql += dateFilter.clause; notesParams.push(...dateFilter.params) }

        const notes = await dbHelper.allQuery(notesSql, notesParams)
        let results = notes.map((n: any) => ({ ...n, type: n.type === 'document' ? 'document' : 'memo' }))

        if (!filters.type || filters.type === 'schedule') {
          const schedParams: any[] = [`%${cleanQuery || query}%`, `%${cleanQuery || query}%`]
          let schedSql = 'SELECT id, title, description as content, "schedule" as type FROM schedules WHERE (title LIKE ? OR description LIKE ?)'
          const schedDateFilter = applyDateFilter('schedules', filters)
          if (schedDateFilter.clause) { schedSql += schedDateFilter.clause; schedParams.push(...schedDateFilter.params) }
          const schedules = await dbHelper.allQuery(schedSql, schedParams)
          results = [...results, ...schedules]
        }
        return results
      } catch (err) { logError('Global search failed:', ErrorCategory.DATABASE, { err }); return [] }
    },
    'search-kb-fulltext': async (_: any, { query, mode, limit, projectName }: { query: string, mode?: string, limit?: number, projectName?: string }) => {
      try {
        const { cleanQuery, filters } = parseSearchQuery(query)
        const effectiveProject = projectName || filters.project
        return await dbHelper.hybridSearchKB(cleanQuery || query, (mode || 'hybrid') as any, limit || 20, effectiveProject)
      }
      catch (err: any) { logError('KB fulltext search failed:', ErrorCategory.DATABASE, { err }); return [] }
    },
    'get-ai-memories': async () => {
      try { return await dbHelper.allQuery('SELECT * FROM ai_memories ORDER BY relevance DESC') }
      catch (err) { logError('Failed to get AI memories:', ErrorCategory.DATABASE, { err }); return [] }
    },
    'search-ai-memories': async (_: any, { query }: { query: string }) => {
      try { return await dbHelper.allQuery("SELECT * FROM ai_memories WHERE content LIKE ? OR category LIKE ? ORDER BY relevance DESC, last_accessed DESC", [`%${query}%`, `%${query}%`]) }
      catch (err) { logError('Failed to search memories:', ErrorCategory.DATABASE, { err }); return [] }
    },
    'search-notes-for-link': async (_: any, { query }: { query: string }) => {
      try {
        const { cleanQuery } = parseSearchQuery(query)
        const ftsQuery = escapeFts5Query(cleanQuery || query)
        const notes = await dbHelper.allQuery(
          `SELECT n.id, n.title, n.type FROM notes n JOIN notes_fts fts ON n.rowid = fts.rowid WHERE notes_fts MATCH ? ORDER BY fts.rank LIMIT 20`,
          [ftsQuery]
        );
        return notes || [];
      } catch (err: any) {
        logError('Failed to search notes for link:', ErrorCategory.DATABASE, { err });
        return [];
      }
    },
    'global-hybrid-search': async (_: any, { query, projectName }: { query: string, projectName?: string }) => {
      try {
        const { cleanQuery, filters } = parseSearchQuery(query)
        const effectiveProject = projectName || filters.project
        const searchTerm = cleanQuery || query
        const ftsQuery = escapeFts5Query(searchTerm)

        let notesSql = `SELECT n.id, n.title, n.content, n.type, 'note' as source_type FROM notes n JOIN notes_fts fts ON n.rowid = fts.rowid WHERE notes_fts MATCH ?`
        const notesParams: any[] = [ftsQuery]
        if (effectiveProject) {
          notesSql += ` AND (n.project = ? OR n.id IN (SELECT item_id FROM project_items WHERE project_name = ? AND item_type IN ('note','document')))`
          notesParams.push(effectiveProject, effectiveProject)
        }
        const tagFilter = applyTagFilter('n', filters.tag || [])
        if (tagFilter.clause) { notesSql += tagFilter.clause; notesParams.push(...tagFilter.params) }
        const dateFilter = applyDateFilter('n', filters)
        if (dateFilter.clause) { notesSql += dateFilter.clause; notesParams.push(...dateFilter.params) }
        const notes = await dbHelper.allQuery(notesSql, notesParams);

        let files: any[] = []
        if (!filters.type || filters.type === 'file') {
          let filesSql = `SELECT id, file_name as title, summary as content, 'file' as source_type FROM file_metadata WHERE (file_name LIKE ? OR summary LIKE ?)`
          const filesParams: any[] = [`%${searchTerm}%`, `%${searchTerm}%`]
          if (effectiveProject) {
            filesSql += ` AND id IN (SELECT item_id FROM project_items WHERE project_name = ? AND item_type = 'kb_file')`
            filesParams.push(effectiveProject)
          }
          if (filters.tag && filters.tag.length > 0) {
            const tagLikes = filters.tag.map(() => `tags LIKE ?`).join(' OR ')
            filesSql += ` AND (${tagLikes})`
            filters.tag.forEach(t => filesParams.push(`%"${t}"%`))
          }
          files = await dbHelper.allQuery(filesSql, filesParams);
        }

        let vectorResults: any[] = [];
        try {
          vectorResults = await vectorDb.searchKnowledgeBase(searchTerm, 5);
        } catch {}
        const seen = new Set<string>();
        const results: any[] = [];
        for (const item of [...notes, ...files]) {
          if (!seen.has(item.id)) {
            seen.add(item.id);
            results.push(item);
          }
        }
        for (const vr of vectorResults) {
          if (vr.id && !seen.has(vr.id)) {
            seen.add(vr.id);
            results.push({ id: vr.id, title: vr.title || '', content: vr.text?.substring(0, 200) || '', source_type: 'vector' });
          }
        }
        return results.slice(0, 30);
      } catch (err: any) {
        logError('Global hybrid search failed:', ErrorCategory.DATABASE, { err });
        return [];
      }
    },
    'search-files-for-chat': async (_: any, { query }: { query: string }) => {
      try {
        const files = await dbHelper.allQuery(
          "SELECT id, file_name, file_type, summary FROM file_metadata WHERE file_name LIKE ? ORDER BY added_at DESC LIMIT 15",
          [`%${query}%`]
        );
        return files || [];
      } catch (err: any) {
        logError('Failed to search files for chat:', ErrorCategory.DATABASE, { err });
        return [];
      }
    },
    'get-file-content-for-chat': async (_: any, { fileId }: { fileId: string }) => {
      try {
        const file = await dbHelper.getQuery('SELECT * FROM file_metadata WHERE id = ?', [fileId]);
        if (!file) return null;
        const chunks = await dbHelper.allQuery(
          'SELECT text FROM file_chunks WHERE file_id = ? ORDER BY chunk_index LIMIT 5',
          [fileId]
        );
        const content = (chunks || []).map((c: any) => c.text).join('\n');
        return { id: file.id, file_name: file.file_name, file_type: file.file_type, summary: file.summary, content: content.substring(0, 3000) };
      } catch (err: any) {
        logError('Failed to get file content for chat:', ErrorCategory.DATABASE, { err });
        return null;
      }
    },
    'get-related-content': async (_: any, { noteId }: { noteId: string }) => {
      try {
        const note = await dbHelper.getQuery('SELECT * FROM notes WHERE id = ?', [noteId]);
        if (!note) return { success: false, error: 'Note not found' };

        const titleWords = (note.title || '').split(/\s+/).filter((w: string) => w.length > 1);
        const relatedNotes: any[] = [];
        for (const word of titleWords.slice(0, 3)) {
          const ftsWord = escapeFts5Query(word)
          const results = await dbHelper.allQuery(
            `SELECT n.id, n.title, n.type FROM notes n JOIN notes_fts fts ON n.rowid = fts.rowid WHERE n.id != ? AND notes_fts MATCH ? LIMIT 3`,
            [noteId, ftsWord]
          );
          if (results) relatedNotes.push(...results);
        }

        const tags = JSON.parse(note.tags || '[]');
        const relatedFiles: any[] = [];
        for (const tag of tags.slice(0, 3)) {
          const results = await dbHelper.allQuery(
            "SELECT id, file_name, file_type FROM file_metadata WHERE tags LIKE ? LIMIT 3",
            [`%${tag}%`]
          );
          if (results) relatedFiles.push(...results);
        }

        const uniqueNotes = [...new Map(relatedNotes.map((n: any) => [n.id, n])).values()].slice(0, 5);
        const uniqueFiles = [...new Map(relatedFiles.map((f: any) => [f.id, f])).values()].slice(0, 5);

        return { success: true, notes: uniqueNotes, files: uniqueFiles };
      } catch (err: any) {
        logError('Failed to get related content:', ErrorCategory.DATABASE, { err });
        return { success: false, error: err.message };
      }
    },
  }
}