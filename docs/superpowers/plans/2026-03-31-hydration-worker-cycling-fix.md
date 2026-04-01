# Hydration-Worker Cycling Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the infinite loading loop on the stats page caused by details hydration restarting the Web Worker during streaming.

**Architecture:** Two changes: (1) Remove `setLogsForStats` from `applyHydratedStatsBatch` so hydration doesn't interrupt worker streaming. (2) Add a `pruneDetailsForWorker` function that strips large unused fields before structured-cloning logs to the worker, reducing memory pressure.

**Tech Stack:** React hooks, Web Workers, vitest

**Spec:** `docs/superpowers/specs/2026-03-31-hydration-worker-cycling-fix-design.md`

**Correction from spec:** The original spec listed several fields as safe to strip that are actually used by `computeStatsAggregation` (which runs inside the worker). The corrected pruning list below reflects what's actually unused. The main-process pruning in `src/main/detailsProcessing.ts` already strips the largest offenders; this worker-side pruning handles the remainder.

---

### Task 1: Remove `setLogsForStats` from `applyHydratedStatsBatch`

**Files:**
- Modify: `src/renderer/app/hooks/useDetailsHydration.ts:25-70`

- [ ] **Step 1: Simplify `applyHydratedStatsBatch` to a no-op**

Replace the entire `setLogsForStats(...)` call body with a simple return. The details are already cached via `detailsCache.putSync()` before this function is called, and the main `logs` state is updated by `setLogsDeferred` in `flushHydratedBatch`. The force-touch at line 269 handles the single necessary `logsForStats` restart after hydration completes.

In `src/renderer/app/hooks/useDetailsHydration.ts`, replace lines 25-70:

```typescript
    const applyHydratedStatsBatch = useCallback((_batch: Array<{ filePath: string; details: any }>) => {
        // No-op: details are already in DetailsCache (putSync'd before this call).
        // The main `logs` state gets metadata flags via setLogsDeferred in flushHydratedBatch.
        // The force-touch after hydration completes (setLogsForStats((prev) => [...prev]))
        // triggers the single worker restart with a fully warm cache.
        //
        // Previously this called setLogsForStats to update statsDetailsLoaded flags,
        // but that created new array references every 8 hydrated details, restarting
        // the worker streaming effect and causing an infinite cycling loop on
        // memory-constrained systems with 30+ logs.
    }, []);
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS — the function signature is unchanged, only the body changed.

- [ ] **Step 3: Run existing unit tests**

Run: `npm run test:unit`
Expected: PASS — no test depends on `applyHydratedStatsBatch` mutating `logsForStats` mid-hydration.

- [ ] **Step 4: Run audit suite**

Run: `npm run audit:metrics && npm run audit:boons && npm run audit:conditions`
Expected: PASS — metric values are unchanged since the computation itself is untouched.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/app/hooks/useDetailsHydration.ts
git commit -m "fix: stop hydration batch flushes from restarting worker streaming

applyHydratedStatsBatch previously called setLogsForStats every 8 hydrated
details, creating new array references that restarted the worker streaming
effect. On memory-constrained systems with 30+ logs this caused an infinite
cycling loop (progress counter resetting to 0 repeatedly).

Details are already cached via detailsCache.putSync before the batch flush,
and the force-touch after hydration completes handles the single necessary
worker restart."
```

---

### Task 2: Add `pruneDetailsForWorker` function with tests

**Files:**
- Create: `src/renderer/stats/__tests__/pruneDetailsForWorker.test.ts`
- Modify: `src/renderer/stats/hooks/useStatsAggregationWorker.ts:104-124`

The main-process pruning (`src/main/detailsProcessing.ts`) already strips the largest unused fields before IPC. This worker-side pruning strips the remaining fields that survive IPC but aren't read by `computeStatsAggregation`:

**Per-player fields to strip (confirmed zero references in stats computation):**
- `combatReplayData` (~16KB/player) — replay position data, only used in timeline viz
- `targetBreakbarDamage1S` (~10KB/player) — zero references in `src/`
- `squadBuffVolumesActive` (~14KB/player) — zero references in `src/`

**Top-level fields to strip:**
- `phases` — phase breakdowns, not used (fights treated as whole)
- `logErrors` — parser error list, not used in stats

**Estimated savings:** ~2.1MB per log × 38 logs = ~80MB reduction in structured clone overhead.

- [ ] **Step 1: Write the unit test**

