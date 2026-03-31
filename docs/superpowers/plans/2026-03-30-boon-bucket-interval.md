# Configurable Boon Uptime Bucket Interval — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make boon uptime timeline bucket intervals configurable, with separate settings for non-stacking (default 2s) and stacking boons (default 5s).

**Architecture:** Two new fields on `IStatsViewSettings` (`boonBucketIntervalMs`, `stackingBoonBucketIntervalMs`) flow through the stats aggregation pipeline into `computeBoonUptimeTimeline`, which selects the interval per-boon based on `meta.stacking`. The computed boon data carries `intervalMs` so the display layer can derive bucket labels and counts without hardcoded 5000.

**Tech Stack:** TypeScript, React, Vitest

**Spec:** `docs/superpowers/specs/2026-03-30-boon-bucket-interval-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/renderer/global.d.ts` | Modify | Add two fields to `IStatsViewSettings` + defaults |
| `src/renderer/stats/computeBoonUptimeTimeline.ts` | Modify | Parameterize interval, rename `buckets5s` → `buckets`, emit `intervalMs` |
| `src/renderer/stats/computeTimelineAndMapData.ts` | Modify | Accept and forward interval settings |
| `src/renderer/StatsView.tsx` | Modify | Replace hardcoded 5000/`buckets5s` in boon uptime sections with dynamic values |
| `src/renderer/SettingsView.tsx` | Modify | Add two dropdowns for boon uptime resolution |
| `src/renderer/__tests__/computeBoonUptimeTimeline.test.ts` | Create | Unit tests for parameterized interval logic |

---

### Task 1: Add settings fields to `IStatsViewSettings`

**Files:**
- Modify: `src/renderer/global.d.ts:74-83` (interface) and `src/renderer/global.d.ts:198-207` (defaults)

- [ ] **Step 1: Add fields to the interface**

In `src/renderer/global.d.ts`, add two fields to `IStatsViewSettings` after `minParticipationPercent`:

```typescript
export interface IStatsViewSettings {
    showTopStats: boolean;
    showMvp: boolean;
    roundCountStats: boolean;
    splitPlayersByClass: boolean;
    topStatsMode: 'total' | 'perSecond' | 'perMinute';
    topSkillDamageSource: 'total' | 'target';
    topSkillsMetric: 'damage' | 'downContribution';
    minParticipationPercent: number;
    boonBucketIntervalMs: number;
    stackingBoonBucketIntervalMs: number;
}
```

- [ ] **Step 2: Add defaults**

Update `DEFAULT_STATS_VIEW_SETTINGS` in the same file:

```typescript
export const DEFAULT_STATS_VIEW_SETTINGS: IStatsViewSettings = {
    showTopStats: true,
    showMvp: true,
    roundCountStats: false,
    splitPlayersByClass: false,
    topStatsMode: 'total',
    topSkillDamageSource: 'target',
    topSkillsMetric: 'damage',
    minParticipationPercent: 0,
    boonBucketIntervalMs: 2000,
    stackingBoonBucketIntervalMs: 5000
};
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS — existing code uses spread defaults (`{ ...DEFAULT_STATS_VIEW_SETTINGS, ...settings.statsViewSettings }`) so missing fields in persisted configs fall back automatically.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/global.d.ts
git commit -m "feat: add boonBucketIntervalMs settings to IStatsViewSettings"
```

---

### Task 2: Write tests for `computeBoonUptimeTimeline` parameterized intervals

