import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TopPlayersSection } from '../stats/sections/TopPlayersSection';

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

        render(
            <TopPlayersSection
                stats={stats}
                showTopStats={true}
                showMvp={false}
                topStatsMode="total"
                expandedLeader={null}
                setExpandedLeader={() => {}}
                formatTopStatValue={(value) => `${Math.round(value)}u`}
                formatWithCommas={(value) => `${Math.round(value)}u`}
                isMvpStatEnabled={() => true}
                renderProfessionIcon={() => null}
                isSectionVisible={() => true}
                isFirstVisibleSection={() => false}
                sectionClass={(_id, base) => base}
            />
        );

        expect(screen.getByText('374000u')).toBeInTheDocument();
        expect(screen.queryByText('4000u')).not.toBeInTheDocument();
    });
});
