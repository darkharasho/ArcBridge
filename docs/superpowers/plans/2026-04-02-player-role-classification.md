# Player Role Classification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Classify each player as support or damage using a weighted support score normalized against squad median, then gate MVP eligibility by role.

**Architecture:** A new pure function `classifyPlayerRoles` computes a support score per player from 6 weighted metrics (healing, cleanses, stability gen, resistance gen, might gen, regen gen), normalizes each against the squad median of non-zero contributors, and classifies above a 1.5x threshold as support. The function is called during `computeStatsAggregation` after boon tables are built, and the resulting `roleClassification` field on `PlayerStats` gates MVP candidate filtering.

**Tech Stack:** TypeScript, vitest

---

### Task 1: Create `classifyPlayerRoles` with tests

**Files:**
- Create: `src/renderer/stats/classifyPlayerRoles.ts`
- Create: `src/renderer/stats/__tests__/classifyPlayerRoles.test.ts`

- [ ] **Step 1: Write the test file with all test cases**

```typescript
// src/renderer/stats/__tests__/classifyPlayerRoles.test.ts
import { describe, it, expect } from 'vitest';
import { classifyPlayerRoles, PlayerRoleClassification } from '../classifyPlayerRoles';
import { BoonTable, BoonRow } from '../../../shared/boonGeneration';

const makePlayerStats = (account: string, overrides: Record<string, any> = {}) => ({
    name: account,
    account,
    healing: 0,
    cleanses: 0,
    stab: 0,
    barrier: 0,
    revives: 0,
    ...overrides,
});

const makeBoonTable = (boonId: string, rows: Array<{ account: string; generationMs: number }>): BoonTable => ({
    id: boonId,
    name: boonId,
    stacking: false,
    rows: rows.map((r) => ({
        account: r.account,
        profession: 'Guardian',
        activeTimeMs: 60000,
        numFights: 1,
        groupSupported: 5,
        squadSupported: 50,
        categories: {
            selfBuffs: { generationMs: 0, wastedMs: 0 },
            groupBuffs: { generationMs: 0, wastedMs: 0 },
            squadBuffs: { generationMs: r.generationMs, wastedMs: 0 },
        },
    })),
});

describe('classifyPlayerRoles', () => {
    it('classifies all-DPS squad as damage', () => {
        const players = [
            makePlayerStats('dps1', { healing: 0, cleanses: 0, stab: 0 }),
            makePlayerStats('dps2', { healing: 0, cleanses: 0, stab: 0 }),
            makePlayerStats('dps3', { healing: 0, cleanses: 0, stab: 0 }),
        ];
        const result = classifyPlayerRoles(players, []);
        expect(result.get('dps1')!.role).toBe('damage');
        expect(result.get('dps2')!.role).toBe('damage');
        expect(result.get('dps3')!.role).toBe('damage');
    });

    it('classifies high-healing player as support in mixed squad', () => {
        const players = [
            makePlayerStats('healer', { healing: 500000, cleanses: 200, stab: 5000 }),
            makePlayerStats('dps1', { healing: 0, cleanses: 5, stab: 0 }),
            makePlayerStats('dps2', { healing: 0, cleanses: 3, stab: 0 }),
            makePlayerStats('dps3', { healing: 100, cleanses: 2, stab: 0 }),
            makePlayerStats('dps4', { healing: 0, cleanses: 0, stab: 0 }),
        ];
        const result = classifyPlayerRoles(players, []);
        expect(result.get('healer')!.role).toBe('support');
        expect(result.get('dps1')!.role).toBe('damage');
        expect(result.get('dps2')!.role).toBe('damage');
    });

    it('uses boon generation data for classification', () => {
        const players = [
            makePlayerStats('buffer', { healing: 1000, cleanses: 50, stab: 8000 }),
            makePlayerStats('dps1', { healing: 0, cleanses: 0, stab: 0 }),
            makePlayerStats('dps2', { healing: 0, cleanses: 0, stab: 0 }),
            makePlayerStats('dps3', { healing: 0, cleanses: 0, stab: 0 }),
        ];
        const boonTables = [
            makeBoonTable('b740', [{ account: 'buffer', generationMs: 300000 }]),   // might
            makeBoonTable('b718', [{ account: 'buffer', generationMs: 200000 }]),   // regen
            makeBoonTable('b26980', [{ account: 'buffer', generationMs: 150000 }]), // resistance
        ];
        const result = classifyPlayerRoles(players, boonTables);
        expect(result.get('buffer')!.role).toBe('support');
        expect(result.get('buffer')!.supportScore).toBeGreaterThan(0);
    });

    it('returns confidence score between 0 and 1', () => {
        const players = [
            makePlayerStats('healer', { healing: 500000, cleanses: 300, stab: 10000 }),
            makePlayerStats('dps1', { healing: 0, cleanses: 0, stab: 0 }),
            makePlayerStats('dps2', { healing: 0, cleanses: 0, stab: 0 }),
        ];
        const result = classifyPlayerRoles(players, []);
        const healer = result.get('healer')!;
        const dps = result.get('dps1')!;
        expect(healer.confidenceScore).toBeGreaterThanOrEqual(0);
        expect(healer.confidenceScore).toBeLessThanOrEqual(1);
        expect(dps.confidenceScore).toBeGreaterThanOrEqual(0);
        expect(dps.confidenceScore).toBeLessThanOrEqual(1);
    });

    it('handles single player gracefully', () => {
        const players = [makePlayerStats('solo', { healing: 5000, cleanses: 10, stab: 0 })];
        const result = classifyPlayerRoles(players, []);
        expect(result.get('solo')).toBeDefined();
        expect(['support', 'damage']).toContain(result.get('solo')!.role);
    });

    it('handles empty player list', () => {
        const result = classifyPlayerRoles([], []);
        expect(result.size).toBe(0);
    });

    it('support player has higher support score than damage player', () => {
        const players = [
            makePlayerStats('healer', { healing: 400000, cleanses: 250, stab: 8000 }),
            makePlayerStats('dps1', { healing: 0, cleanses: 5, stab: 0 }),
            makePlayerStats('dps2', { healing: 50, cleanses: 2, stab: 0 }),
        ];
        const result = classifyPlayerRoles(players, []);
        expect(result.get('healer')!.supportScore).toBeGreaterThan(result.get('dps1')!.supportScore);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/renderer/stats/__tests__/classifyPlayerRoles.test.ts`
