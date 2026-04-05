# Simplify Stats Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the dual-path computation architecture, reduce unnecessary work (leaderboard sorts), and clean up dead code — while keeping the stats pipeline accurate, performant, and stable.

**Architecture:** Replace the batch `computeStatsAggregation()` function with a thin synchronous wrapper around `IncrementalAggregator` (which is already the primary path for worker-based computation). Deduplicate leaderboard sorts by reusing raw rank order for per-second/per-minute variants. Move `enrichPrecomputedStats` into `IncrementalAggregator.finalize()` so the precomputed path works identically.

**Tech Stack:** TypeScript, React, Vitest

**Spec:** `docs/superpowers/specs/2026-04-04-simplify-stats-pipeline-design.md`

---

### Task 1: Add `computeStatsSync` wrapper to `incrementalAggregation.ts`

**Files:**
- Modify: `src/renderer/stats/incrementalAggregation.ts`

This creates the drop-in replacement function that all callsites will migrate to.

- [ ] **Step 1: Add the `computeStatsSync` export at the bottom of the file**

At the end of `src/renderer/stats/incrementalAggregation.ts`, add:

```typescript
/**
 * Synchronous convenience wrapper — drop-in replacement for the old
 * batch `computeStatsAggregation()`.  Creates an IncrementalAggregator,
 * ingests every log, and finalizes in one call.
 */
export const computeStatsSync = ({
    logs,
    precomputedStats,
    mvpWeights,
    statsViewSettings,
    disruptionMethod,
    includePlayerSkillMap,
}: {
    logs: any[];
    precomputedStats?: any;
    mvpWeights?: IMvpWeights;
    statsViewSettings?: IStatsViewSettings;
    disruptionMethod?: DisruptionMethod;
    includePlayerSkillMap?: boolean;
}): { stats: any; skillUsageData: any } => {
    const aggregator = new IncrementalAggregator({
        precomputedStats,
        mvpWeights,
        statsViewSettings,
        disruptionMethod,
        includePlayerSkillMap,
    });
    for (const log of logs) {
        aggregator.ingestLog(log);
    }
    return aggregator.finalize();
};
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors related to `computeStatsSync`.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/stats/incrementalAggregation.ts
git commit -m "feat: add computeStatsSync wrapper to incrementalAggregation"
```

---

### Task 2: Move `enrichPrecomputedStats` into `IncrementalAggregator.finalize()`

**Files:**
- Modify: `src/renderer/stats/incrementalAggregation.ts`
- Read (reference only): `src/renderer/stats/computeStatsAggregation.ts:31-123`

The batch path calls `enrichPrecomputedStats()` when precomputed stats exist. The incremental path currently returns precomputed stats raw (line 474: `return { stats: this.options.precomputedStats, skillUsageData: null }`). We need to bring the enrichment logic into `finalize()` so the new wrapper produces identical output.

- [ ] **Step 1: Copy `enrichPrecomputedStats` into `incrementalAggregation.ts`**

Copy the function from `computeStatsAggregation.ts` lines 31-123. Place it above the `IncrementalAggregator` class as a module-private function. It imports `resolveFightTimestamp` which is already imported in this file.

```typescript
const enrichPrecomputedStats = (input: any, logs: any[]) => {
    // Copy the full function body from computeStatsAggregation.ts lines 31-123
    // It uses: resolveFightTimestamp (already imported)
    // No other new imports needed
};
```

- [ ] **Step 2: Update `finalize()` to call `enrichPrecomputedStats`**

In `incrementalAggregation.ts`, replace the precomputed early-return in `finalize()` (around line 471-475):

```typescript
// OLD:
if (this.options.precomputedStats) {
    // Not implemented for precomputed - would need enrichment logic
    // Return precomputed stats as-is (the batch path handles this)
    return { stats: this.options.precomputedStats, skillUsageData: null };
}

// NEW:
if (this.options.precomputedStats) {
    const logsForEnrichment = this.logMetas.map((meta) => ({
        id: meta.id,
        filePath: meta.id,
        details: undefined, // details are not stored; enrichment uses log-level metadata
    }));
    return { stats: enrichPrecomputedStats(this.options.precomputedStats, logsForEnrichment), skillUsageData: null };
}
```

