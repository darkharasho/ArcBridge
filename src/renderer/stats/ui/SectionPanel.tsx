import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useStatsSharedContext } from '../StatsViewContext';
import { useParticleEffect, PRESETS } from '../../particles';

type SectionPanelProps = {
    sectionId: string;
    children: ReactNode;
    isLast?: boolean;
    index?: number;
};

export function SectionPanel({
    sectionId,
    children,
    isLast = false,
}: SectionPanelProps) {
    const { expandedSection, expandedPortalRef } = useStatsSharedContext();
    const isExpanded = expandedSection === sectionId;
    const { emitterNode, trigger } = useParticleEffect();
    const hasFired = useRef(false);

    useEffect(() => {
        if (!hasFired.current) {
            hasFired.current = true;
            trigger(PRESETS.statsSectionAppear);
        }
    }, [trigger]);

    // When expanded, portal the entire section to the StatsView root level
    // so position:fixed escapes ancestor transforms/filters/backdrop-filters.
    if (isExpanded && expandedPortalRef?.current) {
        return (
            <>
                <div
                    id={sectionId}
                    className="scroll-mt-24 page-break-avoid"
                    style={{ padding: '18px', borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)' }}
                />
                {createPortal(children, expandedPortalRef.current)}
            </>
        );
    }

    return (
        <div
            id={sectionId}
            className="scroll-mt-24 page-break-avoid"
            style={{
                padding: '18px',
                borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)',
                position: 'relative',
            }}
        >
            <div style={{ position: 'absolute', top: 0, left: '50%', pointerEvents: 'none', zIndex: 5 }}>
                {emitterNode}
            </div>
            {children}
        </div>
    );
}
