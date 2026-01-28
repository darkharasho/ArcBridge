# Combat Metrics Spec

This document describes the project-defined combat metrics used in the UI,
Discord summaries, and aggregate stats. The intent is to define the metrics
independently from any third-party implementation while staying consistent
with EI JSON inputs.

## Outgoing Crowd Control

We compute a weighted count of crowd control skill hits by scanning each
player's `totalDamageDist` entries. Each skill id is mapped to a coefficient
that normalizes multi-hit effects into a single "CC unit". Only skills that
match the player's profession group (or relics) are counted.

Implementation: `src/shared/combatMetrics.ts` (OUTGOING_CC_SKILLS).

## Incoming Strips and Crowd Control

We compute incoming strips and incoming CC by scanning each player's
`totalDamageTaken` entries. Each skill id is mapped to a coefficient, then
`hits`, `missed`, and `blocked` are multiplied by that coefficient and summed.

Implementation: `src/shared/combatMetrics.ts`
(INCOMING_STRIP_SKILL_WEIGHTS, INCOMING_CC_SKILL_WEIGHTS).

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
