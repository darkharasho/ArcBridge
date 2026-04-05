import { useMemo } from 'react';
import { computeStatsSync } from '../incrementalAggregation';
import type { DisruptionMethod, IMvpWeights, IStatsViewSettings } from '../../global.d';

interface UseStatsAggregationProps {
    logs: any[];
    precomputedStats?: any;
    mvpWeights?: IMvpWeights;
    statsViewSettings?: IStatsViewSettings;
    disruptionMethod?: DisruptionMethod;
}

export const useStatsAggregation = ({ logs, precomputedStats, mvpWeights, statsViewSettings, disruptionMethod }: UseStatsAggregationProps) => {
    return useMemo(
        () => computeStatsSync({ logs, precomputedStats, mvpWeights, statsViewSettings, disruptionMethod }),
        [logs, precomputedStats, mvpWeights, statsViewSettings, disruptionMethod]
    );
};
