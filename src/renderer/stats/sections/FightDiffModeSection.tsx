import { useEffect, useMemo, useState } from 'react';
import { GitCompareArrows, Maximize2, X } from 'lucide-react';
import { StatsTableShell } from '../ui/StatsTableShell';

type FightDiffModeSectionProps = {
    stats: any;
    formatWithCommas: (value: number, decimals?: number) => string;
    expandedSection: string | null;
    expandedSectionClosing: boolean;
    openExpandedSection: (id: string) => void;
    closeExpandedSection: () => void;
    isSectionVisible: (id: string) => boolean;
    isFirstVisibleSection: (id: string) => boolean;
    sectionClass: (id: string, base: string) => string;
};

type DiffFightRow = {
    id: string;
    shortLabel: string;
    fullLabel: string;
    targetFocus?: Array<{ label: string; damage: number; hits: number; share: number }>;
    squadMetrics?: Array<{
        metricId: string;
        metricLabel: string;
        higherIsBetter: boolean;
        value: number;
    }>;
};

type TargetSortKey = 'aDamage' | 'aShare' | 'bDamage' | 'bShare' | 'shareDelta';

export const FightDiffModeSection = ({
    stats,
    formatWithCommas,
    expandedSection,
    expandedSectionClosing,
    openExpandedSection,
    closeExpandedSection,
    isSectionVisible,
    isFirstVisibleSection,
    sectionClass
}: FightDiffModeSectionProps) => {
    const fights = (Array.isArray(stats?.fightDiffMode) ? stats.fightDiffMode : []) as DiffFightRow[];
    const fightDiffMissingFromDataset = !Array.isArray(stats?.fightDiffMode) && Array.isArray(stats?.fightBreakdown) && stats.fightBreakdown.length > 0;
    const [fightAId, setFightAId] = useState<string>('');
    const [fightBId, setFightBId] = useState<string>('');
    const [targetSort, setTargetSort] = useState<{ key: TargetSortKey; direction: 'asc' | 'desc' } | null>(null);

    useEffect(() => {
        if (fights.length === 0) {
            setFightAId('');
            setFightBId('');
            return;
        }
        const firstId = String(fights[0]?.id || '');
        const secondId = String(fights[1]?.id || fights[0]?.id || '');
        setFightAId((prev) => {
            if (prev && fights.some((fight) => String(fight.id) === prev)) return prev;
            return firstId;
        });
        setFightBId((prev) => {
            if (prev && fights.some((fight) => String(fight.id) === prev)) return prev;
            return secondId;
        });
    }, [fights]);

    const selectedFightA = useMemo(
        () => fights.find((fight) => String(fight.id) === String(fightAId)) || null,
        [fights, fightAId]
    );
    const selectedFightB = useMemo(
        () => fights.find((fight) => String(fight.id) === String(fightBId)) || null,
        [fights, fightBId]
    );

    const targetFocusRows = useMemo(() => {
        if (!selectedFightA || !selectedFightB) return [];
        const map = new Map<string, {
            label: string;
            aDamage: number;
            aShare: number;
            bDamage: number;
            bShare: number;
        }>();
        const upsert = (label: string, side: 'a' | 'b', damage: number, share: number) => {
            const key = String(label || 'Unknown');
            const existing = map.get(key) || {
                label: key,
                aDamage: 0,
                aShare: 0,
                bDamage: 0,
                bShare: 0
            };
            if (side === 'a') {
                existing.aDamage = Number(damage || 0);
                existing.aShare = Number(share || 0);
            } else {
                existing.bDamage = Number(damage || 0);
                existing.bShare = Number(share || 0);
            }
            map.set(key, existing);
        };
        (selectedFightA.targetFocus || []).forEach((row) => upsert(row.label, 'a', row.damage, row.share));
        (selectedFightB.targetFocus || []).forEach((row) => upsert(row.label, 'b', row.damage, row.share));
        return Array.from(map.values())
            .map((row) => ({ ...row, shareDelta: row.bShare - row.aShare }))
            .sort((a, b) => Math.abs(b.shareDelta) - Math.abs(a.shareDelta) || (b.bDamage + b.aDamage) - (a.bDamage + a.aDamage));
    }, [selectedFightA, selectedFightB]);
    const sortedTargetFocusRows = useMemo(() => {
        if (!targetSort) return targetFocusRows;
        const directionSign = targetSort.direction === 'asc' ? 1 : -1;
        const key = targetSort.key;
        return [...targetFocusRows].sort((a, b) => {
            const diff = (Number(a[key]) - Number(b[key])) * directionSign;
            if (diff !== 0) return diff;
            return a.label.localeCompare(b.label);
        });
    }, [targetFocusRows, targetSort]);

    const squadMetricRows = useMemo(() => {
        if (!selectedFightA || !selectedFightB) return [];
        const byMetricA = new Map((selectedFightA.squadMetrics || []).map((row) => [row.metricId, row]));
        const byMetricB = new Map((selectedFightB.squadMetrics || []).map((row) => [row.metricId, row]));
        const metricIds = Array.from(new Set([...byMetricA.keys(), ...byMetricB.keys()]));
        return metricIds.map((metricId) => {
            const a = byMetricA.get(metricId);
            const b = byMetricB.get(metricId);
            const higherIsBetter = Boolean(a?.higherIsBetter ?? b?.higherIsBetter ?? true);
            const aValue = Number(a?.value || 0);
            const bValue = Number(b?.value || 0);
            return {
                metricId,
                metricLabel: String(a?.metricLabel || b?.metricLabel || metricId),
                higherIsBetter,
                a,
                b,
                delta: bValue - aValue
            };
        });
    }, [selectedFightA, selectedFightB]);

    const formatPct = (value: number) => `${formatWithCommas((Number(value) || 0) * 100, 1)}%`;
    const metricDecimals = (metricId: string) => {
        if (metricId === 'squadKdr') return 2;
        return 0;
    };
    const toggleTargetSort = (key: TargetSortKey) => {
        setTargetSort((current) => {
            if (!current || current.key !== key) return { key, direction: 'desc' };
            return { key, direction: current.direction === 'desc' ? 'asc' : 'desc' };
        });
    };
    const sortArrow = (key: TargetSortKey) => (
        targetSort?.key === key ? (targetSort.direction === 'desc' ? ' ↓' : ' ↑') : ''
    );
    const sortButtonClass = (key: TargetSortKey) => (
        `fight-diff-sort-button transition-colors whitespace-nowrap ${targetSort?.key === key ? 'text-indigo-200' : 'text-gray-400 hover:text-gray-200'}`
    );

    return (
        <div
            id="fight-diff-mode"
            data-section-visible={isSectionVisible('fight-diff-mode')}
            data-section-first={isFirstVisibleSection('fight-diff-mode')}
            className={sectionClass('fight-diff-mode', `bg-white/5 border border-white/10 rounded-2xl p-6 page-break-avoid stats-share-exclude scroll-mt-24 ${expandedSection === 'fight-diff-mode'
                ? `fixed inset-0 z-50 overflow-y-auto h-screen shadow-2xl rounded-none modal-pane flex flex-col pb-10 ${expandedSectionClosing ? 'modal-pane-exit' : 'modal-pane-enter'
                }`
                : ''
                }`)}
        >
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-200 flex items-center gap-2">
                    <GitCompareArrows className="w-5 h-5 text-indigo-300" />
                    Fight Diff Mode
                </h3>
                <button
                    type="button"
                    onClick={() => (expandedSection === 'fight-diff-mode' ? closeExpandedSection() : openExpandedSection('fight-diff-mode'))}
                    className="p-2 rounded-lg border border-white/10 bg-white/5 text-gray-300 hover:text-white hover:border-white/30 transition-colors"
                    aria-label={expandedSection === 'fight-diff-mode' ? 'Close Fight Diff Mode' : 'Expand Fight Diff Mode'}
                    title={expandedSection === 'fight-diff-mode' ? 'Close' : 'Expand'}
                >
                    {expandedSection === 'fight-diff-mode' ? <X className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
            </div>

            {fightDiffMissingFromDataset ? (
                <div className="text-center text-gray-400 py-8 space-y-1">
                    <div className="font-semibold text-gray-200">Fight Diff data is missing in this dataset.</div>
                    <div className="text-sm text-gray-500">
                        Regenerate the stats/report with a build that includes Fight Diff Mode.
                    </div>
                </div>
            ) : fights.length < 2 ? (
                <div className="text-center text-gray-500 italic py-8">
                    Need at least two fights to compare.
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="text-xs uppercase tracking-widest text-gray-400">
                            Fight A
                            <select
                                className="fight-diff-select mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-gray-100 focus:outline-none"
                                value={fightAId}
                                onChange={(event) => setFightAId(event.target.value)}
                            >
                                {fights.map((fight) => (
                                    <option key={`fight-a-${fight.id}`} value={fight.id}>
                                        {fight.shortLabel} - {fight.fullLabel}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="text-xs uppercase tracking-widest text-gray-400">
                            Fight B
                            <select
                                className="fight-diff-select mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-gray-100 focus:outline-none"
                                value={fightBId}
                                onChange={(event) => setFightBId(event.target.value)}
                            >
                                {fights.map((fight) => (
                                    <option key={`fight-b-${fight.id}`} value={fight.id}>
                                        {fight.shortLabel} - {fight.fullLabel}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <div className="bg-indigo-500/10 border border-indigo-300/20 rounded-xl px-4 py-3 text-xs text-indigo-100/90 space-y-1">
                        <div className="uppercase tracking-widest text-[10px] text-indigo-200/80">How Target Focus Works</div>
                        <div>
                            Target focus compares how your squad distributed damage <span className="font-semibold">to</span> enemy professions between two fights
                            (it is not damage <span className="font-semibold">from</span> those professions).
                        </div>
                        <div>
                            <span className="font-semibold">Share</span> is the percent of your squad&apos;s total enemy-player damage that landed on that profession in that fight.
                            <span className="font-semibold"> Share Delta</span> is <span className="font-semibold">Fight B - Fight A</span>.
                        </div>
                    </div>

                    <div className="stats-table-layout__content bg-black/30 border border-white/5 rounded-xl overflow-hidden">
                        <StatsTableShell
                            expanded={expandedSection === 'fight-diff-mode'}
                            maxHeightClass="max-h-96"
                            header={(
                                <div className="bg-white/5 px-4 py-3 text-xs uppercase tracking-widest text-gray-400">
                                    Target Focus Comparison
                                </div>
                            )}
                            columns={targetFocusRows.length > 0 ? (
                                <div className="bg-white/5 overflow-x-auto">
                                    <table className="w-full min-w-[700px] table-fixed text-xs">
                                        <colgroup>
                                            <col className="w-[220px]" />
                                            <col className="w-[120px]" />
                                            <col className="w-[120px]" />
                                            <col className="w-[120px]" />
                                            <col className="w-[120px]" />
                                            <col className="w-[120px]" />
                                        </colgroup>
                                        <thead>
                                            <tr className="text-gray-400 uppercase tracking-widest text-[10px] border-b border-white/10">
                                                <th className="text-left py-2 px-3">Target</th>
                                                <th className="text-right py-2 px-3 whitespace-nowrap">
                                                    <button type="button" className={sortButtonClass('aDamage')} onClick={() => toggleTargetSort('aDamage')}>
                                                        {selectedFightA?.shortLabel} Damage{sortArrow('aDamage')}
                                                    </button>
                                                </th>
                                                <th className="text-right py-2 px-3 whitespace-nowrap">
                                                    <button type="button" className={sortButtonClass('aShare')} onClick={() => toggleTargetSort('aShare')}>
                                                        {selectedFightA?.shortLabel} Share{sortArrow('aShare')}
                                                    </button>
                                                </th>
                                                <th className="text-right py-2 px-3 whitespace-nowrap">
                                                    <button type="button" className={sortButtonClass('bDamage')} onClick={() => toggleTargetSort('bDamage')}>
                                                        {selectedFightB?.shortLabel} Damage{sortArrow('bDamage')}
                                                    </button>
                                                </th>
                                                <th className="text-right py-2 px-3 whitespace-nowrap">
                                                    <button type="button" className={sortButtonClass('bShare')} onClick={() => toggleTargetSort('bShare')}>
                                                        {selectedFightB?.shortLabel} Share{sortArrow('bShare')}
                                                    </button>
                                                </th>
                                                <th className="text-right py-2 px-3 whitespace-nowrap">
                                                    <button type="button" className={sortButtonClass('shareDelta')} onClick={() => toggleTargetSort('shareDelta')}>
                                                        Share Delta{sortArrow('shareDelta')}
                                                    </button>
                                                </th>
                                            </tr>
                                        </thead>
                                    </table>
                                </div>
                            ) : null}
                            rows={targetFocusRows.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[700px] table-fixed text-xs">
                                        <colgroup>
                                            <col className="w-[220px]" />
                                            <col className="w-[120px]" />
                                            <col className="w-[120px]" />
                                            <col className="w-[120px]" />
                                            <col className="w-[120px]" />
                                            <col className="w-[120px]" />
                                        </colgroup>
                                        <tbody>
                                            {sortedTargetFocusRows.map((row) => (
                                                <tr key={`focus-${row.label}`} className="border-t border-white/5">
                                                    <td className="py-2 px-3 text-gray-200">{row.label}</td>
                                                    <td className="py-2 px-3 text-right font-mono text-gray-200">{formatWithCommas(row.aDamage, 0)}</td>
                                                    <td className="py-2 px-3 text-right font-mono text-gray-300">{formatPct(row.aShare)}</td>
                                                    <td className="py-2 px-3 text-right font-mono text-gray-200">{formatWithCommas(row.bDamage, 0)}</td>
                                                    <td className="py-2 px-3 text-right font-mono text-gray-300">{formatPct(row.bShare)}</td>
                                                    <td className={`py-2 px-3 text-right font-mono ${row.shareDelta >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                                                        {row.shareDelta >= 0 ? '+' : ''}{formatPct(row.shareDelta)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="px-4 py-8 text-center text-gray-400 text-sm space-y-1">
                                    <div className="italic">No target focus data for selected fights.</div>
                                    <div className="text-xs text-gray-500">
                                        Usually this means the fights were uploaded without Detailed WvW enemy slices, or the report was generated from an older build.
                                    </div>
                                </div>
                            )}
                        />
                    </div>

                    <div className="stats-table-layout__content bg-black/30 border border-white/5 rounded-xl overflow-hidden">
                        <StatsTableShell
                            expanded={expandedSection === 'fight-diff-mode'}
                            maxHeightClass="max-h-none"
                            header={(
                                <div className="bg-white/5 px-4 py-3 text-xs uppercase tracking-widest text-gray-400">
                                    Squad Metric Comparison
                                </div>
                            )}
                            columns={squadMetricRows.length > 0 ? (
                                <div className="bg-white/5 overflow-x-auto">
                                    <table className="w-full min-w-[680px] table-fixed text-xs">
                                        <colgroup>
                                            <col className="w-[320px]" />
                                            <col className="w-[120px]" />
                                            <col className="w-[120px]" />
                                            <col className="w-[120px]" />
                                        </colgroup>
                                        <thead>
                                            <tr className="text-gray-400 uppercase tracking-widest text-[10px] border-b border-white/10">
                                                <th className="text-left py-2 px-3">Metric</th>
                                                <th className="text-right py-2 px-3">{selectedFightA?.shortLabel} Value</th>
                                                <th className="text-right py-2 px-3">{selectedFightB?.shortLabel} Value</th>
                                                <th className="text-right py-2 px-3">Delta</th>
                                            </tr>
                                        </thead>
                                    </table>
                                </div>
                            ) : null}
                            rows={squadMetricRows.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[680px] table-fixed text-xs">
                                        <colgroup>
                                            <col className="w-[320px]" />
                                            <col className="w-[120px]" />
                                            <col className="w-[120px]" />
                                            <col className="w-[120px]" />
                                        </colgroup>
                                        <tbody>
                                            {squadMetricRows.map((row) => {
                                                const improving = row.higherIsBetter ? row.delta >= 0 : row.delta <= 0;
                                                const decimals = metricDecimals(row.metricId);
                                                return (
                                                    <tr key={`performer-${row.metricId}`} className="border-t border-white/5">
                                                        <td className="py-2 px-3 text-gray-200">{row.metricLabel}</td>
                                                        <td className="py-2 px-3 text-right font-mono text-gray-200">{formatWithCommas(Number(row.a?.value || 0), decimals)}</td>
                                                        <td className="py-2 px-3 text-right font-mono text-gray-200">{formatWithCommas(Number(row.b?.value || 0), decimals)}</td>
                                                        <td className={`py-2 px-3 text-right font-mono ${improving ? 'text-emerald-300' : 'text-red-300'}`}>
                                                            {row.delta > 0 ? '+' : ''}{formatWithCommas(row.delta, decimals)}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="px-4 py-8 text-center text-gray-500 italic text-sm">No squad metric data for selected fights.</div>
                            )}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};
