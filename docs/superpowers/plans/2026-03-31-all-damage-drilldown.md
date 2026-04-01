# All Damage Drill-Down Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a three-level drill-down section (fight overview → per-player 5s chart → per-target table) to the Offense group with an All Damage / Down Contribution toggle.

**Architecture:** A standalone `AllDamageSection` component with three sub-components (fight chart, player chart, player table) sharing state via a `useAllDamageState` hook. Data is pre-computed in `computeAllDamageData` (called from `computeStatsAggregation`) for L1 and L2; L3 data is derived on-the-fly. Reuses `toPerSecond` and `getBuckets` extracted from `computeSpikeDamageData`.

**Tech Stack:** React, Recharts (LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip), TypeScript, vitest

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/renderer/stats/utils/damageSeriesUtils.ts` | Shared `toPerSecond`, `getBuckets`, `getPerSecondDamageSeries` extracted from spike damage |
| `src/renderer/stats/computeAllDamageData.ts` | Pre-compute L1 fight totals + L2 per-player 5s buckets for both damage modes |
| `src/renderer/stats/sections/allDamage/useAllDamageState.ts` | State hook: damageBasis, selectedFightIndex, selectedPlayerName |
| `src/renderer/stats/sections/allDamage/AllDamageFightChart.tsx` | L1: Line chart, one point per fight |
| `src/renderer/stats/sections/allDamage/AllDamagePlayerChart.tsx` | L2: Multi-line chart, one line per player, 5s buckets |
| `src/renderer/stats/sections/allDamage/AllDamagePlayerTable.tsx` | L3: Per-target damage breakdown table |
| `src/renderer/stats/sections/AllDamageSection.tsx` | Top-level section: header, toggle, renders L1/L2/L3 |
| `src/renderer/stats/hooks/useStatsNavigation.ts` | Add `all-damage` to Offense group (modify) |
| `src/renderer/StatsView.tsx` | Add to `ORDERED_SECTION_IDS`, render `AllDamageSection` (modify) |
| `src/renderer/stats/computeStatsAggregation.ts` | Call `computeAllDamageData`, add to stats return (modify) |
| `src/web/reportApp.tsx` | Add `all-damage` to offense nav group (modify) |

---

### Task 1: Extract shared damage series utilities

**Files:**
- Create: `src/renderer/stats/utils/damageSeriesUtils.ts`
- Modify: `src/renderer/stats/computeSpikeDamageData.ts`

Extract `toPerSecond`, `getBuckets`, and `getPerSecondDamageSeries` so both spike damage and all-damage can share them.

- [ ] **Step 1: Create the shared utility file**

```typescript
// src/renderer/stats/utils/damageSeriesUtils.ts

/**
 * Convert a cumulative damage series to per-second deltas.
 * Input: [0, 100, 350, 800] → Output: [0, 100, 250, 450]
 */
export const toPerSecond = (series: number[]): number[] => {
    if (!Array.isArray(series) || series.length === 0) return [] as number[];
    const deltas: number[] = [];
    for (let i = 0; i < series.length; i += 1) {
        const current = Number(series[i] || 0);
        const prev = i > 0 ? Number(series[i - 1] || 0) : 0;
        deltas.push(Math.max(0, current - prev));
    }
    return deltas;
};

/**
 * Aggregate per-second values into fixed-size buckets.
 * getBuckets([10, 20, 30, 40, 50], 2) → [30, 70, 50]
 */
export const getBuckets = (values: number[], bucketSizeSeconds: number): number[] => {
    if (!Array.isArray(values) || values.length === 0 || bucketSizeSeconds <= 0) return [] as number[];
    const out: number[] = [];
    for (let i = 0; i < values.length; i += bucketSizeSeconds) {
        const end = Math.min(i + bucketSizeSeconds, values.length);
        const bucket = values.slice(i, end).reduce((sum, value) => sum + Number(value || 0), 0);
        out.push(bucket);
    }
    return out;
};

/**
 * Sum multiple cumulative target series into one cumulative series.
 */
export const sumCumulativeTargets = (targetSeries: any[]): number[] => {
    if (!Array.isArray(targetSeries)) return [] as number[];
    const maxLen = targetSeries.reduce((len: number, series: any) => Math.max(len, Array.isArray(series) ? series.length : 0), 0);
    if (maxLen <= 0) return [] as number[];
    const summed = new Array<number>(maxLen).fill(0);
    targetSeries.forEach((series: any) => {
        if (!Array.isArray(series)) return;
        for (let i = 0; i < maxLen; i += 1) {
            summed[i] += Number(series[i] || 0);
        }
    });
    return summed;
};

const normalizeNumberSeries = (series: any): number[] | null =>
    Array.isArray(series) ? series.map((value: any) => Number(value || 0)) : null;

