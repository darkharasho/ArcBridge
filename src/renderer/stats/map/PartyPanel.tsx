import React, { useMemo } from 'react';
import { useStatsStore } from '../statsStore';
import type { SquadMemberMovement } from '../../../shared/movementData';
import type { ReplayFightPayload } from './replayTypes';
import { getProfessionIconPath } from '../../classIconUtils';
import { getProfessionColor } from '../../../shared/professionUtils';

interface PartyPanelProps {
    fight: ReplayFightPayload;
}

function resolveDefaultParty(members: SquadMemberMovement[]): number {
    const commander = members.find(m => m.isCommander && m.inSquad);
    if (commander && commander.group) return commander.group;
    const counts = new Map<number, number>();
    for (const m of members) {
        if (m.isEnemy || !m.inSquad || !m.group) continue;
        counts.set(m.group, (counts.get(m.group) ?? 0) + 1);
    }
    let best = 1, max = 0;
    for (const [g, c] of counts) {
        if (c > max) { max = c; best = g; }
    }
    return best;
}

function healthAt(member: SquadMemberMovement, timeMs: number): number {
    const series = member.healthPercents;
    if (!series?.length) return 100;
    let hp = 100;
    for (const [t, v] of series) {
        if (t > timeMs) break;
        hp = v;
    }
    return hp;
}

function statusAt(member: SquadMemberMovement, timeMs: number): 'alive' | 'down' | 'dead' {
    for (const [start, end] of member.deadRanges) {
        if (timeMs >= start && (end === 0 || timeMs <= end)) return 'dead';
    }
    for (const [start, end] of member.downRanges) {
        if (timeMs >= start && (end === 0 || timeMs <= end)) return 'down';
    }
    return 'alive';
}

function activeBoons(member: SquadMemberMovement, timeMs: number, limit = 4): number[] {
    if (!member.boonStates) return [];
    const ids: number[] = [];
    for (const [idStr, states] of Object.entries(member.boonStates)) {
        let stacks = 0;
        for (const [t, v] of states) {
            if (t > timeMs) break;
            stacks = v;
        }
        if (stacks > 0) ids.push(Number(idStr));
        if (ids.length >= limit) break;
    }
    return ids;
}

function latestCast(member: SquadMemberMovement, timeMs: number): { id: number; ageMs: number } | null {
    if (!member.skillCasts?.length) return null;
    let last: { id: number; ageMs: number } | null = null;
    for (const cast of member.skillCasts) {
        if (cast.time > timeMs) break;
        last = { id: cast.id, ageMs: timeMs - cast.time };
    }
    return last && last.ageMs <= 3_000 ? last : null;
}

function partyStatusColor(member: SquadMemberMovement, timeMs: number): string {
    const status = statusAt(member, timeMs);
    if (status === 'dead') return '#7f1d1d';
    if (status === 'down') return '#9a3412';
    return getProfessionColor(member.profession);
}

