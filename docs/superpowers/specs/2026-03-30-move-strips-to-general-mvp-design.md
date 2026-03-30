# Move Strips to General MVP

**Date:** 2026-03-30
**Origin:** Discord thread "move strips to general mvp?" (Meteor, harasho)

## Problem

The Strips (boon strip) MVP weight is currently in the Offensive MVP category, meaning it only contributes to Offensive MVP scoring. Boon stripping is performed by support-oriented classes like Harbinger that don't fit neatly into the offensive role. Strips should apply to both Offensive and Defensive MVP as a general metric.

## Solution

Rename `offensiveStrips` to `generalStrips` in `IMvpWeights` and move it into the General MVP category. The default weight stays at `1`. Existing user settings are migrated via the `normalizeMvpWeights` fallback chain.

## Files Affected

| File | Change |
|------|--------|
| `src/renderer/global.d.ts` | Rename `offensiveStrips` → `generalStrips` in `IMvpWeights`, `DEFAULT_MVP_WEIGHTS`, and `normalizeMvpWeights`. Add `offensiveStrips` to `LegacyMvpWeights`. |
| `src/renderer/stats/computeStatsAggregation.ts` | Move Strips entry from offensive categories to general categories, reference `generalStrips`. |
| `src/renderer/SettingsView.tsx` | Move Strips slider from Offensive MVP group to General MVP group. |
| `src/renderer/StatsView.tsx` | Update `mvpStatWeightKeys` mapping: `'Strips': 'generalStrips'`. |

## Migration

`normalizeMvpWeights` already handles legacy field names via a fallback chain. The new chain for strips: `input.generalStrips ?? input.offensiveStrips ?? input.strips`. This covers:
- New installs (use default)
- Users with `offensiveStrips` saved (current format)
- Users with legacy `strips` saved (pre-category format)

## What Stays the Same

- Default weight: `1`
- Leaderboard computation for strips
- Strip metric calculation in `dashboardMetrics.ts`
- UI label ("Strips")
- Discord embed output

## Testing

- `npm run validate` for type/lint checks
- `npm run test:unit` for regression
- No new tests needed — this is a category reassignment, not new logic
