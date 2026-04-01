# Fix: Stats Worker Infinite Cycling During Details Hydration

**Date:** 2026-03-31
**Status:** Draft

## Problem

Users with 30+ logs on memory-constrained systems (16GB RAM) experience an infinite loading loop on the stats page. The progress counter cycles (e.g., 0→1→2→3→0→1→0) and never reaches completion.

### Root Cause

Two things run concurrently when the stats page opens with unhydrated logs:

1. **Worker streaming** — sends logs to the Web Worker via `postMessage` (1-4 per idle callback)
2. **Details hydration** — fetches EI JSON details from the main process via IPC (3 concurrent)

Every 8 hydrated details, `flushHydratedBatch()` calls `applyHydratedStatsBatch()` which directly calls `setLogsForStats(...)`, creating a new array reference. Since `logsForStats` is a dependency of the streaming effect in `useStatsAggregationWorker` (line 404), each new reference restarts the streaming from scratch — resetting progress to 0.

With 38 logs and a flush threshold of 8, this causes ~5 worker restarts during hydration. Each restart structured-clones log data to the worker via `postMessage`. The accumulated serialization overhead causes increasing memory pressure, making each cycle shorter until the renderer becomes unresponsive.

### Secondary Issue

`getPrunedLogForWorker` in `useStatsAggregationWorker.ts:117` does `const pruned = logWithDetails;` — no actual pruning. Each log's full EI JSON (5-10MB) is structured-cloned to the worker unchanged. With 38 logs, this is 190-380MB of serialization per streaming pass.

## Fix 1: Eliminate Worker Restarts During Hydration

### Change

Remove the `setLogsForStats` call from `applyHydratedStatsBatch` in `useDetailsHydration.ts`.

### Why This Is Safe

- Details are already stored in `DetailsCache` (LRU + IndexedDB) via `detailsCache.putSync()` at lines 240-241, before `applyHydratedStatsBatch` is called.
- The metadata flags (`statsDetailsLoaded`, `status: 'success'`) are already set on the main `logs` state via `setLogsDeferred` in `flushHydratedBatch` (lines 189-206).
- `hasPendingStatsDetails` in `useLogsForStats.ts:21` checks `detailsCache.peek()` first, so it reflects hydration progress without needing `logsForStats` to be updated mid-hydration.
- The force-touch at line 269 (`setLogsForStats((prev) => [...prev])`) already handles the single necessary `logsForStats` update after hydration completes, which triggers one worker streaming pass with a fully warm cache.

### Files Modified

- `src/renderer/app/hooks/useDetailsHydration.ts` — Remove `setLogsForStats` call body from `applyHydratedStatsBatch`, or simplify the function to only return without updating state.

### Result

Worker streaming starts once after hydration completes. Zero cycling during hydration. The user sees the "Loading fight details" progress bar during hydration, then the "X of Y fights loaded" worker streaming progress runs once to completion.

## Fix 2: Prune Log Details Before Sending to Worker

### Change

Replace the identity assignment in `getPrunedLogForWorker` with an actual pruning function that strips fields `computeStatsAggregation` does not read.

### Fields to Strip from `details`

| Field | Reason |
|---|---|
| `mechanics` | Boss mechanics data, unused in aggregation |
| `phases` | Phase breakdowns, unused (fights treated as whole) |
| `combatReplay` | Full replay data, unused (only `combatReplayMetaData` is read) |
| `chainMap` | Skill chain relationships, unused |
| `incomingDirections` | Attack direction data, unused |
| `playerList` | Alternative player list, unused |
| `npcList` | Alternative NPC list, unused |
| `evtc` | EVTC header data, unused |

### Fields to Strip from Each `details.players[]` Entry

| Field | Reason |
|---|---|
| `damage1S` | Per-second cumulative damage arrays, unused |
| `targetDamage1S` | Per-target per-second damage, unused |
| `targetDamageDist` | Per-target damage distributions, unused |
| `combatReplayData` | Replay position data, unused |
| `incomingDamageModifiers` | Not used in current aggregation |

### Implementation

A pure function `pruneDetailsForWorker(details: any): any` that:

1. Shallow-copies `details` using object rest/spread, excluding the blocked top-level keys
2. Maps `details.players` to new objects excluding the blocked per-player keys
3. Returns the pruned copy (no mutation of the original)

This function lives in `useStatsAggregationWorker.ts` as a module-level helper (not exported — internal to the hook). It replaces the `const pruned = logWithDetails;` line in `getPrunedLogForWorker`.

### Files Modified

- `src/renderer/stats/hooks/useStatsAggregationWorker.ts` — Add `pruneDetailsForWorker` function, use it in `getPrunedLogForWorker`.

### Expected Impact

Estimated 50-70% reduction in structured clone payload size per log, based on the stripped fields being the largest arrays in a typical WvW EI JSON (especially `damage1S`, `targetDamageDist`, and `combatReplayData`).

## Testing

### Unit Test: Pruning Function

New test file `src/renderer/stats/__tests__/pruneDetailsForWorker.test.ts`:

- Stripped detail-level fields are absent from output
- Stripped player-level fields are absent from output
- All retained fields are present and unchanged
- Players array is correctly mapped
- Input object is not mutated
- Edge cases: null/undefined details, missing players array, empty players array

### Integration Validation

Run existing audit suite after the change:

- `npm run audit:metrics`
- `npm run audit:boons`
- `npm run audit:conditions`

These audits compute metrics against test fixtures and will catch any regression from over-pruning.

### Manual Verification

The cycling bug requires 30+ logs on a memory-constrained system. Structural correctness of Fix 1 can be verified by confirming that `applyHydratedStatsBatch` no longer calls `setLogsForStats`, and that the force-touch at line 269 is the only `logsForStats` update during hydration.
