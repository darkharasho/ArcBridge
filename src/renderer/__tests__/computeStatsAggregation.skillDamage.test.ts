import { describe, expect, it } from 'vitest';
import { computeStatsAggregation } from '../stats/computeStatsAggregation';

describe('computeStatsAggregation (skill damage source reconciliation)', () => {
    it('uses buffMap skill names when skillMap entry is missing', () => {
        const vampAuraId = 30285;
        const playerKey = 'BreakN.5496';
        const log = {
            status: 'success',
            filePath: 'skill-damage-buff-fallback-test',
            details: {
                durationMS: 5000,
                skillMap: {},
                buffMap: {
                    [`b${vampAuraId}`]: { name: 'Vampiric Aura', icon: 'https://example.invalid/vamp.png' }
                },
                players: [
                    {
                        account: 'BreakN.5496',
                        profession: 'Berserker',
                        notInSquad: false,
                        dpsAll: [{ damage: 10757, dps: 2151 }],
                        statsAll: [{ connectedDamageCount: 1 }],
                        support: [{ resurrects: 0 }],
                        damage1S: [[0, 100, 200, 300, 400, 500]],
                        targetDamage1S: [[[0, 100, 200, 300, 400, 500]]],
                        targetDamageDist: [[[
                            { id: vampAuraId, totalDamage: 10757, connectedHits: 5, max: 3200 }
                        ]]],
                        totalDamageDist: [[
                            { id: vampAuraId, totalDamage: 10757, connectedHits: 5, max: 3200 }
                        ]]
                    }
                ],
                targets: []
            }
        };

        const { stats } = computeStatsAggregation({ logs: [log as any] });
        const topSkill = (stats.topSkills || []).find((skill: any) => Number(skill?.damage || 0) === 10757);
        expect(topSkill).toBeTruthy();
        expect(String(topSkill?.name || '')).toBe('Vampiric Aura');

        const playerBreakdown = (stats.playerSkillBreakdowns || []).find((entry: any) => entry.key === playerKey);
        expect(playerBreakdown).toBeTruthy();
        const playerSkill = (playerBreakdown.skills || []).find((skill: any) => Number(skill?.damage || 0) === 10757);
        expect(playerSkill).toBeTruthy();
        expect(String(playerSkill?.name || '')).toBe('Vampiric Aura');
    });

    it('keeps skills that exist only in totalDamageDist when top skill source is target', () => {
        const battleMaulId = 31710;
        const arcingSliceId = 123;
        const playerKey = 'BreakN.5496';
        const log = {
            status: 'success',
            filePath: 'skill-damage-source-test',
            details: {
                durationMS: 5000,
                skillMap: {
                    [`s${battleMaulId}`]: { name: 'Battle Maul' },
                    [`s${arcingSliceId}`]: { name: 'Arcing Slice' }
                },
                buffMap: {},
                players: [
                    {
                        account: 'BreakN.5496',
                        name: 'BreakN.5496',
                        profession: 'Berserker',
                        notInSquad: false,
                        dpsAll: [{ damage: 495819, dps: 99163 }],
                        statsAll: [{ connectedDamageCount: 2 }],
                        support: [{ resurrects: 0 }],
                        damage1S: [[0, 100, 200, 300, 400, 500]],
                        targetDamage1S: [[
                            [0, 100, 200, 300, 400, 500]
                        ]],
                        targetDamageDist: [[[
                            { id: arcingSliceId, totalDamage: 1000, connectedHits: 1, max: 1000 }
                        ]]],
                        totalDamageDist: [[
                            { id: arcingSliceId, totalDamage: 1000, connectedHits: 1, max: 1000 },
                            { id: battleMaulId, totalDamage: 494819, connectedHits: 1, max: 494819 }
                        ]]
                    }
                ],
                targets: []
            }
        };

        const { stats } = computeStatsAggregation({ logs: [log as any] });

        const topBattleMaul = (stats.topSkills || []).find((skill: any) => skill.name === 'Battle Maul');
        expect(topBattleMaul).toBeTruthy();
        expect(Number(topBattleMaul.damage || 0)).toBe(494819);

        const playerBreakdown = (stats.playerSkillBreakdowns || []).find((entry: any) => entry.key === playerKey);
        expect(playerBreakdown).toBeTruthy();
        const playerBattleMaul = (playerBreakdown.skills || []).find((skill: any) => skill.name === 'Battle Maul');
        expect(playerBattleMaul).toBeTruthy();
        expect(Number(playerBattleMaul.damage || 0)).toBe(494819);

        const spikeFight = stats.spikeDamage?.fights?.[0];
        const spikePlayer = stats.spikeDamage?.players?.find((entry: any) => entry.key === playerKey);
        expect(spikeFight).toBeTruthy();
        expect(spikePlayer).toBeTruthy();
        expect(Number(spikePlayer.peakHit || 0)).toBe(1000);
        expect(String(spikePlayer.peakSkillName || '')).toBe('Arcing Slice');
        const spikeBattleMaul = (spikeFight.values?.[playerKey]?.skillRows || []).find((row: any) => row.skillName === 'Battle Maul');
        expect(spikeBattleMaul).toBeTruthy();
        expect(Number(spikeBattleMaul.damage || 0)).toBe(494819);
    });

    it('uses totalDamageDist when targetDamageDist has same skill id with zero damage', () => {
        const battleMaulId = 31710;
        const playerKey = 'BreakN.5496';
        const log = {
            status: 'success',
            filePath: 'skill-damage-source-zero-target-test',
            details: {
                durationMS: 5000,
                skillMap: {
                    [`s${battleMaulId}`]: { name: 'Battle Maul' }
                },
                buffMap: {},
                players: [
                    {
                        account: 'BreakN.5496',
                        profession: 'Berserker',
                        notInSquad: false,
                        dpsAll: [{ damage: 494819, dps: 98963 }],
                        statsAll: [{ connectedDamageCount: 1 }],
                        support: [{ resurrects: 0 }],
                        damage1S: [[0, 100, 200, 300, 400, 500]],
                        targetDamage1S: [[[0, 100, 200, 300, 400, 500]]],
                        targetDamageDist: [[[
                            { id: battleMaulId, totalDamage: 0, connectedHits: 0, max: 494819 }
                        ]]],
                        totalDamageDist: [[
                            { id: battleMaulId, totalDamage: 494819, connectedHits: 1, max: 494819 }
                        ]]
                    }
                ],
                targets: []
            }
        };

        const { stats } = computeStatsAggregation({ logs: [log as any] });
        const topBattleMaul = (stats.topSkills || []).find((skill: any) => skill.name === 'Battle Maul');
        expect(topBattleMaul).toBeTruthy();
        expect(Number(topBattleMaul.damage || 0)).toBe(494819);

        const playerBreakdown = (stats.playerSkillBreakdowns || []).find((entry: any) => entry.key === playerKey);
        expect(playerBreakdown).toBeTruthy();
        const playerBattleMaul = (playerBreakdown.skills || []).find((skill: any) => skill.name === 'Battle Maul');
        expect(playerBattleMaul).toBeTruthy();
        expect(Number(playerBattleMaul.damage || 0)).toBe(494819);

        const spikeBattleMaul = (stats.spikeDamage?.fights?.[0]?.values?.[playerKey]?.skillRows || []).find((row: any) => row.skillName === 'Battle Maul');
        expect(spikeBattleMaul).toBeTruthy();
        expect(Number(spikeBattleMaul.damage || 0)).toBe(494819);
    });

    it('reconciles partial target skill totals with higher totalDamageDist values', () => {
        const battleMaulId = 31710;
        const playerKey = 'BreakN.5496';
        const log = {
            status: 'success',
            filePath: 'skill-damage-source-partial-target-test',
            details: {
                durationMS: 5000,
                skillMap: {
                    [`s${battleMaulId}`]: { name: 'Battle Maul' }
                },
                buffMap: {},
                players: [
                    {
                        account: 'BreakN.5496',
                        profession: 'Berserker',
                        notInSquad: false,
                        dpsAll: [{ damage: 494819, dps: 98963 }],
                        statsAll: [{ connectedDamageCount: 3 }],
                        support: [{ resurrects: 0 }],
                        damage1S: [[0, 100, 200, 300, 400, 500]],
                        targetDamage1S: [[[0, 100, 200, 300, 400, 500]]],
                        targetDamageDist: [[[
                            { id: battleMaulId, totalDamage: 1000, connectedHits: 2, max: 494819 }
                        ]]],
                        totalDamageDist: [[
                            { id: battleMaulId, totalDamage: 494819, connectedHits: 3, max: 494819 }
                        ]]
                    }
                ],
                targets: []
            }
        };

        const { stats } = computeStatsAggregation({ logs: [log as any] });
        const topBattleMaul = (stats.topSkills || []).find((skill: any) => skill.name === 'Battle Maul');
        expect(topBattleMaul).toBeTruthy();
        expect(Number(topBattleMaul.damage || 0)).toBe(494819);

        const playerBreakdown = (stats.playerSkillBreakdowns || []).find((entry: any) => entry.key === playerKey);
        expect(playerBreakdown).toBeTruthy();
        const playerBattleMaul = (playerBreakdown.skills || []).find((skill: any) => skill.name === 'Battle Maul');
        expect(playerBattleMaul).toBeTruthy();
        expect(Number(playerBattleMaul.damage || 0)).toBe(494819);

        const spikeBattleMaul = (stats.spikeDamage?.fights?.[0]?.values?.[playerKey]?.skillRows || []).find((row: any) => row.skillName === 'Battle Maul');
        expect(spikeBattleMaul).toBeTruthy();
        expect(Number(spikeBattleMaul.damage || 0)).toBe(494819);
    });

    it('does not infer spike hit from totalDamage/connectedHits when max fields are missing', () => {
        const battleMaulId = 31710;
        const arcDividerId = 29852;
        const playerKey = 'BreakN.5496';
        const log = {
            status: 'success',
            filePath: 'spike-hit-max-only-test',
            details: {
                durationMS: 5000,
                skillMap: {
                    [`s${battleMaulId}`]: { name: 'Battle Maul' },
                    [`s${arcDividerId}`]: { name: 'Arc Divider' }
                },
                buffMap: {},
                players: [
                    {
                        account: 'BreakN.5496',
                        profession: 'Berserker',
                        notInSquad: false,
                        dpsAll: [{ damage: 504819, dps: 100963 }],
                        statsAll: [{ connectedDamageCount: 2 }],
                        support: [{ resurrects: 0 }],
                        damage1S: [[0, 100, 200, 300, 400, 500]],
                        targetDamage1S: [[[0, 100, 200, 300, 400, 500]]],
                        targetDamageDist: [[[
                            { id: battleMaulId, totalDamage: 494819, connectedHits: 1 },
                            { id: arcDividerId, totalDamage: 10000, connectedHits: 1, max: 10000 }
                        ]]],
                        totalDamageDist: [[
                            { id: battleMaulId, totalDamage: 494819, connectedHits: 1 },
                            { id: arcDividerId, totalDamage: 10000, connectedHits: 1, max: 10000 }
                        ]]
                    }
                ],
                targets: []
            }
        };

        const { stats } = computeStatsAggregation({ logs: [log as any] });
        const spikePlayer = stats.spikeDamage?.players?.find((entry: any) => entry.key === playerKey);
        expect(spikePlayer).toBeTruthy();
        expect(Number(spikePlayer.peakHit || 0)).toBe(10000);
        expect(String(spikePlayer.peakSkillName || '')).toBe('Arc Divider');
    });

    it('captures hits, min, and max per skill in player breakdown', () => {
        const fireballId = 5491;
        const playerKey = 'TestPlayer.1234';
        const log = {
            status: 'success',
            filePath: 'skill-min-max-test',
            details: {
                durationMS: 10000,
                skillMap: {
                    [`s${fireballId}`]: { name: 'Fireball', icon: 'https://example.invalid/fireball.png' }
                },
                buffMap: {},
                players: [
                    {
                        account: 'TestPlayer.1234',
                        profession: 'Weaver',
                        notInSquad: false,
                        dpsAll: [{ damage: 5000, dps: 500 }],
                        statsAll: [{ connectedDamageCount: 5 }],
                        support: [{ resurrects: 0 }],
                        damage1S: [[0, 1000, 2000, 3000, 4000, 5000]],
                        targetDamage1S: [[[0, 1000, 2000, 3000, 4000, 5000]]],
                        targetDamageDist: [[[
                            { id: fireballId, totalDamage: 5000, connectedHits: 5, hits: 5, min: 675, max: 1400, downContribution: 2000 }
                        ]]],
                        totalDamageDist: [[
                            { id: fireballId, totalDamage: 5000, connectedHits: 5, hits: 5, min: 675, max: 1400, downContribution: 2000 }
                        ]]
                    }
                ],
                targets: []
            }
        };

        const { stats } = computeStatsAggregation({ logs: [log as any] });
        const playerBreakdown = (stats.playerSkillBreakdowns || []).find((entry: any) => entry.key === playerKey);
        expect(playerBreakdown).toBeTruthy();
        const skill = (playerBreakdown.skills || []).find((s: any) => s.name === 'Fireball');
        expect(skill).toBeTruthy();
        expect(skill.hits).toBe(5);
        expect(skill.min).toBe(675);
        expect(skill.max).toBe(1400);
        // Avg = damage / hits = 5000 / 5 = 1000
        expect(skill.damage / skill.hits).toBe(1000);
    });

    it('aggregates min/max across multiple logs correctly', () => {
        const slashId = 1001;
        const playerKey = 'MultiLog.5678';
        const makeLog = (damage: number, hits: number, min: number, max: number) => ({
            status: 'success',
            filePath: `multi-log-min-max-${min}-${max}`,
            details: {
                durationMS: 5000,
                skillMap: { [`s${slashId}`]: { name: 'Slash' } },
                buffMap: {},
                players: [
                    {
                        account: 'MultiLog.5678',
                        profession: 'Warrior',
                        notInSquad: false,
                        dpsAll: [{ damage, dps: damage / 5 }],
                        statsAll: [{ connectedDamageCount: hits }],
                        support: [{ resurrects: 0 }],
                        damage1S: [[0, 100, 200, 300, 400, 500]],
                        targetDamage1S: [[[0, 100, 200, 300, 400, 500]]],
                        targetDamageDist: [[[
                            { id: slashId, totalDamage: damage, connectedHits: hits, hits, min, max }
                        ]]],
                        totalDamageDist: [[
                            { id: slashId, totalDamage: damage, connectedHits: hits, hits, min, max }
                        ]]
                    }
                ],
                targets: []
            }
        });

        const log1 = makeLog(3000, 3, 800, 1200);
        const log2 = makeLog(4000, 4, 600, 1500);

        const { stats } = computeStatsAggregation({ logs: [log1 as any, log2 as any] });
        const playerBreakdown = (stats.playerSkillBreakdowns || []).find((entry: any) => entry.key === playerKey);
        expect(playerBreakdown).toBeTruthy();
        const skill = (playerBreakdown.skills || []).find((s: any) => s.name === 'Slash');
        expect(skill).toBeTruthy();
        // hits summed: 3 + 4 = 7
        expect(skill.hits).toBe(7);
        // min is global minimum: min(800, 600) = 600
        expect(skill.min).toBe(600);
        // max is global maximum: max(1200, 1500) = 1500
        expect(skill.max).toBe(1500);
        // Avg = total damage / total hits = 7000 / 7 = 1000
        expect(skill.damage / skill.hits).toBe(1000);
    });

    it('ignores total-only spike outliers for detailedWvW logs', () => {
        const battleMaulId = 54922;
        const whirlwindId = 14447;
        const arcDividerId = 29852;
        const playerKey = 'BreakN.5496';
        const log = {
            status: 'success',
            filePath: 'spike-hit-detailed-wvw-outlier-test',
            details: {
                detailedWvW: true,
                durationMS: 5000,
                skillMap: {
                    [`s${battleMaulId}`]: { name: 'Battle Maul' },
                    [`s${whirlwindId}`]: { name: 'Whirlwind Attack' },
                    [`s${arcDividerId}`]: { name: 'Arc Divider' }
                },
                buffMap: {},
                players: [
                    {
                        account: 'BreakN.5496',
                        profession: 'Berserker',
                        notInSquad: false,
                        dpsAll: [{ damage: 701517, dps: 140303 }],
                        statsAll: [{ connectedDamageCount: 22 }],
                        support: [{ resurrects: 0 }],
                        damage1S: [[0, 100, 200, 300, 400, 500]],
                        targetDamage1S: [[[0, 100, 200, 300, 400, 500]]],
                        targetDamageDist: [[[
                            { id: arcDividerId, totalDamage: 14528, connectedHits: 1, max: 14528 },
                            { id: whirlwindId, totalDamage: 355, connectedHits: 1, max: 355 }
                        ]]],
                        totalDamageDist: [[
                            { id: battleMaulId, totalDamage: 494819, connectedHits: 1, max: 494819 },
                            { id: whirlwindId, totalDamage: 196698, connectedHits: 17, max: 178481 },
                            { id: arcDividerId, totalDamage: 14528, connectedHits: 1, max: 14528 }
                        ]]
                    }
                ],
                targets: []
            }
        };

        const { stats } = computeStatsAggregation({ logs: [log as any] });
        const spikePlayer = stats.spikeDamage?.players?.find((entry: any) => entry.key === playerKey);
        expect(spikePlayer).toBeTruthy();
        expect(Number(spikePlayer.peakHit || 0)).toBe(14528);
        expect(String(spikePlayer.peakSkillName || '')).toBe('Arc Divider');

        const topBattleMaul = (stats.topSkills || []).find((skill: any) => skill.name === 'Battle Maul');
        expect(topBattleMaul).toBeFalsy();
        const topWhirlwind = (stats.topSkills || []).find((skill: any) => skill.name === 'Whirlwind Attack');
        expect(topWhirlwind).toBeTruthy();
        expect(Number(topWhirlwind.damage || 0)).toBe(355);
    });
});
