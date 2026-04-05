# Consolidate Hydration Scheduling

## Goal

Replace the fragile multi-timer scheduling system (7 timers across 4 files, 5 `scheduleDetailsHydration` call sites in App.tsx) with a single reactive publish model inside `useLogsForStats`. Delete `statsSyncRecovery.ts`. Remove bulk-upload gating from the scheduling path.

## Problem

The current system coordinates hydration-to-stats flow via temporal barriers: 400ms debounce, 600ms retry, 300ms follow-up, 0-180ms post-bulk delay, and 1500ms recovery rate limit. These timers interact unpredictably under load, creating race conditions that `statsSyncRecovery` papers over. The timers were added incrementally to fix specific bugs, but collectively they form a fragile state machine that's hard to reason about.

## Key Insight

`publishLogsForStats` already has `buildStatsSnapshotKey` — if the snapshot hasn't meaningfully changed, it returns `prev` and React doesn't re-render. This deduplication makes debouncing unnecessary for correctness. Rapid publishes are effectively free because the key check short-circuits before any expensive work.

## Design

### Approach: Merge scheduling into `useLogsForStats`

No new files or abstractions. The hook that already owns the publish decision absorbs the scheduling triggers that currently live in App.tsx.

### `useLogsForStats` changes

**Interface change:**
- Remove: `bulkUploadMode` input
- Add: `view` input, `scheduleDetailsHydration` input

**Timer deletions (all 3):**
- `statsBatchTimerRef` (400ms debounce) — snapshot key deduplicates
- Nested 600ms retry timer — pending-resolved effect handles this
- `lengthMismatchFollowUpRef` (300ms follow-up) — immediate publish covers this

**Effects (reduced to 2):**

1. **Logs-changed effect:** When `logs` changes, call `publishLogsForStats(logs)`. No bulk gating, no debounce. Snapshot key deduplication prevents unnecessary recomputes.

2. **Pending-details-resolved effect:** When `hasPendingStatsDetails` transitions to `false`, publish once to pick up newly cached details. If view is `'stats'` and there are pending details, trigger `scheduleDetailsHydration`.

**Removals:**
- `bulkCalculatingActive` and `setBulkCalculatingActive` are removed from the hook's return value. The two effects that manage this state (App.tsx lines 377-388) already live in App.tsx and use `calculatingCount` + `bulkUploadMode` — they stay as-is since they're UI-only.
- Cleanup effect deleted (no timers to clear)

### App.tsx changes

**5 `scheduleDetailsHydration` call sites removed:**

1. Lines 390-395 (`isBulkUploadActive` transition → hydrate) — hook handles reactively
2. Lines 401-413 (`bulkUploadMode` + logs → hydrate if pending) — hook's logs-changed effect covers this
3. Lines 415-419 (view → stats → force hydrate) — hook receives `view`, handles this
4. Lines 530-566 (statsSyncRecovery → force publish + hydrate) — deleted entirely
5. Line 465 in `endBulkUpload` (0-180ms delayed hydrate) — reactive flow handles this

**`endBulkUpload` simplification:**

Removes manual `setLogsForStats` publish and `scheduleDetailsHydration` call. Just sets `bulkUploadMode = false` and requests a flush. The hook's reactive logs-changed effect publishes automatically.

**Deletions from App.tsx:**
- `statsSyncRecoveryAtRef`
- Import of `shouldAttemptStatsSyncRecovery`
- 4 scheduling effects (lines 390-419 and 530-566)

### `useDetailsHydration` — no changes

Stays as-is. The 260ms retry timer is an internal fetch-loop detail, not a scheduling concern. The only change is who calls `scheduleDetailsHydration` — the hook via `useLogsForStats` instead of App.tsx directly.

### File deletions

- `src/renderer/stats/utils/statsSyncRecovery.ts` (41 lines)
- `src/renderer/__tests__/statsSyncRecovery.test.ts`

## Testing

- Delete `statsSyncRecovery.test.ts`
- Remove `bulkUploadMode` from any `useLogsForStats` test fixtures
- Add test: publish suppressed when snapshot key unchanged (verify dedup)
- Existing regression suite (`npm run test:regression:stats`) validates computation correctness

## Net effect

| Metric | Before | After |
|--------|--------|-------|
| Timers in scheduling path | 7 | 1 (hydration retry, internal to fetch loop) |
| `scheduleDetailsHydration` call sites in App.tsx | 5 | 0 |
| Files involved in scheduling | 4 | 2 (`useLogsForStats`, `App.tsx`) |
| `statsSyncRecovery.ts` | 41 lines | deleted |
| Bulk mode references in scheduling | 6 | 0 |