Note: Check what fields `enrichPrecomputedStats` actually reads from the logs. It reads `log.details` for timestamps and team breakdowns, and `log.permalink`/`log.filePath`/`log.id` for matching. Since incremental mode stores only metadata and not the full log, the enrichment needs the original logs. Update `ingestLog` to store the full log reference when `precomputedStats` is set (these are lightweight since they skip processing):

In `ingestLog()`, around line 280, also store the raw log:

```typescript
if (this.options.precomputedStats) {
    this.logMetas.push({
        id: log?.filePath || log?.id || `log-${this.logCount}`,
        timestamp: resolveFightTimestamp(log?.details, log),
        hasDetailedRoster: this.hasDetailedRoster(log),
        originalIndex: this.logCount,
    });
    this.precomputedLogs.push(log); // NEW: store for enrichment
    this.logCount++;
    return;
}
```

Add the field to the class constructor area:

```typescript
private precomputedLogs: any[] = [];
```

Then in `finalize()`:

```typescript
if (this.options.precomputedStats) {
    return {
        stats: enrichPrecomputedStats(this.options.precomputedStats, this.precomputedLogs),
        skillUsageData: null,
    };
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/stats/incrementalAggregation.ts
git commit -m "feat: move enrichPrecomputedStats into IncrementalAggregator.finalize"
```

---

### Task 3: Migrate all runtime callsites from `computeStatsAggregation` to `computeStatsSync`

**Files:**
- Modify: `src/renderer/stats/hooks/useStatsAggregationWorker.ts`
- Modify: `src/renderer/stats/hooks/useStatsAggregation.ts`
- Modify: `src/renderer/stats/hooks/useStatsUploads.ts`

- [ ] **Step 1: Migrate `useStatsAggregationWorker.ts`**

Change the import (line 3):
```typescript
// OLD:
import { computeStatsAggregation } from '../computeStatsAggregation';

// NEW:
import { computeStatsSync } from '../incrementalAggregation';
```

Replace all 3 call sites:

Line 86 (initial state, large dataset):
```typescript
// OLD:
return computeStatsAggregation({ logs: [], precomputedStats: undefined, mvpWeights, statsViewSettings, disruptionMethod });
// NEW:
return computeStatsSync({ logs: [], precomputedStats: undefined, mvpWeights, statsViewSettings, disruptionMethod });
```

Line 88 (initial state, small dataset):
```typescript
// OLD:
return computeStatsAggregation({ logs, precomputedStats, mvpWeights, statsViewSettings, disruptionMethod });
// NEW:
return computeStatsSync({ logs, precomputedStats, mvpWeights, statsViewSettings, disruptionMethod });
```

Line 528 (inline fallback):
```typescript
// OLD:
return computeStatsAggregation({ logs, precomputedStats, mvpWeights, statsViewSettings: aggregationStatsViewSettings, disruptionMethod });
// NEW:
return computeStatsSync({ logs, precomputedStats, mvpWeights, statsViewSettings: aggregationStatsViewSettings, disruptionMethod });
```

- [ ] **Step 2: Migrate `useStatsAggregation.ts`**

```typescript
// OLD:
import { computeStatsAggregation } from '../computeStatsAggregation';

// NEW:
import { computeStatsSync } from '../incrementalAggregation';
```

Line 15:
```typescript
// OLD:
() => computeStatsAggregation({ logs, precomputedStats, mvpWeights, statsViewSettings, disruptionMethod }),
// NEW:
() => computeStatsSync({ logs, precomputedStats, mvpWeights, statsViewSettings, disruptionMethod }),
```

- [ ] **Step 3: Migrate `useStatsUploads.ts`**

Change import (line 2):
```typescript
// OLD:
import { computeStatsAggregation } from '../computeStatsAggregation';

// NEW:
import { computeStatsSync } from '../incrementalAggregation';
```

Line 136:
```typescript
// OLD:
const computed = computeStatsAggregation({
    logs,
    statsViewSettings: activeStatsViewSettings
});
// NEW:
const computed = computeStatsSync({
    logs,
    statsViewSettings: activeStatsViewSettings
});
```

