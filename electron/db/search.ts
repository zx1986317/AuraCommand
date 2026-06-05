import log from 'electron-log';
import { allQuery } from './connection';
import { tokenizeChinese, initJieba, isJiebaReady } from './tokenizer';

export function escapeFts5Query(query: string): string {
    const tokenized = tokenizeChinese(query);
    if (tokenized !== query) {
        return tokenized
            .split(/\s+/)
            .filter(Boolean)
            .map(term => `"${term.replace(/"/g, '""')}"*`)
            .join(' OR ');
    }
    return query
        .split(/\s+/)
        .filter(Boolean)
        .map(term => `"${term.replace(/"/g, '""')}"*`)
        .join(' OR ');
}

interface UnifiedSearchOptions {
    maxResults?: number;
    includeSnippet?: boolean;
}

async function unifiedSearch(query: string, options: UnifiedSearchOptions = {}): Promise<any[]> {
    const { maxResults = 20, includeSnippet = false } = options;

    if (!isJiebaReady()) {
        initJieba();
    }

    const searchTerm = `%${query}%`;
    const tokenizedQuery = tokenizeChinese(query);
    const ftsQuery = escapeFts5Query(query);
    const tokenizedFtsQuery = escapeFts5Query(tokenizedQuery);
    const results: any[] = [];

    log.info('[DB Search] query:', query, 'tokenizedQuery:', tokenizedQuery, 'ftsQuery:', ftsQuery, 'tokenizedFtsQuery:', tokenizedFtsQuery)

    try {
        const notesList = await allQuery(`
            SELECT id, title, content as text, type, updated_at, project, category
            FROM notes WHERE title LIKE ? OR content LIKE ? LIMIT ?
        `, [searchTerm, searchTerm, maxResults]);
        results.push(...notesList.map((n: any) => ({ ...n, type: n.type === 'document' ? 'document' : 'memo' })));
    } catch (err: any) {
        log.warn('[DB] notes search failed:', err.message);
    }

    try {
        const snippetCol = includeSnippet ? `, snippet(file_chunks_fts, 0, '⟨', '⟩', '...', 30) as snippet` : '';
        const scoreCol = ', fts.rank as score';
        const chunks = await allQuery(`
            SELECT fc.id, fc.file_id, fc.chunk_index, fc.text,
                   fm.file_name, fm.file_type, fm.summary, fm.file_path,
                   'file_chunk' as type
                   ${snippetCol}${scoreCol}
            FROM file_chunks_fts fts
            JOIN file_chunks fc ON fc.rowid = fts.rowid
            JOIN file_metadata fm ON fm.id = fc.file_id
            WHERE file_chunks_fts MATCH ?
            ORDER BY fts.rank
            LIMIT ?
        `, [ftsQuery, maxResults]);
        log.info('[DB Search] file_chunks_fts results:', chunks.length)
        results.push(...chunks);
    } catch (chunkFtsErr: any) {
        log.warn('[DB] file_chunks_fts search failed, falling back to LIKE:', chunkFtsErr.message);
        try {
            log.info('[DB Search] file_chunks_fts LIKE fallback with searchTerm:', searchTerm)
            const chunks = await allQuery(`
                SELECT fc.id, fc.file_id, fc.chunk_index, fc.text,
                       fm.file_name, fm.file_type, fm.summary, fm.file_path,
                       'file_chunk' as type
                FROM file_chunks fc
                JOIN file_metadata fm ON fm.id = fc.file_id
                WHERE fc.text LIKE ? LIMIT ?
            `, [searchTerm, maxResults]);
            results.push(...chunks);
        } catch (chunkErr: any) {
            log.warn('[DB] file_chunks LIKE search failed:', chunkErr.message);
        }
    }

    try {
        const snippetCol = includeSnippet ? `, snippet(files_fts, 1, '⟨', '⟩', '...', 30) as snippet` : '';
        const scoreCol = ', fts.rank as score';
        const files = await allQuery(`
            SELECT f.id, f.file_name as title, f.summary as text, 'file' as type,
                   COALESCE(f.last_modified, f.created_at) as updated_at,
                   f.folder_path, f.tags${snippetCol}${scoreCol}
            FROM files_fts fts
            JOIN file_metadata f ON f.rowid = fts.rowid
            WHERE files_fts MATCH ?
            ORDER BY fts.rank
            LIMIT ?
        `, [ftsQuery, maxResults]);
        results.push(...files);
    } catch (ftsErr: any) {
        log.warn('[DB] files_fts search failed, falling back to LIKE:', ftsErr.message);
        try {
            const files = await allQuery(`
                SELECT id, file_name as title, summary as text, 'file' as type,
                       COALESCE(last_modified, created_at) as updated_at,
                       folder_path, tags
                FROM file_metadata
                WHERE file_name LIKE ? OR summary LIKE ?
                LIMIT ?
            `, [searchTerm, searchTerm, maxResults]);
            results.push(...files);
        } catch {}
    }

    const seenIds = new Set<string>();
    return results.filter((r: any) => {
        if (seenIds.has(r.id)) return false;
        seenIds.add(r.id);
        return true;
    });
}

