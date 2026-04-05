# Outgoing Interrupts Leaderboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add outgoing interrupts as a leaderboard metric with a 3-way setting (CC only / separate cards / combined card).

**Architecture:** New `interruptMode` setting on `IStatsViewSettings` controls leaderboard display. Interrupts are aggregated as a raw count from `statsTargets[*][0].interrupts` into `PlayerStats.interrupts`. The leaderboard layer builds `interrupts` and `ccAndInterrupts` entries, and `TopPlayersSection` conditionally renders cards based on the mode.

**Tech Stack:** TypeScript, React, Vitest

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/shared/dpsReportTypes.ts:197-203` | Modify | Add `interrupts?` to `StatsTarget` |
| `src/shared/dashboardMetrics.ts:57-66` | Modify | Add `getPlayerOutgoingInterrupts()` |
| `src/renderer/global.d.ts:76-87,204-215` | Modify | Add `interruptMode` to `IStatsViewSettings` + default |
| `src/renderer/stats/computePlayerAggregation.ts:14-58,622-646` | Modify | Add `interrupts` to `PlayerStats`, accumulate |
| `src/renderer/stats/incrementalAggregation.ts:796-930` | Modify | Add interrupt leaderboards + topStats entries |
| `src/renderer/stats/sections/TopPlayersSection.tsx:4-12,329-339` | Modify | Conditional card rendering based on `interruptMode` |
| `src/renderer/StatsView.tsx:179,4280-4288` | Modify | Derive `interruptMode`, pass to `TopPlayersSection` |
| `src/renderer/SettingsView.tsx:1922-1944` | Modify | Add interrupt mode toggle |
| `src/renderer/__tests__/TopPlayersSection.test.tsx` | Modify | Add tests for all 3 interrupt modes |
| `src/shared/__tests__/dashboardMetrics.test.ts` | Create | Test `getPlayerOutgoingInterrupts` |

---

### Task 1: Add `interrupts` to EI types and extraction function

**Files:**
- Modify: `src/shared/dpsReportTypes.ts:197-203`
- Modify: `src/shared/dashboardMetrics.ts:57-66`
- Create: `src/shared/__tests__/dashboardMetrics.test.ts`

- [ ] **Step 1: Write the failing test for `getPlayerOutgoingInterrupts`**

Create `src/shared/__tests__/dashboardMetrics.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { getPlayerOutgoingInterrupts } from '../dashboardMetrics';
import type { Player } from '../dpsReportTypes';