/**
 * Extract per-second damage deltas from a player's EI JSON data.
 * Prefers targetDamage1S (per-target breakdown) over damage1S (total only).
 * Handles two EI shapes:
 *   Shape A: targetDamage1S[phase][target][time]
 *   Shape B: targetDamage1S[target][phase][time]
 */
export const getPerSecondDamageSeries = (player: any): { perSecond: number[]; usedFallback: boolean } => {
    const extractTargetPhase0 = (targetDamage1S: any): number[] | null => {
        if (!Array.isArray(targetDamage1S) || targetDamage1S.length === 0) return null;
        const first = targetDamage1S[0];
        if (!Array.isArray(first)) return null;

        // Shape A: [phase][target][time]
        if (Array.isArray(first[0]) && Array.isArray(first[0][0])) {
            return sumCumulativeTargets(first);
        }

        // Shape B: [target][phase][time]
        if (Array.isArray(first[0]) && !Array.isArray(first[0][0])) {
            const phaseSeries = targetDamage1S
                .map((target: any) => normalizeNumberSeries(Array.isArray(target) ? target[0] : null))
                .filter((series: number[] | null): series is number[] => Array.isArray(series) && series.length > 0);
            if (phaseSeries.length > 0) return sumCumulativeTargets(phaseSeries);
        }

        return null;
    };
    const targetPhase0 = extractTargetPhase0(player?.targetDamage1S);
    const totalPhase0 = Array.isArray(player?.damage1S) && Array.isArray(player.damage1S[0])
        ? player.damage1S[0]
        : null;
    const usedFallback = !targetPhase0;
    const cumulative = targetPhase0
        ? targetPhase0
        : (Array.isArray(totalPhase0) ? totalPhase0.map((v: any) => Number(v || 0)) : []);
    return { perSecond: toPerSecond(cumulative), usedFallback };
};
```

- [ ] **Step 2: Update computeSpikeDamageData.ts to import from shared utils**

Replace the inline definitions of `toPerSecond`, `getBuckets`, `sumCumulativeTargets`, `normalizeNumberSeries`, `extractTargetPhase0`, and `getPerSecondDamageSeries` in `computeSpikeDamageData.ts` with imports from the new shared file.

At the top of `computeSpikeDamageData.ts`, add:
```typescript
import { toPerSecond, getBuckets, getPerSecondDamageSeries } from './utils/damageSeriesUtils';
```

Then remove these inline definitions (lines ~116-170 and ~186-195 inside the `computeSpikeDamageData` function):
- The `toPerSecond` function (lines 116-125)
- The `sumCumulativeTargets` function (lines 126-138)
- The `normalizeNumberSeries` function (lines 139-140)
- The `extractTargetPhase0` function (lines 141-160)
- The 4 lines that call `extractTargetPhase0`/`toPerSecond` (lines 161-169)
- The `getBuckets` function (lines 186-195)

Replace the `getPerSecondDamageSeries` function and its internals with:
```typescript
    // getPerSecondDamageSeries is now imported from utils/damageSeriesUtils
```

And update all call sites within the file:
- `getPerSecondDamageSeries(player)` calls remain the same (they use the imported version)
- `toPerSecond(...)` calls remain the same
- `getBuckets(...)` calls remain the same

- [ ] **Step 3: Run tests to verify refactor**

Run: `npm run test:unit -- --run`
Expected: All existing tests pass — this is a pure refactor with no behavior change.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/stats/utils/damageSeriesUtils.ts src/renderer/stats/computeSpikeDamageData.ts
git commit -m "refactor: extract shared damage series utilities from spike damage"
```

---

### Task 2: Implement computeAllDamageData

