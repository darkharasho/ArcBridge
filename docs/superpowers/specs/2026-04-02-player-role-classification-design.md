# Player Role Classification (Support vs Damage)

## Problem

The current MVP system scores all players on both offensive and defensive metrics without filtering eligibility. A healer Firebrand can win Offensive MVP and a DPS Berserker can rank in Defensive MVP. We need a reliable way to classify players as support or damage so we can gate MVP eligibility and provide a reusable role property for future stat section filtering.

## Decision Summary

- **Approach**: Normalized ratio score against squad median, with configurable weights
- **Classification**: Binary (`support` | `damage`) with a continuous confidence score (0-1)
- **Scope**: Aggregate only (across all selected logs, not per-fight)
- **Immediate use**: Gate MVP eligibility (offensive MVP = damage players, defensive MVP = support players)
- **Future use**: Extensible to other stat sections via `PlayerStats.roleClassification`

## Data Model

New interface in `src/renderer/stats/classifyPlayerRoles.ts`:

```typescript
interface PlayerRoleClassification {
  role: 'support' | 'damage';
  supportScore: number;       // raw weighted score
  confidenceScore: number;    // 0-1, how clearly they fall on their side of the threshold
}
```

Added as a field on `PlayerStats` in `src/renderer/stats/computePlayerAggregation.ts`:

```typescript
interface PlayerStats {
  // ...existing fields...
  roleClassification: PlayerRoleClassification;
}
```

## Support Score Calculation

### Metrics and Weights

| Metric | Source | Weight | Rationale |
|--------|--------|--------|-----------|
| Squad Healing | `PlayerStats.healing` | 1.0 | Primary support indicator |
| Condition Cleanses | `PlayerStats.cleanses` | 1.0 | Core support function |
| Stability Generation | `PlayerStats.stab` | 0.8 | Key WvW support boon |
| Resistance Generation | boon tables, squad `generationMs` for resistance (buff ID 26980) | 0.7 | Defensive support boon |
| Might Generation | boon tables, squad `generationMs` for might (buff ID 740) | 0.6 | Offensive support boon |
| Regen Generation | boon tables, squad `generationMs` for regen (buff ID 718) | 0.5 | Healing-adjacent boon |

### Algorithm

1. For each metric independently, compute the **squad median** across all players with value > 0 for that metric (excludes zero-contribution players per-metric so the median isn't dragged down by DPS players who don't heal/cleanse).
2. For each player, compute the ratio: `ratio = playerValue / squadMedian`
   - If squad median is 0 and player value > 0: `ratio = 2.0` (they're clearly an outlier support)
   - If both are 0: `ratio = 0`
3. Compute weighted support score: `supportScore = Sum(ratio * weight)` across all 6 metrics.
4. Compute the squad median of all support scores.
5. **Threshold**: `supportScore > 1.5 * squadMedianSupportScore` classifies as support. The 1.5x multiplier provides a buffer against noise.
6. **Confidence**: `confidence = clamp(|supportScore - threshold| / threshold, 0, 1)` — how far above or below the cutoff, normalized to 0-1.

### Edge Cases

- **Squad with no healers**: All players score near zero on support metrics. Median is zero or near-zero. No one crosses the threshold. Everyone is classified as damage. Defensive MVP falls back to all players (existing behavior preserved).
- **Squad with no DPS**: Inverse of above. Everyone classified as support. Offensive MVP falls back to all players.
- **Commander**: Not exempt from classification. Scored like everyone else.
- **Small squads (<5 players)**: Median is coarser but still functional. The 1.5x multiplier helps prevent false positives.

## Integration with MVP System

### Execution Order (in `computeStatsAggregation.ts`)

1. Player aggregation completes (all `PlayerStats` populated)
2. Boon tables computed via `computeTimelineAndMapData`
3. **New**: `classifyPlayerRoles(leaderboardEntries, boonTables)` runs, populating `roleClassification` on each `PlayerStats`
4. MVP calculation runs with filtered candidates:
   - **Offensive MVP**: only `role === 'damage'` players
   - **Defensive MVP**: only `role === 'support'` players
   - **Fallback**: if either filtered set is empty, fall back to all players (current behavior)

### Boon Data Access

Stability is already available on `PlayerStats.stab`. For might (740), regen (718), and resistance (26980), the classification function extracts per-player squad `generationMs` from the boon tables that are already computed by `computeTimelineAndMapData`.

## File Changes

### New File

- `src/renderer/stats/classifyPlayerRoles.ts`
  - Exports `classifyPlayerRoles(playerStats[], boonTables[])` — pure function
  - Exports `PlayerRoleClassification` interface
  - Contains metric weights, median calculation, threshold logic, confidence scoring
  - No React dependencies — works in both main thread and web worker paths

### Modified Files

- `src/renderer/stats/computePlayerAggregation.ts` — add `roleClassification` field to `PlayerStats` interface with a default value
- `src/renderer/stats/computeStatsAggregation.ts` — call `classifyPlayerRoles` after boon tables are built, before MVP block. Filter MVP candidate arrays by role, with empty-set fallback.

### Not Changed

- No UI changes. The classification is available on `PlayerStats` for future use but the only behavioral change is MVP eligibility gating.

## Testing

- `classifyPlayerRoles` is pure and isolated — unit tests feed synthetic `PlayerStats` arrays and boon tables, assert role and confidence outputs
- Test cases:
  - All-DPS squad: everyone classified as damage
  - Mixed squad: healers/supports correctly identified
  - Single support in squad: high confidence support classification
  - Borderline player (e.g., Scrapper with moderate barrier + moderate damage): verify threshold behavior
  - Empty squad / single player: graceful handling
- Boon ID constants (might=740, regen=718, resistance=26980) are straightforward to mock via synthetic boon table entries
