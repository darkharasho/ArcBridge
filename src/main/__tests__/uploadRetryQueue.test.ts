import { describe, it, expect, beforeEach } from 'vitest';
import {
    inferUploadRetryFailureCategory,
    trimUploadRetryQueue,
    normalizeUploadRetryQueueEntry,
    buildUploadRetryPauseState,
    buildUploadRetryQueuePayload,
    loadUploadRetryQueue,
    saveUploadRetryQueue,
    loadUploadRetryState,
    saveUploadRetryState,
    UPLOAD_RETRY_QUEUE_KEY,
    UPLOAD_RETRY_STATE_KEY,
    MAX_UPLOAD_RETRY_QUEUE_ENTRIES,
    type UploadRetryQueueEntry,
    type UploadRetryRuntimeState,
    type StoreAdapter,
} from '../uploadRetryQueue';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeEntry = (overrides: Partial<UploadRetryQueueEntry> = {}): UploadRetryQueueEntry => ({
    filePath: '/logs/fight.zevtc',
    error: 'Unknown error',
    category: 'unknown',
    failedAt: '2024-01-01T00:00:00.000Z',
    attempts: 1,
    state: 'failed',
    ...overrides,
});

/** Simple in-memory stand-in for electron-store. */
const makeStore = (initial: Record<string, any> = {}): StoreAdapter & { _data: Record<string, any> } => {
    const _data: Record<string, any> = { ...initial };
    return {
        _data,
        get(key: string, defaultValue?: any) { return key in _data ? _data[key] : defaultValue; },
        set(key: string, value: any) { _data[key] = value; },
    };
};

// ─── inferUploadRetryFailureCategory ─────────────────────────────────────────

describe('inferUploadRetryFailureCategory', () => {
    it('returns rate-limit for HTTP 429', () => {
        expect(inferUploadRetryFailureCategory('', 429)).toBe('rate-limit');
    });

    it('returns rate-limit when error text contains "rate limit"', () => {
        expect(inferUploadRetryFailureCategory('Upload rate limit exceeded')).toBe('rate-limit');
    });

    it('returns auth for HTTP 401', () => {
        expect(inferUploadRetryFailureCategory('', 401)).toBe('auth');
    });

    it('returns auth for HTTP 403', () => {
        expect(inferUploadRetryFailureCategory('Access denied', 403)).toBe('auth');
    });

    it('returns auth when error text contains "unauthorized"', () => {
        expect(inferUploadRetryFailureCategory('Unauthorized request')).toBe('auth');
    });

    it('returns auth when error text contains "forbidden"', () => {
        expect(inferUploadRetryFailureCategory('Forbidden')).toBe('auth');
    });

    it('returns auth when error text contains "token"', () => {
        expect(inferUploadRetryFailureCategory('Invalid API token')).toBe('auth');
    });

    it('returns auth when error text contains "auth"', () => {
        expect(inferUploadRetryFailureCategory('Authentication failure')).toBe('auth');
    });

    it('returns file for HTTP 400', () => {
        expect(inferUploadRetryFailureCategory('Bad request', 400)).toBe('file');
    });

    it('returns file for HTTP 413', () => {
        expect(inferUploadRetryFailureCategory('', 413)).toBe('file');
    });

    it('returns file for HTTP 415', () => {
        expect(inferUploadRetryFailureCategory('', 415)).toBe('file');
    });

    it('returns file for HTTP 422', () => {
        expect(inferUploadRetryFailureCategory('', 422)).toBe('file');
    });

    it('returns file when error text contains "enoent"', () => {
        expect(inferUploadRetryFailureCategory('ENOENT: no such file')).toBe('file');
    });

    it('returns file when error text contains "eacces"', () => {
        expect(inferUploadRetryFailureCategory('EACCES: permission denied')).toBe('file');
    });

    it('returns file when error text contains "eperm"', () => {
        expect(inferUploadRetryFailureCategory('EPERM: operation not permitted')).toBe('file');
    });

    it('returns file when error text contains "file"', () => {
        expect(inferUploadRetryFailureCategory('file is missing')).toBe('file');
    });

    it('returns network when statusCode is undefined and text contains "timeout"', () => {
        expect(inferUploadRetryFailureCategory('Request timeout')).toBe('network');
    });

    it('returns network for econnreset (no statusCode)', () => {
        expect(inferUploadRetryFailureCategory('ECONNRESET')).toBe('network');
    });

    it('returns network for econnrefused (no statusCode)', () => {
        expect(inferUploadRetryFailureCategory('ECONNREFUSED connect')).toBe('network');
    });

    it('returns network for enotfound (no statusCode)', () => {
        expect(inferUploadRetryFailureCategory('getaddrinfo ENOTFOUND')).toBe('network');
    });

    it('returns network for etimedout (no statusCode)', () => {
        expect(inferUploadRetryFailureCategory('ETIMEDOUT')).toBe('network');
    });

    it('does NOT return network when a statusCode is present even if text matches', () => {
        // A non-null statusCode means we got a HTTP response → not a network failure
        expect(inferUploadRetryFailureCategory('socket hang up', 503)).toBe('unknown');
    });

    it('returns unknown for empty error with no statusCode', () => {
        expect(inferUploadRetryFailureCategory('')).toBe('unknown');
    });

    it('returns unknown for unrecognised HTTP status', () => {
        expect(inferUploadRetryFailureCategory('Server error', 500)).toBe('unknown');
    });

    it('handles non-string error argument gracefully', () => {
        expect(inferUploadRetryFailureCategory(null as any)).toBe('unknown');
        expect(inferUploadRetryFailureCategory(undefined as any)).toBe('unknown');
        expect(inferUploadRetryFailureCategory(42 as any)).toBe('unknown');
    });

    it('is case-insensitive for error text matching', () => {
        expect(inferUploadRetryFailureCategory('RATE LIMIT')).toBe('rate-limit');
        expect(inferUploadRetryFailureCategory('Unauthorized')).toBe('auth');
        expect(inferUploadRetryFailureCategory('ENOENT')).toBe('file');
    });
});

