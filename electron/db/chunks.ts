import log from 'electron-log';
import { runQuery, allQuery } from './connection';
import { tokenizeChinese, initJieba, isJiebaReady } from './tokenizer';

export async function getNeighborChunks(fileId: string, chunkIndex: number, windowSize: number = 1): Promise<any[]> {
    return allQuery(
        'SELECT id, file_id, chunk_index, text FROM file_chunks WHERE file_id = ? AND chunk_index BETWEEN ? AND ? ORDER BY chunk_index',
        [fileId, chunkIndex - windowSize, chunkIndex + windowSize]
    );
}

export async function getFileChunks(fileId: string): Promise<any[]> {
    return allQuery('SELECT * FROM file_chunks WHERE file_id = ? ORDER BY chunk_index', [fileId]);
}

export async function insertFileChunk(fileId: string, chunkIndex: number, text: string): Promise<void> {
    const id = `${fileId}_chunk_${chunkIndex}`;
    const tokenized = tokenizeChinese(text);
    await runQuery(
        'INSERT OR REPLACE INTO file_chunks (id, file_id, chunk_index, text, tokenized_text, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [id, fileId, chunkIndex, text, tokenized, new Date().toISOString()]
    );
}

export async function deleteFileChunks(fileId: string): Promise<void> {
    await runQuery('DELETE FROM file_chunks WHERE file_id = ?', [fileId]);
}

async function rebuildChunkTokenizedText(): Promise<void> {
    if (!isJiebaReady()) {
        initJieba();
        if (!isJiebaReady()) return;
    }
    try {
        const untokenized = await allQuery('SELECT rowid, text, tokenized_text FROM file_chunks WHERE tokenized_text IS NULL LIMIT 500');
        if (untokenized.length === 0) return;
        log.info(`[DB] Rebuilding tokenized_text for ${untokenized.length} chunks...`);
        for (const chunk of untokenized) {
            const tokenized = tokenizeChinese(chunk.text);
            await runQuery('UPDATE file_chunks SET tokenized_text = ? WHERE rowid = ?', [tokenized, chunk.rowid]);
        }
        log.info(`[DB] tokenized_text rebuild batch done.`);
    } catch (err: any) {
        log.warn('[DB] rebuildChunkTokenizedText error:', err.message);
    }
}

export { rebuildChunkTokenizedText };
