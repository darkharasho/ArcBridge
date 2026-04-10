# IndexedDB TTL Eviction — Startup Sweep

## Problem

The `DetailsCache` stores EI JSON detail objects (10–40 MB each) in IndexedDB via `idb-keyval`, keyed under both `log.id` and `log.filePath`. Entries are never evicted from IndexedDB, only from the in-memory LRU. Over time this causes unbounded growth — observed at ~10 GB in `~/.config/AxiBridge-Dev/IndexedDB/`.

## Solution

Add a `sweep(ttlMs)` method to `DetailsCache` that runs once on app startup and deletes all IndexedDB entries older than a configurable TTL. Default TTL: **7 days**.

## Design

### New method: `DetailsCache.sweep(ttlMs: number): Promise<void>`

1. Import `keys` from `idb-keyval` (already importing `get`, `set`, `del`).
2. Call `keys()` to enumerate all IndexedDB keys in the default store.
3. Filter to keys starting with `IDB_PREFIX` (`"details:"`).
4. For each matching key, read the entry via `idbGet`.
5. Delete the entry if any of these are true:
   - `storedAt` is missing or not a number
   - `Date.now() - storedAt > ttlMs`
   - `schemaVersion` does not match `SCHEMA_VERSION` (bonus: cleans up stale schema versions)
6. For deleted entries, also evict from the in-memory LRU if present (extract logId from key by stripping the prefix).
7. All errors are caught and silently ignored, matching the existing IndexedDB error handling pattern.

### Call site: `App.tsx`

After constructing the `DetailsCache` instance (~line 146), call:

```ts
detailsCacheRef.current.sweep(7 * 24 * 60 * 60 * 1000);
```

Fire-and-forget — no `await`. The sweep runs asynchronously and does not block app startup or rendering.

### Constants

- `DETAILS_TTL_MS` is not a new constant in `DetailsCache` — the TTL is passed in by the caller, keeping the cache generic.
- The 7-day value lives at the call site in `App.tsx`.

## Files Changed

| File | Change |
|------|--------|
| `src/renderer/cache/DetailsCache.ts` | Add `keys` import from `idb-keyval`; add `sweep(ttlMs)` method |
| `src/renderer/App.tsx` | Call `sweep()` after cache construction |
| `src/renderer/cache/__tests__/DetailsCache.test.ts` | Add tests for sweep behavior |

## Testing

Unit tests with mocked `idb-keyval`:

1. **Expired entries are deleted**: Insert entries with `storedAt` older than TTL, verify `idbDel` called for each.
2. **Fresh entries are kept**: Insert entries within TTL, verify they are not deleted.
3. **Missing storedAt entries are deleted**: Entry without `storedAt` field is treated as expired.
4. **Stale schema entries are deleted**: Entry with wrong `schemaVersion` is deleted regardless of age.
5. **Memory LRU eviction**: Entries deleted from IDB are also evicted from the in-memory LRU.
6. **IndexedDB errors are swallowed**: If `keys()` or `get()` throws, sweep completes without error.
7. **Non-details keys are ignored**: Keys not starting with `"details:"` are left untouched.
