import { describe, it, expect } from 'vitest';
import { classifyPlayerRoles } from '../classifyPlayerRoles';
import { BoonTable } from '../../../shared/boonGeneration';

const makePlayerStats = (account: string, overrides: Record<string, any> = {}) => ({
    name: account,
    account,
    healing: 0,
    cleanses: 0,
    stab: 0,
    barrier: 0,
    revives: 0,
    dps: 0,
    damage: 0,
    downContrib: 0,
    healingTotals: { healing: overrides.healing || 0, selfHealing: overrides.selfHealing || 0 } as Record<string, number>,
    ...overrides,
});

const makeBoonTable = (boonId: string, rows: Array<{ account: string; generationMs: number }>): BoonTable => ({
    id: boonId,
    name: boonId,
    stacking: false,
    rows: rows.map((r) => ({
        account: r.account,
        profession: 'Guardian',
        activeTimeMs: 60000,
        numFights: 1,
        groupSupported: 5,
        squadSupported: 50,
        categories: {
            selfBuffs: { generationMs: 0, wastedMs: 0 },
            groupBuffs: { generationMs: 0, wastedMs: 0 },
            squadBuffs: { generationMs: r.generationMs, wastedMs: 0 },
        },
    })),
});

describe('classifyPlayerRoles', () => {
    it('classifies all-DPS squad as damage', () => {
        const players = [
            makePlayerStats('dps1', { dps: 8000, damage: 500000, downContrib: 80000 }),
            makePlayerStats('dps2', { dps: 7200, damage: 450000, downContrib: 70000 }),
            makePlayerStats('dps3', { dps: 7600, damage: 480000, downContrib: 75000 }),
        ];
        const result = classifyPlayerRoles(players, []);
        expect(result.get('dps1')!.role).toBe('damage');
        expect(result.get('dps2')!.role).toBe('damage');
        expect(result.get('dps3')!.role).toBe('damage');
    });

    it('classifies high-healing player as support in mixed squad', () => {
        const players = [
            makePlayerStats('healer', { healing: 500000, cleanses: 200, dps: 800, damage: 50000, downContrib: 5000 }),
            makePlayerStats('offheal', { healing: 50000, cleanses: 30, dps: 1300, damage: 80000, downContrib: 10000 }),
            makePlayerStats('dps1', { healing: 200, cleanses: 5, dps: 8000, damage: 500000, downContrib: 80000 }),
            makePlayerStats('dps2', { healing: 150, cleanses: 3, dps: 7200, damage: 450000, downContrib: 70000 }),
            makePlayerStats('dps3', { healing: 100, cleanses: 2, dps: 7600, damage: 480000, downContrib: 75000 }),
        ];
        const result = classifyPlayerRoles(players, []);
        expect(result.get('healer')!.role).toBe('support');
        expect(result.get('dps1')!.role).toBe('damage');
        expect(result.get('dps2')!.role).toBe('damage');
    });

    it('uses total boon generation data for classification', () => {
        const players = [
            makePlayerStats('buffer', { healing: 1000, cleanses: 50, dps: 1000, damage: 60000, downContrib: 5000 }),
            makePlayerStats('dps1', { healing: 100, cleanses: 5, dps: 8000, damage: 500000, downContrib: 80000 }),
            makePlayerStats('dps2', { healing: 50, cleanses: 3, dps: 7200, damage: 450000, downContrib: 70000 }),
            makePlayerStats('dps3', { healing: 80, cleanses: 2, dps: 7600, damage: 480000, downContrib: 75000 }),
        ];
        const boonTables = [
            makeBoonTable('b740', [
                { account: 'buffer', generationMs: 300000 },
                { account: 'dps1', generationMs: 1000 },
                { account: 'dps2', generationMs: 500 },
                { account: 'dps3', generationMs: 800 },
            ]),
            makeBoonTable('b718', [
                { account: 'buffer', generationMs: 200000 },
                { account: 'dps1', generationMs: 500 },
                { account: 'dps2', generationMs: 300 },
                { account: 'dps3', generationMs: 400 },
            ]),
        ];
        const result = classifyPlayerRoles(players, boonTables);
        expect(result.get('buffer')!.role).toBe('support');
        expect(result.get('buffer')!.supportScore).toBeGreaterThan(0);
    });

    it('returns confidence score between 0 and 1', () => {
        const players = [
            makePlayerStats('healer', { healing: 500000, cleanses: 300, dps: 500, damage: 30000, downContrib: 2000 }),
            makePlayerStats('dps1', { dps: 8000, damage: 500000, downContrib: 80000 }),
            makePlayerStats('dps2', { dps: 7200, damage: 450000, downContrib: 70000 }),
        ];
        const result = classifyPlayerRoles(players, []);
        const healer = result.get('healer')!;
        const dps = result.get('dps1')!;
        expect(healer.confidenceScore).toBeGreaterThanOrEqual(0);
        expect(healer.confidenceScore).toBeLessThanOrEqual(1);
        expect(dps.confidenceScore).toBeGreaterThanOrEqual(0);
        expect(dps.confidenceScore).toBeLessThanOrEqual(1);
    });

    it('handles single player gracefully', () => {
        const players = [makePlayerStats('solo', { healing: 5000, cleanses: 10, dps: 3000, damage: 100000, downContrib: 15000 })];
        const result = classifyPlayerRoles(players, []);
        expect(result.get('solo')).toBeDefined();
        expect(['support', 'damage']).toContain(result.get('solo')!.role);
    });

    it('handles empty player list', () => {
        const result = classifyPlayerRoles([], []);
        expect(result.size).toBe(0);
    });

    it('support player has higher support score than damage player', () => {
        const players = [
            makePlayerStats('healer', { healing: 400000, cleanses: 250, dps: 600, damage: 40000, downContrib: 3000 }),
            makePlayerStats('dps1', { healing: 0, cleanses: 5, dps: 8000, damage: 500000, downContrib: 80000 }),
            makePlayerStats('dps2', { healing: 50, cleanses: 2, dps: 7200, damage: 450000, downContrib: 70000 }),
        ];
        const result = classifyPlayerRoles(players, []);
        expect(result.get('healer')!.supportScore).toBeGreaterThan(result.get('dps1')!.supportScore);
    });

    it('low-performing support with low damage classified as support over DPS', () => {
        const players = [
            makePlayerStats('weakSupport', { healing: 80000, cleanses: 60, dps: 600, damage: 40000, downContrib: 3000 }),
            makePlayerStats('dps1', { healing: 0, cleanses: 0, dps: 8000, damage: 500000, downContrib: 80000 }),
            makePlayerStats('dps2', { healing: 0, cleanses: 0, dps: 7600, damage: 480000, downContrib: 75000 }),
            makePlayerStats('dps3', { healing: 0, cleanses: 0, dps: 7200, damage: 450000, downContrib: 70000 }),
            makePlayerStats('dps4', { healing: 0, cleanses: 0, dps: 7400, damage: 460000, downContrib: 72000 }),
        ];
        const result = classifyPlayerRoles(players, []);
        expect(result.get('weakSupport')!.role).toBe('support');
        expect(result.get('weakSupport')!.supportScore).toBeGreaterThan(result.get('dps1')!.supportScore);
    });
});
