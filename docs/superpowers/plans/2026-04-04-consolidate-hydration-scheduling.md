# Consolidate Hydration Scheduling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 7 timers across 4 files with a single reactive publish model inside `useLogsForStats`, delete `statsSyncRecovery.ts`, and remove bulk-upload gating from the scheduling path.

**Architecture:** `useLogsForStats` becomes the single scheduling owner. It publishes `logsForStats` immediately on every `logs` change (snapshot key deduplication prevents unnecessary recomputes). It receives `view` and a `scheduleDetailsHydrationRef` (a mutable ref to avoid hook ordering issues) and handles all hydration triggers internally. App.tsx loses all 5 `scheduleDetailsHydration` call sites and the statsSyncRecovery effect.

**Tech Stack:** React hooks, TypeScript, Vitest

**Spec:** `docs/superpowers/specs/2026-04-04-consolidate-hydration-scheduling-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/renderer/app/hooks/useLogsForStats.ts` | Modify | Remove 3 timers, remove `bulkUploadMode` input, add `view` + `scheduleDetailsHydrationRef` inputs, simplify to 3 reactive effects |
| `src/renderer/App.tsx` | Modify | Remove 5 `scheduleDetailsHydration` call sites, remove statsSyncRecovery effect/import/ref, simplify `endBulkUpload`, add `bulkCalculatingActive` state locally, update `useLogsForStats` call site, create `scheduleDetailsHydrationRef` |
| `src/renderer/stats/utils/statsSyncRecovery.ts` | Delete | Was safety-net recovery logic — no longer needed |
| `src/renderer/__tests__/statsSyncRecovery.test.ts` | Delete | Tests for deleted module |

---

## Context: Hook ordering

`useLogsForStats` needs `scheduleDetailsHydration` (from `useDetailsHydration`), but `useDetailsHydration` takes `logsRef` and `setLogsForStats` (from `useLogsForStats`). In practice `setLogsForStats` is unused in `useDetailsHydration` (destructured as `_setLogsForStats`), and `logsRef` could be extracted. But the cleanest solution: pass a mutable ref (`scheduleDetailsHydrationRef`) to `useLogsForStats`, then populate it after `useDetailsHydration` runs. This keeps hook call order stable and avoids any circular dependency.

---

### Task 1: Simplify `useLogsForStats` — remove timers and bulk gating

**Files:**
- Modify: `src/renderer/app/hooks/useLogsForStats.ts`

- [ ] **Step 1: Read the current file**

Read `src/renderer/app/hooks/useLogsForStats.ts` to confirm it matches the expected state (183 lines, 3 timers, `bulkUploadMode` input).

- [ ] **Step 2: Rewrite `useLogsForStats` with simplified interface and effects**

Replace the entire file contents with:

