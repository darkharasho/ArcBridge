/**
 * Unified motion tokens for consistent animation timing and easing across the app.
 * Use these instead of ad-hoc duration/easing values in framer-motion transitions
 * and inline styles. CSS equivalents are defined as custom properties in index.css.
 */

/** Easing curves */
export const EASE = {
    /** Smooth deceleration – ideal for entrances and reveals */
    outExpo: [0.16, 1, 0.3, 1] as const,
    /** Smooth acceleration – ideal for exits */
    inExpo: [0.7, 0, 0.84, 0] as const,
    /** Overshoot deceleration – ideal for playful snaps (tab indicators, toggles) */
    outBack: [0.34, 1.56, 0.64, 1] as const,
    /** Standard ease-out for micro-interactions */
    out: [0.25, 0.46, 0.45, 0.94] as const,
} as const;

/** Duration scale (seconds, for framer-motion) */
export const DURATION = {
    /** Micro-interactions: hover, focus, toggle – 120ms */
    fast: 0.12,
    /** Standard transitions: expand, collapse, fade – 200ms */
    normal: 0.2,
    /** Reveals: section entry, card stagger – 350ms */
    slow: 0.35,
    /** Orchestrated: page transitions, large reveals – 500ms */
    slower: 0.5,
} as const;

/** Spring presets for layout animations */
export const SPRING = {
    /** Snappy spring for tab indicators and toggles */
    snappy: { type: 'spring' as const, stiffness: 400, damping: 30 },
    /** Gentle spring for layout shifts */
    gentle: { type: 'spring' as const, stiffness: 260, damping: 25 },
} as const;

/** Common framer-motion transition presets */
export const TRANSITION = {
    /** Fast micro-interaction */
    fast: { duration: DURATION.fast, ease: EASE.out },
    /** Standard transition */
    normal: { duration: DURATION.normal, ease: EASE.outExpo },
    /** Section/card reveal */
    reveal: { duration: DURATION.slow, ease: EASE.outExpo },
    /** Page-level transition */
    page: { duration: DURATION.normal, ease: EASE.outExpo },
    /** Stagger children container */
    stagger: (staggerMs = 0.04, delayMs = 0.05) => ({
        staggerChildren: staggerMs,
        delayChildren: delayMs,
    }),
} as const;
