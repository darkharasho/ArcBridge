type AppView = 'dashboard' | 'stats' | 'history' | 'settings';

type RecoveryProgress = {
    total: number;
    pending: number;
    unavailable: number;
};

const hasUsableStatsDetails = (entry: any) => {
    const players = Array.isArray(entry?.details?.players) ? entry.details.players : [];
    return players.length > 0;
};

export const shouldAttemptStatsSyncRecovery = ({
    view,
    bulkUploadMode,
    liveLogs,
    statsLogs,
    progress
}: {
    view: AppView;
    bulkUploadMode: boolean;
    liveLogs: any[];
    statsLogs: any[];
    progress: RecoveryProgress;
}) => {
    if (view !== 'stats') return false;
    if (bulkUploadMode) return false;
    if (!Array.isArray(liveLogs) || liveLogs.length === 0) return false;

    const statsTotal = Array.isArray(statsLogs) ? statsLogs.length : 0;
    const statsHasUsableDetails = Array.isArray(statsLogs) && statsLogs.some((entry) => hasUsableStatsDetails(entry));
    const shouldRecoverEmptySnapshot = statsTotal === 0;
    const shouldRecoverNoDetails = !statsHasUsableDetails
        && Number(progress?.pending || 0) === 0
        && Number(progress?.total || 0) > 0
        && Number(progress?.unavailable || 0) < Number(progress?.total || 0);

    return shouldRecoverEmptySnapshot || shouldRecoverNoDetails;
};

