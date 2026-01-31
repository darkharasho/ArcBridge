import { Worker } from 'worker_threads';
import path from 'path';
import type { EiCliLoadResult, EiCliSettings } from '../../main/eiCli';

type EiCliWorkerRequest =
    | {
        type: 'PARSE_EI';
        id: string;
        payload: {
            filePath: string;
            cacheKey?: string | null;
            settings: EiCliSettings;
            dpsReportToken?: string | null;
        };
    }
    | { type: 'SHUTDOWN' };

type EiCliWorkerResponse =
    | { type: 'EI_RESULT'; id: string; result: EiCliLoadResult }
    | { type: 'ERROR'; id: string; error: string; stack?: string }
    | { type: 'READY' }
    | { type: 'SHUTDOWN_ACK' };

interface EiCliTask {
    id: string;
    request: EiCliWorkerRequest;
    resolve: (result: EiCliLoadResult) => void;
    reject: (error: Error) => void;
}

interface EiCliWorkerPoolConfig {
    taskTimeoutMs: number;
    userDataPath: string;
}

let taskIdCounter = 0;
const generateTaskId = () => `ei_${++taskIdCounter}_${Date.now()}`;

export class EiCliWorkerPool {
    private worker: Worker | null = null;
    private currentTask: EiCliTask | null = null;
    private taskQueue: EiCliTask[] = [];
    private taskTimer: ReturnType<typeof setTimeout> | null = null;
    private workerPath: string;
    private config: EiCliWorkerPoolConfig;
    private shuttingDown = false;

    constructor(config: EiCliWorkerPoolConfig) {
        this.config = config;
        this.workerPath = path.join(__dirname, 'eiCliWorker.js');
    }

    async init(): Promise<void> {
        if (this.worker) return;
        await this.spawnWorker();
    }

    private async spawnWorker(): Promise<void> {
        const worker = new Worker(this.workerPath, {
            workerData: {
                userDataPath: this.config.userDataPath
            }
        });
        this.worker = worker;

        worker.on('message', (response: EiCliWorkerResponse) => {
            this.handleWorkerMessage(response);
        });

        worker.on('error', (error) => {
            console.error('[EiCliWorkerPool] Worker error:', error);
            this.handleWorkerFailure(error);
        });

        worker.on('exit', (code) => {
            if (this.taskTimer) {
                clearTimeout(this.taskTimer);
                this.taskTimer = null;
            }
            if (this.currentTask) {
                this.currentTask.reject(new Error(`EI worker exited with code ${code ?? 'unknown'}`));
                this.currentTask = null;
            }
            this.worker = null;
            if (!this.shuttingDown) {
                this.spawnWorker().catch((err) => {
                    console.error('[EiCliWorkerPool] Failed to respawn worker:', err);
                });
            }
        });

        await new Promise<void>((resolve) => {
            const readyHandler = (msg: EiCliWorkerResponse) => {
                if (msg.type === 'READY') {
                    worker.off('message', readyHandler);
                    resolve();
                }
            };
            worker.on('message', readyHandler);
        });
    }

    private handleWorkerMessage(response: EiCliWorkerResponse): void {
        if (!this.currentTask) return;
        if (response.type === 'READY' || response.type === 'SHUTDOWN_ACK') return;
        if (response.id !== this.currentTask.id) return;

        const task = this.currentTask;
        this.currentTask = null;
        this.clearTaskTimer();

        if (response.type === 'EI_RESULT') {
            task.resolve(response.result);
        } else if (response.type === 'ERROR') {
            const error = new Error(response.error);
            if (response.stack) error.stack = response.stack;
            task.reject(error);
        }

        this.processQueue();
    }

    private handleWorkerFailure(error: Error): void {
        if (this.currentTask) {
            this.currentTask.reject(error);
            this.currentTask = null;
        }
        this.clearTaskTimer();
        this.worker?.terminate().catch(() => { });
        this.worker = null;
    }

    private clearTaskTimer(): void {
        if (this.taskTimer) {
            clearTimeout(this.taskTimer);
            this.taskTimer = null;
        }
    }

    private scheduleTimeout(taskId: string): void {
        if (this.config.taskTimeoutMs <= 0) return;
        this.clearTaskTimer();
        this.taskTimer = setTimeout(() => {
            if (!this.currentTask || this.currentTask.id !== taskId) return;
            console.warn(`[EiCliWorkerPool] Task ${taskId} timed out; terminating worker`);
            const task = this.currentTask;
            this.currentTask = null;
            task.reject(new Error(`EI task ${taskId} timed out after ${this.config.taskTimeoutMs}ms`));
            this.worker?.terminate().catch(() => { });
            this.worker = null;
            if (!this.shuttingDown) {
                this.spawnWorker().catch((err) => {
                    console.error('[EiCliWorkerPool] Failed to respawn worker:', err);
                });
            }
            this.processQueue();
        }, this.config.taskTimeoutMs);
    }

    private processQueue(): void {
        if (this.currentTask || this.taskQueue.length === 0) return;
        if (!this.worker) return;

        const task = this.taskQueue.shift();
        if (!task) return;

        this.currentTask = task;
        this.scheduleTimeout(task.id);
        this.worker.postMessage(task.request);
    }

    parseLog(payload: { filePath: string; cacheKey?: string | null; settings: EiCliSettings; dpsReportToken?: string | null }): Promise<EiCliLoadResult> {
        return new Promise((resolve, reject) => {
            const id = generateTaskId();
            const request: EiCliWorkerRequest = { type: 'PARSE_EI', id, payload };
            this.taskQueue.push({ id, request, resolve, reject });
            this.processQueue();
        });
    }

    async shutdown(): Promise<void> {
        this.shuttingDown = true;
        this.clearTaskTimer();

        if (this.currentTask) {
            this.currentTask.reject(new Error('EI worker pool shutting down'));
            this.currentTask = null;
        }

        for (const task of this.taskQueue) {
            task.reject(new Error('EI worker pool shutting down'));
        }
        this.taskQueue = [];

        if (this.worker) {
            try {
                this.worker.postMessage({ type: 'SHUTDOWN' } as EiCliWorkerRequest);
            } catch {
                // Ignore shutdown errors.
            }
            await this.worker.terminate();
            this.worker = null;
        }
    }
}

let poolInstance: EiCliWorkerPool | null = null;

export const initEiCliWorkerPool = async (config: EiCliWorkerPoolConfig) => {
    if (!poolInstance) {
        poolInstance = new EiCliWorkerPool(config);
    }
    await poolInstance.init();
    return poolInstance;
};

export const getEiCliWorkerPool = (): EiCliWorkerPool => {
    if (!poolInstance) {
        throw new Error('EI worker pool not initialized');
    }
    return poolInstance;
};

export const shutdownEiCliWorkerPool = async (): Promise<void> => {
    if (poolInstance) {
        await poolInstance.shutdown();
        poolInstance = null;
    }
};
