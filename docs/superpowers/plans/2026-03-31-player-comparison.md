# Player Comparison Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Player Comparison section under "Other Metrics" with two modes: Head-to-Head (pick 2 players) and vs Squad Average (all players vs mean), with green/orange/red color-coded metric differences.

**Architecture:** A new `PlayerComparisonSection` component renders a custom comparison grid (not DenseStatsTable). A small `comparisonColors.ts` utility handles the threshold-based color logic. The section integrates into navigation, section ordering, and web report through the standard patterns used by existing "Other Metrics" sections.

**Tech Stack:** React, TypeScript, Vitest, existing AxiBridge UI components (PillToggleGroup, SearchSelectDropdown)

**Spec:** `docs/superpowers/specs/2026-03-31-player-comparison-design.md`

---

### Task 1: Color Utility — comparisonColors.ts

**Files:**
- Create: `src/renderer/stats/utils/comparisonColors.ts`
- Create: `src/renderer/stats/utils/__tests__/comparisonColors.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/renderer/stats/utils/__tests__/comparisonColors.test.ts
import { describe, it, expect } from 'vitest';
import { getComparisonColor } from '../comparisonColors';

describe('getComparisonColor', () => {
    describe('higher is better (default)', () => {
        it('returns green when value is better than reference', () => {
            const result = getComparisonColor(110, 100);
            expect(result.text).toBe('#22c55e');
            expect(result.bg).toBe('rgba(34,197,94,0.15)');
        });

        it('returns green when value is within 10% worse', () => {
            const result = getComparisonColor(95, 100);
            expect(result.text).toBe('#22c55e');
            expect(result.bg).toBe('rgba(34,197,94,0.15)');
        });

        it('returns orange when value is 10-30% worse', () => {
            const result = getComparisonColor(80, 100);
            expect(result.text).toBe('#f59e0b');
            expect(result.bg).toBe('rgba(245,158,11,0.12)');
        });

        it('returns red when value is 30%+ worse', () => {
            const result = getComparisonColor(60, 100);
            expect(result.text).toBe('#ef4444');
            expect(result.bg).toBe('rgba(239,68,68,0.15)');
        });

        it('returns neutral when reference is 0', () => {
            const result = getComparisonColor(50, 0);
            expect(result.text).toBe(null);
            expect(result.bg).toBe(null);
        });
    });

    describe('lower is better', () => {
        it('returns green when value is lower than reference', () => {
            const result = getComparisonColor(80, 100, true);
            expect(result.text).toBe('#22c55e');
        });

        it('returns red when value is 30%+ higher', () => {
            const result = getComparisonColor(140, 100, true);
            expect(result.text).toBe('#ef4444');
        });

        it('returns orange when value is 10-30% higher', () => {
            const result = getComparisonColor(120, 100, true);
            expect(result.text).toBe('#f59e0b');
        });
    });

    describe('getDiffPercent', () => {
        it('returns positive diff when value is greater', () => {
            // getDiffPercent is tested indirectly via getComparisonColor,
            // but we also export it for the diff column display
        });
    });
});
```

Also add a test for `getDiffPercent`:

```typescript
import { getDiffPercent } from '../comparisonColors';

describe('getDiffPercent', () => {
    it('returns positive percentage when value exceeds reference', () => {
        expect(getDiffPercent(150, 100)).toBe(50);
    });

    it('returns negative percentage when value is below reference', () => {
        expect(getDiffPercent(75, 100)).toBe(-25);
    });

    it('returns 0 when values are equal', () => {
        expect(getDiffPercent(100, 100)).toBe(0);
    });

    it('returns null when reference is 0', () => {
        expect(getDiffPercent(50, 0)).toBe(null);
    });

    it('handles lowerIsBetter by flipping sign', () => {
        // Lower value = positive diff (better)
        expect(getDiffPercent(80, 100, true)).toBe(20);
        // Higher value = negative diff (worse)
        expect(getDiffPercent(120, 100, true)).toBe(-20);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/renderer/stats/utils/__tests__/comparisonColors.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// src/renderer/stats/utils/comparisonColors.ts

export interface ComparisonColor {
    bg: string | null;
    text: string | null;
}

const GREEN: ComparisonColor = { bg: 'rgba(34,197,94,0.15)', text: '#22c55e' };
const ORANGE: ComparisonColor = { bg: 'rgba(245,158,11,0.12)', text: '#f59e0b' };
const RED: ComparisonColor = { bg: 'rgba(239,68,68,0.15)', text: '#ef4444' };
const NEUTRAL: ComparisonColor = { bg: null, text: null };

/**
 * Returns color based on how a value compares to a reference.
 * - Green: within 10% or better
 * - Orange: 10-30% worse
 * - Red: 30%+ worse
 *
 * @param lowerIsBetter - flip direction (e.g. deaths, damage taken)
 */
export function getComparisonColor(
    value: number,
    reference: number,
    lowerIsBetter = false
): ComparisonColor {
    if (reference === 0) return NEUTRAL;

    const ratio = lowerIsBetter
        ? reference / value
        : value / reference;

    if (ratio >= 0.9) return GREEN;
    if (ratio >= 0.7) return ORANGE;
    return RED;
}

/**
 * Returns the percentage difference from reference.
 * Positive = better, negative = worse.
 * Returns null if reference is 0.
 */
export function getDiffPercent(
    value: number,
    reference: number,
    lowerIsBetter = false
): number | null {
    if (reference === 0) return null;
    const raw = ((value - reference) / reference) * 100;
    return lowerIsBetter ? -raw : raw;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/renderer/stats/utils/__tests__/comparisonColors.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/stats/utils/comparisonColors.ts src/renderer/stats/utils/__tests__/comparisonColors.test.ts
git commit -m "feat: add comparison color utility for player comparison section"
```

