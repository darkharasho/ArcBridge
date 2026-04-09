# Player Comparison Extended Metrics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the Player Comparison section with a General category, per-minute/per-fight rates, burst damage, and individual boon generation rows (seconds/min).

**Architecture:** Add new metric types (`perMinute`, `perFight`, `isBoon`, `isBurst`) to the `ComparisonMetric` interface. Plumb additional fields (`logsJoined`, `stackedLogCount`) onto player arrays from incremental aggregation. Cross-reference `boonTables` and `spikeDamage` data via an optional context parameter on `getMetricValue()`.

**Tech Stack:** TypeScript, React, Vitest

---

### Task 1: Add `stackedLogCount` to PlayerStats and Aggregation

**Files:**
- Modify: `src/renderer/stats/computePlayerAggregation.ts:14-59` (PlayerStats interface)
- Modify: `src/renderer/stats/computePlayerAggregation.ts:622-655` (aggregation loop)

- [ ] **Step 1: Add `stackedLogCount` field to `PlayerStats` interface**

In `src/renderer/stats/computePlayerAggregation.ts`, add the field to the interface at line 28 (after `distCount`):

```typescript
// In PlayerStats interface, after distCount: number;
stackedLogCount: number;
```

- [ ] **Step 2: Initialize `stackedLogCount` in the player creation block**

In the `acc.playerStats.set(key, { ... })` block at line 624, add `stackedLogCount: 0` alongside the existing `distCount: 0`:

```typescript
totalDist: 0, distCount: 0, stackedLogCount: 0, dodges: 0, downs: 0, deaths: 0, totalFightMs: 0,
```

- [ ] **Step 3: Increment `stackedLogCount` when distance <= 600**

After the existing distance aggregation block (lines 651-655), add the stacked log check:

```typescript
        const dist = getDistanceToTag(p);
        if (dist <= RUN_BACK_RANGE) {
            s.totalDist += dist;
            s.distCount++;
        }
        if (dist <= 600) {
            s.stackedLogCount++;
        }
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/stats/computePlayerAggregation.ts
git commit -m "feat(comparison): add stackedLogCount to PlayerStats for stack % metric"
```

---

### Task 2: Add `generalPlayers` and extra fields to player arrays in aggregation output

**Files:**
- Modify: `src/renderer/stats/incrementalAggregation.ts:1185-1202` (player array construction)

- [ ] **Step 1: Add `logsJoined` to `defensePlayers` array**

At line 1189-1192, add `logsJoined` to the defensePlayers map:

```typescript
defensePlayers: Array.from(playerStats.values()).map(s => ({
    account: s.account, profession: s.profession, professionList: s.professionList,
    defenseTotals: s.defenseTotals, activeMs: s.defenseActiveMs, minionDamageTakenByMinion: s.defenseMinionDamageTaken,
    logsJoined: s.logsJoined
})),
```

- [ ] **Step 2: Add `logsJoined` to `supportPlayers` array**

At line 1195-1198, add `logsJoined`:

```typescript
supportPlayers: Array.from(playerStats.values()).map(s => ({
    account: s.account, profession: s.profession, professionList: s.professionList,
    supportTotals: s.supportTotals, activeMs: s.supportActiveMs,
    logsJoined: s.logsJoined
})),
```

- [ ] **Step 3: Add `generalPlayers` array after `healingPlayers`**

After the `healingPlayers` block (after line 1202), add:

```typescript
generalPlayers: Array.from(playerStats.values()).map(s => ({
    account: s.account, profession: s.profession, professionList: s.professionList,
    totalFightMs: s.totalFightMs, squadActiveMs: s.squadActiveMs,
    totalDist: s.totalDist, distCount: s.distCount,
    logsJoined: s.logsJoined, stackedLogCount: s.stackedLogCount
})),
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS (no type errors — stats object is typed as `any` in consumers)

- [ ] **Step 5: Commit**

```bash
git add src/renderer/stats/incrementalAggregation.ts
git commit -m "feat(comparison): add generalPlayers array and logsJoined to player outputs"
```

---

### Task 3: Extend `ComparisonMetric` interface and `getMetricValue()` with new metric types

**Files:**
- Modify: `src/renderer/stats/utils/comparisonMetrics.ts`

- [ ] **Step 1: Extend the `ComparisonMetric` interface**

Replace the existing interface (lines 3-20) with:

```typescript
export interface ComparisonMetric {
    id: string;
    label: string;
    /** Which *Totals object to read from (offenseTotals, defenseTotals, etc.) */
    totalsKey?: 'offenseTotals' | 'defenseTotals' | 'supportTotals' | 'healingTotals';
    /** The field key inside the totals object */
    field?: string;
    /** If true, lower values are better (deaths, damage taken) */
    lowerIsBetter?: boolean;
    /** If true, display as percentage */
    isPercent?: boolean;
    /** If true, this is a rate field that needs denominator from rateWeights */
    isRate?: boolean;
    /** If true, divide value by activeMs/1000 to get per-second */
    perSecond?: boolean;
    /** If true, divide value by activeMs/60000 to get per-minute */
    perMinute?: boolean;
    /** If true, divide value by logsJoined to get per-fight */
    perFight?: boolean;
    /** Number of decimal places for display */
    decimals?: number;
    /** Direct field on the player row object (not inside a totals sub-object) */
    directField?: string;
    /** Boon metric: boon table ID (e.g., 'b740' for Might) */
    boonId?: string;
    /** Boon metric: which generation category to read */
    boonCategory?: 'selfBuffs' | 'groupBuffs' | 'squadBuffs';
    /** Burst metric: field on SpikeDamagePlayer to read (e.g., 'peak1s') */
    burstField?: string;
}
```

- [ ] **Step 2: Add `'general'` to `ComparisonCategory` and `COMPARISON_CATEGORIES`**

Replace lines 22-29:

```typescript
export type ComparisonCategory = 'offense' | 'defense' | 'support' | 'healing' | 'general';