**Files:**
- Create: `src/renderer/__tests__/computeBoonUptimeTimeline.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
import { describe, it, expect } from 'vitest';
import { computeBoonUptimeTimeline } from '../stats/computeBoonUptimeTimeline';

const makeMockLog = (opts: {
    durationMs: number;
    boonId: number;
    stacking: boolean;
    boonName: string;
    statesPerSource: Record<string, Array<[number, number]>>;
}) => ({
    filePath: 'test-log.zevtc',
    details: {
        durationMS: opts.durationMs,
        timeStartStd: '2026-01-01T00:00:00Z',
        buffMap: {
            [`b${opts.boonId}`]: {
                name: opts.boonName,
                stacking: opts.stacking,
                icon: '',
                classification: 'Boon',
            },
        },
        players: [
            {
                account: 'TestPlayer.1234',
                name: 'TestPlayer',
                profession: 'Guardian',
                group: 1,
                notInSquad: false,
                buffUptimes: [
                    {
                        id: opts.boonId,
                        statesPerSource: opts.statesPerSource,
                    },
                ],
            },
        ],
    },
});

describe('computeBoonUptimeTimeline', () => {
    it('uses boonBucketIntervalMs for non-stacking boons', () => {
        const log = makeMockLog({
            durationMs: 10000,
            boonId: 717,
            stacking: false,
            boonName: 'Protection',
            statesPerSource: { '0': [[0, 1], [3000, 0], [7000, 1]] },
        });

        const result = computeBoonUptimeTimeline([log], {
            boonBucketIntervalMs: 2000,
            stackingBoonBucketIntervalMs: 5000,
        });

        const protBoon = result.find((b) => b.name === 'Protection');
        expect(protBoon).toBeDefined();
        expect(protBoon!.intervalMs).toBe(2000);

        const fight = protBoon!.fights[0];
        // 10000ms / 2000ms = 5 buckets
        expect(fight.values['TestPlayer.1234'].buckets).toHaveLength(5);
    });

    it('uses stackingBoonBucketIntervalMs for stacking boons', () => {
        const log = makeMockLog({
            durationMs: 15000,
            boonId: 740,
            stacking: true,
            boonName: 'Might',
            statesPerSource: { '0': [[0, 10], [5000, 15], [10000, 20]] },
        });

        const result = computeBoonUptimeTimeline([log], {
            boonBucketIntervalMs: 2000,
            stackingBoonBucketIntervalMs: 5000,
        });

        const mightBoon = result.find((b) => b.name === 'Might');
        expect(mightBoon).toBeDefined();
        expect(mightBoon!.intervalMs).toBe(5000);

        const fight = mightBoon!.fights[0];
        // 15000ms / 5000ms = 3 buckets
        expect(fight.values['TestPlayer.1234'].buckets).toHaveLength(3);
    });

    it('defaults to 2000/5000 when no settings provided', () => {
        const log = makeMockLog({
            durationMs: 10000,
            boonId: 717,
            stacking: false,
            boonName: 'Protection',
            statesPerSource: { '0': [[0, 1]] },
        });

        const result = computeBoonUptimeTimeline([log]);

        const protBoon = result.find((b) => b.name === 'Protection');
        expect(protBoon).toBeDefined();
        expect(protBoon!.intervalMs).toBe(2000);

        const fight = protBoon!.fights[0];
        expect(fight.values['TestPlayer.1234'].buckets).toHaveLength(5);
    });

    it('samples state transitions at the configured interval', () => {
        // Protection on at 0ms, off at 3000ms, on at 7000ms
        // At 2s intervals: sample at 0, 2000, 4000, 6000, 8000
        // At t=0: value=1, t=2000: value=1, t=4000: value=0 (off at 3000), t=6000: value=0, t=8000: value=1 (on at 7000)
        const log = makeMockLog({
            durationMs: 10000,
            boonId: 717,
            stacking: false,
            boonName: 'Protection',
            statesPerSource: { '0': [[0, 1], [3000, 0], [7000, 1]] },
        });

        const result = computeBoonUptimeTimeline([log], {
            boonBucketIntervalMs: 2000,
            stackingBoonBucketIntervalMs: 5000,
        });

        const protBoon = result.find((b) => b.name === 'Protection');
        const buckets = protBoon!.fights[0].values['TestPlayer.1234'].buckets;
        expect(buckets).toEqual([1, 1, 0, 0, 1]);
    });

    it('renamed field: uses buckets not buckets5s', () => {
        const log = makeMockLog({
            durationMs: 5000,
            boonId: 717,
            stacking: false,
            boonName: 'Protection',
            statesPerSource: { '0': [[0, 1]] },
        });

        const result = computeBoonUptimeTimeline([log], {
            boonBucketIntervalMs: 2000,
            stackingBoonBucketIntervalMs: 5000,
        });

        const fightValue = result[0].fights[0].values['TestPlayer.1234'];
        expect(fightValue).toHaveProperty('buckets');
        expect(fightValue).not.toHaveProperty('buckets5s');
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/renderer/__tests__/computeBoonUptimeTimeline.test.ts`
Expected: FAIL — `computeBoonUptimeTimeline` doesn't accept settings parameter yet, and output still uses `buckets5s`.