---

### Task 2: Metric Definitions — comparisonMetrics.ts

**Files:**
- Create: `src/renderer/stats/utils/comparisonMetrics.ts`

- [ ] **Step 1: Create the metric definitions file**

This file defines which metrics appear in each comparison category and how to extract values from the existing player row objects.

```typescript
// src/renderer/stats/utils/comparisonMetrics.ts

export interface ComparisonMetric {
    id: string;
    label: string;
    /** Which *Totals object to read from (offenseTotals, defenseTotals, etc.) */
    totalsKey: 'offenseTotals' | 'defenseTotals' | 'supportTotals' | 'healingTotals';
    /** The field key inside the totals object */
    field: string;
    /** If true, lower values are better (deaths, damage taken) */
    lowerIsBetter?: boolean;
    /** If true, display as percentage */
    isPercent?: boolean;
    /** If true, this is a rate field that needs denominator from rateWeights */
    isRate?: boolean;
    /** For per-second metrics: divide value by activeMs/1000 */
    perSecond?: boolean;
    /** Number of decimal places for display */
    decimals?: number;
}

export type ComparisonCategory = 'offense' | 'defense' | 'support' | 'healing';

export const COMPARISON_CATEGORIES: { value: ComparisonCategory; label: string }[] = [
    { value: 'offense', label: 'Offense' },
    { value: 'defense', label: 'Defense' },
    { value: 'support', label: 'Support' },
    { value: 'healing', label: 'Healing' },
];

export const COMPARISON_METRICS: Record<ComparisonCategory, ComparisonMetric[]> = {
    offense: [
        { id: 'damage', label: 'Damage', totalsKey: 'offenseTotals', field: 'damage' },
        { id: 'dps', label: 'DPS', totalsKey: 'offenseTotals', field: 'damage', perSecond: true, decimals: 0 },
        { id: 'downContribution', label: 'Down Contribution', totalsKey: 'offenseTotals', field: 'downContribution' },
        { id: 'downed', label: 'Downs', totalsKey: 'offenseTotals', field: 'downed' },
        { id: 'killed', label: 'Kills', totalsKey: 'offenseTotals', field: 'killed' },
        { id: 'criticalRate', label: 'Critical Rate', totalsKey: 'offenseTotals', field: 'criticalRate', isRate: true, isPercent: true, decimals: 1 },
        { id: 'boonStrips', label: 'Boon Strips', totalsKey: 'offenseTotals', field: 'boonStrips' },
    ],
    defense: [
        { id: 'damageTaken', label: 'Damage Taken', totalsKey: 'defenseTotals', field: 'damageTaken', lowerIsBetter: true },
        { id: 'downCount', label: 'Down Count', totalsKey: 'defenseTotals', field: 'downCount', lowerIsBetter: true },
        { id: 'deadCount', label: 'Death Count', totalsKey: 'defenseTotals', field: 'deadCount', lowerIsBetter: true },
        { id: 'dodgeCount', label: 'Dodge Count', totalsKey: 'defenseTotals', field: 'dodgeCount' },
        { id: 'blockedCount', label: 'Blocked Count', totalsKey: 'defenseTotals', field: 'blockedCount' },
        { id: 'evadedCount', label: 'Evaded Count', totalsKey: 'defenseTotals', field: 'evadedCount' },
    ],
    support: [
        { id: 'condiCleanse', label: 'Condition Cleanses', totalsKey: 'supportTotals', field: 'condiCleanse' },
        { id: 'boonStrips', label: 'Boon Strips', totalsKey: 'supportTotals', field: 'boonStrips' },
        { id: 'stunBreak', label: 'Stun Breaks', totalsKey: 'supportTotals', field: 'stunBreak' },
        { id: 'resurrects', label: 'Resurrects', totalsKey: 'supportTotals', field: 'resurrects' },
    ],
    healing: [
        { id: 'healing', label: 'Healing', totalsKey: 'healingTotals', field: 'healing' },
        { id: 'healingPerSecond', label: 'HPS', totalsKey: 'healingTotals', field: 'healing', perSecond: true, decimals: 1 },
        { id: 'barrier', label: 'Barrier', totalsKey: 'healingTotals', field: 'barrier' },
        { id: 'barrierPerSecond', label: 'Barrier/s', totalsKey: 'healingTotals', field: 'barrier', perSecond: true, decimals: 1 },
        { id: 'downedHealing', label: 'Downed Healing', totalsKey: 'healingTotals', field: 'downedHealing' },
    ],
};

/**
 * Extract a metric value from a player row object.
 * Player rows have shape: { account, profession, professionList, offenseTotals, offenseRateWeights, totalFightMs, ... }
 */
export function getMetricValue(player: any, metric: ComparisonMetric): number {
    const totals = player[metric.totalsKey];
    if (!totals) return 0;

    let value: number;

    if (metric.isRate) {
        const weightsKey = metric.totalsKey.replace('Totals', 'RateWeights');
        const denom = player[weightsKey]?.[metric.field] || 0;
        const numer = totals[metric.field] || 0;
        value = denom > 0 ? (numer / denom) * 100 : 0;
    } else {
        value = totals[metric.field] || 0;
    }

    if (metric.perSecond) {
        const ms = player.totalFightMs || player.activeMs || 0;
        const seconds = Math.max(1, ms / 1000);
        value = value / seconds;
    }

    return value;
}

/**
 * Given a category, return the stats array key to read from.
 */
export function getPlayersArrayKey(category: ComparisonCategory): string {
    switch (category) {
        case 'offense': return 'offensePlayers';
        case 'defense': return 'defensePlayers';
        case 'support': return 'supportPlayers';
        case 'healing': return 'healingPlayers';
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/stats/utils/comparisonMetrics.ts
git commit -m "feat: add comparison metric definitions for player comparison section"
```

