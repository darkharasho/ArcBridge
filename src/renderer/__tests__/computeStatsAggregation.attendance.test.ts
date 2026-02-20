import { describe, expect, it } from 'vitest';
import { computeStatsAggregation } from '../stats/computeStatsAggregation';

describe('computeStatsAggregation (attendance ledger)', () => {
    it('uses fight start/end timestamps before uploadTime for squad-time spans', () => {
        const logs = [
            {
                status: 'success',
                filePath: 'attendance-1',
                uploadTime: '2026-02-01T10:00:00Z',
                details: {
                    timeStartStd: '2026-02-01T00:00:00Z',
                    timeEndStd: '2026-02-01T01:00:00Z',
                    durationMS: 60 * 60 * 1000,
                    players: [
                        {
                            account: 'player.1234',
                            name: 'Player One',
                            profession: 'Guardian',
                            notInSquad: false,
                            activeTimes: [60 * 60 * 1000],
                            dpsAll: [{ damage: 0 }],
                            statsAll: [{}],
                            support: [{}],
                            defenses: [{}]
                        }
                    ],
                    targets: [],
                    skillMap: {},
                    buffMap: {}
                }
            },
            {
                status: 'success',
                filePath: 'attendance-2',
                uploadTime: '2026-02-01T16:00:00Z',
                details: {
                    timeStartStd: '2026-02-01T01:00:00Z',
                    timeEndStd: '2026-02-01T02:00:00Z',
                    durationMS: 60 * 60 * 1000,
                    players: [
                        {
                            account: 'player.1234',
                            name: 'Player One',
                            profession: 'Guardian',
                            notInSquad: false,
                            activeTimes: [60 * 60 * 1000],
                            dpsAll: [{ damage: 0 }],
                            statsAll: [{}],
                            support: [{}],
                            defenses: [{}]
                        }
                    ],
                    targets: [],
                    skillMap: {},
                    buffMap: {}
                }
            }
        ];

        const { stats } = computeStatsAggregation({ logs: logs as any[] });
        const attendanceRow = (stats.attendanceData || []).find((row: any) => row.account === 'player.1234');

        expect(attendanceRow).toBeTruthy();
        expect(Number(attendanceRow.combatTimeMs || 0)).toBe(2 * 60 * 60 * 1000);
        expect(Number(attendanceRow.squadTimeMs || 0)).toBe(2 * 60 * 60 * 1000);
    });
});
