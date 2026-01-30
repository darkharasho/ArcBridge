import { Worker } from 'worker_threads';
import { cpus } from 'os';
import path from 'path';
import fs from 'fs';
import { createHash } from 'crypto';
import zlib from 'zlib';
import { computeOutgoingConditions, OutgoingConditionsResult } from '../../shared/conditionsMetrics';
import type { WorkerRequest, WorkerResponse, WorkerPoolConfig, WorkerTask, MetricsInput } from './types';

interface ManagedWorker {
    worker: Worker;
    busy: boolean;
    currentTask: WorkerTask<any> | null;
    idleTimer: ReturnType<typeof setTimeout> | null;
}

let taskIdCounter = 0;
const generateTaskId = () => `task_${++taskIdCounter}_${Date.now()}`;

export class MainWorkerPool {
    private workers: Map<number, ManagedWorker> = new Map();
    private taskQueue: WorkerTask<any>[] = [];
    private config: WorkerPoolConfig;
    private workerPath: string;
    private shuttingDown = false;
    private workerIdCounter = 0;

    constructor(config?: Partial<WorkerPoolConfig>) {
        this.config = {
            minWorkers: 1,
            maxWorkers: Math.max(1, cpus().length - 1),
            idleTimeoutMs: 30000,
            taskTimeoutMs: 120000,
            ...config
        };

        // Path to the compiled worker script
        this.workerPath = path.join(__dirname, 'processingWorker.js');
    }

    async init(): Promise<void> {
        console.log(`[WorkerPool] Initializing with ${this.config.minWorkers} workers, path: ${this.workerPath}`);
        // Spawn minimum workers
        for (let i = 0; i < this.config.minWorkers; i++) {
            await this.spawnWorker();
        }
        console.log(`[WorkerPool] Initialization complete, ${this.workers.size} workers ready`);
    }

    private async spawnWorker(): Promise<ManagedWorker> {
        const workerId = ++this.workerIdCounter;
        console.log(`[WorkerPool] Spawning worker ${workerId} from ${this.workerPath}`);

        const worker = new Worker(this.workerPath);
        const managed: ManagedWorker = {
            worker,
            busy: false,
            currentTask: null,
            idleTimer: null
        };

        this.workers.set(workerId, managed);

        worker.on('message', (response: WorkerResponse) => {
            this.handleWorkerMessage(workerId, response);
        });

        worker.on('error', (error) => {
            console.error(`[WorkerPool] Worker ${workerId} error:`, error);
            this.handleWorkerError(workerId, error);
        });

        worker.on('exit', (code) => {
            if (code !== 0 && !this.shuttingDown) {
                console.warn(`[WorkerPool] Worker ${workerId} exited with code ${code}`);
            }
            this.workers.delete(workerId);

            // Respawn if below minimum
            if (!this.shuttingDown && this.workers.size < this.config.minWorkers) {
                this.spawnWorker().catch(console.error);
            }
        });

        // Wait for READY signal
        await new Promise<void>((resolve) => {
            const readyHandler = (msg: WorkerResponse) => {
                if (msg.type === 'READY') {
                    worker.off('message', readyHandler);
                    resolve();
                }
            };
            worker.on('message', readyHandler);
        });

        return managed;
    }

    private handleWorkerMessage(workerId: number, response: WorkerResponse): void {
        const managed = this.workers.get(workerId);
        if (!managed) return;

        if (response.type === 'READY' || response.type === 'SHUTDOWN_ACK') {
            return;
        }

        const task = managed.currentTask;
        if (!task || task.id !== response.id) {
            console.warn(`[WorkerPool] Received response for unknown task ${response.id}`);
            return;
        }

        managed.busy = false;
        managed.currentTask = null;

        if (response.type === 'ERROR') {
            const error = new Error(response.error);
            if (response.stack) {
                error.stack = response.stack;
            }
            task.reject(error);
        } else if (response.type === 'HASH_RESULT') {
            task.resolve(response.hash);
        } else if (response.type === 'JSON_PARSE_RESULT') {
            task.resolve(response.data);
        } else if (response.type === 'METRICS_RESULT') {
            task.resolve(response.result);
        }

        // Start idle timer if no pending tasks
        this.scheduleIdleCleanup(workerId);

        // Process next task in queue
        this.processQueue();
    }

