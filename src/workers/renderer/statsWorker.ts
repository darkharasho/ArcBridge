/// <reference lib="webworker" />

import { applyStabilityGeneration, getPlayerCleanses, getPlayerStrips, getPlayerDownContribution, getPlayerSquadHealing, getPlayerSquadBarrier, getPlayerOutgoingCrowdControl, getTargetStatTotal } from '../../shared/dashboardMetrics';
import { Player, Target } from '../../shared/dpsReportTypes';
import { getProfessionColor } from '../../shared/professionUtils';
import { buildBoonTables } from '../../shared/boonGeneration';
import { computeOutgoingConditions, resolveConditionNameFromEntry } from '../../shared/conditionsMetrics';
import type { StatsWorkerRequest, StatsWorkerResponse, StatsWorkerInput, ILogData } from './types';
import type { DisruptionMethod, IMvpWeights, IStatsViewSettings } from '../../renderer/global.d';

const ctx: Worker = self as unknown as Worker;

const sendResponse = (response: StatsWorkerResponse) => {
    ctx.postMessage(response);
};

const sendProgress = (id: string, percent: number, stage: string) => {
    sendResponse({ type: 'PROGRESS', id, percent, stage });
};

const computeStats = (
    logs: ILogData[],
    mvpWeights: IMvpWeights,
    statsViewSettings: IStatsViewSettings,
    disruptionMethod: DisruptionMethod
) => {
    const validLogs = logs.filter(log => log.details && !log.error);
    const total = validLogs.length;

    if (total === 0) {
        return createEmptyStats();
    }

    // Initialize aggregation variables
    let wins = 0;
    let losses = 0;

    interface PlayerStats {
        name: string;
        account: string;
        downContrib: number;
        cleanses: number;
        strips: number;
        stab: number;
        healing: number;
        barrier: number;
        cc: number;
        logsJoined: number;
        totalDist: number;
        distCount: number;
        dodges: number;
        downs: number;
        deaths: number;
        totalFightMs: number;
        offenseTotals: Record<string, number>;
        offenseRateWeights: Record<string, number>;
        defenseActiveMs: number;
        defenseTotals: Record<string, number>;
        supportActiveMs: number;
        supportTotals: Record<string, number>;
        healingActiveMs: number;
        healingTotals: Record<string, number>;
        profession: string;
        professions: Set<string>;
        professionList?: string[];
        professionTimeMs: Record<string, number>;
        isCommander: boolean;
        damage: number;
        dps: number;
        revives: number;
        outgoingConditions: Record<string, {
            applications: number;
            damage: number;
            skills: Record<string, { name: string; hits: number; damage: number }>;
            applicationsFromBuffs?: number;
        }>;
        incomingConditions: Record<string, {
            applications: number;
            damage: number;
            skills: Record<string, { name: string; hits: number; damage: number }>;
        }>;
    }

    const playerStats = new Map<string, PlayerStats>();
    const supportTimeSanityFields = new Set(['boonStripsTime', 'condiCleanseTime', 'condiCleanseTimeSelf']);

    const skillDamageMap: Record<number, { name: string, damage: number, hits: number }> = {};
    const outgoingCondiTotals: Record<string, { name: string; applications: number; damage: number; applicationsFromBuffs?: number }> = {};
    const incomingCondiTotals: Record<string, { name: string; applications: number; damage: number }> = {};
    const incomingSkillDamageMap: Record<number, { name: string, damage: number, hits: number }> = {};

    let totalSquadSizeAccum = 0;
    let totalEnemiesAccum = 0;
    let totalSquadDeaths = 0;
    let totalSquadKills = 0;
    let totalEnemyDeaths = 0;
    let totalEnemyKills = 0;

    const mapCounts: Record<string, number> = {};

    // Process each log
    validLogs.forEach((log, logIndex) => {
        const details = log.details;
        if (!details) return;

        const players = details.players as unknown as Player[];
        const targets = details.targets || [];
        const conditionDetails = log.eiDetails || details;
        const conditionPlayers = (conditionDetails?.players as unknown as Player[]) || players;
        const conditionTargets = conditionDetails?.targets || targets;
        const conditionSkillMap = conditionDetails?.skillMap || details.skillMap;
        const conditionBuffMap = conditionDetails?.buffMap || details.buffMap;
        const replayMeta = (details as any).combatReplayMetaData || {};
        const inchesToPixel = typeof replayMeta?.inchToPixel === 'number' && replayMeta.inchToPixel > 0
            ? replayMeta.inchToPixel
            : 1;
        const pollingRate = typeof replayMeta?.pollingRate === 'number' && replayMeta.pollingRate > 0
            ? replayMeta.pollingRate
            : 1;

        const durationMs = details.durationMS || 0;
        const durationSec = durationMs / 1000;

        // Map tracking
        const mapName = typeof details.fightName === 'string' ? details.fightName : 'Unknown';
        mapCounts[mapName] = (mapCounts[mapName] || 0) + 1;

        // Squad size tracking
        const squadPlayers = players.filter((p: any) => !p.notInSquad);
        const nonFakeTargets = targets.filter((t: any) => !t.isFake);
        totalSquadSizeAccum += squadPlayers.length;
        totalEnemiesAccum += nonFakeTargets.length;

        // Win/loss determination
        const isSuccess = details.success === true;
        if (isSuccess) {
            wins++;
        } else {
            losses++;
        }

        // Process players
        players.forEach((player: any) => {
            if (player.notInSquad) return;

            const account = player.account || 'Unknown';
            const profession = player.profession || 'Unknown';
            const durationMs = details.durationMS || 0;

            let stat = playerStats.get(account);
            if (!stat) {
                stat = {
                    name: player.name || account,
                    account,
                    downContrib: 0,
                    cleanses: 0,
                    strips: 0,
                    stab: 0,
                    healing: 0,
                    barrier: 0,
                    cc: 0,
                    logsJoined: 0,
                    totalDist: 0,
                    distCount: 0,
                    dodges: 0,
                    downs: 0,
                    deaths: 0,
                    totalFightMs: 0,
                    offenseTotals: {},
                    offenseRateWeights: {},
                    defenseActiveMs: 0,
                    defenseTotals: {},
                    supportActiveMs: 0,
                    supportTotals: {},
                    healingActiveMs: 0,
                    healingTotals: {},
                    profession,
                    professions: new Set(),
                    professionTimeMs: {},
                    isCommander: false,
                    damage: 0,
                    dps: 0,
                    revives: 0,
                    outgoingConditions: {},
                    incomingConditions: {}
                };
                playerStats.set(account, stat);
            }

            stat.logsJoined++;
            stat.totalFightMs += durationMs;
            stat.professions.add(profession);
            stat.professionTimeMs[profession] = (stat.professionTimeMs[profession] || 0) + durationMs;

            if (player.hasCommanderTag) {
                stat.isCommander = true;
            }

            // Aggregate metrics
            stat.cleanses += getPlayerCleanses(player);
            stat.strips += getPlayerStrips(player);
            stat.downContrib += getPlayerDownContribution(player, targets, disruptionMethod);
            stat.healing += getPlayerSquadHealing(player);
            stat.barrier += getPlayerSquadBarrier(player);
            stat.cc += getPlayerOutgoingCrowdControl(player, targets);
            stat.stab += applyStabilityGeneration(player);

            // Defense stats
            const defenseStats = player.defenses?.[0] || {};
            stat.dodges += Number(defenseStats.dodgeCount || 0);
            stat.deaths += Number(defenseStats.deadCount || 0);
            stat.downs += Number(defenseStats.downCount || 0);

            // Damage and DPS
            const dpsAll = player.dpsAll?.[0] || {};
            stat.damage += Number(dpsAll.damage || 0);

            // Support stats
            const support = player.support?.[0] || {};
            stat.revives += Number(support.resurrects || 0);

            // Distance to tag
            const statsAll = player.statsAll?.[0] || {};
            const distToCom = statsAll.distToCom;
            if (distToCom !== undefined && distToCom !== null && distToCom !== 'Infinity') {
                const dist = Number(distToCom);
                if (Number.isFinite(dist)) {
                    stat.totalDist += dist;
                    stat.distCount++;
                }
            }
        });

        // Outgoing conditions
        if (conditionPlayers && conditionTargets) {
            try {
                const conditionResult = computeOutgoingConditions({
                    players: conditionPlayers,
                    targets: conditionTargets,
                    skillMap: conditionSkillMap,
                    buffMap: conditionBuffMap
                });

                Object.entries(conditionResult.playerConditions).forEach(([account, conditions]) => {
                    const stat = playerStats.get(account);
                    if (!stat) return;
                    Object.entries(conditions).forEach(([conditionName, data]) => {
                        if (!stat.outgoingConditions[conditionName]) {
                            stat.outgoingConditions[conditionName] = {
                                applications: 0,
                                damage: 0,
                                skills: {}
                            };
                        }
                        stat.outgoingConditions[conditionName].applications += data.applications;
                        stat.outgoingConditions[conditionName].damage += data.damage;
                        if (data.applicationsFromBuffs) {
                            stat.outgoingConditions[conditionName].applicationsFromBuffs =
                                (stat.outgoingConditions[conditionName].applicationsFromBuffs || 0) + data.applicationsFromBuffs;
                        }
                    });
                });

                Object.entries(conditionResult.summary).forEach(([conditionName, data]) => {
                    if (!outgoingCondiTotals[conditionName]) {
                        outgoingCondiTotals[conditionName] = { name: conditionName, applications: 0, damage: 0 };
                    }
                    outgoingCondiTotals[conditionName].applications += data.applications;
                    outgoingCondiTotals[conditionName].damage += data.damage;
                    if (data.applicationsFromBuffs) {
                        outgoingCondiTotals[conditionName].applicationsFromBuffs =
                            (outgoingCondiTotals[conditionName].applicationsFromBuffs || 0) + data.applicationsFromBuffs;
                    }
                });
            } catch (err) {
                console.warn('[StatsWorker] Condition computation failed:', err);
            }
        }

        // Track kills/deaths
        nonFakeTargets.forEach((target: any) => {
            const killed = target.healthPercentBurned >= 100 || target.defenses?.[0]?.deadCount > 0;
            if (killed) {
                totalSquadKills++;
                totalEnemyDeaths++;
            }
        });

        squadPlayers.forEach((player: any) => {
            const deathCount = player.defenses?.[0]?.deadCount || 0;
            totalSquadDeaths += deathCount;
            totalEnemyKills += deathCount;
        });
    });

    // Calculate averages
    const avgSquadSize = total > 0 ? Math.round(totalSquadSizeAccum / total) : 0;
    const avgEnemies = total > 0 ? Math.round(totalEnemiesAccum / total) : 0;

    // Calculate DPS for each player
    playerStats.forEach((stat) => {
        if (stat.totalFightMs > 0) {
            stat.dps = Math.round(stat.damage / (stat.totalFightMs / 1000));
        }
        // Set main profession (longest played)
        let maxTime = 0;
        stat.professions.forEach((prof) => {
            const time = stat.professionTimeMs[prof] || 0;
            if (time > maxTime) {
                maxTime = time;
                stat.profession = prof;
            }
        });
        stat.professionList = Array.from(stat.professions);
    });

    // Top stats
    let maxDownContrib = { value: 0, player: '', count: 0, profession: 'Unknown', professionList: [] as string[] };
    let maxCleanses = { value: 0, player: '', count: 0, profession: 'Unknown', professionList: [] as string[] };
    let maxStrips = { value: 0, player: '', count: 0, profession: 'Unknown', professionList: [] as string[] };
    let maxStab = { value: 0, player: '', count: 0, profession: 'Unknown', professionList: [] as string[] };
    let maxHealing = { value: 0, player: '', count: 0, profession: 'Unknown', professionList: [] as string[] };
    let maxBarrier = { value: 0, player: '', count: 0, profession: 'Unknown', professionList: [] as string[] };
    let maxCC = { value: 0, player: '', count: 0, profession: 'Unknown', professionList: [] as string[] };
    let maxDodges = { value: 0, player: '', count: 0, profession: 'Unknown', professionList: [] as string[] };
    let maxDamage = { value: 0, player: '', count: 0, profession: 'Unknown', professionList: [] as string[] };
    let maxDps = { value: 0, player: '', count: 0, profession: 'Unknown', professionList: [] as string[] };
    let maxRevives = { value: 0, player: '', count: 0, profession: 'Unknown', professionList: [] as string[] };
    let closestToTag = { value: 999999, player: '', count: 0, profession: 'Unknown', professionList: [] as string[] };
    let maxLogsJoined = 0;

    const playerEntries = Array.from(playerStats.entries()).map(([key, stat]) => ({ key, stat }));

    playerEntries.forEach(({ stat }) => {
        const pInfo = { player: stat.account, count: stat.logsJoined, profession: stat.profession, professionList: stat.professionList || [] };

        if (stat.downContrib > maxDownContrib.value) maxDownContrib = { value: stat.downContrib, ...pInfo };
        if (stat.cleanses > maxCleanses.value) maxCleanses = { value: stat.cleanses, ...pInfo };
        if (stat.strips > maxStrips.value) maxStrips = { value: stat.strips, ...pInfo };
        if (stat.stab > maxStab.value) maxStab = { value: stat.stab, ...pInfo };
        if (stat.healing > maxHealing.value) maxHealing = { value: stat.healing, ...pInfo };
        if (stat.barrier > maxBarrier.value) maxBarrier = { value: stat.barrier, ...pInfo };
        if (stat.cc > maxCC.value) maxCC = { value: stat.cc, ...pInfo };
        if (stat.dodges > maxDodges.value) maxDodges = { value: stat.dodges, ...pInfo };
        if (stat.damage > maxDamage.value) maxDamage = { value: stat.damage, ...pInfo };
        if (stat.dps > maxDps.value) maxDps = { value: stat.dps, ...pInfo };
        if (stat.revives > maxRevives.value) maxRevives = { value: stat.revives, ...pInfo };
        if (stat.logsJoined > maxLogsJoined) maxLogsJoined = stat.logsJoined;

        if (!stat.isCommander && stat.distCount > 0) {
            const avgDist = stat.totalDist / stat.distCount;
            if (avgDist > 0 && avgDist < closestToTag.value) {
                closestToTag = { value: avgDist, ...pInfo };
            }
        }
    });

    if (closestToTag.value === 999999) closestToTag.value = 0;

    // MVP calculation
    let mvp = null as any;
    let silver = null as any;
    let bronze = null as any;
    let avgMvpScore = 0;
    const leaderboards: any = {};

    if (statsViewSettings.showMvp && playerStats.size > 0) {
        const weights = mvpWeights;
        const scoreBreakdown: any[] = [];
        let totalScoreSum = 0;

        playerEntries.forEach(({ stat }) => {
            let score = 0;
            const contributions: { name: string; ratio: number; fmt: string; rank: number }[] = [];

            const check = (val: number, max: number, name: string, weight: number, lb?: any[]) => {
                if (max <= 0 || !Number.isFinite(val)) return;
                const ratio = val / max;
                const contribution = ratio * weight;
                score += contribution;
                const rank = lb ? (lb.findIndex((e: any) => e.account === stat.account) + 1) : 0;
                contributions.push({ name, ratio, fmt: `${Math.round(val)}`, rank });
            };

            check(stat.downContrib, maxDownContrib.value, 'Down Contribution', weights.downContribution);
            check(stat.cleanses, maxCleanses.value, 'Cleanses', weights.cleanses);
            check(stat.strips, maxStrips.value, 'Strips', weights.strips);
            check(stat.stab, maxStab.value, 'Stability', weights.stability);
            check(stat.healing, maxHealing.value, 'Healing', weights.healing);
            check(stat.barrier, maxBarrier.value, 'Barrier', weights.healing);
            check(stat.cc, maxCC.value, 'CC', weights.cc);
            check(stat.revives, maxRevives.value, 'Revives', weights.revives);
            check(stat.logsJoined, maxLogsJoined, 'Participation', weights.participation);
            check(stat.dodges, maxDodges.value, 'Dodging', weights.dodging);
            check(stat.dps, maxDps.value, 'DPS', weights.dps);
            check(stat.damage, maxDamage.value, 'Damage', weights.damage);

            totalScoreSum += score;

            contributions.sort((a, b) => b.ratio - a.ratio);
            const top3 = contributions.slice(0, 3);

            let reason = 'Consistent all-round performance';
            if (top3.length > 0) {
                const best = top3[0];
                if (best.ratio >= 1) {
                    reason = `Top Rank in ${best.name}`;
                } else if (best.ratio > 0.8) {
                    reason = `High ${best.name} & ${top3[1]?.name || 'Performance'}`;
                }
            }

            scoreBreakdown.push({
                player: stat.name,
                account: stat.account,
                profession: stat.profession,
                professionList: stat.professionList,
                score,
                reason,
                topStats: top3.map(c => ({ name: c.name, val: c.fmt, ratio: c.rank }))
            });
        });

        scoreBreakdown.sort((a, b) => b.score - a.score);
        silver = scoreBreakdown[1];
        bronze = scoreBreakdown[2];

        if (scoreBreakdown[0]) {
            const top = scoreBreakdown[0];
            mvp = {
                player: top.player,
                account: top.account,
                reason: top.reason,
                score: top.score,
                profession: top.profession,
                professionList: top.professionList || [],
                color: getProfessionColor(top.profession),
                topStats: top.topStats
            };
        }

        avgMvpScore = playerStats.size > 0 ? totalScoreSum / playerStats.size : 0;
    }

    // Build offense/defense/support/healing player lists
    const offensePlayers = playerEntries.map(({ stat }) => ({
        account: stat.account,
        profession: stat.profession,
        professionList: stat.professionList,
        damage: stat.damage,
        dps: stat.dps,
        logsJoined: stat.logsJoined
    })).sort((a, b) => b.damage - a.damage);

    const defensePlayers = playerEntries.map(({ stat }) => ({
        account: stat.account,
        profession: stat.profession,
        professionList: stat.professionList,
        dodges: stat.dodges,
        downs: stat.downs,
        deaths: stat.deaths,
        logsJoined: stat.logsJoined
    })).sort((a, b) => a.deaths - b.deaths);

    const supportPlayers = playerEntries.map(({ stat }) => ({
        account: stat.account,
        profession: stat.profession,
        professionList: stat.professionList,
        cleanses: stat.cleanses,
        strips: stat.strips,
        revives: stat.revives,
        logsJoined: stat.logsJoined
    })).sort((a, b) => (b.cleanses + b.strips) - (a.cleanses + a.strips));

    const healingPlayers = playerEntries.map(({ stat }) => ({
        account: stat.account,
        profession: stat.profession,
        professionList: stat.professionList,
        healing: stat.healing,
        barrier: stat.barrier,
        logsJoined: stat.logsJoined
    })).sort((a, b) => (b.healing + b.barrier) - (a.healing + a.barrier));

    // Condition summaries
    const outgoingConditionSummary = Object.values(outgoingCondiTotals)
        .map((entry) => ({
            ...entry,
            applications: (entry.applicationsFromBuffs && entry.applicationsFromBuffs > 0)
                ? entry.applicationsFromBuffs
                : entry.applications
        }))
        .sort((a, b) => b.damage - a.damage);

    const outgoingConditionPlayers = playerEntries.map(({ stat }) => {
        const conditionTotals = stat.outgoingConditions || {};
        let totalApplications = 0;
        let totalDamage = 0;
        Object.values(conditionTotals).forEach((entry) => {
            const applications = (entry.applicationsFromBuffs && entry.applicationsFromBuffs > 0)
                ? entry.applicationsFromBuffs
                : entry.applications;
            totalApplications += Number(applications || 0);
            totalDamage += Number(entry.damage || 0);
        });
        return {
            account: stat.account,
            profession: stat.profession,
            professionList: stat.professionList,
            totalFightMs: stat.totalFightMs || 0,
            totalApplications,
            totalDamage,
            conditions: conditionTotals
        };
    });

    // KDR
    const squadKDR = totalSquadDeaths > 0 ? (totalSquadKills / totalSquadDeaths).toFixed(2) : totalSquadKills > 0 ? '∞' : '0.00';
    const enemyKDR = totalEnemyDeaths > 0 ? (totalEnemyKills / totalEnemyDeaths).toFixed(2) : totalEnemyKills > 0 ? '∞' : '0.00';

    // Map data
    const mapData = Object.entries(mapCounts)
        .map(([name, count]) => ({ name, value: count }))
        .sort((a, b) => b.value - a.value);

    // Boon tables (use buildBoonTables from shared)
    let boonTables: any[] = [];
    try {
        const boonResult = buildBoonTables(validLogs);
        boonTables = boonResult || [];
    } catch (err) {
        console.warn('[StatsWorker] Boon table computation failed:', err);
    }

    return {
        total,
        wins,
        losses,
        avgSquadSize,
        avgEnemies,
        squadKDR,
        enemyKDR,
        totalSquadKills,
        totalSquadDeaths,
        totalEnemyKills,
        totalEnemyDeaths,
        maxDownContrib,
        maxCleanses,
        maxStrips,
        maxStab,
        maxHealing,
        maxBarrier,
        maxCC,
        closestToTag,
        maxDodges,
        maxDamage,
        maxDps: maxDps,
        maxRevives,
        topSkills: [],
        topIncomingSkills: [],
        outgoingConditionSummary,
        outgoingConditionPlayers,
        incomingConditionSummary: [],
        incomingConditionPlayers: [],
        mapData,
        squadClassData: [],
        enemyClassData: [],
        timelineData: [],
        fightBreakdown: [],
        boonTables,
        specialTables: [],
        offensePlayers,
        defensePlayers,
        supportPlayers,
        healingPlayers,
        mvp,
        silver,
        bronze,
        avgMvpScore,
        leaderboards
    };
};

