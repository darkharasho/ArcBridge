# Combat Metrics Spec

This document describes the project-defined combat metrics used in the UI,
Discord summaries, and aggregate stats. The intent is to define the metrics
independently from any third-party implementation while staying consistent
with EI JSON inputs. It also records the exact fields and aggregation rules
so the stats dashboard, Discord, and cards produce identical values.

Spec version: `v3` (see `src/shared/metrics-methods.json`).

## Input Contract (EI JSON)

All metrics are derived from the EI JSON payload produced by dps.report. The
minimum fields consumed are:

- `players[*].dpsAll[0].damage`, `players[*].dpsAll[0].dps`, `players[*].dpsAll[0].breakbarDamage`
- `players[*].defenses[0].damageTaken`, `deadCount`, `downCount`,
  `missedCount`, `blockedCount`, `evadedCount`, `dodgeCount`,
  `damageBarrier`, `invulnedCount`
- `players[*].support[0].condiCleanse`, `condiCleanseSelf`, `boonStrips`,
  `resurrects`
- `players[*].statsAll[0].stackDist`, `players[*].statsAll[0].distToCom`
- `players[*].statsTargets[*][0].downContribution`, `killed`, `downed`,
  `againstDownedCount`
- `players[*].extHealingStats.outgoingHealingAllies`
- `players[*].extBarrierStats.outgoingBarrierAllies`
- `players[*].totalDamageDist`, `players[*].totalDamageTaken`
- `players[*].activeTimes`
- `players[*].buffUptimes`, `buffMap`, and `durationMS` for stability generation + mitigation

If any of these are missing, the metric falls back to `0` as defined below.

## Crowd Control & Strips Methodology

The app supports three user-selectable methodologies (default: `count`),
configured in `src/shared/metrics-methods.json`:

1. **Count Events** (`count`)  
   Uses EI summary counts for CC/strips. Best for stable, comparable totals.

2. **Duration (Seconds)** (`duration`)  
   Uses EI summary durations (converted to seconds). Best for impact-weighted
   totals, but units are time not event counts.

3. **Tiered Impact** (`tiered`)  
   Uses average duration per event to apply tiered weights. Best for balancing
   short vs long control with a simple, configurable heuristic.

These methodologies apply to:
- Outgoing CC totals
- Incoming CC totals
- Incoming strips totals

## Outgoing Crowd Control

For each player:
- `count`: `statsAll[0].appliedCrowdControl`
- `duration`: `statsAll[0].appliedCrowdControlDuration / 1000`
- `tiered`: `appliedCrowdControl * tierWeight(avgDurationMs)`

Implementation: `src/shared/combatMetrics.ts` (computeOutgoingCrowdControl).

## Incoming Strips and Crowd Control

For each player:
- Incoming CC uses `defenses[0].receivedCrowdControl` and
  `defenses[0].receivedCrowdControlDuration`.
- Incoming strips use `defenses[0].boonStrips` and `defenses[0].boonStripsTime`.

Method application is the same as outgoing CC (count/duration/tiered).

Implementation: `src/shared/combatMetrics.ts` (computeIncomingDisruptions).

## Cleanses

`cleanses = support[0].condiCleanse + support[0].condiCleanseSelf`.

Implementation: `src/shared/dashboardMetrics.ts` (getPlayerCleanses).

UI note: the Support table can display either **All** (condiCleanse + condiCleanseSelf) or **Squad** (condiCleanse only) via the cleanse-scope toggle. Discord and top summaries use **All**.

## Strips

`strips` uses the configured methodology:
- `count`: `support[0].boonStrips`
- `duration`: `support[0].boonStripsTime / 1000`
- `tiered`: `boonStrips * tierWeight(avgDurationMs)`

Implementation: `src/shared/dashboardMetrics.ts` (getPlayerStrips).

## Down Contribution

Down contribution is the sum of `statsTargets[*][0].downContribution` across
all targets for the player.

Implementation: `src/shared/combatMetrics.ts` (computeDownContribution).

## Squad Barrier and Squad Healing

Squad barrier and healing sum all phases of `extBarrierStats.outgoingBarrierAllies`
and `extHealingStats.outgoingHealingAllies` respectively.

Implementation: `src/shared/combatMetrics.ts` (computeSquadBarrier, computeSquadHealing).

## Stability Generation

Stability generation uses the EI buff data via `getPlayerBoonGenerationMs`
and writes `player.stabGeneration` in seconds.

Implementation: `src/shared/combatMetrics.ts` (applySquadStabilityGeneration).

## Damage and DPS

`damage = dpsAll[0].damage`  
`dps = dpsAll[0].dps`

Implementation: `src/shared/dashboardMetrics.ts` (getPlayerDamage, getPlayerDps).

## Breakbar Damage

`breakbarDamage = dpsAll[0].breakbarDamage`.

Implementation: `src/shared/dashboardMetrics.ts` (getPlayerBreakbarDamage).

