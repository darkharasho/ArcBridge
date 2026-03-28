# Boon Sections FightMetricSection Conversion

**Date:** 2026-03-28
**Origin:** User request to unify chart section UIs under FightMetricSection
**Status:** Design
**Sub-project:** 2 of 3 (previous: SpikeDamage conversion, next: SkillUsage)

## Summary

Extend FightMetricSection with 4 new optional props (`renderAbovePlayerList`, `renderPlayerItem`, `containerClassName`, `referenceLineY`/`referenceLineLabel`) and convert BoonTimelineSection (~478 lines) and BoonUptimeSection (~590 lines) to thin wrappers (~150-250 lines each).

## Motivation

BoonTimelineSection and BoonUptimeSection implement the same "player list + per-fight chart" pattern as FightMetricSection but with their own older visual styles. Converting them to FightMetricSection ensures visual consistency with the new flat design, reduces duplicated layout code, and gives them the sort toggle and animated charts for free.

## Design

### New FightMetricSection Extension Points

#### 1. renderAbovePlayerList

```typescript
renderAbovePlayerList?: () => ReactNode;
```

Content rendered inside the left panel, between the search input and the player list. Boon sections use this for the boon selector UI (scope toggles, boon search, scrollable pill buttons). Renders inside the existing left panel container, maintaining the cohesive flat layout.

#### 2. renderPlayerItem

```typescript
renderPlayerItem?: (player: FightMetricPlayer, isSelected: boolean) => ReactNode;
```

Custom player item renderer. When provided, replaces the default item rendering (profession icon + name + value) inside the player list button. The button container, click handler, and selection styling are still managed by FightMetricSection — only the inner content is customized.

When not provided, the existing default rendering is used. BoonUptimeSection uses this for subgroup entries with cyan "SG" badges and hover tooltips showing members.

#### 3. containerClassName

```typescript
containerClassName?: string;
```

Replaces the hardcoded `glass-surface` class on the outer container. Defaults to `''` (flat, no glass effect). This addresses the user preference for flat styling. Existing sections that want the glass look can pass `containerClassName="glass-surface"`.

Note: When changing this default, update all existing FightMetricSection render sites (strip spikes, spike damage, incoming strike) to pass `containerClassName="glass-surface"` if they should keep the glass look, or leave them to adopt the flat style. The user prefers flat, so leave them without the class.

#### 4. Reference Line

```typescript
referenceLineY?: number;
referenceLineLabel?: string;
```

Optional horizontal reference line on the main chart. When `referenceLineY` is provided, renders a Recharts `ReferenceLine` with dashed orange stroke, the label positioned on the right, and `ifOverflow="extendDomain"` to extend the chart domain if the line exceeds the current Y max. BoonUptimeSection uses this for the stack cap at y=25.

Import `ReferenceLine` from recharts in FightMetricSection when this is used.

### BoonTimelineSection Conversion

BoonTimelineSection.tsx is rewritten as a wrapper around FightMetricSection.

**Props interface:** Unchanged — the wrapper accepts the same props and maps them internally.

**`renderAbovePlayerList`:** Renders the boon selector:
- Scope toggles (Self/Squad/Group/All) as a PillToggleGroup
- Boon search input with match count
- Scrollable container (max-h-28) of pill buttons for each boon, with icons and names
- Active boon highlighted

**`headerExtras`:** The "Squad Damage Heatmap" toggle button, only visible when a fight is selected and incoming damage data exists.

**`renderDrilldown`:** A ComposedChart (not LineChart) with:
- Primary Line showing generation values
- Conditional Bar layer for incoming damage heatmap (per-Cell coloring based on `incomingIntensity`)
- Secondary hidden Y-axis (`yAxisId="incomingHeat"`, domain [0,1]) for the heatmap normalization
- Bar only renders when `showIncomingHeatmap && hasIncomingHeatData`

**Data mapping:**
- `BoonTimelinePlayer` → `FightMetricPlayer` (value = generation total for active scope)
- `BoonTimelineFightPoint` → `FightMetricPoint` (value = player's fight value, maxValue = fight max)

**Modes:** Empty array — scope selection is handled in the boon selector area, not as mode toggles.

**Result:** ~478 → ~150-200 lines.

### BoonUptimeSection Conversion

BoonUptimeSection.tsx is rewritten as a wrapper around FightMetricSection.

**Props interface:** Unchanged.

**`renderAbovePlayerList`:** Boon selector (search + pill buttons). No scope toggles — BoonUptime doesn't use them.

**`renderPlayerItem`:** Custom renderer handling two entry types:
- Regular players: profession icon + name + uptime value (similar to default)
- Subgroup entries (`entryType === 'subgroup'`): cyan "SG" circle badge, "Aggregate" label, display name, value. Hover triggers `SubgroupMembersTooltip` (portal-rendered tooltip showing member profession icons, accounts, fight counts). The tooltip logic and `useFixedTooltipPosition` hook stay inside BoonUptimeSection.

**`referenceLineY` / `referenceLineLabel`:** When `showStackCapLine` is true, passes `referenceLineY={25}` and `referenceLineLabel="25"`.

**`headerExtras`:** "Squad Damage Heatmap" toggle button.

**`renderDrilldown`:** ComposedChart with:
- Uptime/stack Line
- Optional heatmap Bar layer (same pattern as BoonTimeline)
- Its own ReferenceLine at y=25 when stack cap is enabled (rendered inside the drilldown's own chart, independent of the main chart reference line)

**Data mapping:**
- `BoonUptimePlayer` → `FightMetricPlayer` (value switches between `uptimePercent` and `average` based on `showStackCapLine`)
- `BoonUptimeFightPoint` → `FightMetricPoint`

**Modes:** Empty array.

**Result:** ~590 → ~200-250 lines.

### Flat Styling Migration

Remove `glass-surface` from the default `containerClassName`. All FightMetricSection instances (strip spikes, spike damage, incoming strike, boon timeline, boon uptime) will use flat styling by default. The `containerClassName` prop exists if any future section needs a different container style.

### What Changes

- `FightMetricSection.tsx` — 4 new optional props, `ReferenceLine` import, flat container default
- `BoonTimelineSection.tsx` — rewritten as FightMetricSection wrapper
- `BoonUptimeSection.tsx` — rewritten as FightMetricSection wrapper

### What Stays the Same

- All computation files (`computeBoonUptimeTimeline.ts`, `computeTimelineAndMapData.ts`, etc.)
- `computeStatsAggregation.ts`
- StatsView.tsx boon state variables and memos (the wrapper components accept the same props)
- TOC entries
- `SubgroupMembersTooltip` component and `useFixedTooltipPosition` hook (stay inside BoonUptimeSection wrapper or get extracted if they're already separate)

## Out of Scope

- Converting SkillUsageSection (sub-project 3)
- Adding new features to boon sections beyond what they currently have
- Changing boon computation logic or data pipelines
