import { useMemo, useRef } from 'react';

type DashboardLogSummary = {
    statusKey: string;
    hasPlayers: boolean;
    hasTargets: boolean;
    squadCount: number;
    enemyCount: number;
    isWin: boolean | null;
    squadDeaths: number;
    enemyDeaths: number;
};

type DashboardSummaryCacheEntry = {
    logRef: ILogData;
    status: ILogData['status'];
    error: any;
    detailsStatus: ILogData['detailsStatus'];
    summary: DashboardLogSummary;
};

const resolveDashboardStatus = (log: ILogData) => {
    if (log.error || log.status === 'error') return 'error';
    if (log.status === 'success') return 'success';
    if (log.status === 'queued' || log.status === 'pending' || log.status === 'uploading' || log.status === 'retrying' || log.status === 'discord') {
        return log.status;
    }
    if (log.status === 'calculating') return 'calculating';
    return log.status || 'queued';
};

const buildDashboardLogSummary = (log: ILogData): DashboardLogSummary => {
    const precomputed = (log as any)?.dashboardSummary;
    if (precomputed && typeof precomputed === 'object') {
        const hasPlayers = Boolean(precomputed.hasPlayers);
        const hasTargets = Boolean(precomputed.hasTargets);
        return {
            statusKey: resolveDashboardStatus(log),
            hasPlayers,
            hasTargets,
            squadCount: Math.max(0, Number(precomputed.squadCount || 0)),
            enemyCount: Math.max(0, Number(precomputed.enemyCount || 0)),
            isWin: precomputed.isWin === true ? true : precomputed.isWin === false ? false : null,
            squadDeaths: Math.max(0, Number(precomputed.squadDeaths || 0)),
            enemyDeaths: Math.max(0, Number(precomputed.enemyDeaths || 0))
        };
    }

    // No dashboardSummary available — return empty summary (details no longer kept in logs state)
    return {
        statusKey: resolveDashboardStatus(log),
        hasPlayers: false,
        hasTargets: false,
        squadCount: 0,
        enemyCount: 0,
        isWin: null,
        squadDeaths: 0,
        enemyDeaths: 0
    };
};

const UPLOAD_STATUS_BREAKDOWN = [
    { key: 'queued', label: 'Queued', color: '#94a3b8' },
    { key: 'pending', label: 'Pending', color: '#f59e0b' },
    { key: 'uploading', label: 'Uploading', color: '#38bdf8' },
    { key: 'retrying', label: 'Retrying', color: '#0ea5e9' },
    { key: 'discord', label: 'Discord', color: '#a78bfa' },
    { key: 'calculating', label: 'Calculating', color: '#facc15' },
    { key: 'success', label: 'Success', color: '#34d399' },
    { key: 'error', label: 'Error', color: '#f87171' }
] as const;

export function useDashboardStats(logs: ILogData[]) {
    const dashboardSummaryCacheRef = useRef<Map<string, DashboardSummaryCacheEntry>>(new Map());

    return useMemo(() => {
        const totalUploads = logs.length;
        const previousCache = dashboardSummaryCacheRef.current;
        const nextCache = new Map<string, DashboardSummaryCacheEntry>();
        const statusCounts: Record<string, number> = {};
        let logsWithPlayerDetails = 0;
        let logsWithTargetDetails = 0;
        let totalSquadSize = 0;
        let totalEnemySize = 0;
        let wins = 0;
        let losses = 0;
        let totalSquadDeaths = 0;
        let totalEnemyDeaths = 0;

        logs.forEach((log, index) => {
            const cacheKey = String(log.filePath || log.id || `idx-${index}`);
            const cached = previousCache.get(cacheKey);
            const canReuse = Boolean(
                cached
                && cached.logRef === log
                && cached.status === log.status
                && cached.error === log.error
                && cached.detailsStatus === log.detailsStatus
            );
            const summary = canReuse ? cached!.summary : buildDashboardLogSummary(log);
            nextCache.set(cacheKey, {
                logRef: log,
                status: log.status,
                error: log.error,
                detailsStatus: log.detailsStatus,
                summary
            });

            statusCounts[summary.statusKey] = (statusCounts[summary.statusKey] || 0) + 1;
            if (summary.hasPlayers) {
                logsWithPlayerDetails += 1;
                totalSquadSize += summary.squadCount;
            }
            if (summary.hasTargets) {
                logsWithTargetDetails += 1;
                totalEnemySize += summary.enemyCount;
            }
            if (summary.isWin === true) wins += 1;
            else if (summary.isWin === false) losses += 1;
            totalSquadDeaths += summary.squadDeaths;
            totalEnemyDeaths += summary.enemyDeaths;
        });
        dashboardSummaryCacheRef.current = nextCache;

        const uploadStatusBreakdown = UPLOAD_STATUS_BREAKDOWN.map((entry) => ({
            ...entry,
            count: statusCounts[entry.key] || 0
        }));
        const knownStatusKeys = new Set<string>(uploadStatusBreakdown.map((entry) => entry.key));
        const otherStatusCount = Object.entries(statusCounts).reduce((sum, [status, count]) => {
            if (knownStatusKeys.has(status)) return sum;
            return sum + count;
        }, 0);
        if (otherStatusCount > 0) {
            (uploadStatusBreakdown as any[]).push({ key: 'other', label: 'Other', color: '#9ca3af', count: otherStatusCount });
        }
        const uploadHasAnyStatus = uploadStatusBreakdown.some((entry) => entry.count > 0);
        const uploadPieData = uploadHasAnyStatus
            ? uploadStatusBreakdown
            : [{ key: 'none', label: 'No logs', color: '#334155', count: 1 }];

        const avgSquadSize = logsWithPlayerDetails > 0
            ? Math.round(totalSquadSize / logsWithPlayerDetails)
            : 0;
        const avgEnemies = logsWithTargetDetails > 0
            ? Math.round(totalEnemySize / logsWithTargetDetails)
            : 0;
        const winLoss = { wins, losses };
        const denom = totalSquadDeaths === 0 ? 1 : totalSquadDeaths;
        const squadKdr = Number((totalEnemyDeaths / denom).toFixed(2));

        return { totalUploads, statusCounts, uploadPieData, avgSquadSize, avgEnemies, winLoss, squadKdr };
    }, [logs]);
}