- [ ] **Step 3: Commit test file**

```bash
git add src/renderer/__tests__/computeBoonUptimeTimeline.test.ts
git commit -m "test: add failing tests for configurable boon uptime bucket intervals"
```

---

### Task 3: Parameterize `computeBoonUptimeTimeline`

**Files:**
- Modify: `src/renderer/stats/computeBoonUptimeTimeline.ts`

- [ ] **Step 1: Add settings parameter and interval to types**

Change the function signature (line 4) to accept an optional settings object:

```typescript
export function computeBoonUptimeTimeline(
    validLogs: any[],
    settings?: { boonBucketIntervalMs: number; stackingBoonBucketIntervalMs: number }
) {
```

Add `intervalMs` to `UptimeBucket` type (after `stacking: boolean;`):

```typescript
type UptimeBucket = {
    id: string;
    name: string;
    icon?: string;
    stacking: boolean;
    intervalMs: number;
    players: Map<string, UptimePlayer>;
    fights: UptimeFight[];
};
```

- [ ] **Step 2: Rename `buckets5s` to `buckets` in `UptimeFightValue`**

Change the type (line 15-19):

```typescript
type UptimeFightValue = {
    total: number;
    peak: number;
    buckets: number[];
};
```

- [ ] **Step 3: Resolve per-boon interval in `ensureBoonBucket`**

Update `ensureBoonBucket` to set `intervalMs` based on stacking:

```typescript
const defaultBoonIntervalMs = settings?.boonBucketIntervalMs ?? 2000;
const defaultStackingIntervalMs = settings?.stackingBoonBucketIntervalMs ?? 5000;

const ensureBoonBucket = (boonId: string, meta?: any) => {
    if (!boonBuckets.has(boonId)) {
        const stacking = Boolean(meta?.stacking);
        boonBuckets.set(boonId, {
            id: boonId,
            name: String(meta?.name || boonId),
            icon: meta?.icon,
            stacking,
            intervalMs: stacking ? defaultStackingIntervalMs : defaultBoonIntervalMs,
            players: new Map<string, UptimePlayer>(),
            fights: []
        });
    } else if (meta) {
        const existing = boonBuckets.get(boonId)!;
        if ((!existing.name || existing.name === boonId) && meta?.name) existing.name = String(meta.name);
        if (!existing.icon && meta?.icon) existing.icon = String(meta.icon);
        if (!existing.stacking && Boolean(meta?.stacking)) {
            existing.stacking = true;
            existing.intervalMs = defaultStackingIntervalMs;
        }
    }
    return boonBuckets.get(boonId)!;
};
```

- [ ] **Step 4: Add `intervalMs` parameter to `sampleStackTimeline`**

Change function signature (line 83-88) to accept `intervalMs`:

```typescript
const sampleStackTimeline = (
    statesPerSource: Record<string, any>,
    bucketCount: number,
    stacking: boolean,
    boonName: string,
    intervalMs: number
) => {
```

Change line 97 (`bucketIndex * 5000`) to use `intervalMs`:

