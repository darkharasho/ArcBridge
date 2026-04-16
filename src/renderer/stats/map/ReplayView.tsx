import React, { useCallback, useEffect, useMemo } from 'react';
import { Pause, Play, Maximize2, Minimize2, Plus, Minus, RotateCcw, X } from 'lucide-react';
import { useStatsStore } from '../statsStore';
import { getMapTiles, hasTileData } from '../../../shared/wvwTiles';
import { WVW_LANDMARKS } from '../../../shared/wvwLandmarks';
import { normalizeMapNameShort, formatDuration } from '../../../shared/mapUtils';
import { getProfessionIconPath } from '../../classIconUtils';
import { FightPicker } from './FightPicker';
import { PartyPanel } from './PartyPanel';
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
}

const SPEEDS = [0.5, 1, 1.5, 2, 4] as const;

function sampleAt(member: SquadMemberMovement, pollIndex: number): [number, number] | null {
    if (!member.positions.length) return null;
    const idx = Math.max(0, Math.min(pollIndex, member.positions.length - 1));
    return member.positions[idx];
}

export const ReplayView: React.FC<ReplayViewProps> = ({ fights }) => {
    const selectedId = useStatsStore(state => state.selectedReplayFightId);
    const setSelectedReplayFight = useStatsStore(state => state.setSelectedReplayFight);
    const playhead = useStatsStore(state => state.replayPlayhead);
    const setReplayPlayhead = useStatsStore(state => state.setReplayPlayhead);
    const viewportState = useStatsStore(state => state.replayViewport);
    const setReplayFollowTarget = useStatsStore(state => state.setReplayFollowTarget);

    const [fullscreen, setFullscreen] = React.useState(false);

    useEffect(() => {
        if (!selectedId && fights.length) {
            const def = pickDefaultFightId(fights);
            if (def) setSelectedReplayFight(def);
        }
    }, [selectedId, fights, setSelectedReplayFight]);

    const selectedFight = useMovementData(fights, selectedId);

    const durationMs = selectedFight?.durationMs ?? 0;
    useReplayPlayback({ durationMs });

    const mapSize = selectedFight?.mapSize ?? [600, 600];
    const [mapWidth, mapHeight] = mapSize;
    const viewport = useReplayViewport({ mapWidth, mapHeight, containerWidth: mapWidth, containerHeight: mapHeight });

    const pollIndex = selectedFight
        ? Math.floor(playhead.timeMs / selectedFight.movementData.pollingRate)
        : 0;

    const followMember = useMemo(() => {
        if (!selectedFight) return null;
        const key = viewportState.followTarget;
        if (!key) {
            return selectedFight.movementData.members.find(m => m.isCommander && m.inSquad) ?? null;
        }
        return selectedFight.movementData.members.find(m => (m.account || m.name) === key) ?? null;
    }, [selectedFight, viewportState.followTarget]);

    useEffect(() => {
        if (!followMember) return;
        const pos = sampleAt(followMember, pollIndex);
        if (pos) viewport.centerOn(pos[0], pos[1]);
    }, [followMember, pollIndex, viewport]);

    const onCanvasClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
        if (!selectedFight) return;
        const svg = e.currentTarget;
        const rect = svg.getBoundingClientRect();
        const fracX = (e.clientX - rect.left) / rect.width;
        const fracY = (e.clientY - rect.top) / rect.height;
        const worldX = fracX * mapWidth;
        const worldY = fracY * mapHeight;
        const hit = findClosestMember(selectedFight.movementData.members, pollIndex, worldX, worldY, 24);
        if (hit && !hit.isEnemy) setReplayFollowTarget(hit.account || hit.name);
    }, [selectedFight, pollIndex, mapWidth, mapHeight, setReplayFollowTarget]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === ' ' && selectedFight) {
                e.preventDefault();
                setReplayPlayhead({ playing: !playhead.playing });
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [selectedFight, playhead.playing, setReplayPlayhead]);

    const shortMap = selectedFight ? normalizeMapNameShort(selectedFight.label) : '';
    const followLabel = viewportState.followTarget
        ? `Follow: ${viewportState.followTarget}`
        : (followMember ? `Follow: ${followMember.name} (commander)` : '');

    const body = (
        <div className="replay-view" style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
            <FightPicker fights={fights} />
            {!selectedFight ? (
                <div style={{ padding: 16, opacity: 0.7 }}>Pick a fight above to start replay.</div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 8, flex: 1, minHeight: 0 }}>
                    <PartyPanel fight={selectedFight} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px' }}>
                            <div style={{ fontWeight: 600 }}>{shortMap}</div>
                            <div style={{ opacity: 0.7, fontSize: 12 }}>{formatDuration(playhead.timeMs)}</div>
                            <button type="button" onClick={() => setSelectedReplayFight(null)} style={{ marginLeft: 8 }}>
                                {selectedFight.label} <X size={12} />
                            </button>
                            {followLabel && (
                                <button type="button" onClick={() => setReplayFollowTarget(null)}>
                                    {followLabel} <X size={12} />
                                </button>
                            )}
                            <div style={{ flex: 1 }} />
                            <button type="button" onClick={() => viewport.zoomIn()} title="Zoom in"><Plus size={14} /></button>
                            <button type="button" onClick={() => viewport.zoomOut()} title="Zoom out"><Minus size={14} /></button>
                            <button type="button" onClick={() => viewport.resetViewport()} title="Reset"><RotateCcw size={14} /></button>
                            <button type="button" onClick={() => setFullscreen(v => !v)} title="Fullscreen">
                                {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                            </button>
                        </div>
                        <svg
                            className="replay-canvas"
                            viewBox={`0 0 ${mapWidth} ${mapHeight}`}
                            onClick={onCanvasClick}
                            style={{ flex: 1, minHeight: 0, width: '100%', background: '#0c1224', borderRadius: 8, cursor: 'crosshair' }}
                        >
                            <g transform={`translate(${viewport.tx} ${viewport.ty}) scale(${viewport.scale})`}>
                                {selectedFight.mapKey && hasTileData(selectedFight.mapKey)
                                    ? getMapTiles(selectedFight.mapKey, 5).map((t, i) => (
                                        <image key={i} href={t.url} x={t.x} y={t.y} width={t.width} height={t.height} />
                                    ))
                                    : selectedFight.mapImageUrl && (
                                        <image href={selectedFight.mapImageUrl} x={0} y={0} width={mapWidth} height={mapHeight} />
                                    )
                                }
                                {selectedFight.mapKey && (WVW_LANDMARKS[selectedFight.mapKey] ?? []).map(lm => (
                                    <g key={lm.name}>
                                        <circle cx={lm.x} cy={lm.y} r={6} fill="rgba(15,23,42,0.8)" stroke="rgba(250,204,21,0.8)" strokeWidth={1.5} />
                                        <text x={lm.x + 8} y={lm.y + 3} fontSize={9} fill="rgba(250,204,21,0.9)">{lm.name}</text>
                                    </g>
                                ))}
                                {selectedFight.movementData.members.map(member => {
                                    const pos = sampleAt(member, pollIndex);
                                    if (!pos) return null;
                                    const trail = member.positions.slice(Math.max(0, pollIndex - 20), pollIndex + 1);
                                    const recent = member.positions.slice(Math.max(0, pollIndex - 5), pollIndex + 1);
                                    const trailStr = trail.map(p => `${p[0]},${p[1]}`).join(' ');
                                    const recentStr = recent.map(p => `${p[0]},${p[1]}`).join(' ');
                                    const color = member.isEnemy ? '#ef4444' : member.isCommander ? '#fbbf24' : '#60a5fa';
                                    const isFollow = followMember && (followMember.account || followMember.name) === (member.account || member.name);
                                    return (
                                        <g key={member.account || member.name}>
                                            <polyline points={trailStr} fill="none" stroke={color} strokeOpacity={0.2} strokeWidth={1} strokeDasharray="2 2" />
                                            <polyline points={recentStr} fill="none" stroke={color} strokeOpacity={0.6} strokeWidth={1.5} />
                                            {isFollow && <circle cx={pos[0]} cy={pos[1]} r={16} fill="none" stroke="#fbbf24" strokeWidth={1.5} strokeOpacity={0.8} />}
                                            {member.isEnemy
                                                ? <circle cx={pos[0]} cy={pos[1]} r={6} fill="#7f1d1d" stroke="#ef4444" strokeWidth={1.5} />
                                                : <image
                                                    href={getProfessionIconPath(member.profession) ?? undefined}
                                                    x={pos[0] - 10} y={pos[1] - 10} width={20} height={20}
                                                />
                                            }
                                            {member.isCommander && (
                                                <circle cx={pos[0]} cy={pos[1] - 14} r={3} fill="#fbbf24" />
                                            )}
                                        </g>
                                    );
                                })}
                                <EventOverlay fight={selectedFight} timeMs={playhead.timeMs} />
                            </g>
                        </svg>
                        <SyncedTimeline fight={selectedFight} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px' }}>
                            <button
                                type="button"
                                aria-label={playhead.playing ? 'Pause' : 'Play'}
                                onClick={() => setReplayPlayhead({ playing: !playhead.playing })}
                            >
                                {playhead.playing ? <Pause size={16} /> : <Play size={16} />}
                            </button>
                            <select
                                value={playhead.speed}
                                onChange={(e) => setReplayPlayhead({ speed: Number(e.target.value) })}
                            >
                                {SPEEDS.map(s => <option key={s} value={s}>{s}×</option>)}
                            </select>
                            <span style={{ fontSize: 12, opacity: 0.8 }}>
                                {formatDuration(playhead.timeMs)} / {formatDuration(durationMs)}
                            </span>
                        </div>
                    </div>
                </div>
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