describe('getPlayerOutgoingInterrupts', () => {
    it('sums interrupts across all targets', () => {
        const player = {
            statsTargets: [
                [{ interrupts: 3 }],
                [{ interrupts: 5 }],
                [{ interrupts: 2 }],
            ],
        } as unknown as Player;

        expect(getPlayerOutgoingInterrupts(player)).toBe(10);
    });

    it('returns 0 when statsTargets is missing', () => {
        const player = {} as unknown as Player;
        expect(getPlayerOutgoingInterrupts(player)).toBe(0);
    });

    it('returns 0 when statsTargets entries have no interrupts field', () => {
        const player = {
            statsTargets: [
                [{ killed: 1, downed: 2 }],
            ],
        } as unknown as Player;

        expect(getPlayerOutgoingInterrupts(player)).toBe(0);
    });

    it('handles empty target arrays gracefully', () => {
        const player = {
            statsTargets: [[], [{ interrupts: 4 }]],
        } as unknown as Player;

        expect(getPlayerOutgoingInterrupts(player)).toBe(4);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/__tests__/dashboardMetrics.test.ts`
Expected: FAIL — `getPlayerOutgoingInterrupts` is not exported from `dashboardMetrics`.

- [ ] **Step 3: Add `interrupts` to `StatsTarget` interface**

In `src/shared/dpsReportTypes.ts`, add `interrupts` to the `StatsTarget` interface (after line 202):

```typescript
export interface StatsTarget {
    killed: number;
    downed: number;
    downContribution: number;
    againstDownedCount: number;
    againstDownedDamage: number;
    interrupts?: number;
}
```

- [ ] **Step 4: Implement `getPlayerOutgoingInterrupts`**

In `src/shared/dashboardMetrics.ts`, add after the existing `getTargetStatTotal` function (after line 66):

```typescript
export const getPlayerOutgoingInterrupts = (player: Player): number => {
    let total = 0;
    const statsTargets = player.statsTargets || [];
    for (const targetStats of statsTargets) {
        if (targetStats && targetStats.length > 0) {
            total += Number((targetStats[0] as any).interrupts || 0);
        }
    }
    return total;
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/shared/__tests__/dashboardMetrics.test.ts`
Expected: All 4 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/shared/dpsReportTypes.ts src/shared/dashboardMetrics.ts src/shared/__tests__/dashboardMetrics.test.ts
git commit -m "feat: add getPlayerOutgoingInterrupts extraction function"
```

---

### Task 2: Add `interruptMode` setting to types and defaults

**Files:**
- Modify: `src/renderer/global.d.ts:76-87,204-215`

- [ ] **Step 1: Add `interruptMode` to `IStatsViewSettings`**

In `src/renderer/global.d.ts`, add `interruptMode` to the `IStatsViewSettings` interface (after line 86, before the closing `}`):

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
    interruptMode: 'ccOnly' | 'separate' | 'combined';
}
```

- [ ] **Step 2: Add default value**

In `src/renderer/global.d.ts`, add `interruptMode: 'ccOnly'` to `DEFAULT_STATS_VIEW_SETTINGS` (after line 214, before the closing `}`):

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
    boonBucketIntervalMs: 5000,
    stackingBoonBucketIntervalMs: 5000,
    interruptMode: 'ccOnly'
};
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS (the new field has a default, and all existing `IStatsViewSettings` objects are spread from `DEFAULT_STATS_VIEW_SETTINGS`).

- [ ] **Step 4: Commit**

```bash
git add src/renderer/global.d.ts
git commit -m "feat: add interruptMode to IStatsViewSettings"
```

---

### Task 3: Add `interrupts` to `PlayerStats` and accumulation

**Files:**
- Modify: `src/renderer/stats/computePlayerAggregation.ts:14-58,622-630,646`

- [ ] **Step 1: Add `interrupts` to `PlayerStats` interface**

In `src/renderer/stats/computePlayerAggregation.ts`, add `interrupts: number;` to the `PlayerStats` interface (after line 24, after `cc: number;`):

```typescript
    cc: number;
    interrupts: number;
    logsJoined: number;
```

- [ ] **Step 2: Add import for `getPlayerOutgoingInterrupts`**

In `src/renderer/stats/computePlayerAggregation.ts`, update the import from `dashboardMetrics` on line 2:

```typescript
import { getPlayerCleanses, getPlayerStrips, getPlayerOutgoingInterrupts } from "../../shared/dashboardMetrics";
```

- [ ] **Step 3: Initialize `interrupts: 0` in player stat creation**

In `src/renderer/stats/computePlayerAggregation.ts`, in the object literal on line 623 where `PlayerStats` is initialized, add `interrupts: 0` after `cc: 0`:

```typescript
            acc.playerStats.set(key, {
                name, account: identity.accountLabel, characterNames: new Set<string>(), downContrib: 0, cleanses: 0, strips: 0, stab: 0, healing: 0, barrier: 0, cc: 0, interrupts: 0, logsJoined: 0,
```

- [ ] **Step 4: Accumulate interrupts during ingestion**

In `src/renderer/stats/computePlayerAggregation.ts`, add accumulation after line 646 (`s.cc += ...`):

```typescript
        s.cc += getPlayerOutgoingCrowdControl(p, method);
        s.interrupts += getPlayerOutgoingInterrupts(p);
        s.stab += p.stabGeneration || 0;
```

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/stats/computePlayerAggregation.ts
git commit -m "feat: accumulate outgoing interrupts in PlayerStats"
```

---

### Task 4: Add interrupt leaderboards to aggregation

**Files:**
- Modify: `src/renderer/stats/incrementalAggregation.ts:796-930`

- [ ] **Step 1: Add `interrupts` and `ccAndInterrupts` to `getVal`**

In `src/renderer/stats/incrementalAggregation.ts`, add two new cases to the `getVal` switch (after line 804, the `cc` case):

```typescript
                case 'cc': return s.cc;
                case 'interrupts': return s.interrupts;
                case 'ccAndInterrupts': return s.cc + s.interrupts;
                case 'stability': return s.stab;
```

- [ ] **Step 2: Add leaderboard entries**

In `src/renderer/stats/incrementalAggregation.ts`, add to the `leaderboards` object (after line 827, the `cc` entry):

```typescript
            cc: createLB('cc', true),
            interrupts: createLB('interrupts', true),
            ccAndInterrupts: createLB('ccAndInterrupts', true),
            stability: createLB('stability', true),
```

- [ ] **Step 3: Add to `statKeys`**

In `src/renderer/stats/incrementalAggregation.ts`, add to the `statKeys` object (after line 844, the `cc` entry):

```typescript
            cc: 'cc',
            interrupts: 'interrupts',
            ccAndInterrupts: 'ccAndInterrupts',
            stability: 'stability',
```

- [ ] **Step 4: Add `maxInterrupts` and `maxCCAndInterrupts` to topStats objects**

In `src/renderer/stats/incrementalAggregation.ts`, add to the three `topStats` objects.

Add to `topStatsPerSecond` (after line 867, `maxCC`):

```typescript
            maxCC: getTopFromLeaderboard([]),
            maxInterrupts: getTopFromLeaderboard([]),
            maxCCAndInterrupts: getTopFromLeaderboard([]),
            maxStab: getTopFromLeaderboard([]),
```

Add to `topStatsPerMinute` (after line 877, `maxCC`):

```typescript
            maxCC: getTopFromLeaderboard([]),
            maxInterrupts: getTopFromLeaderboard([]),
            maxCCAndInterrupts: getTopFromLeaderboard([]),
            maxStab: getTopFromLeaderboard([]),
```

- [ ] **Step 5: Populate topStatsPerSecond from leaderboards**

In `src/renderer/stats/incrementalAggregation.ts`, add after line 907 (`topStatsPerSecond.maxCC = ...`):

```typescript
        topStatsPerSecond.maxCC = getTopFromLeaderboard(perSecondLeaderboards.cc);
        topStatsPerSecond.maxInterrupts = getTopFromLeaderboard(perSecondLeaderboards.interrupts);
        topStatsPerSecond.maxCCAndInterrupts = getTopFromLeaderboard(perSecondLeaderboards.ccAndInterrupts);
        topStatsPerSecond.maxStab = getTopFromLeaderboard(perSecondLeaderboards.stability);
```

- [ ] **Step 6: Populate topStatsPerMinute from leaderboards**

In `src/renderer/stats/incrementalAggregation.ts`, add after line 916 (`topStatsPerMinute.maxCC = ...`):

```typescript
        topStatsPerMinute.maxCC = getTopFromLeaderboard(perMinuteLeaderboards.cc);
        topStatsPerMinute.maxInterrupts = getTopFromLeaderboard(perMinuteLeaderboards.interrupts);
        topStatsPerMinute.maxCCAndInterrupts = getTopFromLeaderboard(perMinuteLeaderboards.ccAndInterrupts);
        topStatsPerMinute.maxStab = getTopFromLeaderboard(perMinuteLeaderboards.stability);
```

- [ ] **Step 7: Populate topStats (totals) from leaderboards**

In `src/renderer/stats/incrementalAggregation.ts`, add after line 927 (`maxCC: ...`):

```typescript
            maxCC: getTopFromLeaderboard(leaderboards.cc),
            maxInterrupts: getTopFromLeaderboard(leaderboards.interrupts),
            maxCCAndInterrupts: getTopFromLeaderboard(leaderboards.ccAndInterrupts),
            maxStab: getTopFromLeaderboard(leaderboards.stability),
```

- [ ] **Step 8: Run typecheck and tests**

Run: `npm run typecheck && npm run test:unit`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/renderer/stats/incrementalAggregation.ts
git commit -m "feat: add interrupt and combined CC leaderboards"
```

---

### Task 5: Update `TopPlayersSection` to render conditional cards

**Files:**
- Modify: `src/renderer/stats/sections/TopPlayersSection.tsx:1-12,329-339`
- Modify: `src/renderer/StatsView.tsx:179,4280-4288`

- [ ] **Step 1: Add `interruptMode` to `TopPlayersSectionProps`**

In `src/renderer/stats/sections/TopPlayersSection.tsx`, add the prop (after line 7):

```typescript
type TopPlayersSectionProps = {
    showTopStats: boolean;
    showMvp: boolean;
    topStatsMode: 'total' | 'perSecond' | 'perMinute';
    interruptMode: 'ccOnly' | 'separate' | 'combined';
    expandedLeader: string | null;
    setExpandedLeader: (value: string | null | ((prev: string | null) => string | null)) => void;
    formatTopStatValue: (value: number) => string;
    isMvpStatEnabled: (name: string) => boolean;
};
```

- [ ] **Step 2: Add `Ban` icon import**

In `src/renderer/stats/sections/TopPlayersSection.tsx`, add `Ban` to the lucide-react import on line 1:

```typescript
import { Activity, Ban, Crown, Crosshair, Flame, Hammer, HelpingHand, Shield, ShieldCheck, Sparkles, Star, Wind, Zap, Trophy } from 'lucide-react';
```

- [ ] **Step 3: Destructure `interruptMode` in component**

Find the component function signature (around line 120-128) and add `interruptMode` to the destructured props. It will look similar to:

```typescript
export const TopPlayersSection = ({
    showTopStats,
    showMvp,
    topStatsMode,
    interruptMode,
    expandedLeader,
    setExpandedLeader,
    formatTopStatValue,
    isMvpStatEnabled
}: TopPlayersSectionProps) => {
```

- [ ] **Step 4: Build `leaderCards` conditionally based on `interruptMode`**

Replace the existing CC card entry in the `leaderCards` array (line 336) with conditional logic. Change:

```typescript
                    { icon: Hammer, title: `${titlePrefix}CC${titleSuffix}`, data: topStatsData.maxCC, color: 'pink', statKey: 'cc', higherIsBetter: true },
```

To:

```typescript
                    ...(interruptMode === 'combined'
                        ? [{ icon: Hammer, title: `${titlePrefix}CC + Interrupts${titleSuffix}`, data: topStatsData.maxCCAndInterrupts, color: 'pink', statKey: 'ccAndInterrupts', higherIsBetter: true }]
                        : [{ icon: Hammer, title: `${titlePrefix}CC${titleSuffix}`, data: topStatsData.maxCC, color: 'pink', statKey: 'cc', higherIsBetter: true }]),
                    ...(interruptMode === 'separate'
                        ? [{ icon: Ban, title: `${titlePrefix}Interrupts${titleSuffix}`, data: topStatsData.maxInterrupts, color: 'orange', statKey: 'interrupts', higherIsBetter: true }]
                        : []),
```

- [ ] **Step 5: Pass `interruptMode` from `StatsView`**

In `src/renderer/StatsView.tsx`, add `interruptMode` derivation near line 179 (after `topStatsMode`):

```typescript
    const topStatsMode = activeStatsViewSettings.topStatsMode || 'total';
    const interruptMode = activeStatsViewSettings.interruptMode || 'ccOnly';
```

Then pass it to both `TopPlayersSection` usages. At line 4283:

```tsx
                                {renderSectionWrap(<TopPlayersSection
                                    showTopStats={showTopStats}
                                    showMvp={showMvp}
                                    topStatsMode={topStatsMode}
                                    interruptMode={interruptMode}
                                    expandedLeader={expandedLeader}
                                    setExpandedLeader={setExpandedLeader}
                                    formatTopStatValue={formatTopStatValue}
                                    isMvpStatEnabled={isMvpStatEnabled}
                                />)}
```

Find the second usage (around line 4708-4711) and add `interruptMode={interruptMode}` there too.

- [ ] **Step 6: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/stats/sections/TopPlayersSection.tsx src/renderer/StatsView.tsx
git commit -m "feat: render interrupt leaderboard cards based on interruptMode"
```

---

### Task 6: Add interrupt mode toggle to Settings UI

**Files:**
- Modify: `src/renderer/SettingsView.tsx:1922-1944`

- [ ] **Step 1: Add `updateInterruptMode` callback**

In `src/renderer/SettingsView.tsx`, near the existing `updateTopStatsMode` callback (around line 1056), add:

```typescript
    const updateInterruptMode = useCallback((mode: IStatsViewSettings['interruptMode']) => {
        setStatsViewSettings(prev => ({ ...prev, interruptMode: mode }));
    }, []);
```

- [ ] **Step 2: Add the interrupt mode toggle UI**

In `src/renderer/SettingsView.tsx`, after the "Top Stats Calculation" section (after line 1944, after the closing `</div>` of that section), add a new section:

```tsx
                            <div className="py-3 border-t border-white/5">
                                <div className="text-sm font-medium text-gray-200 mb-2">Interrupt Display</div>
                                <div className="flex gap-2 flex-wrap">
                                    {([
                                        { id: 'ccOnly', label: 'CC Only' },
                                        { id: 'separate', label: 'CC + Interrupts (Separate)' },
                                        { id: 'combined', label: 'CC + Interrupts (Combined)' }
                                    ] as const).map((option) => (
                                        <button
                                            key={option.id}
                                            type="button"
                                            onClick={() => updateInterruptMode(option.id)}
                                            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${statsViewSettings.interruptMode === option.id
                                                ? 'bg-blue-500/20 text-blue-200 border-blue-500/40'
                                                : 'bg-white/5 text-gray-400 border-white/10 hover:text-gray-200'
                                                }`}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">Show interrupts alongside or combined with CC on the leaderboard.</div>
                            </div>
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/SettingsView.tsx
git commit -m "feat: add interrupt display mode toggle to settings"
```

---

### Task 7: Add tests for interrupt mode rendering

**Files:**
- Modify: `src/renderer/__tests__/TopPlayersSection.test.tsx`

- [ ] **Step 1: Update existing test to pass `interruptMode`**

In `src/renderer/__tests__/TopPlayersSection.test.tsx`, add `interruptMode="ccOnly"` to the existing test's `<TopPlayersSection>` usage (line 53-61):

```tsx
                <TopPlayersSection
                    showTopStats={true}
                    showMvp={false}
                    topStatsMode="total"
                    interruptMode="ccOnly"
                    expandedLeader={null}
                    setExpandedLeader={() => {}}
                    formatTopStatValue={(value) => `${Math.round(value)}u`}
                    isMvpStatEnabled={() => true}
                />
```

- [ ] **Step 2: Add helper for minimal stats with interrupt data**

Add a helper function and new tests after the existing test:

```tsx
    const makeEmptyStat = () => ({ value: 0, player: '-', profession: 'Unknown', professionList: [], count: 0 });

    const makeStatsWithInterrupts = () => ({
        maxDownContrib: makeEmptyStat(),
        maxBarrier: makeEmptyStat(),
        maxHealing: makeEmptyStat(),
        maxDodges: makeEmptyStat(),
        maxStrips: makeEmptyStat(),
        maxCleanses: makeEmptyStat(),
        maxCC: { value: 50, player: 'CCPlayer.1234', profession: 'Warrior', professionList: ['Warrior'], count: 5 },
        maxInterrupts: { value: 30, player: 'IntPlayer.5678', profession: 'Mesmer', professionList: ['Mesmer'], count: 5 },
        maxCCAndInterrupts: { value: 80, player: 'BothPlayer.9999', profession: 'Guardian', professionList: ['Guardian'], count: 5 },
        maxStab: makeEmptyStat(),
        closestToTag: makeEmptyStat(),
        leaderboards: {
            cc: [{ rank: 1, account: 'CCPlayer.1234', profession: 'Warrior', professionList: ['Warrior'], value: 50, count: 5 }],
            interrupts: [{ rank: 1, account: 'IntPlayer.5678', profession: 'Mesmer', professionList: ['Mesmer'], value: 30, count: 5 }],
            ccAndInterrupts: [{ rank: 1, account: 'BothPlayer.9999', profession: 'Guardian', professionList: ['Guardian'], value: 80, count: 5 }],
        }
    });
```

- [ ] **Step 3: Add test for `ccOnly` mode**

```tsx
    it('shows only CC card when interruptMode is ccOnly', () => {
        const stats = makeStatsWithInterrupts();
        render(
            <StatsSharedContext.Provider value={makeContextValue(stats, (v) => `${Math.round(v)}u`, () => null)}>
                <TopPlayersSection
                    showTopStats={true}
                    showMvp={false}
                    topStatsMode="total"
                    interruptMode="ccOnly"
                    expandedLeader={null}
                    setExpandedLeader={() => {}}
                    formatTopStatValue={(v) => `${Math.round(v)}u`}
                    isMvpStatEnabled={() => true}
                />
            </StatsSharedContext.Provider>
        );

        expect(screen.getByText('Total CC')).toBeInTheDocument();
        expect(screen.queryByText('Total Interrupts')).not.toBeInTheDocument();
        expect(screen.queryByText('Total CC + Interrupts')).not.toBeInTheDocument();
    });
```

- [ ] **Step 4: Add test for `separate` mode**

```tsx
    it('shows CC and Interrupts as separate cards when interruptMode is separate', () => {
        const stats = makeStatsWithInterrupts();
        render(
            <StatsSharedContext.Provider value={makeContextValue(stats, (v) => `${Math.round(v)}u`, () => null)}>
                <TopPlayersSection
                    showTopStats={true}
                    showMvp={false}
                    topStatsMode="total"
                    interruptMode="separate"
                    expandedLeader={null}
                    setExpandedLeader={() => {}}
                    formatTopStatValue={(v) => `${Math.round(v)}u`}
                    isMvpStatEnabled={() => true}
                />
            </StatsSharedContext.Provider>
        );

        expect(screen.getByText('Total CC')).toBeInTheDocument();
        expect(screen.getByText('Total Interrupts')).toBeInTheDocument();
        expect(screen.queryByText('Total CC + Interrupts')).not.toBeInTheDocument();
    });
```

- [ ] **Step 5: Add test for `combined` mode**

```tsx
    it('shows combined CC + Interrupts card when interruptMode is combined', () => {
        const stats = makeStatsWithInterrupts();
        render(
            <StatsSharedContext.Provider value={makeContextValue(stats, (v) => `${Math.round(v)}u`, () => null)}>
                <TopPlayersSection
                    showTopStats={true}
                    showMvp={false}
                    topStatsMode="total"
                    interruptMode="combined"
                    expandedLeader={null}
                    setExpandedLeader={() => {}}
                    formatTopStatValue={(v) => `${Math.round(v)}u`}
                    isMvpStatEnabled={() => true}
                />
            </StatsSharedContext.Provider>
        );

        expect(screen.queryByText('Total CC')).not.toBeInTheDocument();
        expect(screen.queryByText('Total Interrupts')).not.toBeInTheDocument();
        expect(screen.getByText('Total CC + Interrupts')).toBeInTheDocument();
    });
```

- [ ] **Step 6: Run all tests**

Run: `npx vitest run src/renderer/__tests__/TopPlayersSection.test.tsx`
Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/__tests__/TopPlayersSection.test.tsx
git commit -m "test: add interrupt mode rendering tests for TopPlayersSection"
```

---

### Task 8: Final validation

- [ ] **Step 1: Run full validation suite**

Run: `npm run validate`
Expected: Typecheck and lint both PASS.

- [ ] **Step 2: Run unit tests**

Run: `npm run test:unit`
Expected: All tests PASS.

- [ ] **Step 3: Run audit scripts**

Run: `npm run audit:boons && npm run audit:metrics && npm run audit:conditions`
Expected: All audits PASS (interrupts are additive and don't change existing metric calculations).
