import path from 'node:path';
import { app } from 'electron';
import fs from 'node:fs';
import sqlite3 from 'sqlite3';
import log from 'electron-log';

let db: sqlite3.Database | null = null;
let currentDbPath: string | null = null;
let dbInitPromise: Promise<sqlite3.Database> | null = null;

export function setDatabasePath(vaultPath: string) {
    currentDbPath = path.join(vaultPath, 'aura_command.db');
    if (db) {
        const oldDb = db;
        db = null;
        dbInitPromise = null;
        oldDb.close((err) => {
            if (err) log.error('[DB] Error closing old database:', err);
        });
    }
}

function openDatabase(dbPath: string): Promise<sqlite3.Database> {
    return new Promise((resolve, reject) => {
        const database = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                log.error('[DB] Failed to open database:', err);
                return reject(err);
            }
            log.info('[DB] Database opened successfully at:', dbPath);
            resolve(database);
        });
    });
}

function healthCheck(database: sqlite3.Database): Promise<void> {
    return new Promise((resolve, reject) => {
        database.get('SELECT 1 AS health_check', (err, _row) => {
            if (err) {
                return reject(err);
            }
            resolve();
        });
    });
}

export async function getDatabase(): Promise<sqlite3.Database> {
    if (db) return db;
    if (dbInitPromise) return dbInitPromise;

    dbInitPromise = (async () => {
        try {
            log.info('[DB] Attempting to open sqlite3 database...');
            let dbPath: string;
            if (currentDbPath) {
                dbPath = currentDbPath;
            } else {
                try {
                    dbPath = path.join(app.getPath('userData'), 'aura_command.db');
                } catch (e) {
                    dbPath = path.join(process.cwd(), 'aura_command.db');
                }
            }

            const dbDir = path.dirname(dbPath);
            if (!fs.existsSync(dbDir)) {
                fs.mkdirSync(dbDir, { recursive: true });
            }

            try {
                db = await openDatabase(dbPath);
                await healthCheck(db);

                await runQuery('PRAGMA journal_mode=WAL');
                await runQuery('PRAGMA synchronous=NORMAL');
                await runQuery('PRAGMA wal_autocheckpoint=1000');

                const integrityResult = await getQuery('PRAGMA integrity_check');
                if (integrityResult && integrityResult.integrity_check !== 'ok') {
                    log.warn('[DB] Integrity check failed:', integrityResult.integrity_check);
                    throw Object.assign(new Error('Integrity check failed'), { code: 'SQLITE_CORRUPT' });
                }

                return db;
            } catch (err: any) {
                if (err.code === 'SQLITE_CORRUPT' || err.code === 'SQLITE_NOTADB') {
                    log.warn('[DB] Database corruption detected, attempting recovery...');
                    if (db) {
                        db.close();
                        db = null;
                    }

                    const backupPath = dbPath + `.corrupt.${Date.now()}`;
                    try {
                        fs.renameSync(dbPath, backupPath);
                        log.info('[DB] Corrupt database renamed to:', backupPath);
                    } catch (renameErr) {
                        log.error('[DB] Failed to rename corrupt database:', renameErr);
                        throw err;
                    }

                    for (const ext of ['-wal', '-shm']) {
                        const extPath = dbPath + ext;
                        if (fs.existsSync(extPath)) {
                            try {
                                fs.renameSync(extPath, backupPath + ext);
                            } catch {}
                        }
                    }

                    try {
                        db = await openDatabase(dbPath);
                        await runQuery('PRAGMA journal_mode=WAL');
                        await runQuery('PRAGMA synchronous=NORMAL');
                        await runQuery('PRAGMA wal_autocheckpoint=1000');
                        log.info('[DB] New database created successfully after recovery.');
                        return db;
                    } catch (reopenErr) {
                        db = null;
                        log.error('[DB] Failed to reopen database after recovery:', reopenErr);
                        throw reopenErr;
                    }
                } else {
                    db = null;
                    log.error('[DB] Database open failed with unexpected error:', err);
                    throw err;
                }
            }
        } finally {
            dbInitPromise = null;
        }
    })();

    return dbInitPromise;
}

export async function runQuery(sql: string, params: any[] = []): Promise<any> {
    const database = await getDatabase();
    return new Promise((resolve, reject) => {
        database.run(sql, params, function(err) {
            if (err) return reject(err);
            resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

export async function allQuery(sql: string, params: any[] = []): Promise<any[]> {
    const database = await getDatabase();
    return new Promise((resolve, reject) => {
        database.all(sql, params, (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
}

export async function getQuery(sql: string, params: any[] = []): Promise<any> {
    const database = await getDatabase();
    return new Promise((resolve, reject) => {
        database.get(sql, params, (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });
}

export async function runInTransaction<T>(fn: () => Promise<T>): Promise<T> {
    await runQuery('BEGIN IMMEDIATE');
    try {
        const result = await fn();
        await runQuery('COMMIT');
        return result;
    } catch (err) {
        try { await runQuery('ROLLBACK'); } catch (rollbackErr) {
            log.error('[DB] Rollback failed:', rollbackErr);
        }
        throw err;
    }
}

export async function autoBackup(vaultPath: string): Promise<void> {
    try {
        const dbPath = path.join(vaultPath, 'aura_command.db');
        if (!fs.existsSync(dbPath)) return;

        const backupDir = path.join(vaultPath, 'backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
        const backupPath = path.join(backupDir, `aura_command_${timestamp}.db`);

        if (db) {
            await new Promise<void>((resolve, reject) => {
                (db as any).backup(backupPath, (err: any) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        } else {
            fs.copyFileSync(dbPath, backupPath);
        }

        const backups = fs.readdirSync(backupDir)
            .filter(f => f.startsWith('aura_command_') && f.endsWith('.db'))
            .sort();
        const MAX_BACKUPS = 10;
        while (backups.length > MAX_BACKUPS) {
            const oldest = backups.shift()!;
            fs.unlinkSync(path.join(backupDir, oldest));
        }

        log.info('[DB] Auto backup created:', backupPath);
    } catch (err) {
        log.error('[DB] Auto backup failed:', err);
    }
}
