import React from 'react';

export const ReplaySection: React.FC = () => {
    return (
        <section id="replay" className="stats-section">
            <div className="stats-section-header">
                <h2>Replay</h2>
            </div>
            <div className="stats-empty-state">
                Fight replay is coming soon. Logs parsed after this release will carry the full combat replay data needed for the viewer.
            </div>
        </section>
    );
};

export default ReplaySection;
