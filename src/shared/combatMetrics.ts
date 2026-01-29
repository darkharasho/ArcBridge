import { Player } from './dpsReportTypes';
import { getPlayerBoonGenerationMs } from './boonGeneration';
import { DisruptionMethod, METRICS_SPEC, DEFAULT_DISRUPTION_METHOD } from './metricsSettings';

const toSeconds = (ms: number) => (ms || 0) / 1000;

const applyTierWeight = (count: number, durationMs: number) => {
    if (!count) return 0;
    const tiers = METRICS_SPEC.methods.tiered?.tiers;
    if (!tiers) return count;
    const avg = durationMs / Math.max(count, 1);
    if (avg <= tiers.shortMs) return count * tiers.weights.short;
    if (avg <= tiers.mediumMs) return count * tiers.weights.medium;
    return count * tiers.weights.long;
};

export const resolveDisruptionValue = (count: number, durationMs: number, method: DisruptionMethod) => {
    if (method === 'duration') return toSeconds(durationMs);
    if (method === 'tiered') return applyTierWeight(count, durationMs);
    return count;
};

export function computeOutgoingCrowdControl(player: Player, method: DisruptionMethod = DEFAULT_DISRUPTION_METHOD): number {
    const stats = player.statsAll?.[0] as any;
    const count = Number(stats?.appliedCrowdControl ?? 0);
    const durationMs = Number(stats?.appliedCrowdControlDuration ?? 0);

    return resolveDisruptionValue(count, durationMs, method);
}

export function computeIncomingDisruptions(
    player: Player,
    method: DisruptionMethod = DEFAULT_DISRUPTION_METHOD,
): { strips: { total: number; missed: number; blocked: number }; cc: { total: number; missed: number; blocked: number } } {
    const defenses = player.defenses?.[0] as any;

    const incomingCcCount = Number(defenses?.receivedCrowdControl ?? 0);
    const incomingCcDurationMs = Number(defenses?.receivedCrowdControlDuration ?? 0);
    const incomingStripCount = Number(defenses?.boonStrips ?? 0);
    const incomingStripDurationMs = Number(defenses?.boonStripsTime ?? 0);

    const resolveValue = (count: number, durationMs: number) => resolveDisruptionValue(count, durationMs, method);

    return {
        strips: {
            total: resolveValue(incomingStripCount, incomingStripDurationMs),
            missed: 0,
            blocked: 0,
        },
        cc: {
            total: resolveValue(incomingCcCount, incomingCcDurationMs),
            missed: 0,
            blocked: 0,
        }
    };
}

// Global pass function
export function applySquadStabilityGeneration(
    players: Player[],
    context?: { durationMS?: number; buffMap?: Record<string, any> }
) {
    const durationMs = context?.durationMS || 0;
    const buffMap = context?.buffMap || {};
    const squadPlayers = players.filter((p) => !p.notInSquad);
    const squadCount = squadPlayers.length;
    const groupCounts = new Map<number, number>();

    squadPlayers.forEach((player) => {
        const group = player.group ?? 0;
        groupCounts.set(group, (groupCounts.get(group) || 0) + 1);
    });

    squadPlayers.forEach((player) => {
        const groupCount = groupCounts.get(player.group ?? 0) || 1;
        const self = getPlayerBoonGenerationMs(
            player,
            'selfBuffs',
            1122,
            durationMs,
            groupCount,
            squadCount,
            buffMap,
        );
        const squad = getPlayerBoonGenerationMs(
            player,
            'squadBuffs',
            1122,
            durationMs,
            groupCount,
            squadCount,
            buffMap,
        );
        player.stabGeneration = (self.generationMs + squad.generationMs) / 1000;
    });
}

export function computeDownContribution(player: Player): number {
    if (!player.statsTargets) return 0;
    let total = 0;
    for (const targetStats of player.statsTargets) {
        if (targetStats && targetStats.length > 0) {
            total += (targetStats[0] as any).downContribution || 0;
        }
    }
    return total;
}

export function computeSquadBarrier(player: Player): number {
    if (!player.extBarrierStats || !player.extBarrierStats.outgoingBarrierAllies) return 0;

    let total = 0;
    for (const squadMember of player.extBarrierStats.outgoingBarrierAllies) {
        if (!squadMember) continue;
        for (const phaseData of squadMember) {
            if (phaseData) {
                total += (phaseData as any).barrier || 0;
            }
        }
    }
    return total;
}

export function computeSquadHealing(player: Player): number {
    if (!player.extHealingStats || !player.extHealingStats.outgoingHealingAllies) return 0;

    let total = 0;
    for (const squadMember of player.extHealingStats.outgoingHealingAllies) {
        if (!squadMember) continue;
        for (const phaseData of squadMember) {
            if (phaseData) {
                total += (phaseData as any).healing || 0;
            }
        }
    }
    return total;
}

export function computeSquadDownedHealing(player: Player): number {
    if (!player.extHealingStats || !player.extHealingStats.outgoingHealingAllies) return 0;

    let total = 0;
    for (const squadMember of player.extHealingStats.outgoingHealingAllies) {
        if (!squadMember) continue;
        for (const phaseData of squadMember) {
            if (phaseData) {
                total += (phaseData as any).downedHealing || 0;
            }
        }
    }
    return total;
}

type DamageReductionSource = {
    id?: number;
    name: string;
    reduction?: number;
    perHit?: boolean;
};

