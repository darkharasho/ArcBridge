import { describe, expect, it } from 'vitest';
import { normalizeQueuedLogStatus } from '../app/hooks/useLogQueue';

describe('normalizeQueuedLogStatus', () => {
    it('keeps pending detail fetches in calculating', () => {
        const result = normalizeQueuedLogStatus({
            id: 'log-1',
            filePath: 'one.zevtc',
            permalink: 'https://dps.report/example',
            status: 'success',
            detailsStatus: 'available',
        } as ILogData);

        expect(result.status).toBe('calculating');
    });

    it('keeps calculating even with loaded status (promotion via aggregation only)', () => {
        const result = normalizeQueuedLogStatus({
            id: 'log-2',
            filePath: 'two.zevtc',
            permalink: 'https://dps.report/example',
            status: 'calculating',
            detailsStatus: 'loaded',
        } as ILogData);

        // normalizeQueuedLogStatus no longer promotes based on statsDetailsLoaded.
        // Promotion is handled by the aggregation-aware effect in App.tsx.
        expect(result.status).toBe('calculating');
    });

    it('keeps calculating when detailsStatus is available but stats not yet computed', () => {
        const result = normalizeQueuedLogStatus({
            id: 'log-2b',
            filePath: 'two-b.zevtc',
            permalink: 'https://dps.report/example',
            status: 'calculating',
            detailsStatus: 'available',
        } as ILogData);

        expect(result.status).toBe('calculating');
    });

    it('promotes calculating when details are known unavailable', () => {
        const result = normalizeQueuedLogStatus({
            id: 'log-3',
            filePath: 'three.zevtc',
            permalink: 'https://dps.report/example',
            status: 'calculating',
            detailsStatus: 'unavailable',
        } as ILogData);

        expect(result.status).toBe('success');
        expect(result.detailsStatus).toBe('unavailable');
    });
});
