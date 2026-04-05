import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TopPlayersSection } from '../stats/sections/TopPlayersSection';
import { StatsSharedContext } from '../stats/StatsViewContext';

const makeContextValue = (stats: any, formatWithCommas: (value: number, decimals: number) => string, renderProfessionIcon: (...args: any[]) => null) => ({
    stats,
    expandedSection: null,
    expandedSectionClosing: false,
    openExpandedSection: () => {},
    closeExpandedSection: () => {},
    isSectionVisible: () => true,
    isFirstVisibleSection: () => false,
    sectionClass: (_id: string, base: string) => base,
    sidebarListClass: '',
    formatWithCommas,
    renderProfessionIcon,
    roundCountStats: false,
    expandedPortalRef: { current: null },
});

describe('TopPlayersSection', () => {
    it('uses the highest leaderboard value for Down Contribution card when precomputed top stat is stale', () => {
        const stats = {
            maxDownContrib: {
                value: 4000,
                player: 'VincentCross.1469',
                profession: 'Catalyst',
                professionList: ['Catalyst'],
                count: 15
            },
            maxBarrier: { value: 0, player: '-', profession: 'Unknown', professionList: [], count: 0 },
            maxHealing: { value: 0, player: '-', profession: 'Unknown', professionList: [], count: 0 },
            maxDodges: { value: 0, player: '-', profession: 'Unknown', professionList: [], count: 0 },
            maxStrips: { value: 0, player: '-', profession: 'Unknown', professionList: [], count: 0 },
            maxCleanses: { value: 0, player: '-', profession: 'Unknown', professionList: [], count: 0 },
            maxCC: { value: 0, player: '-', profession: 'Unknown', professionList: [], count: 0 },
            maxStab: { value: 0, player: '-', profession: 'Unknown', professionList: [], count: 0 },
            closestToTag: { value: 0, player: '-', profession: 'Unknown', professionList: [], count: 0 },
            leaderboards: {
                downContrib: [
                    { rank: 1, account: 'VincentCross.1469', profession: 'Catalyst', professionList: ['Catalyst'], value: 4000, count: 15 },
                    { rank: 2, account: 'harasho.4281', profession: 'Luminary', professionList: ['Luminary'], value: 374000, count: 17 }
                ]
            }
        };

        const formatWithCommas = (value: number) => `${Math.round(value)}u`;
        const renderProfessionIcon = () => null;

        render(
            <StatsSharedContext.Provider value={makeContextValue(stats, formatWithCommas, renderProfessionIcon)}>
                <TopPlayersSection
                    showTopStats={true}
                    showMvp={false}
                    topStatsMode="total"
                    interruptMode="ccOnly"
                    expandedLeader={null}
                    setExpandedLeader={() => {}}
                    formatTopStatValue={(value) => `${Math.round(value)}u`}
                    isMvpStatEnabled={() => true}
                />
            </StatsSharedContext.Provider>
        );

        expect(screen.getByText('374000u')).toBeInTheDocument();
        expect(screen.queryByText('4000u')).not.toBeInTheDocument();
    });

    const makeEmptyStat = () => ({ value: 0, player: '-', profession: 'Unknown', professionList: [], count: 0 });

    const makeStatsWithInterrupts = () => ({
        maxDownContrib: makeEmptyStat(),
        maxBarrier: makeEmptyStat(),
        maxHealing: makeEmptyStat(),
        maxDodges: makeEmptyStat(),
        maxStrips: makeEmptyStat(),
        maxCleanses: makeEmptyStat(),
        maxCC: { value: 50, player: 'CCPlayer.1234', profession: 'Warrior', professionList: ['Warrior'], count: 5 },
        maxInterrupts: { value: 30, player: 'IntPlayer.5678', profession: 'Mesmer', professionList: ['Mesmer'], count: 5 },
        maxCCAndInterrupts: { value: 80, player: 'BothPlayer.9999', profession: 'Guardian', professionList: ['Guardian'], count: 5 },
        maxStab: makeEmptyStat(),
        closestToTag: makeEmptyStat(),
        leaderboards: {
            cc: [{ rank: 1, account: 'CCPlayer.1234', profession: 'Warrior', professionList: ['Warrior'], value: 50, count: 5 }],
            interrupts: [{ rank: 1, account: 'IntPlayer.5678', profession: 'Mesmer', professionList: ['Mesmer'], value: 30, count: 5 }],
            ccAndInterrupts: [{ rank: 1, account: 'BothPlayer.9999', profession: 'Guardian', professionList: ['Guardian'], value: 80, count: 5 }],
        }
    });

    it('shows only CC card when interruptMode is ccOnly', () => {
        const stats = makeStatsWithInterrupts();
        render(
            <StatsSharedContext.Provider value={makeContextValue(stats, (v) => `${Math.round(v)}u`, () => null)}>
                <TopPlayersSection
                    showTopStats={true}
                    showMvp={false}
                    topStatsMode="total"
                    interruptMode="ccOnly"
                    expandedLeader={null}
                    setExpandedLeader={() => {}}
                    formatTopStatValue={(v) => `${Math.round(v)}u`}
                    isMvpStatEnabled={() => true}
                />
            </StatsSharedContext.Provider>
        );

        expect(screen.getByText('Total CC')).toBeInTheDocument();
        expect(screen.queryByText('Total Interrupts')).not.toBeInTheDocument();
        expect(screen.queryByText('Total CC + Interrupts')).not.toBeInTheDocument();
    });

    it('shows CC and Interrupts as separate cards when interruptMode is separate', () => {
        const stats = makeStatsWithInterrupts();
        render(
            <StatsSharedContext.Provider value={makeContextValue(stats, (v) => `${Math.round(v)}u`, () => null)}>
                <TopPlayersSection
                    showTopStats={true}
                    showMvp={false}
                    topStatsMode="total"
                    interruptMode="separate"
                    expandedLeader={null}
                    setExpandedLeader={() => {}}
                    formatTopStatValue={(v) => `${Math.round(v)}u`}
                    isMvpStatEnabled={() => true}
                />
            </StatsSharedContext.Provider>
        );

        expect(screen.getByText('Total CC')).toBeInTheDocument();
        expect(screen.getByText('Total Interrupts')).toBeInTheDocument();
        expect(screen.queryByText('Total CC + Interrupts')).not.toBeInTheDocument();
    });

    it('shows combined CC + Interrupts card when interruptMode is combined', () => {
        const stats = makeStatsWithInterrupts();
        render(
            <StatsSharedContext.Provider value={makeContextValue(stats, (v) => `${Math.round(v)}u`, () => null)}>
                <TopPlayersSection
                    showTopStats={true}
                    showMvp={false}
                    topStatsMode="total"
                    interruptMode="combined"
                    expandedLeader={null}
                    setExpandedLeader={() => {}}
                    formatTopStatValue={(v) => `${Math.round(v)}u`}
                    isMvpStatEnabled={() => true}
                />
            </StatsSharedContext.Provider>
        );

        expect(screen.queryByText('Total CC')).not.toBeInTheDocument();
        expect(screen.queryByText('Total Interrupts')).not.toBeInTheDocument();
        expect(screen.getByText('Total CC + Interrupts')).toBeInTheDocument();
    });
});
