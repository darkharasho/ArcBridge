import { useState, useEffect, useRef } from 'react';
import type { StatsWorkerRequest, StatsWorkerResponse, ILogData } from './types';
import type { DisruptionMethod, IMvpWeights, IStatsViewSettings } from '../../renderer/global.d';

interface UseStatsWorkerResult {
    stats: any | null;
    isComputing: boolean;
    progress: number;
    stage: string;
    error: string | null;
}

let taskIdCounter = 0;

export function useStatsWorker(
    logs: ILogData[],
    mvpWeights: IMvpWeights,
    statsViewSettings: IStatsViewSettings,
    disruptionMethod: DisruptionMethod,
    precomputedStats?: any
): UseStatsWorkerResult {
    const [stats, setStats] = useState<any | null>(precomputedStats || null);
    const [isComputing, setIsComputing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [stage, setStage] = useState('');
    const [error, setError] = useState<string | null>(null);

    const workerRef = useRef<Worker | null>(null);
    const currentTaskIdRef = useRef<string | null>(null);

    // Create worker on mount
    useEffect(() => {
        // Skip if Web Workers not supported
        if (typeof Worker === 'undefined') {
            console.warn('[useStatsWorker] Web Workers not supported');
            return;
        }

        try {
            // Import worker using Vite's worker syntax
            const worker = new Worker(
                new URL('./statsWorker.ts', import.meta.url),
                { type: 'module' }
            );

            worker.onmessage = (event: MessageEvent<StatsWorkerResponse>) => {
                const response = event.data;

                if (response.type === 'READY') {
                    return;
                }

                // Ignore responses for old tasks
                if (response.id !== currentTaskIdRef.current) {
                    return;
                }

                switch (response.type) {
                    case 'STATS_RESULT':
                        setStats(response.stats);
                        setIsComputing(false);
                        setProgress(100);
                        setStage('Complete');
                        break;
                    case 'PROGRESS':
                        setProgress(response.percent);
                        setStage(response.stage);
                        break;
                    case 'ERROR':
                        setError(response.error);
                        setIsComputing(false);
                        break;
                }
            };

            worker.onerror = (err) => {
                console.error('[useStatsWorker] Worker error:', err);
                setError(err.message || 'Worker error');
                setIsComputing(false);
            };

            workerRef.current = worker;
        } catch (err: any) {
            console.error('[useStatsWorker] Failed to create worker:', err);
            setError(err?.message || 'Failed to create worker');
        }

        return () => {
            workerRef.current?.terminate();
            workerRef.current = null;
        };
    }, []);

    // Compute stats when inputs change
    useEffect(() => {
        // Use precomputed stats if available
        if (precomputedStats) {
            setStats(precomputedStats);
            setIsComputing(false);
            return;
        }

        // Skip if no logs
        const validLogs = logs.filter(log => log.details && !log.error);
        if (validLogs.length === 0) {
            setStats(null);
            setIsComputing(false);
            return;
        }

        // Skip if no worker
        if (!workerRef.current) {
            // Fallback: could compute synchronously here
            console.warn('[useStatsWorker] No worker available');
            return;
        }

        // Generate task ID
        const taskId = `stats_${++taskIdCounter}_${Date.now()}`;
        currentTaskIdRef.current = taskId;

        // Reset state
        setIsComputing(true);
        setProgress(0);
        setStage('Preparing...');
        setError(null);

        // Send computation request
        const request: StatsWorkerRequest = {
            type: 'COMPUTE_STATS',
            id: taskId,
            input: {
                logs: validLogs,
                mvpWeights,
                statsViewSettings,
                disruptionMethod
            }
        };

        workerRef.current.postMessage(request);
    }, [logs, mvpWeights, statsViewSettings, disruptionMethod, precomputedStats]);

    return {
        stats,
        isComputing,
        progress,
        stage,
        error
    };
}