**Files:**
- Create: `src/renderer/stats/computeAllDamageData.ts`
- Create: `src/renderer/stats/__tests__/computeAllDamageData.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/renderer/stats/__tests__/computeAllDamageData.test.ts
import { describe, it, expect } from 'vitest';
import { computeAllDamageData } from '../computeAllDamageData';

const makeFakeLog = (overrides: any = {}) => ({
    id: 'log-1',
    filePath: 'log-1.zevtc',
    fightName: 'Fight 1',
    details: {
        fightName: 'Fight 1',
        durationMS: 60000,
        timeStartStd: '2026-01-01T00:00:00Z',
        targets: [
            { name: 'Enemy 1', enemyPlayer: true, isFake: false },
            { name: 'Enemy 2', enemyPlayer: true, isFake: false },
        ],
        players: [
            {
                name: 'Warrior.1234',
                display_name: 'Warrior.1234',
                profession: 'Warrior',
                group: 1,
                account: 'Warrior.1234',
                dpsAll: [{ damage: 100000, dps: 1667 }],
                statsTargets: [
                    [{ downContribution: 5000, killed: 0, downed: 1 }],
                    [{ downContribution: 3000, killed: 0, downed: 0 }],
                ],
                damage1S: [[0, 20000, 50000, 80000, 100000]],
                targetDamage1S: [
                    [[0, 12000, 30000, 48000, 60000]],
                    [[0, 8000, 20000, 32000, 40000]],
                ],
            },
            {
                name: 'Necro.5678',
                display_name: 'Necro.5678',
                profession: 'Necromancer',
                group: 1,
                account: 'Necro.5678',
                dpsAll: [{ damage: 80000, dps: 1333 }],
                statsTargets: [
                    [{ downContribution: 2000, killed: 0, downed: 0 }],
                    [{ downContribution: 1000, killed: 0, downed: 0 }],
                ],
                damage1S: [[0, 15000, 40000, 65000, 80000]],
                targetDamage1S: [
                    [[0, 9000, 24000, 39000, 48000]],
                    [[0, 6000, 16000, 26000, 32000]],
                ],
            },
        ],
        ...overrides,
    },
});

describe('computeAllDamageData', () => {
    it('computes L1 fight totals for damage and down contribution', () => {
        const logs = [makeFakeLog()];
        const result = computeAllDamageData(logs);

        expect(result.fights).toHaveLength(1);
        expect(result.fights[0].totalDamage).toBe(180000); // 100000 + 80000
        expect(result.fights[0].totalDownContribution).toBe(11000); // 5000+3000 + 2000+1000
    });

    it('computes L2 per-player 5s buckets', () => {
        const logs = [makeFakeLog()];
        const result = computeAllDamageData(logs);

        expect(result.fights[0].players).toHaveLength(2);

        const warrior = result.fights[0].players.find(p => p.playerName === 'Warrior.1234');
        expect(warrior).toBeDefined();
        expect(warrior!.profession).toBe('Warrior');
        // targetDamage1S sums: [0,20000,50000,80000,100000] cumulative
        // per-second deltas: [0, 20000, 30000, 30000, 20000]
        // 5s bucket: [100000] (single bucket since only 5 seconds)
        expect(warrior!.buckets5s).toHaveLength(1);
        expect(warrior!.buckets5s[0]).toBe(100000);
    });

    it('computes per-player down contribution buckets', () => {
        const logs = [makeFakeLog()];
        const result = computeAllDamageData(logs);

        const warrior = result.fights[0].players.find(p => p.playerName === 'Warrior.1234');
        expect(warrior).toBeDefined();
        // Down contribution buckets use same series but filtered to targets with downContribution > 0
        // Both targets have downContribution > 0, so all damage is included
        expect(warrior!.buckets5sDown).toHaveLength(1);
        expect(warrior!.buckets5sDown[0]).toBe(100000);
    });

    it('returns empty fights array for empty logs', () => {
        const result = computeAllDamageData([]);
        expect(result.fights).toHaveLength(0);
    });

    it('sorts fights by timestamp', () => {
        const log1 = makeFakeLog();
        log1.details.timeStartStd = '2026-01-01T00:01:00Z';
        log1.id = 'log-1';
        const log2 = makeFakeLog();
        log2.details.timeStartStd = '2026-01-01T00:00:00Z';
        log2.id = 'log-2';

        const result = computeAllDamageData([log1, log2]);
        expect(result.fights).toHaveLength(2);
        // log2 has earlier timestamp, should be first
        expect(result.fights[0].fightId).toBe('log-2.zevtc');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/stats/__tests__/computeAllDamageData.test.ts`
Expected: FAIL — module `../computeAllDamageData` not found.

- [ ] **Step 3: Write computeAllDamageData implementation**