Create `src/renderer/stats/__tests__/pruneDetailsForWorker.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { pruneDetailsForWorker } from '../hooks/useStatsAggregationWorker';

describe('pruneDetailsForWorker', () => {
    const makeDetails = () => ({
        // Retained top-level fields
        players: [
            {
                account: 'Player.1234',
                name: 'TestChar',
                profession: 'Guardian',
                dpsAll: [{ damage: 100 }],
                defenses: [{ damageTaken: 50 }],
                support: [{ condiCleanse: 3 }],
                rotation: [{ id: 1, skills: [] }],
                totalDamageDist: [[{ id: 1, totalDamage: 100 }]],
                targetDamageDist: [[{ id: 1, totalDamage: 80 }]],
                targetDamage1S: [[[0, 10, 20]]],
                incomingDamageModifiers: [{ id: 1 }],
                damageTaken1S: [[0, 5, 10]],
                // Fields that should be stripped
                combatReplayData: { start: 0, positions: Array(500).fill([0, 0]) },
                targetBreakbarDamage1S: [[[0, 1, 2]]],
                squadBuffVolumesActive: [{ id: 1, buffs: [] }],
            }
        ],
        targets: [{ name: 'Enemy', isFake: false, buffs: [] }],
        skillMap: { s1: { name: 'Skill' } },
        buffMap: { b1: { name: 'Buff' } },
        durationMS: 60000,
        success: true,
        fightName: 'Test Fight',
        damageModMap: { d1: { name: 'Mod' } },
        combatReplayMetaData: { inchToPixel: 1 },
        // Fields that should be stripped
        phases: [{ name: 'Full Fight', start: 0, end: 60000 }],
        logErrors: ['some parser warning'],
    });

    it('strips top-level denied fields', () => {
        const input = makeDetails();
        const result = pruneDetailsForWorker(input);
        expect(result.phases).toBeUndefined();
        expect(result.logErrors).toBeUndefined();
    });

    it('retains top-level used fields', () => {
        const input = makeDetails();
        const result = pruneDetailsForWorker(input);
        expect(result.skillMap).toEqual(input.skillMap);
        expect(result.buffMap).toEqual(input.buffMap);
        expect(result.targets).toEqual(input.targets);
        expect(result.durationMS).toBe(60000);
        expect(result.success).toBe(true);
        expect(result.fightName).toBe('Test Fight');
        expect(result.damageModMap).toEqual(input.damageModMap);
        expect(result.combatReplayMetaData).toEqual(input.combatReplayMetaData);
    });

    it('strips per-player denied fields', () => {
        const input = makeDetails();
        const result = pruneDetailsForWorker(input);
        const player = result.players[0];
        expect(player.combatReplayData).toBeUndefined();
        expect(player.targetBreakbarDamage1S).toBeUndefined();
        expect(player.squadBuffVolumesActive).toBeUndefined();
    });

    it('retains per-player used fields', () => {
        const input = makeDetails();
        const result = pruneDetailsForWorker(input);
        const player = result.players[0];
        expect(player.account).toBe('Player.1234');
        expect(player.dpsAll).toEqual([{ damage: 100 }]);
        expect(player.rotation).toEqual(input.players[0].rotation);
        expect(player.targetDamageDist).toEqual(input.players[0].targetDamageDist);
        expect(player.targetDamage1S).toEqual(input.players[0].targetDamage1S);
        expect(player.incomingDamageModifiers).toEqual(input.players[0].incomingDamageModifiers);
        expect(player.damageTaken1S).toEqual(input.players[0].damageTaken1S);
    });

    it('does not mutate the input', () => {
        const input = makeDetails();
        const originalPhases = input.phases;
        const originalReplay = input.players[0].combatReplayData;
        pruneDetailsForWorker(input);
        expect(input.phases).toBe(originalPhases);
        expect(input.players[0].combatReplayData).toBe(originalReplay);
    });

    it('handles null/undefined details', () => {
        expect(pruneDetailsForWorker(null)).toBeNull();
        expect(pruneDetailsForWorker(undefined)).toBeUndefined();
    });

    it('handles missing players array', () => {
        const input = { durationMS: 1000, success: true };
        const result = pruneDetailsForWorker(input);
        expect(result.durationMS).toBe(1000);
        expect(result.players).toBeUndefined();
    });

    it('handles empty players array', () => {
        const input = { players: [], durationMS: 1000 };
        const result = pruneDetailsForWorker(input);
        expect(result.players).toEqual([]);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/stats/__tests__/pruneDetailsForWorker.test.ts`