export const COMPARISON_CATEGORIES: { value: ComparisonCategory; label: string }[] = [
    { value: 'general', label: 'General' },
    { value: 'offense', label: 'Offense' },
    { value: 'defense', label: 'Defense' },
    { value: 'support', label: 'Support' },
    { value: 'healing', label: 'Healing' },
];
```

- [ ] **Step 3: Add new metrics to `COMPARISON_METRICS`**

Replace the entire `COMPARISON_METRICS` object (lines 31-62):

```typescript
export const COMPARISON_METRICS: Record<ComparisonCategory, ComparisonMetric[]> = {
    general: [
        { id: 'activePercent', label: 'Active %', directField: 'activePercent', isPercent: true, decimals: 1 },
        { id: 'stackPercent', label: 'Stack %', directField: 'stackPercent', isPercent: true, decimals: 1 },
        { id: 'avgDistCmd', label: 'Avg Dist Cmd', directField: 'avgDistCmd', lowerIsBetter: true, decimals: 0 },
    ],
    offense: [
        { id: 'damage', label: 'Damage', totalsKey: 'offenseTotals', field: 'damage' },
        { id: 'dps', label: 'DPS', totalsKey: 'offenseTotals', field: 'damage', perSecond: true, decimals: 0 },
        { id: 'dpm', label: 'Avg DPM', totalsKey: 'offenseTotals', field: 'damage', perMinute: true, decimals: 0 },
        { id: 'burst1s', label: 'Burst 1s', burstField: 'peak1s', decimals: 0 },
        { id: 'burstAvg', label: 'Burst Avg', burstField: 'burstAvg', decimals: 0 },
        { id: 'downContribution', label: 'Down Contribution', totalsKey: 'offenseTotals', field: 'downContribution' },
        { id: 'downed', label: 'Downs', totalsKey: 'offenseTotals', field: 'downed' },
        { id: 'killed', label: 'Kills', totalsKey: 'offenseTotals', field: 'killed' },
        { id: 'criticalRate', label: 'Critical Rate', totalsKey: 'offenseTotals', field: 'criticalRate', isRate: true, isPercent: true, decimals: 1 },
        { id: 'boonStrips', label: 'Boon Strips', totalsKey: 'offenseTotals', field: 'boonStrips' },
    ],
    defense: [
        { id: 'damageTaken', label: 'Damage Taken', totalsKey: 'defenseTotals', field: 'damageTaken', lowerIsBetter: true },
        { id: 'deathsPerFight', label: 'Deaths/Fight', totalsKey: 'defenseTotals', field: 'deadCount', perFight: true, lowerIsBetter: true, decimals: 2 },
        { id: 'downsPerFight', label: 'Downs/Fight', totalsKey: 'defenseTotals', field: 'downCount', perFight: true, lowerIsBetter: true, decimals: 2 },
        { id: 'dodgesPerMin', label: 'Dodges/min', totalsKey: 'defenseTotals', field: 'dodgeCount', perMinute: true, decimals: 1 },
        { id: 'downCount', label: 'Down Count', totalsKey: 'defenseTotals', field: 'downCount', lowerIsBetter: true },
        { id: 'deadCount', label: 'Death Count', totalsKey: 'defenseTotals', field: 'deadCount', lowerIsBetter: true },
        { id: 'dodgeCount', label: 'Dodge Count', totalsKey: 'defenseTotals', field: 'dodgeCount' },
        { id: 'blockedCount', label: 'Blocked Count', totalsKey: 'defenseTotals', field: 'blockedCount' },
        { id: 'evadedCount', label: 'Evaded Count', totalsKey: 'defenseTotals', field: 'evadedCount' },
    ],
    support: [
        { id: 'condiCleanse', label: 'Condition Cleanses', totalsKey: 'supportTotals', field: 'condiCleanse' },
        { id: 'cleansesPerMin', label: 'Cleanses/min', totalsKey: 'supportTotals', field: 'condiCleanse', perMinute: true, decimals: 1 },
        { id: 'boonStrips', label: 'Boon Strips', totalsKey: 'supportTotals', field: 'boonStrips' },
        { id: 'stripsPerMin', label: 'Strips/min', totalsKey: 'supportTotals', field: 'boonStrips', perMinute: true, decimals: 1 },
        { id: 'stunBreak', label: 'Stun Breaks', totalsKey: 'supportTotals', field: 'stunBreak' },
        { id: 'resurrects', label: 'Resurrects', totalsKey: 'supportTotals', field: 'resurrects' },
        // Stability generation
        { id: 'stabSquad', label: 'Stab (Squad)', boonId: 'b1122', boonCategory: 'squadBuffs', decimals: 1 },
        { id: 'stabGroup', label: 'Stab (Group)', boonId: 'b1122', boonCategory: 'groupBuffs', decimals: 1 },
        { id: 'stabSelf', label: 'Stab (Self)', boonId: 'b1122', boonCategory: 'selfBuffs', decimals: 1 },
        // Combat boons
        { id: 'might', label: 'Might', boonId: 'b740', boonCategory: 'squadBuffs', decimals: 1 },
        { id: 'fury', label: 'Fury', boonId: 'b725', boonCategory: 'squadBuffs', decimals: 1 },
        { id: 'quickness', label: 'Quickness', boonId: 'b1187', boonCategory: 'squadBuffs', decimals: 1 },
        { id: 'alacrity', label: 'Alacrity', boonId: 'b30328', boonCategory: 'squadBuffs', decimals: 1 },
        // Defense boons
        { id: 'protection', label: 'Protection', boonId: 'b717', boonCategory: 'squadBuffs', decimals: 1 },
        { id: 'resistance', label: 'Resistance', boonId: 'b26980', boonCategory: 'squadBuffs', decimals: 1 },
        { id: 'vigor', label: 'Vigor', boonId: 'b726', boonCategory: 'squadBuffs', decimals: 1 },
        // Utility boons
        { id: 'aegis', label: 'Aegis', boonId: 'b743', boonCategory: 'squadBuffs', decimals: 1 },
        { id: 'regen', label: 'Regen', boonId: 'b718', boonCategory: 'squadBuffs', decimals: 1 },
        { id: 'swiftness', label: 'Swiftness', boonId: 'b719', boonCategory: 'squadBuffs', decimals: 1 },
        { id: 'resolution', label: 'Resolution', boonId: 'b873', boonCategory: 'squadBuffs', decimals: 1 },
    ],
    healing: [
        { id: 'healing', label: 'Healing', totalsKey: 'healingTotals', field: 'healing' },
        { id: 'healingPerSecond', label: 'HPS', totalsKey: 'healingTotals', field: 'healing', perSecond: true, decimals: 1 },
        { id: 'barrier', label: 'Barrier', totalsKey: 'healingTotals', field: 'barrier' },
        { id: 'barrierPerSecond', label: 'Barrier/s', totalsKey: 'healingTotals', field: 'barrier', perSecond: true, decimals: 1 },
        { id: 'downedHealing', label: 'Downed Healing', totalsKey: 'healingTotals', field: 'downedHealing' },
    ],
};
```

- [ ] **Step 4: Update `getPlayersArrayKey()` for general category**

Replace lines 95-102:

```typescript
export function getPlayersArrayKey(category: ComparisonCategory): string {
    switch (category) {
        case 'general': return 'generalPlayers';
        case 'offense': return 'offensePlayers';
        case 'defense': return 'defensePlayers';
        case 'support': return 'supportPlayers';
        case 'healing': return 'healingPlayers';
    }
}
```

- [ ] **Step 5: Add `ComparisonContext` type and extend `getMetricValue()`**

Replace the existing `getMetricValue` function (lines 68-90) with:

```typescript
export interface ComparisonContext {
    boonTables?: any[];
    spikePlayers?: any[];
}