```typescript
// src/renderer/stats/computeAllDamageData.ts
import { toPerSecond, getBuckets, getPerSecondDamageSeries, sumCumulativeTargets } from './utils/damageSeriesUtils';
import { resolveFightTimestamp } from './utils/timestampUtils';
import { sanitizeWvwLabel, resolveMapName, buildFightLabel } from './utils/labelUtils';
import { computeDownContribution } from '../../shared/combatMetrics';

export interface AllDamagePlayerBuckets {
    playerName: string;
    profession: string;
    buckets5s: number[];
    buckets5sDown: number[];
}

export interface AllDamageFight {
    fightIndex: number;
    fightId: string;
    shortLabel: string;
    fullLabel: string;
    timestamp: number;
    durationMs: number;
    totalDamage: number;
    totalDownContribution: number;
    players: AllDamagePlayerBuckets[];
    targets: Array<{ name: string; index: number }>;
}

export interface AllDamageData {
    fights: AllDamageFight[];
}

export function computeAllDamageData(validLogs: any[]): AllDamageData {
    const fights: AllDamageFight[] = [];

    validLogs
        .map((log) => ({ log, ts: resolveFightTimestamp(log?.details, log) }))
        .sort((a, b) => a.ts - b.ts)
        .forEach(({ log }, index) => {
            const details = log?.details;
            if (!details) return;

            const fightName = sanitizeWvwLabel(details.fightName || log.fightName || `Fight ${index + 1}`);
            const mapName = resolveMapName(details, log);
            const fullLabel = buildFightLabel(fightName, String(mapName || ''));
            const durationMs = Number(details.durationMS || 0);

            // Collect target info
            const targets = (details.targets || [])
                .map((t: any, idx: number) => ({ name: t?.name || `Target ${idx + 1}`, index: idx }))
                .filter((t: any) => t.name);

            let totalDamage = 0;
            let totalDownContribution = 0;
            const players: AllDamagePlayerBuckets[] = [];

            (details.players || []).forEach((player: any) => {
                const playerDamage = player?.dpsAll?.[0]?.damage || 0;
                totalDamage += playerDamage;

                const playerDownContrib = computeDownContribution(player);
                totalDownContribution += playerDownContrib;

                // L2: 5s damage buckets
                const { perSecond } = getPerSecondDamageSeries(player);
                const buckets5s = getBuckets(perSecond, 5);

                // L2: 5s down-contribution buckets
                // Use per-target series, but only include targets where player has downContribution > 0
                let buckets5sDown: number[] = [];
                const statsTargets = player?.statsTargets || [];
                const targetDamage1S = player?.targetDamage1S;

                if (Array.isArray(targetDamage1S) && targetDamage1S.length > 0) {
                    // Filter to targets with downContribution
                    const downTargetSeries: number[][] = [];
                    for (let tIdx = 0; tIdx < targetDamage1S.length; tIdx++) {
                        const targetStats = statsTargets[tIdx];
                        const hasDown = targetStats && Array.isArray(targetStats) && targetStats.length > 0
                            && Number((targetStats[0] as any)?.downContribution || 0) > 0;
                        if (!hasDown) continue;

                        const tSeries = targetDamage1S[tIdx];
                        if (!Array.isArray(tSeries)) continue;
                        // Handle Shape B: [target][phase][time] — take phase 0
                        const phase0 = Array.isArray(tSeries[0]) ? tSeries[0] : tSeries;
                        if (Array.isArray(phase0)) {
                            downTargetSeries.push(phase0.map((v: any) => Number(v || 0)));
                        }
                    }
                    if (downTargetSeries.length > 0) {
                        const summed = sumCumulativeTargets(downTargetSeries);
                        buckets5sDown = getBuckets(toPerSecond(summed), 5);
                    }
                }

                // Fallback: if no per-target down series but player has down contribution,
                // use full damage series as approximation
                if (buckets5sDown.length === 0 && playerDownContrib > 0) {
                    buckets5sDown = buckets5s;
                }

                players.push({
                    playerName: player?.display_name || player?.name || 'Unknown',
                    profession: player?.profession || 'Unknown',
                    buckets5s,
                    buckets5sDown,
                });
            });

            fights.push({
                fightIndex: index,
                fightId: log?.filePath || log?.id || `fight-${index + 1}`,
                shortLabel: `F${index + 1}`,
                fullLabel,
                timestamp: resolveFightTimestamp(details, log),
                durationMs,
                totalDamage,
                totalDownContribution,
                players,
                targets,
            });
        });

    return { fights };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/renderer/stats/__tests__/computeAllDamageData.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/stats/computeAllDamageData.ts src/renderer/stats/__tests__/computeAllDamageData.test.ts
git commit -m "feat: add computeAllDamageData for all-damage drill-down"
```

---

### Task 3: Wire computeAllDamageData into stats aggregation

**Files:**
- Modify: `src/renderer/stats/computeStatsAggregation.ts`

- [ ] **Step 1: Add import**

At the top of `computeStatsAggregation.ts` (after the existing compute imports around line 10), add:

```typescript
import { computeAllDamageData } from './computeAllDamageData';
```

- [ ] **Step 2: Call computeAllDamageData**

After line 733 (`const stripSpikes = computeStripSpikesData(validLogs, splitPlayersByClass);`), add:

```typescript
        const allDamage = computeAllDamageData(validLogs);
```

- [ ] **Step 3: Add to return object**

In the return object (after `stripSpikes,` on line 816), add:

```typescript
            allDamage,
```

- [ ] **Step 4: Run tests**

Run: `npm run test:unit -- --run`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/stats/computeStatsAggregation.ts
git commit -m "feat: wire computeAllDamageData into stats aggregation"
```

---

### Task 4: Create useAllDamageState hook

**Files:**
- Create: `src/renderer/stats/sections/allDamage/useAllDamageState.ts`

- [ ] **Step 1: Create the state hook**

```typescript
// src/renderer/stats/sections/allDamage/useAllDamageState.ts
import { useState, useCallback } from 'react';

export type DamageBasis = 'all' | 'down';