// ─── trimUploadRetryQueue ─────────────────────────────────────────────────────

describe('trimUploadRetryQueue', () => {
    it('returns queue unchanged when under the limit', () => {
        const q: Record<string, UploadRetryQueueEntry> = {
            a: makeEntry({ filePath: 'a', failedAt: '2024-01-01T00:00:00.000Z' }),
        };
        expect(trimUploadRetryQueue(q, 5)).toBe(q);
        expect(Object.keys(q)).toHaveLength(1);
    });

    it('returns queue unchanged when exactly at the limit', () => {
        const q: Record<string, UploadRetryQueueEntry> = {};
        for (let i = 0; i < 3; i++) {
            q[`f${i}`] = makeEntry({ filePath: `f${i}`, failedAt: `2024-01-0${i + 1}T00:00:00.000Z` });
        }
        trimUploadRetryQueue(q, 3);
        expect(Object.keys(q)).toHaveLength(3);
    });

    it('evicts the oldest entries when over the limit', () => {
        const q: Record<string, UploadRetryQueueEntry> = {
            old1: makeEntry({ filePath: 'old1', failedAt: '2024-01-01T00:00:00.000Z' }),
            old2: makeEntry({ filePath: 'old2', failedAt: '2024-01-02T00:00:00.000Z' }),
            new1: makeEntry({ filePath: 'new1', failedAt: '2024-03-01T00:00:00.000Z' }),
        };
        trimUploadRetryQueue(q, 2);
        expect(Object.keys(q)).toHaveLength(2);
        expect(q.old1).toBeUndefined();
        expect(q.old2).toBeDefined();
        expect(q.new1).toBeDefined();
    });

    it('evicts exactly the overflow count', () => {
        const q: Record<string, UploadRetryQueueEntry> = {};
        for (let i = 0; i < 10; i++) {
            const d = String(i + 1).padStart(2, '0');
            q[`f${i}`] = makeEntry({ filePath: `f${i}`, failedAt: `2024-01-${d}T00:00:00.000Z` });
        }
        trimUploadRetryQueue(q, 7);
        expect(Object.keys(q)).toHaveLength(7);
    });

    it('uses MAX_UPLOAD_RETRY_QUEUE_ENTRIES as default max', () => {
        const q: Record<string, UploadRetryQueueEntry> = {};
        for (let i = 0; i < MAX_UPLOAD_RETRY_QUEUE_ENTRIES; i++) {
            q[`f${i}`] = makeEntry({ filePath: `f${i}` });
        }
        trimUploadRetryQueue(q);
        expect(Object.keys(q)).toHaveLength(MAX_UPLOAD_RETRY_QUEUE_ENTRIES);
    });
});

// ─── normalizeUploadRetryQueueEntry ──────────────────────────────────────────