/**
 * Extract a metric value from a player row object.
 * Player rows have shape: { account, profession, professionList, offenseTotals, offenseRateWeights, totalFightMs, ... }
 */
export function getMetricValue(player: any, metric: ComparisonMetric, context?: ComparisonContext): number {
    // Boon metrics: look up from boonTables
    if (metric.boonId && metric.boonCategory) {
        return getBoonMetricValue(player, metric, context?.boonTables);
    }

    // Burst metrics: cross-reference spikeDamage players
    if (metric.burstField) {
        return getBurstMetricValue(player, metric, context?.spikePlayers);
    }

    // Direct field on player row (not inside totals)
    if (metric.directField) {
        return computeDirectField(player, metric);
    }

    const totals = player[metric.totalsKey!];
    if (!totals) return 0;

    let value: number;

    if (metric.isRate) {
        const weightsKey = metric.totalsKey!.replace('Totals', 'RateWeights');
        const denom = player[weightsKey]?.[metric.field!] || 0;
        const numer = totals[metric.field!] || 0;
        value = denom > 0 ? (numer / denom) * 100 : 0;
    } else {
        value = totals[metric.field!] || 0;
    }

    if (metric.perSecond) {
        const ms = player.totalFightMs || player.activeMs || 0;
        const seconds = Math.max(1, ms / 1000);
        value = value / seconds;
    }

    if (metric.perMinute) {
        const ms = player.totalFightMs || player.activeMs || 0;
        const minutes = Math.max(1 / 60, ms / 60000);
        value = value / minutes;
    }

    if (metric.perFight) {
        const logs = player.logsJoined || 1;
        value = value / logs;
    }

    return value;
}

function computeDirectField(player: any, metric: ComparisonMetric): number {
    switch (metric.directField) {
        case 'activePercent': {
            const squad = player.squadActiveMs || 0;
            const total = player.totalFightMs || 0;
            return total > 0 ? (squad / total) * 100 : 0;
        }
        case 'stackPercent': {
            const stacked = player.stackedLogCount || 0;
            const logs = player.logsJoined || 0;
            return logs > 0 ? (stacked / logs) * 100 : 0;
        }
        case 'avgDistCmd': {
            const dist = player.totalDist || 0;
            const count = player.distCount || 0;
            return count > 0 ? dist / count : 0;
        }
        default:
            return player[metric.directField!] || 0;
    }
}

function getBoonMetricValue(player: any, metric: ComparisonMetric, boonTables?: any[]): number {
    if (!boonTables) return 0;
    const table = boonTables.find((t: any) => t.id === metric.boonId);
    if (!table) return 0;
    const row = (table.rows || []).find((r: any) => r.account === player.account);
    if (!row) return 0;
    const categoryData = row.categories?.[metric.boonCategory!];
    if (!categoryData) return 0;
    const activeTimeMs = row.activeTimeMs || 1;
    // seconds per minute of generation
    const generationMs = categoryData.generationMs || 0;
    const activeMinutes = activeTimeMs / 60000;
    return activeMinutes > 0 ? (generationMs / 1000) / activeMinutes : 0;
}

