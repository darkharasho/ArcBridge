import { BoonTable } from '../../shared/boonGeneration';

export interface PlayerRoleClassification {
    role: 'support' | 'damage';
    supportScore: number;
    confidenceScore: number;
}

/** Boon IDs used for support classification (prefixed with "b" to match boon table format). */
const SUPPORT_BOON_IDS = {
    might: 'b740',
    regen: 'b718',
    resistance: 'b26980',
} as const;

/** Metric weights for support score calculation. */
const SUPPORT_WEIGHTS = {
    healing: 1.0,
    cleanses: 1.0,
    stability: 0.8,
    resistance: 0.7,
    might: 0.6,
    regen: 0.5,
} as const;

/** Players scoring above this multiplier of the squad median support score are classified as support. */
const THRESHOLD_MULTIPLIER = 1.5;

/** When the squad median for a metric is zero but the player has a positive value, use this ratio. */
const OUTLIER_RATIO = 2.0;

type MinimalPlayerStats = {
    account: string;
    healing: number;
    cleanses: number;
    stab: number;
};

/**
 * Compute the median of an array of numbers.
 * Returns 0 for empty arrays.
 */
const computeMedian = (values: number[]): number => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

/**
 * Compute the ratio of a player's value to the squad median.
 * If the median is zero and the player has a positive value, returns OUTLIER_RATIO.
 * If both are zero, returns 0.
 */
const computeRatio = (value: number, median: number): number => {
    if (median > 0) return value / median;
    if (value > 0) return OUTLIER_RATIO;
    return 0;
};

/**
 * Extract per-player squad generationMs for a specific boon from boon tables.
 * Returns a Map of account -> generationMs.
 */
const extractBoonGeneration = (boonTables: BoonTable[], boonId: string): Map<string, number> => {
    const result = new Map<string, number>();
    const table = boonTables.find((t) => t.id === boonId);
    if (!table) return result;
    for (const row of table.rows) {
        const existing = result.get(row.account) || 0;
        result.set(row.account, existing + row.categories.squadBuffs.generationMs);
    }
    return result;
};

/**
 * Classify each player as 'support' or 'damage' based on a weighted support score
 * normalized against the squad median.
 *
 * @param players - Array of objects with at least { account, healing, cleanses, stab }
 * @param boonTables - Boon generation tables from buildBoonTables()
 * @returns Map of account -> PlayerRoleClassification
 */
export const classifyPlayerRoles = (
    players: MinimalPlayerStats[],
    boonTables: BoonTable[],
): Map<string, PlayerRoleClassification> => {
    const result = new Map<string, PlayerRoleClassification>();
    if (players.length === 0) return result;

    // Extract boon generation data per player
    const mightGen = extractBoonGeneration(boonTables, SUPPORT_BOON_IDS.might);
    const regenGen = extractBoonGeneration(boonTables, SUPPORT_BOON_IDS.regen);
    const resistanceGen = extractBoonGeneration(boonTables, SUPPORT_BOON_IDS.resistance);

    // Collect per-metric values across all players (non-zero only for median calculation)
    const healingValues = players.map((p) => p.healing).filter((v) => v > 0);
    const cleanseValues = players.map((p) => p.cleanses).filter((v) => v > 0);
    const stabValues = players.map((p) => p.stab).filter((v) => v > 0);
    const mightValues = players.map((p) => mightGen.get(p.account) || 0).filter((v) => v > 0);
    const regenValues = players.map((p) => regenGen.get(p.account) || 0).filter((v) => v > 0);
    const resistValues = players.map((p) => resistanceGen.get(p.account) || 0).filter((v) => v > 0);

    // Compute medians
    const medianHealing = computeMedian(healingValues);
    const medianCleanses = computeMedian(cleanseValues);
    const medianStab = computeMedian(stabValues);
    const medianMight = computeMedian(mightValues);
    const medianRegen = computeMedian(regenValues);
    const medianResist = computeMedian(resistValues);

    // Compute support scores
    const scores: Array<{ account: string; supportScore: number }> = players.map((p) => {
        const supportScore =
            computeRatio(p.healing, medianHealing) * SUPPORT_WEIGHTS.healing +
            computeRatio(p.cleanses, medianCleanses) * SUPPORT_WEIGHTS.cleanses +
            computeRatio(p.stab, medianStab) * SUPPORT_WEIGHTS.stability +
            computeRatio(mightGen.get(p.account) || 0, medianMight) * SUPPORT_WEIGHTS.might +
            computeRatio(regenGen.get(p.account) || 0, medianRegen) * SUPPORT_WEIGHTS.regen +
            computeRatio(resistanceGen.get(p.account) || 0, medianResist) * SUPPORT_WEIGHTS.resistance;
        return { account: p.account, supportScore };
    });

    // Compute threshold from squad median support score
    const allSupportScores = scores.map((s) => s.supportScore);
    const medianSupportScore = computeMedian(allSupportScores);
    const threshold = medianSupportScore * THRESHOLD_MULTIPLIER;

    // Classify and compute confidence
    for (const { account, supportScore } of scores) {
        const role: 'support' | 'damage' = threshold > 0 && supportScore > threshold ? 'support' : 'damage';
        const distance = threshold > 0 ? Math.abs(supportScore - threshold) / threshold : 0;
        const confidenceScore = Math.min(distance, 1);
        result.set(account, { role, supportScore, confidenceScore });
    }

    return result;
};