Expected: FAIL — module `../classifyPlayerRoles` not found

- [ ] **Step 3: Write the implementation**

```typescript
// src/renderer/stats/classifyPlayerRoles.ts
import { BoonTable } from '../../shared/boonGeneration';

export interface PlayerRoleClassification {
    role: 'support' | 'damage';
    supportScore: number;
    confidenceScore: number;
}

/** Boon IDs used for support classification (prefixed with "b" to match boon table format). */
const SUPPORT_BOON_IDS = {
    might: 'b740',
    regen: 'b718',
    resistance: 'b26980',
} as const;

/** Metric weights for support score calculation. */
const SUPPORT_WEIGHTS = {
    healing: 1.0,
    cleanses: 1.0,
    stability: 0.8,
    resistance: 0.7,
    might: 0.6,
    regen: 0.5,
} as const;

/** Players scoring above this multiplier of the squad median support score are classified as support. */
const THRESHOLD_MULTIPLIER = 1.5;

/** When the squad median for a metric is zero but the player has a positive value, use this ratio. */
const OUTLIER_RATIO = 2.0;

type MinimalPlayerStats = {
    account: string;
    healing: number;
    cleanses: number;
    stab: number;
};

/**
 * Compute the median of an array of numbers.
 * Returns 0 for empty arrays.
 */
const computeMedian = (values: number[]): number => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

/**
 * Compute the ratio of a player's value to the squad median.
 * If the median is zero and the player has a positive value, returns OUTLIER_RATIO.
 * If both are zero, returns 0.
 */
const computeRatio = (value: number, median: number): number => {
    if (median > 0) return value / median;
    if (value > 0) return OUTLIER_RATIO;
    return 0;
};

/**
 * Extract per-player squad generationMs for a specific boon from boon tables.
 * Returns a Map of account -> generationMs.
 */
const extractBoonGeneration = (boonTables: BoonTable[], boonId: string): Map<string, number> => {
    const result = new Map<string, number>();
    const table = boonTables.find((t) => t.id === boonId);
    if (!table) return result;
    for (const row of table.rows) {
        const existing = result.get(row.account) || 0;
        result.set(row.account, existing + row.categories.squadBuffs.generationMs);
    }
    return result;
};

/**
 * Classify each player as 'support' or 'damage' based on a weighted support score
 * normalized against the squad median.
 *
 * @param players - Array of objects with at least { account, healing, cleanses, stab }
 * @param boonTables - Boon generation tables from buildBoonTables()
 * @returns Map of account -> PlayerRoleClassification
 */
export const classifyPlayerRoles = (
    players: MinimalPlayerStats[],
    boonTables: BoonTable[],
): Map<string, PlayerRoleClassification> => {
    const result = new Map<string, PlayerRoleClassification>();
    if (players.length === 0) return result;

    // Extract boon generation data per player
    const mightGen = extractBoonGeneration(boonTables, SUPPORT_BOON_IDS.might);
    const regenGen = extractBoonGeneration(boonTables, SUPPORT_BOON_IDS.regen);
    const resistanceGen = extractBoonGeneration(boonTables, SUPPORT_BOON_IDS.resistance);

    // Collect per-metric values (only non-zero for median calculation)
    const healingValues = players.map((p) => p.healing).filter((v) => v > 0);
    const cleanseValues = players.map((p) => p.cleanses).filter((v) => v > 0);
    const stabValues = players.map((p) => p.stab).filter((v) => v > 0);
    const mightValues = players.map((p) => mightGen.get(p.account) || 0).filter((v) => v > 0);
    const regenValues = players.map((p) => regenGen.get(p.account) || 0).filter((v) => v > 0);
    const resistValues = players.map((p) => resistanceGen.get(p.account) || 0).filter((v) => v > 0);

    // Compute medians
    const medianHealing = computeMedian(healingValues);
    const medianCleanses = computeMedian(cleanseValues);
    const medianStab = computeMedian(stabValues);
    const medianMight = computeMedian(mightValues);
    const medianRegen = computeMedian(regenValues);
    const medianResist = computeMedian(resistValues);

    // Compute support scores
    const scores: Array<{ account: string; supportScore: number }> = players.map((p) => {
        const supportScore =
            computeRatio(p.healing, medianHealing) * SUPPORT_WEIGHTS.healing +
            computeRatio(p.cleanses, medianCleanses) * SUPPORT_WEIGHTS.cleanses +
            computeRatio(p.stab, medianStab) * SUPPORT_WEIGHTS.stability +
            computeRatio(mightGen.get(p.account) || 0, medianMight) * SUPPORT_WEIGHTS.might +
            computeRatio(regenGen.get(p.account) || 0, medianRegen) * SUPPORT_WEIGHTS.regen +
            computeRatio(resistanceGen.get(p.account) || 0, medianResist) * SUPPORT_WEIGHTS.resistance;
        return { account: p.account, supportScore };
    });

    // Compute threshold from squad median support score
    const allSupportScores = scores.map((s) => s.supportScore);
    const medianSupportScore = computeMedian(allSupportScores);
    const threshold = medianSupportScore * THRESHOLD_MULTIPLIER;

    // Classify and compute confidence
    for (const { account, supportScore } of scores) {
        const role: 'support' | 'damage' = threshold > 0 && supportScore > threshold ? 'support' : 'damage';
        const distance = threshold > 0 ? Math.abs(supportScore - threshold) / threshold : 0;
        const confidenceScore = Math.min(distance, 1);
        result.set(account, { role, supportScore, confidenceScore });
    }

    return result;
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/renderer/stats/__tests__/classifyPlayerRoles.test.ts`
Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/stats/classifyPlayerRoles.ts src/renderer/stats/__tests__/classifyPlayerRoles.test.ts
git commit -m "feat(stats): add classifyPlayerRoles with support score calculation and tests"
```

---

### Task 2: Add `roleClassification` field to `PlayerStats`

**Files:**
- Modify: `src/renderer/stats/computePlayerAggregation.ts:13-56` (PlayerStats interface)
- Modify: `src/renderer/stats/computePlayerAggregation.ts:577-583` (default initialization)

- [ ] **Step 1: Add the import and field to the `PlayerStats` interface**

In `src/renderer/stats/computePlayerAggregation.ts`, add the import at the top (after existing imports on line 11):

```typescript
import { PlayerRoleClassification } from './classifyPlayerRoles';
```

Add the field to the `PlayerStats` interface (after `incomingDamageModTotals` on line 55):

```typescript
    roleClassification: PlayerRoleClassification;
