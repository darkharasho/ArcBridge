import chokidar from 'chokidar';
import path from 'path';
import fs from 'fs';
import { EventEmitter } from 'events';

export class LogWatcher extends EventEmitter {
    private watcher: chokidar.FSWatcher | null = null;

    constructor() {
        super();
    }

    public start(logDirectory: string): void {
        if (this.watcher) {
            this.watcher.close();
        }

        // ... (rest of the logic)

        console.log(`Starting watcher on: ${logDirectory}`);

        if (!fs.existsSync(logDirectory)) {
            console.error(`Directory does not exist: ${logDirectory}`);
            return;
        }

        this.watcher = chokidar.watch(logDirectory, {
            persistent: true,
            ignoreInitial: true, // Don't upload existing logs on startup for now
            depth: 5, // Handle subdirectories (boss names)
            awaitWriteFinish: {
                stabilityThreshold: 2000,
                pollInterval: 100
            }
        });

        this.watcher.on('add', (filePath) => {
            if (path.extname(filePath) === '.evtc' || path.extname(filePath) === '.zevtc') {
                console.log(`New log detected: ${filePath}`);
                this.emit('log-detected', filePath);
            }
        });

        this.watcher.on('error', (error) => {
            console.error(`Watcher error: ${error}`);
        });
    }

    public stop(): void {
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
        }
    }
}
