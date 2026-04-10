import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DetailsCache } from '../DetailsCache';

// Mock idb-keyval — tests should not touch real IndexedDB
vi.mock('idb-keyval', () => ({
    get: vi.fn().mockResolvedValue(undefined),
    set: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(undefined),
    keys: vi.fn().mockResolvedValue([]),
}));

const mockFetcher = vi.fn().mockResolvedValue(null);

describe('DetailsCache', () => {
    let cache: DetailsCache;

    beforeEach(() => {
        vi.clearAllMocks();
        cache = new DetailsCache({ lruCapacity: 3, fetchDetails: mockFetcher });
    });

    describe('memory LRU', () => {
        it('peek returns undefined for unknown key', () => {
            expect(cache.peek('unknown')).toBeUndefined();
        });

        it('peek returns value after put', async () => {
            await cache.put('log-1', { players: [] } as any);
            expect(cache.peek('log-1')).toEqual({ players: [] });
        });

        it('evicts oldest entry when capacity exceeded', async () => {
            await cache.put('a', { id: 'a' } as any);
            await cache.put('b', { id: 'b' } as any);
            await cache.put('c', { id: 'c' } as any);
            await cache.put('d', { id: 'd' } as any);
            expect(cache.peek('a')).toBeUndefined();
            expect(cache.peek('d')).toEqual({ id: 'd' });
            expect(cache.memorySize).toBe(3);
        });

        it('accessing a key promotes it in LRU order', async () => {
            await cache.put('a', { id: 'a' } as any);
            await cache.put('b', { id: 'b' } as any);
            await cache.put('c', { id: 'c' } as any);
            await cache.get('a');
            await cache.put('d', { id: 'd' } as any);
            expect(cache.peek('a')).toEqual({ id: 'a' });
            expect(cache.peek('b')).toBeUndefined();
        });

        it('evict removes from memory only', async () => {
            const { del } = await import('idb-keyval');
            await cache.put('log-1', { players: [] } as any);
            cache.evict('log-1');
            expect(cache.peek('log-1')).toBeUndefined();
            expect(del).not.toHaveBeenCalled();
        });

        it('memorySize reflects current LRU count', async () => {
            expect(cache.memorySize).toBe(0);
            await cache.put('a', { id: 'a' } as any);
            expect(cache.memorySize).toBe(1);
            await cache.put('b', { id: 'b' } as any);
            expect(cache.memorySize).toBe(2);
        });
    });

    describe('IndexedDB tier', () => {
        it('get reads from IndexedDB on LRU miss', async () => {
            const { get: idbGetMock } = await import('idb-keyval');
            (idbGetMock as any).mockResolvedValueOnce({
                schemaVersion: 2,
                details: { id: 'from-idb' },
                storedAt: Date.now(),
            });
            const result = await cache.get('log-1');
            expect(result).toEqual({ id: 'from-idb' });
            expect(cache.peek('log-1')).toEqual({ id: 'from-idb' });
        });

        it('ignores IndexedDB entries with wrong schemaVersion', async () => {
            const { get: idbGetMock } = await import('idb-keyval');
            (idbGetMock as any).mockResolvedValueOnce({
                schemaVersion: 999,
                details: { id: 'stale' },
                storedAt: Date.now(),
            });
            mockFetcher.mockResolvedValueOnce({ id: 'fresh' });
            const result = await cache.get('log-1');
            expect(result).toEqual({ id: 'fresh' });
        });

        it('put writes to IndexedDB', async () => {
            const { set: idbSetMock } = await import('idb-keyval');
            await cache.put('log-1', { id: 'written' });
            expect(idbSetMock).toHaveBeenCalledWith(
                'details:log-1',
                expect.objectContaining({ schemaVersion: 2, details: { id: 'written' } })
            );
        });

        it('purge removes from both memory and IndexedDB', async () => {
            const { del: idbDelMock } = await import('idb-keyval');
            await cache.put('log-1', { id: 'data' });
            await cache.purge('log-1');
            expect(cache.peek('log-1')).toBeUndefined();
            expect(idbDelMock).toHaveBeenCalledWith('details:log-1');
        });
    });

    describe('IPC fallback', () => {
        it('calls fetchDetails on full cache miss', async () => {
            mockFetcher.mockResolvedValueOnce({ id: 'from-ipc' });
            const result = await cache.get('log-1');
            expect(mockFetcher).toHaveBeenCalledWith('log-1');
            expect(result).toEqual({ id: 'from-ipc' });
            expect(cache.peek('log-1')).toEqual({ id: 'from-ipc' });
        });

        it('returns null when fetcher returns null', async () => {
            mockFetcher.mockResolvedValueOnce(null);
            const result = await cache.get('log-1');
            expect(result).toBeNull();
            expect(cache.peek('log-1')).toBeUndefined();
        });

        it('handles IndexedDB error gracefully and falls through to IPC', async () => {
            const { get: idbGetMock } = await import('idb-keyval');
            (idbGetMock as any).mockRejectedValueOnce(new Error('IndexedDB blocked'));
            mockFetcher.mockResolvedValueOnce({ id: 'fallback' });
            const result = await cache.get('log-1');
            expect(result).toEqual({ id: 'fallback' });
        });

        it('deduplicates concurrent get() calls for the same logId', async () => {
            let resolveFirst!: (v: any) => void;
            mockFetcher.mockReturnValueOnce(new Promise((r) => { resolveFirst = r; }));
            const p1 = cache.get('log-1');
            const p2 = cache.get('log-1');
            resolveFirst({ id: 'shared' });
            const [r1, r2] = await Promise.all([p1, p2]);
            expect(r1).toEqual({ id: 'shared' });
            expect(r2).toEqual({ id: 'shared' });
            expect(mockFetcher).toHaveBeenCalledTimes(1);
        });
    });

    describe('putSync', () => {
        it('stores in memory immediately without awaiting IndexedDB', () => {
            cache.putSync('log-1', { id: 'sync' });
            expect(cache.peek('log-1')).toEqual({ id: 'sync' });
        });
    });

    describe('sweep', () => {
        it('deletes entries older than TTL', async () => {
            const { keys: idbKeysMock, get: idbGetMock, del: idbDelMock } = await import('idb-keyval');
            (idbKeysMock as any).mockResolvedValueOnce(['details:old-log']);
            (idbGetMock as any).mockResolvedValueOnce({
                schemaVersion: 2,
                details: { id: 'old' },
                storedAt: Date.now() - 8 * 24 * 60 * 60 * 1000, // 8 days ago
            });
            await cache.sweep(7 * 24 * 60 * 60 * 1000);
            expect(idbDelMock).toHaveBeenCalledWith('details:old-log');
        });

        it('keeps entries within TTL', async () => {
            const { keys: idbKeysMock, get: idbGetMock, del: idbDelMock } = await import('idb-keyval');
            (idbKeysMock as any).mockResolvedValueOnce(['details:fresh-log']);
            (idbGetMock as any).mockResolvedValueOnce({
                schemaVersion: 2,
                details: { id: 'fresh' },
                storedAt: Date.now() - 1 * 24 * 60 * 60 * 1000, // 1 day ago
            });
            await cache.sweep(7 * 24 * 60 * 60 * 1000);
            expect(idbDelMock).not.toHaveBeenCalled();
        });

        it('deletes entries with missing storedAt', async () => {
            const { keys: idbKeysMock, get: idbGetMock, del: idbDelMock } = await import('idb-keyval');
            (idbKeysMock as any).mockResolvedValueOnce(['details:no-timestamp']);
            (idbGetMock as any).mockResolvedValueOnce({
                schemaVersion: 2,
                details: { id: 'no-ts' },
            });
            await cache.sweep(7 * 24 * 60 * 60 * 1000);
            expect(idbDelMock).toHaveBeenCalledWith('details:no-timestamp');
        });

        it('deletes entries with wrong schemaVersion', async () => {
            const { keys: idbKeysMock, get: idbGetMock, del: idbDelMock } = await import('idb-keyval');
            (idbKeysMock as any).mockResolvedValueOnce(['details:stale-schema']);
            (idbGetMock as any).mockResolvedValueOnce({
                schemaVersion: 1,
                details: { id: 'stale' },
                storedAt: Date.now(), // fresh, but wrong schema
            });
            await cache.sweep(7 * 24 * 60 * 60 * 1000);
            expect(idbDelMock).toHaveBeenCalledWith('details:stale-schema');
        });

        it('evicts swept entries from memory LRU', async () => {
            const { keys: idbKeysMock, get: idbGetMock } = await import('idb-keyval');
            cache.putSync('old-log', { id: 'in-memory' });
            expect(cache.peek('old-log')).toEqual({ id: 'in-memory' });
            (idbKeysMock as any).mockResolvedValueOnce(['details:old-log']);
            (idbGetMock as any).mockResolvedValueOnce({
                schemaVersion: 2,
                details: { id: 'old' },
                storedAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
            });
            await cache.sweep(7 * 24 * 60 * 60 * 1000);
            expect(cache.peek('old-log')).toBeUndefined();
        });

        it('ignores non-details keys', async () => {
            const { keys: idbKeysMock, get: idbGetMock, del: idbDelMock } = await import('idb-keyval');
            (idbKeysMock as any).mockResolvedValueOnce(['other:key', 'settings:foo']);
            await cache.sweep(7 * 24 * 60 * 60 * 1000);
            expect(idbGetMock).not.toHaveBeenCalled();
            expect(idbDelMock).not.toHaveBeenCalled();
        });

        it('handles IndexedDB errors gracefully', async () => {
            const { keys: idbKeysMock } = await import('idb-keyval');
            (idbKeysMock as any).mockRejectedValueOnce(new Error('IDB unavailable'));
            await expect(cache.sweep(7 * 24 * 60 * 60 * 1000)).resolves.toBeUndefined();
        });
    });
});
