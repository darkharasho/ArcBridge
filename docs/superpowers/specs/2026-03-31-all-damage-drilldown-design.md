# All Damage Drill-Down Section Design

**Date:** 2026-03-31
**Origin:** Discord thread "New Section: All Damage" (harasho)

## Overview

A three-level drill-down visualization in the Offense group that lets users explore damage from fight-level totals down to individual player-target breakdowns. A persistent toggle switches between "All Damage" and "Down Contribution" (damage dealt that resulted in downs) across all three levels.

## Interaction Model

### Level 1: Fight Overview

A line chart with one data point per fight showing aggregated squad damage (or down contribution when toggled). Clicking a fight point expands Level 2 below.

### Level 2: Per-Player Fight Detail

A multi-line chart showing each squad member's damage over time in 5-second buckets for the selected fight. Each player gets a colored line labeled by account name and profession. Clicking a player's line highlights it (dims others) and expands Level 3 below.

### Level 3: Player Damage Breakdown Table

A table showing the selected player's per-target damage breakdown for the selected fight.

| Column | Description |
|--------|-------------|
| Target | Target name ("All Targets" summary row at top) |
| Damage | Total damage dealt to target |
| DPS | Damage per second (damage / fight duration) |
| Down Contribution | Damage dealt that resulted in downs |

### Toggle: All Damage / Down Contribution

A toggle at the top of the section switches between two modes. The toggle propagates to all three levels:

- **All Damage mode**: L1 shows total squad damage per fight, L2 shows each player's total damage over time, L3 shows per-target damage breakdown
- **Down Contribution mode**: L1 shows total down contribution per fight, L2 shows each player's down contribution over time, L3 shows per-target down contribution breakdown

Changing the toggle resets drill-down state (closes L2/L3).

## Architecture

### New Files

| File | Purpose |
|------|---------|
| `src/renderer/stats/sections/AllDamageSection.tsx` | Top-level section component, renders L1/L2/L3 |
| `src/renderer/stats/sections/allDamage/AllDamageFightChart.tsx` | Level 1 — fight overview line chart |
| `src/renderer/stats/sections/allDamage/AllDamagePlayerChart.tsx` | Level 2 — per-player 5s bucket chart |
| `src/renderer/stats/sections/allDamage/AllDamagePlayerTable.tsx` | Level 3 — player damage breakdown table |
| `src/renderer/stats/sections/allDamage/useAllDamageState.ts` | Shared state hook |
| `src/renderer/stats/computeAllDamageData.ts` | Data extraction and bucketing |

### Modified Files

| File | Change |
|------|--------|
| `src/renderer/stats/hooks/useStatsNavigation.ts` | Add `"all-damage"` to Offense group |
| `src/renderer/StatsView.tsx` | Add to `ORDERED_SECTION_IDS`, render `AllDamageSection` |
| `src/renderer/stats/computeStatsAggregation.ts` | Call `computeAllDamageData()`, add to `stats.allDamage` |
| `src/renderer/stats/statsTypes.ts` | Add `AllDamageData` type |

### State Hook: `useAllDamageState`

```typescript
{
  damageBasis: 'all' | 'down',
  selectedFightIndex: number | null,
  selectedPlayerName: string | null,
  setDamageBasis: (basis) => void,
  setSelectedFightIndex: (index) => void,
  setSelectedPlayerName: (name) => void,
}
```

Changing `damageBasis` resets `selectedFightIndex` and `selectedPlayerName`.

## Data Computation

### `computeAllDamageData()`

Called inside `computeStatsAggregation` (same worker path as spike damage). Pre-computes both damage variants so the toggle is instant.

#### Level 1 Data (per-fight totals)

For each fight:
- Sum `player.dpsAll[0].damage` across all players → `totalDamage`
- Sum `player.statsTargets[].downContribution` across all players → `totalDownContribution`

Result: `{ fightIndex, totalDamage, totalDownContribution }[]`

#### Level 2 Data (per-player 5s buckets per fight)

For each fight, for each player:
1. Extract `targetDamage1S` (preferred) or fall back to `damage1S[0]`
2. Convert cumulative series to per-second deltas via `toPerSecond()`
3. Bucket into 5s intervals via `getBuckets(deltas, 5)`
4. For down contribution variant: use `targetDamage1S` filtered to targets where the player has `downContribution > 0`, same bucketing

Result per fight: `{ playerName, profession, buckets5s, buckets5sDown }[]`

#### Level 3 Data (per-target breakdown)

Computed on-the-fly when a player is selected (not pre-computed):
- Iterate `player.statsTargets` for the selected player in the selected fight
- Extract: target name, damage, DPS (damage / fight duration), downContribution
- Prepend "All Targets" summary row

Result: `{ targetName, damage, dps, downContribution }[]`

### Shared Utilities

Reuse `toPerSecond()` and `getBuckets()` from `computeSpikeDamageData.ts` — extract to a shared utility or import directly.

## Navigation Integration

### Desktop App

Add `"all-damage"` to the Offense group in `STATS_TOC_GROUPS` (`useStatsNavigation.ts`):

```
Offense: [
  "offense-detailed",
  "damage-modifiers",
  "player-breakdown",
  "damage-breakdown",
  "spike-damage",
  "all-damage",
  "conditions"
]
```

Sidebar label: **"All Damage"**

### Web Report

Adding `"all-damage"` to `ORDERED_SECTION_IDS` in `StatsView.tsx` automatically makes it available in the web report nav — no separate change needed. The section respects `sectionVisibility` like all other sections.

### Section Rendering

```tsx
renderSectionWrap(
  <AllDamageSection
    sectionId="all-damage"
    title="All Damage"
    stats={stats}
    logs={logs}
  />
)
```

## Charting

Uses Recharts with the existing `ChartContainer` wrapper. Level 1 uses `LineChart` with single series. Level 2 uses `LineChart` with one `Line` per player, colored by profession via `professionUtils`. Click handlers on chart elements drive drill-down state transitions.
