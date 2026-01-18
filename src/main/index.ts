import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import path from 'node:path'
import { LogWatcher } from './watcher'
import { Uploader } from './uploader'
import { DiscordNotifier } from './discord';

process.env.DIST = path.join(__dirname, '../../') // Points to project root from dist-electron/main/
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, 'public')

let win: BrowserWindow | null
let watcher: LogWatcher | null = null
let uploader: Uploader | null = null
let discord: DiscordNotifier | null = null

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'] || 'http://localhost:5173';

function createWindow() {
    const Store = require('electron-store');
    const store = new Store();
    const bounds = store.get('windowBounds') as { width: number, height: number } | undefined;

    win = new BrowserWindow({
        icon: path.join(process.env.VITE_PUBLIC || '', 'icon.png'),
        webPreferences: {
            preload: path.join(__dirname, '../preload/index.js'),
        },
        width: bounds ? bounds.width : 1200, // Default wider as requested
        height: bounds ? bounds.height : 800,
        frame: false, // For custom title bar
        titleBarStyle: 'hidden',
        backgroundColor: '#000000',
    })

    win.on('resize', () => {
        if (!win) return;
        const [width, height] = win.getSize();
        store.set('windowBounds', { width, height });
    });

    watcher = new LogWatcher();
    uploader = new Uploader();
    discord = new DiscordNotifier();

    watcher.on('log-detected', async (filePath: string) => {
        const fileId = path.basename(filePath);

        // Send uploading status
        win?.webContents.send('upload-status', { id: fileId, filePath, status: 'uploading' });

        // Perform upload
        const result = await uploader?.upload(filePath);

        if (result && !result.error) {
            console.log(`[Main] Upload successful: ${result.permalink}. Fetching details...`);

            // Fetch detailed JSON
            let jsonDetails = await uploader?.fetchDetailedJson(result.permalink);

            if (!jsonDetails || jsonDetails.error) {
                console.log('[Main] Retrying JSON fetch in 2 seconds...');
                await new Promise(resolve => setTimeout(resolve, 2000));
                jsonDetails = await uploader?.fetchDetailedJson(result.permalink);
            }

            console.log(`[Main] detailed JSON present: ${!!jsonDetails}, sending to Discord...`);

            // Send discord status
            win?.webContents.send('upload-status', {
                id: fileId,
                filePath,
                status: 'discord',
                permalink: result.permalink,
                uploadTime: result.uploadTime,
                encounterDuration: result.encounterDuration,
                fightName: result.fightName
            });

            // Send to Discord
            await discord?.sendLog({ ...result, filePath }, jsonDetails);

            // Send success status with complete data
            win?.webContents.send('upload-complete', {
                ...result,
                filePath,
                status: 'success',
                details: jsonDetails
            });
        } else {
            // Send error status
            win?.webContents.send('upload-complete', {
                ...result,
                filePath,
                status: 'error'
            });
        }
    });

    // Test active push message to asserting that it is working
    win.webContents.on('did-finish-load', () => {
        win?.webContents.send('main-process-message', (new Date).toLocaleString())
    })

    if (!app.isPackaged) {
        win.loadURL(VITE_DEV_SERVER_URL)
    } else {
        win.loadFile(path.join(process.env.DIST || '', 'dist-react/index.html'))
    }
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
        win = null
        watcher?.stop()
    }
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})

app.whenReady().then(() => {

    const Store = require('electron-store');
    const store = new Store();

    // Initialize/Load settings
    ipcMain.handle('get-settings', () => {
        return {
            logDirectory: store.get('logDirectory', null),
            discordWebhookUrl: store.get('discordWebhookUrl', null)
        };
    });

    ipcMain.on('save-settings', (_event, settings: { logDirectory?: string, discordWebhookUrl?: string }) => {
        if (settings.logDirectory !== undefined) {
            store.set('logDirectory', settings.logDirectory);
            if (settings.logDirectory) watcher?.start(settings.logDirectory);
        }
        if (settings.discordWebhookUrl !== undefined) {
            store.set('discordWebhookUrl', settings.discordWebhookUrl);
            discord?.setWebhookUrl(settings.discordWebhookUrl);
        }
    });

    ipcMain.handle('select-directory', async () => {
        if (!win) return null;
        const result = await dialog.showOpenDialog(win, {
            properties: ['openDirectory']
        });
        if (!result.canceled && result.filePaths.length > 0) {
            return result.filePaths[0];
        }
        return null;
    });

    ipcMain.on('start-watching', (_event, dirPath: string) => {
        watcher?.start(dirPath);
        store.set('logDirectory', dirPath); // Auto-save on manual start
    });

    ipcMain.on('set-discord-webhook', (_event, url: string) => {
        discord?.setWebhookUrl(url);
        store.set('discordWebhookUrl', url); // Auto-save on manual set
    });

    ipcMain.on('manual-upload', (_event, filePath: string) => {
        console.log(`[Main] Manual upload requested for: ${filePath}`);
        watcher?.emit('log-detected', filePath);
    });

    ipcMain.on('window-control', (_event, action: 'minimize' | 'maximize' | 'close') => {
        if (!win) return;
        switch (action) {
            case 'minimize':
                win.minimize();
                break;
            case 'maximize':
                if (win.isMaximized()) {
                    win.unmaximize();
                } else {
                    win.maximize();
                }
                break;
            case 'close':
                win.close();
                break;
        }
    });

    ipcMain.handle('open-external', async (_event, url: string) => {
        console.log(`[Main] Opening external URL: ${url}`);
        try {
            await shell.openExternal(url);
            return { success: true };
        } catch (err: any) {
            console.error(`[Main] Failed to open external URL: ${err}`);
            return { success: false, error: err.message };
        }
    });

    createWindow()
})
