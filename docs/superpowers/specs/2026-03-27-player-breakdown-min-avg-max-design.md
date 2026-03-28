# Player Breakdown: Add Min Hit, Avg Hit, Max Hit

**Date:** 2026-03-27
**Origin:** Discord thread "Player Breakdown Avg Min Max hit" (thread ID 1487108010898624603)

## Summary

Add Min Hit, Avg Hit, and Max Hit metric rows to the Player Breakdown detail pane. The data exists in the EI JSON (`TotalDamageDist.min`, `.max`, `.hits`) but is not currently captured during aggregation.

## Changes

### 1. Add `min` to `TotalDamageDist` type

**File:** `src/shared/dpsReportTypes.ts`

Add `min: number` to the `TotalDamageDist` interface. The field already exists in the raw EI JSON but is missing from the TypeScript type.

### 2. Extend `PlayerSkillDamageEntry`

**File:** `src/renderer/stats/statsTypes.ts`

Add three fields:

- `hits: number` — total connected hits across all aggregated logs
- `min: number` — lowest min hit value across all aggregated logs
- `max: number` — highest max hit value across all aggregated logs

Avg hit is derived at render time: `damage / hits`.

### 3. Update aggregation logic

**File:** `src/renderer/stats/computePlayerAggregation.ts`

In `pushPlayerSkillEntry`:

- Initialize new fields: `hits: 0, min: Infinity, max: 0`
- Accumulate per entry:
  - `hits += Number(entry.hits || 0)`
  - `min = Math.min(min, Number(entry.min))` — only when `entry.min` is a finite positive number
  - `max = Math.max(max, Number(entry.max || 0))`
- After aggregation, normalize: if `min` is still `Infinity`, set to `0`

### 4. Add metric rows to player view detail pane

**File:** `src/renderer/stats/sections/PlayerBreakdownSection.tsx`

Append three rows after the existing DPS row in the metric rows array (~line 569):

- **Min Hit** — `formatTopStatValue(activePlayerSkill.min || 0)`
- **Avg Hit** — `formatTopStatValue(activePlayerSkill.hits > 0 ? Math.round(activePlayerSkill.damage / activePlayerSkill.hits) : 0)`
- **Max Hit** — `formatTopStatValue(activePlayerSkill.max || 0)`

Uses the same `formatTopStatValue` formatting as existing rows.

## Affected Surfaces

- **Electron renderer** — Player Breakdown detail pane (player view)
- **Web report** — Same `PlayerBreakdownSection` component is shared; changes apply automatically

## Out of Scope

- Class view detail pane (shows per-player columns, not per-skill metric rows)
- Expanded/dense table view
- Discord output
- New components