- [ ] **Step 4: Verify no runtime imports of `computeStatsAggregation` remain**

Run: `grep -r "from.*computeStatsAggregation" src/renderer/stats/hooks/ src/renderer/workers/`
Expected: No matches.

- [ ] **Step 5: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/stats/hooks/useStatsAggregationWorker.ts src/renderer/stats/hooks/useStatsAggregation.ts src/renderer/stats/hooks/useStatsUploads.ts
git commit -m "refactor: migrate all runtime callsites to computeStatsSync"
```

---

### Task 4: Migrate test files from `computeStatsAggregation` to `computeStatsSync`

**Files:**
- Modify: `src/renderer/__tests__/computeStatsAggregation.fightCoverage.test.ts`
- Modify: `src/renderer/__tests__/computeStatsAggregation.commanderStats.test.ts`
- Modify: `src/renderer/__tests__/computeStatsAggregation.enemyComp.test.ts`
- Modify: `src/renderer/__tests__/computeStatsAggregation.attendance.test.ts`
- Modify: `src/renderer/__tests__/computeStatsAggregation.skillDamage.test.ts`
- Modify: `src/renderer/__tests__/computeStatsAggregation.minParticipation.test.ts`
- Modify: `src/renderer/__tests__/computeStatsAggregation.healing.test.ts`
- Modify: `src/renderer/__tests__/healingBreakdown.test.ts`
- Modify: `src/renderer/__tests__/StatsView.healing.integration.test.tsx`
- Modify: `src/renderer/stats/__tests__/incrementalAggregation.test.ts`

- [ ] **Step 1: Update import in each test file**

For each of the 9 test files listed above (excluding `incrementalAggregation.test.ts`), change:

```typescript
// OLD:
import { computeStatsAggregation } from '../stats/computeStatsAggregation';
// NEW:
import { computeStatsSync as computeStatsAggregation } from '../stats/incrementalAggregation';
```

Using `as computeStatsAggregation` avoids renaming every call site in the test files — the function signature is identical.

For `healingBreakdown.test.ts` (line 2):
```typescript
// OLD:
import { computeStatsAggregation } from '../stats/computeStatsAggregation';
// NEW:
import { computeStatsSync as computeStatsAggregation } from '../stats/incrementalAggregation';
```

For `StatsView.healing.integration.test.tsx` (line 6):
```typescript
// OLD:
import { computeStatsAggregation } from '../stats/computeStatsAggregation';
// NEW:
import { computeStatsSync as computeStatsAggregation } from '../stats/incrementalAggregation';
```

- [ ] **Step 2: Update `incrementalAggregation.test.ts`**

This file tested parity between batch and incremental. The parity test is now redundant (they're the same code). Replace it with a direct behavioral test:

```typescript
import { describe, it, expect } from 'vitest';
import { IncrementalAggregator, computeStatsSync } from '../incrementalAggregation';
import fixture1 from '../../../../test-fixtures/boon/20260117-175120.json';
import fixture2 from '../../../../test-fixtures/boon/20260117-180135.json';
import fixture3 from '../../../../test-fixtures/boon/20260117-180259.json';

const makeLogs = (...fixtures: any[]) =>
    fixtures.map((f, i) => ({
        id: `log-${i}`,
        filePath: `test-${i}.zevtc`,
        details: f,
    }));

describe('IncrementalAggregator', () => {
    it('computeStatsSync produces same result as manual ingest+finalize', () => {
        const logs = makeLogs(fixture1, fixture2, fixture3);

        const syncResult = computeStatsSync({ logs });

        const aggregator = new IncrementalAggregator();
        for (const log of logs) {
            aggregator.ingestLog(log);
        }
        const incrementalResult = aggregator.finalize();

        expect(incrementalResult.stats).toEqual(syncResult.stats);
        expect(incrementalResult.skillUsageData).toEqual(syncResult.skillUsageData);
    });

    it('produces identical stats for a single log', () => {
        const logs = makeLogs(fixture1);

        const syncResult = computeStatsSync({ logs });

        const aggregator = new IncrementalAggregator();
        aggregator.ingestLog(logs[0]);
        const incrementalResult = aggregator.finalize();

        expect(incrementalResult.stats).toEqual(syncResult.stats);
        expect(incrementalResult.skillUsageData).toEqual(syncResult.skillUsageData);
    });

    it('produces valid output for empty input', () => {
        const aggregator = new IncrementalAggregator();
        const result = aggregator.finalize();

        const syncResult = computeStatsSync({ logs: [] });

        expect(result.stats).toEqual(syncResult.stats);
        expect(result.skillUsageData).toEqual(syncResult.skillUsageData);
    });
});
```

- [ ] **Step 3: Run all unit tests**

Run: `npm run test:unit 2>&1 | tail -30`
Expected: All tests pass. The aliased import means existing assertions work unchanged.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/__tests__/ src/renderer/stats/__tests__/
git commit -m "test: migrate all tests from computeStatsAggregation to computeStatsSync"
```