export function useAllDamageState() {
    const [damageBasis, setDamageBasisRaw] = useState<DamageBasis>('all');
    const [selectedFightIndex, setSelectedFightIndexRaw] = useState<number | null>(null);
    const [selectedPlayerName, setSelectedPlayerNameRaw] = useState<string | null>(null);

    const setDamageBasis = useCallback((basis: DamageBasis) => {
        setDamageBasisRaw(basis);
        setSelectedFightIndexRaw(null);
        setSelectedPlayerNameRaw(null);
    }, []);

    const setSelectedFightIndex = useCallback((index: number | null) => {
        setSelectedFightIndexRaw(index);
        setSelectedPlayerNameRaw(null);
    }, []);

    const setSelectedPlayerName = useCallback((name: string | null) => {
        setSelectedPlayerNameRaw(name);
    }, []);

    return {
        damageBasis,
        setDamageBasis,
        selectedFightIndex,
        setSelectedFightIndex,
        selectedPlayerName,
        setSelectedPlayerName,
    };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/stats/sections/allDamage/useAllDamageState.ts
git commit -m "feat: add useAllDamageState hook for drill-down state"
```

---

### Task 5: Create AllDamageFightChart (Level 1)

**Files:**
- Create: `src/renderer/stats/sections/allDamage/AllDamageFightChart.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/renderer/stats/sections/allDamage/AllDamageFightChart.tsx
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartContainer } from '../../ui/ChartContainer';
import type { AllDamageFight } from '../../computeAllDamageData';
import type { DamageBasis } from './useAllDamageState';

interface AllDamageFightChartProps {
    fights: AllDamageFight[];
    damageBasis: DamageBasis;
    selectedFightIndex: number | null;
    onFightClick: (index: number) => void;
}

const formatDamage = (value: number): string => {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
    return String(value);
};

export function AllDamageFightChart({ fights, damageBasis, selectedFightIndex, onFightClick }: AllDamageFightChartProps) {
    const chartData = fights.map((fight, idx) => ({
        index: idx,
        label: fight.shortLabel,
        fullLabel: fight.fullLabel,
        value: damageBasis === 'down' ? fight.totalDownContribution : fight.totalDamage,
    }));

    const maxY = Math.max(...chartData.map(d => d.value), 1);

    return (
        <ChartContainer width="100%" height={180}>
            <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis
                    domain={[0, maxY]}
                    tickFormatter={formatDamage}
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    width={52}
                />
                <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 6 }}
                    labelStyle={{ color: '#e2e8f0' }}
                    formatter={(value: number) => [formatDamage(value), damageBasis === 'down' ? 'Down Contrib' : 'Damage']}
                    labelFormatter={(_label: string, payload: any[]) => payload?.[0]?.payload?.fullLabel || _label}
                />
                <Line
                    type="monotone"
                    dataKey="value"
                    stroke={damageBasis === 'down' ? '#f59e0b' : '#6366f1'}
                    strokeWidth={2}
                    dot={(props: any) => {
                        const { cx, cy, index: dotIndex } = props;
                        const isSelected = dotIndex === selectedFightIndex;
                        return (
                            <circle
                                key={dotIndex}
                                cx={cx}
                                cy={cy}
                                r={isSelected ? 7 : 4}
                                fill={isSelected ? '#f59e0b' : (damageBasis === 'down' ? '#f59e0b' : '#6366f1')}
                                stroke={isSelected ? '#fff' : 'none'}
                                strokeWidth={isSelected ? 2 : 0}
                                style={{ cursor: 'pointer' }}
                                onClick={() => onFightClick(dotIndex)}
                            />
                        );
                    }}
                    activeDot={false}
                />
            </LineChart>
        </ChartContainer>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/stats/sections/allDamage/AllDamageFightChart.tsx
git commit -m "feat: add AllDamageFightChart (L1 fight overview)"
```

---

### Task 6: Create AllDamagePlayerChart (Level 2)

**Files:**
- Create: `src/renderer/stats/sections/allDamage/AllDamagePlayerChart.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/renderer/stats/sections/allDamage/AllDamagePlayerChart.tsx
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartContainer } from '../../ui/ChartContainer';
import { getProfessionColor } from '../../../../shared/professionUtils';
import type { AllDamagePlayerBuckets } from '../../computeAllDamageData';
import type { DamageBasis } from './useAllDamageState';

interface AllDamagePlayerChartProps {
    players: AllDamagePlayerBuckets[];
    damageBasis: DamageBasis;
    selectedPlayerName: string | null;
    onPlayerClick: (playerName: string) => void;
}

const formatDamage = (value: number): string => {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
    return String(value);
};

