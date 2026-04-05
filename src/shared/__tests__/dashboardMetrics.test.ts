import { describe, expect, it } from 'vitest';
import { getPlayerOutgoingInterrupts } from '../dashboardMetrics';
import type { Player } from '../dpsReportTypes';

describe('getPlayerOutgoingInterrupts', () => {
    it('sums interrupts across all targets', () => {
        const player = {
            statsTargets: [
                [{ interrupts: 3 }],
                [{ interrupts: 5 }],
                [{ interrupts: 2 }],
            ],
        } as unknown as Player;

        expect(getPlayerOutgoingInterrupts(player)).toBe(10);
    });

    it('returns 0 when statsTargets is missing', () => {
        const player = {} as unknown as Player;
        expect(getPlayerOutgoingInterrupts(player)).toBe(0);
    });

    it('returns 0 when statsTargets entries have no interrupts field', () => {
        const player = {
            statsTargets: [
                [{ killed: 1, downed: 2 }],
            ],
        } as unknown as Player;

        expect(getPlayerOutgoingInterrupts(player)).toBe(0);
    });

    it('handles empty target arrays gracefully', () => {
        const player = {
            statsTargets: [[], [{ interrupts: 4 }]],
        } as unknown as Player;

        expect(getPlayerOutgoingInterrupts(player)).toBe(4);
    });
});