```typescript
const sampleTime = bucketIndex * intervalMs;
```

- [ ] **Step 5: Rename `createFightValue` parameter and field**

Change `createFightValue` (line 108-112):

```typescript
const createFightValue = (buckets: number[]): UptimeFightValue => {
    const total = buckets.reduce((sum, value) => sum + Math.max(0, Number(value || 0)), 0);
    const peak = buckets.reduce((best, value) => Math.max(best, Math.max(0, Number(value || 0))), 0);
    return { total, peak, buckets };
};
```

- [ ] **Step 6: Use dynamic interval in the per-fight loop**

In the `validLogs.forEach` block, change the bucket count calculation (line 124) to use the boon's interval:

```typescript
// Replace the single bucketCount before the loop with per-boon calculation below
```

The key change is inside `buffUptimes.forEach` (starting around line 139). After resolving `boonId` and `meta`, compute the per-boon interval and bucket count:

```typescript
const boonBucket = ensureBoonBucket(boonId, meta);
const intervalMs = boonBucket.intervalMs;
const boonBucketCount = Math.max(1, Math.ceil(Math.max(1, durationMs) / intervalMs));
```

Then pass `intervalMs` and `boonBucketCount` to `sampleStackTimeline`:

```typescript
const buckets = sampleStackTimeline(
    statesPerSource as Record<string, any>,
    boonBucketCount,
    Boolean(meta?.stacking),
    String(meta?.name || ''),
    intervalMs
);
const fightValue = createFightValue(buckets);
```

Remove the old `bucketCount` calculation from line 124 (the one that uses `/ 5000` before the player loop) — it's no longer needed since bucket count is computed per-boon inside the loop.

- [ ] **Step 7: Update fight value assembly to use `buckets` instead of `buckets5s`**

In the `fightValuesByBoon.forEach` block (around line 191-216), change all `buckets5s` references to `buckets`:

Line ~200:
```typescript
buckets: Array.isArray(fightValue.buckets)
    ? fightValue.buckets.map((entry: any) => Number(entry || 0))
    : []
```

- [ ] **Step 8: Add `intervalMs` to the final output**

In the return statement (around line 219-238), include `intervalMs` in the mapped output:

```typescript
return Array.from(boonBuckets.values())
    .map((bucket) => ({
        id: bucket.id,
        name: bucket.name || bucket.id,
        icon: bucket.icon,
        stacking: bucket.stacking,
        intervalMs: bucket.intervalMs,
        players: Array.from(bucket.players.values()).sort((a, b) => {
```

- [ ] **Step 9: Run tests**