```typescript
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { DetailsCacheContext } from '../../cache/DetailsCacheContext';

interface UseLogsForStatsOptions {
    logs: ILogData[];
    view: string;
    scheduleDetailsHydrationRef: React.MutableRefObject<(force?: boolean) => void>;
}

export function useLogsForStats({ logs, view, scheduleDetailsHydrationRef }: UseLogsForStatsOptions) {
    const detailsCache = useContext(DetailsCacheContext);

    const [logsForStats, setLogsForStats] = useState<ILogData[]>(logs);
    const logsRef = useRef<ILogData[]>(logs);
    const statsObjectIdMapRef = useRef<WeakMap<object, number>>(new WeakMap());
    const nextStatsObjectIdRef = useRef(1);
    const lastPublishedStatsKeyRef = useRef('');

    const hasPendingStatsDetails = logs.some((log) => {
        const ds = log.detailsStatus || 'idle';
        if (detailsCache?.peek(log.id) || ds === 'loaded') return false;
        if (ds === 'unavailable' || ds === 'exhausted') return false;
        if (ds === 'available') return true;
        return (log.status === 'success' || log.status === 'calculating' || log.status === 'discord') && Boolean(log.permalink);
    });

    const getStatsObjectId = useCallback((value: unknown): number => {
        if (!value || typeof value !== 'object') return 0;
        const objectValue = value as object;
        const existing = statsObjectIdMapRef.current.get(objectValue);
        if (typeof existing === 'number') return existing;
        const nextId = nextStatsObjectIdRef.current;
        nextStatsObjectIdRef.current += 1;
        statsObjectIdMapRef.current.set(objectValue, nextId);
        return nextId;
    }, []);

    const buildStatsSnapshotKey = useCallback((entries: ILogData[]) => {
        let key = `len:${entries.length}`;
        entries.forEach((log, index) => {
            const details = detailsCache?.peek(log?.id) ?? null;
            const detailsId = details ? getStatsObjectId(details) : 0;
            const logId = details ? 0 : getStatsObjectId(log);
            const identifier = String(log?.filePath || log?.id || `idx-${index}`);
            const permalink = String(log?.permalink || (details as any)?.permalink || '');
            const uploadTime = Number(log?.uploadTime || (details as any)?.uploadTime || 0);
            const successValue = (details as any)?.success;
            const successToken = successValue === true ? '1' : successValue === false ? '0' : 'u';
            key += `|${identifier}:${detailsId}:${logId}:${uploadTime}:${successToken}:${permalink}`;
        });
        return key;
    }, [getStatsObjectId, detailsCache]);

    const mergeLogsForStatsSnapshot = useCallback((entries: ILogData[], previous: ILogData[]) => {
        if (entries.length === 0) return entries;
        if (previous.length === 0) return entries;
        const previousByIdentity = new Map<string, ILogData>();
        previous.forEach((entry, index) => {
            const identity = String(entry?.filePath || entry?.id || `idx-${index}`);
            if (!identity) return;
            previousByIdentity.set(identity, entry);
        });
        let changed = false;
        const merged = entries.map((entry, index) => {
            const identity = String(entry?.filePath || entry?.id || `idx-${index}`);
            const previousEntry = previousByIdentity.get(identity);
            if (!previousEntry) return entry;
            const shouldCarryStatsLoaded = entry.detailsStatus !== 'loaded' && previousEntry.detailsStatus === 'loaded';
            if (!shouldCarryStatsLoaded) {
                return entry;
            }
            changed = true;
            const nextEntry: ILogData = { ...entry };
            nextEntry.detailsStatus = 'loaded';
            return nextEntry;
        });
        return changed ? merged : entries;
    }, [detailsCache]);

    const publishLogsForStats = useCallback((entries: ILogData[]) => {
        setLogsForStats((prev) => {
            const stripped = entries.some(e => e.details)
                ? entries.map(e => e.details ? { ...e, details: undefined } : e)
                : entries;
            const mergedEntries = mergeLogsForStatsSnapshot(stripped, prev);
            const nextKey = buildStatsSnapshotKey(mergedEntries);
            if (nextKey === lastPublishedStatsKeyRef.current) {
                return prev;
            }
            lastPublishedStatsKeyRef.current = nextKey;
            return mergedEntries;
        });
    }, [buildStatsSnapshotKey, mergeLogsForStatsSnapshot]);

    // Keep snapshot key in sync when logsForStats changes externally (e.g. removals)
    useEffect(() => {
        lastPublishedStatsKeyRef.current = buildStatsSnapshotKey(logsForStats);
    }, [buildStatsSnapshotKey, logsForStats]);

    // Effect 1: Publish on every logs change — snapshot key deduplicates
    useEffect(() => {
        publishLogsForStats(logsRef.current);
    }, [logs, publishLogsForStats]);

    // Effect 2: When pending details resolve, publish again + trigger hydration if on stats view
    useEffect(() => {
        if (hasPendingStatsDetails) {
            if (view === 'stats') {
                scheduleDetailsHydrationRef.current();
            }
            return;
        }
        publishLogsForStats(logsRef.current);
    }, [hasPendingStatsDetails, view, publishLogsForStats, scheduleDetailsHydrationRef]);

    // Effect 3: Force hydration when switching to stats view
    useEffect(() => {
        if (view === 'stats') {
            scheduleDetailsHydrationRef.current(true);
        }
    }, [view, scheduleDetailsHydrationRef]);

    useEffect(() => {
        logsRef.current = logs;
    }, [logs]);

    return {
        logsForStats,
        setLogsForStats,
        logsRef,
    };
}
```

Key changes from the original:
- Interface: `bulkUploadMode` removed, `view` and `scheduleDetailsHydrationRef` added
- `hasPendingStatsDetailsRef` removed (not needed — ref was only used by timer callbacks)
- All 3 timers deleted: `statsBatchTimerRef` (400ms), nested 600ms retry, `lengthMismatchFollowUpRef` (300ms)
- Cleanup effect deleted (no timers to clear)
- `bulkCalculatingActive` / `setBulkCalculatingActive` removed (UI-only, stays in App.tsx)
- 3 simple reactive effects replace the 4 timer-based effects

