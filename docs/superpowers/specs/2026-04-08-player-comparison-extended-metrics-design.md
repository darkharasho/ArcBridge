# Player Comparison Extended Metrics Design

## Summary

Extend the Player Comparison section with new metrics: a General category tab, per-minute and per-fight rates, burst damage, boon generation (seconds/min), and distance/activity stats. Each boon gets its own row for direct comparison.

## Current State

The comparison tool has four categories (Offense, Defense, Support, Healing) with basic aggregate metrics. Player data is pulled from category-specific arrays (`offensePlayers`, `defensePlayers`, etc.) that carry only `*Totals` objects and timing fields. Boon generation data lives in a separate `boonTables` structure. Spike/burst data lives in `spikeDamage`.

## New Metrics by Section

### General (new category)

| Metric | Label | Source Fields | Calculation |
|--------|-------|---------------|-------------|
| activePercent | Active % | `squadActiveMs`, `totalFightMs` | `(squadActiveMs / totalFightMs) * 100` |
| stackPercent | Stack % | `stackedLogCount`, `logsJoined` | Percentage of logs where the player's distance to commander was <= 600 units. Requires a new `stackedLogCount` field incremented during aggregation when the player's per-log distance is <= 600. |
| avgDistCmd | Avg Dist Cmd | `totalDist`, `distCount` | `totalDist / distCount` (lower is better) |

Requires a new `generalPlayers` array from incremental aggregation containing: `account`, `profession`, `professionList`, `totalFightMs`, `squadActiveMs`, `totalDist`, `distCount`, `logsJoined`.

### Offense (additions)

| Metric | Label | Source | Calculation |
|--------|-------|--------|-------------|
| dpm | Avg DPM | `offenseTotals.damage`, `totalFightMs` | `damage / (totalFightMs / 60000)` |
| burst1s | Burst 1s | `spikeDamage.players` | Cross-reference by account to get `peak1s` |
| burstAvg | Burst Avg | `spikeDamage.players` | Average burst across fights (total burst damage / logs) |

Burst metrics use the spike damage system's 1-second rolling window (the system has 1s/5s/30s windows, no 2s). Burst data requires cross-referencing `stats.spikeDamage.players` by account key since it's a separate data pipeline.

`totalFightMs` is already on offensePlayers.

### Defense (additions)

| Metric | Label | Source | Calculation |
|--------|-------|--------|-------------|
| deathsPerFight | Deaths/Fight | `defenseTotals.deadCount`, `logsJoined` | `deadCount / logsJoined` (lower is better) |
| downsPerFight | Downs/Fight | `defenseTotals.downCount`, `logsJoined` | `downCount / logsJoined` (lower is better) |
| dodgesPerMin | Dodges/min | `defenseTotals.dodgeCount`, `activeMs` | `dodgeCount / (activeMs / 60000)` |

Requires adding `logsJoined` to `defensePlayers` array.

### Support (additions)

| Metric | Label | Source | Calculation |
|--------|-------|--------|-------------|
| cleansesPerMin | Cleanses/min | `supportTotals.condiCleanse`, `activeMs` | `condiCleanse / (activeMs / 60000)` |
| stripsPerMin | Strips/min | `supportTotals.boonStrips`, `activeMs` | `boonStrips / (activeMs / 60000)` |

### Boon Generation (in Support section)

All boon metrics display as **seconds/min** — total generation in seconds divided by active time in minutes.

Boon data is read from `stats.boonTables`. Each boon table has an `id` (e.g., `b740` for Might), `name`, `stacking` flag, and `rows[]` with per-player generation data. For each player row, compute: `generationMs / activeTimeMs * 60000 / 1000` = seconds/min.

The boons use `squadBuffs` category generation (total output to squad).

**Stability (stacking boon):**

| Metric | Label | Boon | Category |
|--------|-------|------|----------|
| stabSquad | Stab (Squad) | Stability (b1122) | squadBuffs |
| stabGroup | Stab (Group) | Stability (b1122) | groupBuffs |
| stabOffGroup | Stab (Off-Group) | Stability (b1122) | Computed: squad - group - self |

