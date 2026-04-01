export interface ComparisonColor {
    bg: string | null;
    text: string | null;
}

const GREEN: ComparisonColor = { bg: 'rgba(34,197,94,0.15)', text: '#22c55e' };
const ORANGE: ComparisonColor = { bg: 'rgba(245,158,11,0.12)', text: '#f59e0b' };
const RED: ComparisonColor = { bg: 'rgba(239,68,68,0.15)', text: '#ef4444' };
const NEUTRAL: ComparisonColor = { bg: null, text: null };

/**
 * Returns color based on how a value compares to a reference.
 * - Green: within 10% or better
 * - Orange: 10-30% worse
 * - Red: 30%+ worse
 *
 * @param lowerIsBetter - flip direction (e.g. deaths, damage taken)
 */
export function getComparisonColor(
    value: number,
    reference: number,
    lowerIsBetter = false
): ComparisonColor {
    if (reference === 0) return NEUTRAL;

    const pctChange = (value - reference) / reference;
    // worse_pct > 0 means the value is worse than reference by that fraction
    const worsePct = lowerIsBetter ? pctChange : -pctChange;

    if (worsePct <= 0.1) return GREEN;
    if (worsePct <= 0.3) return ORANGE;
    return RED;
}

/**
 * Returns the percentage difference from reference.
 * Positive = better, negative = worse.
 * Returns null if reference is 0.
 */
export function getDiffPercent(
    value: number,
    reference: number,
    lowerIsBetter = false
): number | null {
    if (reference === 0) return null;
    const raw = ((value - reference) / reference) * 100;
    return lowerIsBetter ? -raw : raw;
}
