import React from 'react';
import type { ReplayFightPayload } from './replayTypes';

interface EventOverlayProps {
    fight: ReplayFightPayload;
    timeMs: number;
}

const PULSE_DURATION_MS = 1500;

interface Pulse {
    x: number;
    y: number;
    ageMs: number;
    kind: 'down' | 'death';
}

function collectPulses(fight: ReplayFightPayload, timeMs: number): Pulse[] {
    const pulses: Pulse[] = [];
    const { pollingRate } = fight.movementData;
    for (const m of fight.movementData.members) {
        if (m.isEnemy) continue;
        for (const [t] of m.downRanges) {
            const age = timeMs - t;
            if (age >= 0 && age < PULSE_DURATION_MS) {
                const idx = Math.min(m.positions.length - 1, Math.floor(t / pollingRate));
                const pos = m.positions[idx];
                if (pos) pulses.push({ x: pos[0], y: pos[1], ageMs: age, kind: 'down' });
            }
        }
        for (const [t] of m.deadRanges) {
            const age = timeMs - t;
            if (age >= 0 && age < PULSE_DURATION_MS) {
                const idx = Math.min(m.positions.length - 1, Math.floor(t / pollingRate));
                const pos = m.positions[idx];
                if (pos) pulses.push({ x: pos[0], y: pos[1], ageMs: age, kind: 'death' });
            }
        }
    }
    return pulses;
}

export const EventOverlay: React.FC<EventOverlayProps> = ({ fight, timeMs }) => {
    const pulses = collectPulses(fight, timeMs);
    return (
        <g className="replay-events">
            {pulses.map((p, i) => {
                const progress = p.ageMs / PULSE_DURATION_MS;
                if (p.kind === 'down') {
                    const r = 18 * (1 - progress);
                    return <circle key={`p-${i}`} cx={p.x} cy={p.y} r={r} fill="none" stroke="#60a5fa" strokeOpacity={1 - progress} strokeWidth={2} />;
                }
                const r = 10 + 24 * progress;
                return (
                    <g key={`p-${i}`}>
                        <circle cx={p.x} cy={p.y} r={r} fill="none" stroke="#ef4444" strokeOpacity={(1 - progress) * 0.8} strokeWidth={3} />
                        <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize={14} fill="#fecaca" opacity={1 - progress}>☠</text>
                    </g>
                );
            })}
        </g>
    );
};

export default EventOverlay;