---

### Task 5: Delete `computeStatsAggregation.ts`

**Files:**
- Delete: `src/renderer/stats/computeStatsAggregation.ts`

- [ ] **Step 1: Verify no remaining imports**

Run: `grep -r "computeStatsAggregation" src/ --include="*.ts" --include="*.tsx" | grep -v "node_modules" | grep -v ".test." | grep -v "__tests__"`
Expected: Only references in `metrics-spec.md` (documentation). No `.ts`/`.tsx` source imports.

Also check tests: `grep -r "from.*computeStatsAggregation" src/`
Expected: No matches (all migrated in Task 4).

- [ ] **Step 2: Delete the file**

```bash
rm src/renderer/stats/computeStatsAggregation.ts
```

- [ ] **Step 3: Verify it compiles and tests pass**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20 && npm run test:unit 2>&1 | tail -15`
Expected: No compile errors, all tests pass.

- [ ] **Step 4: Run regression tests**

Run: `npm run test:regression:stats 2>&1 | tail -15`
Expected: All regression tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: delete batch computeStatsAggregation — single codepath via IncrementalAggregator"
```

---

### Task 6: Deduplicate per-second/per-minute leaderboard sorts

**Files:**
- Modify: `src/renderer/stats/incrementalAggregation.ts`

Per-second and per-minute values are monotonic transforms of raw values (divide by time). This means rank order is identical to the raw leaderboard. We can reuse the raw sort order and just transform values, cutting 18 sorts to 0.

- [ ] **Step 1: Write a helper to derive variant leaderboards from raw**

In `incrementalAggregation.ts`, add this helper near `buildLeaderboard` (around line 614):

```typescript
/** Derive a per-second or per-minute leaderboard from an already-sorted raw leaderboard. */
const deriveLeaderboard = (
    rawLeaderboard: Array<{ rank: number; account: string; profession: string; professionList?: string[]; value: number; count?: number }>,
    playerStats: Map<string, PlayerStats>,
    getVariantVal: (s: PlayerStats, k: string) => number,
    key: string,
): typeof rawLeaderboard => {
    return rawLeaderboard.map((entry) => {
        const stat = playerStats.get(entry.account);
        const value = stat ? getVariantVal(stat, key) : 0;
        return { ...entry, value };
    });
};
```

- [ ] **Step 2: Replace the leaderboard loop**

Replace the loop at lines 786-802 that calls `buildLeaderboard` twice per metric:

```typescript
// OLD (lines 786-802):
Object.values(statKeys).forEach((k) => {
    const higherIsBetter = k !== 'closestToTag';
    perSecondLeaderboards[k] = buildLeaderboard(leaderboardEntries.map(({ stat }) => ({
        account: stat.account,
        profession: stat.profession,
        professionList: stat.professionList,
        value: getPerSecondVal(stat, k),
        count: stat.logsJoined
    })), higherIsBetter);
    perMinuteLeaderboards[k] = buildLeaderboard(leaderboardEntries.map(({ stat }) => ({
        account: stat.account,
        profession: stat.profession,
        professionList: stat.professionList,
        value: getPerMinuteVal(stat, k),
        count: stat.logsJoined
    })), higherIsBetter);
});

// NEW:
Object.values(statKeys).forEach((k) => {
    const rawLB = leaderboards[k as keyof typeof leaderboards];
    if (!rawLB) return;
    perSecondLeaderboards[k] = deriveLeaderboard(rawLB, playerStats, getPerSecondVal, k);
    perMinuteLeaderboards[k] = deriveLeaderboard(rawLB, playerStats, getPerMinuteVal, k);
});
```