---

### Task 3: Navigation & Section Registration

**Files:**
- Modify: `src/renderer/stats/hooks/useStatsNavigation.ts:123-135`
- Modify: `src/renderer/stats/sectionColors.ts`
- Modify: `src/renderer/StatsView.tsx:103-143`
- Modify: `src/web/reportApp.tsx:646-658`

- [ ] **Step 1: Add to useStatsNavigation.ts**

In `src/renderer/stats/hooks/useStatsNavigation.ts`, add `'player-comparison'` to the `other` group.

The `Users` icon is already imported (line 3). Update the `other` group (lines 123-135):

```typescript
// Change the sectionIds array to include 'player-comparison':
sectionIds: ['fight-diff-mode', 'special-buffs', 'sigil-relic-uptime', 'skill-usage', 'apm-stats', 'player-comparison'],
// Add item to the items array:
items: [
    { id: 'fight-diff-mode', label: 'Fight Comparison', icon: GitCompareArrows },
    { id: 'special-buffs', label: 'Special Buffs', icon: Star },
    { id: 'sigil-relic-uptime', label: 'Sigil/Relic Uptime', icon: Gw2SigilIcon },
    { id: 'skill-usage', label: 'Skill Usage', icon: Keyboard },
    { id: 'apm-stats', label: 'APM Breakdown', icon: Gw2ApmIcon },
    { id: 'player-comparison', label: 'Player Comparison', icon: Users }
]
```

- [ ] **Step 2: Add to sectionColors.ts**

In `src/renderer/stats/sectionColors.ts`, add to `SECTION_ACCENT_COLORS` after the `'apm-stats'` entry:

```typescript
'player-comparison': 'var(--brand-primary)',
```

- [ ] **Step 3: Add to ORDERED_SECTION_IDS in StatsView.tsx**

In `src/renderer/StatsView.tsx`, add `'player-comparison'` at the end of the `ORDERED_SECTION_IDS` array (after `'apm-stats'`):

```typescript
    'skill-usage',
    'apm-stats',
    'player-comparison'
] as const;
```

- [ ] **Step 4: Add to web report navGroups in reportApp.tsx**

In `src/web/reportApp.tsx`, update the `other` group (lines 646-658):

