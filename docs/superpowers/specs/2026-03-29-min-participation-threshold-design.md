# Minimum Fight Participation Threshold for Leaderboards & MVP

**Date:** 2026-03-29
**Origin:** Discord thread "Set thresholds for being at the top of the logs?" (Meteor, harasho)

## Problem

Players who participated in only a handful of fights can appear at the top of leaderboards and MVP cards because their averages are computed over fewer fights. For example, a player present in 2 out of 30 logs can top "Closest to Tag" with a misleadingly low average distance. This skews the rankings and doesn't represent consistent performance.

## Solution

Add a configurable **minimum fight participation percentage** setting. Players who participated in fewer than the threshold percentage of selected logs are excluded from leaderboard rankings and MVP scoring. They remain visible in all dense stats tables (Offense, Defense, Support, etc.).

### Setting

- **Field:** `minParticipationPercent: number` added to `IStatsViewSettings`
- **Default:** `0` (all players qualify — preserves current behavior)
- **Range:** 0–100 (integer percentage)
- **Semantics:** A player qualifies if `player.logsJoined >= Math.ceil(totalLogs * (minParticipationPercent / 100))`
- When set to 0, no filtering occurs. When set to 80, a player must appear in at least 80% of selected logs to qualify for leaderboard/MVP positions.

### Aggregation

In `computeStatsAggregation.ts`, after `playerEntries` is built (~line 227), create a filtered list:

```ts
const totalLogs = logs.length;
const minLogs = Math.ceil(totalLogs * (minParticipationPercent / 100));
const leaderboardEntries = minParticipationPercent > 0
    ? playerEntries.filter(({ stat }) => stat.logsJoined >= minLogs)
    : playerEntries;
```

Use `leaderboardEntries` instead of `playerEntries` for:
- All `createLB()` calls (leaderboard construction, ~line 282)
- MVP score computation (~line 408+)

Everything else continues using the full `playerEntries`:
- Dense table rows (Offense, Defense, Support, Healing, etc.)
- Player breakdown sections
- Skill usage data

### Settings UI

Add a slider or numeric input in the Stats section of `SettingsView.tsx`, near the existing MVP weights area. Label: "Min. Fight Participation" with percentage display (e.g., "80%").

## Files Affected

| File | Change |
|------|--------|
| `src/renderer/global.d.ts` | Add `minParticipationPercent: number` to `IStatsViewSettings` and `DEFAULT_STATS_VIEW_SETTINGS` |
| `src/renderer/stats/computeStatsAggregation.ts` | Filter `playerEntries` into `leaderboardEntries` for leaderboard/MVP use |
| `src/renderer/SettingsView.tsx` | Add participation threshold control to Stats settings |

No changes needed to `statsWorker.ts` — it already passes `statsViewSettings` through to `computeStatsAggregation`.

## What Stays the Same

- Dense stats table rows are unaffected — all players appear regardless of participation
- MVP weight system is unchanged — threshold is applied before scoring, not as a weight
- Discord embed output is unaffected — it uses the same leaderboard data
- Web report uses the same aggregation and will inherit the threshold automatically

## Testing

- Unit test: verify that with `minParticipationPercent: 80` and 10 logs, a player with `logsJoined: 7` is excluded from leaderboards but a player with `logsJoined: 8` is included
- Unit test: verify that with `minParticipationPercent: 0`, all players are included (current behavior)
- Unit test: verify filtered players still appear in dense table rows
- Run `npm run validate` for type/lint checks
- Run `npm run test:unit` for regression
