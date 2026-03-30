# Move Strips to General MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the Strips MVP weight from the Offensive category to General (applies to both Offensive and Defensive MVP).

**Architecture:** Rename `offensiveStrips` to `generalStrips` in the `IMvpWeights` interface, update the default, migration, aggregation scoring, settings UI, and StatsView weight mapping. Add `offensiveStrips` to `LegacyMvpWeights` for backward compatibility.

**Tech Stack:** TypeScript, React

---

### Task 1: Rename field in types, defaults, and migration

**Files:**
- Modify: `src/renderer/global.d.ts:40-56` (IMvpWeights interface)
- Modify: `src/renderer/global.d.ts:58-71` (LegacyMvpWeights type)
- Modify: `src/renderer/global.d.ts:154-170` (DEFAULT_MVP_WEIGHTS)
- Modify: `src/renderer/global.d.ts:172-195` (normalizeMvpWeights)

- [ ] **Step 1: Rename `offensiveStrips` to `generalStrips` in `IMvpWeights`**

In `src/renderer/global.d.ts`, change the interface to move `generalStrips` next to the other `general*` fields:

```typescript
export interface IMvpWeights {
    offensiveDownContribution: number;
    offensiveCc: number;
    offensiveDps: number;
    offensiveDamage: number;
    generalStrips: number;
    generalDistanceToTag: number;
    generalParticipation: number;
    generalDodging: number;
    defensiveHealing: number;
    defensiveCleanses: number;
    defensiveStability: number;
    defensiveRevives: number;
    defensiveDistanceToTag: number;
    defensiveParticipation: number;
    defensiveDodging: number;
}
```

- [ ] **Step 2: Add `offensiveStrips` to `LegacyMvpWeights`**

In `src/renderer/global.d.ts`, add `offensiveStrips` to the legacy type:

```typescript
type LegacyMvpWeights = {
    downContribution?: number;
    healing?: number;
    cleanses?: number;
    strips?: number;
    offensiveStrips?: number;
    stability?: number;
    cc?: number;
    revives?: number;
    distanceToTag?: number;
    participation?: number;
    dodging?: number;
    dps?: number;
    damage?: number;
};
```

- [ ] **Step 3: Update `DEFAULT_MVP_WEIGHTS`**

Move the strips entry to the general section:

```typescript
export const DEFAULT_MVP_WEIGHTS: IMvpWeights = {
    offensiveDownContribution: 1,
    offensiveCc: 0.7,
    offensiveDps: 0.2,
    offensiveDamage: 0.2,
    generalStrips: 1,
    generalDistanceToTag: 0.7,
    generalParticipation: 0.7,
    generalDodging: 0.4,
    defensiveHealing: 1,
    defensiveCleanses: 1,
    defensiveStability: 1,
    defensiveRevives: 0.7,
    defensiveDistanceToTag: 0.7,
    defensiveParticipation: 0.7,
    defensiveDodging: 0.4
};
```

- [ ] **Step 4: Update `normalizeMvpWeights`**

Replace the `offensiveStrips` line with `generalStrips` using the fallback chain `generalStrips ?? offensiveStrips ?? strips`:

```typescript
export const normalizeMvpWeights = (weights: unknown): IMvpWeights => {
    const input = (weights && typeof weights === 'object') ? (weights as Partial<IMvpWeights> & LegacyMvpWeights) : {};
    const toNum = (value: unknown, fallback: number) => {
        const next = Number(value);
        return Number.isFinite(next) ? next : fallback;
    };
    return {
        offensiveDownContribution: toNum(input.offensiveDownContribution ?? input.downContribution, DEFAULT_MVP_WEIGHTS.offensiveDownContribution),
        offensiveCc: toNum(input.offensiveCc ?? input.cc, DEFAULT_MVP_WEIGHTS.offensiveCc),
        offensiveDps: toNum(input.offensiveDps ?? input.dps, DEFAULT_MVP_WEIGHTS.offensiveDps),
        offensiveDamage: toNum(input.offensiveDamage ?? input.damage, DEFAULT_MVP_WEIGHTS.offensiveDamage),
        generalStrips: toNum(input.generalStrips ?? input.offensiveStrips ?? input.strips, DEFAULT_MVP_WEIGHTS.generalStrips),
        generalDistanceToTag: toNum(input.generalDistanceToTag ?? input.defensiveDistanceToTag ?? input.distanceToTag, DEFAULT_MVP_WEIGHTS.generalDistanceToTag),
        generalParticipation: toNum(input.generalParticipation ?? input.defensiveParticipation ?? input.participation, DEFAULT_MVP_WEIGHTS.generalParticipation),
        generalDodging: toNum(input.generalDodging ?? input.defensiveDodging ?? input.dodging, DEFAULT_MVP_WEIGHTS.generalDodging),
        defensiveHealing: toNum(input.defensiveHealing ?? input.healing, DEFAULT_MVP_WEIGHTS.defensiveHealing),
        defensiveCleanses: toNum(input.defensiveCleanses ?? input.cleanses, DEFAULT_MVP_WEIGHTS.defensiveCleanses),
        defensiveStability: toNum(input.defensiveStability ?? input.stability, DEFAULT_MVP_WEIGHTS.defensiveStability),
        defensiveRevives: toNum(input.defensiveRevives ?? input.revives, DEFAULT_MVP_WEIGHTS.defensiveRevives),
        defensiveDistanceToTag: toNum(input.defensiveDistanceToTag ?? input.generalDistanceToTag ?? input.distanceToTag, DEFAULT_MVP_WEIGHTS.defensiveDistanceToTag),
        defensiveParticipation: toNum(input.defensiveParticipation ?? input.generalParticipation ?? input.participation, DEFAULT_MVP_WEIGHTS.defensiveParticipation),
        defensiveDodging: toNum(input.defensiveDodging ?? input.generalDodging ?? input.dodging, DEFAULT_MVP_WEIGHTS.defensiveDodging)
    };
};
```