**Combat boons:**

| Metric | Label | Boon ID |
|--------|-------|---------|
| might | Might | b740 |
| fury | Fury | b725 |
| quickness | Quickness | b1187 |
| alacrity | Alacrity | b30328 |

**Defense boons:**

| Metric | Label | Boon ID |
|--------|-------|---------|
| protection | Protection | b717 |
| resistance | Resistance | b26980 |
| vigor | Vigor | b726 |

**Utility boons:**

| Metric | Label | Boon ID |
|--------|-------|---------|
| aegis | Aegis | b743 |
| regen | Regen | b718 |
| swiftness | Swiftness | b719 |
| resolution | Resolution | b873 |

**Note:** Boon IDs are resolved from `buffMap` in the EI JSON. The IDs above are the standard GW2 skill IDs for these boons. If a boon table isn't present (player didn't generate that boon), the value is 0.

## Architecture Changes

### 1. `comparisonMetrics.ts`

- Add `'general'` to `ComparisonCategory` type and `COMPARISON_CATEGORIES` array
- Extend `ComparisonMetric` interface with optional fields:
  - `perMinute?: boolean` — divide by `activeMs / 60000`
  - `perFight?: boolean` — divide by `logsJoined`
  - `isBoon?: boolean` — indicates boon lookup
  - `boonId?: string` — boon table ID (e.g., `b740`)
  - `boonCategory?: BoonCategory` — which generation category to read
  - `isBurst?: boolean` — indicates spike damage cross-reference
  - `burstField?: string` — field on SpikeDamagePlayer (e.g., `peak1s`)
- Add all new metrics to `COMPARISON_METRICS`
- Add `'general'` case to `getPlayersArrayKey()`
- Extend `getMetricValue()` to handle: perMinute, perFight, boon, and burst metric types

### 2. `incrementalAggregation.ts`

- Add `generalPlayers` array to output, mapping from `playerStats` with: `account`, `profession`, `professionList`, `totalFightMs`, `squadActiveMs`, `totalDist`, `distCount`, `logsJoined`, `stackedLogCount`
- Add `stackedLogCount` field to `PlayerStats` — incremented during per-log aggregation when `getDistanceToTag(player) <= 600`
- Add `logsJoined` to `defensePlayers` and `supportPlayers` arrays

### 3. `PlayerComparisonSection.tsx`

- Access `stats.boonTables` and `stats.spikeDamage` from shared context
- Pass boon tables and spike data as additional context to metric value resolution
- For boon metrics: find the matching `BoonTable` by ID, look up the player row by account, compute seconds/min
- For burst metrics: find the matching player in `spikeDamage.players` by account

### 4. `getMetricValue()` — Extended Signature

The function needs additional data beyond the player row object:
```typescript
getMetricValue(player: any, metric: ComparisonMetric, context?: {
    boonTables?: BoonTable[];
    spikePlayers?: SpikeDamagePlayer[];
}): number
```

For boon metrics, look up `boonTables.find(t => t.id === metric.boonId)`, then find the player row by account, then compute generation seconds/min using `computeBoonMetrics()`.

For burst metrics, look up `spikePlayers.find(p => p.account === player.account)`, then read the specified field.

## Metric Display

- Per-minute metrics: 1 decimal place (e.g., `12.3`)
- Per-fight metrics: 2 decimal places (e.g., `0.45`)
- Boon seconds/min: 1 decimal place (e.g., `3.2`)
- Burst damage: 0 decimal places, with commas (e.g., `45,230`)
- Active %: 1 decimal place with `%` suffix
- Stack %: 1 decimal place with `%` suffix
- Avg Dist Cmd: 0 decimal places (lower is better)

## Testing

- Add new metrics to existing `comparisonColors.test.ts` coverage
- Test `getMetricValue()` with boon, burst, perMinute, and perFight metric types
- Test edge cases: missing boon tables, player not in spike data, zero activeMs/logsJoined
