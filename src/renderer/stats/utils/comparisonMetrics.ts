// src/renderer/stats/utils/comparisonMetrics.ts

export interface ComparisonMetric {
    id: string;
    label: string;
    /** Which *Totals object to read from (offenseTotals, defenseTotals, etc.) */
    totalsKey: 'offenseTotals' | 'defenseTotals' | 'supportTotals' | 'healingTotals';
    /** The field key inside the totals object */
    field: string;
    /** If true, lower values are better (deaths, damage taken) */
    lowerIsBetter?: boolean;
    /** If true, display as percentage */
    isPercent?: boolean;
    /** If true, this is a rate field that needs denominator from rateWeights */
    isRate?: boolean;
    /** For per-second metrics: divide value by activeMs/1000 */
    perSecond?: boolean;
    /** Number of decimal places for display */
    decimals?: number;
}

export type ComparisonCategory = 'offense' | 'defense' | 'support' | 'healing';

export const COMPARISON_CATEGORIES: { value: ComparisonCategory; label: string }[] = [
    { value: 'offense', label: 'Offense' },
    { value: 'defense', label: 'Defense' },
    { value: 'support', label: 'Support' },
    { value: 'healing', label: 'Healing' },
];

export const COMPARISON_METRICS: Record<ComparisonCategory, ComparisonMetric[]> = {
    offense: [
        { id: 'damage', label: 'Damage', totalsKey: 'offenseTotals', field: 'damage' },
        { id: 'dps', label: 'DPS', totalsKey: 'offenseTotals', field: 'damage', perSecond: true, decimals: 0 },
        { id: 'downContribution', label: 'Down Contribution', totalsKey: 'offenseTotals', field: 'downContribution' },
        { id: 'downed', label: 'Downs', totalsKey: 'offenseTotals', field: 'downed' },
        { id: 'killed', label: 'Kills', totalsKey: 'offenseTotals', field: 'killed' },
        { id: 'criticalRate', label: 'Critical Rate', totalsKey: 'offenseTotals', field: 'criticalRate', isRate: true, isPercent: true, decimals: 1 },
        { id: 'boonStrips', label: 'Boon Strips', totalsKey: 'offenseTotals', field: 'boonStrips' },
    ],
    defense: [
        { id: 'damageTaken', label: 'Damage Taken', totalsKey: 'defenseTotals', field: 'damageTaken', lowerIsBetter: true },
        { id: 'downCount', label: 'Down Count', totalsKey: 'defenseTotals', field: 'downCount', lowerIsBetter: true },
        { id: 'deadCount', label: 'Death Count', totalsKey: 'defenseTotals', field: 'deadCount', lowerIsBetter: true },
        { id: 'dodgeCount', label: 'Dodge Count', totalsKey: 'defenseTotals', field: 'dodgeCount' },
        { id: 'blockedCount', label: 'Blocked Count', totalsKey: 'defenseTotals', field: 'blockedCount' },
        { id: 'evadedCount', label: 'Evaded Count', totalsKey: 'defenseTotals', field: 'evadedCount' },
    ],
    support: [
        { id: 'condiCleanse', label: 'Condition Cleanses', totalsKey: 'supportTotals', field: 'condiCleanse' },
        { id: 'boonStrips', label: 'Boon Strips', totalsKey: 'supportTotals', field: 'boonStrips' },
        { id: 'stunBreak', label: 'Stun Breaks', totalsKey: 'supportTotals', field: 'stunBreak' },
        { id: 'resurrects', label: 'Resurrects', totalsKey: 'supportTotals', field: 'resurrects' },
    ],
    healing: [
        { id: 'healing', label: 'Healing', totalsKey: 'healingTotals', field: 'healing' },
        { id: 'healingPerSecond', label: 'HPS', totalsKey: 'healingTotals', field: 'healing', perSecond: true, decimals: 1 },
        { id: 'barrier', label: 'Barrier', totalsKey: 'healingTotals', field: 'barrier' },
        { id: 'barrierPerSecond', label: 'Barrier/s', totalsKey: 'healingTotals', field: 'barrier', perSecond: true, decimals: 1 },
        { id: 'downedHealing', label: 'Downed Healing', totalsKey: 'healingTotals', field: 'downedHealing' },
    ],
};

/**
 * Extract a metric value from a player row object.
 * Player rows have shape: { account, profession, professionList, offenseTotals, offenseRateWeights, totalFightMs, ... }
 */
export function getMetricValue(player: any, metric: ComparisonMetric): number {
    const totals = player[metric.totalsKey];
    if (!totals) return 0;

    let value: number;

    if (metric.isRate) {
        const weightsKey = metric.totalsKey.replace('Totals', 'RateWeights');
        const denom = player[weightsKey]?.[metric.field] || 0;
        const numer = totals[metric.field] || 0;
        value = denom > 0 ? (numer / denom) * 100 : 0;
    } else {
        value = totals[metric.field] || 0;
    }

    if (metric.perSecond) {
        const ms = player.totalFightMs || player.activeMs || 0;
        const seconds = Math.max(1, ms / 1000);
        value = value / seconds;
    }

    return value;
}

/**
 * Given a category, return the stats array key to read from.
 */
export function getPlayersArrayKey(category: ComparisonCategory): string {
    switch (category) {
        case 'offense': return 'offensePlayers';
        case 'defense': return 'defensePlayers';
        case 'support': return 'supportPlayers';
        case 'healing': return 'healingPlayers';
    }
}