export function AllDamagePlayerChart({ players, damageBasis, selectedPlayerName, onPlayerClick }: AllDamagePlayerChartProps) {
    // Build chart data: each row is a time bucket, each player is a data key
    const maxBuckets = Math.max(...players.map(p => {
        const buckets = damageBasis === 'down' ? p.buckets5sDown : p.buckets5s;
        return buckets.length;
    }), 0);

    const chartData = Array.from({ length: maxBuckets }, (_, i) => {
        const row: Record<string, any> = { label: `${i * 5}s` };
        players.forEach(p => {
            const buckets = damageBasis === 'down' ? p.buckets5sDown : p.buckets5s;
            row[p.playerName] = buckets[i] || 0;
        });
        return row;
    });

    const maxY = Math.max(
        ...chartData.flatMap(row => players.map(p => Number(row[p.playerName] || 0))),
        1
    );

    return (
        <div>
            <div className="flex gap-3 flex-wrap mb-2">
                {players.map(p => (
                    <button
                        key={p.playerName}
                        className="flex items-center gap-1.5 text-xs hover:opacity-80 transition-opacity"
                        style={{
                            color: getProfessionColor(p.profession),
                            opacity: selectedPlayerName && selectedPlayerName !== p.playerName ? 0.3 : 1,
                        }}
                        onClick={() => onPlayerClick(p.playerName)}
                    >
                        <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: getProfessionColor(p.profession) }} />
                        {p.playerName}
                    </button>
                ))}
            </div>
            <ChartContainer width="100%" height={200}>
                <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis
                        domain={[0, maxY]}
                        tickFormatter={formatDamage}
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        width={52}
                    />
                    <Tooltip
                        contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 6 }}
                        labelStyle={{ color: '#e2e8f0' }}
                        formatter={(value: number, name: string) => [formatDamage(value), name]}
                    />
                    {players.map(p => (
                        <Line
                            key={p.playerName}
                            type="monotone"
                            dataKey={p.playerName}
                            stroke={getProfessionColor(p.profession)}
                            strokeWidth={selectedPlayerName === p.playerName ? 3 : (selectedPlayerName ? 1 : 2)}
                            strokeOpacity={selectedPlayerName && selectedPlayerName !== p.playerName ? 0.25 : 1}
                            dot={false}
                            activeDot={{
                                onClick: () => onPlayerClick(p.playerName),
                                style: { cursor: 'pointer' },
                            }}
                        />
                    ))}
                </LineChart>
            </ChartContainer>
        </div>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/stats/sections/allDamage/AllDamagePlayerChart.tsx
git commit -m "feat: add AllDamagePlayerChart (L2 per-player 5s buckets)"
```

---

### Task 7: Create AllDamagePlayerTable (Level 3)

**Files:**
- Create: `src/renderer/stats/sections/allDamage/AllDamagePlayerTable.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/renderer/stats/sections/allDamage/AllDamagePlayerTable.tsx
import { useMemo } from 'react';
import { computeDownContribution } from '../../../../shared/combatMetrics';

interface AllDamagePlayerTableProps {
    playerName: string;
    fight: {
        durationMs: number;
        targets: Array<{ name: string; index: number }>;
    };
    /** The raw EI player object from the selected fight's details */
    playerData: any;
}

interface TargetRow {
    targetName: string;
    damage: number;
    dps: number;
    downContribution: number;
}

const formatNumber = (n: number): string => n.toLocaleString();