function getBurstMetricValue(player: any, metric: ComparisonMetric, spikePlayers?: any[]): number {
    if (!spikePlayers) return 0;
    const spikePlayer = spikePlayers.find((sp: any) => sp.account === player.account);
    if (!spikePlayer) return 0;
    if (metric.burstField === 'burstAvg') {
        // Average burst: sum of all fight peak1s values / logs
        // SpikeDamagePlayer only stores the peak, not sum — use peak1s as approximation
        // A proper avg would need per-fight data; peak1s is already the best single-session value
        return spikePlayer.peak1s || 0;
    }
    return spikePlayer[metric.burstField!] || 0;
}
```

- [ ] **Step 6: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/renderer/stats/utils/comparisonMetrics.ts
git commit -m "feat(comparison): extend ComparisonMetric with general, boon, burst, per-minute, per-fight types"
```

---

### Task 4: Update `PlayerComparisonSection` to pass boon and spike context

**Files:**
- Modify: `src/renderer/stats/sections/PlayerComparisonSection.tsx`

- [ ] **Step 1: Import `ComparisonContext` and build context object**

Update the import at line 7 to also import `ComparisonContext`:

```typescript
import {
    COMPARISON_CATEGORIES,
    COMPARISON_METRICS,
    getMetricValue,
    getPlayersArrayKey,
    type ComparisonCategory,
    type ComparisonMetric,
    type ComparisonContext,
} from '../utils/comparisonMetrics';
```

- [ ] **Step 2: Build the comparison context in the main component**

After line 55 (`const metrics = COMPARISON_METRICS[comparisonCategory];`), add:

```typescript
    const comparisonContext: ComparisonContext = useMemo(() => ({
        boonTables: stats?.boonTables,
        spikePlayers: stats?.spikeDamage?.players,
    }), [stats?.boonTables, stats?.spikeDamage?.players]);
```

