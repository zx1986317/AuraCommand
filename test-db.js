const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'test.db');

try {
    const db = new Database(dbPath);
    console.log('Successfully connected to SQLite database');
    db.prepare('CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY, name TEXT)').run();
    db.prepare('INSERT INTO test (name) VALUES (?)').run('test-user');
    const row = db.prepare('SELECT * FROM test WHERE name = ?').get('test-user');
    console.log('Successfully inserted and retrieved data:', row);
    db.close();
    console.log('Database connection closed');
    process.exit(0);
} catch (err) {
    console.error('Failed to connect to SQLite:', err);
    process.exit(1);
}
