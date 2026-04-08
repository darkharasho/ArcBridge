import { type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { EASE, DURATION } from './tokens';

type CollapseProps = {
    open: boolean;
    children: ReactNode;
    /** Optional custom duration in seconds (defaults to DURATION.slow = 0.35s) */
    duration?: number;
};

/**
 * Smooth height + opacity collapse/expand wrapper.
 * Uses framer-motion AnimatePresence for enter/exit orchestration.
 */
export function Collapse({ open, children, duration = DURATION.slow }: CollapseProps) {
    return (
        <AnimatePresence initial={false}>
            {open && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration, ease: EASE.outExpo }}
                    style={{ overflow: 'hidden' }}
                >
                    {children}
                </motion.div>
            )}
        </AnimatePresence>
    );
}
