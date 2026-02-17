import { describe, expect, it } from 'vitest';
import { shouldAttemptStatsSyncRecovery } from '../stats/utils/statsSyncRecovery';

describe('shouldAttemptStatsSyncRecovery', () => {
    const makeInput = (overrides?: Partial<Parameters<typeof shouldAttemptStatsSyncRecovery>[0]>) => ({
        view: 'stats' as const,
        bulkUploadMode: false,
        liveLogs: [{ id: 'live-1' }],
        statsLogs: [{ id: 'stats-1', details: { players: [{ name: 'Player' }] } }],
        progress: { total: 1, pending: 0, unavailable: 0 },
        ...(overrides || {})
    });

    it('returns true when stats snapshot is empty while live logs exist', () => {
        const result = shouldAttemptStatsSyncRecovery(makeInput({
            statsLogs: [],
            progress: { total: 5, pending: 0, unavailable: 0 }
        }));
        expect(result).toBe(true);
    });

    it('returns true when snapshot has no usable details but progress indicates recoverable state', () => {
        const result = shouldAttemptStatsSyncRecovery(makeInput({
            statsLogs: [{ id: 'stats-1' }],
            progress: { total: 4, pending: 0, unavailable: 1 }
        }));
        expect(result).toBe(true);
    });

    it('returns false when all fights are unavailable', () => {
        const result = shouldAttemptStatsSyncRecovery(makeInput({
            statsLogs: [{ id: 'stats-1' }],
            progress: { total: 4, pending: 0, unavailable: 4 }
        }));
        expect(result).toBe(false);
    });

    it('returns false outside stats view', () => {
        const result = shouldAttemptStatsSyncRecovery(makeInput({
            view: 'dashboard'
        }));
        expect(result).toBe(false);
    });

    it('returns false during bulk upload mode', () => {
        const result = shouldAttemptStatsSyncRecovery(makeInput({
            bulkUploadMode: true
        }));
        expect(result).toBe(false);
    });
});

