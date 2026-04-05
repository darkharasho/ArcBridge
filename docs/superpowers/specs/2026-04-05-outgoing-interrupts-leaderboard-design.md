# Outgoing Interrupts Leaderboard Metric

**Date:** 2026-04-05
**Origin:** Discord thread — "Option to log Interrupts and CC as just CC or have them together on the leaderboard"
**Requested by:** Meteor

## Summary

Add outgoing interrupts as a leaderboard metric with a 3-way setting controlling how it relates to the existing CC card. Interrupts are a form of CC but are more valuable in WvW because they cancel enemy skills. Surfacing them on the leaderboard incentivizes interrupt-focused builds.

## Setting

Add `interruptMode` to `IStatsViewSettings`:

```typescript
interruptMode: 'ccOnly' | 'separate' | 'combined';
```

| Mode | Leaderboard cards | Description |
|------|-------------------|-------------|
| `ccOnly` (default) | CC | Current behavior, no change |
| `separate` | CC, Interrupts | Two independent leaderboard cards |
| `combined` | CC + Interrupts | Single card with summed value |

The setting is persisted via the existing `statsViewSettings` electron-store flow. Default is `ccOnly` to preserve current behavior.

The interrupt value is always a **raw count** (no DisruptionMethod applies — interrupts have no meaningful duration component). The value respects the existing `topStatsMode` setting (`total` / `perSecond` / `perMinute`) for rate conversion.

## Data Pipeline

### 1. Metric Extraction — `src/shared/dashboardMetrics.ts`

Add `getPlayerOutgoingInterrupts(player: Player): number`.

Source: `player.statsTargets[*][0].interrupts` summed across all targets. Follows the same pattern as `getTargetStatTotal()`.

The `interrupts` field exists in EI JSON `statsTargets` data but is not yet in the `StatsTarget` TypeScript interface — add it as an optional field.

### 2. Player Aggregation — `src/renderer/stats/computePlayerAggregation.ts`

- Add `interrupts: number` to the `PlayerStats` interface (initialized to `0`).
- In `ingestLogPlayerData`, accumulate: `s.interrupts += getPlayerOutgoingInterrupts(p)`.

### 3. Leaderboard Construction — `src/renderer/stats/incrementalAggregation.ts`

The aggregation layer receives `statsViewSettings` (which includes the new `interruptMode`), so it can conditionally build leaderboards.

#### `getVal` switch

Add cases:
- `'interrupts'`: returns `s.interrupts`
- `'ccAndInterrupts'`: returns `s.cc + s.interrupts`

#### Leaderboard objects

Always build the `interrupts` leaderboard (it's cheap). Conditionally build `ccAndInterrupts`:

```
interrupts: createLB('interrupts', true)
ccAndInterrupts: createLB('ccAndInterrupts', true)   // only when mode === 'combined'
```

#### `statKeys`

Add entries for `interrupts` and `ccAndInterrupts` so per-second/per-minute variants are derived automatically.

#### `topStats` / `topStatsPerSecond` / `topStatsPerMinute`

Add `maxInterrupts` and `maxCCAndInterrupts` entries, populated from their respective leaderboards.

### 4. UI — `src/renderer/stats/sections/TopPlayersSection.tsx`

The `leaderCards` array is built dynamically based on `interruptMode` (passed via `statsViewSettings`):

| Mode | Cards rendered |
|------|----------------|
| `ccOnly` | `{ statKey: 'cc', title: 'CC' }` (current) |
| `separate` | `{ statKey: 'cc', title: 'CC' }` + `{ statKey: 'interrupts', title: 'Interrupts' }` |
| `combined` | `{ statKey: 'ccAndInterrupts', title: 'CC + Interrupts' }` (replaces the CC card) |

The interrupt card uses the same rate formatting as all other cards (controlled by `topStatsMode`).

Icon for interrupts: `Ban` from lucide-react (represents blocking/interrupting an action). For the combined card, keep the existing `Hammer` icon.

### 5. Settings UI — `src/renderer/SettingsView.tsx`

Add a 3-way toggle for `interruptMode` in the stats settings area, near the existing disruption method toggle. Labels:

- **CC Only** — "Show only CC on the leaderboard"
- **CC + Interrupts (Separate)** — "Show CC and Interrupts as separate leaderboard cards"
- **CC + Interrupts (Combined)** — "Combine CC and Interrupts into a single leaderboard value"

### 6. Type Updates — `src/renderer/global.d.ts`

- Add `interruptMode: 'ccOnly' | 'separate' | 'combined'` to `IStatsViewSettings`.
- Add default value `interruptMode: 'ccOnly'` to `DEFAULT_STATS_VIEW_SETTINGS`.

### 7. EI Type Update — `src/shared/dpsReportTypes.ts`

Add `interrupts?: number` to the `StatsTarget` interface.

## Cache Invalidation

Because `interruptMode` lives in `IStatsViewSettings`, the existing `hashAggregationSettings()` in `statsStore.ts` will automatically detect changes and invalidate the stats cache — no additional work needed.

## Files Changed

| File | Change |
|------|--------|
| `src/renderer/global.d.ts` | Add `interruptMode` to `IStatsViewSettings` and default |
| `src/shared/dpsReportTypes.ts` | Add `interrupts?` to `StatsTarget` |
| `src/shared/dashboardMetrics.ts` | Add `getPlayerOutgoingInterrupts()` |
| `src/renderer/stats/computePlayerAggregation.ts` | Add `interrupts` to `PlayerStats`, accumulate in ingestion |
| `src/renderer/stats/incrementalAggregation.ts` | Add interrupts/combined leaderboards, topStats entries |
| `src/renderer/stats/sections/TopPlayersSection.tsx` | Conditionally render interrupt card(s) based on mode |
| `src/renderer/SettingsView.tsx` | Add 3-way interrupt mode toggle |

## Testing

- Unit test: `getPlayerOutgoingInterrupts` returns correct sum from mock `statsTargets` data.
- Unit test: leaderboard construction includes `interrupts` and `ccAndInterrupts` entries.
- Integration: verify each of the three modes renders the correct card(s) in `TopPlayersSection`.
- Existing audit scripts (`npm run audit:*`) should remain green — interrupts are additive and don't change existing metric calculations.
