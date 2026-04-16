import { Play } from 'lucide-react';

export const ReplaySection = () => {
    return (
    <div>
        <div className="flex items-center gap-2 mb-3.5">
            <Play className="w-4 h-4 shrink-0" style={{ color: 'var(--brand-primary)' }} />
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.05em]" style={{ color: 'var(--text-primary)' }}>Replay</h3>
        </div>
        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Fight replay is coming soon. Logs parsed after this release will carry the full combat replay data needed for the viewer.
        </div>
    </div>
    );
};
