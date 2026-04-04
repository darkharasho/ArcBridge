import { describe, it, expect } from 'vitest';
import { computeStatsAggregation } from '../computeStatsAggregation';
import { IncrementalAggregator } from '../incrementalAggregation';
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
    it('produces identical stats to batch computeStatsAggregation', () => {
        const logs = makeLogs(fixture1, fixture2, fixture3);

        // Batch (existing)
        const batchResult = computeStatsAggregation({ logs });

        // Incremental (new)
        const aggregator = new IncrementalAggregator();
        for (const log of logs) {
            aggregator.ingestLog(log);
        }
        const incrementalResult = aggregator.finalize();

        // Stats should be deeply equal
        expect(incrementalResult.stats).toEqual(batchResult.stats);
        expect(incrementalResult.skillUsageData).toEqual(batchResult.skillUsageData);
    });

    it('produces identical stats for a single log', () => {
        const logs = makeLogs(fixture1);

        const batchResult = computeStatsAggregation({ logs });

        const aggregator = new IncrementalAggregator();
        aggregator.ingestLog(logs[0]);
        const incrementalResult = aggregator.finalize();

        expect(incrementalResult.stats).toEqual(batchResult.stats);
        expect(incrementalResult.skillUsageData).toEqual(batchResult.skillUsageData);
    });

    it('produces identical stats for empty input', () => {
        const batchResult = computeStatsAggregation({ logs: [] });
        const aggregator = new IncrementalAggregator();
        const incrementalResult = aggregator.finalize();

        expect(incrementalResult.stats).toEqual(batchResult.stats);
        expect(incrementalResult.skillUsageData).toEqual(batchResult.skillUsageData);
    });
});
