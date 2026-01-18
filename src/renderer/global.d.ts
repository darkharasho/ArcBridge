export interface IElectronAPI {
    selectDirectory: () => Promise<string | null>;
    startWatching: (path: string) => void;
    onLogDetected: (callback: (path: string) => void) => () => void;
    onUploadComplete: (callback: (data: any) => void) => () => void;
    onUploadStatus: (callback: (data: any) => void) => () => void;
    setDiscordWebhook: (url: string) => void;
    windowControl: (action: 'minimize' | 'maximize' | 'close') => void;
    getSettings: () => Promise<{ logDirectory: string | null, discordWebhookUrl: string | null }>;
    manualUpload: (path: string) => void;
    openExternal: (url: string) => Promise<{ success: boolean, error?: string }>;
}

declare global {
    interface Window {
        electronAPI: IElectronAPI;
    }

    interface ILogData {
        id: string;
        permalink: string;
        filePath: string;
        status?: 'uploading' | 'discord' | 'success' | 'error';
        error?: string;
        details?: {
            fightName: string;
            encounterDuration: string;
            success: boolean;
            players: IPlayer[];
            uploadTime: number;
            [key: string]: any;
        };
    }

    interface IPlayer {
        display_name: string;
        character_name: string;
        profession: string;
        group: number;
    }
}
