import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
    selectDirectory: () => ipcRenderer.invoke('select-directory'),
    startWatching: (path: string) => ipcRenderer.send('start-watching', path),
    onLogDetected: (callback: (path: string) => void) => {
        ipcRenderer.on('log-detected', (_event, value) => callback(value))
        return () => {
            // Cleanup if needed, though ipcRenderer.on returns nothing
            ipcRenderer.removeAllListeners('log-detected')
        }
    },
    onUploadComplete: (callback: (data: any) => void) => {
        ipcRenderer.on('upload-complete', (_event, value) => callback(value))
        return () => {
            ipcRenderer.removeAllListeners('upload-complete')
        }
    },
    onUploadStatus: (callback: (data: any) => void) => {
        ipcRenderer.on('upload-status', (_event, value) => callback(value))
        return () => {
            ipcRenderer.removeAllListeners('upload-status')
        }
    },
    setDiscordWebhook: (url: string) => ipcRenderer.send('set-discord-webhook', url),
    windowControl: (action: 'minimize' | 'maximize' | 'close') => ipcRenderer.send('window-control', action),
    getSettings: () => ipcRenderer.invoke('get-settings'),
    manualUpload: (path: string) => ipcRenderer.send('manual-upload', path),
    saveSettings: (settings: any) => ipcRenderer.send('save-settings', settings),
    onRequestScreenshot: (callback: (data: any) => void) => {
        ipcRenderer.on('request-screenshot', (_event, value) => callback(value))
        return () => {
            ipcRenderer.removeAllListeners('request-screenshot')
        }
    },
    openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
    sendScreenshot: (id: string, buffer: Uint8Array) => ipcRenderer.send('send-screenshot', id, buffer)
})
