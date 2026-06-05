import log from 'electron-log';
import { getDatabase, setDatabasePath, runQuery, allQuery, getQuery } from './connection';
import { initDatabase } from './migrations';
import { searchMemosAndFiles, globalSearch, hybridSearchKB, reciprocalRankFusion, escapeFts5Query } from './search';
import { getNeighborChunks, getFileChunks, insertFileChunk, deleteFileChunks, rebuildChunkTokenizedText } from './chunks';
import { tokenizeChinese, initJieba } from './tokenizer';

export { getDatabase, setDatabasePath, runQuery, allQuery, getQuery } from './connection';
export { initDatabase } from './migrations';
export { searchMemosAndFiles, globalSearch, hybridSearchKB, reciprocalRankFusion, escapeFts5Query } from './search';
export { getNeighborChunks, getFileChunks, insertFileChunk, deleteFileChunks, rebuildChunkTokenizedText } from './chunks';
export { tokenizeChinese, initJieba } from './tokenizer';

export async function getAllFileTags(): Promise<string[]> {
    try {
        const files = await allQuery('SELECT tags FROM file_metadata WHERE tags IS NOT NULL AND tags != "[]" AND tags != ""');
        const tagSet = new Set<string>();
        files.forEach((f: any) => {
            try {
                const parsed = typeof f.tags === 'string' ? JSON.parse(f.tags) : f.tags;
                if (Array.isArray(parsed)) {
                    parsed.forEach((t: string) => { if (t.trim()) tagSet.add(t.trim()); });
                }
            } catch {}
        });
        return Array.from(tagSet).sort();
    } catch {
        return [];
    }
}

export async function updateFileTags(fileId: string, tags: string[]): Promise<void> {
    await runQuery('UPDATE file_metadata SET tags = ? WHERE id = ?', [JSON.stringify(tags), fileId]);
}

export async function updateFileSummary(fileId: string, summary: string): Promise<void> {
    await runQuery('UPDATE file_metadata SET summary = ? WHERE id = ?', [summary, fileId]);
}

export async function saveMemo(memo: { id: string; title?: string; content?: string; type?: string; folder_id?: string | null; file_path?: string; size?: number; source_url?: string; tags?: string; category?: string; project?: string }): Promise<{ id: string } | null> {
    const existing = await getQuery('SELECT id FROM notes WHERE id = ?', [memo.id]);
    if (existing) {
        await runQuery(
            `UPDATE notes SET title = ?, content = ?, tags = COALESCE(?, tags), category = COALESCE(?, category), project = COALESCE(?, project), updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [memo.title || '', memo.content || '', memo.tags || null, memo.category || null, memo.project || null, memo.id]
        );
        return { id: memo.id };
    } else {
        await runQuery(
            `INSERT INTO notes (id, type, title, content, tags, category, project, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [memo.id, memo.type || 'quick_note', memo.title || '', memo.content || '', memo.tags || null, memo.category || memo.type || null, memo.project || null]
        );
        return { id: memo.id };
    }
}

export async function addReferenceFolder(name: string, folderPath: string, recursive: boolean = true): Promise<any> {
    const id = `folder-${Date.now()}`;
    await runQuery(
        'INSERT INTO reference_folders (id, name, path, recursive) VALUES (?, ?, ?, ?)',
        [id, name, folderPath, recursive ? 1 : 0]
    );
    return { id, name, path: folderPath, recursive };
}

export async function getAllTags(): Promise<string[]> {
    try {
        const notesList = await allQuery("SELECT tags FROM notes WHERE tags IS NOT NULL AND tags != '' AND tags != '[]'");
        const tagSet = new Set<string>();
        notesList.forEach((m: any) => {
            try {
                const parsed = typeof m.tags === 'string' ? JSON.parse(m.tags) : m.tags;
                if (Array.isArray(parsed)) {
                    parsed.forEach((t: string) => { if (t.trim()) tagSet.add(t.trim()); });
                }
            } catch {}
        });
        return Array.from(tagSet).sort();
    } catch {
        return [];
    }
}

export async function getSetting(key: string): Promise<string | null> {
    try {
        const row = await getQuery('SELECT value FROM app_settings WHERE key = ?', [key]);
        if (!row) return null;
        const rawValue = row.value;
        if (typeof rawValue !== 'string') return rawValue ?? null;
        try {
            return JSON.parse(rawValue);
        } catch {
            return rawValue;
        }
    } catch {
        return null;
    }
}

export async function setSetting(key: string, value: string): Promise<void> {
    await runQuery(
        `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
        [key, value]
    );
}

export async function getAllMemos(): Promise<any[]> {
    return allQuery("SELECT * FROM notes WHERE type = 'quick_note' ORDER BY updated_at DESC");
}

export async function getAllSchedules(): Promise<any[]> {
    return allQuery('SELECT * FROM schedules ORDER BY start_time DESC');
}

export async function checkpoint() {
    try {
        const database = await getDatabase();
        await new Promise<void>((resolve, reject) => {
            database.run('PRAGMA wal_checkpoint(TRUNCATE)', (err) => {
                if (err) {
                    log.error('[DB] WAL checkpoint failed:', err);
                    reject(err);
                } else {
                    log.info('[DB] WAL checkpoint completed successfully');
                    resolve();
                }
            });
        });
    } catch (err: any) {
        log.warn('[DB] checkpoint error:', err.message);
    }
}

const dbHelper = {
    getDatabase,
    setDatabasePath,
    runQuery,
    allQuery,
    getQuery,
    initDatabase,
    checkpoint,
    searchMemosAndFiles,
    getAllMemos,
    getAllSchedules,
    globalSearch,
    getAllTags,
    getSetting,
    setSetting,
    hybridSearchKB,
    reciprocalRankFusion,
    getNeighborChunks,
    getFileChunks,
    insertFileChunk,
    deleteFileChunks,
    getAllFileTags,
    updateFileTags,
    updateFileSummary,
    saveMemo,
    addReferenceFolder,
    rebuildChunkTokenizedText,
    escapeFts5Query,
    tokenizeChinese,
    initJieba,
};
export default dbHelper;
