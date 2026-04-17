import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, Maximize2, Minimize2, Plus, Minus, RotateCcw, X } from 'lucide-react';
import { useStatsStore } from '../statsStore';
import { getMapTiles, hasTileData } from '../../../shared/wvwTiles';
import { WVW_LANDMARKS } from '../../../shared/wvwLandmarks';
import { normalizeMapNameShort, formatDuration } from '../../../shared/mapUtils';
import { getProfessionIconPath } from '../../classIconUtils';
import commanderTagRaw from '../../../../public/svg/commander_tag.svg?raw';
const COMMANDER_TAG_URI = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(commanderTagRaw)))}`;

import { HeatmapLayer } from './HeatmapLayer';
import { SquadOverlay } from './SquadOverlay';
import { SquadHealthStrip } from './SquadHealthStrip';
import { LayersPopover } from './LayersPopover';
import { useHeatmapData } from './hooks/useHeatmapData';
import { FightPickerBar } from './FightPickerBar';
import { ReplaySquadPanel } from './ReplaySquadPanel';
import { SyncedTimeline } from './SyncedTimeline';
import { EventOverlay } from './EventOverlay';
import { FullscreenPortal } from './FullscreenPortal';
import { useReplayPlayback } from './hooks/useReplayPlayback';
import { useReplayViewport } from './hooks/useReplayViewport';
import { useMovementData } from './hooks/useMovementData';
import { pickDefaultFightId, findClosestMember } from './replaySelectors';
import type { ReplayFightPayload } from './replayTypes';
import type { SquadMemberMovement } from '../../../shared/movementData';

interface ReplayViewProps {
    fights: ReplayFightPayload[];
    style?: React.CSSProperties;
}

const SPEEDS = [0.5, 1, 1.5, 2, 4] as const;

/** Linearly interpolate between the two bracketing position samples for smooth movement. */
function sampleAt(member: SquadMemberMovement, pollFrac: number): [number, number] | null {
    const { positions } = member;
    if (!positions.length) return null;
    const lo = Math.max(0, Math.min(Math.floor(pollFrac), positions.length - 1));
    const t = pollFrac - Math.floor(pollFrac);
    if (t === 0 || lo >= positions.length - 1) return positions[lo];
    const a = positions[lo];
    const b = positions[lo + 1];
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

const ctrlBtnStyle: React.CSSProperties = {
    width: 26, height: 26, borderRadius: 5,
    background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--text-secondary)', cursor: 'pointer', backdropFilter: 'blur(4px)',
};

const chipStyle: React.CSSProperties = {
    background: 'var(--bg-elevated)', backdropFilter: 'blur(4px)',
    border: '1px solid var(--border-default)', borderRadius: 20,
    padding: '3px 10px', fontSize: 10, display: 'flex', alignItems: 'center',
    cursor: 'pointer',
};

export const ReplayView: React.FC<ReplayViewProps> = ({ fights, style }) => {
    const selectedId = useStatsStore(state => state.selectedReplayFightId);
    const setSelectedReplayFight = useStatsStore(state => state.setSelectedReplayFight);
    const playhead = useStatsStore(state => state.replayPlayhead);
    const setReplayPlayhead = useStatsStore(state => state.setReplayPlayhead);
    const viewportState = useStatsStore(state => state.replayViewport);
    const setReplayFollowTarget = useStatsStore(state => state.setReplayFollowTarget);
    const layers = useStatsStore(state => state.replayLayers);
    const spotlightParty = useStatsStore(state => state.replaySpotlightParty);
    const setReplaySpotlightParty = useStatsStore(state => state.setReplaySpotlightParty);

    const [fullscreen, setFullscreen] = useState(false);
    const [pickerCollapsed, setPickerCollapsed] = useState(false);
    const [panelCollapsed, setPanelCollapsed] = useState(true);

    const mapContainerRef = useRef<HTMLDivElement>(null);
    const draggedRef = useRef(false);

    useEffect(() => {
        if (!selectedId && fights.length) {
            const def = pickDefaultFightId(fights);
            if (def) setSelectedReplayFight(def);
        }
    }, [selectedId, fights, setSelectedReplayFight]);

    const selectedFight = useMovementData(fights, selectedId);
    const heatmap = useHeatmapData(selectedFight, layers.heatmap);
    const durationMs = selectedFight?.durationMs ?? 0;
    useReplayPlayback({ durationMs });

    const mapSize = selectedFight?.mapSize ?? [600, 600];
    const [mapWidth, mapHeight] = mapSize;
    const viewport = useReplayViewport({ mapWidth, mapHeight, containerWidth: mapWidth, containerHeight: mapHeight });

    const { centerOn, attachWheelZoom, attachPanDrag, screenToSvg } = viewport;
    useEffect(() => {
        const el = mapContainerRef.current;
        if (!el) return;
        return attachWheelZoom(el);
    }, [attachWheelZoom]);
    useEffect(() => {
        const el = mapContainerRef.current;
        if (!el) return;
        return attachPanDrag(el, (d) => { draggedRef.current = d; });
    }, [attachPanDrag]);

    // Fractional poll position — used for smooth lerped rendering.
    // Integer floor is used for array indexing (trails, hit detection).
    const pollFrac = selectedFight
        ? playhead.timeMs / selectedFight.movementData.pollingRate
        : 0;
    const pollIndex = Math.floor(pollFrac);

    const followMember = useMemo(() => {
        if (!selectedFight) return null;
        const key = viewportState.followTarget;
        if (!key) {
            return selectedFight.movementData.members.find(m => m.isCommander && m.inSquad) ?? null;
        }
        return selectedFight.movementData.members.find(m => (m.account || m.name) === key) ?? null;
    }, [selectedFight, viewportState.followTarget]);

    // Center on commander whenever the selected fight changes (selectedId is the stable key).
    useEffect(() => {
        if (!selectedFight) return;
        const commander = selectedFight.movementData.members.find(m => m.isCommander && m.inSquad);
        if (!commander) return;
        const pos = sampleAt(commander, 0);
        if (pos) centerOn(pos[0], pos[1]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedId, centerOn]);

    useEffect(() => {
        if (!followMember) return;
        const pos = sampleAt(followMember, pollFrac);
        if (pos) centerOn(pos[0], pos[1]);
    }, [followMember, pollFrac, centerOn]);

    const onCanvasClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
        if (!selectedFight) return;
        if (draggedRef.current) { draggedRef.current = false; return; }
        const svg = e.currentTarget;
        const rect = svg.getBoundingClientRect();
        // Account for preserveAspectRatio="xMidYMid meet" letterboxing
        const [worldX, worldY] = screenToSvg(e.clientX, e.clientY, rect);
        const hit = findClosestMember(selectedFight.movementData.members, pollIndex, worldX, worldY, 24);
        if (hit && !hit.isEnemy) setReplayFollowTarget(hit.account || hit.name);
    }, [selectedFight, pollIndex, screenToSvg, setReplayFollowTarget]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === ' ' && selectedFight) {
                e.preventDefault();
                const { replayPlayhead } = useStatsStore.getState();
                setReplayPlayhead({ playing: !replayPlayhead.playing });
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [selectedFight, setReplayPlayhead]);

    const followLabel = viewportState.followTarget
        ? `Follow: ${viewportState.followTarget}`
        : (followMember ? `Follow: ${followMember.name} (commander)` : '');

    const body = (
        <div className="replay-view" style={{ display: 'flex', flexDirection: 'column', height: '100%', ...style }}>
            <FightPickerBar fights={fights} collapsed={pickerCollapsed} onToggle={() => setPickerCollapsed(v => !v)} />

            {!selectedFight ? (
                <div style={{ padding: 16, opacity: 0.7 }}>Pick a fight above to start replay.</div>
            ) : (
                <>
                    {/* Map area fills everything; squad panel overlays on the right */}
                    <div ref={mapContainerRef} style={{ flex: 1, position: 'relative', minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
                            {/* Floating zoom + layer controls */}
                            <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <button type="button" onClick={() => viewport.zoomIn()} title="Zoom in" style={ctrlBtnStyle}><Plus size={12} /></button>
                                <button type="button" onClick={() => viewport.zoomOut()} title="Zoom out" style={ctrlBtnStyle}><Minus size={12} /></button>
                                <button type="button" onClick={() => viewport.resetViewport()} title="Reset zoom" style={ctrlBtnStyle}><RotateCcw size={12} /></button>
                                <button type="button" onClick={() => setFullscreen(v => !v)} title="Fullscreen" style={ctrlBtnStyle}>
                                    {fullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                                </button>
                                <LayersPopover />
                            </div>

                            {/* Status chips floating on the map */}
                            {followLabel && (
                                <button
                                    type="button"
                                    onClick={() => setReplayFollowTarget(null)}
                                    style={{ position: 'absolute', bottom: 10, left: 10, zIndex: 10, ...chipStyle, borderColor: 'var(--status-info-border)', color: 'var(--status-info)' }}
                                >
                                    {followLabel} <X size={10} style={{ marginLeft: 4 }} />
                                </button>
                            )}
                            {spotlightParty !== null && (
                                <button
                                    type="button"
                                    onClick={() => setReplaySpotlightParty(null)}
                                    style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 10, ...chipStyle, borderColor: 'var(--status-warning)', color: 'var(--status-warning)' }}
                                >
                                    Spotlight: Party {spotlightParty} <X size={10} style={{ marginLeft: 4 }} />
                                </button>
                            )}

                            {layers.squadHealthStrip && (
                                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5 }}>
                                    <SquadHealthStrip fight={selectedFight} timeMs={playhead.timeMs} />
                                </div>
                            )}

                            <svg
                                className="replay-canvas"
                                viewBox={`0 0 ${mapWidth} ${mapHeight}`}
                                preserveAspectRatio="xMidYMid slice"
                                onClick={onCanvasClick}
                                style={{ width: '100%', height: '100%', background: '#0c1224', cursor: 'grab', display: 'block' }}
                            >
                                <g transform={`translate(${viewport.tx} ${viewport.ty}) scale(${viewport.scale})`}>
                                    {selectedFight.mapKey && hasTileData(selectedFight.mapKey)
                                        ? getMapTiles(selectedFight.mapKey, Math.min(7, Math.max(3, Math.floor(5 + Math.log2(viewport.scale)))), mapWidth, mapHeight).map((t, i) => (
                                            <image key={i} href={t.url} x={t.x} y={t.y} width={t.width} height={t.height} preserveAspectRatio="none" />
                                        ))
                                        : selectedFight.mapImageUrl && (
                                            <image href={selectedFight.mapImageUrl} x={0} y={0} width={mapWidth} height={mapHeight} />
                                        )
                                    }
                                    <HeatmapLayer raster={heatmap} mapWidth={mapWidth} mapHeight={mapHeight} mode={layers.heatmap} />
                                    {selectedFight.mapKey && (WVW_LANDMARKS[selectedFight.mapKey] ?? []).map(lm => (
                                        <g key={lm.name}>
                                            <circle cx={lm.x} cy={lm.y} r={6} fill="rgba(15,23,42,0.8)" stroke="rgba(250,204,21,0.8)" strokeWidth={1.5} />
                                            <text x={lm.x + 8} y={lm.y + 3} fontSize={9} fill="rgba(250,204,21,0.9)">{lm.name}</text>
                                        </g>
                                    ))}
                                    {selectedFight.movementData.members.map(member => {
                                        const pos = sampleAt(member, pollFrac);
                                        if (!pos) return null;
                                        const dim = spotlightParty !== null && !member.isEnemy && member.group !== spotlightParty;
                                        const trail = member.positions.slice(Math.max(0, pollIndex - 20), pollIndex + 1);
                                        const recent = member.positions.slice(Math.max(0, pollIndex - 5), pollIndex + 1);
                                        const trailStr = trail.map(p => `${p[0]},${p[1]}`).join(' ');
                                        const recentStr = recent.map(p => `${p[0]},${p[1]}`).join(' ');
                                        const color = member.isEnemy ? '#ef4444' : member.isCommander ? '#fbbf24' : '#60a5fa';
                                        const isFollow = followMember && (followMember.account || followMember.name) === (member.account || member.name);
                                        // All sizes are divided by viewport.scale so they stay a
                                        // constant pixel size on screen regardless of zoom level.
                                        const s = viewport.scale;
                                        const sw = 1 / s;           // 1px stroke
                                        const sw15 = 1.5 / s;       // 1.5px stroke
                                        const iconR = 10 / s;        // half of 20px icon
                                        const ringR = 16 / s;        // follow ring radius
                                        const tagOff = 14 / s;       // commander tag center y-offset above icon
                                        const tagS = 8 / s;          // commander tag half-size
                                        return (
                                            <g key={member.account || member.name} opacity={dim ? 0.2 : 1}>
                                                {/* Movement trail */}
                                                <polyline points={trailStr} fill="none" stroke={color} strokeOpacity={0.2} strokeWidth={sw} strokeDasharray={`${2/s} ${2/s}`} />
                                                <polyline points={recentStr} fill="none" stroke={color} strokeOpacity={0.6} strokeWidth={sw15} />
                                                {/* Follow ring */}
                                                {isFollow && <circle cx={pos[0]} cy={pos[1]} r={ringR} fill="none" stroke="#fbbf24" strokeWidth={sw15} strokeOpacity={0.8} />}
                                                {/* Member icon — red-backed profession icon for enemies, plain icon for allies */}
                                                {(() => {
                                                    const iconSrc = getProfessionIconPath(member.profession);
                                                    if (member.isEnemy) {
                                                        return (
                                                            <>
                                                                <circle cx={pos[0]} cy={pos[1]} r={iconR} fill="rgba(127,29,29,0.85)" stroke="#ef4444" strokeWidth={sw15} />
                                                                {iconSrc && <image href={iconSrc} x={pos[0] - iconR * 0.75} y={pos[1] - iconR * 0.75} width={iconR * 1.5} height={iconR * 1.5} opacity={0.9} />}
                                                            </>
                                                        );
                                                    }
                                                    return iconSrc ? (
                                                        <image href={iconSrc} x={pos[0] - iconR} y={pos[1] - iconR} width={iconR * 2} height={iconR * 2} />
                                                    ) : (
                                                        <circle cx={pos[0]} cy={pos[1]} r={iconR} fill="#60a5fa" opacity={0.9} />
                                                    );
                                                })()}
                                                {/* Commander tag icon above icon */}
                                                {member.isCommander && (
                                                    <image
                                                        href={COMMANDER_TAG_URI}
                                                        x={pos[0] - tagS} y={pos[1] - tagOff - tagS}
                                                        width={tagS * 2} height={tagS * 2}
                                                    />
                                                )}
                                            </g>
                                        );
                                    })}
                                    <SquadOverlay fight={selectedFight} timeMs={playhead.timeMs} />
                                    <EventOverlay fight={selectedFight} timeMs={playhead.timeMs} />
                                </g>
                            </svg>
                        {/* Squad panel — overlays on the right of the map. Stop wheel propagation so
                             scrolling inside the panel doesn't trigger map zoom. */}
                        <div onWheel={e => e.stopPropagation()} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, zIndex: 20, display: 'flex', alignItems: 'stretch' }}>
                            <ReplaySquadPanel
                                fight={selectedFight}
                                collapsed={panelCollapsed}
                                onToggle={() => setPanelCollapsed(v => !v)}
                            />
                        </div>
                    </div>

                    <SyncedTimeline fight={selectedFight} />

                    {/* Controls bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'var(--bg-elevated)', borderTop: '1px solid var(--border-subtle)', flexShrink: 0 }}>
                        <button
                            type="button"
                            aria-label={playhead.playing ? 'Pause' : 'Play'}
                            onClick={() => setReplayPlayhead({ playing: !playhead.playing })}
                            style={{
                                width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                                background: 'var(--bg-hover)', border: '1px solid var(--border-default)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'var(--text-secondary)', cursor: 'pointer',
                            }}
                        >
                            {playhead.playing ? <Pause size={14} /> : <Play size={14} />}
                        </button>
                        <div style={{ display: 'flex', gap: 2 }}>
                            {SPEEDS.map(s => (
                                <button
                                    key={s}
                                    type="button"
                                    onClick={() => setReplayPlayhead({ speed: s })}
                                    style={{
                                        padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                                        background: playhead.speed === s ? 'var(--status-info-bg)' : 'var(--bg-hover)',
                                        border: `1px solid ${playhead.speed === s ? 'var(--status-info-border)' : 'var(--border-subtle)'}`,
                                        color: playhead.speed === s ? 'var(--status-info)' : 'var(--text-muted)',
                                        cursor: 'pointer',
                                    }}
                                >
                                    {s}×
                                </button>
                            ))}
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                            {formatDuration(playhead.timeMs)} / {formatDuration(durationMs)}
                        </span>
                        <div style={{ flex: 1 }} />
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{normalizeMapNameShort(selectedFight.label)}</span>
                    </div>
                </>
            )}
        </div>
    );

    return (
        <FullscreenPortal enabled={fullscreen} onExit={() => setFullscreen(false)}>
            {body}
        </FullscreenPortal>
    );
};

export default ReplayView;
