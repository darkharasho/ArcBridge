import { Player } from './dpsReportTypes';
import { applySquadStabilityGeneration, computeDownContribution, computeIncomingDisruptions, computeOutgoingCrowdControl, computeSquadBarrier, computeSquadHealing } from './combatMetrics';

export const getPlayerDamage = (player: Player) =>
    player.dpsAll?.[0]?.damage || 0;

export const getPlayerDps = (player: Player) =>
    player.dpsAll?.[0]?.dps || 0;

export const getPlayerCleanses = (player: Player) =>
    (player.support?.[0]?.condiCleanse || 0) + (player.support?.[0]?.condiCleanseSelf || 0);

export const getPlayerStrips = (player: Player) =>
    player.support?.[0]?.boonStrips || 0;

export const getPlayerResurrects = (player: Player) =>
    player.support?.[0]?.resurrects || 0;

export const getPlayerDistanceToTag = (player: Player) => {
    const stats = player.statsAll?.[0];
    const distToCom = stats?.distToCom;
    if (distToCom !== undefined && distToCom !== null) {
        return distToCom;
    }
    return stats?.stackDist || 0;
};

export const getPlayerBreakbarDamage = (player: Player) =>
    player.dpsAll?.[0]?.breakbarDamage || 0;

export const getPlayerDamageTaken = (player: Player) =>
    player.defenses?.[0]?.damageTaken || 0;

export const getPlayerDeaths = (player: Player) =>
    player.defenses?.[0]?.deadCount || 0;

export const getPlayerDodges = (player: Player) =>
    player.defenses?.[0]?.dodgeCount || 0;

export const getPlayerMissed = (player: Player) =>
    player.defenses?.[0]?.missedCount || 0;

export const getPlayerBlocked = (player: Player) =>
    player.defenses?.[0]?.blockedCount || 0;

export const getPlayerEvaded = (player: Player) =>
    player.defenses?.[0]?.evadedCount || 0;

export const getPlayerDownsTaken = (player: Player) =>
    player.defenses?.[0]?.downCount || 0;

export const getTargetStatTotal = (player: Player, field: 'killed' | 'downed' | 'againstDownedCount') => {
    let total = 0;
    const statsTargets = player.statsTargets || [];
    for (const targetStats of statsTargets) {
        if (targetStats && targetStats.length > 0) {
            total += Number((targetStats[0] as any)[field] || 0);
        }
    }
    return total;
};

export const getPlayerDashboardTotals = (player: Player) => ({
    downContrib: computeDownContribution(player),
    cleanses: getPlayerCleanses(player),
    strips: getPlayerStrips(player),
    healing: computeSquadHealing(player),
    barrier: computeSquadBarrier(player),
    cc: computeOutgoingCrowdControl(player),
});

export const getIncomingDisruptions = (player: Player) =>
    computeIncomingDisruptions(player);

export const getPlayerDownContribution = (player: Player) =>
    computeDownContribution(player);

export const getPlayerSquadHealing = (player: Player) =>
    computeSquadHealing(player);

export const getPlayerSquadBarrier = (player: Player) =>
    computeSquadBarrier(player);

export const getPlayerOutgoingCrowdControl = (player: Player) =>
    computeOutgoingCrowdControl(player);

export const applyStabilityGeneration = (
    players: Player[],
    context?: { durationMS?: number; buffMap?: Record<string, any> }
) => applySquadStabilityGeneration(players, context);
