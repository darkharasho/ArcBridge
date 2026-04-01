# Player Comparison Section — Design Spec

## Overview

A new stats section under "Other Metrics" that lets users compare players side-by-side. Two modes toggled by a pill control:

- **Head-to-Head**: Select two players, see metrics as rows with color-coded differences
- **vs Squad Average**: All players as rows, each cell colored relative to the squad mean

Origin: Discord thread "player comparison tools?" by Meteor, harasho, and Dustin.

## Architecture

### New Files

- `src/renderer/stats/sections/PlayerComparisonSection.tsx` — the section component (custom grid, not DenseStatsTable)
- `src/renderer/stats/utils/comparisonColors.ts` — color utility for threshold-based highlighting

### Modified Files

- `src/renderer/stats/hooks/useStatsNavigation.ts` — add `'player-comparison'` to `other` group's `sectionIds` and `items`
- `src/renderer/stats/sectionColors.ts` — add color entry for `'player-comparison'`
- `src/renderer/StatsView.tsx` — add to `ORDERED_SECTION_IDS`, add state for mode/category/player selection, render the section component

## Comparison Modes

### Head-to-Head

- Two `SearchSelectDropdown` player pickers with profession icons, separated by a "vs" divider
- Second dropdown excludes the player selected in the first
- Metrics displayed as rows in a 4-column table: Metric | Player A | Player B | Diff %
- Diff percentage is from Player A's perspective (positive = A is better)
- Each player cell is colored green/orange/red based on who performs better

### vs Squad Average

- All players shown as rows, sorted by first metric column by default
- Pinned "Squad Average" row at top with neutral gray styling (no color coding on the avg row)
- Average computed as arithmetic mean across all squad players for each metric
- Column headers are sortable (click to sort)
- Each cell colored relative to squad average using percentage thresholds

## Color Highlighting

Utility function `getComparisonColor(value, reference, lowerIsBetter)` returns background color and text color:

| Condition | Background | Text | Meaning |
|-----------|-----------|------|---------|
| Within 10% or better | `rgba(34,197,94,0.15)` | `#22c55e` | Green — performing well |
| 10-30% worse | `rgba(245,158,11,0.12)` | `#f59e0b` | Orange — close |
| 30%+ worse | `rgba(239,68,68,0.15)` | `#ef4444` | Red — far behind |

"Worse" means lower for higher-is-better metrics, higher for lower-is-better metrics. The `lowerIsBetter` flag flips the comparison direction.

When `reference` is 0, no color is applied (neutral) to avoid division-by-zero artifacts.

## Metric Categories

A `PillToggleGroup` toggles between four categories. Each category pulls from existing aggregation arrays:

### Offense (from `offensePlayers`, higher is better)

| Metric | Field | Notes |
|--------|-------|-------|
| Damage | `damage` | |
| DPS | `dps` | Pre-computed in aggregation |
| Down Contribution | `downContribution` | |
| Downs | `downed` | |
| Kills | `killed` | |
| Critical Rate | `criticalRate` | Displayed as % |
| Boon Strips | `boonStrips` | |

### Defense (from `defensePlayers`, lower is better unless noted)

| Metric | Field | Direction |
|--------|-------|-----------|
| Damage Taken | `damageTaken` | lower is better |
| Down Count | `downCount` | lower is better |
| Death Count | `deadCount` | lower is better |
| Dodge Count | `dodgeCount` | higher is better |
| Blocked Count | `blockedCount` | higher is better |
| Evaded Count | `evadedCount` | higher is better |

### Support (from `supportPlayers`, higher is better)

| Metric | Field |
|--------|-------|
| Condition Cleanses | `condiCleanse` |
| Boon Strips | `boonStrips` |
| Stun Breaks | `stunBreak` |
| Resurrects | `resurrects` |

### Healing (from `healingPlayers`, higher is better)

| Metric | Field |
|--------|-------|
| Healing | `healing` |
| HPS | `healingPerSecond` |
| Barrier | `barrier` |
| Barrier/s | `barrierPerSecond` |
| Downed Healing | `downedHealing` |

Players are matched across category arrays by their `key` field.

## Controls

- **Mode toggle**: `PillToggleGroup` — "Head-to-Head" | "vs Squad Avg"
- **Category toggle**: `PillToggleGroup` — "Offense" | "Defense" | "Support" | "Healing"
- Both toggles persist during the session, reset on new data load
- Head-to-Head player selections also persist during the session

## Navigation Integration

### Desktop App (StatsView)

- Section ID: `'player-comparison'`
- Added to `STATS_TOC_GROUPS` under `'other'` group
- Nav item: `{ id: 'player-comparison', label: 'Player Comparison', icon: Users }`
- Added to `ORDERED_SECTION_IDS` array
- Section color: `'player-comparison': 'var(--brand-primary)'`

### Web Report (reportApp)

- No special handling needed — works via standard embedded mode
- Appears under "Other Metrics" in web nav when `'other'` group is active
- `sectionVisibility` callback handles show/hide

## Expanded View

Supports the standard expand/collapse pattern via `Maximize2` button. Expanded view shows the same layout at full size. No sidebar needed — the controls bar provides all filtering.

## Empty States

- No stats data: standard dashed border empty state with message
- Head-to-Head with no players selected: prompt to select two players
- Category with no data (e.g., Healing when no healer logs): "No data for this category"

## Data Flow

No new aggregation logic. The section reads from existing stats arrays:
1. `stats.offensePlayers` — offense metrics per player
2. `stats.defensePlayers` — defense metrics per player
3. `stats.supportPlayers` — support metrics per player
4. `stats.healingPlayers` — healing metrics per player

Squad averages are computed at render time by averaging metric values across all players in the active category array.
