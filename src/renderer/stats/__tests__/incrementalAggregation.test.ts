import { describe, it, expect } from 'vitest';
import { IncrementalAggregator, computeStatsSync } from '../incrementalAggregation';
import fixture1 from '../../../../test-fixtures/boon/20260117-175120.json';
import fixture2 from '../../../../test-fixtures/boon/20260117-180135.json';
import fixture3 from '../../../../test-fixtures/boon/20260117-180259.json';

const makeLogs = (...fixtures: any[]) =>
    fixtures.map((f, i) => ({
        id: `log-${i}`,
        filePath: `test-${i}.zevtc`,
        details: f,
    }));

describe('IncrementalAggregator', () => {
    it('computeStatsSync produces valid stats for multiple logs', () => {
        const logs = makeLogs(fixture1, fixture2, fixture3);
        const result = computeStatsSync({ logs });

        expect(result.stats).toBeTruthy();
        expect(result.stats.total).toBe(3);
        expect(result.skillUsageData).toBeTruthy();
    });

    it('computeStatsSync produces valid stats for a single log', () => {
        const logs = makeLogs(fixture1);
        const result = computeStatsSync({ logs });

        expect(result.stats).toBeTruthy();
        expect(result.stats.total).toBe(1);
        expect(result.skillUsageData).toBeTruthy();
    });

    it('IncrementalAggregator produces valid stats via ingest+finalize', () => {
        const logs = makeLogs(fixture1, fixture2, fixture3);
        const aggregator = new IncrementalAggregator();
        for (const log of logs) {
            aggregator.ingestLog(log);
        }
        const result = aggregator.finalize();

        expect(result.stats).toBeTruthy();
        expect(result.stats.total).toBe(3);
        expect(result.skillUsageData).toBeTruthy();
    });

    it('produces valid output for empty input', () => {
        const result = computeStatsSync({ logs: [] });

        expect(result.stats).toBeTruthy();
        expect(result.stats.total).toBe(0);
    });
});
