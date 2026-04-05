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
    it('computeStatsSync produces same result as manual ingest+finalize', () => {
        const logs = makeLogs(fixture1, fixture2, fixture3);

        const syncResult = computeStatsSync({ logs });

        const aggregator = new IncrementalAggregator();
        for (const log of logs) {
            aggregator.ingestLog(log);
        }
        const incrementalResult = aggregator.finalize();

        expect(incrementalResult.stats).toEqual(syncResult.stats);
        expect(incrementalResult.skillUsageData).toEqual(syncResult.skillUsageData);
    });

    it('produces identical stats for a single log', () => {
        const logs = makeLogs(fixture1);

        const syncResult = computeStatsSync({ logs });

        const aggregator = new IncrementalAggregator();
        aggregator.ingestLog(logs[0]);
        const incrementalResult = aggregator.finalize();

        expect(incrementalResult.stats).toEqual(syncResult.stats);
        expect(incrementalResult.skillUsageData).toEqual(syncResult.skillUsageData);
    });

    it('produces valid output for empty input', () => {
        const aggregator = new IncrementalAggregator();
        const result = aggregator.finalize();

        const syncResult = computeStatsSync({ logs: [] });

        expect(result.stats).toEqual(syncResult.stats);
        expect(result.skillUsageData).toEqual(syncResult.skillUsageData);
    });
});