const createEmptyStats = () => ({
    total: 0,
    wins: 0,
    losses: 0,
    avgSquadSize: 0,
    avgEnemies: 0,
    squadKDR: '0.00',
    enemyKDR: '0.00',
    totalSquadKills: 0,
    totalSquadDeaths: 0,
    totalEnemyKills: 0,
    totalEnemyDeaths: 0,
    maxDownContrib: { value: 0, player: '', count: 0, profession: 'Unknown', professionList: [] },
    maxCleanses: { value: 0, player: '', count: 0, profession: 'Unknown', professionList: [] },
    maxStrips: { value: 0, player: '', count: 0, profession: 'Unknown', professionList: [] },
    maxStab: { value: 0, player: '', count: 0, profession: 'Unknown', professionList: [] },
    maxHealing: { value: 0, player: '', count: 0, profession: 'Unknown', professionList: [] },
    maxBarrier: { value: 0, player: '', count: 0, profession: 'Unknown', professionList: [] },
    maxCC: { value: 0, player: '', count: 0, profession: 'Unknown', professionList: [] },
    closestToTag: { value: 0, player: '', count: 0, profession: 'Unknown', professionList: [] },
    maxDodges: { value: 0, player: '', count: 0, profession: 'Unknown', professionList: [] },
    maxDamage: { value: 0, player: '', count: 0, profession: 'Unknown', professionList: [] },
    maxDps: { value: 0, player: '', count: 0, profession: 'Unknown', professionList: [] },
    maxRevives: { value: 0, player: '', count: 0, profession: 'Unknown', professionList: [] },
    topSkills: [],
    topIncomingSkills: [],
    outgoingConditionSummary: [],
    outgoingConditionPlayers: [],
    incomingConditionSummary: [],
    incomingConditionPlayers: [],
    mapData: [],
    squadClassData: [],
    enemyClassData: [],
    timelineData: [],
    fightBreakdown: [],
    boonTables: [],
    specialTables: [],
    offensePlayers: [],
    defensePlayers: [],
    supportPlayers: [],
    healingPlayers: [],
    mvp: null,
    silver: null,
    bronze: null,
    avgMvpScore: 0,
    leaderboards: {}
});

ctx.onmessage = (event: MessageEvent<StatsWorkerRequest>) => {
    const request = event.data;

    switch (request.type) {
        case 'COMPUTE_STATS': {
            try {
                sendProgress(request.id, 10, 'Starting computation...');
                const stats = computeStats(
                    request.input.logs,
                    request.input.mvpWeights,
                    request.input.statsViewSettings,
                    request.input.disruptionMethod
                );
                sendResponse({ type: 'STATS_RESULT', id: request.id, stats });
            } catch (err: any) {
                sendResponse({
                    type: 'ERROR',
                    id: request.id,
                    error: err?.message || String(err)
                });
            }
            break;
        }
        case 'CANCEL':
            // Currently no cancellation support, but we acknowledge
            break;
        default:
            sendResponse({
                type: 'ERROR',
                id: (request as any).id || 'unknown',
                error: `Unknown request type: ${(request as any).type}`
            });
    }
};

// Signal ready
sendResponse({ type: 'READY' });
