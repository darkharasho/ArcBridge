import { useEffect, useMemo, useRef, useState } from 'react';
import './particles.css';

// ─── Types ────────────────────────────────────────────────────────────────────

type Origin = 'center' | 'left' | 'right' | 'top' | 'edges' | { x: number; y: number };
type Direction = 'out' | 'in';

export interface ParticleEmitterProps {
    origin: Origin;
    direction: Direction;
    count: number;
    spread: number;
    duration: number;
    size: [number, number];
    glow?: boolean;
    onComplete?: () => void;
}

// ─── Hook: usePrefersReducedMotion ────────────────────────────────────────────

function usePrefersReducedMotion(): boolean {
    const [reduced, setReduced] = useState(() => {
        if (typeof window === 'undefined') return false;
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    });
    useEffect(() => {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);
    return reduced;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Random float in [min, max) */
function rand(min: number, max: number): number {
    return min + Math.random() * (max - min);
}

/** Resolve the origin point (relative to the 0×0 wrapper center) */
function resolveOrigin(origin: Origin, spread: number): { x: number; y: number } {
    if (typeof origin === 'object') return origin;
    switch (origin) {
        case 'left':
            return { x: -spread / 2, y: 0 };
        case 'right':
            return { x: 0, y: 0 };
        case 'top':
            return { x: 0, y: -spread / 2 };
        case 'edges': {
            // Random point on the perimeter of a spread-radius circle
            const angle = rand(0, Math.PI * 2);
            return {
                x: Math.cos(angle) * spread / 2,
                y: Math.sin(angle) * spread / 2,
            };
        }
        case 'center':
        default:
            return { x: 0, y: 0 };
    }
}

// ─── Particle style interface ─────────────────────────────────────────────────

interface ParticleStyle {
    position: 'absolute';
    width: string;
    height: string;
    borderRadius: string;
    background: string;
    left: string;
    top: string;
    opacity: number;
    animation: string;
    boxShadow?: string;
    '--particle-end-transform': string;
    [key: string]: string | number | undefined;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ParticleEmitter({
    origin,
    direction,
    count,
    spread,
    duration,
    size,
    glow = false,
    onComplete,
}: ParticleEmitterProps) {
    const prefersReducedMotion = usePrefersReducedMotion();
    const isBulkUploading = document.body.classList.contains('bulk-uploading');
    const suppressed = prefersReducedMotion || isBulkUploading;
    const onCompleteRef = useRef(onComplete);
    onCompleteRef.current = onComplete;

    // Randomize actual particle count within ±20%
    const actualCount = useMemo(() => {
        const min = Math.floor(count * 0.8);
        const max = Math.ceil(count * 1.2);
        return Math.floor(rand(min, max + 1));
    }, [count]);

    // Generate particle styles once on mount
    const particles = useMemo<ParticleStyle[]>(() => {
        if (suppressed) return [];

        const [minSize, maxSize] = size;

        return Array.from({ length: actualCount }, () => {
            // Resolve origin per-particle so 'edges' distributes around the perimeter
            const o = resolveOrigin(origin, spread);
            // 'right' constrains to a rightward cone (±45°), others use full 360°
            const angle = origin === 'right'
                ? rand(-Math.PI / 4, Math.PI / 4)
                : rand(0, Math.PI * 2);
            const distance = rand(spread * 0.3, spread);
            const diameter = rand(minSize, maxSize);
            // 'right' uses tighter stagger (all fire nearly together), others spread more
            const delay = origin === 'right'
                ? rand(0, duration * 0.06)
                : rand(0, duration * 0.15);
            const opacity = rand(0.5, 1.0);

            let endTransform: string;

            if (direction === 'out') {
                const tx = Math.cos(angle) * distance;
                const ty = Math.sin(angle) * distance;
                endTransform = `translate(${tx}px, ${ty}px) scale(0.2)`;
            } else {
                // 'in': start scattered, converge toward origin
                // The particle starts at a scattered position and ends at the origin (scale up)
                const tx = -(Math.cos(angle) * distance);
                const ty = -(Math.sin(angle) * distance);
                endTransform = `translate(${tx}px, ${ty}px) scale(1.3)`;
            }

            // Starting left/top for the particle
            let startX: number;
            let startY: number;

            if (direction === 'out') {
                startX = o.x - diameter / 2;
                startY = o.y - diameter / 2;
            } else {
                // 'in': start scattered
                startX = o.x + Math.cos(angle) * distance - diameter / 2;
                startY = o.y + Math.sin(angle) * distance - diameter / 2;
            }

            const style: ParticleStyle = {
                position: 'absolute',
                width: `${diameter}px`,
                height: `${diameter}px`,
                borderRadius: '50%',
                background: 'var(--brand-primary)',
                left: `${startX}px`,
                top: `${startY}px`,
                opacity,
                animation: `particle-fly ${duration}ms ease-out ${delay}ms 1 forwards`,
                '--particle-end-transform': endTransform,
            };

            if (glow) {
                const glowSize = Math.round(diameter * 1.5);
                style.boxShadow = `0 0 ${glowSize}px color-mix(in srgb, var(--brand-primary) 40%, transparent)`;
            }

            return style;
        });
    }, [actualCount, direction, duration, glow, origin, suppressed, spread, size]);

    // Schedule onComplete callback
    useEffect(() => {
        const timer = setTimeout(() => {
            onCompleteRef.current?.();
        }, duration + 150);

        return () => clearTimeout(timer);
    }, [duration]);

    const wrapperStyle: React.CSSProperties = {
        position: 'relative',
        width: '0px',
        height: '0px',
        overflow: 'visible',
        pointerEvents: 'none',
    };

    if (isBulkUploading) {
        return null;
    }

    if (prefersReducedMotion) {
        return (
            <div style={wrapperStyle}>
                <div className="particle-pulse-fallback" />
            </div>
        );
    }

    return (
        <div style={wrapperStyle}>
            {particles.map((style, i) => (
                <span
                    key={i}
                    className="particle-dot"
                    style={style as React.CSSProperties}
                />
            ))}
        </div>
    );
}
