import React, { useMemo } from 'react';
import { getProfessionIconPath } from '../../classIconUtils';
import { hpAt, statusAt, activeBoons, activeSkillsAt } from './partyMemberHelpers';
import type { MemberStatus } from './partyMemberHelpers';
import type { SquadMemberMovement } from '../../../shared/movementData';

interface PartyMemberCardProps {
    member: SquadMemberMovement;
    timeMs: number;
    boonIcons: Record<number, { name: string; icon: string }>;
    skillIcons: Record<number, { name: string; icon: string }>;
    onFollow?: (key: string) => void;
}

function hpColor(hp: number, status: MemberStatus): string {
    if (status === 'dead') return '#64748b';
    if (status === 'down') return '#f97316';
    if (hp >= 60) return '#4ade80';
    if (hp >= 30) return '#fbbf24';
    return '#f87171';
}

function barColor(status: MemberStatus): string {
    if (status === 'dead') return '#7f1d1d';
    if (status === 'down') return '#9a3412';
    return '#22c55e';
}

export const PartyMemberCard: React.FC<PartyMemberCardProps> = ({
    member, timeMs, boonIcons, skillIcons, onFollow,
}) => {
    const hp = useMemo(() => hpAt(member, timeMs), [member, timeMs]);
    const status = useMemo(() => statusAt(member, timeMs), [member, timeMs]);
    const boonIds = useMemo(() => activeBoons(member, timeMs), [member, timeMs]);
    const skillIds = useMemo(() => activeSkillsAt(member, timeMs), [member, timeMs]);

    const specLabel = member.eliteSpec
        ? String(member.eliteSpec)
        : member.profession;
    const statusSuffix = status === 'down' ? ' · DOWN' : status === 'dead' ? ' · DEAD' : '';
    const statusColor = status === 'down' ? 'var(--status-warning)' : status === 'dead' ? 'var(--status-error)' : 'var(--text-secondary)';

    return (
        <button
            type="button"
            onClick={() => onFollow?.(member.account || member.name)}
            style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '5px 8px', borderRadius: 4, margin: '1px 4px',
                background: 'var(--bg-hover)',
                border: '1px solid transparent',
                cursor: 'pointer',
            }}
        >
            {/* Row 1: icon + name + hp */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <div style={{ position: 'relative', flexShrink: 0, width: 24, height: 24 }}>
                    <img
                        src={getProfessionIconPath(member.profession) ?? undefined}
                        alt={member.profession}
                        width={24}
                        height={24}
                        style={{ borderRadius: '50%', display: 'block' }}
                    />
                    {member.isCommander && (
                        <div
                            data-cmd-tag
                            style={{
                                position: 'absolute', top: -6, left: '50%', transform: 'translateX(-50%)',
                                width: 10, height: 10,
                                background: '#fbbf24',
                                clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
                            }}
                        />
                    )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {member.name}
                    </div>
                    <div style={{ fontSize: 9, color: statusColor }}>
                        {specLabel}{statusSuffix}
                    </div>
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: hpColor(hp, status), flexShrink: 0, width: 32, textAlign: 'right' }}>
                    {status === 'dead' ? '—' : `${Math.round(hp)}%`}
                </div>
            </div>

            {/* HP bar */}
            <div style={{ height: 3, background: 'var(--border-subtle)', borderRadius: 2, marginBottom: 4, overflow: 'hidden' }}>
                <div style={{ width: `${status === 'dead' ? 0 : hp}%`, height: '100%', background: barColor(status), borderRadius: 2 }} />
            </div>

            {/* Row 2: active boons */}
            {status !== 'dead' && (
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 3 }}>
                    {boonIds.map(id => {
                        const icon = boonIcons[id];
                        if (!icon?.icon) return null;
                        return (
                            <img key={id} src={icon.icon} alt={icon.name} title={icon.name} width={22} height={22}
                                 style={{ borderRadius: 3, border: '1px solid var(--border-hover)' }} />
                        );
                    })}
                </div>
            )}

            {/* Row 3: skills used this second */}
            {status !== 'dead' && skillIds.length > 0 && (
                <div style={{ display: 'flex', gap: 3 }}>
                    {skillIds.map(id => {
                        const icon = skillIcons[id];
                        if (!icon?.icon) return null;
                        return (
                            <img key={id} src={icon.icon} alt={icon.name} title={icon.name} width={22} height={22}
                                 style={{ borderRadius: 3, border: '1px solid var(--status-info-border)', background: 'var(--status-info-bg)' }} />
                        );
                    })}
                </div>
            )}
        </button>
    );
};

export default PartyMemberCard;