```typescript
{
    id: 'other',
    label: 'Other Metrics',
    icon: Sparkles,
    sectionIds: ['fight-diff-mode', 'special-buffs', 'sigil-relic-uptime', 'skill-usage', 'apm-stats', 'player-comparison'],
    items: [
        { id: 'fight-diff-mode', label: 'Fight Comparison', icon: GitCompareArrows },
        { id: 'special-buffs', label: 'Special Buffs', icon: Star },
        { id: 'sigil-relic-uptime', label: 'Sigil/Relic Uptime', icon: Gw2SigilIcon },
        { id: 'skill-usage', label: 'Skill Usage', icon: Keyboard },
        { id: 'apm-stats', label: 'APM Breakdown', icon: Gw2ApmIcon },
        { id: 'player-comparison', label: 'Player Comparison', icon: Users }
    ]
}
```

Also add `Users` to the lucide-react import at the top of `reportApp.tsx` if not already imported.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/stats/hooks/useStatsNavigation.ts src/renderer/stats/sectionColors.ts src/renderer/StatsView.tsx src/web/reportApp.tsx
git commit -m "feat: register player comparison section in navigation and ordering"
```

---

### Task 4: PlayerComparisonSection Component — Shell & Head-to-Head Mode

**Files:**
- Create: `src/renderer/stats/sections/PlayerComparisonSection.tsx`
- Modify: `src/renderer/StatsView.tsx` (add state + render)

- [ ] **Step 1: Create the component file**

```typescript
// src/renderer/stats/sections/PlayerComparisonSection.tsx
import { useMemo, useState } from 'react';
import { Maximize2, X, Users } from 'lucide-react';
import { PillToggleGroup } from '../ui/PillToggleGroup';
import { useStatsSharedContext } from '../StatsViewContext';
import { getComparisonColor, getDiffPercent } from '../utils/comparisonColors';
import {
    COMPARISON_CATEGORIES,
    COMPARISON_METRICS,
    getMetricValue,
    getPlayersArrayKey,
    type ComparisonCategory,
    type ComparisonMetric,
} from '../utils/comparisonMetrics';

type ComparisonMode = 'head-to-head' | 'vs-average';

type PlayerComparisonSectionProps = {
    comparisonMode: ComparisonMode;
    setComparisonMode: (mode: ComparisonMode) => void;
    comparisonCategory: ComparisonCategory;
    setComparisonCategory: (cat: ComparisonCategory) => void;
    playerAKey: string | null;
    setPlayerAKey: (key: string | null) => void;
    playerBKey: string | null;
    setPlayerBKey: (key: string | null) => void;
};

export const PlayerComparisonSection = ({
    comparisonMode,
    setComparisonMode,
    comparisonCategory,
    setComparisonCategory,
    playerAKey,
    setPlayerAKey,
    playerBKey,
    setPlayerBKey,
}: PlayerComparisonSectionProps) => {
    const {
        stats,
        formatWithCommas,
        renderProfessionIcon,
        expandedSection,
        expandedSectionClosing,
        openExpandedSection,
        closeExpandedSection,
    } = useStatsSharedContext();

    const [avgSortMetric, setAvgSortMetric] = useState<string | null>(null);
    const [avgSortDir, setAvgSortDir] = useState<'asc' | 'desc'>('desc');

    const isExpanded = expandedSection === 'player-comparison';

    const playersArrayKey = getPlayersArrayKey(comparisonCategory);
    const players: any[] = stats?.[playersArrayKey] || [];
    const metrics = COMPARISON_METRICS[comparisonCategory];

    const playerOptions = useMemo(() =>
        players.map((p: any) => ({
            key: p.account,
            account: p.account,
            profession: p.profession,
            professionList: p.professionList,
        })),
        [players]
    );

    const playerA = useMemo(() => players.find((p: any) => p.account === playerAKey), [players, playerAKey]);
    const playerB = useMemo(() => players.find((p: any) => p.account === playerBKey), [players, playerBKey]);

    const formatValue = (value: number, metric: ComparisonMetric) => {
        const decimals = metric.decimals ?? (metric.isPercent ? 1 : 0);
        if (metric.isPercent) return `${value.toFixed(decimals)}%`;
        return formatWithCommas(value, decimals);
    };

    const hasData = players.length > 0;

    return (
        <div
            className={`${isExpanded
                ? `fixed inset-0 z-50 overflow-y-auto h-screen modal-pane flex flex-col pb-10 ${expandedSectionClosing ? 'modal-pane-exit' : 'modal-pane-enter'}`
                : ''
            }`}
            style={isExpanded ? { background: 'var(--bg-elevated)', boxShadow: 'var(--shadow-card)' } : undefined}
        >
            {/* Header */}
            <div className="flex items-center gap-2 mb-3.5">
                <Users className="w-4 h-4 shrink-0" style={{ color: 'var(--brand-primary)' }} />
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.05em]" style={{ color: 'var(--text-primary)' }}>
                    Player Comparison
                </h3>
                <div className="ml-auto flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => (isExpanded ? closeExpandedSection() : openExpandedSection('player-comparison'))}
                        className="flex items-center justify-center w-[26px] h-[26px]"
                        style={{ background: 'transparent', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)' }}
                        aria-label={isExpanded ? 'Close Player Comparison' : 'Expand Player Comparison'}
                        title={isExpanded ? 'Close' : 'Expand'}
                    >
                        {isExpanded
                            ? <X className="w-3 h-3" style={{ color: 'var(--text-secondary)' }} />
                            : <Maximize2 className="w-3 h-3" style={{ color: 'var(--text-secondary)' }} />
                        }
                    </button>
                </div>
            </div>

            {!hasData ? (
                <div className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--border-hover)] p-8 text-center" style={{ color: 'var(--text-muted)' }}>
                    No player data available
                </div>
            ) : (
                <>
                    {/* Controls bar */}
                    <div className="flex items-center gap-3 mb-4 flex-wrap">
                        <PillToggleGroup
                            value={comparisonMode}
                            onChange={(v) => setComparisonMode(v as ComparisonMode)}
                            options={[
                                { value: 'head-to-head', label: 'Head-to-Head' },
                                { value: 'vs-average', label: 'vs Squad Avg' },
                            ]}
                            className="inline-flex w-auto"
                            activeClassName="bg-[var(--accent-bg-strong)] text-[color:var(--brand-primary)] border border-[color:var(--accent-border)]"
                            inactiveClassName="text-[color:var(--text-secondary)]"
                        />
                        <div className="ml-auto">
                            <PillToggleGroup
                                value={comparisonCategory}
                                onChange={(v) => setComparisonCategory(v as ComparisonCategory)}
                                options={COMPARISON_CATEGORIES}
                                className="inline-flex w-auto"
                                activeClassName="bg-[var(--accent-bg-strong)] text-[color:var(--brand-primary)] border border-[color:var(--accent-border)]"
                                inactiveClassName="text-[color:var(--text-secondary)]"
                            />
                        </div>
                    </div>

                    {/* Mode-specific content */}
                    {comparisonMode === 'head-to-head' ? (
                        <HeadToHeadView
                            players={players}
                            playerOptions={playerOptions}
                            playerA={playerA}
                            playerB={playerB}
                            playerAKey={playerAKey}
                            playerBKey={playerBKey}
                            setPlayerAKey={setPlayerAKey}
                            setPlayerBKey={setPlayerBKey}
                            metrics={metrics}
                            formatValue={formatValue}
                            renderProfessionIcon={renderProfessionIcon}
                        />
                    ) : (
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
                        />
                    )}
                </>
            )}
        </div>
    );
};

