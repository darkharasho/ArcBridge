import { Activity, Crown, Crosshair, Flame, Hammer, HelpingHand, Shield, ShieldCheck, Sparkles, Star, Trophy, Wind, Zap } from 'lucide-react';
import { useStatsSharedContext } from '../StatsViewContext';

type TopPlayersSectionProps = {
    showTopStats: boolean;
    showMvp: boolean;
    topStatsMode: 'total' | 'perSecond' | 'perMinute';
    expandedLeader: string | null;
    setExpandedLeader: (value: string | null | ((prev: string | null) => string | null)) => void;
    formatTopStatValue: (value: number) => string;
    isMvpStatEnabled: (name: string) => boolean;
};

const colorClasses: Record<string, { bg: string; text: string }> = {
    red: { bg: 'bg-red-500/20', text: 'text-red-400' },
    yellow: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
    green: { bg: 'bg-green-500/20', text: 'text-green-400' },
    purple: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
    blue: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
    pink: { bg: 'bg-pink-500/20', text: 'text-pink-400' },
    cyan: { bg: 'bg-cyan-500/20', text: 'text-cyan-400' },
    indigo: { bg: 'bg-indigo-500/20', text: 'text-indigo-400' }
};

const LeaderCard = ({ icon: Icon, title, data, color, unit = '', onClick, active, rows, formatValue, renderProfessionIcon }: any) => {
    const classes = colorClasses[color] || colorClasses.blue;
    const value = data?.value ?? 0;
    const displayValue = formatValue ? formatValue(value) : Math.round(value).toLocaleString();
    return (
        <div
            role="button"
            tabIndex={0}
            onClick={onClick}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onClick?.();
                }
            }}
            className={`bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-3 group hover:bg-white/10 transition-colors cursor-pointer ${active ? 'ring-1 ring-white/20' : ''}`}
        >
            <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg ${classes.bg} ${classes.text} shrink-0`}>
                    <Icon className="w-6 h-6" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="text-gray-400 text-xs font-bold uppercase tracking-wider truncate">{title}</div>
                    <div className="text-2xl font-bold text-white mt-0.5 break-words">
                        {displayValue} <span className="text-sm font-normal text-gray-500">{unit}</span>
                    </div>
                </div>
            </div>
            <div className="flex flex-col border-t border-white/5 pt-2">
                <div className="flex items-center gap-2 min-w-0">
                    {renderProfessionIcon(data?.profession || 'Unknown', data?.professionList, 'w-4 h-4')}
                    <div className="text-sm font-medium text-blue-300 truncate">{data?.player || '-'}</div>
                </div>
                <div className="text-xs text-gray-500 truncate">{data?.count ? `${data.count} logs` : '-'}</div>
            </div>
            {active && (
                <div className="mt-3 stats-share-exclude">
                    <div className="text-xs font-semibold text-gray-200 mb-2">{title}</div>
                    {rows?.length ? (
                        <div className="max-h-56 overflow-y-auto pr-1 space-y-1">
                            {rows.map((row: any) => (
                                <div key={`${title}-${row.rank}-${row.account}`} className="flex items-center gap-2 min-w-0 text-xs text-gray-300">
                                    <div className="w-6 shrink-0 text-right text-gray-500">{row.rank}</div>
                                    <div className="shrink-0">
                                        {renderProfessionIcon(row.profession, row.professionList, 'w-4 h-4')}
                                    </div>
                                    <div className="flex-1 min-w-0 truncate">{row.account}</div>
                                    <div className="shrink-0 text-gray-400 font-mono">{formatValue ? formatValue(row.value) : row.value}</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-xs text-gray-500 italic">No data available</div>
                    )}
                </div>
            )}
        </div>
    );
};

const normalizeLeaderboardRows = (rows: any[], higherIsBetter: boolean) => {
    const normalized = (Array.isArray(rows) ? rows : [])
        .map((row) => ({ ...row, value: Number(row?.value ?? 0) }))
        .filter((row) => Number.isFinite(row.value))
        .sort((a, b) => {
            const diff = higherIsBetter ? (b.value - a.value) : (a.value - b.value);
            if (diff !== 0) return diff;
            return String(a?.account || '').localeCompare(String(b?.account || ''));
        });

    let lastValue: number | null = null;
    let lastRank = 0;
    return normalized.map((row, index) => {
        if (lastValue === null || row.value !== lastValue) {
            lastRank = index + 1;
            lastValue = row.value;
        }
        return { ...row, rank: lastRank };
    });
};

const formatMvpPillValue = (value: unknown, formatTopStatValue: (n: number) => string) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return formatTopStatValue(value);
    }
    if (typeof value === 'string') {
        const parsed = Number(value.replace(/,/g, '').trim());
        if (Number.isFinite(parsed)) {
            return formatTopStatValue(parsed);
        }
        return value;
    }
    return '--';
};

export const TopPlayersSection = ({
    showTopStats,
    showMvp,
    topStatsMode,
    expandedLeader,
    setExpandedLeader,
    formatTopStatValue,
    isMvpStatEnabled
}: TopPlayersSectionProps) => {
    const { stats, formatWithCommas, renderProfessionIcon, isSectionVisible, isFirstVisibleSection, sectionClass } = useStatsSharedContext();
    if (!showTopStats) return null;
    const offenseMvp = stats.offensiveMvp || stats.mvp;
    const offenseSilver = stats.offensiveSilver || stats.silver;
    const offenseBronze = stats.offensiveBronze || stats.bronze;
    const defenseMvp = stats.defensiveMvp || stats.mvp;
    const defenseSilver = stats.defensiveSilver || stats.silver;
    const defenseBronze = stats.defensiveBronze || stats.bronze;
    const offenseAvg = Number.isFinite(stats.offensiveAvgMvpScore) ? stats.offensiveAvgMvpScore : (stats.avgMvpScore || 0);
    const defenseAvg = Number.isFinite(stats.defensiveAvgMvpScore) ? stats.defensiveAvgMvpScore : (stats.avgMvpScore || 0);
    return (
        <div
            id="top-players"
            data-section-visible={isSectionVisible('top-players')}
            data-section-first={isFirstVisibleSection('top-players')}
            className={sectionClass('top-players', 'scroll-mt-24')}
        >
            <h3 className="text-lg font-bold text-gray-200 mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-400" />
                Top Players
            </h3>
            {showMvp && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                    {[
                        {
                            key: 'offense',
                            title: 'Offensive MVP',
                            accent: 'text-orange-300',
                            accentSoft: 'text-orange-200/80',
                            accentBorder: 'border-orange-500/35',
                            accentBg: 'bg-orange-500/12',
                            accentLabelBorder: 'border-orange-500/35',
                            accentBlob: 'bg-orange-500/15 group-hover:bg-orange-500/25',
                            goldCardBorder: 'border-amber-400/40',
                            goldIconWrap: 'bg-amber-500/25 border-amber-300/40 shadow-[0_0_20px_rgba(251,191,36,0.25)]',
                            goldIconBadgeWrap: 'bg-orange-500/80 border-orange-200/40',
                            goldIconBadge: 'text-orange-50',
                            goldReasonIcon: 'text-amber-300',
                            goldScoreTitle: 'text-amber-300/60',
                            goldScoreValue: 'text-amber-300',
                            goldScoreMeta: 'text-amber-200/60',
                            goldStatRow: 'border-amber-400/30 bg-amber-500/10',
                            gold: offenseMvp,
                            silver: offenseSilver,
                            bronze: offenseBronze,
                            avg: offenseAvg
                        },
                        {
                            key: 'defense',
                            title: 'Defensive MVP',
                            accent: 'text-emerald-300',
                            accentSoft: 'text-emerald-200/80',
                            accentBorder: 'border-emerald-500/35',
                            accentBg: 'bg-emerald-500/12',
                            accentLabelBorder: 'border-emerald-500/35',
                            accentBlob: 'bg-emerald-500/15 group-hover:bg-emerald-500/25',
                            goldCardBorder: 'border-cyan-400/40',
                            goldIconWrap: 'bg-cyan-500/20 border-cyan-300/40 shadow-[0_0_20px_rgba(34,211,238,0.25)]',
                            goldIconBadgeWrap: 'bg-cyan-500/80 border-cyan-200/40',
                            goldIconBadge: 'text-cyan-50',
                            goldReasonIcon: 'text-cyan-300',
                            goldScoreTitle: 'text-cyan-300/60',
                            goldScoreValue: 'text-cyan-300',
                            goldScoreMeta: 'text-cyan-200/60',
                            goldStatRow: 'border-cyan-400/30 bg-cyan-500/10',
                            gold: defenseMvp,
                            silver: defenseSilver,
                            bronze: defenseBronze,
                            avg: defenseAvg
                        }
                    ].map((group) => (
                        <div key={group.title} className={`mvp-group mvp-group--${group.key} relative grid grid-cols-1 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,0.9fr)] gap-3 rounded-2xl p-2 pt-4 border ${group.accentBorder} ${group.accentBg}`}>
                            <div className={`mvp-group-label absolute -top-[9px] left-3 inline-flex items-center gap-2 px-2 rounded-sm bg-slate-950 border ${group.accentLabelBorder}`}>
                                <Sparkles className={`mvp-group-label-icon w-4 h-4 ${group.accent}`} />
                                <span className="mvp-group-label-title font-bold uppercase tracking-widest text-xs text-gray-200">{group.title}</span>
                            </div>
                            <div className={`mvp-card mvp-card--gold border rounded-2xl p-3 min-h-[182px] relative overflow-visible z-0 group hover:z-20 flex items-center ${group.goldCardBorder}`}>
                                <div className={`absolute top-0 right-0 w-64 h-64 blur-[80px] rounded-full pointer-events-none transition-all ${group.accentBlob}`} />
                                <div className="flex items-center gap-5 relative z-10 w-full">
                                    <div className={`hidden sm:flex items-center justify-center w-20 h-20 rounded-full border relative ${group.goldIconWrap}`}>
                                        <Crown className="w-10 h-10 text-yellow-400" />
                                        <span className={`absolute -bottom-1 -right-1 inline-flex items-center justify-center w-6 h-6 rounded-full border ${group.goldIconBadgeWrap}`}>
                                            {group.key === 'offense'
                                                ? <Flame className={`w-3.5 h-3.5 ${group.goldIconBadge}`} />
                                                : <ShieldCheck className={`w-3.5 h-3.5 ${group.goldIconBadge}`} />}
                                        </span>
                                    </div>
                                    <div className="flex-1 flex flex-col h-full">
                                        <div className="text-2xl sm:text-3xl font-black text-white mb-2 flex flex-wrap items-center gap-2 sm:gap-3">
                                            <span className="min-w-0 max-w-full truncate">{group.gold?.account || 'None'}</span>
                                            {renderProfessionIcon(group.gold?.profession || 'Unknown', group.gold?.professionList, 'w-6 h-6')}
                                            <span className="text-sm sm:text-lg font-medium text-yellow-200/70 bg-white/5 px-2 py-0.5 rounded border border-yellow-500/20 max-w-full truncate">
                                                {group.gold?.profession || 'Unknown'}
                                            </span>
                                        </div>
                                        <p className={`italic flex items-center gap-2 mb-2 ${group.accentSoft}`}>
                                            <Star className={`w-4 h-4 fill-yellow-500/40 ${group.goldReasonIcon}`} />
                                            <span className="truncate">"{group.gold?.reason || 'Top Performance'}"</span>
                                        </p>
                                        <div className="mt-auto min-h-[66px]">
                                            <div className="space-y-1.5">
                                                {(group.gold?.topStats || []).filter((stat: any) => isMvpStatEnabled(stat.name)).slice(0, 3).map((stat: any, i: number) => (
                                                    <div key={i} className={`flex items-center justify-between gap-3 px-2 py-1.5 rounded-md border text-xs leading-normal ${group.goldStatRow}`}>
                                                        <span className="text-yellow-200/90 font-semibold truncate leading-normal">{stat.name}</span>
                                                        <span className="text-yellow-100 font-mono tabular-nums shrink-0 leading-normal">{formatMvpPillValue(stat.val, formatTopStatValue)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="hidden lg:block text-right">
                                        <div className={`font-mono text-sm uppercase tracking-wider font-bold ${group.goldScoreTitle}`}>{group.title}</div>
                                        <div className={`text-4xl font-black ${group.goldScoreValue}`}>{group.gold?.score > 0 ? group.gold.score.toFixed(1) : '-'}</div>
                                        <div className={`text-xs font-mono mt-1 ${group.goldScoreMeta}`}>Avg: {group.avg.toFixed(1)}</div>
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 xl:grid-cols-1 gap-3">
                                {[
                                    { label: 'Silver', data: group.silver },
                                    { label: 'Bronze', data: group.bronze }
                                ].map((entry) => (
                                    <div
                                        key={`${group.title}-${entry.label}`}
                                        className={`mvp-card mvp-card--${entry.label.toLowerCase()} border border-white/10 rounded-2xl p-3 min-h-[126px] relative overflow-visible z-0 group hover:z-20 flex flex-col`}
                                    >
                                        <div className={`absolute top-0 right-0 w-48 h-48 rounded-full blur-[70px] pointer-events-none transition-all ${entry.label === 'Silver'
                                            ? 'bg-slate-300/15 group-hover:bg-slate-300/25'
                                            : 'bg-orange-400/15 group-hover:bg-orange-400/25'
                                            }`} />
                                        <div className="flex items-center justify-between mb-1">
                                            <div className={`text-xs uppercase tracking-widest font-semibold ${entry.label === 'Silver' ? 'text-slate-200' : 'text-orange-200'}`}>
                                                {entry.label}
                                            </div>
                                            <div className="text-xs text-gray-500 font-mono">
                                                {entry.data?.score ? entry.data.score.toFixed(1) : '-'}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 mb-2">
                                            {entry.data && renderProfessionIcon(entry.data.profession, entry.data.professionList, 'w-6 h-6')}
                                            <div className="min-w-0 flex-1">
                                                <div className={`text-base font-semibold ${entry.label === 'Silver' ? 'text-slate-100' : 'text-orange-100'} truncate`}>
                                                    {entry.data?.account || '—'}
                                                </div>
                                                <div className={`text-xs ${entry.label === 'Silver' ? 'text-slate-300/70' : 'text-orange-200/70'} truncate`}>
                                                    {entry.data?.profession || 'Unknown'}
                                                </div>
                                            </div>
                                        </div>
                                        {entry.data?.topStats?.some((stat: any) => isMvpStatEnabled(stat.name)) ? (
                                            <div className={`mt-auto min-h-[46px] text-xs ${entry.label === 'Silver' ? 'text-slate-200' : 'text-orange-200'}`}>
                                                <div className="space-y-1.5">
                                                    {entry.data.topStats.filter((stat: any) => isMvpStatEnabled(stat.name)).slice(0, 2).map((stat: any, idx: number) => (
                                                        <div
                                                            key={idx}
                                                            className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-md border leading-normal ${entry.label === 'Silver'
                                                                ? 'bg-slate-400/10 border-slate-300/30'
                                                                : 'bg-orange-500/10 border-orange-400/30'
                                                                }`}
                                                        >
                                                            <span className="truncate leading-normal">{stat.name}</span>
                                                            <span className="tabular-nums shrink-0 leading-normal">{formatMvpPillValue(stat.val, formatTopStatValue)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {(() => {
                const isPerSecond = topStatsMode === 'perSecond';
                const isPerMinute = topStatsMode === 'perMinute';
                const topStatsData = isPerSecond && stats.topStatsPerSecond
                    ? stats.topStatsPerSecond
                    : isPerMinute && stats.topStatsPerMinute
                        ? stats.topStatsPerMinute
                        : stats;
                const topStatsLeaderboards = isPerSecond && stats.topStatsLeaderboardsPerSecond
                    ? stats.topStatsLeaderboardsPerSecond
                    : isPerMinute && stats.topStatsLeaderboardsPerMinute
                        ? stats.topStatsLeaderboardsPerMinute
                        : stats.leaderboards;
                const titlePrefix = (isPerSecond || isPerMinute) ? '' : 'Total ';
                const titleSuffix = isPerSecond ? ' /s' : isPerMinute ? ' /m' : '';
                const leaderCards = [
                    { icon: HelpingHand, title: `Down Contribution${titleSuffix}`, data: topStatsData.maxDownContrib, color: 'red', statKey: 'downContrib', higherIsBetter: true },
                    { icon: Shield, title: `${titlePrefix}Barrier${titleSuffix}`, data: topStatsData.maxBarrier, color: 'yellow', statKey: 'barrier', higherIsBetter: true },
                    { icon: Activity, title: `${titlePrefix}Healing${titleSuffix}`, data: topStatsData.maxHealing, color: 'green', statKey: 'healing', higherIsBetter: true },
                    { icon: Wind, title: `${titlePrefix}Dodges${titleSuffix}`, data: topStatsData.maxDodges, color: 'cyan', statKey: 'dodges', higherIsBetter: true },
                    { icon: Zap, title: `${titlePrefix}Strips${titleSuffix}`, data: topStatsData.maxStrips, color: 'purple', statKey: 'strips', higherIsBetter: true },
                    { icon: Flame, title: `${titlePrefix}Cleanses${titleSuffix}`, data: topStatsData.maxCleanses, color: 'blue', statKey: 'cleanses', higherIsBetter: true },
                    { icon: Hammer, title: `${titlePrefix}CC${titleSuffix}`, data: topStatsData.maxCC, color: 'pink', statKey: 'cc', higherIsBetter: true },
                    { icon: ShieldCheck, title: `${titlePrefix}Stab Gen${titleSuffix}`, data: topStatsData.maxStab, color: 'cyan', statKey: 'stability', higherIsBetter: true },
                    { icon: Crosshair, title: 'Closest to Tag', data: topStatsData.closestToTag, color: 'indigo', unit: 'dist', statKey: 'closestToTag', higherIsBetter: false }
                ];
                const formatValue = (value: number) => {
                    if ((!isPerSecond && !isPerMinute) || !Number.isFinite(value)) {
                        return formatTopStatValue(value);
                    }
                    return formatWithCommas(value, 2);
                };
                return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {leaderCards.map((card) => {
                            const isActive = expandedLeader === 'all';
                            const rows = normalizeLeaderboardRows(topStatsLeaderboards?.[card.statKey] || [], card.higherIsBetter);
                            const topRow = rows[0];
                            const cardData = topRow
                                ? {
                                    ...card.data,
                                    value: Number(topRow.value || 0),
                                    player: topRow.account || card.data?.player || '-',
                                    count: topRow.count || card.data?.count || 0,
                                    profession: topRow.profession || card.data?.profession || 'Unknown',
                                    professionList: topRow.professionList || card.data?.professionList || []
                                }
                                : card.data;
                            return (
                                <LeaderCard
                                    key={card.statKey}
                                    {...card}
                                    data={cardData}
                                    active={isActive}
                                    onClick={() => setExpandedLeader((prev) => (prev === 'all' ? null : 'all'))}
                                    rows={rows}
                                    formatValue={formatValue}
                                    renderProfessionIcon={renderProfessionIcon}
                                />
                            );
                        })}
                    </div>
                );
            })()}
        </div>
    );
};