    private handleWorkerError(workerId: number, error: Error): void {
        const managed = this.workers.get(workerId);
        if (!managed) return;

        if (managed.currentTask) {
            managed.currentTask.reject(error);
            managed.currentTask = null;
        }

        // Terminate and remove the failed worker
        managed.worker.terminate().catch(() => { });
        this.workers.delete(workerId);

        // Respawn if needed
        if (!this.shuttingDown && this.workers.size < this.config.minWorkers) {
            this.spawnWorker().catch(console.error);
        }
    }

    private scheduleIdleCleanup(workerId: number): void {
        const managed = this.workers.get(workerId);
        if (!managed) return;

        if (managed.idleTimer) {
            clearTimeout(managed.idleTimer);
        }

        // Don't terminate if at minimum workers
        if (this.workers.size <= this.config.minWorkers) return;

        managed.idleTimer = setTimeout(() => {
            if (!managed.busy && this.workers.size > this.config.minWorkers) {
                managed.worker.postMessage({ type: 'SHUTDOWN' } as WorkerRequest);
                managed.worker.terminate().catch(() => { });
                this.workers.delete(workerId);
            }
        }, this.config.idleTimeoutMs);
    }

    private getIdleWorker(): ManagedWorker | null {
        for (const managed of this.workers.values()) {
            if (!managed.busy) {
                return managed;
            }
        }
        return null;
    }

    private async processQueue(): Promise<void> {
        if (this.taskQueue.length === 0) return;

        let worker = this.getIdleWorker();

        // Spawn new worker if needed and under max
        if (!worker && this.workers.size < this.config.maxWorkers) {
            try {
                worker = await this.spawnWorker();
            } catch (error) {
                console.error('[WorkerPool] Failed to spawn worker:', error);
                return;
            }
        }

        if (!worker) return;

        const task = this.taskQueue.shift();
        if (!task) return;

        if (worker.idleTimer) {
            clearTimeout(worker.idleTimer);
            worker.idleTimer = null;
        }

        worker.busy = true;
        worker.currentTask = task;
        task.startedAt = Date.now();

        worker.worker.postMessage(task.request);
    }

    private enqueue<T>(request: WorkerRequest): Promise<T> {
        return new Promise((resolve, reject) => {
            const task: WorkerTask<T> = {
                id: request.type === 'SHUTDOWN' ? 'shutdown' : (request as any).id,
                request,
                resolve,
                reject
            };

            this.taskQueue.push(task);
            this.processQueue();
        });
    }

    // Public API methods with fallbacks

    async hash(filePath: string): Promise<string> {
        const startTime = Date.now();
        try {
            const id = generateTaskId();
            console.log(`[WorkerPool] Hash task ${id} starting for ${filePath}`);
            const result = await this.enqueue<string>({ type: 'HASH', id, filePath });
            console.log(`[WorkerPool] Hash task ${id} completed in ${Date.now() - startTime}ms`);
            return result;
        } catch (error) {
            console.warn('[WorkerPool] Hash worker failed, using fallback:', error);
            const result = await this.hashFallback(filePath);
            console.log(`[WorkerPool] Hash fallback completed in ${Date.now() - startTime}ms`);
            return result;
        }
    }

