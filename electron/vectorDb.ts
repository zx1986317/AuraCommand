import * as lancedb from '@lancedb/lancedb';
import path from 'node:path';
import fs from 'node:fs';
import { app } from 'electron';
import ollama from './ollama';
import log from 'electron-log';

let db: lancedb.Connection | null = null;
let currentDbPath: string | null = null;
let dbInitPromise: Promise<lancedb.Connection> | null = null;
let tableInitPromise: Promise<any> | null = null;
const TABLE_NAME = 'memos_vectors';
const SCHEMA_VERSION = 3; // v3: 动态向量维度 + 自动检测重建

export function setVectorDbPath(vaultPath: string) {
    currentDbPath = path.join(vaultPath, 'VectorDB');
    db = null;
    dbInitPromise = null;
    tableInitPromise = null;
}

export async function getVectorDb() {
    if (db) return db;
    if (dbInitPromise) return dbInitPromise;

    dbInitPromise = (async () => {
        try {
            const dbPath = currentDbPath || path.join(app.getPath('userData'), 'aura_lancedb');
            const dir = path.dirname(dbPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            db = await lancedb.connect(dbPath);
            return db;
        } finally {
            dbInitPromise = null;
        }
    })();

    return dbInitPromise;
}

// 获取嵌入模型的实际输出维度
async function detectVectorDimension(): Promise<number> {
    try {
        const embedding = await ollama.generateEmbedding('test');
        return embedding.length;
    } catch (err) {
        log.warn('[VectorDB] 无法检测嵌入维度，使用默认值 1024:', err);
        return 1024;
    }
}

// 获取已存在表的向量维度
async function getTableVectorDim(database: lancedb.Connection): Promise<number | null> {
    try {
        const table = await database.openTable(TABLE_NAME);
        const schema = table.schema;
        const vectorField = (schema as any).fields?.find((f: any) => f.name === 'vector');
        if (vectorField) {
            const fieldType = vectorField.type;
            return fieldType?.listSize ?? fieldType?.list_size ?? null;
        }
    } catch {}
    return null;
}

async function getOrCreateTable(database: lancedb.Connection) {
    if (tableInitPromise) return tableInitPromise;

    tableInitPromise = (async () => {
        try {
            const tableNames = await database.tableNames();

            if (tableNames.includes(TABLE_NAME)) {
                // 检查 schema 版本
                const dbPath = currentDbPath || path.join(app.getPath('userData'), 'aura_lancedb');
                const versionFile = path.join(dbPath, '.schema_version');
                let needRebuild = false;

                try {
                    if (fs.existsSync(versionFile)) {
                        const storedVersion = parseInt(fs.readFileSync(versionFile, 'utf-8').trim(), 10);
                        if (storedVersion !== SCHEMA_VERSION) {
                            log.warn(`[VectorDB] Schema 版本不匹配: 存储=${storedVersion}, 当前=${SCHEMA_VERSION}，重建表`);
                            needRebuild = true;
                        }
                    } else {
                        log.warn('[VectorDB] 未找到 schema 版本文件，重建表');
                        needRebuild = true;
                    }
                } catch (err) {
                    log.warn('[VectorDB] 检查 schema 版本失败:', err);
                    needRebuild = true;
                }

                // 检查向量维度是否与当前嵌入模型匹配
                if (!needRebuild) {
                    const currentDim = await getTableVectorDim(database);
                    if (currentDim !== null) {
                        const modelDim = await detectVectorDimension();
                        if (currentDim !== modelDim) {
                            log.warn(`[VectorDB] 向量维度不匹配: 表=${currentDim}, 模型=${modelDim}，重建表`);
                            needRebuild = true;
                        }
                    }
                }

                if (needRebuild) {
                    await database.dropTable(TABLE_NAME);
                } else {
                    return await database.openTable(TABLE_NAME);
                }
            }

            // 探测实际维度并创建表
            const vectorDim = await detectVectorDimension();
            const dummyEmbedding = new Array(vectorDim).fill(0);
            const table = await database.createTable(TABLE_NAME, [{
                id: 'dummy',
                vector: dummyEmbedding,
                text: '',
                title: '',
                category: '',
                project: '',
                type: ''
            }]);

            // 写入版本文件
            const dbPath = currentDbPath || path.join(app.getPath('userData'), 'aura_lancedb');
            const versionFile = path.join(dbPath, '.schema_version');
            try {
                if (!fs.existsSync(path.dirname(versionFile))) {
                    fs.mkdirSync(path.dirname(versionFile), { recursive: true });
                }
                fs.writeFileSync(versionFile, String(SCHEMA_VERSION), 'utf-8');
            } catch (err) {
                log.warn('[VectorDB] 写入 schema 版本文件失败:', err);
            }

            return table;
        } finally {
            tableInitPromise = null;
        }
    })();

    return tableInitPromise;
}

export async function addMemoToVectorDb(memoId: string, content: string, metadata: any) {
    const database = await getVectorDb();
    let embedding: number[];
    try {
        embedding = await ollama.generateEmbedding(content);
    } catch (err) {
        log.error('[VectorDB] Failed to generate embedding for memo:', memoId, err);
        throw err;
    }
    
    const table = await getOrCreateTable(database);
    await table.add([{
        id: memoId,
        vector: embedding,
        text: content,
        title: metadata.title || '',
        category: metadata.category || '',
        project: metadata.project || '',
        type: 'memo'
    }]);
}

export async function addFileChunksToVectorDb(fileId: string, chunks: any[], onProgress?: (index: number, total: number) => void) {
    const database = await getVectorDb();
    const table = await getOrCreateTable(database);
    
    const total = chunks.length;
    const records: any[] = [];
    log.info(`[VectorDB] Starting vectorization for ${fileId}, ${total} chunks`);
    
    for (let i = 0; i < total; i++) {
        const chunk = chunks[i];
        try {
            const embedding = await ollama.generateEmbedding(chunk.text);
            records.push({
                id: `${fileId}:${chunk.metadata.chunk_index}`,
                vector: embedding,
                text: chunk.text,
                title: chunk.metadata.file_name,
                category: 'file_chunk',
                project: chunk.metadata.file_path,
                type: 'file'
            });
        } catch (err) {
            log.error(`[VectorDB] Failed to generate embedding for chunk ${fileId}:${chunk.metadata.chunk_index}`, err);
        }
        
        if (onProgress && (i + 1) % 5 === 0) {
            onProgress(i + 1, total);
        }
    }
    
    if (records.length > 0) {
        await table.add(records);
    }
    log.info(`[VectorDB] Completed vectorization for ${fileId}, ${records.length} records added`);
}

export async function searchKnowledgeBase(query: string, limit: number = 5) {
    const database = await getVectorDb();
    const queryVector = await ollama.generateEmbedding(query);
    
    try {
        const table = await getOrCreateTable(database);
        const results = await table
            .vectorSearch(queryVector)
            .limit(limit + 1)
            .toArray();
        return results.filter((r: any) => r.id !== 'dummy').slice(0, limit);
    } catch (err: any) {
        const msg = err?.message || '';
        if (msg.includes('No vector column') || msg.includes('schema') || msg.includes('Schema')) {
            log.warn('[VectorDB] Vector search schema error, rebuilding table:', msg);
            // 强制重建表
            tableInitPromise = null;
            try {
                await database.dropTable(TABLE_NAME);
            } catch {}
            const dbPath = currentDbPath || path.join(app.getPath('userData'), 'aura_lancedb');
            const versionFile = path.join(dbPath, '.schema_version');
            try {
                if (fs.existsSync(versionFile)) fs.unlinkSync(versionFile);
            } catch {}
            // 重建后重试
            const table = await getOrCreateTable(database);
            const results = await table
                .vectorSearch(queryVector)
                .limit(limit + 1)
                .toArray();
            return results.filter((r: any) => r.id !== 'dummy').slice(0, limit);
        }
        throw err;
    }
}

const SAFE_ID_REGEX = /^[^\x00']+$/;

function validateId(id: string, label: string = 'id'): void {
  if (typeof id !== 'string' || id.length === 0 || id.length > 256) {
    throw new Error(`Invalid ${label}: empty or too long`);
  }
  if (!SAFE_ID_REGEX.test(id)) {
    throw new Error(`Invalid ${label}: contains unsafe characters`);
  }
}

export async function deleteMemoFromVectorDb(memoId: string) {
  validateId(memoId, 'memoId');
  const database = await getVectorDb();
  const table = await getOrCreateTable(database);
  await table.delete(`id = '${memoId.replace(/'/g, "''")}'`);
}

export async function deleteFileFromVectorDb(fileId: string) {
  validateId(fileId, 'fileId');
  const database = await getVectorDb();
  const table = await getOrCreateTable(database);
  const safeId = fileId.replace(/'/g, "''");
  await table.delete(`id LIKE '${safeId}:%' OR id = '${safeId}'`);
}

export async function clearAllVectors() {
    const database = await getVectorDb();
    const tableNames = await database.tableNames();
    if (tableNames.includes(TABLE_NAME)) {
        await database.dropTable(TABLE_NAME);
    }
    const dbPath = currentDbPath || path.join(app.getPath('userData'), 'aura_lancedb');
    const versionFile = path.join(dbPath, '.schema_version');
    try {
        if (fs.existsSync(versionFile)) fs.unlinkSync(versionFile);
    } catch {}
    tableInitPromise = null;
}

export async function getVectorCount(): Promise<number> {
    const database = await getVectorDb();
    const tableNames = await database.tableNames();
    if (!tableNames.includes(TABLE_NAME)) return 0;
    const table = await database.openTable(TABLE_NAME);
    try {
        return await table.countRows();
    } catch {
        return 0;
    }
}

export async function clearAll(): Promise<void> {
    await clearAllVectors();
}

export async function addDocument(doc: { id: string; text: string; title: string; type: string; folder_id?: string | null }): Promise<void> {
    await addMemoToVectorDb(doc.id, doc.text, { title: doc.title, category: doc.type });
}

export async function deleteDocument(id: string): Promise<void> {
    await deleteMemoFromVectorDb(id);
}

export default {
    getVectorDb,
    setVectorDbPath,
    addMemoToVectorDb,
    addFileChunksToVectorDb,
    deleteMemoFromVectorDb,
    deleteFileFromVectorDb,
    clearAllVectors,
    clearAll,
    searchKnowledgeBase,
    getVectorCount,
    addDocument,
    deleteDocument
};