const INCOMING_DAMAGE_REDUCTION_SOURCES: DamageReductionSource[] = [
    { id: 717, name: 'Protection', reduction: 0.33 },
    { id: 5579, name: 'Frost Aura', reduction: 0.1 },
    { name: 'Frozen Ground' },
    { name: 'Dual Orbits: Air and Earth' },
    { name: 'Dual Orbits: Fire and Earth' },
    { name: 'Dual Orbits: Water and Earth' },
    { name: 'Grinding Stones' },
    { name: 'Rocky Loop' },
    { name: 'Explosive Thrust' },
    { name: 'Steel Divide' },
    { name: 'Swift Cut' },
    { name: 'Restorative Glow' },
    { name: 'Infusing Terror' },
    { name: 'Perilous Gift' },
    { name: 'Resilient Weapon' },
    { name: 'Signet of Judgment' },
    { name: 'Forced Engagement' },
    { name: 'Vengeful Hammers' },
    { name: 'Endure Pain' },
    { name: 'Spectrum Shield' },
    { name: 'Barrier Signet' },
    { name: '"Guard!"' },
    { name: 'Dolyak Stance' },
    { name: '"Flash-Freeze!"' },
    { name: '"Rise!"' },
    { name: 'Daring Advance' },
    { name: 'Rite of the Great Dwarf', reduction: 0.5 },
    { name: 'Rampage' },
    { name: '"Rebound!"' },
    { name: 'Weave Self' },
    { name: 'Ancient Echo' },
    { name: 'Facet of Nature' },
    { name: 'Full Counter' },
    { name: 'Drink Ambrosia' },
    { name: 'Throw Enchanted Ice' },
    { name: 'Enter Shadow Shroud' },
    { name: 'Death Shroud' },
    { name: "Reaper's Shroud" },
    { name: "Ritualist's Shroud" },
    { name: 'Lesser "Guard!"' },
];

const PER_HIT_DAMAGE_REDUCTION_SOURCES: DamageReductionSource[] = [
    { name: "Eternity's Requiem", perHit: true },
    { name: 'Lesser Volcano', perHit: true },
    { name: 'Meteor Shower', perHit: true },
    { name: 'Volcano', perHit: true },
    { name: 'Lightning Orb', perHit: true },
    { name: 'Mirror Blade', perHit: true },
    { name: 'Frost Storm', perHit: true },
    { name: 'Invoke Lightning', perHit: true },
    { name: 'Ice Storm', perHit: true },
    { name: 'Lightning Storm', perHit: true },
];

const normalizeBuffName = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const getBuffName = (buffMap: Record<string, any> | undefined, id: number) => {
    if (!buffMap) return null;
    const entry = buffMap[`b${id}`] || buffMap[`${id}`];
    if (entry?.name) return String(entry.name);
    return null;
};

const getBuffUptimePercent = (
    player: Player,
    buffMap: Record<string, any> | undefined,
    target: { id?: number; name: string },
) => {
    if (!player.buffUptimes || player.buffUptimes.length === 0) return 0;
    const targetName = normalizeBuffName(target.name);
    for (const buff of player.buffUptimes) {
        if (target.id !== undefined && buff.id === target.id) {
            return Number(buff.buffData?.[0]?.uptime ?? 0);
        }
        const name = getBuffName(buffMap, buff.id);
        if (name && normalizeBuffName(name).includes(targetName)) {
            return Number(buff.buffData?.[0]?.uptime ?? 0);
        }
    }
    return 0;
};

const getAverageIncomingHitDamage = (player: Player) => {
    if (!player.totalDamageTaken || player.totalDamageTaken.length === 0) return 0;
    let totalDamage = 0;
    let totalHits = 0;
    for (const entries of player.totalDamageTaken) {
        for (const entry of entries || []) {
            if (!entry) continue;
            totalDamage += Number(entry.totalDamage ?? 0);
            totalHits += Number(entry.connectedHits ?? 0);
        }
    }
    if (!totalHits) return 0;
    return totalDamage / totalHits;
};

export const computeDamageMitigationBreakdown = (
    player: Player,
    context?: { buffMap?: Record<string, any> },
) => {
    const buffMap = context?.buffMap;
    const damageTaken = Number(player.defenses?.[0]?.damageTaken ?? 0);
    const barrierAbsorbed = Number(player.defenses?.[0]?.damageBarrier ?? 0);
    const blockedCount = Number(player.defenses?.[0]?.blockedCount ?? 0);
    const invulnCount = Number(player.defenses?.[0]?.invulnedCount ?? 0);
    const averageHit = getAverageIncomingHitDamage(player);

    let reductionFraction = 0;
    const reductions: Record<string, number> = {};
    const perHitReductions: Record<string, number> = {};
    INCOMING_DAMAGE_REDUCTION_SOURCES.forEach((source) => {
        const uptimePercent = getBuffUptimePercent(player, buffMap, source);
        const uptimeFraction = Math.max(0, Math.min(1, uptimePercent / 100));
        if (source.reduction !== undefined) {
            reductionFraction += uptimeFraction * source.reduction;
        }
        reductions[source.name] = uptimePercent;
    });
    PER_HIT_DAMAGE_REDUCTION_SOURCES.forEach((source) => {
        const uptimePercent = getBuffUptimePercent(player, buffMap, source);
        perHitReductions[source.name] = uptimePercent;
    });
    reductionFraction = Math.max(0, Math.min(1, reductionFraction));

    const estimatedReduction = damageTaken * reductionFraction;
    const preventedFromBlocks = (blockedCount + invulnCount) * averageHit;
    const total = barrierAbsorbed + estimatedReduction + preventedFromBlocks;

    return {
        total,
        barrierAbsorbed,
        damageTaken,
        reductionFraction,
        estimatedReduction,
        averageHit,
        blockedCount,
        invulnCount,
        preventedFromBlocks,
        reductionUptimes: reductions,
        reductionPerHitUptimes: perHitReductions,
    };
};

export const computeDamageMitigation = (
    player: Player,
    context?: { buffMap?: Record<string, any> },
) => computeDamageMitigationBreakdown(player, context).total;
