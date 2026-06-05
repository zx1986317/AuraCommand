const { app, BrowserWindow } = require('electron');
const Database = require('better-sqlite3');
app.whenReady().then(() => {
    try {
        const db = new Database(':memory:');
        console.log('Database connected successfully in Electron');
        const win = new BrowserWindow({ width: 400, height: 300 });
        win.loadURL('data:text/html,<h1>Database OK</h1>');
        setTimeout(() => app.quit(), 3000);
    } catch (e) {
        console.error('Failed to connect database in Electron:', e);
        app.quit();
    }
});