describe('normalizeUploadRetryQueueEntry', () => {
    it('returns null for null value', () => {
        expect(normalizeUploadRetryQueueEntry('k', null)).toBeNull();
    });

    it('returns null for non-object value', () => {
        expect(normalizeUploadRetryQueueEntry('k', 'string')).toBeNull();
        expect(normalizeUploadRetryQueueEntry('k', 42)).toBeNull();
    });

    it('uses key as filePath when value.filePath is absent', () => {
        const result = normalizeUploadRetryQueueEntry('/path/to/file', {});
        expect(result?.filePath).toBe('/path/to/file');
    });

    it('uses value.filePath when present', () => {
        const result = normalizeUploadRetryQueueEntry('k', { filePath: '/real/path' });
        expect(result?.filePath).toBe('/real/path');
    });

    it('falls back to "Unknown upload error" when error is missing', () => {
        const result = normalizeUploadRetryQueueEntry('k', {});
        expect(result?.error).toBe('Unknown upload error');
    });

    it('preserves numeric statusCode', () => {
        const result = normalizeUploadRetryQueueEntry('k', { statusCode: 429 });
        expect(result?.statusCode).toBe(429);
    });

    it('discards non-numeric statusCode', () => {
        const result = normalizeUploadRetryQueueEntry('k', { statusCode: 'bad' });
        expect(result?.statusCode).toBeUndefined();
    });

    it.each(['network', 'auth', 'rate-limit', 'file'] as const)(
        'preserves valid category "%s"',
        (category) => {
            const result = normalizeUploadRetryQueueEntry('k', { category });
            expect(result?.category).toBe(category);
        }
    );

    it('coerces unknown category to "unknown"', () => {
        const result = normalizeUploadRetryQueueEntry('k', { category: 'weird' });
        expect(result?.category).toBe('unknown');
    });

    it('preserves valid state "retrying"', () => {
        const result = normalizeUploadRetryQueueEntry('k', { state: 'retrying' });
        expect(result?.state).toBe('retrying');
    });

    it('defaults state to "failed"', () => {
        const result = normalizeUploadRetryQueueEntry('k', { state: 'anything-else' });
        expect(result?.state).toBe('failed');
    });

    it('clamps attempts to at least 1', () => {
        expect(normalizeUploadRetryQueueEntry('k', { attempts: 0 })?.attempts).toBe(1);
        expect(normalizeUploadRetryQueueEntry('k', { attempts: -5 })?.attempts).toBe(1);
    });

    it('preserves positive attempts', () => {
        expect(normalizeUploadRetryQueueEntry('k', { attempts: 3 })?.attempts).toBe(3);
    });

    it('defaults attempts to 1 for non-numeric value', () => {
        expect(normalizeUploadRetryQueueEntry('k', { attempts: 'not-a-number' })?.attempts).toBe(1);
    });

    it('supplies a failedAt timestamp when missing', () => {
        const result = normalizeUploadRetryQueueEntry('k', {});
        expect(result?.failedAt).toBeTruthy();
        expect(() => new Date(result!.failedAt)).not.toThrow();
    });
});

// ─── buildUploadRetryPauseState ───────────────────────────────────────────────

describe('buildUploadRetryPauseState', () => {
    it('builds a paused state with reason', () => {
        const state = buildUploadRetryPauseState(true, 'Too many auth failures');
        expect(state.paused).toBe(true);
        expect(state.pauseReason).toBe('Too many auth failures');
        expect(state.pausedAt).toBeTruthy();
    });

    it('uses default reason when pausing without a reason', () => {
        const state = buildUploadRetryPauseState(true);
        expect(state.pauseReason).toBe('Retries paused.');
    });

    it('clears pause fields when unpausing', () => {
        const state = buildUploadRetryPauseState(false);
        expect(state.paused).toBe(false);
        expect(state.pauseReason).toBeNull();
        expect(state.pausedAt).toBeNull();
    });
});

// ─── buildUploadRetryQueuePayload ─────────────────────────────────────────────

describe('buildUploadRetryQueuePayload', () => {
    const baseState: UploadRetryRuntimeState = { paused: false, pauseReason: null, pausedAt: null };

    it('counts failed and retrying entries separately', () => {
        const queue: Record<string, UploadRetryQueueEntry> = {
            a: makeEntry({ state: 'failed' }),
            b: makeEntry({ filePath: 'b', state: 'retrying' }),
            c: makeEntry({ filePath: 'c', state: 'failed' }),
        };
        const payload = buildUploadRetryQueuePayload(queue, baseState, 0);
        expect(payload.failed).toBe(2);
        expect(payload.retrying).toBe(1);
    });

    it('includes the resolved count', () => {
        const payload = buildUploadRetryQueuePayload({}, baseState, 7);
        expect(payload.resolved).toBe(7);
    });

    it('sorts entries newest-first by failedAt', () => {
        const queue: Record<string, UploadRetryQueueEntry> = {
            old: makeEntry({ filePath: 'old', failedAt: '2024-01-01T00:00:00.000Z' }),
            new_: makeEntry({ filePath: 'new', failedAt: '2024-06-01T00:00:00.000Z' }),
        };
        const payload = buildUploadRetryQueuePayload(queue, baseState, 0);
        expect(payload.entries[0].filePath).toBe('new');
        expect(payload.entries[1].filePath).toBe('old');
    });

    it('reflects paused state from the runtime state object', () => {
        const pausedState: UploadRetryRuntimeState = { paused: true, pauseReason: 'Test', pausedAt: '2024-01-01T00:00:00.000Z' };
        const payload = buildUploadRetryQueuePayload({}, pausedState, 0);
        expect(payload.paused).toBe(true);
        expect(payload.pauseReason).toBe('Test');
    });
});

