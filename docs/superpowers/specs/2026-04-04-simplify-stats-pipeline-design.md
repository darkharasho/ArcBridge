# Simplify Stats Calculation Pipeline

**Date:** 2026-04-04
**Branch:** `simplify-stats-pipeline`

## Problem

The stats pipeline is ~10,000 lines across 20+ files with several architectural issues that hurt accuracy (dual codepaths), stability (fragile scheduling, contradictory state flags), and maintainability. The core computation logic is sound but the orchestration layer above it is unnecessarily complex.

## Goals

1. **Accurate** - single source of truth for computation, no dual-path divergence
2. **Performant** - no OOM, no unnecessary work (redundant sorts, wasted worker instances)
3. **Stable** - no impossible states, no band-aid recovery mechanisms, no reshuffling

## Changes

### 1. Delete batch `computeStatsAggregation.ts` — use `IncrementalAggregator` everywhere

**Problem:** `computeStatsAggregation.ts` (870 lines) and `incrementalAggregation.ts` (1,378 lines) implement the same aggregation logic in two different ways. The incremental file comments acknowledge this: `// replicating computeStatsAggregation lines 194-860`. Any bug fix or metric change must be applied in both places.

**Change:**
- Delete `computeStatsAggregation.ts`
- Update all callsites to use `IncrementalAggregator` instead:
  - `useStatsAggregationWorker.ts` lines 86/88 (small-log fast path): replace `computeStatsAggregation()` with synchronous `IncrementalAggregator` ingest+finalize
  - `useStatsAggregation.ts`: same replacement
  - `statsWorker.ts`: already uses `IncrementalAggregator`
- Update tests in `incrementalAggregation.test.ts` that import batch function for parity comparison — the parity test becomes unnecessary (delete it), keep the behavioral tests
- Export a convenience function `computeStatsAggregationSync` from `incrementalAggregation.ts` that wraps `new IncrementalAggregator(opts) → ingestLog each → finalize()` for simple callsites

**Risk:** Low. Existing parity test proves identical output. The incremental path is already the primary path for all worker-based computation.

### 2. Replace details status booleans with discriminated union

**Problem:** `ILogData` has 5 booleans for details status: `detailsAvailable`, `statsDetailsLoaded`, `detailsLoading`, `detailsFetchExhausted`, `detailsKnownUnavailable`. These can contradict each other and are checked in different combinations across the codebase.

**Change:**
- Define `DetailsStatus` union type in `global.d.ts`:
  ```typescript
  type DetailsStatus =
    | 'idle'
    | 'loading'
    | 'cached'
    | 'exhausted'
    | 'unavailable'
  ```
- Add `detailsStatus: DetailsStatus` to `ILogData`
- Replace all boolean checks with status checks throughout the codebase
- Remove the 5 old boolean fields
- Migration: map old boolean combos to new statuses in any persistence/load path

**Risk:** Medium — touches many files. But each change is mechanical (boolean check → status check). Impossible states become unrepresentable.

### 3. Consolidate hydration scheduling into single coordinator

**Problem:** Details hydration is triggered from 4+ separate locations with overlapping timers (400ms debounce, 600ms retry, 300ms length-mismatch follow-up, 1.5s sync recovery). `statsSyncRecovery.ts` exists solely to detect when this choreography fails.

**Change:**
- Create `useStatsCoordinator` hook that owns all scheduling decisions:
  - Single debounced publish (300ms) when logs change, details arrive, or bulk upload ends
  - One decision point, one timer
- Remove `statsSyncRecovery.ts` entirely — it exists because scheduling is fragile
- Remove the multi-timer logic from `useLogsForStats` (400ms + 600ms retry + 300ms follow-up)
- The coordinator replaces the scattered `scheduleDetailsHydration()` calls in App.tsx

**Risk:** Medium — behavioral change. Must verify no regressions in upload flows and view switching.

### 4. Explicit `embedded` flag on StatsView

**Problem:** StatsView resolves stats from three sources: zustand store > external prop > internal hook. For desktop, it always reads from store. The internal hook creates a dummy worker even when unused.

**Change:**
- Add `embedded?: boolean` prop to StatsView (true when used in web report)
- When `!embedded`: read from zustand store, don't instantiate internal worker
- When `embedded`: receive result as prop, no store access
- Remove the triple-resolution fallback chain

**Risk:** Low — clarifies existing behavior.

### 5. Deduplicate per-second/per-minute leaderboard sorts

**Problem:** 14 metrics x 3 variants (raw, per-second, per-minute) = 42 independent sorts. Per-second and per-minute are monotonic transforms — rank order is identical to raw.

**Change:**
- Compute raw leaderboards (14 sorts)
- For per-second/per-minute variants, reuse raw rank order and only transform the values
- This cuts sort operations from 42 to 14

**Risk:** Low — mathematical invariant (monotonic transform preserves order).

### 6. Use `resolveProfessionLabel` everywhere

**Problem:** Profession resolution logic (find primary profession from `professionTimeMs` map) is copy-pasted in 3 places.

**Change:**
- Use the existing `resolveProfessionLabel` export from `computePlayerAggregation.ts` in all locations
- Mostly falls out naturally from change #1 (deleting batch mode removes one copy)

**Risk:** Trivial.

## What NOT to change

- Worker/main-thread split at 8 logs — sound heuristic
- `requestIdleCallback` streaming — good for UI responsiveness
- LRU cache and WeakRef pruning — well-tuned memory management
- Accumulator pattern (`create → ingest → finalize`) — clean and extensible
- Individual `compute*.ts` module decomposition — good separation of concerns

## Implementation Order

1. **#1** (delete batch mode) — biggest payoff, lowest risk, existing parity test is safety net
2. **#5** (leaderboard dedup) — small, contained, easy win
3. **#6** (profession label) — trivial, falls out of #1
4. **#4** (embedded flag) — small, contained
5. **#2** (details status union) — medium effort, high stability impact
6. **#3** (scheduling coordinator) — highest risk, do last with full test coverage

## Testing Strategy

- Existing `incrementalAggregation.test.ts` tests validate aggregation correctness
- `npm run test:regression:stats` validates metric accuracy against fixtures
- `npm run audit:*` scripts validate metric consistency
- E2E tests (`test:e2e:electron`, `test:e2e:web`) validate end-to-end flows
- Manual smoke test with bulk upload (20+ logs) to verify no OOM or stuck states