/* ─── Player Selector Dropdown ────────────────────────────────────── */

const PlayerSelect = ({
    players,
    selectedKey,
    excludeKey,
    onChange,
    renderProfessionIcon,
    label,
}: {
    players: any[];
    selectedKey: string | null;
    excludeKey: string | null;
    onChange: (key: string | null) => void;
    renderProfessionIcon: any;
    label: string;
}) => {
    const selected = players.find((p: any) => p.account === selectedKey);
    const [open, setOpen] = useState(false);

    return (
        <div className="relative flex-1">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="w-full flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-2"
                style={{ background: 'var(--bg-card-inner)', border: '1px solid var(--border-default)' }}
            >
                {selected ? (
                    <>
                        {renderProfessionIcon(selected.profession, selected.professionList, 'w-4 h-4')}
                        <span style={{ color: 'var(--text-primary)' }} className="font-medium text-sm truncate">{selected.account}</span>
                        <span style={{ color: 'var(--text-muted)' }} className="text-xs ml-auto">{selected.profession}</span>
                    </>
                ) : (
                    <span style={{ color: 'var(--text-muted)' }} className="text-sm">{label}</span>
                )}
            </button>
            {open && (
                <div
                    className="absolute z-10 mt-1 w-full rounded-[var(--radius-md)] overflow-y-auto max-h-60"
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-card)' }}
                >
                    {players
                        .filter((p: any) => p.account !== excludeKey)
                        .map((p: any) => (
                            <button
                                key={p.account}
                                type="button"
                                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[var(--bg-hover)]"
                                onClick={() => { onChange(p.account); setOpen(false); }}
                            >
                                {renderProfessionIcon(p.profession, p.professionList, 'w-4 h-4')}
                                <span style={{ color: 'var(--text-primary)' }} className="text-sm truncate">{p.account}</span>
                                <span style={{ color: 'var(--text-muted)' }} className="text-xs ml-auto">{p.profession}</span>
                            </button>
                        ))}
                </div>
            )}
        </div>
    );
};

/* ─── Head-to-Head View ───────────────────────────────────────────── */