Run: `npx vitest run src/renderer/__tests__/computeBoonUptimeTimeline.test.ts`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add src/renderer/stats/computeBoonUptimeTimeline.ts
git commit -m "feat: parameterize boon uptime bucket interval based on stacking"
```

---

### Task 4: Thread settings through the aggregation pipeline

**Files:**
- Modify: `src/renderer/stats/computeTimelineAndMapData.ts:81,112`
- Modify: `src/renderer/stats/computeStatsAggregation.ts:546`

- [ ] **Step 1: Update `computeTimelineAndMapData` signature**

In `src/renderer/stats/computeTimelineAndMapData.ts`, add an optional settings parameter:

```typescript
export function computeTimelineAndMapData(
    logs: any[],
    validLogs: any[],
    splitPlayersByClass = false,
    boonIntervalSettings?: { boonBucketIntervalMs: number; stackingBoonBucketIntervalMs: number }
) {
```

- [ ] **Step 2: Pass settings to `computeBoonUptimeTimeline`**

Change line 112:

```typescript
const boonUptimeTimeline = computeBoonUptimeTimeline(validLogs, boonIntervalSettings);
```

- [ ] **Step 3: Pass settings from `computeStatsAggregation`**

In `src/renderer/stats/computeStatsAggregation.ts`, around line 546, extract the interval settings and pass them through:

```typescript
const boonIntervalSettings = {
    boonBucketIntervalMs: activeStatsViewSettings.boonBucketIntervalMs ?? 2000,
    stackingBoonBucketIntervalMs: activeStatsViewSettings.stackingBoonBucketIntervalMs ?? 5000,
};
const { sortedFightLogs, sortedFightLogsWithDetails, mapData, timelineData, boonTables, boonTimeline, boonUptimeTimeline } = computeTimelineAndMapData(logs, validLogs, splitPlayersByClass, boonIntervalSettings);
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/stats/computeTimelineAndMapData.ts src/renderer/stats/computeStatsAggregation.ts
git commit -m "feat: thread boon interval settings through aggregation pipeline"
```

---

### Task 5: Update `StatsView.tsx` boon uptime display references

**Files:**
- Modify: `src/renderer/StatsView.tsx`

**Important:** Only change boon uptime references. Do NOT change `buckets5s` references used by boon generation timeline (`activeBoonTimeline`, lines ~3176-3218) or spike damage sections (lines ~962-1418). Those are separate data structures.

The boon uptime data now carries `intervalMs` on the boon object (`activeBoonUptime?.intervalMs`). Use this to replace all hardcoded `5000` in boon uptime sections.

- [ ] **Step 1: Replace `buckets5s` → `buckets` in `boonUptimePercentByPlayer` (lines 3468-3503)**

Line 3490: `playerValue?.buckets5s` → `playerValue?.buckets`

Line 3478: `Math.ceil(... / 5000)` → `Math.ceil(... / (activeBoonUptime?.intervalMs || 5000))`

Line 3493: `Math.ceil(... / 5000)` → `Math.ceil(... / (activeBoonUptime?.intervalMs || 5000))`

- [ ] **Step 2: Replace references in `boonUptimeChartData` (lines 3548-3621)**

Line 3566: `playerValue?.buckets5s` → `playerValue?.buckets`

Line 3569: `/ 5000` → `/ (activeBoonUptime?.intervalMs || 5000)`

Line 3582: `value?.buckets5s` → `value?.buckets`

Line 3585: `/ 5000` → `/ (activeBoonUptime?.intervalMs || 5000)`

Line 3594: `value?.buckets5s` → `value?.buckets`

Line 3597: `/ 5000` → `/ (activeBoonUptime?.intervalMs || 5000)`

- [ ] **Step 3: Replace references in `boonUptimeDrilldown` (lines 3635-3703)**

Line 3653: `selectedValue?.buckets5s` → `selectedValue?.buckets`

Line 3656: `/ 5000` → `/ (activeBoonUptime?.intervalMs || 5000)`

Line 3662: `value?.buckets5s?.[index]` → `value?.buckets?.[index]`

Line 3664: Update bucket label from `${index * 5}s-${(index + 1) * 5}s` to dynamic:

```typescript
const intervalSec = (activeBoonUptime?.intervalMs || 5000) / 1000;
// ... inside Array.from:
label: `${index * intervalSec}s-${(index + 1) * intervalSec}s`,
```

Line 3700: Update drilldown title from `(5s Stack Buckets)` to dynamic:

```typescript
title: `Fight Breakdown - ${selectedPoint.shortLabel || 'Fight'} (${(activeBoonUptime?.intervalMs || 5000) / 1000}s Stack Buckets)`,
```

- [ ] **Step 4: Run typecheck and lint**

Run: `npm run validate`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/StatsView.tsx
git commit -m "feat: use dynamic boon uptime bucket interval in StatsView display"
```

---

### Task 6: Add settings UI dropdowns

**Files:**
- Modify: `src/renderer/SettingsView.tsx`

- [ ] **Step 1: Add two dropdowns after the existing Dashboard settings section**

In `src/renderer/SettingsView.tsx`, find the "Dashboard - Top Stats & MVP" `SettingsSection` (line 1864). After its closing tag (around line 2100), add a new section for boon uptime resolution. Insert before the next `SettingsSection`:

```tsx
<SettingsSection title="Boon Uptime Resolution" icon={BarChart3} delay={0.19} sectionId="boon-uptime-resolution">
    <p className="text-sm text-gray-400 mb-4">
        Control the bucket interval used for boon uptime timeline charts. Finer resolution reveals short coverage gaps but increases data size.
    </p>
    <div className="divide-y divide-white/5">
        <div className="py-3">
            <div className="text-sm font-medium text-gray-200 mb-2">Non-stacking boons (Protection, Resistance, etc.)</div>
            <div className="flex gap-2">
                {([
                    { id: 1000, label: '1s' },
                    { id: 2000, label: '2s' },
                    { id: 3000, label: '3s' },
                    { id: 5000, label: '5s' },
                ] as const).map((option) => (
                    <button
                        key={option.id}
                        type="button"
                        onClick={() => updateStatsViewSettingValue('boonBucketIntervalMs', option.id)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${statsViewSettings.boonBucketIntervalMs === option.id
                            ? 'bg-blue-500/20 text-blue-200 border-blue-500/40'
                            : 'bg-white/5 text-gray-400 border-white/10 hover:text-gray-200'
                            }`}
                    >
                        {option.label}
                    </button>
                ))}
            </div>
            <div className="text-xs text-gray-500 mt-1">Default: 2s — reveals short boon drops that 5s buckets hide.</div>
        </div>
        <div className="py-3">
            <div className="text-sm font-medium text-gray-200 mb-2">Stacking boons (Might, Stability, etc.)</div>
            <div className="flex gap-2">
                {([
                    { id: 1000, label: '1s' },
                    { id: 2000, label: '2s' },
                    { id: 3000, label: '3s' },
                    { id: 5000, label: '5s' },
                ] as const).map((option) => (
                    <button
                        key={option.id}
                        type="button"
                        onClick={() => updateStatsViewSettingValue('stackingBoonBucketIntervalMs', option.id)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${statsViewSettings.stackingBoonBucketIntervalMs === option.id
                            ? 'bg-blue-500/20 text-blue-200 border-blue-500/40'
                            : 'bg-white/5 text-gray-400 border-white/10 hover:text-gray-200'
                            }`}
                    >
                        {option.label}
                    </button>
                ))}
            </div>
            <div className="text-xs text-gray-500 mt-1">Default: 5s — stacking boons fluctuate constantly so coarser buckets are fine.</div>
        </div>
    </div>
</SettingsSection>
```

- [ ] **Step 2: Verify `updateStatsViewSettingValue` handles numeric values**

Check that `updateStatsViewSettingValue` (used by existing settings like `minParticipationPercent`) already handles numeric values. It should — it's the same function used for the slider. No changes needed.

- [ ] **Step 3: Run dev and visually verify**

Run: `npm run dev`
Navigate to Settings → verify the "Boon Uptime Resolution" section appears with two button groups. Click each option and confirm it highlights. Reload and confirm persistence.

- [ ] **Step 4: Run validate**

Run: `npm run validate`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/SettingsView.tsx
git commit -m "feat: add boon uptime resolution settings UI dropdowns"
```

---

### Task 7: Run full test suite and verify

**Files:** None (validation only)

- [ ] **Step 1: Run unit tests**

Run: `npm run test:unit`
Expected: PASS — no existing tests reference `buckets5s` from the boon uptime timeline.

- [ ] **Step 2: Run typecheck and lint**

Run: `npm run validate`
Expected: PASS

- [ ] **Step 3: Run boon audit**

Run: `npm run audit:boons`
Expected: PASS — audit checks aggregate boon generation metrics (`boonGeneration.ts`), not per-fight uptime buckets.

- [ ] **Step 4: Commit (if any fixes were needed)**

Only commit if previous steps required fixes. Otherwise, no commit needed.
