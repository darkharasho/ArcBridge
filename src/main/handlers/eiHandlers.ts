import { ipcMain, BrowserWindow } from 'electron';
import { EiManager, EiParserSettings } from '../eiParser';

export interface EiHandlerOptions {
    store: any;
    getWindow: () => BrowserWindow | null;
    getEiManager: () => EiManager;
}

export function registerEiHandlers(opts: EiHandlerOptions) {
    const { store, getWindow, getEiManager } = opts;

    ipcMain.handle('ei:get-status', () => {
        const mgr = getEiManager();
        return { ...mgr.getStatus(), installing: false, error: null };
    });

    ipcMain.handle('ei:install', async () => {
        const mgr = getEiManager();
        const win = getWindow();
        mgr.setProgressCallback((progress) => {
            win?.webContents.send('ei:download-progress', progress);
        });
        try {
            await mgr.install();
            const status = { ...mgr.getStatus(), installing: false, error: null };
            win?.webContents.send('ei:status-changed', status);
            return status;
        } catch (err: any) {
            const status = { ...mgr.getStatus(), installing: false, error: err?.message || 'Install failed' };
            win?.webContents.send('ei:status-changed', status);
            throw err;
        }
    });

    ipcMain.handle('ei:update', async () => {
        const mgr = getEiManager();
        const win = getWindow();
        mgr.setProgressCallback((progress) => {
            win?.webContents.send('ei:download-progress', progress);
        });
        try {
            await mgr.installCli();
            const status = { ...mgr.getStatus(), installing: false, error: null };
            win?.webContents.send('ei:status-changed', status);
            return status;
        } catch (err: any) {
            const status = { ...mgr.getStatus(), installing: false, error: err?.message || 'Update failed' };
            win?.webContents.send('ei:status-changed', status);
            throw err;
        }
    });

    ipcMain.handle('ei:reinstall', async () => {
        const mgr = getEiManager();
        const win = getWindow();
        mgr.setProgressCallback((progress) => {
            win?.webContents.send('ei:download-progress', progress);
        });
        try {
            await mgr.reinstall();
            const status = { ...mgr.getStatus(), installing: false, error: null };
            win?.webContents.send('ei:status-changed', status);
            return status;
        } catch (err: any) {
            const status = { ...mgr.getStatus(), installing: false, error: err?.message || 'Reinstall failed' };
            win?.webContents.send('ei:status-changed', status);
            throw err;
        }
    });

    ipcMain.handle('ei:uninstall', () => {
        const mgr = getEiManager();
        const win = getWindow();
        mgr.uninstall();
        const status = { ...mgr.getStatus(), installing: false, error: null };
        win?.webContents.send('ei:status-changed', status);
        return status;
    });

    ipcMain.handle('ei:check-update', async () => {
        const mgr = getEiManager();
        const updateAvailable = await mgr.checkForUpdate();
        return { updateAvailable };
    });

    ipcMain.handle('ei:get-settings', () => {
        const mgr = getEiManager();
        return mgr.getSettings();
    });

    ipcMain.on('ei:save-settings', (_event, settings: Partial<EiParserSettings>) => {
        const mgr = getEiManager();
        const current = mgr.getSettings();
        const merged: EiParserSettings = { ...current, ...settings };
        mgr.setSettings(merged);
        store.set('eiParserSettings', merged);
    });

    ipcMain.handle('ei:get-auto-manage', () => {
        return store.get('autoManageEi', true);
    });

    ipcMain.on('ei:set-auto-manage', (_event, enabled: boolean) => {
        store.set('autoManageEi', enabled);
    });
}
