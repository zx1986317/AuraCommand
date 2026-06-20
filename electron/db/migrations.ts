import log from 'electron-log';
import { runQuery, allQuery, getQuery, runInTransaction } from './connection';
import { tokenizeChinese } from './tokenizer';
import { rebuildChunkTokenizedText } from './chunks';

export async function initDatabase() {
    log.info('[DB] Initializing database...');
    try {
        await runInTransaction(async () => {
        await runQuery(`
            CREATE TABLE IF NOT EXISTS memos (
                id TEXT PRIMARY KEY,
                title TEXT,
                content TEXT,
                tags TEXT,
                project TEXT,
                category TEXT,
                pinned INTEGER DEFAULT 0,
                images TEXT DEFAULT '[]',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await runQuery(`
            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                title TEXT,
                content TEXT,
                project TEXT,
                category TEXT DEFAULT '',
                tags TEXT DEFAULT '[]',
                source_type TEXT DEFAULT 'manual',
                source_id TEXT DEFAULT '',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await runQuery(`
            CREATE TABLE IF NOT EXISTS doc_categories (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                color TEXT DEFAULT '#6366f1',
                sort_order INTEGER DEFAULT 0,
                created_at TEXT,
                updated_at TEXT
            )
        `);
        try {
            await runQuery(`INSERT OR IGNORE INTO doc_categories (id, name, color, sort_order) VALUES (?, ?, ?, ?)`, ['uncategorized', '未分类', '#6b7280', 0]);
            await runQuery(`INSERT OR IGNORE INTO doc_categories (id, name, color, sort_order) VALUES (?, ?, ?, ?)`, ['work', '工作', '#6366f1', 1]);
            await runQuery(`INSERT OR IGNORE INTO doc_categories (id, name, color, sort_order) VALUES (?, ?, ?, ?)`, ['study', '学习', '#10b981', 2]);
            await runQuery(`INSERT OR IGNORE INTO doc_categories (id, name, color, sort_order) VALUES (?, ?, ?, ?)`, ['project', '项目', '#f59e0b', 3]);
        } catch {}

        try {
            await runQuery(`SELECT category FROM documents LIMIT 1`);
        } catch (e) {
            log.info('[DB] Adding category to documents...');
            await runQuery(`ALTER TABLE documents ADD COLUMN category TEXT DEFAULT ''`);
        }

        await runQuery(`
            CREATE TABLE IF NOT EXISTS file_metadata (
                id TEXT PRIMARY KEY,
                file_path TEXT UNIQUE,
                original_path TEXT,
                file_name TEXT,
                file_type TEXT,
                file_size INTEGER,
                last_modified DATETIME,
                is_indexed INTEGER DEFAULT 0,
                summary TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        try {
            await runQuery(`SELECT original_path FROM file_metadata LIMIT 1`);
        } catch (e) {
            log.info('[DB] Adding original_path to file_metadata...');
            await runQuery(`ALTER TABLE file_metadata ADD COLUMN original_path TEXT`);
        }

        await runQuery(`
            CREATE TABLE IF NOT EXISTS schedules (
                id TEXT PRIMARY KEY,
                title TEXT,
                content TEXT,
                start_time DATETIME,
                end_time DATETIME,
                memo_id TEXT,
                status TEXT DEFAULT 'pending',
                category TEXT,
                source TEXT DEFAULT '',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await runQuery(`
            CREATE TABLE IF NOT EXISTS chat_sessions (
                id TEXT PRIMARY KEY,
                title TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await runQuery(`
            CREATE TABLE IF NOT EXISTS chat_messages (
                id TEXT PRIMARY KEY,
                session_id TEXT,
                role TEXT,
                content TEXT,
                images TEXT,
                sources TEXT,
                tags TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
            )
        `);

        try {
            await runQuery(`SELECT session_id FROM chat_messages LIMIT 1`);
        } catch (e) {
            log.info('[DB] Adding session_id to chat_messages...');
            await runQuery(`ALTER TABLE chat_messages ADD COLUMN session_id TEXT`);
        }

        try {
            await runQuery(`SELECT tags FROM chat_messages LIMIT 1`);
        } catch (e) {
            log.info('[DB] Adding tags to chat_messages...');
            await runQuery(`ALTER TABLE chat_messages ADD COLUMN tags TEXT`);
        }

        try {
            await runQuery(`SELECT bookmarked FROM chat_messages LIMIT 1`);
        } catch (e) {
            log.info('[DB] Adding bookmarked to chat_messages...');
            await runQuery(`ALTER TABLE chat_messages ADD COLUMN bookmarked INTEGER DEFAULT 0`);
        }

        try {
            await runQuery(`SELECT recurrence FROM schedules LIMIT 1`);
        } catch (e) {
            log.info('[DB] Adding recurrence to schedules...');
            await runQuery(`ALTER TABLE schedules ADD COLUMN recurrence TEXT DEFAULT 'none'`);
        }

        try {
            await runQuery(`SELECT linked_memos FROM schedules LIMIT 1`);
        } catch (e) {
            log.info('[DB] Adding linked_memos to schedules...');
            await runQuery(`ALTER TABLE schedules ADD COLUMN linked_memos TEXT DEFAULT '[]'`);
        }

        try {
            await runQuery(`SELECT priority FROM schedules LIMIT 1`);
        } catch (e) {
            log.info('[DB] Adding priority to schedules...');
            await runQuery(`ALTER TABLE schedules ADD COLUMN priority TEXT DEFAULT 'medium'`);
        }

        try {
            await runQuery(`SELECT due_date FROM schedules LIMIT 1`);
        } catch (e) {
            log.info('[DB] Adding due_date to schedules...');
            await runQuery(`ALTER TABLE schedules ADD COLUMN due_date TEXT DEFAULT ''`);
        }

        try {
            await runQuery(`SELECT parent_id FROM schedules LIMIT 1`);
        } catch (e) {
            log.info('[DB] Adding parent_id to schedules...');
            await runQuery(`ALTER TABLE schedules ADD COLUMN parent_id TEXT DEFAULT ''`);
        }

        try {
            await runQuery(`SELECT sort_order FROM schedules LIMIT 1`);
        } catch (e) {
            log.info('[DB] Adding sort_order to schedules...');
            await runQuery(`ALTER TABLE schedules ADD COLUMN sort_order INTEGER DEFAULT 0`);
        }

        try {
            await runQuery(`SELECT source FROM schedules LIMIT 1`);
        } catch (e) {
            log.info('[DB] Adding source to schedules...');
            await runQuery(`ALTER TABLE schedules ADD COLUMN source TEXT DEFAULT ''`);
        }

        try {
            await runQuery(`SELECT tags FROM file_metadata LIMIT 1`);
        } catch (e) {
            log.info('[DB] Adding tags to file_metadata...');
            await runQuery(`ALTER TABLE file_metadata ADD COLUMN tags TEXT DEFAULT '[]'`);
        }

        try {
            await runQuery(`SELECT folder_path FROM file_metadata LIMIT 1`);
        } catch (e) {
            log.info('[DB] Adding folder_path to file_metadata...');
            await runQuery(`ALTER TABLE file_metadata ADD COLUMN folder_path TEXT DEFAULT ''`);
        }

        try {
            await runQuery(`SELECT storage_mode FROM file_metadata LIMIT 1`);
        } catch (e) {
            log.info('[DB] Adding storage_mode to file_metadata...');
            await runQuery(`ALTER TABLE file_metadata ADD COLUMN storage_mode TEXT DEFAULT 'copy'`);
        }
        try {
            await runQuery(`SELECT original_path FROM file_metadata LIMIT 1`);
        } catch (e) {
            log.info('[DB] Adding original_path to file_metadata...');
            await runQuery(`ALTER TABLE file_metadata ADD COLUMN original_path TEXT DEFAULT ''`);
        }
        try {
            await runQuery(`SELECT link_status FROM file_metadata LIMIT 1`);
        } catch (e) {
            log.info('[DB] Adding link_status to file_metadata...');
            await runQuery(`ALTER TABLE file_metadata ADD COLUMN link_status TEXT DEFAULT 'active'`);
        }

        try {
            await runQuery(`SELECT last_modified FROM file_metadata LIMIT 1`);
        } catch (e) {
            log.info('[DB] Adding last_modified to file_metadata...');
            await runQuery(`ALTER TABLE file_metadata ADD COLUMN last_modified DATETIME`);
        }

        try {
            await runQuery(`SELECT added_at FROM file_metadata LIMIT 1`);
        } catch (e) {
            log.info('[DB] Adding added_at to file_metadata...');
            await runQuery(`ALTER TABLE file_metadata ADD COLUMN added_at DATETIME DEFAULT NULL`);
            await runQuery(`UPDATE file_metadata SET added_at = datetime('now') WHERE added_at IS NULL`);
        }

        try {
            await runQuery(`SELECT indexed_at FROM file_metadata LIMIT 1`);
        } catch (e) {
            log.info('[DB] Adding indexed_at to file_metadata...');
            await runQuery(`ALTER TABLE file_metadata ADD COLUMN indexed_at DATETIME`);
        }

        await runQuery(`
            CREATE TABLE IF NOT EXISTS kb_folders (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                parent_id TEXT,
                sort_order INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (parent_id) REFERENCES kb_folders(id) ON DELETE CASCADE
            )
        `);
        await runQuery(`
            CREATE TABLE IF NOT EXISTS file_folder (
                file_id TEXT NOT NULL,
                folder_id TEXT NOT NULL,
                PRIMARY KEY (file_id, folder_id),
                FOREIGN KEY (file_id) REFERENCES file_metadata(id) ON DELETE CASCADE,
                FOREIGN KEY (folder_id) REFERENCES kb_folders(id) ON DELETE CASCADE
            )
        `);
        try {
            await runQuery(`INSERT OR IGNORE INTO kb_folders (id, name, sort_order) VALUES (?, ?, ?)`, ['default', '未分类', 0]);
            await runQuery(`INSERT OR IGNORE INTO kb_folders (id, name, sort_order) VALUES (?, ?, ?)`, ['clips', '网页剪藏', 1]);
        } catch {}

        await runQuery(`
            CREATE TABLE IF NOT EXISTS file_chunks (
                id TEXT PRIMARY KEY,
                file_id TEXT NOT NULL,
                chunk_index INTEGER NOT NULL,
                text TEXT NOT NULL,
                tokenized_text TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (file_id) REFERENCES file_metadata(id) ON DELETE CASCADE
            )
        `);

        try {
            await runQuery(`SELECT file_id FROM file_chunks LIMIT 1`);
        } catch (e) {
            log.info('[DB] Adding file_id column to file_chunks...');
            await runQuery(`ALTER TABLE file_chunks ADD COLUMN file_id TEXT`);
        }

        try {
            await runQuery(`SELECT tokenized_text FROM file_chunks LIMIT 1`);
        } catch {
            log.info('[DB] Adding tokenized_text column to file_chunks...');
            await runQuery(`ALTER TABLE file_chunks ADD COLUMN tokenized_text TEXT`);
        }

        await runQuery(`
            CREATE TABLE IF NOT EXISTS agent_workflows (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT DEFAULT '',
                trigger_type TEXT DEFAULT 'manual',
                trigger_config TEXT DEFAULT '{}',
                action_type TEXT NOT NULL,
                action_config TEXT DEFAULT '{}',
                enabled INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await runQuery(`
            CREATE TABLE IF NOT EXISTS agent_workflow_logs (
                id TEXT PRIMARY KEY,
                workflow_id TEXT,
                status TEXT DEFAULT 'pending',
                result TEXT DEFAULT '',
                executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                execution_state TEXT DEFAULT '{}',
                last_completed_node TEXT,
                crash_recovery INTEGER DEFAULT 0,
                FOREIGN KEY (workflow_id) REFERENCES agent_workflows(id) ON DELETE CASCADE
            )
        `);

        try {
            await runQuery(`SELECT execution_state FROM agent_workflow_logs LIMIT 1`);
        } catch (e) {
            log.info('[DB] Adding execution_state to agent_workflow_logs...');
            await runQuery(`ALTER TABLE agent_workflow_logs ADD COLUMN execution_state TEXT DEFAULT '{}'`);
        }
        try {
            await runQuery(`SELECT last_completed_node FROM agent_workflow_logs LIMIT 1`);
        } catch (e) {
            log.info('[DB] Adding last_completed_node to agent_workflow_logs...');
            await runQuery(`ALTER TABLE agent_workflow_logs ADD COLUMN last_completed_node TEXT`);
        }
        try {
            await runQuery(`SELECT crash_recovery FROM agent_workflow_logs LIMIT 1`);
        } catch (e) {
            log.info('[DB] Adding crash_recovery to agent_workflow_logs...');
            await runQuery(`ALTER TABLE agent_workflow_logs ADD COLUMN crash_recovery INTEGER DEFAULT 0`);
        }

        await runQuery(`
            CREATE TABLE IF NOT EXISTS ai_memories (
                id TEXT PRIMARY KEY,
                category TEXT DEFAULT 'general',
                content TEXT NOT NULL,
                source TEXT DEFAULT 'auto',
                relevance INTEGER DEFAULT 5,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        try { await runQuery(`ALTER TABLE notes ADD COLUMN pinned INTEGER DEFAULT 0`) } catch {}
        try { await runQuery(`ALTER TABLE notes ADD COLUMN images TEXT DEFAULT '[]'`) } catch {}
        try { await runQuery(`ALTER TABLE notes ADD COLUMN source_type TEXT DEFAULT ''`) } catch {}
        try { await runQuery(`ALTER TABLE notes ADD COLUMN source_id TEXT DEFAULT ''`) } catch {}

        await runQuery(`
            CREATE TABLE IF NOT EXISTS notes (
                id TEXT PRIMARY KEY,
                type TEXT DEFAULT 'quick_note',
                title TEXT,
                content TEXT,
                tags TEXT,
                category TEXT,
                project TEXT,
                folder_id TEXT,
                file_path TEXT,
                size INTEGER,
                source_url TEXT,
                pinned INTEGER DEFAULT 0,
                images TEXT DEFAULT '[]',
                source_type TEXT DEFAULT '',
                source_id TEXT DEFAULT '',
                created_at TEXT,
                updated_at TEXT
            )
        `);

        try {
            const notesCount = await getQuery('SELECT COUNT(*) as cnt FROM notes');
            if (Number(notesCount?.cnt) === 0) {
                const memosCount = await getQuery('SELECT COUNT(*) as cnt FROM memos');
                if (Number(memosCount?.cnt) > 0) {
                    log.info('[DB] Migrating memos → notes...');
                    await runQuery(`
                        INSERT OR IGNORE INTO notes (id, type, title, content, tags, category, project, pinned, images, created_at, updated_at)
                        SELECT id, 'quick_note', title, content, tags, category, project, pinned, images, created_at, updated_at
                        FROM memos
                    `);
                }
                const docsCount = await getQuery('SELECT COUNT(*) as cnt FROM documents');
                if (Number(docsCount?.cnt) > 0) {
                    log.info('[DB] Migrating documents → notes...');
                    await runQuery(`
                        INSERT OR IGNORE INTO notes (id, type, title, content, tags, category, project, source_type, source_id, created_at, updated_at)
                        SELECT id, 'document', title, content, tags, category, project, COALESCE(source_type, 'manual'), COALESCE(source_id, ''), created_at, updated_at
                        FROM documents
                    `);
                }
            }
        } catch (migErr: any) {
            log.warn('[DB] memos→notes migration skipped:', migErr.message);
        }

        await runQuery(`
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                type TEXT DEFAULT 'task',
                status TEXT DEFAULT 'inbox',
                priority TEXT DEFAULT 'medium',
                due_date TEXT,
                scheduled_date TEXT,
                source_type TEXT,
                source_id TEXT,
                source_title TEXT,
                tags TEXT,
                created_at TEXT,
                updated_at TEXT,
                completed_at TEXT
            )
        `);

        await runQuery(`
            CREATE TABLE IF NOT EXISTS clips (
                id TEXT PRIMARY KEY,
                type TEXT DEFAULT 'image',
                content TEXT,
                thumbnail_path TEXT,
                ocr_text TEXT,
                ai_description TEXT,
                tags TEXT,
                created_at INTEGER
            )
        `);

        try {
          await runQuery(`SELECT tags FROM clips LIMIT 1`);
        } catch {
          log.info('[DB] Adding tags to clips...');
          await runQuery(`ALTER TABLE clips ADD COLUMN tags TEXT`);
        }

        try {
          await runQuery(`SELECT user_description FROM clips LIMIT 1`);
        } catch {
          log.info('[DB] Adding user_description to clips...');
          await runQuery(`ALTER TABLE clips ADD COLUMN user_description TEXT`);
        }

        await runQuery(`
            CREATE TABLE IF NOT EXISTS clip_groups (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                created_at INTEGER
            )
        `);

        await runQuery(`
            CREATE TABLE IF NOT EXISTS clip_group_items (
                id TEXT PRIMARY KEY,
                group_id TEXT NOT NULL,
                clip_id TEXT NOT NULL,
                created_at INTEGER,
                FOREIGN KEY (group_id) REFERENCES clip_groups(id) ON DELETE CASCADE,
                FOREIGN KEY (clip_id) REFERENCES clips(id) ON DELETE CASCADE
            )
        `);

        await runQuery(`
            CREATE TABLE IF NOT EXISTS note_versions (
                id TEXT PRIMARY KEY,
                note_id TEXT NOT NULL,
                title TEXT,
                content TEXT,
                tags TEXT,
                created_at TEXT,
                FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
            )
        `);

        try {
            const tasksCount = await getQuery('SELECT COUNT(*) as cnt FROM tasks');
            if (Number(tasksCount?.cnt) === 0) {
                const schedCount = await getQuery('SELECT COUNT(*) as cnt FROM schedules');
                if (Number(schedCount?.cnt) > 0) {
                    log.info('[DB] Migrating schedules → tasks...');
                    await runQuery(`
                        INSERT OR IGNORE INTO tasks (id, title, description, type, status, due_date, scheduled_date, source_type, source_id, source_title, tags, created_at, updated_at, completed_at)
                        SELECT id, title, content,
                               CASE WHEN category = 'event' THEN 'event' WHEN category = 'reminder' THEN 'reminder' ELSE 'task' END,
                               CASE WHEN status = 'completed' THEN 'done' WHEN status = 'cancelled' THEN 'done' ELSE 'inbox' END,
                               COALESCE(due_date, end_time),
                               start_time,
                               CASE WHEN source != '' THEN 'manual' ELSE 'manual' END,
                               COALESCE(memo_id, ''),
                               '',
                               '[]',
                               created_at, updated_at,
                               CASE WHEN status = 'completed' THEN updated_at ELSE NULL END
                        FROM schedules
                    `);
                }
            }
        } catch (migErr: any) {
            log.warn('[DB] schedules→tasks migration skipped:', migErr.message);
        }

        try {
            await runQuery(`SELECT tags FROM memos_fts LIMIT 1`);
        } catch (e) {
            log.info('[DB] memos_fts is missing tags column, dropping and recreating...');
            await runQuery(`DROP TABLE IF EXISTS memos_fts`);
            await runQuery(`DROP TRIGGER IF EXISTS memos_ai`);
            await runQuery(`DROP TRIGGER IF EXISTS memos_ad`);
            await runQuery(`DROP TRIGGER IF EXISTS memos_au`);
        }

        try {
            await runQuery(`
                CREATE VIRTUAL TABLE IF NOT EXISTS memos_fts USING fts5(
                    title,
                    content,
                    tags,
                    content='memos',
                    content_rowid='rowid'
                )
            `);
            log.info('[DB] FTS5 virtual table memos_fts created or already exists.');
        } catch (ftsErr: any) {
            log.warn('[DB] FTS5 table creation skipped:', ftsErr.message);
        }

        try {
            await runQuery(`
                CREATE VIRTUAL TABLE IF NOT EXISTS files_fts USING fts5(
                    file_name,
                    summary,
                    content='file_metadata',
                    content_rowid='rowid'
                )
            `);
            log.info('[DB] FTS5 virtual table files_fts created or already exists.');
        } catch (ftsErr: any) {
            log.warn('[DB] files_fts creation skipped:', ftsErr.message);
        }

        try {
            await runQuery(`
                CREATE VIRTUAL TABLE IF NOT EXISTS file_chunks_fts USING fts5(
                    tokenized_text,
                    content='file_chunks',
                    content_rowid='rowid'
                )
            `);
            log.info('[DB] FTS5 virtual table file_chunks_fts created or already exists.');
        } catch (ftsErr: any) {
            log.warn('[DB] file_chunks_fts creation skipped:', ftsErr.message);
        }

        try {
            const ftsInfo = await allQuery("PRAGMA table_info(file_chunks_fts)");
            const hasTokenizedCol = ftsInfo.some((col: any) => col.name === 'tokenized_text');
            if (!hasTokenizedCol) {
                log.info('[DB] Migrating file_chunks_fts from text to tokenized_text...');
                await runQuery('DROP TRIGGER IF EXISTS chunks_ai');
                await runQuery('DROP TRIGGER IF EXISTS chunks_ad');
                await runQuery('DROP TRIGGER IF EXISTS chunks_au');
                await runQuery('DROP TABLE IF EXISTS file_chunks_fts');
                await runQuery(`
                    CREATE VIRTUAL TABLE file_chunks_fts USING fts5(
                        tokenized_text,
                        content='file_chunks',
                        content_rowid='rowid'
                    )
                `);
                const chunkCount = await getQuery('SELECT COUNT(*) as cnt FROM file_chunks');
                if (Number(chunkCount?.cnt) > 0) {
                    log.info('[DB] Filling tokenized_text for existing chunks...');
                    const chunks = await allQuery('SELECT id, text FROM file_chunks');
                    for (const chunk of chunks) {
                        const tokenized = tokenizeChinese(chunk.text);
                        await runQuery('UPDATE file_chunks SET tokenized_text = ? WHERE id = ?', [tokenized, chunk.id]);
                    }
                    log.info('[DB] Rebuilding file_chunks_fts index...');
                    await runQuery('INSERT INTO file_chunks_fts(file_chunks_fts) VALUES("rebuild")');
                }
                log.info('[DB] file_chunks_fts migration complete.');
            }
        } catch (migErr: any) {
            log.warn('[DB] file_chunks_fts migration failed:', migErr.message);
        }

        try {
            const memoCount = await getQuery('SELECT COUNT(*) as cnt FROM memos');
            const ftsCount = await getQuery('SELECT COUNT(*) as cnt FROM memos_fts');
            if (Number(memoCount?.cnt) > 0 && (Number(ftsCount?.cnt) === 0 || Number(ftsCount?.cnt) < Number(memoCount?.cnt))) {
                log.info('[DB] Rebuilding memos_fts index...');
                await runQuery('INSERT INTO memos_fts(memos_fts) VALUES("rebuild")');
            }
        } catch {}

        try {
            const fileCount = await getQuery('SELECT COUNT(*) as cnt FROM file_metadata');
            const ftsFileCount = await getQuery('SELECT COUNT(*) as cnt FROM files_fts');
            if (Number(fileCount?.cnt) > 0 && (Number(ftsFileCount?.cnt) === 0 || Number(ftsFileCount?.cnt) < Number(fileCount?.cnt))) {
                log.info('[DB] Rebuilding files_fts index...');
                await runQuery('INSERT INTO files_fts(files_fts) VALUES("rebuild")');
            }
        } catch {}

        try {
            await runQuery(`
                CREATE TRIGGER IF NOT EXISTS memos_ai AFTER INSERT ON memos BEGIN
                    INSERT INTO memos_fts(rowid, title, content, tags) VALUES (new.rowid, new.title, new.content, new.tags);
                END
            `);
            await runQuery(`
                CREATE TRIGGER IF NOT EXISTS memos_ad AFTER DELETE ON memos BEGIN
                    INSERT INTO memos_fts(memos_fts, rowid, title, content, tags) VALUES('delete', old.rowid, old.title, old.content, old.tags);
                END
            `);
            await runQuery(`
                CREATE TRIGGER IF NOT EXISTS memos_au AFTER UPDATE ON memos BEGIN
                    INSERT INTO memos_fts(memos_fts, rowid, title, content, tags) VALUES('delete', old.rowid, old.title, old.content, old.tags);
                    INSERT INTO memos_fts(rowid, title, content, tags) VALUES (new.rowid, new.title, new.content, new.tags);
                END
            `);
        } catch (trigErr: any) {
            log.warn('[DB] FTS5 triggers creation skipped:', trigErr.message);
        }

        try {
            await runQuery(`
                CREATE TRIGGER IF NOT EXISTS files_ai AFTER INSERT ON file_metadata BEGIN
                    INSERT INTO files_fts(rowid, file_name, summary) VALUES (new.rowid, new.file_name, new.summary);
                END
            `);
            await runQuery(`
                CREATE TRIGGER IF NOT EXISTS files_ad AFTER DELETE ON file_metadata BEGIN
                    INSERT INTO files_fts(files_fts, rowid, file_name, summary) VALUES('delete', old.rowid, old.file_name, old.summary);
                END
            `);
            await runQuery(`
                CREATE TRIGGER IF NOT EXISTS files_au AFTER UPDATE ON file_metadata BEGIN
                    INSERT INTO files_fts(files_fts, rowid, file_name, summary) VALUES('delete', old.rowid, old.file_name, old.summary);
                    INSERT INTO files_fts(rowid, file_name, summary) VALUES (new.rowid, new.file_name, new.summary);
                END
            `);
        } catch (trigErr: any) {
            log.warn('[DB] files_fts triggers creation skipped:', trigErr.message);
        }

        try {
            await runQuery(`DROP TRIGGER IF EXISTS chunks_ai`);
            await runQuery(`DROP TRIGGER IF EXISTS chunks_ad`);
            await runQuery(`DROP TRIGGER IF EXISTS chunks_au`);
            await runQuery(`
                CREATE TRIGGER chunks_ai AFTER INSERT ON file_chunks BEGIN
                    INSERT INTO file_chunks_fts(rowid, tokenized_text) VALUES (new.rowid, COALESCE(new.tokenized_text, new.text));
                END
            `);
            await runQuery(`
                CREATE TRIGGER chunks_ad AFTER DELETE ON file_chunks BEGIN
                    INSERT INTO file_chunks_fts(file_chunks_fts, rowid, tokenized_text) VALUES('delete', old.rowid, COALESCE(old.tokenized_text, old.text));
                END
            `);
            await runQuery(`
                CREATE TRIGGER chunks_au AFTER UPDATE ON file_chunks BEGIN
                    INSERT INTO file_chunks_fts(file_chunks_fts, rowid, tokenized_text) VALUES('delete', old.rowid, COALESCE(old.tokenized_text, old.text));
                    INSERT INTO file_chunks_fts(rowid, tokenized_text) VALUES (new.rowid, COALESCE(new.tokenized_text, new.text));
                END
            `);
        } catch (trigErr: any) {
            log.warn('[DB] file_chunks_fts triggers creation failed:', trigErr.message);
        }

        rebuildChunkTokenizedText().catch((err: any) => {
            log.warn('[DB] Background tokenized_text rebuild failed:', err.message);
        });

        await runQuery(`
            CREATE TABLE IF NOT EXISTS mcp_servers (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                transport TEXT DEFAULT 'stdio',
                command TEXT,
                args TEXT DEFAULT '[]',
                env TEXT DEFAULT '{}',
                url TEXT,
                enabled INTEGER DEFAULT 1,
                auto_connect INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        try { await runQuery(`ALTER TABLE mcp_servers ADD COLUMN transport TEXT DEFAULT 'stdio'`) } catch {}
        try { await runQuery(`ALTER TABLE mcp_servers ADD COLUMN url TEXT`) } catch {}

        try {
            await runQuery(`SELECT auto_connect FROM mcp_servers LIMIT 1`);
        } catch (e) {
            log.info('[DB] Adding auto_connect to mcp_servers...');
            await runQuery(`ALTER TABLE mcp_servers ADD COLUMN auto_connect INTEGER DEFAULT 1`);
        }

        try {
            const mcpCount = await getQuery('SELECT COUNT(*) as cnt FROM mcp_servers');
            if (Number(mcpCount?.cnt) === 0) {
                await runQuery(`
                    INSERT OR IGNORE INTO mcp_servers (id, name, command, args, env, enabled, auto_connect)
                    VALUES ('trends-hub', 'Trends Hub 热榜', 'npx', '["-y", "mcp-trends-hub@1.6.2"]', '{}', 1, 1)
                `);
            }
        } catch (mcpErr: any) {
            log.warn('[DB] mcp_servers default insert skipped:', mcpErr.message);
        }

        const memoColumns = await allQuery(`PRAGMA table_info(memos)`);
        const memoColumnNames = new Set(memoColumns.map((col: any) => String(col.name)));
        const hasFolderColumn = memoColumnNames.has('folder');
        const hasPinnedColumn = memoColumnNames.has('pinned');
        const hasImagesColumn = memoColumnNames.has('images');

        if (!hasPinnedColumn) {
            log.info('[DB] Adding pinned to memos...');
            await runQuery(`ALTER TABLE memos ADD COLUMN pinned INTEGER DEFAULT 0`);
        }

        if (!hasImagesColumn) {
            log.info('[DB] Adding images to memos...');
            await runQuery(`ALTER TABLE memos ADD COLUMN images TEXT DEFAULT '[]'`);
        }

        if (hasFolderColumn) {
            log.info('[DB] Removing deprecated folder column from memos...');
            await runQuery(`DROP TRIGGER IF EXISTS memos_ai`);
            await runQuery(`DROP TRIGGER IF EXISTS memos_ad`);
            await runQuery(`DROP TRIGGER IF EXISTS memos_au`);
            await runQuery(`ALTER TABLE memos RENAME TO memos_legacy`);
            await runQuery(`
                CREATE TABLE memos (
                    id TEXT PRIMARY KEY,
                    title TEXT,
                    content TEXT,
                    tags TEXT,
                    project TEXT,
                    category TEXT,
                    pinned INTEGER DEFAULT 0,
                    images TEXT DEFAULT '[]',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            const pinnedExpr = hasPinnedColumn ? 'COALESCE(pinned, 0)' : '0';
            const imagesExpr = hasImagesColumn ? `COALESCE(images, '[]')` : `'[]'`;

            await runQuery(`
                INSERT INTO memos (id, title, content, tags, project, category, pinned, images, created_at, updated_at)
                SELECT id, title, content, tags, project, category, ${pinnedExpr}, ${imagesExpr}, created_at, updated_at
                FROM memos_legacy
            `);
            await runQuery(`DROP TABLE memos_legacy`);
            await runQuery(`DROP TABLE IF EXISTS memos_fts`);
            await runQuery(`
                CREATE VIRTUAL TABLE IF NOT EXISTS memos_fts USING fts5(
                    title,
                    content,
                    tags,
                    content='memos',
                    content_rowid='rowid'
                )
            `);
            await runQuery(`INSERT INTO memos_fts(memos_fts) VALUES("rebuild")`);
            await runQuery(`
                CREATE TRIGGER IF NOT EXISTS memos_ai AFTER INSERT ON memos BEGIN
                    INSERT INTO memos_fts(rowid, title, content, tags) VALUES (new.rowid, new.title, new.content, new.tags);
                END
            `);
            await runQuery(`
                CREATE TRIGGER IF NOT EXISTS memos_ad AFTER DELETE ON memos BEGIN
                    INSERT INTO memos_fts(memos_fts, rowid, title, content, tags) VALUES('delete', old.rowid, old.title, old.content, old.tags);
                END
            `);
            await runQuery(`
                CREATE TRIGGER IF NOT EXISTS memos_au AFTER UPDATE ON memos BEGIN
                    INSERT INTO memos_fts(memos_fts, rowid, title, content, tags) VALUES('delete', old.rowid, old.title, old.content, old.tags);
                    INSERT INTO memos_fts(rowid, title, content, tags) VALUES (new.rowid, new.title, new.content, new.tags);
                END
            `);
        }

        await runQuery(`
            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await runQuery(`
            CREATE TABLE IF NOT EXISTS sync_config (
                id INTEGER PRIMARY KEY DEFAULT 1,
                type TEXT DEFAULT 'none',
                config TEXT DEFAULT '{}',
                auto_sync INTEGER DEFAULT 0,
                last_sync DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await runQuery(`
            CREATE TABLE IF NOT EXISTS reference_folders (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                path TEXT NOT NULL,
                recursive INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        try { await runQuery('SELECT tags FROM tasks LIMIT 1') } catch { await runQuery("ALTER TABLE tasks ADD COLUMN tags TEXT DEFAULT '[]'") }

        await runQuery(`
            CREATE TABLE IF NOT EXISTS project_items (
                project_name TEXT NOT NULL,
                item_type TEXT NOT NULL,
                item_id TEXT NOT NULL,
                PRIMARY KEY (project_name, item_type, item_id)
            )
        `);

        try {
            await runQuery('ALTER TABLE project_items ADD COLUMN _migrated INTEGER DEFAULT 0');
            const notesWithProject = await allQuery("SELECT id, project FROM notes WHERE project IS NOT NULL AND project != ''");
            if (notesWithProject.length > 0) {
                for (const note of notesWithProject) {
                    await runQuery(
                        'INSERT OR IGNORE INTO project_items (project_name, item_type, item_id) VALUES (?, ?, ?)',
                        [note.project, 'note', note.id]
                    );
                }
                log.info(`[DB] Migrated ${notesWithProject.length} notes to project_items`);
            }
            await runQuery('UPDATE project_items SET _migrated = 1');
        } catch {}

        await runQuery(`
            CREATE TABLE IF NOT EXISTS knowledge_digest (
                id TEXT PRIMARY KEY,
                source_id TEXT NOT NULL,
                source_type TEXT NOT NULL DEFAULT 'file',
                source_title TEXT NOT NULL,
                category TEXT DEFAULT '',
                key_facts TEXT NOT NULL DEFAULT '[]',
                created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
            )
        `);

        await runQuery(`
            CREATE INDEX IF NOT EXISTS idx_knowledge_digest_source_id ON knowledge_digest(source_id)
        `);

        await runQuery(`
            CREATE INDEX IF NOT EXISTS idx_knowledge_digest_category ON knowledge_digest(category)
        `);

        await runQuery(`
            CREATE TABLE IF NOT EXISTS digest_metadata (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
        `);

        // === Phase A: Merge documents → notes, drop documents table ===
        try {
            const docsTable = await getQuery("SELECT name FROM sqlite_master WHERE type='table' AND name='documents'");
            if (docsTable) {
                const docsCount = await getQuery('SELECT COUNT(*) as cnt FROM documents');
                if (Number(docsCount?.cnt) > 0) {
                    log.info('[DB] Phase A: Merging documents into notes...');
                    await runQuery(`
                        INSERT OR IGNORE INTO notes (id, type, title, content, tags, category, project, source_type, source_id, created_at, updated_at)
                        SELECT id, 'document', title, content, tags, category, project, COALESCE(source_type, 'manual'), COALESCE(source_id, ''), created_at, updated_at
                        FROM documents
                    `);
                }
                await runQuery('DROP TABLE IF EXISTS documents');
                log.info('[DB] Phase A: documents table merged and dropped.');
            }
        } catch (e: any) { log.warn('[DB] Phase A: documents merge skipped:', e.message); }

        // === Phase A: Migrate FTS5 from memos to notes ===
        try {
            const memosFtsExist = await getQuery("SELECT name FROM sqlite_master WHERE type='table' AND name='memos_fts'");
            if (memosFtsExist) {
                await runQuery('DROP TRIGGER IF EXISTS memos_ai');
                await runQuery('DROP TRIGGER IF EXISTS memos_ad');
                await runQuery('DROP TRIGGER IF EXISTS memos_au');
                await runQuery('DROP TABLE IF EXISTS memos_fts');
                log.info('[DB] Phase A: Dropped legacy memos_fts and triggers.');
            }
        } catch (e: any) { log.warn('[DB] Phase A: memos_fts cleanup skipped:', e.message); }

        try {
            await runQuery(`
                CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
                    title, content, tags,
                    content='notes',
                    content_rowid='rowid'
                )
            `);
            await runQuery(`CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
                INSERT INTO notes_fts(rowid, title, content, tags) VALUES (new.rowid, new.title, new.content, new.tags);
            END`);
            await runQuery(`CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
                INSERT INTO notes_fts(notes_fts, rowid, title, content, tags) VALUES('delete', old.rowid, old.title, old.content, old.tags);
            END`);
            await runQuery(`CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
                INSERT INTO notes_fts(notes_fts, rowid, title, content, tags) VALUES('delete', old.rowid, old.title, old.content, old.tags);
                INSERT INTO notes_fts(rowid, title, content, tags) VALUES (new.rowid, new.title, new.content, new.tags);
            END`);
            const noteCount = await getQuery('SELECT COUNT(*) as cnt FROM notes');
            if (Number(noteCount?.cnt) > 0) {
                log.info('[DB] Phase A: Rebuilding notes_fts index...');
                await runQuery('INSERT INTO notes_fts(notes_fts) VALUES("rebuild")');
            }
            log.info('[DB] Phase A: notes_fts created and populated.');
        } catch (e: any) { log.warn('[DB] Phase A: notes_fts creation skipped:', e.message); }

        // === Phase B: FTS5 for clips ===
        try {
            await runQuery(`
                CREATE VIRTUAL TABLE IF NOT EXISTS clips_fts USING fts5(
                    content, ocr_text, ai_description, tags,
                    content='clips',
                    content_rowid='rowid'
                )
            `);
            await runQuery(`CREATE TRIGGER IF NOT EXISTS clips_ai AFTER INSERT ON clips BEGIN
                INSERT INTO clips_fts(rowid, content, ocr_text, ai_description, tags) VALUES (new.rowid, new.content, new.ocr_text, new.ai_description, new.tags);
            END`);
            await runQuery(`CREATE TRIGGER IF NOT EXISTS clips_ad AFTER DELETE ON clips BEGIN
                INSERT INTO clips_fts(clips_fts, rowid, content, ocr_text, ai_description, tags) VALUES('delete', old.rowid, old.content, old.ocr_text, old.ai_description, old.tags);
            END`);
            await runQuery(`CREATE TRIGGER IF NOT EXISTS clips_au AFTER UPDATE ON clips BEGIN
                INSERT INTO clips_fts(clips_fts, rowid, content, ocr_text, ai_description, tags) VALUES('delete', old.rowid, old.content, old.ocr_text, old.ai_description, old.tags);
                INSERT INTO clips_fts(rowid, content, ocr_text, ai_description, tags) VALUES (new.rowid, new.content, new.ocr_text, new.ai_description, new.tags);
            END`);
            const clipCount = await getQuery('SELECT COUNT(*) as cnt FROM clips');
            if (Number(clipCount?.cnt) > 0) {
                log.info('[DB] Phase B: Rebuilding clips_fts index...');
                await runQuery('INSERT INTO clips_fts(clips_fts) VALUES("rebuild")');
            }
            log.info('[DB] Phase B: clips_fts created and populated.');
        } catch (e: any) { log.warn('[DB] Phase B: clips_fts creation skipped:', e.message); }

        // === Phase B: FTS5 for tasks ===
        try {
            await runQuery(`
                CREATE VIRTUAL TABLE IF NOT EXISTS tasks_fts USING fts5(
                    title, description, tags,
                    content='tasks',
                    content_rowid='rowid'
                )
            `);
            await runQuery(`CREATE TRIGGER IF NOT EXISTS tasks_ai AFTER INSERT ON tasks BEGIN
                INSERT INTO tasks_fts(rowid, title, description, tags) VALUES (new.rowid, new.title, new.description, new.tags);
            END`);
            await runQuery(`CREATE TRIGGER IF NOT EXISTS tasks_ad AFTER DELETE ON tasks BEGIN
                INSERT INTO tasks_fts(tasks_fts, rowid, title, description, tags) VALUES('delete', old.rowid, old.title, old.description, old.tags);
            END`);
            await runQuery(`CREATE TRIGGER IF NOT EXISTS tasks_au AFTER UPDATE ON tasks BEGIN
                INSERT INTO tasks_fts(tasks_fts, rowid, title, description, tags) VALUES('delete', old.rowid, old.title, old.description, old.tags);
                INSERT INTO tasks_fts(rowid, title, description, tags) VALUES (new.rowid, new.title, new.description, new.tags);
            END`);
            const taskCount = await getQuery('SELECT COUNT(*) as cnt FROM tasks');
            if (Number(taskCount?.cnt) > 0) {
                log.info('[DB] Phase B: Rebuilding tasks_fts index...');
                await runQuery('INSERT INTO tasks_fts(tasks_fts) VALUES("rebuild")');
            }
            log.info('[DB] Phase B: tasks_fts created and populated.');
        } catch (e: any) { log.warn('[DB] Phase B: tasks_fts creation skipped:', e.message); }

        // === Phase B: FTS5 for chat_messages ===
        try {
            await runQuery(`
                CREATE VIRTUAL TABLE IF NOT EXISTS chat_messages_fts USING fts5(
                    content,
                    content='chat_messages',
                    content_rowid='rowid'
                )
            `);
            await runQuery(`CREATE TRIGGER IF NOT EXISTS chat_messages_ai AFTER INSERT ON chat_messages BEGIN
                INSERT INTO chat_messages_fts(rowid, content) VALUES (new.rowid, new.content);
            END`);
            await runQuery(`CREATE TRIGGER IF NOT EXISTS chat_messages_ad AFTER DELETE ON chat_messages BEGIN
                INSERT INTO chat_messages_fts(chat_messages_fts, rowid, content) VALUES('delete', old.rowid, old.content);
            END`);
            await runQuery(`CREATE TRIGGER IF NOT EXISTS chat_messages_au AFTER UPDATE ON chat_messages BEGIN
                INSERT INTO chat_messages_fts(chat_messages_fts, rowid, content) VALUES('delete', old.rowid, old.content);
                INSERT INTO chat_messages_fts(rowid, content) VALUES (new.rowid, new.content);
            END`);
            const msgCount = await getQuery('SELECT COUNT(*) as cnt FROM chat_messages');
            if (Number(msgCount?.cnt) > 0) {
                log.info('[DB] Phase B: Rebuilding chat_messages_fts index...');
                await runQuery('INSERT INTO chat_messages_fts(chat_messages_fts) VALUES("rebuild")');
            }
            log.info('[DB] Phase B: chat_messages_fts created and populated.');
        } catch (e: any) { log.warn('[DB] Phase B: chat_messages_fts creation skipped:', e.message); }

        log.info('[DB] Database initialization complete.');

        // === P0-#3: projects 元数据表（项目生命周期入口） ──
        await runQuery(`
            CREATE TABLE IF NOT EXISTS projects (
                name TEXT PRIMARY KEY,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        `);
        });
    } catch (err) {
        log.error('[DB] Error during initialization:', err);
        throw err;
    }
}