Expected: FAIL — `pruneDetailsForWorker` is not exported yet.

- [ ] **Step 3: Implement `pruneDetailsForWorker` and integrate into `getPrunedLogForWorker`**

In `src/renderer/stats/hooks/useStatsAggregationWorker.ts`, add the pruning function before the hook definition (module-level, exported for testing) and update `getPrunedLogForWorker` to use it.

Add before `export const useStatsAggregationWorker`:

```typescript
const DETAILS_TOP_LEVEL_DENY = ['phases', 'logErrors'];
const PLAYER_DENY = ['combatReplayData', 'targetBreakbarDamage1S', 'squadBuffVolumesActive'];

/** Strip fields not needed by computeStatsAggregation before structured-cloning to the worker. */
export const pruneDetailsForWorker = (details: any): any => {
    if (!details || typeof details !== 'object') return details;
    const pruned: any = {};
    for (const key of Object.keys(details)) {
        if (!DETAILS_TOP_LEVEL_DENY.includes(key)) {
            pruned[key] = details[key];
        }
    }
    if (Array.isArray(pruned.players)) {
        pruned.players = pruned.players.map((player: any) => {
            if (!player || typeof player !== 'object') return player;
            const p: any = {};
            for (const key of Object.keys(player)) {
                if (!PLAYER_DENY.includes(key)) {
                    p[key] = player[key];
                }
            }
            return p;
        });
    }
    return pruned;
};
```

Then update `getPrunedLogForWorker` inside the hook — replace line 117:

```typescript
    const getPrunedLogForWorker = (log: any, details: any, index: number) => {
        const logWithDetails = details ? { ...log, details: pruneDetailsForWorker(details) } : log;
        const cacheKey = String(log?.filePath || log?.id || `idx-${index}`);
        const detailsRef = details && typeof details === 'object' ? details : null;
        const cached = prunedLogCacheRef.current.get(cacheKey);
        if (cached) {
            if (detailsRef && cached.sourceDetails === detailsRef) {
                return cached.pruned;
            }
            if (!detailsRef && cached.sourceLog === logWithDetails) {
                return cached.pruned;
            }
        }
        const pruned = logWithDetails;
        prunedLogCacheRef.current.set(cacheKey, {
            sourceLog: logWithDetails,
            sourceDetails: detailsRef,
            pruned
        });
        return pruned;
    };
```

Key change: `{ ...log, details }` → `{ ...log, details: pruneDetailsForWorker(details) }`. The cache logic remains the same — it caches based on the source `details` reference, so the same input details object always returns the same pruned result without re-pruning.

- [ ] **Step 4: Run the pruning test**

Run: `npx vitest run src/renderer/stats/__tests__/pruneDetailsForWorker.test.ts`
Expected: PASS — all 7 test cases green.

- [ ] **Step 5: Run full test suite and audits**

Run: `npm run test:unit && npm run audit:metrics && npm run audit:boons && npm run audit:conditions`
Expected: PASS — pruning only removes fields not accessed by the stats computation.

- [ ] **Step 6: Run typecheck and lint**

Run: `npm run validate`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/renderer/stats/hooks/useStatsAggregationWorker.ts src/renderer/stats/__tests__/pruneDetailsForWorker.test.ts
git commit -m "perf: prune unused detail fields before structured-cloning to worker

getPrunedLogForWorker previously sent the full post-IPC details object to
the web worker unchanged. Now strips combatReplayData, targetBreakbarDamage1S,
squadBuffVolumesActive (per-player) and phases, logErrors (top-level) before
the postMessage structured clone.

Saves ~2.1MB per log (with 53-player WvW fights), reducing total serialization
overhead for 38 logs from ~612MB to ~532MB."
```

---

### Task 3: Validate end-to-end

- [ ] **Step 1: Run full validation**

Run: `npm run validate && npm run test:unit && npm run audit:metrics && npm run audit:boons && npm run audit:conditions`
Expected: All pass.

- [ ] **Step 2: Verify the fix structurally**

Confirm that `applyHydratedStatsBatch` no longer calls `setLogsForStats`. Confirm that the force-touch at `useDetailsHydration.ts:269` is still present and is the only `logsForStats` update during hydration.

Run: `grep -n 'setLogsForStats' src/renderer/app/hooks/useDetailsHydration.ts`
Expected output should show the force-touch at line ~269 and the import/parameter, but NOT inside `applyHydratedStatsBatch`.