- [ ] **Step 5: Run typecheck**

```bash
npm run typecheck
```

Expected: FAIL — remaining files still reference `offensiveStrips`. This confirms the type rename propagated.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/global.d.ts
git commit -m "feat: rename offensiveStrips to generalStrips in MVP weights"
```

### Task 2: Update aggregation scoring

**Files:**
- Modify: `src/renderer/stats/computeStatsAggregation.ts:439-463`

- [ ] **Step 1: Move Strips from offensiveMetrics to generalMetrics**

In `src/renderer/stats/computeStatsAggregation.ts`, change the `offensiveMetrics` array (around line 445-451) to remove Strips:

```typescript
            const offensiveMetrics: Array<{
                name: string;
                weight: number;
                leaderboard: any[];
                getter: (s: PlayerStats) => number;
                higher?: boolean;
            }> = [
                { name: 'Down Contribution', weight: activeMvpWeights.offensiveDownContribution, leaderboard: leaderboards.downContrib, getter: (s) => s.downContrib },
                { name: 'CC', weight: activeMvpWeights.offensiveCc, leaderboard: leaderboards.cc, getter: (s) => s.cc },
                { name: 'DPS', weight: activeMvpWeights.offensiveDps, leaderboard: leaderboards.dps, getter: (s) => s.dps },
                { name: 'Damage', weight: activeMvpWeights.offensiveDamage, leaderboard: leaderboards.damage, getter: (s) => s.damage }
            ];
```

And add Strips to the `generalMetrics` array (around line 453-463):

```typescript
            const generalMetrics: Array<{
                name: string;
                weight: number;
                leaderboard: any[];
                getter: (s: PlayerStats) => number;
                higher?: boolean;
            }> = [
                { name: 'Strips', weight: activeMvpWeights.generalStrips, leaderboard: leaderboards.strips, getter: (s) => s.strips },
                { name: 'Distance to Tag', weight: activeMvpWeights.generalDistanceToTag, leaderboard: leaderboards.closestToTag, getter: (s) => getVal(s, 'closestToTag'), higher: false },
                { name: 'Participation', weight: activeMvpWeights.generalParticipation, leaderboard: leaderboards.participation, getter: (s) => s.logsJoined },
                { name: 'Dodging', weight: activeMvpWeights.generalDodging, leaderboard: leaderboards.dodges, getter: (s) => s.dodges }
            ];
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: FAIL — SettingsView and StatsView still reference `offensiveStrips`.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/stats/computeStatsAggregation.ts
git commit -m "feat: move strips from offensive to general MVP scoring"
```

### Task 3: Update settings UI and StatsView mapping

**Files:**
- Modify: `src/renderer/SettingsView.tsx:2131-2136`
- Modify: `src/renderer/StatsView.tsx:756`

- [ ] **Step 1: Move Strips slider from Offensive to General group**

In `src/renderer/SettingsView.tsx`, change the General MVP array (around line 2105-2108) to add Strips:

```typescript
                                    {([
                                        { key: 'generalStrips', label: 'Strips' },
                                        { key: 'generalDistanceToTag', label: 'Distance to Tag' },
                                        { key: 'generalParticipation', label: 'Participation' },
                                        { key: 'generalDodging', label: 'Dodging' }
                                    ] as Array<{ key: keyof IMvpWeights; label: string }>).map(item => (
```

And remove Strips from the Offensive MVP array (around line 2131-2136):

```typescript
                                    {([
                                        { key: 'offensiveDownContribution', label: 'Down Contribution' },
                                        { key: 'offensiveCc', label: 'CC' },
                                        { key: 'offensiveDps', label: 'DPS' },
                                        { key: 'offensiveDamage', label: 'Damage' }
                                    ] as Array<{ key: keyof IMvpWeights; label: string }>).map(item => (
```

- [ ] **Step 2: Update StatsView weight key mapping**

In `src/renderer/StatsView.tsx`, change line 756:

```typescript
    const mvpStatWeightKeys: Record<string, keyof IMvpWeights> = {
        'Down Contribution': 'offensiveDownContribution',
        'Strips': 'generalStrips',
        'CC': 'offensiveCc',
        'DPS': 'offensiveDps',
        'Damage': 'offensiveDamage',
        'Healing': 'defensiveHealing',
        'Cleanses': 'defensiveCleanses',
        'Stability': 'defensiveStability',
        'Revives': 'defensiveRevives',
        'Distance to Tag': 'generalDistanceToTag',
        'Participation': 'generalParticipation',
        'Dodging': 'generalDodging'
    };
```

- [ ] **Step 3: Run typecheck and lint**

```bash
npm run validate
```

Expected: PASS — all references updated.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/SettingsView.tsx src/renderer/StatsView.tsx
git commit -m "feat: move strips slider to general MVP section in settings UI"
```

### Task 4: Validate

- [ ] **Step 1: Run full validation**

```bash
npm run validate
```

Expected: typecheck and lint pass with 0 warnings.

- [ ] **Step 2: Run all unit tests**

```bash
npm run test:unit
```

Expected: All tests pass, no regressions.
