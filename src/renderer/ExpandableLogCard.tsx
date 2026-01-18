import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

interface ExpandableLogCardProps {
    log: any;
    isExpanded: boolean;
    onToggle: () => void;
}

export function ExpandableLogCard({ log, isExpanded, onToggle }: ExpandableLogCardProps) {
    const details = log.details || {};
    const players = details.players || [];
    const squadPlayers = players.filter((p: any) => !p.notInSquad);
    const nonSquadPlayers = players.filter((p: any) => p.notInSquad);

    const isUploading = log.status === 'uploading';
    const hasError = log.status === 'error';
    const isDiscord = log.status === 'discord';

    // --- Stats Calculation ---
    let totalDps = 0;
    let totalDmg = 0;
    let totalDowns = 0;
    let totalDeaths = 0;
    let totalDmgTaken = 0;

    let totalMiss = 0;
    let totalBlock = 0;
    let totalEvade = 0;
    let totalDodge = 0;

    let squadDps = 0;
    let squadDmg = 0;
    let squadDowns = 0;
    let squadDeaths = 0;

    let totalCCTaken = 0;
    let totalStripsTaken = 0;

    players.forEach((p: any) => {
        const isSquad = !p.notInSquad;
        if (p.dpsAll && p.dpsAll.length > 0) {
            totalDps += p.dpsAll[0].dps;
            totalDmg += p.dpsAll[0].damage;
            if (isSquad) {
                squadDps += p.dpsAll[0].dps;
                squadDmg += p.dpsAll[0].damage;
            }
        }
        if (p.defenses && p.defenses.length > 0) {
            const d = p.defenses[0];
            totalDowns += d.downCount;
            totalDeaths += d.deadCount;
            totalDmgTaken += d.damageTaken || 0;
            if (isSquad) {
                squadDowns += d.downCount;
                squadDeaths += d.deadCount;
            }
            totalMiss += d.missedCount || d.missCount || d.missed || 0;
            totalBlock += d.blockedCount || d.blockCount || d.blocked || 0;
            totalEvade += d.evadedCount || d.evadeCount || 0;
            totalDodge += d.dodgeCount || 0;
            totalCCTaken += d.interruptedCount || 0;
            totalStripsTaken += d.boonStrips || 0;
        }
    });

    const durationSec = (details.durationMS || 0) / 1000 || 1;
    const totalIncomingDps = Math.round(totalDmgTaken / durationSec);
    const avgEnemyDps = players.length > 0 ? Math.round(totalIncomingDps / players.length) : 0;

    // Helper for rendering top lists
    const TopList = ({ title, sortFn, valFn, fmtVal }: { title: string, sortFn: (a: any, b: any) => number, valFn: (p: any) => any, fmtVal: (v: any) => string }) => {
        const top = [...players].sort(sortFn).slice(0, 5);
        const hasData = top.some(p => {
            const val = valFn(p);
            return val > 0 || (typeof val === 'string' && val !== '0');
        });

        return (
            <div className="bg-white/5 rounded-lg p-3 border border-white/5 shadow-inner">
                <h5 className="font-semibold text-gray-200 mb-2 border-b border-white/10 pb-1 text-[11px] uppercase tracking-tighter">{title}</h5>
                {hasData ? (
                    <div className="font-mono text-[10px] space-y-1 text-gray-300">
                        {top.map((p, i) => {
                            const val = valFn(p);
                            if (val <= 0 && (typeof val !== 'string' || val === '0')) return null;
                            return (
                                <div key={`${p.account}-${i}`} className="flex justify-between gap-2 border-b border-white/5 last:border-0 pb-0.5">
                                    <span className="truncate flex-1">
                                        <span className="text-gray-500 mr-1">{i + 1}</span>
                                        {p.character_name || p.account}
                                    </span>
                                    <span className="text-right shrink-0 font-bold text-blue-400">{fmtVal(val)}</span>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-[10px] text-gray-500 italic text-center py-2">No Data</div>
                )}
            </div>
        );
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: 20, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            layout
            className="bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:bg-white/10 transition-all mb-3 group shadow-xl"
        >
            {/* Collapsed View */}
            <div className="p-4 flex items-center gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center border transition-all shrink-0 ${isUploading ? 'bg-blue-500/20 border-blue-500/30 text-blue-400 animate-pulse' :
                    isDiscord ? 'bg-purple-500/20 border-purple-500/30 text-purple-400 animate-pulse' :
                        hasError ? 'bg-red-500/20 border-red-500/30 text-red-400' :
                            'bg-green-500/20 border-green-500/30 text-green-400'
                    }`}>
                    <span className="font-bold text-xs uppercase">
                        {isUploading ? '...' : isDiscord ? 'DC' : hasError ? 'ERR' : 'LOG'}
                    </span>
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                        <h4 className="text-sm font-bold text-gray-200 truncate">{details.fightName || log.fightName || log.filePath.split(/[\\\/]/).pop()}</h4>
                        <span className="text-xs text-gray-500 font-mono">{details.encounterDuration || log.encounterDuration || '--:--'}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span>{players.length || (isUploading || isDiscord ? 'Scanning...' : '0')} Players {nonSquadPlayers.length > 0 ? `(${squadPlayers.length} +${nonSquadPlayers.length})` : ''}</span>
                        <span>•</span>
                        <span>{(log.uploadTime || details.uploadTime)
                            ? new Date((log.uploadTime || details.uploadTime) * 1000).toLocaleTimeString()
                            : (isUploading || isDiscord ? 'Processing...' : 'Just now')}</span>
                    </div>
                </div>
                <button
                    onClick={(e) => { e.stopPropagation(); onToggle(); }}
                    disabled={!log.details && !isExpanded}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 border ${!log.details
                        ? 'bg-white/5 text-gray-600 border-white/5 cursor-not-allowed opacity-50'
                        : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10 hover:text-white group-hover:border-white/20'
                        }`}
                >
                    {isExpanded ? <><ChevronUp className="w-3 h-3" /><span>Hide</span></> : <><ChevronDown className="w-3 h-3" /><span>Details</span></>}
                </button>
            </div>

            {/* Expanded View */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-white/10 bg-black/40 shadow-inner"
                    >
                        <div className="p-4 space-y-4">
                            {/* Summaries Row */}
                            <div className="grid grid-cols-2 gap-3 text-xs">
                                <div className="bg-white/5 rounded-lg p-3 border border-white/5">
                                    <h5 className="font-semibold text-green-400 mb-2 uppercase tracking-wider text-[10px]">Squad Summary</h5>
                                    <div className="font-mono text-gray-300 space-y-1">
                                        <div className="flex justify-between"><span>Count:</span> <span>{squadPlayers.length} {nonSquadPlayers.length > 0 ? `(+${nonSquadPlayers.length})` : ''}</span></div>
                                        <div className="flex justify-between"><span>DMG:</span> <span>{squadDmg.toLocaleString()}</span></div>
                                        <div className="flex justify-between"><span>DPS:</span> <span>{Math.round(squadDps).toLocaleString()}</span></div>
                                        <div className="flex justify-between"><span>Downs:</span> <span>{squadDowns}</span></div>
                                        <div className="flex justify-between"><span>Deaths:</span> <span>{squadDeaths}</span></div>
                                    </div>
                                </div>
                                <div className="bg-white/5 rounded-lg p-3 border border-white/5">
                                    <h5 className="font-semibold text-red-400 mb-2 uppercase tracking-wider text-[10px]">Enemy Summary</h5>
                                    <div className="font-mono text-gray-300 space-y-1">
                                        <div className="flex justify-between"><span>Count:</span> <span>{players.length}</span></div>
                                        <div className="flex justify-between"><span>DMG:</span> <span>{totalDmgTaken.toLocaleString()}</span></div>
                                        <div className="flex justify-between"><span>DPS:</span> <span>{totalIncomingDps.toLocaleString()}</span></div>
                                        <div className="flex justify-between"><span>Avg:</span> <span>{avgEnemyDps.toLocaleString()}</span></div>
                                        <div className="flex justify-between"><span>Deaths:</span> <span>{totalDeaths}</span></div>
                                    </div>
                                </div>
                            </div>

                            {/* Incoming Stats Row */}
                            <div className="grid grid-cols-3 gap-2">
                                <div className="bg-white/5 rounded-lg p-2 border border-white/5">
                                    <h5 className="font-semibold text-blue-400 mb-1 uppercase tracking-wider text-[9px]">Incoming Attack</h5>
                                    <div className="font-mono text-[10px] text-gray-300">
                                        <div className="flex justify-between text-gray-500"><span>Miss:</span> <span className="text-gray-300">{totalMiss}</span></div>
                                        <div className="flex justify-between text-gray-500"><span>Block:</span> <span className="text-gray-300">{totalBlock}</span></div>
                                        <div className="flex justify-between text-gray-500"><span>Total:</span> <span className="text-gray-300">{totalMiss + totalBlock + totalEvade + totalDodge}</span></div>
                                    </div>
                                </div>
                                <div className="bg-white/5 rounded-lg p-2 border border-white/5">
                                    <h5 className="font-semibold text-purple-400 mb-1 uppercase tracking-wider text-[9px]">Incoming CC</h5>
                                    <div className="font-mono text-[10px] text-gray-300">
                                        <div className="flex justify-between text-gray-500"><span>Miss:</span> <span className="text-gray-300">{totalMiss}</span></div>
                                        <div className="flex justify-between text-gray-500"><span>Block:</span> <span className="text-gray-300">{totalBlock}</span></div>
                                        <div className="flex justify-between text-gray-500"><span>Total:</span> <span className="text-gray-300">{totalCCTaken}</span></div>
                                    </div>
                                </div>
                                <div className="bg-white/5 rounded-lg p-2 border border-white/5">
                                    <h5 className="font-semibold text-orange-400 mb-1 uppercase tracking-wider text-[9px]">Incoming Strips</h5>
                                    <div className="font-mono text-[10px] text-gray-300">
                                        <div className="flex justify-between text-gray-500"><span>Miss:</span> <span className="text-gray-300">{totalMiss}</span></div>
                                        <div className="flex justify-between text-gray-500"><span>Block:</span> <span className="text-gray-300">{totalBlock}</span></div>
                                        <div className="flex justify-between text-gray-500"><span>Total:</span> <span className="text-gray-300">{totalStripsTaken}</span></div>
                                    </div>
                                </div>
                            </div>

                            {/* Top Lists Sections */}
                            <div className="grid grid-cols-2 gap-3">
                                <TopList
                                    title="Damage"
                                    sortFn={(a, b) => (b.dpsAll?.[0]?.damage || 0) - (a.dpsAll?.[0]?.damage || 0)}
                                    valFn={p => p.dpsAll?.[0]?.damage || 0}
                                    fmtVal={v => v.toLocaleString()}
                                />
                                <TopList
                                    title="Down Contribution"
                                    sortFn={(a, b) => {
                                        const aVal = (a.statsAll?.[0]?.downContribution || 0);
                                        const bVal = (b.statsAll?.[0]?.downContribution || 0);
                                        return bVal - aVal;
                                    }}
                                    valFn={p => (p.statsAll?.[0]?.downContribution || 0)}
                                    fmtVal={v => v.toLocaleString()}
                                />
                                <TopList
                                    title="Healing"
                                    sortFn={(a, b) => (b.extHealingStats?.outgoingHealingAllies?.[0]?.[0]?.healing || 0) - (a.extHealingStats?.outgoingHealingAllies?.[0]?.[0]?.healing || 0)}
                                    valFn={p => p.extHealingStats?.outgoingHealingAllies?.[0]?.[0]?.healing || 0}
                                    fmtVal={v => v.toLocaleString()}
                                />
                                <TopList
                                    title="Barrier"
                                    sortFn={(a, b) => (b.extBarrierStats?.outgoingBarrierAllies?.[0]?.[0]?.barrier || 0) - (a.extBarrierStats?.outgoingBarrierAllies?.[0]?.[0]?.barrier || 0)}
                                    valFn={p => p.extBarrierStats?.outgoingBarrierAllies?.[0]?.[0]?.barrier || 0}
                                    fmtVal={v => v.toLocaleString()}
                                />
                                <TopList
                                    title="Cleanses"
                                    sortFn={(a, b) => (b.support?.[0]?.condiCleanse || 0) - (a.support?.[0]?.condiCleanse || 0)}
                                    valFn={p => p.support?.[0]?.condiCleanse || 0}
                                    fmtVal={v => v.toString()}
                                />
                                <TopList
                                    title="Strips"
                                    sortFn={(a, b) => (b.support?.[0]?.boonStrips || 0) - (a.support?.[0]?.boonStrips || 0)}
                                    valFn={p => p.support?.[0]?.boonStrips || 0}
                                    fmtVal={v => v.toString()}
                                />
                                <TopList
                                    title="CC"
                                    sortFn={(a, b) => (b.dpsAll?.[0]?.breakbarDamage || 0) - (a.dpsAll?.[0]?.breakbarDamage || 0)}
                                    valFn={p => p.dpsAll?.[0]?.breakbarDamage || 0}
                                    fmtVal={v => Math.round(v).toLocaleString()}
                                />
                                <TopList
                                    title="Stability"
                                    sortFn={(a, b) => {
                                        const aStab = a.squadBuffVolumes?.find((buff: any) => buff.id === 1122)?.buffVolumeData?.[0]?.outgoing || 0;
                                        const bStab = b.squadBuffVolumes?.find((buff: any) => buff.id === 1122)?.buffVolumeData?.[0]?.outgoing || 0;
                                        return bStab - aStab;
                                    }}
                                    valFn={p => p.squadBuffVolumes?.find((buff: any) => buff.id === 1122)?.buffVolumeData?.[0]?.outgoing || 0}
                                    fmtVal={v => v.toLocaleString()}
                                />
                            </div>

                            <button
                                onClick={async (e) => {
                                    e.stopPropagation();
                                    console.log('Opening permalink:', log.permalink);
                                    if (log.permalink) {
                                        try {
                                            const result = await window.electronAPI.openExternal(log.permalink);
                                            console.log('Open external result:', result);
                                            if (!result || !result.success) {
                                                console.error('Failed to open link via Electron:', result?.error || 'No result returned');
                                                window.open(log.permalink, '_blank');
                                            }
                                        } catch (err) {
                                            console.error('Error calling openExternal:', err);
                                            window.open(log.permalink, '_blank');
                                        }
                                    } else {
                                        console.warn('No permalink available for this log');
                                    }
                                }}
                                disabled={!log.permalink}
                                className={`w-full py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-lg border active:scale-[0.98] ${!log.permalink
                                    ? 'bg-blue-600/50 text-white/50 border-blue-400/10 cursor-not-allowed'
                                    : 'bg-blue-600/90 text-white hover:bg-blue-600 border-blue-400/20'
                                    }`}
                            >
                                <ExternalLink className="w-4 h-4" />
                                <span>{log.permalink ? 'Open dps.report Report' : 'Link Pending...'}</span>
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
