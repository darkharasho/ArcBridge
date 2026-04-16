import React from 'react';
import { useStatsStore } from '../statsStore';
import { ReplayView } from '../map/ReplayView';

export const ReplaySection: React.FC = () => {
    const result = useStatsStore(state => state.result);
    const fights = (result?.stats?.replayFights ?? []) as any[];

    return (
        <section id="replay" className="stats-section">
            <div className="stats-section-header">
                <h2>Replay</h2>
            </div>
            <div style={{ height: 720, display: 'flex' }}>
                <ReplayView fights={fights} />
            </div>
        </section>
    );
};

export default ReplaySection;