- [ ] **Step 3: Run unit tests**

Run: `npm run test:unit 2>&1 | tail -20`
Expected: All tests pass — leaderboard values are the same, just sorted without re-sorting.

- [ ] **Step 4: Run regression tests**

Run: `npm run test:regression:stats 2>&1 | tail -15`
Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/stats/incrementalAggregation.ts
git commit -m "perf: derive per-second/per-minute leaderboards from raw sort order (42 sorts → 14)"
```

---

### Task 7: Remove duplicate `resolveProfessionLabel` implementations

**Files:**
- Modify: `src/renderer/stats/computeCommanderStats.ts`
- Modify: `src/renderer/stats/computeFightDiffMode.ts`
- Modify: `src/renderer/stats/computeIncomingStrikeDamageData.ts`

Three compute modules have local copies of the profession resolution logic instead of importing `resolveProfessionLabel` from `computePlayerAggregation.ts`.

- [ ] **Step 1: Fix `computeCommanderStats.ts`**

Read the file around line 22 to find the local implementation. Replace it with an import:

```typescript
// Add to imports at top:
import { resolveProfessionLabel } from './computePlayerAggregation';

// Remove the local function definition (around line 22)
```

- [ ] **Step 2: Fix `computeFightDiffMode.ts`**

Read the file around line 31 to find the local implementation. Replace it with an import:

```typescript
// Add to imports at top:
import { resolveProfessionLabel } from './computePlayerAggregation';

// Remove the local function definition (around line 31)
```

- [ ] **Step 3: Fix `computeIncomingStrikeDamageData.ts`**

Read the file around line 20 to find the local implementation. Replace it with an import:

```typescript
// Add to imports at top:
import { resolveProfessionLabel } from './computePlayerAggregation';

// Remove the local function definition (around line 20)
```

- [ ] **Step 4: Verify it compiles and tests pass**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20 && npm run test:unit 2>&1 | tail -15`
Expected: No errors, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/stats/computeCommanderStats.ts src/renderer/stats/computeFightDiffMode.ts src/renderer/stats/computeIncomingStrikeDamageData.ts
git commit -m "refactor: use shared resolveProfessionLabel instead of local copies"
```

---

### Task 8: Update documentation references

**Files:**
- Modify: `src/shared/metrics-spec.md`

- [ ] **Step 1: Update references to `computeStatsAggregation.ts`**

Search `metrics-spec.md` for references to `computeStatsAggregation.ts` and update them to reference `incrementalAggregation.ts`:

```bash
grep -n "computeStatsAggregation" src/shared/metrics-spec.md
```

Replace file path references like:
```
src/renderer/stats/computeStatsAggregation.ts
```
with:
```
src/renderer/stats/incrementalAggregation.ts
```

- [ ] **Step 2: Sync metrics spec to docs**

Run: `npm run sync:metrics-spec`

- [ ] **Step 3: Commit**

```bash
git add src/shared/metrics-spec.md docs/
git commit -m "docs: update metrics-spec references from computeStatsAggregation to incrementalAggregation"
```

---

### Task 9: Final validation

- [ ] **Step 1: Run full validation**

Run: `npm run validate 2>&1 | tail -20`
Expected: Typecheck and lint both pass with 0 warnings.

- [ ] **Step 2: Run all unit tests**

Run: `npm run test:unit 2>&1 | tail -20`
Expected: All pass.

- [ ] **Step 3: Run regression tests**

Run: `npm run test:regression:stats 2>&1 | tail -15`
Expected: All pass.

- [ ] **Step 4: Run audit scripts**

Run: `npm run audit:boons && npm run audit:metrics && npm run audit:conditions`
Expected: All audits pass.

- [ ] **Step 5: Verify no remaining references to deleted file**

Run: `grep -r "computeStatsAggregation" src/ --include="*.ts" --include="*.tsx" | grep -v metrics-spec`
Expected: No matches.
