import { computeStatsAggregation } from './computeStatsAggregation';
import type { DisruptionMethod, IMvpWeights, IStatsViewSettings } from '../global.d';

export interface IncrementalAggregatorOptions {
    precomputedStats?: any;
    mvpWeights?: IMvpWeights;
    statsViewSettings?: IStatsViewSettings;
    disruptionMethod?: DisruptionMethod;
}

export class IncrementalAggregator {
    private logs: any[] = [];
    private options: IncrementalAggregatorOptions;

    constructor(options: IncrementalAggregatorOptions = {}) {
        this.options = options;
    }

    /** Process a single log and accumulate results. */
    ingestLog(log: any): void {
        this.logs.push(log);
    }

    /** Finalize aggregation and return the result. Clears internal state. */
    finalize(): { stats: any; skillUsageData: any } {
        const { stats, skillUsageData } = computeStatsAggregation({
            logs: this.logs,
            ...this.options,
        });
        this.logs = [];
        return { stats, skillUsageData };
    }
}