## Incoming Damage (Taken)

`damageTaken = defenses[0].damageTaken`.

Implementation: `src/shared/dashboardMetrics.ts` (getPlayerDamageTaken).

Incoming damage per skill (incoming damage distribution) is derived from
`players[*].totalDamageTaken[*]` entries and summed across players for the
squad view. This total can be large for siege skills because it aggregates
all hits and all players (and across multiple logs when viewing aggregates).

## Damage Mitigation

Damage mitigation is a composite score used for the Discord and UI "Damage
Mitigation" top list. It combines three sources:

1. **Barrier absorbed**  
   `defenses[0].damageBarrier`

2. **Damage reduction estimate (WvW-allowed skills/buffs)**  
   `damageTaken * sum(uptime% * reduction)`  
   where uptime% is `buffUptimes[*].buffData[0].uptime` and reductions are
   known values for:
   - Protection: 33% strike damage reduction
   - Frost Aura: 10% strike damage reduction
   - Rite of the Great Dwarf: 50% damage reduction

   The WvW allowlist uses these skill names (matched via `buffMap` by id/name):

   - Frost Aura, Frozen Ground, Dual Orbits (Air+Earth, Fire+Earth, Water+Earth),
     Grinding Stones, Rocky Loop
   - Explosive Thrust, Steel Divide, Swift Cut
   - Restorative Glow, Infusing Terror
   - Perilous Gift, Resilient Weapon
   - Signet of Judgment, Forced Engagement, Vengeful Hammers, Endure Pain,
     Spectrum Shield, Barrier Signet, "Guard!", Dolyak Stance, "Flash-Freeze!",
     "Rise!"
   - Daring Advance, Rite of the Great Dwarf, Rampage, "Rebound!", Weave Self
   - Ancient Echo, Facet of Nature, Full Counter, Drink Ambrosia,
     Throw Enchanted Ice, Enter Shadow Shroud, Death Shroud, Reaper's Shroud,
     Ritualist's Shroud
   - Lesser "Guard!"

   Only skills with known reduction values contribute to the estimated reduction.
   The rest are tracked for uptime/audit.

3. **Outgoing damage reduction per hit (tracked only)**  
   Uptime is tracked for: Eternity's Requiem, Lesser Volcano, Meteor Shower,
   Volcano, Lightning Orb, Mirror Blade, Frost Storm, Invoke Lightning,
   Ice Storm, Lightning Storm. These do not affect the mitigation total
   until reduction values are defined.

   Buffs are matched by id/name using `buffMap`, and the summed reduction
   fraction is clamped to `0..1`.

3. **Blocked/Invuln prevention (estimate)**  
   `(blockedCount + invulnedCount) * averageIncomingHitDamage`  
   where `averageIncomingHitDamage` is computed from
   `totalDamageTaken[*].totalDamage / totalDamageTaken[*].connectedHits`.

Total mitigation:

`damageMitigation = barrierAbsorbed + estimatedReduction + preventedFromBlocks`

Implementation: `src/shared/combatMetrics.ts` (computeDamageMitigation).

## Deaths / Downs (Taken)

`deaths = defenses[0].deadCount`  
`downsTaken = defenses[0].downCount`

Implementation: `src/shared/dashboardMetrics.ts` (getPlayerDeaths, getPlayerDownsTaken).

## Dodges / Misses / Blocks / Evades (Taken)

`dodges = defenses[0].dodgeCount`  
`missed = defenses[0].missedCount`  
`blocked = defenses[0].blockedCount`  
`evaded = defenses[0].evadedCount`

Implementation: `src/shared/dashboardMetrics.ts`
(getPlayerDodges, getPlayerMissed, getPlayerBlocked, getPlayerEvaded).

## Resurrects

`resurrects = support[0].resurrects`.

Implementation: `src/shared/dashboardMetrics.ts` (getPlayerResurrects).

## Distance to Tag

`distanceToTag = statsAll[0].distToCom` if present; otherwise use
`statsAll[0].stackDist`; otherwise `0`.

Implementation: `src/shared/dashboardMetrics.ts` (getPlayerDistanceToTag).

## Kills / Downs / Against Downed (Target Stats)

For each player, aggregate from `statsTargets[*][0]`:

- `killed`
- `downed`
- `againstDownedCount`

Implementation: `src/shared/dashboardMetrics.ts` (getTargetStatTotal).

## Known Caveats

- EI JSON versions can add/remove fields; missing fields always fall back to `0`.
- `distToCom` and `stackDist` are not guaranteed to exist in every log; `distanceToTag` may be `0`.
- Incoming CC/strips use weighted skill mappings; mismatches can occur if EI changes skill ids or hit accounting.
- Stability generation depends on buff metadata presence (`buffMap`) and correct `durationMS`.
- Damage uses `dpsAll[0].damage` (player total) rather than summing per-target totals, which may differ when targets are filtered or merged.
