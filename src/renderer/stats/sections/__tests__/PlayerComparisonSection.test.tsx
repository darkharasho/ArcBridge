// src/renderer/stats/sections/__tests__/PlayerComparisonSection.test.tsx
import { describe, it, expect } from 'vitest';
import { getMetricValue } from '../../utils/comparisonMetrics';
import { getComparisonColor, getDiffPercent } from '../../utils/comparisonColors';

// Test the data extraction and color logic that powers the component.
// Full component rendering tests require the StatsSharedContext provider
// which is complex to set up — focus on the logic units.

describe('PlayerComparison data logic', () => {
    const mockOffensePlayer = {
        account: 'Test.1234',
        profession: 'Warrior',
        professionList: ['Berserker'],
        offenseTotals: { damage: 100000, downContribution: 50000, downed: 10, killed: 5, criticalRate: 340, boonStrips: 80 },
        offenseRateWeights: { criticalRate: 500 },
        totalFightMs: 120000,
    };

    const mockDefensePlayer = {
        account: 'Test.1234',
        profession: 'Warrior',
        professionList: ['Berserker'],
        defenseTotals: { damageTaken: 200000, downCount: 3, deadCount: 1, dodgeCount: 15, blockedCount: 20, evadedCount: 10 },
        activeMs: 120000,
    };

    it('extracts basic offense metric value', () => {
        const metric = { id: 'damage', label: 'Damage', totalsKey: 'offenseTotals' as const, field: 'damage' };
        expect(getMetricValue(mockOffensePlayer, metric)).toBe(100000);
    });

    it('extracts per-second metric value', () => {
        const metric = { id: 'dps', label: 'DPS', totalsKey: 'offenseTotals' as const, field: 'damage', perSecond: true };
        const value = getMetricValue(mockOffensePlayer, metric);
        // 100000 / (120000/1000) = 100000 / 120 ≈ 833.33
        expect(value).toBeCloseTo(833.33, 1);
    });

    it('extracts rate metric as percentage', () => {
        const metric = { id: 'criticalRate', label: 'Critical Rate', totalsKey: 'offenseTotals' as const, field: 'criticalRate', isRate: true, isPercent: true };
        const value = getMetricValue(mockOffensePlayer, metric);
        // 340 / 500 * 100 = 68%
        expect(value).toBeCloseTo(68, 0);
    });

    it('extracts defense metric value', () => {
        const metric = { id: 'damageTaken', label: 'Damage Taken', totalsKey: 'defenseTotals' as const, field: 'damageTaken', lowerIsBetter: true };
        expect(getMetricValue(mockDefensePlayer, metric)).toBe(200000);
    });

    it('returns 0 for missing totals', () => {
        const metric = { id: 'healing', label: 'Healing', totalsKey: 'healingTotals' as const, field: 'healing' };
        expect(getMetricValue(mockOffensePlayer, metric)).toBe(0);
    });

    it('colors correctly for head-to-head comparison', () => {
        // Player A: 100k damage, Player B: 60k damage → A is green, B is red
        const colorA = getComparisonColor(100000, 60000);
        expect(colorA.text).toBe('#22c55e'); // green

        const colorB = getComparisonColor(60000, 100000);
        expect(colorB.text).toBe('#ef4444'); // red (40% worse)
    });

    it('diff percent is correct', () => {
        const diff = getDiffPercent(100000, 60000);
        expect(diff).toBeCloseTo(66.67, 0);
    });
});
