import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Maximize2, X } from 'lucide-react';
import { PillToggleGroup } from '../ui/PillToggleGroup';
import { InlineIconLabel } from '../ui/StatsViewShared';
import { formatWithCommas } from '../utils/dashboardUtils';
import type { PlayerSkillBreakdown } from '../statsTypes';

type DamageBreakdownSectionProps = {
    expandedSection: string | null;
    expandedSectionClosing: boolean;
    openExpandedSection: (id: string) => void;
    closeExpandedSection: () => void;
    isSectionVisible: (id: string) => boolean;
    isFirstVisibleSection: (id: string) => boolean;
    sectionClass: (id: string, base: string) => string;
    playerSkillBreakdowns: PlayerSkillBreakdown[];
    renderProfessionIcon: (profession?: string, professionList?: string[], className?: string) => JSX.Element | null;
};

type MetricMode = 'damage' | 'downContribution';

export const DamageBreakdownSection = ({
    expandedSection,
    expandedSectionClosing,
    openExpandedSection,
    closeExpandedSection,
    isSectionVisible,
    isFirstVisibleSection,
    sectionClass,
    playerSkillBreakdowns,
    renderProfessionIcon
}: DamageBreakdownSectionProps) => {
    const sectionId = 'damage-breakdown';
    const isExpanded = expandedSection === sectionId;
    const [metricMode, setMetricMode] = useState<MetricMode>('damage');
    const [playerFilter, setPlayerFilter] = useState('');
    const [selectedPlayerKey, setSelectedPlayerKey] = useState<string | null>(null);

    const getSkillMetric = (skill: { damage: number; downContribution: number }) => (
        metricMode === 'damage' ? Number(skill.damage || 0) : Number(skill.downContribution || 0)
    );
    const getPlayerMetricTotal = (player: PlayerSkillBreakdown) => (
        (player.skills || []).reduce((sum, skill) => sum + getSkillMetric(skill), 0)
    );

    const filteredPlayers = useMemo(() => {
        const term = playerFilter.trim().toLowerCase();
        const source = !term
            ? playerSkillBreakdowns
            : playerSkillBreakdowns.filter((player) =>
                String(player.displayName || '').toLowerCase().includes(term)
                || String(player.account || '').toLowerCase().includes(term)
                || String(player.profession || '').toLowerCase().includes(term)
            );
        return [...source].sort((a, b) => {
            const delta = getPlayerMetricTotal(b) - getPlayerMetricTotal(a);
            if (delta !== 0) return delta;
            return String(a.displayName || '').localeCompare(String(b.displayName || ''));
        });
    }, [playerSkillBreakdowns, playerFilter, metricMode]);

    const selectedPlayer = useMemo(() => {
        if (!selectedPlayerKey) return null;
        return filteredPlayers.find((player) => player.key === selectedPlayerKey) || null;
    }, [filteredPlayers, selectedPlayerKey]);

    const skillRows = useMemo(() => {
        if (!selectedPlayer) return [];
        return [...(selectedPlayer.skills || [])]
            .filter((skill) => getSkillMetric(skill) > 0)
            .sort((a, b) => getSkillMetric(b) - getSkillMetric(a))
            .map((skill) => ({
                ...skill,
                value: getSkillMetric(skill)
            }));
    }, [selectedPlayer, metricMode]);
    const selectedPlayerMetricTotal = useMemo(() => {
        if (!selectedPlayer) return 0;
        return getPlayerMetricTotal(selectedPlayer);
    }, [selectedPlayer, metricMode]);

    useEffect(() => {
        if (filteredPlayers.length === 0) {
            if (selectedPlayerKey !== null) setSelectedPlayerKey(null);
            return;
        }
        if (selectedPlayerKey && !filteredPlayers.some((player) => player.key === selectedPlayerKey)) {
            setSelectedPlayerKey(null);
        }
    }, [filteredPlayers, selectedPlayerKey]);

    return (
        <div
            id={sectionId}
            data-section-visible={isSectionVisible(sectionId)}
            data-section-first={isFirstVisibleSection(sectionId)}
            className={sectionClass(sectionId, `bg-white/5 border border-white/10 rounded-2xl p-6 page-break-avoid stats-share-exclude scroll-mt-24 ${isExpanded
                ? `fixed inset-0 z-50 overflow-y-auto h-screen shadow-2xl rounded-none modal-pane pb-10 ${expandedSectionClosing ? 'modal-pane-exit' : 'modal-pane-enter'}`
                : 'overflow-hidden'
                }`)}
        >
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-4 relative">
                <div className={isExpanded ? 'pr-10 md:pr-0' : ''}>
                    <h3 className="text-lg font-bold text-gray-200 flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-sky-300" />
                        Damage Breakdown
                    </h3>
                    <p className="text-xs text-gray-400">
                        Select one player to view total skill contribution for the selected metric.
                    </p>
                </div>
                <div className={`flex items-center gap-3 ${isExpanded ? 'pr-10 md:pr-0' : ''}`}>
                    <PillToggleGroup
                        value={metricMode}
                        onChange={(value) => setMetricMode(value as MetricMode)}
                        options={[
                            { value: 'damage', label: 'Damage' },
                            { value: 'downContribution', label: 'Down Contrib' }
                        ]}
                        activeClassName="bg-sky-500/20 text-sky-200 border border-sky-500/40"
                        inactiveClassName="border border-transparent text-gray-400 hover:text-white"
                    />
                    <button
                        type="button"
                        onClick={() => (isExpanded ? closeExpandedSection() : openExpandedSection(sectionId))}
                        className={`p-2 rounded-lg border border-white/10 bg-white/5 text-gray-300 hover:text-white hover:border-white/30 transition-colors ${isExpanded ? 'absolute top-2 right-2 md:static' : ''}`}
                        aria-label={isExpanded ? 'Close Damage Breakdown' : 'Expand Damage Breakdown'}
                        title={isExpanded ? 'Close' : 'Expand'}
                    >
                        {isExpanded ? <X className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            {playerSkillBreakdowns.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/20 px-4 py-6 text-center text-xs text-gray-400">
                    No player skill damage data available for the current selection.
                </div>
            ) : (
                <div className="grid gap-4 lg:grid-cols-[280px_1fr] items-stretch">
                    <div className="bg-black/20 border border-white/5 rounded-xl px-3 pt-3 pb-2 flex flex-col min-h-0 h-[360px]">
                        <div className="text-xs uppercase tracking-widest text-gray-500 mb-3">
                            Squad Players
                        </div>
                        <div className="mb-2">
                                <input
                                    type="search"
                                    value={playerFilter}
                                    onChange={(event) => setPlayerFilter(event.target.value)}
                                    placeholder="Search player or account"
                                    className="w-full rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-sky-500/60"
                                />
                        </div>
                        <div className="space-y-1 pr-1 flex-1 min-h-0 overflow-y-auto">
                                {filteredPlayers.length === 0 ? (
                                    <div className="px-3 py-4 text-xs text-gray-500 italic">
                                        No players match the filter.
                                    </div>
                                ) : (
                                    filteredPlayers.map((player) => {
                                        const isSelected = selectedPlayerKey === player.key;
                                        return (
                                            <button
                                                key={player.key}
                                                type="button"
                                                onClick={() => setSelectedPlayerKey(player.key)}
                                                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${isSelected
                                                    ? 'bg-sky-500/20 text-sky-200 border-sky-500/40'
                                                    : 'bg-white/5 text-gray-300 border-white/10 hover:text-white'
                                                    }`}
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            {renderProfessionIcon(player.profession, player.professionList, 'w-3.5 h-3.5')}
                                                            <div className="truncate min-w-0">{player.displayName}</div>
                                                        </div>
                                                        <div className="text-[10px] text-gray-400 truncate">
                                                            {(player.skills || []).length} {(player.skills || []).length === 1 ? 'skill' : 'skills'}
                                                        </div>
                                                    </div>
                                                    <div className="text-xs font-mono text-sky-200 shrink-0">
                                                        {formatWithCommas(getPlayerMetricTotal(player), 0)}
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                    <div className="space-y-2 flex flex-col h-[360px]">
                        <div className="bg-black/30 border border-white/5 rounded-xl overflow-hidden stats-share-table flex-1 min-h-0 flex flex-col">
                            {!selectedPlayer ? (
                                <div className="h-full flex items-center justify-center text-xs text-gray-500">
                                    Select one player to view skill totals.
                                </div>
                            ) : (
                                <div className="h-full flex flex-col">
                                    <div className="stats-table-shell__head-stack">
                                        <div className="flex items-center justify-between px-4 py-3 bg-white/5">
                                            <div className="min-w-0 text-sm text-gray-200">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className="text-[10px] uppercase tracking-[0.25em] text-gray-400 shrink-0">Skill Totals /</span>
                                                    {renderProfessionIcon(selectedPlayer.profession, selectedPlayer.professionList, 'w-4 h-4')}
                                                    <span className="truncate font-semibold">{selectedPlayer.displayName}</span>
                                                </div>
                                            </div>
                                            <div className="text-xs text-gray-400 uppercase tracking-[0.18em]">
                                                {(metricMode === 'damage' ? 'Damage' : 'Down Contrib')} / {skillRows.length} {skillRows.length === 1 ? 'skill' : 'skills'}
                                            </div>
                                        </div>
                                        <div className="stats-table-column-header grid grid-cols-[2fr_0.8fr_0.7fr] text-xs uppercase tracking-wider text-gray-400 bg-white/5 px-4 py-2">
                                            <div>Skill</div>
                                            <div className="text-right">{metricMode === 'damage' ? 'Damage' : 'Down Contrib'}</div>
                                            <div className="text-right">% Total</div>
                                        </div>
                                    </div>
                                    <div className="stats-table-shell__rows flex-1 min-h-0 overflow-y-auto">
                                        {skillRows.length === 0 ? (
                                            <div className="h-full flex items-center justify-center text-xs text-gray-500">
                                                No skill totals for this player and metric.
                                            </div>
                                        ) : (
                                            skillRows.map((row, idx) => (
                                                <div
                                                    key={`${row.id}-${idx}`}
                                                    className="grid grid-cols-[2fr_0.8fr_0.7fr] gap-2 px-4 py-2 text-sm text-gray-200 border-t border-white/5"
                                                >
                                                    <div className="min-w-0">
                                                        <InlineIconLabel
                                                            name={row.name}
                                                            iconUrl={row.icon}
                                                            iconClassName="h-4 w-4"
                                                        />
                                                    </div>
                                                    <div className="text-right font-mono text-gray-300">
                                                        {formatWithCommas(Number(row.value || 0), 0)}
                                                    </div>
                                                    <div className="text-right font-mono text-gray-300">
                                                        {selectedPlayerMetricTotal > 0
                                                            ? `${formatWithCommas((Number(row.value || 0) / selectedPlayerMetricTotal) * 100, 1)}%`
                                                            : '0.0%'}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