// ─── Store I/O ────────────────────────────────────────────────────────────────

describe('loadUploadRetryQueue', () => {
    it('returns empty object when store has no queue key', () => {
        const store = makeStore();
        expect(loadUploadRetryQueue(store)).toEqual({});
    });

    it('returns empty object when stored value is null', () => {
        const store = makeStore({ [UPLOAD_RETRY_QUEUE_KEY]: null });
        expect(loadUploadRetryQueue(store)).toEqual({});
    });

    it('returns empty object when stored value is an array', () => {
        const store = makeStore({ [UPLOAD_RETRY_QUEUE_KEY]: [] });
        expect(loadUploadRetryQueue(store)).toEqual({});
    });

    it('normalizes stored entries', () => {
        const store = makeStore({
            [UPLOAD_RETRY_QUEUE_KEY]: {
                '/path/file.zevtc': {
                    filePath: '/path/file.zevtc',
                    error: 'HTTP 429',
                    statusCode: 429,
                    category: 'rate-limit',
                    failedAt: '2024-01-01T00:00:00.000Z',
                    attempts: 2,
                    state: 'failed'
                }
            }
        });
        const queue = loadUploadRetryQueue(store);
        expect(queue['/path/file.zevtc']).toBeDefined();
        expect(queue['/path/file.zevtc'].category).toBe('rate-limit');
        expect(queue['/path/file.zevtc'].attempts).toBe(2);
    });

    it('drops entries with invalid (non-object) values', () => {
        const store = makeStore({
            [UPLOAD_RETRY_QUEUE_KEY]: {
                good: { filePath: 'good', error: 'e', category: 'unknown', failedAt: '2024-01-01T00:00:00.000Z', attempts: 1, state: 'failed' },
                bad: 'not-an-object'
            }
        });
        const queue = loadUploadRetryQueue(store);
        expect(Object.keys(queue)).toHaveLength(1);
        expect(queue.good).toBeDefined();
    });
});

describe('saveUploadRetryQueue', () => {
    it('persists the queue under the correct key', () => {
        const store = makeStore();
        const queue = { 'f': makeEntry() };
        saveUploadRetryQueue(store, queue);
        expect(store._data[UPLOAD_RETRY_QUEUE_KEY]).toBe(queue);
    });
});

describe('loadUploadRetryState', () => {
    it('returns default state when key is absent', () => {
        const state = loadUploadRetryState(makeStore());
        expect(state).toEqual({ paused: false, pauseReason: null, pausedAt: null });
    });

    it('returns default state for null stored value', () => {
        const state = loadUploadRetryState(makeStore({ [UPLOAD_RETRY_STATE_KEY]: null }));
        expect(state).toEqual({ paused: false, pauseReason: null, pausedAt: null });
    });

    it('returns default state for array stored value', () => {
        const state = loadUploadRetryState(makeStore({ [UPLOAD_RETRY_STATE_KEY]: [] }));
        expect(state).toEqual({ paused: false, pauseReason: null, pausedAt: null });
    });

    it('restores paused state correctly', () => {
        const store = makeStore({
            [UPLOAD_RETRY_STATE_KEY]: { paused: true, pauseReason: 'Auth errors', pausedAt: '2024-02-01T00:00:00.000Z' }
        });
        const state = loadUploadRetryState(store);
        expect(state.paused).toBe(true);
        expect(state.pauseReason).toBe('Auth errors');
        expect(state.pausedAt).toBe('2024-02-01T00:00:00.000Z');
    });

    it('coerces paused to false when not strictly true', () => {
        const store = makeStore({ [UPLOAD_RETRY_STATE_KEY]: { paused: 1 } });
        expect(loadUploadRetryState(store).paused).toBe(false);
    });

    it('coerces non-string pauseReason to null', () => {
        const store = makeStore({ [UPLOAD_RETRY_STATE_KEY]: { pauseReason: 42 } });
        expect(loadUploadRetryState(store).pauseReason).toBeNull();
    });
});

describe('saveUploadRetryState', () => {
    it('persists the state under the correct key', () => {
        const store = makeStore();
        const state: UploadRetryRuntimeState = { paused: true, pauseReason: 'test', pausedAt: '2024-01-01T00:00:00.000Z' };
        saveUploadRetryState(store, state);
        expect(store._data[UPLOAD_RETRY_STATE_KEY]).toBe(state);
    });
});