export const PartyPanel: React.FC<PartyPanelProps> = ({ fight }) => {
    const timeMs = useStatsStore(state => state.replayPlayhead.timeMs);
    const selectedParty = useStatsStore(state => state.replaySelectedParty);
    const setReplaySelectedParty = useStatsStore(state => state.setReplaySelectedParty);
    const setReplayFollowTarget = useStatsStore(state => state.setReplayFollowTarget);
    const allPartiesPanel = useStatsStore(state => state.replayLayers.allPartiesPanel);
    const setReplaySpotlightParty = useStatsStore(state => state.setReplaySpotlightParty);

    const allies = useMemo(
        () => fight.movementData.members.filter(m => !m.isEnemy && m.inSquad),
        [fight.movementData.members],
    );

    const effectiveParty = selectedParty === 0 ? resolveDefaultParty(allies) : selectedParty;
    const partyMembers = allies.filter(m => m.group === effectiveParty);
    const skillIcons = fight.movementData.skillIcons;
    const boonIcons = fight.movementData.boonIcons;

    if (allPartiesPanel) {
        return (
            <aside className="replay-party-panel all-parties"
                   style={{ width: 260, padding: 8, background: 'rgba(8,12,26,0.6)', borderRadius: 8,
                            display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[1, 2, 3, 4, 5].map(party => {
                    const members = allies.filter(m => m.group === party);
                    return (
                        <button
                            key={party}
                            type="button"
                            onClick={() => {
                                setReplaySpotlightParty(party);
                                setReplaySelectedParty(party);
                            }}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: 6, borderRadius: 6,
                                background: 'rgba(255,255,255,0.04)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                cursor: 'pointer', textAlign: 'left',
                            }}
                        >
                            <span style={{ fontSize: 11, fontWeight: 600, minWidth: 20 }}>P{party}</span>
                            <div style={{ flex: 1, display: 'flex', gap: 2 }}>
                                {members.map(m => {
                                    const hp = healthAt(m, timeMs);
                                    return (
                                        <div key={m.account || m.name}
                                             title={`${m.name} — ${hp}%`}
                                             style={{ flex: 1, height: 18, background: '#18213d', borderRadius: 2, overflow: 'hidden' }}>
                                            <div style={{ width: `${hp}%`, height: '100%',
                                                          background: partyStatusColor(m, timeMs) }} />
                                        </div>
                                    );
                                })}
                                {members.length === 0 && <span style={{ fontSize: 10, opacity: 0.4 }}>empty</span>}
                            </div>
                            <span style={{ fontSize: 10, opacity: 0.6, minWidth: 16, textAlign: 'right' }}>{members.length}</span>
                        </button>
                    );
                })}
            </aside>
        );
    }

    return (
        <aside className="replay-party-panel" style={{ width: 260, padding: 8, background: 'rgba(8,12,26,0.6)', borderRadius: 8 }}>
            <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                {[1, 2, 3, 4, 5].map(p => (
                    <button
                        key={p}
                        type="button"
                        onClick={() => setReplaySelectedParty(p)}
                        style={{
                            flex: 1, padding: '4px 0', borderRadius: 4,
                            background: p === effectiveParty ? '#60a5fa' : 'rgba(255,255,255,0.06)',
                            color: p === effectiveParty ? '#000' : '#fff',
                            border: 'none', cursor: 'pointer', fontSize: 11,
                        }}
                    >
                        P{p}
                    </button>
                ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 480, overflowY: 'auto' }}>
                {partyMembers.map(member => {
                    const hp = healthAt(member, timeMs);
                    const status = statusAt(member, timeMs);
                    const cast = latestCast(member, timeMs);
                    const boons = activeBoons(member, timeMs);
                    return (
                        <button
                            key={member.account || member.name}
                            type="button"
                            onClick={() => setReplayFollowTarget(member.account || member.name)}
                            style={{
                                display: 'grid',
                                gridTemplateColumns: '24px 1fr auto',
                                alignItems: 'center',
                                gap: 6,
                                padding: 4,
                                borderRadius: 4,
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.06)',
                                cursor: 'pointer',
                                textAlign: 'left',
                            }}
                        >
                            <img src={getProfessionIconPath(member.profession) ?? undefined} alt="" width={20} height={20} />
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {member.isCommander ? '★ ' : ''}{member.name}
                                </div>
                                <div style={{ height: 4, background: '#18213d', borderRadius: 2, marginTop: 2, overflow: 'hidden' }}>
                                    <div style={{
                                        width: `${hp}%`,
                                        height: '100%',
                                        background: status === 'dead' ? '#7f1d1d' : status === 'down' ? '#9a3412' : '#22c55e',
                                    }} />
                                </div>
                                <div style={{ display: 'flex', gap: 2, marginTop: 2 }}>
                                    {boons.map(id => {
                                        const icon = boonIcons[id]?.icon;
                                        return icon
                                            ? <img key={id} src={icon} alt="" width={12} height={12} title={boonIcons[id].name} />
                                            : null;
                                    })}
                                </div>
                            </div>
                            {cast && skillIcons[cast.id]?.icon && (
                                <img src={skillIcons[cast.id].icon} alt="" width={20} height={20} title={skillIcons[cast.id].name} />
                            )}
                        </button>
                    );
                })}
                {partyMembers.length === 0 && (
                    <div style={{ fontSize: 11, opacity: 0.6, padding: 8 }}>No members in this party.</div>
                )}
            </div>
        </aside>
    );
};

export default PartyPanel;
