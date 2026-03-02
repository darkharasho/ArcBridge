import { useMemo } from 'react';

export interface StatsDataProgress {
    active: boolean;
    total: number;
    processed: number;
    pending: number;
    unavailable: number;
}

export function useStatsDataProgress(
    logs: ILogData[],
    view: string,
    isBulkUploadActive: boolean
): StatsDataProgress {
    return useMemo(() => {
        const total = logs.length;
        if (view !== 'stats') {
            return {
                active: false,
                total,
                processed: total,
                pending: 0,
                unavailable: 0
            };
        }
        if (total <= 0) {
            return {
                active: false,
                total: 0,
                processed: 0,
                pending: 0,
                unavailable: 0
            };
        }
        let pending = 0;
        let unavailable = 0;
        logs.forEach((log) => {
            if (log.details || log.statsDetailsLoaded) {
                return;
            }
            if (log.detailsKnownUnavailable) {
                unavailable += 1;
                return;
            }
            if (log.detailsAvailable) {
                pending += 1;
                return;
            }
            const status = log.status || 'queued';
            const canHydrateFromPermalink = (status === 'success' || status === 'calculating' || status === 'discord') && Boolean(log.permalink) && !log.detailsFetchExhausted;
            if (canHydrateFromPermalink) {
                pending += 1;
                return;
            }
            const inFlightStatus = status === 'queued'
                || status === 'pending'
                || status === 'uploading'
                || status === 'retrying'
                || status === 'discord'
                || status === 'calculating';
            if (inFlightStatus) {
                if (isBulkUploadActive) {
                    pending += 1;
                } else {
                    unavailable += 1;
                }
                return;
            }
            unavailable += 1;
        });
        const processed = Math.max(0, total - pending);
        return {
            active: pending > 0,
            total,
            processed,
            pending,
            unavailable
        };
    }, [logs, view, isBulkUploadActive]);
}
