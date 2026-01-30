import type { DisruptionMethod, IMvpWeights, IStatsViewSettings } from '../../renderer/global.d';

// Input for the stats worker
export interface StatsWorkerInput {
    logs: ILogData[];
    mvpWeights: IMvpWeights;
    statsViewSettings: IStatsViewSettings;
    disruptionMethod: DisruptionMethod;
}

// Simplified interface for log data passed to worker
export interface ILogData {
    id?: string;
    permalink?: string;
    filePath?: string;
    status?: string;
    error?: string;
    uploadTime?: number;
    encounterDuration?: string;
    fightName?: string;
    details?: any;
    eiDetails?: any;
}

// Request messages to worker
export type StatsWorkerRequest =
    | { type: 'COMPUTE_STATS'; id: string; input: StatsWorkerInput }
    | { type: 'CANCEL'; id: string };

// Response messages from worker
export type StatsWorkerResponse =
    | { type: 'STATS_RESULT'; id: string; stats: any }
    | { type: 'PROGRESS'; id: string; percent: number; stage: string }
    | { type: 'ERROR'; id: string; error: string }
    | { type: 'READY' };