```

- [ ] **Step 2: Add default value in the PlayerStats initialization**

In `src/renderer/stats/computePlayerAggregation.ts` at line 582, add to the initialization object (after `incomingDamageModTotals: {}`):

```typescript
, roleClassification: { role: 'damage', supportScore: 0, confidenceScore: 0 }
```

The full line 582 becomes:
```typescript
                    professionTimeMs: {}, squadActiveMs: 0, firstSeenFightTs: 0, lastSeenFightTs: 0, lastSeenFightDurationMs: 0, isCommander: false, damage: 0, dps: 0, revives: 0, outgoingConditions: {}, incomingConditions: {}, damageModTotals: {}, incomingDamageModTotals: {}, roleClassification: { role: 'damage', supportScore: 0, confidenceScore: 0 }
```

- [ ] **Step 3: Verify types compile**

Run: `npm run typecheck`
Expected: No new errors

- [ ] **Step 4: Commit**

```bash
git add src/renderer/stats/computePlayerAggregation.ts
git commit -m "feat(stats): add roleClassification field to PlayerStats"
```

---

### Task 3: Integrate classification into stats aggregation and gate MVP

**Files:**
- Modify: `src/renderer/stats/computeStatsAggregation.ts:1-20` (imports)
- Modify: `src/renderer/stats/computeStatsAggregation.ts:549-554` (call classifyPlayerRoles after boon tables)
- Modify: `src/renderer/stats/computeStatsAggregation.ts:527-537` (filter MVP candidates)

- [ ] **Step 1: Add import**

In `src/renderer/stats/computeStatsAggregation.ts`, add after the existing imports (after line 19):

```typescript
import { classifyPlayerRoles } from './classifyPlayerRoles';
```

- [ ] **Step 2: Call `classifyPlayerRoles` after boon tables are computed**

After line 554 (the `computeTimelineAndMapData` call), insert:

```typescript
        // Classify player roles (support vs damage) for MVP gating
        const roleClassifications = classifyPlayerRoles(
            leaderboardEntries.map(({ stat }) => stat),
            boonTables,
        );
        for (const [account, classification] of roleClassifications) {
            const stat = playerStats.get(account);
            if (stat) stat.roleClassification = classification;
        }
