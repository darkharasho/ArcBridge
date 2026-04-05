# Details Status Discriminated Union Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 5 contradictory boolean fields on `ILogData` with a single `detailsStatus` discriminated union, making impossible states unrepresentable.

**Architecture:** Add a `DetailsStatus` type and `detailsStatus` field to `ILogData`, then migrate each consumer file one at a time. Keep the old booleans during migration (dual-write), then remove them in a final cleanup pass. The normalization code in `useLogQueue.ts` that fixes contradictory boolean combos becomes unnecessary and is deleted.

**Tech Stack:** TypeScript, React

**Spec:** `docs/superpowers/specs/2026-04-04-simplify-stats-pipeline-design.md` (item #2)

---

### File Map

| File | Role | Changes |
|------|------|---------|
| `src/renderer/global.d.ts` | Type definition | Add `DetailsStatus` type, add `detailsStatus` field, keep old booleans initially |
| `src/main/index.ts` | IPC sender (main process) | Set `detailsStatus` on upload-complete messages |
| `src/renderer/app/hooks/useDetailsHydration.ts` | Hydration logic | Write `detailsStatus` on all state transitions |
| `src/renderer/app/hooks/useLogQueue.ts` | Status normalization | Rewrite `normalizeQueuedLogStatus` to use `detailsStatus` |
| `src/renderer/app/hooks/useLogsForStats.ts` | Stats scheduling | Read `detailsStatus` instead of booleans |
| `src/renderer/app/hooks/useStatsDataProgress.ts` | Progress tracking | Read `detailsStatus` instead of booleans |
| `src/renderer/app/hooks/useDashboardStats.ts` | Cache invalidation | Read `detailsStatus` instead of `detailsAvailable` |
| `src/renderer/App.tsx` | Terminal state detection | Read `detailsStatus` instead of booleans |
| `src/renderer/ExpandableLogCard.tsx` | UI loading/available state | Read `detailsStatus` instead of booleans |
| `src/renderer/__tests__/useLogQueue.test.ts` | Tests | Update test data and assertions |

---

### Task 1: Add `DetailsStatus` type and `detailsStatus` field to `ILogData`

**Files:**
- Modify: `src/renderer/global.d.ts:362-394`

- [ ] **Step 1: Add the type and field**

In `src/renderer/global.d.ts`, add the `DetailsStatus` type BEFORE the `ILogData` interface (around line 361), and add the `detailsStatus` field inside `ILogData`:

```typescript
// Add before ILogData interface:
type DetailsStatus = 'idle' | 'loading' | 'available' | 'loaded' | 'exhausted' | 'unavailable';
```

Inside `ILogData`, add `detailsStatus` right after the existing boolean fields (line 375):

```typescript
    detailsLoading?: boolean;
    detailsAvailable?: boolean;
    statsDetailsLoaded?: boolean;
    detailsFetchExhausted?: boolean;
    detailsKnownUnavailable?: boolean;
    detailsStatus?: DetailsStatus;
```

The old booleans stay for now — we'll remove them after all consumers are migrated.

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -10`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/global.d.ts
git commit -m "feat: add DetailsStatus type and detailsStatus field to ILogData"
```

---

### Task 2: Set `detailsStatus` in main process upload handler

**Files:**
- Modify: `src/main/index.ts`

The main process sets details flags when uploads complete. We need to also set `detailsStatus`.

- [ ] **Step 1: Add `detailsStatus` to both upload-complete message paths**

In `src/main/index.ts`, find the two IPC message objects that set `detailsAvailable`, `detailsFetchExhausted`, `detailsKnownUnavailable` (around lines 603-606 and 616-619). Add `detailsStatus` to each:

At line ~604 (bulk upload path), after the `detailsKnownUnavailable` line:
```typescript
                    detailsAvailable: hasDetails,
                    detailsFetchExhausted: detailsKnownUnavailable,
                    detailsKnownUnavailable,
                    detailsStatus: detailsKnownUnavailable ? 'unavailable' as const : hasDetails ? 'available' as const : 'idle' as const,
```

At line ~617 (normal upload path), same addition:
```typescript
                    detailsAvailable: hasDetails,
                    detailsFetchExhausted: detailsKnownUnavailable,
                    detailsKnownUnavailable,
                    detailsStatus: detailsKnownUnavailable ? 'unavailable' as const : hasDetails ? 'available' as const : 'idle' as const,
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --pretty && npx tsc -p electron/tsconfig.json --noEmit --pretty 2>&1 | head -10`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/main/index.ts
git commit -m "feat: set detailsStatus in main process upload handler"
```

---

### Task 3: Write `detailsStatus` in `useDetailsHydration.ts`

**Files:**
- Modify: `src/renderer/app/hooks/useDetailsHydration.ts`

This file has the most writes to the boolean fields. Every state transition needs a corresponding `detailsStatus` write.

- [ ] **Step 1: Add `detailsStatus` to every state transition**

**Line 43** — fetch starts (loading):
```typescript
// OLD:
updated[idx] = { ...updated[idx], detailsLoading: true };
// NEW:
updated[idx] = { ...updated[idx], detailsLoading: true, detailsStatus: 'loading' as const };
```

**Lines 70-76** — terminal failure:
```typescript
// OLD:
updated[idx] = terminal
    ? {
        ...existing,
        detailsLoading: false,
        detailsAvailable: false,
        detailsFetchExhausted: true,
        detailsKnownUnavailable: true,
        status: existing.status === 'error' ? 'error' : 'success'
    }
    : { ...existing, detailsLoading: false };
// NEW:
updated[idx] = terminal
    ? {
        ...existing,
        detailsLoading: false,
        detailsAvailable: false,
        detailsFetchExhausted: true,
        detailsKnownUnavailable: true,
        detailsStatus: 'unavailable' as const,
        status: existing.status === 'error' ? 'error' : 'success'
    }
    : { ...existing, detailsLoading: false, detailsStatus: existing.detailsStatus === 'loading' ? 'idle' as const : existing.detailsStatus };
```

**Lines 91-100** — fetch success:
```typescript
// OLD:
updated[existingIndex] = {
    ...existing,
    detailsAvailable: true,
    statsDetailsLoaded: true,
    detailsLoading: false,
    detailsFetchExhausted: false,
};
// NEW:
updated[existingIndex] = {
    ...existing,
    detailsAvailable: true,
    statsDetailsLoaded: true,
    detailsLoading: false,
    detailsFetchExhausted: false,
    detailsStatus: 'loaded' as const,
};
```

**Lines 169-171** — batch flush success:
```typescript
// OLD:
detailsAvailable: true,
statsDetailsLoaded: true,
detailsFetchExhausted: false,
// NEW:
detailsAvailable: true,
statsDetailsLoaded: true,
detailsFetchExhausted: false,
detailsStatus: 'loaded' as const,
```

**Lines 269-271** — exhausted failures:
```typescript
// OLD:
detailsAvailable: false,
detailsFetchExhausted: true,
detailsKnownUnavailable: terminalFailures.has(filePath) || entry.detailsKnownUnavailable,
// NEW:
detailsAvailable: false,
detailsFetchExhausted: true,
detailsKnownUnavailable: terminalFailures.has(filePath) || entry.detailsKnownUnavailable,
detailsStatus: (terminalFailures.has(filePath) || entry.detailsKnownUnavailable) ? 'unavailable' as const : 'exhausted' as const,
```

- [ ] **Step 2: Migrate reads to use `detailsStatus`**

**Line 127** — skip if already loaded:
```typescript
// OLD:
if (log.statsDetailsLoaded) return false;
// NEW:
if (log.detailsStatus === 'loaded') return false;
```

**Line 128** — hydration candidate if available:
```typescript
// OLD:
if (log.detailsAvailable) return true;
// NEW:
if (log.detailsStatus === 'available') return true;
```

**Line 165** — skip already loaded in batch:
```typescript
// OLD:
if (entry.statsDetailsLoaded) return entry;
// NEW:
if (entry.detailsStatus === 'loaded') return entry;
```

**Line 262** — check exhausted state:
```typescript
// OLD:
if (entry.detailsFetchExhausted && !entry.detailsAvailable && entry.status !== 'calculating') {
// NEW:
if ((entry.detailsStatus === 'exhausted' || entry.detailsStatus === 'unavailable') && entry.status !== 'calculating') {
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -10`

- [ ] **Step 4: Commit**

```bash
git add src/renderer/app/hooks/useDetailsHydration.ts
git commit -m "refactor: write and read detailsStatus in useDetailsHydration"
```

---

### Task 4: Rewrite `normalizeQueuedLogStatus` in `useLogQueue.ts`

**Files:**
- Modify: `src/renderer/app/hooks/useLogQueue.ts`
- Modify: `src/renderer/__tests__/useLogQueue.test.ts`

The normalization function exists to fix contradictory boolean states. With `detailsStatus`, most of this becomes unnecessary. The only remaining logic is status promotion (`calculating` → `success` for terminal states, `success` → `calculating` for available details).

- [ ] **Step 1: Rewrite `normalizeQueuedLogStatus`**

Replace lines 3-29 of `src/renderer/app/hooks/useLogQueue.ts`:

```typescript
export const normalizeQueuedLogStatus = (candidate: ILogData): ILogData => {
    const ds = candidate.detailsStatus || 'idle';

    // Legacy boolean normalization (during migration — remove when booleans are deleted)
    if (candidate.detailsAvailable && candidate.detailsFetchExhausted) {
        candidate = { ...candidate, detailsFetchExhausted: false };
    }
    if (candidate.detailsAvailable && candidate.detailsKnownUnavailable) {
        candidate = { ...candidate, detailsKnownUnavailable: false };
    }

    // Promote calculating → success for terminal states where details will never arrive.
    const detailsTerminal = ds === 'exhausted' || ds === 'unavailable' || ds === 'idle';
    if (candidate.status === 'calculating' && detailsTerminal && !candidate.detailsAvailable) {
        return { ...candidate, status: 'success' as const };
    }

    // Demote success → calculating when details are available but not yet loaded.
    if (
        candidate.status === 'success'
        && (ds === 'available' || (candidate.detailsAvailable && !candidate.statsDetailsLoaded))
        && ds !== 'exhausted'
        && ds !== 'unavailable'
    ) {
        return { ...candidate, status: 'calculating' as const };
    }

    return candidate;
};
```

- [ ] **Step 2: Update tests in `useLogQueue.test.ts`**

Add `detailsStatus` to all test fixture objects. Read the test file first, then update each test case:

For the test `'clears contradictory flags when detailsAvailable'` (line ~8):
```typescript
const result = normalizeQueuedLogStatus({
    ...baseLog,
    status: 'success',
    detailsAvailable: true,
    detailsStatus: 'loaded',
} as ILogData);
```

For the test `'keeps calculating even with statsDetailsLoaded'` (line ~17):
```typescript
const result = normalizeQueuedLogStatus({
    ...baseLog,
    status: 'calculating',
    detailsAvailable: true,
    statsDetailsLoaded: true,
    detailsStatus: 'loaded',
} as ILogData);
```

For the test `'keeps calculating when detailsAvailable but stats not yet computed'` (line ~32):
```typescript
const result = normalizeQueuedLogStatus({
    ...baseLog,
    status: 'calculating',
    detailsAvailable: true,
    detailsStatus: 'available',
} as ILogData);
```

For the test about terminal promotion (line ~47):
```typescript
const result = normalizeQueuedLogStatus({
    ...baseLog,
    status: 'calculating',
    detailsAvailable: false,
    detailsFetchExhausted: true,
    detailsKnownUnavailable: true,
    detailsStatus: 'unavailable',
} as ILogData);
```

- [ ] **Step 3: Run tests**

Run: `npm run test:unit 2>&1 | tail -10`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/app/hooks/useLogQueue.ts src/renderer/__tests__/useLogQueue.test.ts
git commit -m "refactor: rewrite normalizeQueuedLogStatus to use detailsStatus"
```

---

### Task 5: Migrate `useLogsForStats.ts`

**Files:**
- Modify: `src/renderer/app/hooks/useLogsForStats.ts`

- [ ] **Step 1: Replace boolean reads with `detailsStatus` checks**

**Lines 21-26** — `hasPendingStatsDetails`:
```typescript
// OLD:
const hasPendingStatsDetails = logs.some((log) => {
    if (detailsCache?.peek(log.id) || log.statsDetailsLoaded) return false;
    if (log.detailsKnownUnavailable) return false;
    if (log.detailsAvailable) return true;
    return (log.status === 'success' || log.status === 'calculating' || log.status === 'discord') && Boolean(log.permalink) && !log.detailsFetchExhausted;
});

// NEW:
const hasPendingStatsDetails = logs.some((log) => {
    const ds = log.detailsStatus || 'idle';
    if (detailsCache?.peek(log.id) || ds === 'loaded') return false;
    if (ds === 'unavailable' || ds === 'exhausted') return false;
    if (ds === 'available') return true;
    return (log.status === 'success' || log.status === 'calculating' || log.status === 'discord') && Boolean(log.permalink) && ds !== 'exhausted';
});
```

**Lines 71-77** — `mergeLogsForStatsSnapshot` (carry forward `detailsStatus`):
```typescript
// OLD:
const shouldCarryStatsLoaded = !entry.statsDetailsLoaded && !!previousEntry.statsDetailsLoaded;
if (!shouldCarryStatsLoaded) {
    return entry;
}
changed = true;
const nextEntry: ILogData = { ...entry };
nextEntry.statsDetailsLoaded = true;

// NEW:
const shouldCarryStatsLoaded = entry.detailsStatus !== 'loaded' && previousEntry.detailsStatus === 'loaded';
if (!shouldCarryStatsLoaded) {
    return entry;
}
changed = true;
const nextEntry: ILogData = { ...entry };
nextEntry.statsDetailsLoaded = true;
nextEntry.detailsStatus = 'loaded';
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -10`

- [ ] **Step 3: Commit**

```bash
git add src/renderer/app/hooks/useLogsForStats.ts
git commit -m "refactor: migrate useLogsForStats to detailsStatus"
```

---

### Task 6: Migrate `useStatsDataProgress.ts`

**Files:**
- Modify: `src/renderer/app/hooks/useStatsDataProgress.ts`

- [ ] **Step 1: Replace boolean reads**

Replace lines 38-51 of the `forEach` callback:

```typescript
// OLD:
logs.forEach((log) => {
    if (log.detailsAvailable || log.statsDetailsLoaded) {
        return;
    }
    if (log.detailsKnownUnavailable) {
        unavailable += 1;
        return;
    }
    if (log.detailsAvailable) {
        pending += 1;
        return;
    }
    const status = log.status || 'queued';
    const canHydrateFromPermalink = (status === 'success' || status === 'calculating' || status === 'discord') && Boolean(log.permalink) && !log.detailsFetchExhausted;

// NEW:
logs.forEach((log) => {
    const ds = log.detailsStatus || 'idle';
    if (ds === 'available' || ds === 'loaded') {
        return;
    }
    if (ds === 'unavailable') {
        unavailable += 1;
        return;
    }
    if (ds === 'exhausted') {
        unavailable += 1;
        return;
    }
    const status = log.status || 'queued';
    const canHydrateFromPermalink = (status === 'success' || status === 'calculating' || status === 'discord') && Boolean(log.permalink) && ds !== 'exhausted';
```

- [ ] **Step 2: Verify it compiles and tests pass**

Run: `npx tsc --noEmit --pretty 2>&1 | head -10 && npm run test:unit 2>&1 | tail -10`

- [ ] **Step 3: Commit**

```bash
git add src/renderer/app/hooks/useStatsDataProgress.ts
git commit -m "refactor: migrate useStatsDataProgress to detailsStatus"
```

---

### Task 7: Migrate `App.tsx` and remaining files

**Files:**
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/app/hooks/useDashboardStats.ts`
- Modify: `src/renderer/ExpandableLogCard.tsx`

- [ ] **Step 1: Migrate `App.tsx`**

**Lines 272, 350, 364** — terminal state detection (3 identical patterns):
```typescript
// OLD:
const detailsWontArrive = Boolean(log.detailsFetchExhausted || log.detailsKnownUnavailable);
// NEW:
const ds = log.detailsStatus || 'idle';
const detailsWontArrive = ds === 'exhausted' || ds === 'unavailable';
```

Apply this to all three locations (lines ~272, ~350, ~364). Note: use `entry.detailsStatus` for lines 350/364 where the variable is `entry` not `log`.

**Lines 401-403** — pending hydration check:
```typescript
// OLD:
if (detailsCacheRef.current?.peek(log.id) || log.statsDetailsLoaded) return false;
if (log.detailsFetchExhausted || log.detailsKnownUnavailable) return false;
if (log.detailsAvailable) return true;
// NEW:
const ds = log.detailsStatus || 'idle';
if (detailsCacheRef.current?.peek(log.id) || ds === 'loaded') return false;
if (ds === 'exhausted' || ds === 'unavailable') return false;
if (ds === 'available') return true;
```

- [ ] **Step 2: Migrate `useDashboardStats.ts`**

**Lines 98, 105** — cache invalidation using `detailsAvailable`:
```typescript
// OLD (line 98):
&& cached.detailsAvailable === log.detailsAvailable
// NEW:
&& cached.detailsStatus === log.detailsStatus

// OLD (line 105):
detailsAvailable: log.detailsAvailable,
// NEW:
detailsStatus: log.detailsStatus,
```

Also update the cache type (wherever it defines the cached entry shape) — change `detailsAvailable` to `detailsStatus` in the type.

- [ ] **Step 3: Migrate `ExpandableLogCard.tsx`**

**Line 87** — cancellable check:
```typescript
// OLD:
const isCancellable = Boolean(!log.detailsAvailable && !isExpanded && onCancel && (isQueued || isPending || isUploading || isRetrying));
// NEW:
const ds = log.detailsStatus || 'idle';
const detailsNotReady = ds !== 'available' && ds !== 'loaded';
const isCancellable = Boolean(detailsNotReady && !isExpanded && onCancel && (isQueued || isPending || isUploading || isRetrying));
```

**Line 896** — disabled state:
```typescript
// OLD:
disabled={Boolean(log.detailsLoading) || (!log.detailsAvailable && !isExpanded && !onCancel)}
// NEW:
disabled={ds === 'loading' || (detailsNotReady && !isExpanded && !onCancel)}
```

**Line 899** — loading style:
```typescript
// OLD:
: log.detailsLoading
// NEW:
: ds === 'loading'
```

**Line 901** — unavailable style:
```typescript
// OLD:
: !log.detailsAvailable && !isExpanded && !onCancel
// NEW:
: detailsNotReady && !isExpanded && !onCancel
```

**Line 908** — loading text:
```typescript
// OLD:
) : log.detailsLoading ? (
// NEW:
) : ds === 'loading' ? (
```

- [ ] **Step 4: Verify it compiles and all tests pass**

Run: `npx tsc --noEmit --pretty 2>&1 | head -10 && npm run test:unit 2>&1 | tail -10`

- [ ] **Step 5: Commit**

```bash
git add src/renderer/App.tsx src/renderer/app/hooks/useDashboardStats.ts src/renderer/ExpandableLogCard.tsx
git commit -m "refactor: migrate App, useDashboardStats, and ExpandableLogCard to detailsStatus"
```

---

### Task 8: Remove old boolean fields from `ILogData`

**Files:**
- Modify: `src/renderer/global.d.ts`

- [ ] **Step 1: Remove the 5 boolean fields**

In `src/renderer/global.d.ts`, remove these lines from `ILogData`:
```typescript
    detailsLoading?: boolean;
    detailsAvailable?: boolean;
    statsDetailsLoaded?: boolean;
    detailsFetchExhausted?: boolean;
    detailsKnownUnavailable?: boolean;
```

Make `detailsStatus` non-optional:
```typescript
    detailsStatus: DetailsStatus;
```

- [ ] **Step 2: Fix all type errors**

Run `npx tsc --noEmit --pretty` and fix every error. Each error will be a reference to a removed field. The fix for each is:
- **Write sites**: Remove the old boolean writes (the `detailsStatus` write was added in previous tasks)
- **Read sites**: Should already be migrated (done in Tasks 3-7). If any remain, replace them.
- **Test fixtures**: Add `detailsStatus` to test fixture objects that create `ILogData`.

Common patterns:
- `{ ...existing, detailsAvailable: true, statsDetailsLoaded: true }` → just set `detailsStatus: 'loaded'`
- `{ ...existing, detailsFetchExhausted: true }` → just set `detailsStatus: 'exhausted'`
- `{ ...existing, detailsLoading: true }` → just set `detailsStatus: 'loading'`

- [ ] **Step 3: Remove normalization code that fixed contradictory states**

In `src/renderer/app/hooks/useLogQueue.ts`, remove the legacy boolean normalization lines:

```typescript
// DELETE these lines from normalizeQueuedLogStatus:
if (candidate.detailsAvailable && candidate.detailsFetchExhausted) {
    candidate = { ...candidate, detailsFetchExhausted: false };
}
if (candidate.detailsAvailable && candidate.detailsKnownUnavailable) {
    candidate = { ...candidate, detailsKnownUnavailable: false };
}
```

Also simplify the terminal check:
```typescript
// Simplify:
const detailsTerminal = ds === 'exhausted' || ds === 'unavailable' || ds === 'idle';
if (candidate.status === 'calculating' && detailsTerminal) {
    return { ...candidate, status: 'success' as const };
}
```

- [ ] **Step 4: Verify it compiles and all tests pass**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20 && npm run test:unit 2>&1 | tail -10`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: remove legacy details boolean fields from ILogData — detailsStatus is sole source of truth"
```

---

### Task 9: Final validation

- [ ] **Step 1: Run full validation**

Run: `npm run validate 2>&1 | tail -20`
Expected: Typecheck and lint both pass.

- [ ] **Step 2: Run all unit tests**

Run: `npm run test:unit 2>&1 | tail -20`
Expected: All pass.

- [ ] **Step 3: Run regression tests**

Run: `npm run test:regression:stats 2>&1 | tail -15`
Expected: All pass.

- [ ] **Step 4: Verify no remaining references to old booleans**

Run: `grep -rn "detailsLoading\|detailsAvailable\|statsDetailsLoaded\|detailsFetchExhausted\|detailsKnownUnavailable" src/ --include="*.ts" --include="*.tsx" | grep -v "node_modules" | grep -v ".test."`
Expected: No matches in source files (test files may still reference them in describe strings, which is fine).