const HeadToHeadView = ({
    players,
    playerOptions,
    playerA,
    playerB,
    playerAKey,
    playerBKey,
    setPlayerAKey,
    setPlayerBKey,
    metrics,
    formatValue,
    renderProfessionIcon,
}: {
    players: any[];
    playerOptions: any[];
    playerA: any;
    playerB: any;
    playerAKey: string | null;
    playerBKey: string | null;
    setPlayerAKey: (key: string | null) => void;
    setPlayerBKey: (key: string | null) => void;
    metrics: ComparisonMetric[];
    formatValue: (value: number, metric: ComparisonMetric) => string;
    renderProfessionIcon: any;
}) => {
    return (
        <>
            {/* Player selectors */}
            <div className="flex items-center gap-3 mb-4">
                <PlayerSelect
                    players={players}
                    selectedKey={playerAKey}
                    excludeKey={playerBKey}
                    onChange={setPlayerAKey}
                    renderProfessionIcon={renderProfessionIcon}
                    label="Select Player A"
                />
                <span style={{ color: 'var(--text-muted)' }} className="font-bold text-base">vs</span>
                <PlayerSelect
                    players={players}
                    selectedKey={playerBKey}
                    excludeKey={playerAKey}
                    onChange={setPlayerBKey}
                    renderProfessionIcon={renderProfessionIcon}
                    label="Select Player B"
                />
            </div>

            {!playerA || !playerB ? (
                <div className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--border-hover)] p-8 text-center" style={{ color: 'var(--text-muted)' }}>
                    Select two players to compare
                </div>
            ) : (
                <div className="rounded-[var(--radius-md)] overflow-hidden" style={{ border: '1px solid var(--border-default)' }}>
                    <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid var(--border-default)' }}>
                                <th className="text-left px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', width: '30%' }}>Metric</th>
                                <th className="text-right px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', width: '25%' }}>{playerA.account}</th>
                                <th className="text-right px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', width: '25%' }}>{playerB.account}</th>
                                <th className="text-right px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', width: '20%' }}>Diff</th>
                            </tr>
                        </thead>
                        <tbody>
                            {metrics.map((metric) => {
                                const valA = getMetricValue(playerA, metric);
                                const valB = getMetricValue(playerB, metric);
                                const colorA = getComparisonColor(valA, valB, metric.lowerIsBetter);
                                const colorB = getComparisonColor(valB, valA, metric.lowerIsBetter);
                                const diff = getDiffPercent(valA, valB, metric.lowerIsBetter);

                                return (
                                    <tr key={metric.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                        <td className="px-4 py-2.5 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{metric.label}</td>
                                        <td className="px-4 py-2.5 text-right text-sm font-semibold" style={{ background: colorA.bg || undefined, color: colorA.text || 'var(--text-primary)' }}>
                                            {formatValue(valA, metric)}
                                        </td>
                                        <td className="px-4 py-2.5 text-right text-sm font-semibold" style={{ background: colorB.bg || undefined, color: colorB.text || 'var(--text-primary)' }}>
                                            {formatValue(valB, metric)}
                                        </td>
                                        <td className="px-4 py-2.5 text-right text-xs" style={{ color: diff !== null && diff >= 0 ? '#22c55e' : diff !== null ? '#ef4444' : 'var(--text-muted)' }}>
                                            {diff !== null ? `${diff >= 0 ? '+' : ''}${diff.toFixed(0)}%` : '—'}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </>
    );
};

/* ─── vs Squad Average View ───────────────────────────────────────── */

const VsAverageView = ({
    players,
    metrics,
    formatValue,
    renderProfessionIcon,
    sortMetric,
    sortDir,
    onSort,
}: {
    players: any[];
    metrics: ComparisonMetric[];
    formatValue: (value: number, metric: ComparisonMetric) => string;
    renderProfessionIcon: any;
    sortMetric: string | null;
    sortDir: 'asc' | 'desc';
    onSort: (metricId: string) => void;
}) => {
    const averages = useMemo(() => {
        const avgs: Record<string, number> = {};
        for (const metric of metrics) {
            const values = players.map((p) => getMetricValue(p, metric));
            avgs[metric.id] = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
        }
        return avgs;
    }, [players, metrics]);

    const sortedPlayers = useMemo(() => {
        if (!sortMetric) return players;
        const metric = metrics.find((m) => m.id === sortMetric);
        if (!metric) return players;
        return [...players].sort((a, b) => {
            const va = getMetricValue(a, metric);
            const vb = getMetricValue(b, metric);
            return sortDir === 'desc' ? vb - va : va - vb;
        });
    }, [players, metrics, sortMetric, sortDir]);

    if (players.length === 0) {
        return (
            <div className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--border-hover)] p-8 text-center" style={{ color: 'var(--text-muted)' }}>
                No data for this category
            </div>
        );
    }

    return (
        <div className="rounded-[var(--radius-md)] overflow-x-auto" style={{ border: '1px solid var(--border-default)' }}>
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-default)' }}>
                        <th className="text-left px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Player</th>
                        {metrics.map((metric) => (
                            <th
                                key={metric.id}
                                className="text-right px-3 py-2.5 text-[11px] font-medium uppercase tracking-wide cursor-pointer hover:bg-[var(--bg-hover)]"
                                style={{ color: 'var(--text-muted)' }}
                                onClick={() => onSort(metric.id)}
                            >
                                {metric.label}
                                {sortMetric === metric.id && (
                                    <span className="ml-1">{sortDir === 'desc' ? '▼' : '▲'}</span>
                                )}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {/* Squad Average row */}
                    <tr style={{ borderBottom: '2px solid var(--border-default)', background: 'var(--bg-card-inner)' }}>
                        <td className="px-4 py-2.5 text-sm font-semibold italic" style={{ color: 'var(--text-muted)' }}>Squad Average</td>
                        {metrics.map((metric) => (
                            <td key={metric.id} className="px-3 py-2.5 text-right text-sm" style={{ color: 'var(--text-muted)' }}>
                                {formatValue(averages[metric.id], metric)}
                            </td>
                        ))}
                    </tr>
                    {/* Player rows */}
                    {sortedPlayers.map((player: any) => (
                        <tr key={player.account} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td className="px-4 py-2.5 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                                <span className="inline-flex items-center gap-2">
                                    {renderProfessionIcon(player.profession, player.professionList, 'w-4 h-4')}
                                    {player.account}
                                </span>
                            </td>
                            {metrics.map((metric) => {
                                const value = getMetricValue(player, metric);
                                const color = getComparisonColor(value, averages[metric.id], metric.lowerIsBetter);
                                return (
                                    <td
                                        key={metric.id}
                                        className="px-3 py-2.5 text-right text-sm font-semibold"
                                        style={{ background: color.bg || undefined, color: color.text || 'var(--text-primary)' }}
                                    >
                                        {formatValue(value, metric)}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
```

- [ ] **Step 2: Add state and rendering in StatsView.tsx**

In `src/renderer/StatsView.tsx`, add the following:

**Import** (add near the other section imports, around line 29-65):
```typescript
import { PlayerComparisonSection } from './stats/sections/PlayerComparisonSection';
```

**State** (add near other "other group" state, around line 792-868):
```typescript
const [comparisonMode, setComparisonMode] = useState<'head-to-head' | 'vs-average'>('head-to-head');
const [comparisonCategory, setComparisonCategory] = useState<'offense' | 'defense' | 'support' | 'healing'>('offense');
const [comparisonPlayerAKey, setComparisonPlayerAKey] = useState<string | null>(null);
const [comparisonPlayerBKey, setComparisonPlayerBKey] = useState<string | null>(null);
```

**Render** (add to the `renderGroup('other', [...])` call, after the `apm-stats` entry, around line 4860):
```typescript
{ id: 'player-comparison', element: <PlayerComparisonSection
    comparisonMode={comparisonMode}
    setComparisonMode={setComparisonMode}
    comparisonCategory={comparisonCategory}
    setComparisonCategory={setComparisonCategory}
    playerAKey={comparisonPlayerAKey}
    setPlayerAKey={setComparisonPlayerAKey}
    playerBKey={comparisonPlayerBKey}
    setPlayerBKey={setComparisonPlayerBKey}
/> },
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS (no type errors)

- [ ] **Step 4: Commit**

```bash
git add src/renderer/stats/sections/PlayerComparisonSection.tsx src/renderer/StatsView.tsx
git commit -m "feat: add PlayerComparisonSection with head-to-head and vs-average modes"
```

---

### Task 5: Visual Verification & Polish

**Files:**
- Possibly modify: `src/renderer/stats/sections/PlayerComparisonSection.tsx`

- [ ] **Step 1: Run the dev environment**

Run: `npm run dev`

Navigate to the Stats view, load some logs, and go to Other Metrics > Player Comparison.

- [ ] **Step 2: Verify Head-to-Head mode**

- Select two players from the dropdowns
- Confirm metrics display as rows with color-coded cells
- Confirm diff column shows correct percentages
- Confirm green/orange/red thresholds look correct
- Confirm selecting the same player in both dropdowns is prevented

- [ ] **Step 3: Verify vs Squad Average mode**

- Toggle to "vs Squad Avg"
- Confirm all players appear with a pinned "Squad Average" row at top
- Confirm cells are colored relative to average
- Confirm column sorting works (click headers)

- [ ] **Step 4: Verify category toggle**

- Switch between Offense / Defense / Support / Healing
- Confirm correct metrics appear for each
- Confirm Defense metrics flip color direction (lower damage taken = green)

- [ ] **Step 5: Verify expand/collapse**

- Click the Maximize button
- Confirm full-screen expanded view works
- Click X to close

- [ ] **Step 6: Verify web report**

Run: `npm run dev:web`

Navigate to Other Metrics > Player Comparison and confirm it renders correctly in the web report.

- [ ] **Step 7: Fix any visual issues found**

Apply any CSS or layout fixes discovered during verification.

- [ ] **Step 8: Run validate**

Run: `npm run validate`
Expected: PASS (typecheck + lint)

- [ ] **Step 9: Commit any fixes**

```bash
git add -u
git commit -m "fix: polish player comparison section layout and styling"
```

---

### Task 6: Unit Tests

**Files:**
- Create: `src/renderer/stats/sections/__tests__/PlayerComparisonSection.test.tsx`

- [ ] **Step 1: Write section tests**

```typescript
// src/renderer/stats/sections/__tests__/PlayerComparisonSection.test.tsx
import { describe, it, expect } from 'vitest';
import { getMetricValue } from '../../utils/comparisonMetrics';
import { getComparisonColor, getDiffPercent } from '../../utils/comparisonColors';

// Test the data extraction and color logic that powers the component.
// Full component rendering tests require the StatsSharedContext provider
// which is complex to set up — focus on the logic units.

describe('PlayerComparison data logic', () => {
    const mockOffensePlayer = {
        account: 'Test.1234',
        profession: 'Warrior',
        professionList: ['Berserker'],
        offenseTotals: { damage: 100000, downContribution: 50000, downed: 10, killed: 5, criticalRate: 340, boonStrips: 80 },
        offenseRateWeights: { criticalRate: 500 },
        totalFightMs: 120000,
    };

    const mockDefensePlayer = {
        account: 'Test.1234',
        profession: 'Warrior',
        professionList: ['Berserker'],
        defenseTotals: { damageTaken: 200000, downCount: 3, deadCount: 1, dodgeCount: 15, blockedCount: 20, evadedCount: 10 },
        activeMs: 120000,
    };

    it('extracts basic offense metric value', () => {
        const metric = { id: 'damage', label: 'Damage', totalsKey: 'offenseTotals' as const, field: 'damage' };
        expect(getMetricValue(mockOffensePlayer, metric)).toBe(100000);
    });

    it('extracts per-second metric value', () => {
        const metric = { id: 'dps', label: 'DPS', totalsKey: 'offenseTotals' as const, field: 'damage', perSecond: true };
        const value = getMetricValue(mockOffensePlayer, metric);
        // 100000 / (120000/1000) = 100000 / 120 ≈ 833.33
        expect(value).toBeCloseTo(833.33, 1);
    });

    it('extracts rate metric as percentage', () => {
        const metric = { id: 'criticalRate', label: 'Critical Rate', totalsKey: 'offenseTotals' as const, field: 'criticalRate', isRate: true, isPercent: true };
        const value = getMetricValue(mockOffensePlayer, metric);
        // 340 / 500 * 100 = 68%
        expect(value).toBeCloseTo(68, 0);
    });

    it('extracts defense metric value', () => {
        const metric = { id: 'damageTaken', label: 'Damage Taken', totalsKey: 'defenseTotals' as const, field: 'damageTaken', lowerIsBetter: true };
        expect(getMetricValue(mockDefensePlayer, metric)).toBe(200000);
    });

    it('returns 0 for missing totals', () => {
        const metric = { id: 'healing', label: 'Healing', totalsKey: 'healingTotals' as const, field: 'healing' };
        expect(getMetricValue(mockOffensePlayer, metric)).toBe(0);
    });

    it('colors correctly for head-to-head comparison', () => {
        // Player A: 100k damage, Player B: 60k damage → A is green, B is red
        const colorA = getComparisonColor(100000, 60000);
        expect(colorA.text).toBe('#22c55e'); // green

        const colorB = getComparisonColor(60000, 100000);
        expect(colorB.text).toBe('#ef4444'); // red (40% worse)
    });

    it('diff percent is correct', () => {
        const diff = getDiffPercent(100000, 60000);
        expect(diff).toBeCloseTo(66.67, 0);
    });
});
```

- [ ] **Step 2: Run the tests**

Run: `npx vitest run src/renderer/stats/sections/__tests__/PlayerComparisonSection.test.tsx src/renderer/stats/utils/__tests__/comparisonColors.test.ts`
Expected: PASS

- [ ] **Step 3: Run full test suite**

Run: `npm run test:unit`
Expected: PASS — no regressions

- [ ] **Step 4: Commit**

```bash
git add src/renderer/stats/sections/__tests__/PlayerComparisonSection.test.tsx
git commit -m "test: add unit tests for player comparison data logic"
```