export async function searchMemosAndFiles(query: string): Promise<any[]> {
    log.info('[DB] searchMemosAndFiles START query:', query)
    try {
        const results = await unifiedSearch(query, { maxResults: 10, includeSnippet: false });
        log.info('[DB] searchMemosAndFiles DONE returning', results.length, 'results')
        return results;
    } catch (err: any) {
        log.error('[DB] searchMemosAndFiles ERROR:', err.message)
        return []
    }
}

export async function globalSearch(query: string): Promise<any[]> {
    const results: any[] = [];

    try {
        const searchTerm = `%${query}%`;
        const notesList = await allQuery(`
            SELECT id, title, content as text, type, updated_at, category, tags, project
            FROM notes WHERE title LIKE ? OR content LIKE ? LIMIT 15
        `, [searchTerm, searchTerm]);
        results.push(...notesList.map((n: any) => ({ ...n, type: n.type === 'document' ? 'document' : 'memo' })));
    } catch (err) {
        log.warn('[DB] globalSearch notes failed:', err);
    }

    try {
        const ftsQuery = escapeFts5Query(query);
        let files: any[] = [];
        try {
            files = await allQuery(`
                SELECT f.id, f.file_name as title, f.summary as text, 'file' as type,
                       COALESCE(f.last_modified, f.created_at) as updated_at, f.file_type, f.folder_path, f.tags,
                       fts.rank, snippet(files_fts, 1, '⟨', '⟩', '...', 20) as snippet
                FROM files_fts fts
                JOIN file_metadata f ON f.rowid = fts.rowid
                WHERE files_fts MATCH ?
                ORDER BY fts.rank
                LIMIT 15
            `, [ftsQuery]);
        } catch {
            const searchTerm = `%${query}%`;
            files = await allQuery(`
                SELECT id, file_name as title, summary as text, 'file' as type,
                       COALESCE(last_modified, created_at) as updated_at, file_type, folder_path, tags
                FROM file_metadata WHERE file_name LIKE ? OR summary LIKE ? LIMIT 15
            `, [searchTerm, searchTerm]);
        }
        results.push(...files);
    } catch (err) {
        log.warn('[DB] globalSearch files failed:', err);
    }

    try {
        const scheduleSearch = `%${query}%`;
        const schedules = await allQuery(`
            SELECT id, title, content as text, 'schedule' as type, start_time as updated_at,
                   category, status
            FROM schedules
            WHERE title LIKE ? OR content LIKE ?
            LIMIT 10
        `, [scheduleSearch, scheduleSearch]);
        results.push(...schedules);
    } catch (err) {
        log.warn('[DB] globalSearch schedules failed:', err);
    }

    return results;
}

export function reciprocalRankFusion(resultLists: { id: string; [key: string]: any }[][], k: number = 60): any[] {
    const scoreMap = new Map<string, { data: any; rrfScore: number }>();

    for (const list of resultLists) {
        for (let rank = 0; rank < list.length; rank++) {
            const item = list[rank]!;
            const id = item.id;
            const rrfContribution = 1 / (k + rank + 1);

            if (scoreMap.has(id)) {
                const entry = scoreMap.get(id)!;
                entry.rrfScore += rrfContribution;
                if (item.snippet && !entry.data.snippet) {
                    entry.data = { ...entry.data, ...item };
                }
            } else {
                scoreMap.set(id, { data: { ...item }, rrfScore: rrfContribution });
            }
        }
    }

    return Array.from(scoreMap.entries())
        .map(([id, { data, rrfScore }]) => ({ ...data, id, rrfScore }))
        .sort((a, b) => b.rrfScore - a.rrfScore);
}

export async function hybridSearchKB(query: string, mode: 'keyword' | 'semantic' | 'hybrid' = 'hybrid', limit: number = 10): Promise<any[]> {
    const ftsQuery = escapeFts5Query(query);

    if (mode === 'keyword') {
        return keywordSearchKB(ftsQuery, query, limit);
    }

    const keywordResults = await keywordSearchKB(ftsQuery, query, limit * 2);
    return keywordResults.map((r: any) => ({ ...r, source: 'keyword' }));
}

async function keywordSearchKB(ftsQuery: string, rawQuery: string, limit: number): Promise<any[]> {
    return unifiedSearch(rawQuery, { maxResults: limit, includeSnippet: true });
}