    async parseJson(filePath: string, isGzipped: boolean): Promise<any> {
        const startTime = Date.now();
        try {
            const id = generateTaskId();
            console.log(`[WorkerPool] JSON parse task ${id} starting for ${filePath} (gzipped: ${isGzipped})`);
            const result = await this.enqueue<any>({ type: 'JSON_PARSE', id, filePath, isGzipped });
            console.log(`[WorkerPool] JSON parse task ${id} completed in ${Date.now() - startTime}ms`);
            return result;
        } catch (error) {
            console.warn('[WorkerPool] JSON parse worker failed, using fallback:', error);
            const result = await this.parseJsonFallback(filePath, isGzipped);
            console.log(`[WorkerPool] JSON parse fallback completed in ${Date.now() - startTime}ms`);
            return result;
        }
    }

    async computeMetrics(payload: MetricsInput): Promise<OutgoingConditionsResult> {
        const startTime = Date.now();
        try {
            const id = generateTaskId();
            console.log(`[WorkerPool] Metrics task ${id} starting (${payload.players?.length} players, ${payload.targets?.length} targets)`);
            const result = await this.enqueue<OutgoingConditionsResult>({ type: 'METRICS', id, payload });
            console.log(`[WorkerPool] Metrics task ${id} completed in ${Date.now() - startTime}ms`);
            return result;
        } catch (error) {
            console.warn('[WorkerPool] Metrics worker failed, using fallback:', error);
            const result = this.computeMetricsFallback(payload);
            console.log(`[WorkerPool] Metrics fallback completed in ${Date.now() - startTime}ms`);
            return result;
        }
    }

    // Fallback implementations (run on main thread)

    private hashFallback(filePath: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const hash = createHash('sha256');
            const stream = fs.createReadStream(filePath);
            stream.on('data', (chunk) => hash.update(chunk));
            stream.on('error', reject);
            stream.on('end', () => resolve(hash.digest('hex')));
        });
    }

    private async parseJsonFallback(filePath: string, isGzipped: boolean): Promise<any> {
        const raw = await fs.promises.readFile(filePath);
        if (isGzipped) {
            const inflated = zlib.gunzipSync(raw);
            return JSON.parse(inflated.toString('utf8'));
        }
        return JSON.parse(raw.toString('utf8'));
    }

    private computeMetricsFallback(payload: MetricsInput): OutgoingConditionsResult {
        return computeOutgoingConditions(payload);
    }

    async shutdown(): Promise<void> {
        this.shuttingDown = true;

        // Clear task queue
        for (const task of this.taskQueue) {
            task.reject(new Error('Worker pool shutting down'));
        }
        this.taskQueue = [];

        // Terminate all workers
        const terminatePromises = Array.from(this.workers.values()).map(async (managed) => {
            if (managed.idleTimer) {
                clearTimeout(managed.idleTimer);
            }
            if (managed.currentTask) {
                managed.currentTask.reject(new Error('Worker pool shutting down'));
            }
            managed.worker.postMessage({ type: 'SHUTDOWN' } as WorkerRequest);
            await managed.worker.terminate();
        });

        await Promise.all(terminatePromises);
        this.workers.clear();
    }

    getStats() {
        let activeWorkers = 0;
        let idleWorkers = 0;

        for (const managed of this.workers.values()) {
            if (managed.busy) {
                activeWorkers++;
            } else {
                idleWorkers++;
            }
        }

        return {
            activeWorkers,
            idleWorkers,
            queuedTasks: this.taskQueue.length,
            totalWorkers: this.workers.size
        };
    }
}

// Singleton instance
let poolInstance: MainWorkerPool | null = null;

export const getWorkerPool = (): MainWorkerPool => {
    if (!poolInstance) {
        poolInstance = new MainWorkerPool();
    }
    return poolInstance;
};

export const initWorkerPool = async (): Promise<MainWorkerPool> => {
    const pool = getWorkerPool();
    await pool.init();
    return pool;
};

export const shutdownWorkerPool = async (): Promise<void> => {
    if (poolInstance) {
        await poolInstance.shutdown();
        poolInstance = null;
    }
};
