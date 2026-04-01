# Player Breakdown: Casts, Hits, and Hits/Cast

**Date:** 2026-03-31
**Source:** Discord thread "Player Breakdown Total Hits" (JaxBlake)

## Summary

Add Casts, Hits, and Hits/Cast metrics to the player breakdown skill drill-down. Currently the drill-down shows Down Contribution, Total Damage, DPS, Min Hit, Avg Hit, and Max Hit. The new metrics let players evaluate skill usage efficiency — e.g., whether a Druid is landing Celestial Avatar auto-attack chains.

## Data Model

Add a `casts` field to `PlayerSkillDamageEntry` in `src/renderer/stats/statsTypes.ts`:

```typescript
export interface PlayerSkillDamageEntry {
    id: string;
    name: string;
    icon?: string;
    damage: number;
    downContribution: number;
    hits: number;
    casts: number;    // from rotation data
    min: number;
    max: number;
}
```

## Aggregation

In `src/renderer/stats/computePlayerAggregation.ts`, after the existing skill damage extraction from `totalDamageDist`/`targetDamageDist` (~line 1089), loop over `p.rotation` to accumulate cast counts into the matching `PlayerSkillDamageEntry`:

```typescript
if (Array.isArray(p.rotation)) {
    p.rotation.forEach((rot: any) => {
        if (!rot?.id) return;
        const count = rot.skills?.length || 0;
        if (count <= 0) return;
        const skillId = `s${rot.id}`;
        const skillEntry = playerBreakdown.skills.get(skillId);
        if (skillEntry) {
            skillEntry.casts += count;
        }
    });
}
```

- Only skills already present in the damage breakdown receive cast counts.
- Skills in rotation but not in damage dist are ignored (they didn't deal damage).
- Skills in damage dist but not in rotation (condition ticks, proc damage, minion skills) keep `casts: 0`.

The `casts` field is initialized to `0` alongside the other fields in the `pushPlayerSkillEntry` function (~line 1016).

## UI

In `src/renderer/stats/sections/PlayerBreakdownSection.tsx`, add three new rows to the metric array (lines 569–590), placed after Max Hit:

| Metric | Value | Notes |
|--------|-------|-------|
| Casts | `activePlayerSkill.casts` | Direct from aggregated data |
| Hits | `activePlayerSkill.hits` | Already tracked, now displayed explicitly |
| Hits / Cast | `hits / casts` | Show "—" when casts is 0 |

Format Casts and Hits with `formatTopStatValue`. Format Hits/Cast with `formatWithCommas(value, 2)` for two decimal places.

## Edge Cases

- **Casts = 0** (condition ticks, proc damage, minion skills): Show "0" for Casts, actual hit count for Hits, "—" for Hits/Cast.
- **Aggregation across multiple logs**: Casts accumulate naturally across logs, same as hits and damage.
- **No rotation data in log**: `casts` stays 0, same handling as above.

## Files Changed

1. `src/renderer/stats/statsTypes.ts` — add `casts` field to `PlayerSkillDamageEntry`
2. `src/renderer/stats/computePlayerAggregation.ts` — initialize `casts: 0`, populate from `p.rotation`
3. `src/renderer/stats/sections/PlayerBreakdownSection.tsx` — add Casts, Hits, Hits/Cast metric rows

## Testing

- Existing `computeStatsAggregation.skillDamage.test.ts` should be extended to verify `casts` aggregation.
- Verify that skills with rotation data get correct cast counts.
- Verify that skills without rotation data (conditions, procs) show `casts: 0`.
