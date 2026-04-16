// src/renderer/stats/map/ReplaySquadPanel.tsx
import React, { useMemo } from 'react';
import { useStatsStore } from '../statsStore';
import { PartyMemberCard } from './PartyMemberCard';
import type { ReplayFightPayload } from './replayTypes';

interface ReplaySquadPanelProps {
    fight: ReplayFightPayload;
    collapsed: boolean;
    onToggle: () => void;
}

export const ReplaySquadPanel: React.FC<ReplaySquadPanelProps> = ({ fight, collapsed, onToggle }) => {
    const timeMs = useStatsStore(state => state.replayPlayhead.timeMs);
    const setReplayFollowTarget = useStatsStore(state => state.setReplayFollowTarget);

    const allies = useMemo(
        () => fight.movementData.members.filter(m => !m.isEnemy && m.inSquad),
        [fight.movementData.members],
    );

    const byParty = useMemo(() => {
        const map = new Map<number, typeof allies>();
        for (const m of allies) {
            const group = m.group ?? 0;
            if (!map.has(group)) map.set(group, []);
            map.get(group)!.push(m);
        }
        return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
    }, [allies]);

    const { boonIcons, skillIcons } = fight.movementData;

    if (collapsed) {
        return (
            <div
                title="Expand squad panel"
                onClick={onToggle}
                style={{
                    width: 28, flexShrink: 0,
                    background: 'rgba(8,17,31,0.95)',
                    borderLeft: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    paddingTop: 8, cursor: 'pointer',
                }}
            >
                <span style={{ fontSize: 11, color: '#334155' }}>◀</span>
                <span style={{ writingMode: 'vertical-rl', fontSize: 9, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: '#334155', marginTop: 7 }}>
                    Squad
                </span>
            </div>
        );
    }

    return (
        <div style={{
            width: 230, flexShrink: 0,
            background: 'rgba(8,17,31,0.95)',
            borderLeft: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
            <div style={{ padding: '7px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>Squad · {allies.length} members</span>
                <button
                    type="button"
                    title="Collapse squad panel"
                    onClick={onToggle}
                    style={{ fontSize: 11, color: '#334155', padding: '2px 4px', borderRadius: 3, background: 'none', border: 'none', cursor: 'pointer' }}
                >
                    ▶
                </button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, padding: '4px 0' }}>
                {byParty.map(([group, members]) => (
                    <React.Fragment key={group}>
                        <div style={{ padding: '5px 8px 2px', fontSize: 9, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: '#334155', borderTop: '1px solid rgba(255,255,255,0.04)', marginTop: 2 }}>
                            Party {group}
                        </div>
                        {members.map(m => (
                            <PartyMemberCard
                                key={m.account || m.name}
                                member={m}
                                timeMs={timeMs}
                                boonIcons={boonIcons}
                                skillIcons={skillIcons}
                                onFollow={key => setReplayFollowTarget(key)}
                            />
                        ))}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
};

export default ReplaySquadPanel;
