/**
 * Upload retry queue — types, pure logic, and store-backed I/O.
 *
 * Store-dependent functions accept a `StoreAdapter` so they can be unit-tested
 * without a real electron-store or any Electron API.
 */

export type UploadRetryFailureCategory = 'network' | 'auth' | 'rate-limit' | 'file' | 'unknown';

export type UploadRetryQueueEntry = {
    filePath: string;
    error: string;
    statusCode?: number;
    category: UploadRetryFailureCategory;
    failedAt: string;
    attempts: number;
    state: 'failed' | 'retrying';
};

export type UploadRetryRuntimeState = {
    paused: boolean;
    pauseReason: string | null;
    pausedAt: string | null;
};

export type UploadRetryQueuePayload = {
    failed: number;
    retrying: number;
    resolved: number;
    paused: boolean;
    pauseReason: string | null;
    pausedAt: string | null;
    entries: UploadRetryQueueEntry[];
};

export interface StoreAdapter {
    get(key: string, defaultValue?: any): any;
    set(key: string, value: any): void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const UPLOAD_RETRY_QUEUE_KEY = 'uploadRetryQueue';
export const UPLOAD_RETRY_STATE_KEY = 'uploadRetryQueueState';
export const MAX_UPLOAD_RETRY_QUEUE_ENTRIES = 200;
export const AUTH_RETRY_PAUSE_THRESHOLD = 3;

// ─── Pure logic (no I/O) ──────────────────────────────────────────────────────

/**
 * Classify an upload failure by its error text / HTTP status code.
 * Pure — no side effects.
 */
export const inferUploadRetryFailureCategory = (error: string, statusCode?: number): UploadRetryFailureCategory => {
    const text = String(error || '').toLowerCase();
    if (statusCode === 429 || text.includes('rate limit')) return 'rate-limit';
    if (
        statusCode === 401 || statusCode === 403 ||
        text.includes('unauthorized') || text.includes('forbidden') ||
        text.includes('token') || text.includes('auth')
    ) return 'auth';
    if (
        statusCode === 400 || statusCode === 413 || statusCode === 415 || statusCode === 422 ||
        text.includes('enoent') || text.includes('eacces') || text.includes('eperm') || text.includes('file')
    ) return 'file';
    if (statusCode === undefined || statusCode === null) {
        if (
            text.includes('timeout') || text.includes('network') || text.includes('socket') ||
            text.includes('econnreset') || text.includes('econnrefused') || text.includes('enotfound') ||
            text.includes('eai_again') || text.includes('etimedout')
        ) return 'network';
    }
    return 'unknown';
};

/**
 * Evict the oldest entries when the queue exceeds `MAX_UPLOAD_RETRY_QUEUE_ENTRIES`.
 * Mutates and returns the same `queue` object.
 * Pure — no I/O.
 */
export const trimUploadRetryQueue = (
    queue: Record<string, UploadRetryQueueEntry>,
    max = MAX_UPLOAD_RETRY_QUEUE_ENTRIES
): Record<string, UploadRetryQueueEntry> => {
    const entries = Object.values(queue);
    if (entries.length <= max) return queue;
    const sorted = entries.sort((a, b) => a.failedAt.localeCompare(b.failedAt));
    const overflow = sorted.length - max;
    for (let i = 0; i < overflow; i += 1) {
        delete queue[sorted[i].filePath];
    }
    return queue;
};

/**
 * Normalise a raw persisted retry-queue entry into a well-typed object.
 * Returns `null` if the raw value is not a valid object.
 * Pure — no I/O.
 */
export const normalizeUploadRetryQueueEntry = (key: string, value: any): UploadRetryQueueEntry | null => {
    if (!value || typeof value !== 'object') return null;
    return {
        filePath: typeof value.filePath === 'string' ? value.filePath : key,
        error: typeof value.error === 'string' ? value.error : 'Unknown upload error',
        statusCode: typeof value.statusCode === 'number' ? value.statusCode : undefined,
        category:
            value.category === 'network' ||
            value.category === 'auth' ||
            value.category === 'rate-limit' ||
            value.category === 'file'
                ? value.category
                : 'unknown',
        failedAt: typeof value.failedAt === 'string' ? value.failedAt : new Date().toISOString(),
        attempts: Number.isFinite(Number(value.attempts)) ? Math.max(1, Number(value.attempts)) : 1,
        state: value.state === 'retrying' ? 'retrying' : 'failed'
    };
};

/**
 * Build the runtime state object that gets persisted when pausing/resuming.
 * Pure — no I/O.
 */
export const buildUploadRetryPauseState = (
    paused: boolean,
    reason: string | null = null
): UploadRetryRuntimeState => ({
    paused,
    pauseReason: paused ? (reason || 'Retries paused.') : null,
    pausedAt: paused ? new Date().toISOString() : null
});

/**
 * Build the payload sent to the renderer for a given queue + state snapshot.
 * Pure — no I/O.
 */
export const buildUploadRetryQueuePayload = (
    queue: Record<string, UploadRetryQueueEntry>,
    state: UploadRetryRuntimeState,
    resolvedCount: number
): UploadRetryQueuePayload => {
    const entries = Object.values(queue).sort((a, b) => b.failedAt.localeCompare(a.failedAt));
    return {
        failed: entries.filter((e) => e.state === 'failed').length,
        retrying: entries.filter((e) => e.state === 'retrying').length,
        resolved: resolvedCount,
        paused: state.paused,
        pauseReason: state.pauseReason,
        pausedAt: state.pausedAt,
        entries
    };
};

// ─── Store I/O (requires a StoreAdapter) ─────────────────────────────────────

export const loadUploadRetryQueue = (store: StoreAdapter): Record<string, UploadRetryQueueEntry> => {
    const raw = store.get(UPLOAD_RETRY_QUEUE_KEY, {});
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const normalized: Record<string, UploadRetryQueueEntry> = {};
    Object.entries(raw as Record<string, any>).forEach(([key, value]) => {
        const entry = normalizeUploadRetryQueueEntry(key, value);
        if (entry) normalized[key] = entry;
    });
    return normalized;
};

export const saveUploadRetryQueue = (
    store: StoreAdapter,
    queue: Record<string, UploadRetryQueueEntry>
): void => {
    store.set(UPLOAD_RETRY_QUEUE_KEY, queue);
};

export const loadUploadRetryState = (store: StoreAdapter): UploadRetryRuntimeState => {
    const raw = store.get(UPLOAD_RETRY_STATE_KEY, {});
    const parsed = (!raw || typeof raw !== 'object' || Array.isArray(raw)) ? {} : raw as any;
    return {
        paused: parsed.paused === true,
        pauseReason: typeof parsed.pauseReason === 'string' ? parsed.pauseReason : null,
        pausedAt: typeof parsed.pausedAt === 'string' ? parsed.pausedAt : null
    };
};

export const saveUploadRetryState = (store: StoreAdapter, state: UploadRetryRuntimeState): void => {
    store.set(UPLOAD_RETRY_STATE_KEY, state);
};