```

- [ ] **Step 3: Filter MVP candidates by role**

Inside the `if (activeStatsViewSettings?.showMvp)` block, replace the offensive and defensive score computation lines (lines 527-537).

Replace:
```typescript
            const offensiveScores = computeCategoryScores([...offensiveMetrics, ...generalMetrics]);
```

With:
```typescript
            const offensiveCandidates = leaderboardEntries.filter(({ stat }) => stat.roleClassification.role === 'damage');
            const offensivePool = offensiveCandidates.length > 0 ? offensiveCandidates : leaderboardEntries;
            const offensiveScores = computeCategoryScores([...offensiveMetrics, ...generalMetrics], offensivePool);
```

Replace:
```typescript
            const defensiveScores = computeCategoryScores([...defensiveMetrics, ...generalMetrics]);
```

With:
```typescript
            const defensiveCandidates = leaderboardEntries.filter(({ stat }) => stat.roleClassification.role === 'support');
            const defensivePool = defensiveCandidates.length > 0 ? defensiveCandidates : leaderboardEntries;
            const defensiveScores = computeCategoryScores([...defensiveMetrics, ...generalMetrics], defensivePool);
```

- [ ] **Step 4: Update `computeCategoryScores` to accept a candidate pool**

The existing `computeCategoryScores` function (line 482) iterates over `leaderboardEntries`. Add an optional parameter to use a filtered pool instead.

Replace the function signature (line 482):
```typescript
            const computeCategoryScores = (metrics: typeof offensiveMetrics) => {
```

With:
```typescript
            const computeCategoryScores = (metrics: typeof offensiveMetrics, pool?: typeof leaderboardEntries) => {
```

Replace the `leaderboardEntries.forEach` call inside it (line 500):
```typescript
                leaderboardEntries.forEach(({ stat }) => {
```

With:
```typescript
                (pool || leaderboardEntries).forEach(({ stat }) => {
```

- [ ] **Step 5: Verify types compile**

Run: `npm run typecheck`
Expected: No new errors

- [ ] **Step 6: Run existing tests to verify no regressions**

Run: `npm run test:unit`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add src/renderer/stats/computeStatsAggregation.ts
git commit -m "feat(stats): integrate role classification into MVP eligibility gating"
```

---

### Task 4: Validate end-to-end with regression tests

**Files:**
- No new files — uses existing test infrastructure

- [ ] **Step 1: Run the stats regression tests**

Run: `npm run test:regression:stats`
Expected: All regression tests pass. If any fail, investigate whether the role classification changed MVP results in a way that's expected (support player no longer winning offensive MVP) vs unexpected.

- [ ] **Step 2: Run the full validation suite**

Run: `npm run validate`
Expected: typecheck + lint both pass with no warnings

- [ ] **Step 3: Run all unit tests one final time**

Run: `npm run test:unit`
Expected: All tests pass

- [ ] **Step 4: Commit any adjustments (if needed)**

If regression tests required adjustments to test expectations (e.g., a support player no longer appears as offensive MVP in test fixtures), commit those changes:

```bash
git add -u
git commit -m "test(stats): update regression expectations for role-gated MVP"
```
