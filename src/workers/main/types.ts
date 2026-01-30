import type { OutgoingConditionsResult } from '../../shared/conditionsMetrics';

// Request types sent from main thread to worker
export type WorkerRequest =
    | { type: 'HASH'; id: string; filePath: string }
    | { type: 'JSON_PARSE'; id: string; filePath: string; isGzipped: boolean }
    | { type: 'METRICS'; id: string; payload: MetricsInput }
    | { type: 'SHUTDOWN' };

// Response types sent from worker to main thread
export type WorkerResponse =
    | { type: 'HASH_RESULT'; id: string; hash: string }
    | { type: 'JSON_PARSE_RESULT'; id: string; data: any }
    | { type: 'METRICS_RESULT'; id: string; result: OutgoingConditionsResult }
    | { type: 'ERROR'; id: string; error: string; stack?: string }
    | { type: 'READY' }
    | { type: 'SHUTDOWN_ACK' };

// Input for metrics computation
export interface MetricsInput {
    players: any[];
    targets: any[];
    skillMap?: Record<string, { name?: string }>;
    buffMap?: Record<string, { name?: string; classification?: string }>;
}

// Worker pool configuration
export interface WorkerPoolConfig {
    minWorkers: number;
    maxWorkers: number;
    idleTimeoutMs: number;
    taskTimeoutMs: number;
}

// Internal task representation
export interface WorkerTask<TResult> {
    id: string;
    request: WorkerRequest;
    resolve: (result: TResult) => void;
    reject: (error: Error) => void;
    startedAt?: number;
}