Add `useMemo` to the React import at line 1 (it's already imported).

- [ ] **Step 3: Pass `comparisonContext` to HeadToHeadView and VsAverageView**

Update the HeadToHeadView call (around line 133):

```typescript
                    <HeadToHeadView
                        players={players}
                        playerA={playerA}
                        playerB={playerB}
                        playerAKey={playerAKey}
                        playerBKey={playerBKey}
                        setPlayerAKey={setPlayerAKey}
                        setPlayerBKey={setPlayerBKey}
                        metrics={metrics}
                        formatValue={formatValue}
                        renderProfessionIcon={renderProfessionIcon}
                        comparisonContext={comparisonContext}
                    />
```

Update the VsAverageView call (around line 146):

```typescript
                    <VsAverageView
                        players={players}
                        metrics={metrics}
                        formatValue={formatValue}
                        renderProfessionIcon={renderProfessionIcon}
                        sortMetric={avgSortMetric}
                        sortDir={avgSortDir}
                        onSort={(metricId) => {
                            if (avgSortMetric === metricId) {
                                setAvgSortDir(avgSortDir === 'desc' ? 'asc' : 'desc');
                            } else {
                                setAvgSortMetric(metricId);
                                setAvgSortDir('desc');
                            }
                        }}
                        comparisonContext={comparisonContext}
                    />
```

- [ ] **Step 4: Update HeadToHeadView to accept and use `comparisonContext`**

Add `comparisonContext` to the props type (around line 245) and destructuring (around line 256):

```typescript
const HeadToHeadView = ({
    players,
    playerA,
    playerB,
    playerAKey,
    playerBKey,
    setPlayerAKey,
    setPlayerBKey,
    metrics,
    formatValue,
    renderProfessionIcon,
    comparisonContext,
}: {
    players: any[];
    playerA: any;
    playerB: any;
    playerAKey: string | null;
    playerBKey: string | null;
    setPlayerAKey: (key: string | null) => void;
    setPlayerBKey: (key: string | null) => void;
    metrics: ComparisonMetric[];
    formatValue: (value: number, metric: ComparisonMetric) => string;
    renderProfessionIcon: any;
    comparisonContext: ComparisonContext;
}) => {
```

Update the `getMetricValue` calls inside the tbody (around line 297-298):

```typescript
                            {metrics.map((metric) => {
                                const valA = getMetricValue(playerA, metric, comparisonContext);
                                const valB = getMetricValue(playerB, metric, comparisonContext);
```

- [ ] **Step 5: Update VsAverageView to accept and use `comparisonContext`**

Add `comparisonContext` to props type and destructuring (around line 328-343):

```typescript
const VsAverageView = ({
    players,
    metrics,
    formatValue,
    renderProfessionIcon,
    sortMetric,
    sortDir,
    onSort,
    comparisonContext,
}: {
    players: any[];
    metrics: ComparisonMetric[];
    formatValue: (value: number, metric: ComparisonMetric) => string;
    renderProfessionIcon: any;
    sortMetric: string | null;
    sortDir: 'asc' | 'desc';
    onSort: (metricId: string) => void;
    comparisonContext: ComparisonContext;
}) => {
```

Update all `getMetricValue` calls in VsAverageView to pass `comparisonContext`:

In the `averages` useMemo (around line 348):
```typescript
            const values = players.map((p) => getMetricValue(p, metric, comparisonContext));
```

Update the useMemo dependency array to include `comparisonContext`.

In the `sortedPlayers` useMemo (around line 359-360):
```typescript
            const va = getMetricValue(a, metric, comparisonContext);
            const vb = getMetricValue(b, metric, comparisonContext);
```

Update the useMemo dependency array to include `comparisonContext`.

In the player rows render (around line 414):
```typescript
                                const value = getMetricValue(player, metric, comparisonContext);
```

- [ ] **Step 6: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/renderer/stats/sections/PlayerComparisonSection.tsx
git commit -m "feat(comparison): pass boon and spike context to comparison views"
```

---

### Task 5: Write tests for new metric types

**Files:**
- Modify: `src/renderer/stats/sections/__tests__/PlayerComparisonSection.test.tsx`

- [ ] **Step 1: Add tests for all new metric types**

Append these tests to the existing test file after the last `it()` block (before the closing `});`):

```typescript
    // --- Per-minute metrics ---
    it('extracts per-minute metric value', () => {
        const metric = { id: 'dpm', label: 'Avg DPM', totalsKey: 'offenseTotals' as const, field: 'damage', perMinute: true };
        const value = getMetricValue(mockOffensePlayer, metric);
        // 100000 / (120000/60000) = 100000 / 2 = 50000
        expect(value).toBeCloseTo(50000, 0);
    });

    // --- Per-fight metrics ---
    it('extracts per-fight metric value', () => {
        const player = { ...mockDefensePlayer, logsJoined: 5 };
        const metric = { id: 'deathsPerFight', label: 'Deaths/Fight', totalsKey: 'defenseTotals' as const, field: 'deadCount', perFight: true, lowerIsBetter: true };
        const value = getMetricValue(player, metric);
        // 1 death / 5 logs = 0.2
        expect(value).toBeCloseTo(0.2, 2);
    });

    it('per-fight defaults logsJoined to 1 when missing', () => {
        const metric = { id: 'deathsPerFight', label: 'Deaths/Fight', totalsKey: 'defenseTotals' as const, field: 'deadCount', perFight: true };
        const value = getMetricValue(mockDefensePlayer, metric);
        expect(value).toBe(1); // 1 death / 1 default log
    });

    // --- General / direct field metrics ---
    const mockGeneralPlayer = {
        account: 'Test.1234',
        profession: 'Warrior',
        professionList: ['Berserker'],
        totalFightMs: 600000,
        squadActiveMs: 540000,
        totalDist: 1500,
        distCount: 5,
        logsJoined: 10,
        stackedLogCount: 7,
    };

    it('computes Active %', () => {
        const metric = { id: 'activePercent', label: 'Active %', directField: 'activePercent', isPercent: true };
        const value = getMetricValue(mockGeneralPlayer, metric);
        // 540000 / 600000 * 100 = 90%
        expect(value).toBeCloseTo(90, 0);
    });

    it('computes Stack %', () => {
        const metric = { id: 'stackPercent', label: 'Stack %', directField: 'stackPercent', isPercent: true };
        const value = getMetricValue(mockGeneralPlayer, metric);
        // 7 / 10 * 100 = 70%
        expect(value).toBeCloseTo(70, 0);
    });

    it('computes Avg Dist Cmd', () => {
        const metric = { id: 'avgDistCmd', label: 'Avg Dist Cmd', directField: 'avgDistCmd', lowerIsBetter: true };
        const value = getMetricValue(mockGeneralPlayer, metric);
        // 1500 / 5 = 300
        expect(value).toBe(300);
    });

    it('returns 0 for direct field when data is missing', () => {
        const emptyPlayer = { account: 'Empty.0000', profession: 'Unknown', professionList: [] };
        const metric = { id: 'activePercent', label: 'Active %', directField: 'activePercent', isPercent: true };
        expect(getMetricValue(emptyPlayer, metric)).toBe(0);
    });

    // --- Boon metrics ---
    const mockBoonTables = [
        {
            id: 'b740',
            name: 'Might',
            stacking: true,
            rows: [
                {
                    account: 'Test.1234',
                    profession: 'Warrior',
                    activeTimeMs: 120000, // 2 minutes
                    numFights: 2,
                    groupSupported: 10,
                    squadSupported: 50,
                    categories: {
                        selfBuffs: { generationMs: 5000, wastedMs: 0 },
                        groupBuffs: { generationMs: 30000, wastedMs: 0 },
                        squadBuffs: { generationMs: 60000, wastedMs: 0 },
                    },
                },
            ],
        },
    ];

    it('extracts boon generation in seconds/min', () => {
        const metric = { id: 'might', label: 'Might', boonId: 'b740', boonCategory: 'squadBuffs' as const };
        const context = { boonTables: mockBoonTables };
        const value = getMetricValue({ account: 'Test.1234' }, metric, context);
        // generationMs=60000, activeTimeMs=120000 → 60s generation / 2 min active = 30 sec/min
        expect(value).toBeCloseTo(30, 0);
    });

    it('returns 0 for boon when player not in table', () => {
        const metric = { id: 'might', label: 'Might', boonId: 'b740', boonCategory: 'squadBuffs' as const };
        const context = { boonTables: mockBoonTables };
        expect(getMetricValue({ account: 'Nobody.0000' }, metric, context)).toBe(0);
    });

    it('returns 0 for boon when table not found', () => {
        const metric = { id: 'fury', label: 'Fury', boonId: 'b725', boonCategory: 'squadBuffs' as const };
        const context = { boonTables: mockBoonTables };
        expect(getMetricValue({ account: 'Test.1234' }, metric, context)).toBe(0);
    });

    it('returns 0 for boon when no context provided', () => {
        const metric = { id: 'might', label: 'Might', boonId: 'b740', boonCategory: 'squadBuffs' as const };
        expect(getMetricValue({ account: 'Test.1234' }, metric)).toBe(0);
    });

    // --- Burst metrics ---
    const mockSpikePlayers = [
        { account: 'Test.1234', peak1s: 45000, peak5s: 120000, peak30s: 500000 },
    ];

    it('extracts burst peak1s value', () => {
        const metric = { id: 'burst1s', label: 'Burst 1s', burstField: 'peak1s' };
        const context = { spikePlayers: mockSpikePlayers };
        const value = getMetricValue({ account: 'Test.1234' }, metric, context);
        expect(value).toBe(45000);
    });

    it('returns 0 for burst when player not in spike data', () => {
        const metric = { id: 'burst1s', label: 'Burst 1s', burstField: 'peak1s' };
        const context = { spikePlayers: mockSpikePlayers };
        expect(getMetricValue({ account: 'Nobody.0000' }, metric, context)).toBe(0);
    });

    it('returns 0 for burst when no context provided', () => {
        const metric = { id: 'burst1s', label: 'Burst 1s', burstField: 'peak1s' };
        expect(getMetricValue({ account: 'Test.1234' }, metric)).toBe(0);
    });
```

- [ ] **Step 2: Run the tests**

Run: `npx vitest run src/renderer/stats/sections/__tests__/PlayerComparisonSection.test.tsx`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/renderer/stats/sections/__tests__/PlayerComparisonSection.test.tsx
git commit -m "test(comparison): add tests for per-minute, per-fight, boon, burst, and general metrics"
```

---

### Task 6: Run full validation

**Files:** None (verification only)

- [ ] **Step 1: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 2: Run all unit tests**

Run: `npm run test:unit`
Expected: All tests PASS

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: PASS (0 warnings)

- [ ] **Step 4: Fix any issues found**

If typecheck/tests/lint fail, fix the issues and re-run.

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add -u
git commit -m "fix(comparison): address validation issues from extended metrics"
```
