import React from 'react';
import { useStatsStore } from '../statsStore';
import { ReplayView } from '../map/ReplayView';

export const ReplaySection: React.FC = () => {
    const result = useStatsStore(state => state.result);
    const fights = (result?.stats?.replayFights ?? []) as any[];

    return (
        <div id="replay" style={{ display: 'flex', flex: 1, minHeight: 0, minWidth: 0 }}>
            <ReplayView fights={fights} />
        </div>
    );
};

export default ReplaySection;
