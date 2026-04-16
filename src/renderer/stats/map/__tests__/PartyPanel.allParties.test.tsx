import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { PartyPanel } from '../PartyPanel';
import { useStatsStore } from '../../statsStore';
import type { ReplayFightPayload } from '../replayTypes';
import type { SquadMemberMovement } from '../../../../shared/movementData';

const mkMember = (o: Partial<SquadMemberMovement>): SquadMemberMovement => ({
    name: 'A', account: 'A', profession: 'Guardian', eliteSpec: '', group: 1,
    isCommander: false, isLocal: false, isEnemy: false, inSquad: true,
    positions: [[0, 0]], downRanges: [], deadRanges: [], ...o,
});

const mkFight = (members: SquadMemberMovement[]): ReplayFightPayload => ({
    fightId: 'pp1', fightIndex: 0, label: 'x', timestampMs: 0, durationMs: 3000,
    mapKey: null, mapImageUrl: null, mapSize: [600, 600], avgPosition: null,
    nearestLandmark: null, squadSize: members.length, kills: 0, deaths: 0,
    movementData: { pollingRate: 1000, durationMs: 3000, inchToPixel: 1, members, boonIcons: {}, skillIcons: {} },
    dpsSamples: [], killEvents: [],
    damageSpikeEvents: [], rallyEvents: [], targetFocusSamples: [],
});

describe('PartyPanel — all-parties variant', () => {
    beforeEach(() => {
        const initial = (useStatsStore as any).getInitialState();
        useStatsStore.setState(initial);
    });

    it('renders 5 mini-panels when allPartiesPanel is on', () => {
        useStatsStore.getState().setReplayLayer('allPartiesPanel', true);
        const fight = mkFight([
            mkMember({ account: 'A.1', group: 1 }),
            mkMember({ account: 'B.1', group: 2 }),
        ]);
        render(<PartyPanel fight={fight} />);
        for (const label of ['P1', 'P2', 'P3', 'P4', 'P5']) {
            expect(screen.getByRole('button', { name: new RegExp(label) })).toBeTruthy();
        }
    });

    it('clicking a mini-panel sets spotlight party and selected party', () => {
        useStatsStore.getState().setReplayLayer('allPartiesPanel', true);
        const fight = mkFight([
            mkMember({ account: 'A.1', group: 1 }),
            mkMember({ account: 'B.1', group: 2 }),
        ]);
        render(<PartyPanel fight={fight} />);
        fireEvent.click(screen.getByRole('button', { name: /P2/ }));
        expect(useStatsStore.getState().replaySpotlightParty).toBe(2);
        expect(useStatsStore.getState().replaySelectedParty).toBe(2);
    });
});
