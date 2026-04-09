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

    // --- Per-minute metrics ---
    it('extracts per-minute metric value', () => {
        const metric = { id: 'dpm', label: 'Avg DPM', totalsKey: 'offenseTotals' as const, field: 'damage', perMinute: true };
        const value = getMetricValue(mockOffensePlayer, metric);
        // 100000 / (120000/60000) = 100000 / 2 = 50000
        expect(value).toBeCloseTo(50000, 0);
    });

    // --- Per-fight metrics ---
    it('extracts per-fight metric value', () => {
        const player = { ...mockDefensePlayer, logsJoined: 5 };
        const metric = { id: 'deathsPerFight', label: 'Deaths/Fight', totalsKey: 'defenseTotals' as const, field: 'deadCount', perFight: true, lowerIsBetter: true };
        const value = getMetricValue(player, metric);
        // 1 death / 5 logs = 0.2
        expect(value).toBeCloseTo(0.2, 2);
    });

    it('per-fight defaults logsJoined to 1 when missing', () => {
        const metric = { id: 'deathsPerFight', label: 'Deaths/Fight', totalsKey: 'defenseTotals' as const, field: 'deadCount', perFight: true };
        const value = getMetricValue(mockDefensePlayer, metric);
        expect(value).toBe(1); // 1 death / 1 default log
    });

    // --- General / direct field metrics ---
    const mockGeneralPlayer = {
        account: 'Test.1234',
        profession: 'Warrior',
        professionList: ['Berserker'],
        totalFightMs: 600000,
        squadActiveMs: 540000,
        totalDist: 1500,
        distCount: 5,
        logsJoined: 10,
        stackedLogCount: 7,
    };

    it('computes Active %', () => {
        const metric = { id: 'activePercent', label: 'Active %', directField: 'activePercent', isPercent: true };
        const value = getMetricValue(mockGeneralPlayer, metric);
        // 540000 / 600000 * 100 = 90%
        expect(value).toBeCloseTo(90, 0);
    });

    it('computes Stack %', () => {
        const metric = { id: 'stackPercent', label: 'Stack %', directField: 'stackPercent', isPercent: true };
        const value = getMetricValue(mockGeneralPlayer, metric);
        // 7 / 10 * 100 = 70%
        expect(value).toBeCloseTo(70, 0);
    });

    it('computes Avg Dist Cmd', () => {
        const metric = { id: 'avgDistCmd', label: 'Avg Dist Cmd', directField: 'avgDistCmd', lowerIsBetter: true };
        const value = getMetricValue(mockGeneralPlayer, metric);
        // 1500 / 5 = 300
        expect(value).toBe(300);
    });

    it('returns 0 for direct field when data is missing', () => {
        const emptyPlayer = { account: 'Empty.0000', profession: 'Unknown', professionList: [] };
        const metric = { id: 'activePercent', label: 'Active %', directField: 'activePercent', isPercent: true };
        expect(getMetricValue(emptyPlayer, metric)).toBe(0);
    });

    // --- Boon metrics ---
    const mockBoonTables = [
        {
            id: 'b740',
            name: 'Might',
            stacking: true,
            rows: [
                {
                    account: 'Test.1234',
                    profession: 'Warrior',
                    activeTimeMs: 120000, // 2 minutes
                    numFights: 2,
                    groupSupported: 10,
                    squadSupported: 50,
                    categories: {
                        selfBuffs: { generationMs: 5000, wastedMs: 0 },
                        groupBuffs: { generationMs: 30000, wastedMs: 0 },
                        squadBuffs: { generationMs: 60000, wastedMs: 0 },
                    },
                },
            ],
        },
    ];

    it('extracts boon generation in seconds/min', () => {
        const metric = { id: 'might', label: 'Might', boonId: 'b740', boonCategory: 'squadBuffs' as const };
        const context = { boonTables: mockBoonTables };
        const value = getMetricValue({ account: 'Test.1234' }, metric, context);
        // generationMs=60000, activeTimeMs=120000 → 60s generation / 2 min active = 30 sec/min
        expect(value).toBeCloseTo(30, 0);
    });

    it('returns 0 for boon when player not in table', () => {
        const metric = { id: 'might', label: 'Might', boonId: 'b740', boonCategory: 'squadBuffs' as const };
        const context = { boonTables: mockBoonTables };
        expect(getMetricValue({ account: 'Nobody.0000' }, metric, context)).toBe(0);
    });

    it('returns 0 for boon when table not found', () => {
        const metric = { id: 'fury', label: 'Fury', boonId: 'b725', boonCategory: 'squadBuffs' as const };
        const context = { boonTables: mockBoonTables };
        expect(getMetricValue({ account: 'Test.1234' }, metric, context)).toBe(0);
    });

    it('returns 0 for boon when no context provided', () => {
        const metric = { id: 'might', label: 'Might', boonId: 'b740', boonCategory: 'squadBuffs' as const };
        expect(getMetricValue({ account: 'Test.1234' }, metric)).toBe(0);
    });

    // --- Burst metrics ---
    const mockSpikePlayers = [
        { account: 'Test.1234', peak1s: 45000, peak5s: 120000, peak30s: 500000 },
    ];

    it('extracts burst peak1s value', () => {
        const metric = { id: 'burst1s', label: 'Burst 1s', burstField: 'peak1s' };
        const context = { spikePlayers: mockSpikePlayers };
        const value = getMetricValue({ account: 'Test.1234' }, metric, context);
        expect(value).toBe(45000);
    });

    it('returns 0 for burst when player not in spike data', () => {
        const metric = { id: 'burst1s', label: 'Burst 1s', burstField: 'peak1s' };
        const context = { spikePlayers: mockSpikePlayers };
        expect(getMetricValue({ account: 'Nobody.0000' }, metric, context)).toBe(0);
    });

    it('returns 0 for burst when no context provided', () => {
        const metric = { id: 'burst1s', label: 'Burst 1s', burstField: 'peak1s' };
        expect(getMetricValue({ account: 'Test.1234' }, metric)).toBe(0);
    });
});
