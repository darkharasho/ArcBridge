# IndexedDB TTL Eviction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a startup sweep to `DetailsCache` that deletes IndexedDB entries older than 7 days, preventing unbounded disk growth.

**Architecture:** New `sweep(ttlMs)` method on `DetailsCache` enumerates all `details:*` keys in IndexedDB via `idb-keyval`'s `keys()` export, checks each entry's `storedAt` timestamp, and deletes expired/invalid entries. Called fire-and-forget from `App.tsx` after cache construction.

**Tech Stack:** TypeScript, idb-keyval, vitest

---

### Task 1: Add `sweep()` method to DetailsCache

**Files:**
- Modify: `src/renderer/cache/DetailsCache.ts`

- [ ] **Step 1: Add `keys` import from idb-keyval**

In `src/renderer/cache/DetailsCache.ts` line 1, update the import:

```ts
import { get as idbGet, set as idbSet, del as idbDel, keys as idbKeys } from 'idb-keyval';
```

- [ ] **Step 2: Add the `sweep` method to the `DetailsCache` class**

Add this method after the existing `purge` method (after line 136):

```ts
    /** Delete all IndexedDB entries older than `ttlMs` or with a stale schema version.
     *  Also evicts matching keys from the in-memory LRU. Fire-and-forget safe. */
    async sweep(ttlMs: number): Promise<void> {
        try {
            const allKeys = await idbKeys();
            const detailKeys = allKeys.filter(
                (k): k is string => typeof k === 'string' && k.startsWith(IDB_PREFIX)
            );
            const now = Date.now();
            await Promise.all(
                detailKeys.map(async (key) => {
                    try {
                        const entry = await idbGet<IdbEntry>(key);
                        if (
                            !entry ||
                            typeof entry.storedAt !== 'number' ||
                            now - entry.storedAt > ttlMs ||
                            entry.schemaVersion !== SCHEMA_VERSION
                        ) {
                            await idbDel(key);
                            const logId = key.slice(IDB_PREFIX.length);
                            this.lru.delete(logId);
                        }
                    } catch {
                        // Individual entry read/delete failed — skip it
                    }
                })
            );
        } catch {
            // IndexedDB unavailable — nothing to sweep
        }
    }
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/cache/DetailsCache.ts
git commit -m "feat(cache): add sweep method for TTL-based IndexedDB eviction"
```

---

### Task 2: Add tests for `sweep()`

**Files:**
- Modify: `src/renderer/cache/__tests__/DetailsCache.test.ts`

- [ ] **Step 1: Update the idb-keyval mock to include `keys`**

In `src/renderer/cache/__tests__/DetailsCache.test.ts`, update the mock at lines 5-9:

```ts
vi.mock('idb-keyval', () => ({
    get: vi.fn().mockResolvedValue(undefined),
    set: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(undefined),
    keys: vi.fn().mockResolvedValue([]),
}));
```

- [ ] **Step 2: Add the sweep test suite**

Add this `describe` block after the existing `putSync` describe block (after line 153):

```ts
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
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `npx vitest run src/renderer/cache/__tests__/DetailsCache.test.ts`
Expected: All tests pass, including the 7 new sweep tests.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/cache/__tests__/DetailsCache.test.ts
git commit -m "test(cache): add tests for IndexedDB TTL sweep"
```

---

### Task 3: Call `sweep()` from App.tsx on startup

**Files:**
- Modify: `src/renderer/App.tsx:145-163`

- [ ] **Step 1: Add the sweep call after cache construction**

In `src/renderer/App.tsx`, after the closing `}` of the `if (!detailsCacheRef.current)` block (line 163), add:

```ts
    detailsCacheRef.current.sweep(7 * 24 * 60 * 60 * 1000);
```

The full block should read:

```ts
    if (!detailsCacheRef.current) {
        detailsCacheRef.current = new DetailsCache({
            lruCapacity: 15,
            resolveDetails: () => null,
            fetchDetails: async (logId: string) => {
                const log = logsRef.current.find((l: any) => l.id === logId || l.filePath === logId);
                if (!log) return null;
                try {
                    const result = await window.electronAPI.getLogDetails({
                        filePath: log.filePath,
                        permalink: log.permalink,
                    });
                    return result?.success ? result.details ?? null : null;
                } catch {
                    return null;
                }
            },
        });
        detailsCacheRef.current.sweep(7 * 24 * 60 * 60 * 1000);
    }
```

- [ ] **Step 2: Run validate to check types and lint**

Run: `npm run validate`
Expected: No errors.

- [ ] **Step 3: Run the full unit test suite**

Run: `npm run test:unit`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/App.tsx
git commit -m "feat(cache): trigger IndexedDB TTL sweep on app startup (7-day TTL)"
```