- [ ] **Step 3: Run typecheck to verify the hook compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: Errors in `App.tsx` only (call site not yet updated). No errors in `useLogsForStats.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/app/hooks/useLogsForStats.ts
git commit -m "refactor: simplify useLogsForStats — remove timers, bulk gating, use reactive publish"
```

---

### Task 2: Update App.tsx — remove scheduling effects and simplify endBulkUpload

**Files:**
- Modify: `src/renderer/App.tsx`

- [ ] **Step 1: Read the current App.tsx sections that need changing**

Read these line ranges in `src/renderer/App.tsx`:
- Lines 1-20 (imports)
- Lines 125-135 (useLogsForStats call site)
- Lines 239-241 (refs including statsSyncRecoveryAtRef)
- Lines 288-295 (useDetailsHydration call)
- Lines 377-419 (bulkCalculatingActive effects + scheduling effects)
- Lines 446-466 (endBulkUpload)
- Lines 525-566 (statsSyncRecovery effect)

- [ ] **Step 2: Remove the `statsSyncRecovery` import**

In `src/renderer/App.tsx`, delete this line:

```typescript
import { shouldAttemptStatsSyncRecovery } from './stats/utils/statsSyncRecovery';
```

- [ ] **Step 3: Add `scheduleDetailsHydrationRef` and update `useLogsForStats` call site**

Replace:

```typescript
    const {
        logsForStats,
        setLogsForStats,
        logsRef,
        bulkCalculatingActive,
        setBulkCalculatingActive,
    } = useLogsForStats({ logs, bulkUploadMode });
```

with:

```typescript
    const scheduleDetailsHydrationRef = useRef<(force?: boolean) => void>(() => {});
    const {
        logsForStats,
        setLogsForStats,
        logsRef,
    } = useLogsForStats({ logs, view, scheduleDetailsHydrationRef });
```

- [ ] **Step 4: Populate the ref after `useDetailsHydration`**

After the existing `useDetailsHydration` call (around line 288-295), add:

```typescript
    scheduleDetailsHydrationRef.current = scheduleDetailsHydration;
```

So the section reads:

```typescript
    const { fetchLogDetails, scheduleDetailsHydration } = useDetailsHydration({
        viewRef,
        logsRef,
        setLogs,
        setLogsDeferred,
        setLogsForStats,
        detailsCache: detailsCacheRef.current,
    });
    scheduleDetailsHydrationRef.current = scheduleDetailsHydration;
```

- [ ] **Step 5: Add `bulkCalculatingActive` state locally**

After the `useLogsForStats` call (before the `detailsCacheRef`), add:

```typescript
    const [bulkCalculatingActive, setBulkCalculatingActive] = useState(false);
```

The two effects that manage `bulkCalculatingActive` (lines 377-388) stay as-is — they depend on `bulkUploadMode` and `calculatingCount`, both local to App.tsx.

- [ ] **Step 6: Remove the 4 scheduling effects**

**Effect 1 (lines 390-395):** `isBulkUploadActive` transition → scheduleDetailsHydration.

Replace:
```typescript
    useEffect(() => {
        bulkUploadActiveRef.current = isBulkUploadActive;
        if (!isBulkUploadActive && view === 'stats') {
            scheduleDetailsHydration();
        }
    }, [isBulkUploadActive, view]);
```

with (keep only the ref sync):
```typescript
    useEffect(() => {
        bulkUploadActiveRef.current = isBulkUploadActive;
    }, [isBulkUploadActive]);
```

**Effect 2 (lines 397-399):** `bulkUploadModeRef` sync — keep as-is, this is just a ref sync:
```typescript
    useEffect(() => {
        bulkUploadModeRef.current = bulkUploadMode;
    }, [bulkUploadMode]);
```

**Effect 3 (lines 401-413):** `bulkUploadMode` + logs → scheduleDetailsHydration if pending — **DELETE entirely**.

**Effect 4 (lines 415-419):** view → stats → force scheduleDetailsHydration — **DELETE entirely**.

**Effect 5 (lines 530-566):** statsSyncRecovery — **DELETE entirely**.

- [ ] **Step 7: Remove `statsSyncRecoveryAtRef`**

Delete this line (around line 241):
```typescript
    const statsSyncRecoveryAtRef = useRef(0);
```

- [ ] **Step 8: Simplify `endBulkUpload`**

Replace:

```typescript
    const endBulkUpload = useCallback(() => {
        bulkUploadExpectedRef.current = null;
        bulkUploadCompletedRef.current = 0;
        setBulkUploadMode(false);
        // Publish logsForStats synchronously so the worker begins streaming in the
        // same React batch as bulkUploadMode=false — avoids a render where
        // StatsView sees statsDataProgress.total>0 but logs.length===0 ("0/65").
        bulkStatsAwaitingRef.current = true;
        setLogsForStats((prev) => {
            const source = prev === logsRef.current ? [...logsRef.current] : logsRef.current;
            return stripDetailsFromEntries(source);
        });
        const flushId = requestFlush?.();
        if (flushId) {
            bulkFlushIdRef.current = flushId;
        }
        // Single hydration pass — the isBulkUploadActive transition effect
        // will schedule another if needed.
        const hydrationDelay = viewRef.current === 'stats' ? 0 : 180;
        window.setTimeout(() => scheduleDetailsHydration(true), hydrationDelay);
    }, [scheduleDetailsHydration, requestFlush, setLogsForStats]);
```

with:

```typescript
    const endBulkUpload = useCallback(() => {
        bulkUploadExpectedRef.current = null;
        bulkUploadCompletedRef.current = 0;
        setBulkUploadMode(false);
        // Mark that we're awaiting the worker to catch up with the full log set.
        bulkStatsAwaitingRef.current = true;
        // Publish logsForStats synchronously so the worker begins streaming in the
        // same React batch as bulkUploadMode=false.
        setLogsForStats((prev) => {
            const source = prev === logsRef.current ? [...logsRef.current] : logsRef.current;
            return stripDetailsFromEntries(source);
        });
        const flushId = requestFlush?.();
        if (flushId) {
            bulkFlushIdRef.current = flushId;
        }
    }, [requestFlush, setLogsForStats]);
```

Removed: the manual `scheduleDetailsHydration` call and 0/180ms `setTimeout`. The hook's reactive effects handle hydration scheduling.

- [ ] **Step 9: Clean up any now-unused `scheduleDetailsHydration` references**

After the above changes, `scheduleDetailsHydration` (the direct function, not the ref) should only be used in:
1. The `useDetailsHydration` destructuring (line ~288) — keep
2. The ref assignment `scheduleDetailsHydrationRef.current = scheduleDetailsHydration` — keep

Verify no other direct uses remain. If `scheduleDetailsHydration` appears in any other dependency arrays or calls, remove those references.

- [ ] **Step 10: Run typecheck**

Run: `npx tsc --noEmit --pretty 2>&1 | head -40`
Expected: PASS (no errors). If there are unused variable warnings for `scheduleDetailsHydration`, that's fine — it's used for the ref assignment.

- [ ] **Step 11: Run unit tests**

Run: `npm run test:unit 2>&1 | tail -20`
Expected: Most tests pass. `statsSyncRecovery.test.ts` still exists (deleted in Task 3).

- [ ] **Step 12: Commit**

```bash
git add src/renderer/App.tsx
git commit -m "refactor: remove scheduling effects and statsSyncRecovery from App.tsx"
```

---

### Task 3: Delete `statsSyncRecovery.ts` and its test

**Files:**
- Delete: `src/renderer/stats/utils/statsSyncRecovery.ts`
- Delete: `src/renderer/__tests__/statsSyncRecovery.test.ts`

- [ ] **Step 1: Delete both files**

```bash
rm src/renderer/stats/utils/statsSyncRecovery.ts
rm src/renderer/__tests__/statsSyncRecovery.test.ts
```

- [ ] **Step 2: Check for any remaining imports**

Run: `grep -r "statsSyncRecovery" src/`
Expected: No matches (the import was removed from App.tsx in Task 2).

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: PASS

- [ ] **Step 4: Run full unit test suite**

Run: `npm run test:unit 2>&1 | tail -20`
Expected: All tests pass. The deleted test file is no longer discovered by vitest.

- [ ] **Step 5: Commit**

```bash
git add -u
git commit -m "refactor: delete statsSyncRecovery — scheduling coordinator makes it unnecessary"
```

---

### Task 4: Run full validation suite

**Files:** None (validation only)

- [ ] **Step 1: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: PASS (0 warnings)

- [ ] **Step 3: Run full unit test suite**

Run: `npm run test:unit 2>&1 | tail -30`
Expected: All tests pass

- [ ] **Step 4: Run regression tests**

Run: `npm run test:regression:stats 2>&1 | tail -20`
Expected: All regression tests pass

- [ ] **Step 5: Run boon/metrics audits**

Run: `npm run audit:boons && npm run audit:metrics`
Expected: Both pass

- [ ] **Step 6: Commit any lint/type fixes if needed, otherwise done**

If any validation step failed, fix the issue and re-run. Otherwise this task is complete.
