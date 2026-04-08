import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { useStatsSharedContext } from '../StatsViewContext';
import { useParticleEffect, PRESETS } from '../../particles';
import { EASE, DURATION } from '../../motion';

type SectionPanelProps = {
    sectionId: string;
    children: ReactNode;
    isLast?: boolean;
    index?: number;
};

const sectionVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: {
            delay: i * 0.06,
            duration: DURATION.slow,
            ease: EASE.outExpo,
        },
    }),
};

export function SectionPanel({
    sectionId,
    children,
    isLast = false,
    index = 0,
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
        <motion.div
            id={sectionId}
            className="scroll-mt-24 page-break-avoid"
            style={{
                padding: '18px',
                borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)',
                position: 'relative',
            }}
            custom={index}
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
        >
            <div style={{ position: 'absolute', top: 0, left: '50%', pointerEvents: 'none', zIndex: 5 }}>
                {emitterNode}
            </div>
            {children}
        </motion.div>
    );
}