export function AllDamagePlayerTable({ playerName, fight, playerData }: AllDamagePlayerTableProps) {
    const rows = useMemo<TargetRow[]>(() => {
        if (!playerData) return [];
        const durationSec = Math.max(1, fight.durationMs / 1000);
        const result: TargetRow[] = [];

        // Per-target rows
        const statsTargets = playerData.statsTargets || [];
        const dpsTargets = playerData.dpsTargets || [];
        fight.targets.forEach((target, tIdx) => {
            const targetDps = dpsTargets?.[tIdx]?.[0];
            const targetStats = statsTargets?.[tIdx]?.[0] as any;
            const damage = Number(targetDps?.damage || 0);
            const downContribution = Number(targetStats?.downContribution || 0);
            result.push({
                targetName: target.name,
                damage,
                dps: Math.round(damage / durationSec),
                downContribution,
            });
        });

        // "All Targets" summary row
        const totalDamage = playerData.dpsAll?.[0]?.damage || 0;
        const totalDown = computeDownContribution(playerData);
        result.unshift({
            targetName: 'All Targets',
            damage: totalDamage,
            dps: Math.round(totalDamage / durationSec),
            downContribution: totalDown,
        });

        return result;
    }, [playerData, fight]);

    if (rows.length === 0) return null;

    return (
        <div className="mt-3">
            <div className="text-sm font-medium text-slate-200 mb-2">
                {playerName} — Damage Breakdown
            </div>
            <table className="w-full text-sm border-collapse">
                <thead>
                    <tr className="border-b border-slate-700 text-slate-400">
                        <th className="text-left py-2 px-3">Target</th>
                        <th className="text-right py-2 px-3">Damage</th>
                        <th className="text-right py-2 px-3">DPS</th>
                        <th className="text-right py-2 px-3">Down Contrib</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, idx) => (
                        <tr
                            key={row.targetName}
                            className={idx === 0 ? 'border-b border-slate-700 font-medium' : 'border-b border-slate-800'}
                        >
                            <td className="py-2 px-3 text-slate-200">{row.targetName}</td>
                            <td className="text-right py-2 px-3 text-indigo-400">{formatNumber(row.damage)}</td>
                            <td className="text-right py-2 px-3 text-slate-400">{formatNumber(row.dps)}</td>
                            <td className="text-right py-2 px-3 text-amber-400">{formatNumber(row.downContribution)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/stats/sections/allDamage/AllDamagePlayerTable.tsx
git commit -m "feat: add AllDamagePlayerTable (L3 per-target breakdown)"
```

---

### Task 8: Create AllDamageSection (top-level section)

**Files:**
- Create: `src/renderer/stats/sections/AllDamageSection.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/renderer/stats/sections/AllDamageSection.tsx
import { useMemo } from 'react';
import { Crosshair } from 'lucide-react';
import { PillToggleGroup } from '../ui/PillToggleGroup';
import { useStatsSharedContext } from '../StatsViewContext';
import { useAllDamageState } from './allDamage/useAllDamageState';
import { AllDamageFightChart } from './allDamage/AllDamageFightChart';
import { AllDamagePlayerChart } from './allDamage/AllDamagePlayerChart';
import { AllDamagePlayerTable } from './allDamage/AllDamagePlayerTable';
import type { AllDamageData, AllDamageFight } from '../computeAllDamageData';

interface AllDamageSectionProps {
    sectionId?: string;
    allDamageData: AllDamageData;
    logs: any[];
}

export function AllDamageSection({ sectionId = 'all-damage', allDamageData, logs }: AllDamageSectionProps) {
    const { sectionVisibility } = useStatsSharedContext();
    const {
        damageBasis, setDamageBasis,
        selectedFightIndex, setSelectedFightIndex,
        selectedPlayerName, setSelectedPlayerName,
    } = useAllDamageState();

    if (sectionVisibility && !sectionVisibility(sectionId)) return null;

    const fights = allDamageData?.fights || [];
    if (fights.length === 0) return null;

    const selectedFight: AllDamageFight | null = selectedFightIndex !== null ? (fights[selectedFightIndex] || null) : null;

    // Resolve raw EI player data for L3 table
    const selectedPlayerData = useMemo(() => {
        if (!selectedFight || !selectedPlayerName) return null;
        // Find the corresponding log to get raw EI player data
        const sortedLogs = [...logs]
            .filter(l => l?.details)
            .sort((a, b) => {
                const tsA = new Date(a.details?.timeStartStd || 0).getTime();
                const tsB = new Date(b.details?.timeStartStd || 0).getTime();
                return tsA - tsB;
            });
        const log = sortedLogs[selectedFight.fightIndex];
        if (!log?.details?.players) return null;
        return log.details.players.find(
            (p: any) => (p.display_name || p.name) === selectedPlayerName
        ) || null;
    }, [selectedFight, selectedPlayerName, logs]);

    return (
        <div id={sectionId} className="stats-section">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Crosshair className="w-5 h-5 text-indigo-400" />
                    <h3 className="text-lg font-semibold text-slate-100">All Damage</h3>
                </div>
                <PillToggleGroup
                    options={[
                        { id: 'all', label: 'All Damage' },
                        { id: 'down', label: 'Down Contribution' },
                    ]}
                    value={damageBasis}
                    onChange={setDamageBasis}
                />
            </div>

            {/* Level 1: Fight overview */}
            <AllDamageFightChart
                fights={fights}
                damageBasis={damageBasis}
                selectedFightIndex={selectedFightIndex}
                onFightClick={(idx) => setSelectedFightIndex(selectedFightIndex === idx ? null : idx)}
            />

            {/* Level 2: Per-player chart for selected fight */}
            {selectedFight && (
                <div className="mt-4 pt-4 border-t border-slate-700">
                    <div className="text-sm font-medium text-slate-300 mb-2">
                        {selectedFight.fullLabel} — Squad {damageBasis === 'down' ? 'Down Contribution' : 'Damage'} (5s buckets)
                    </div>
                    <AllDamagePlayerChart
                        players={selectedFight.players}
                        damageBasis={damageBasis}
                        selectedPlayerName={selectedPlayerName}
                        onPlayerClick={(name) => setSelectedPlayerName(selectedPlayerName === name ? null : name)}
                    />
                </div>
            )}

            {/* Level 3: Per-target table for selected player */}
            {selectedFight && selectedPlayerName && selectedPlayerData && (
                <div className="mt-3 pt-3 border-t border-slate-800">
                    <AllDamagePlayerTable
                        playerName={selectedPlayerName}
                        fight={{
                            durationMs: selectedFight.durationMs,
                            targets: selectedFight.targets,
                        }}
                        playerData={selectedPlayerData}
                    />
                </div>
            )}
        </div>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/stats/sections/AllDamageSection.tsx
git commit -m "feat: add AllDamageSection with 3-level drill-down"
```

---

### Task 9: Register section in navigation and StatsView

**Files:**
- Modify: `src/renderer/stats/hooks/useStatsNavigation.ts`
- Modify: `src/renderer/StatsView.tsx`
- Modify: `src/web/reportApp.tsx`

- [ ] **Step 1: Add to STATS_TOC_GROUPS in useStatsNavigation.ts**

In the offense group (line 94), add `'all-damage'` to `sectionIds` after `'strip-spikes'`:
```typescript
        sectionIds: ['offense-detailed', 'damage-modifiers', 'player-breakdown', 'damage-breakdown', 'spike-damage', 'strip-spikes', 'all-damage', 'conditions-outgoing'],
```

In the offense `items` array (after the strip-spikes item on line 101), add:
```typescript
            { id: 'all-damage', label: 'All Damage', icon: Crosshair },
```

Add the `Crosshair` import at the top of the file with the other lucide-react imports.

- [ ] **Step 2: Add to ORDERED_SECTION_IDS in StatsView.tsx**

In `ORDERED_SECTION_IDS` (around line 130), add `'all-damage'` after `'spike-damage'`:
```typescript
    'spike-damage',
    'all-damage',
    'conditions-outgoing',
```

Note: `'strip-spikes'` may or may not be in this array already. Insert `'all-damage'` right before `'conditions-outgoing'`.

- [ ] **Step 3: Import and render AllDamageSection in StatsView.tsx**

Add import at the top of `StatsView.tsx`:
```typescript
import { AllDamageSection } from './stats/sections/AllDamageSection';
```

After the strip-spikes `FightMetricSection` render block (around line 4237) and before the `ConditionsSection` render block, add:

```tsx
                            {renderSectionWrap(<AllDamageSection
                                sectionId="all-damage"
                                allDamageData={(safeStats as any)?.allDamage || { fights: [] }}
                                logs={logs}
                            />)}
```

- [ ] **Step 4: Add to web report nav in reportApp.tsx**

In `reportApp.tsx` (line 619), update the offense `sectionIds`:
```typescript
            sectionIds: ['offense-detailed', 'damage-modifiers', 'player-breakdown', 'damage-breakdown', 'spike-damage', 'all-damage', 'conditions-outgoing'],
```

In the offense `items` array (after spike-damage item on line 625), add:
```typescript
                { id: 'all-damage', label: 'All Damage', icon: Crosshair },
```

Add `Crosshair` to the lucide-react imports at the top of `reportApp.tsx`.

- [ ] **Step 5: Run typecheck and lint**

Run: `npm run validate`
Expected: No type errors or lint warnings.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/stats/hooks/useStatsNavigation.ts src/renderer/StatsView.tsx src/web/reportApp.tsx
git commit -m "feat: register all-damage section in navigation and rendering"
```

---

### Task 10: Integration test

**Files:**
- Modify: `src/renderer/__tests__/StatsView.integration.test.tsx`

- [ ] **Step 1: Add integration test**

Add a new test case to the existing `StatsView.integration.test.tsx`:

```typescript
    it('renders All Damage section when allDamage data is present', () => {
        const stats = {
            allDamage: {
                fights: [
                    {
                        fightIndex: 0,
                        fightId: 'fight-1',
                        shortLabel: 'F1',
                        fullLabel: 'Fight 1 — Alpine',
                        timestamp: 1700000000,
                        durationMs: 60000,
                        totalDamage: 500000,
                        totalDownContribution: 50000,
                        players: [
                            { playerName: 'TestPlayer.1234', profession: 'Warrior', buckets5s: [100000, 150000, 120000], buckets5sDown: [10000, 15000, 12000] },
                        ],
                        targets: [{ name: 'Enemy 1', index: 0 }],
                    },
                ],
            },
        };

        render(
            <StatsView
                logs={[]}
                onBack={() => {}}
                precomputedStats={stats as any}
                statsViewSettings={DEFAULT_STATS_VIEW_SETTINGS}
                embedded
                dashboardTitle="All Damage Test"
            />
        );

        expect(screen.getByText(/All Damage/i)).toBeInTheDocument();
    });
```

- [ ] **Step 2: Run integration test**

Run: `npx vitest run src/renderer/__tests__/StatsView.integration.test.tsx`
Expected: All tests pass including the new one.

- [ ] **Step 3: Run full test suite**

Run: `npm run test:unit -- --run`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/__tests__/StatsView.integration.test.tsx
git commit -m "test: add integration test for All Damage section"
```

---

### Task 11: Final validation

- [ ] **Step 1: Run typecheck + lint**

Run: `npm run validate`
Expected: Clean — no errors, no warnings.

- [ ] **Step 2: Run full test suite**

Run: `npm run test:unit -- --run`
Expected: All tests pass.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: Build completes successfully.
