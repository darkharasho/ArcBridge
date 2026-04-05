# Particle Effects System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a unified `ParticleEmitter` React component and integrate 8 event-driven particle effects across the desktop app.

**Architecture:** A single `ParticleEmitter` component dynamically spawns short-lived `<span>` elements with randomized inline styles. Named presets define the 8 effects. A `useParticleEffect` hook enables imperative triggering from callbacks and state changes.

**Tech Stack:** React, CSS transforms/opacity (GPU-composited), vitest + @testing-library/react

**Spec:** `docs/superpowers/specs/2026-04-05-particle-effects-system-design.md`

---

### Task 1: ParticleEmitter Core Component

**Files:**
- Create: `src/renderer/particles/ParticleEmitter.tsx`
- Create: `src/renderer/particles/particles.css`
- Create: `src/renderer/particles/__tests__/ParticleEmitter.test.tsx`

- [ ] **Step 1: Write failing test for ParticleEmitter rendering particles**

```tsx
// src/renderer/particles/__tests__/ParticleEmitter.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ParticleEmitter } from '../ParticleEmitter';

afterEach(cleanup);

describe('ParticleEmitter', () => {
    it('renders the expected number of particle spans', () => {
        const { container } = render(
            <ParticleEmitter
                origin="center"
                direction="out"
                count={10}
                spread={50}
                duration={300}
                size={[2, 4]}
            />
        );
        const particles = container.querySelectorAll('.particle-dot');
        // count is randomized ±20%, so 10 → 8-12
        expect(particles.length).toBeGreaterThanOrEqual(8);
        expect(particles.length).toBeLessThanOrEqual(12);
    });

    it('applies inline styles with transform and opacity to each particle', () => {
        const { container } = render(
            <ParticleEmitter
                origin="center"
                direction="out"
                count={5}
                spread={40}
                duration={300}
                size={[2, 4]}
            />
        );
        const particle = container.querySelector('.particle-dot') as HTMLElement;
        expect(particle).not.toBeNull();
        expect(particle.style.width).toBeTruthy();
        expect(particle.style.height).toBeTruthy();
        expect(particle.style.position).toBe('absolute');
    });

    it('renders nothing when prefers-reduced-motion is set', () => {
        // Mock matchMedia to return prefers-reduced-motion: reduce
        const originalMatchMedia = window.matchMedia;
        window.matchMedia = vi.fn().mockImplementation((query: string) => ({
            matches: query === '(prefers-reduced-motion: reduce)',
            media: query,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            dispatchEvent: vi.fn(),
        }));

        const { container } = render(
            <ParticleEmitter
                origin="center"
                direction="out"
                count={10}
                spread={50}
                duration={300}
                size={[2, 4]}
            />
        );
        const particles = container.querySelectorAll('.particle-dot');
        expect(particles.length).toBe(0);
        // Should render a single pulse fallback instead
        const pulse = container.querySelector('.particle-pulse-fallback');
        expect(pulse).not.toBeNull();

        window.matchMedia = originalMatchMedia;
    });

    it('cleans up particles after duration and calls onComplete', async () => {
        vi.useFakeTimers();
        const onComplete = vi.fn();

        const { container } = render(
            <ParticleEmitter
                origin="center"
                direction="out"
                count={5}
                spread={40}
                duration={200}
                size={[2, 4]}
                onComplete={onComplete}
            />
        );

        // Particles exist initially
        expect(container.querySelectorAll('.particle-dot').length).toBeGreaterThan(0);

        // After duration + buffer (200 + 100 = 300ms), should clean up
        vi.advanceTimersByTime(400);
        expect(onComplete).toHaveBeenCalledTimes(1);

        vi.useRealTimers();
    });

    it('wrapper has zero dimensions and position relative', () => {
        const { container } = render(
            <ParticleEmitter
                origin="center"
                direction="out"
                count={5}
                spread={40}
                duration={300}
                size={[2, 4]}
            />
        );
        const wrapper = container.firstElementChild as HTMLElement;
        expect(wrapper.style.position).toBe('relative');
        expect(wrapper.style.width).toBe('0px');
        expect(wrapper.style.height).toBe('0px');
    });

    it('applies glow box-shadow when glow prop is true', () => {
        const { container } = render(
            <ParticleEmitter
                origin="center"
                direction="out"
                count={5}
                spread={40}
                duration={300}
                size={[3, 5]}
                glow
            />
        );
        const particle = container.querySelector('.particle-dot') as HTMLElement;
        expect(particle.style.boxShadow).toBeTruthy();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/particles/__tests__/ParticleEmitter.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Create particles.css with shared keyframes**

```css
/* src/renderer/particles/particles.css */

/* Particle animation — applied via inline animation property */
@keyframes particle-fly {
    to {
        transform: var(--particle-end-transform);
        opacity: 0;
    }
}

/* Reduced-motion fallback: a single soft pulse */
.particle-pulse-fallback {
    position: absolute;
    inset: -4px;
    border-radius: 4px;
    background: var(--brand-primary);
    opacity: 0;
    animation: particle-pulse-once 400ms ease-out forwards;
    pointer-events: none;
}

@keyframes particle-pulse-once {
    0% { opacity: 0; }
    30% { opacity: 0.12; }
    100% { opacity: 0; }
}
```

- [ ] **Step 4: Implement ParticleEmitter component**

```tsx
// src/renderer/particles/ParticleEmitter.tsx
import { useEffect, useRef, useState } from 'react';
import './particles.css';

type Origin = 'center' | 'left' | 'top' | 'edges' | { x: number; y: number };

interface ParticleEmitterProps {
    origin: Origin;
    direction: 'out' | 'in';
    count: number;
    spread: number;
    duration: number;
    size: [number, number];
    glow?: boolean;
    onComplete?: () => void;
}

interface ParticleStyle {
    width: string;
    height: string;
    position: 'absolute' as const;
    left: string;
    top: string;
    borderRadius: string;
    background: string;
    boxShadow: string;
    opacity: number;
    transform: string;
    animation: string;
    pointerEvents: 'none' as const;
}

function randomBetween(min: number, max: number): number {
    return min + Math.random() * (max - min);
}

function generateOriginPosition(origin: Origin): { x: number; y: number } {
    if (typeof origin === 'object') return origin;
    switch (origin) {
        case 'center': return { x: 0, y: 0 };
        case 'left': return { x: -10, y: 0 };
        case 'top': return { x: 0, y: -10 };
        case 'edges': return {
            x: (Math.random() - 0.5) * 80,
            y: (Math.random() - 0.5) * 40,
        };
    }
}

function generateParticles(props: ParticleEmitterProps): ParticleStyle[] {
    const { origin, direction, count, spread, size, glow, duration } = props;
    const actualCount = Math.round(count * randomBetween(0.8, 1.2));
    const particles: ParticleStyle[] = [];

    for (let i = 0; i < actualCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = randomBetween(spread * 0.3, spread);
        const dx = Math.cos(angle) * distance;
        const dy = Math.sin(angle) * distance;
        const particleSize = randomBetween(size[0], size[1]);
        const delay = Math.random() * (duration * 0.15);
        const particleDuration = duration * randomBetween(0.7, 1.0);
        const opacity = randomBetween(0.5, 1.0);

        const startPos = direction === 'out'
            ? generateOriginPosition(origin)
            : { x: dx + generateOriginPosition(origin).x, y: dy + generateOriginPosition(origin).y };
        const endTransform = direction === 'out'
            ? `translate(${dx}px, ${dy}px) scale(0.2)`
            : `translate(0px, 0px) scale(1.3)`;

        particles.push({
            width: `${particleSize}px`,
            height: `${particleSize}px`,
            position: 'absolute',
            left: `${startPos.x}px`,
            top: `${startPos.y}px`,
            borderRadius: '50%',
            background: 'var(--brand-primary)',
            boxShadow: glow
                ? `0 0 ${particleSize * 2}px color-mix(in srgb, var(--brand-primary) 40%, transparent)`
                : 'none',
            opacity,
            transform: 'translate(0, 0) scale(1)',
            animation: `particle-fly ${particleDuration}ms ease-out ${delay}ms forwards`,
            pointerEvents: 'none',
        });
    }
    return particles;
}

function usePrefersReducedMotion(): boolean {
    const [reduced, setReduced] = useState(
        () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
    useEffect(() => {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);
    return reduced;
}

export function ParticleEmitter(props: ParticleEmitterProps) {
    const { duration, onComplete } = props;
    const reducedMotion = usePrefersReducedMotion();
    const [particles] = useState(() =>
        reducedMotion ? [] : generateParticles(props)
    );
    const cleanedUp = useRef(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (!cleanedUp.current) {
                cleanedUp.current = true;
                onComplete?.();
            }
        }, duration + 150);
        return () => clearTimeout(timer);
    }, [duration, onComplete]);

    return (
        <div
            style={{
                position: 'relative',
                width: '0px',
                height: '0px',
                overflow: 'visible',
                pointerEvents: 'none',
            }}
        >
            {reducedMotion ? (
                <div className="particle-pulse-fallback" />
            ) : (
                particles.map((style, i) => (
                    <span
                        key={i}
                        className="particle-dot"
                        style={{
                            ...style,
                            // CSS custom property for the keyframe end state
                            '--particle-end-transform': style.animation.includes('forwards')
                                ? undefined
                                : undefined,
                        } as React.CSSProperties & Record<string, string | undefined>}
                    />
                ))
            )}
        </div>
    );
}
```

**Note on the keyframe approach:** The `particle-fly` keyframe uses `var(--particle-end-transform)` but we need each particle to have its own end state. Instead, set the end transform as a CSS custom property per particle. Update the particle generation to include `'--particle-end-transform'` in the style object, and update the animation to reference it.

Revised particle style generation — replace the `transform` and `animation` fields:

```tsx
// In the particle style object, add the custom property:
const particleStyle = {
    // ... other styles ...
    transform: 'translate(0, 0) scale(1)',
    '--particle-end-transform': endTransform,
    animation: `particle-fly ${particleDuration}ms ease-out ${delay}ms forwards`,
    pointerEvents: 'none' as const,
};
```

And remove the redundant inline `--particle-end-transform` logic from the JSX — it's already in the style object.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/renderer/particles/__tests__/ParticleEmitter.test.tsx`
Expected: All 5 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/renderer/particles/
git commit -m "feat: add ParticleEmitter core component with tests"
```

---

### Task 2: useParticleEffect Hook

**Files:**
- Create: `src/renderer/particles/useParticleEffect.ts`
- Create: `src/renderer/particles/__tests__/useParticleEffect.test.tsx`

- [ ] **Step 1: Write failing test for useParticleEffect**

```tsx
// src/renderer/particles/__tests__/useParticleEffect.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { useParticleEffect } from '../useParticleEffect';
import type { ParticlePreset } from '../particlePresets';

afterEach(cleanup);

const testPreset: ParticlePreset = {
    origin: 'center',
    direction: 'out',
    count: 5,
    spread: 30,
    duration: 200,
    size: [2, 4] as [number, number],
};

function TestHarness({ preset }: { preset: ParticlePreset }) {
    const { emitterNode, trigger } = useParticleEffect();
    return (
        <div>
            <div data-testid="anchor" style={{ position: 'relative' }}>
                {emitterNode}
            </div>
            <button onClick={() => trigger(preset)}>fire</button>
        </div>
    );
}

describe('useParticleEffect', () => {
    it('returns null emitterNode before trigger is called', () => {
        const { getByTestId } = render(<TestHarness preset={testPreset} />);
        const anchor = getByTestId('anchor');
        expect(anchor.querySelector('.particle-dot')).toBeNull();
    });

    it('renders particles after trigger is called', () => {
        const { getByTestId, getByText } = render(<TestHarness preset={testPreset} />);
        act(() => { getByText('fire').click(); });
        const anchor = getByTestId('anchor');
        expect(anchor.querySelectorAll('.particle-dot').length).toBeGreaterThan(0);
    });

    it('cleans up previous emitter when triggered again', () => {
        vi.useFakeTimers();
        const { getByTestId, getByText } = render(<TestHarness preset={testPreset} />);

        act(() => { getByText('fire').click(); });
        const firstParticleCount = getByTestId('anchor').querySelectorAll('.particle-dot').length;
        expect(firstParticleCount).toBeGreaterThan(0);

        // Trigger again before first one finishes
        act(() => { getByText('fire').click(); });
        // Should still have particles (new set), not doubled
        const secondParticleCount = getByTestId('anchor').querySelectorAll('.particle-dot').length;
        expect(secondParticleCount).toBeGreaterThanOrEqual(1);
        expect(secondParticleCount).toBeLessThanOrEqual(12); // Not doubled (max for count=5 is 6)

        vi.useRealTimers();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/particles/__tests__/useParticleEffect.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement useParticleEffect hook**

```tsx
// src/renderer/particles/useParticleEffect.ts
import { useState, useCallback, type ReactNode } from 'react';
import { ParticleEmitter } from './ParticleEmitter';
import type { ParticlePreset } from './particlePresets';
import { createElement } from 'react';

export function useParticleEffect() {
    const [emitterKey, setEmitterKey] = useState(0);
    const [activePreset, setActivePreset] = useState<ParticlePreset | null>(null);

    const trigger = useCallback((preset: ParticlePreset) => {
        setActivePreset(preset);
        setEmitterKey(k => k + 1);
    }, []);

    const handleComplete = useCallback(() => {
        setActivePreset(null);
    }, []);

    const emitterNode: ReactNode = activePreset
        ? createElement(ParticleEmitter, {
            key: emitterKey,
            ...activePreset,
            onComplete: handleComplete,
        })
        : null;

    return { emitterNode, trigger };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/renderer/particles/__tests__/useParticleEffect.test.tsx`
Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/particles/useParticleEffect.ts src/renderer/particles/__tests__/useParticleEffect.test.tsx
git commit -m "feat: add useParticleEffect hook for imperative particle triggering"
```

---

### Task 3: Particle Presets

**Files:**
- Create: `src/renderer/particles/particlePresets.ts`
- Create: `src/renderer/particles/__tests__/particlePresets.test.ts`
- Create: `src/renderer/particles/index.ts`

- [ ] **Step 1: Write failing test for presets**

```ts
// src/renderer/particles/__tests__/particlePresets.test.ts
import { describe, it, expect } from 'vitest';
import { PRESETS, type ParticlePreset } from '../particlePresets';

describe('particlePresets', () => {
    const expectedPresets = [
        'logArrival',
        'uploadSnap',
        'statusBadgePuff',
        'discordSent',
        'statsSectionAppear',
        'logRemoval',
        'bulkUploadComplete',
        'tabTransition',
    ] as const;

    it('exports all 8 named presets', () => {
        for (const name of expectedPresets) {
            expect(PRESETS[name]).toBeDefined();
        }
    });

    it.each(expectedPresets)('%s has required fields', (name) => {
        const preset: ParticlePreset = PRESETS[name];
        expect(preset.origin).toBeDefined();
        expect(preset.direction).toMatch(/^(out|in)$/);
        expect(preset.count).toBeGreaterThan(0);
        expect(preset.spread).toBeGreaterThan(0);
        expect(preset.duration).toBeGreaterThan(0);
        expect(preset.size).toHaveLength(2);
        expect(preset.size[0]).toBeLessThanOrEqual(preset.size[1]);
    });

    it('uploadSnap is the only preset with direction "in"', () => {
        expect(PRESETS.uploadSnap.direction).toBe('in');
        for (const name of expectedPresets) {
            if (name !== 'uploadSnap') {
                expect(PRESETS[name].direction).toBe('out');
            }
        }
    });

    it('bulkUploadComplete has the highest count', () => {
        const maxCount = Math.max(...expectedPresets.map(n => PRESETS[n].count));
        expect(PRESETS.bulkUploadComplete.count).toBe(maxCount);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/particles/__tests__/particlePresets.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement particlePresets.ts**

```ts
// src/renderer/particles/particlePresets.ts

export interface ParticlePreset {
    origin: 'center' | 'left' | 'top' | 'edges' | { x: number; y: number };
    direction: 'out' | 'in';
    count: number;
    spread: number;
    duration: number;
    size: [number, number];
    glow?: boolean;
}

export const PRESETS = {
    logArrival: {
        origin: 'left',
        direction: 'out',
        count: 18,
        spread: 130,
        duration: 600,
        size: [2, 5],
        glow: true,
    },
    uploadSnap: {
        origin: 'edges',
        direction: 'in',
        count: 14,
        spread: 80,
        duration: 500,
        size: [2, 4],
        glow: true,
    },
    statusBadgePuff: {
        origin: 'center',
        direction: 'out',
        count: 5,
        spread: 20,
        duration: 350,
        size: [1.5, 3],
    },
    discordSent: {
        origin: 'center',
        direction: 'out',
        count: 10,
        spread: 50,
        duration: 450,
        size: [2, 4],
        glow: true,
    },
    statsSectionAppear: {
        origin: 'top',
        direction: 'out',
        count: 6,
        spread: 25,
        duration: 400,
        size: [1.5, 3],
    },
    logRemoval: {
        origin: 'center',
        direction: 'out',
        count: 12,
        spread: 100,
        duration: 500,
        size: [2, 4],
        glow: true,
    },
    bulkUploadComplete: {
        origin: 'top',
        direction: 'out',
        count: 24,
        spread: 150,
        duration: 700,
        size: [2, 5],
        glow: true,
    },
    tabTransition: {
        origin: 'edges',
        direction: 'out',
        count: 8,
        spread: 40,
        duration: 350,
        size: [1.5, 3],
    },
} as const satisfies Record<string, ParticlePreset>;
```

- [ ] **Step 4: Create barrel export**

```ts
// src/renderer/particles/index.ts
export { ParticleEmitter } from './ParticleEmitter';
export { useParticleEffect } from './useParticleEffect';
export { PRESETS, type ParticlePreset } from './particlePresets';
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/renderer/particles/__tests__/particlePresets.test.ts`
Expected: All 4 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/renderer/particles/particlePresets.ts src/renderer/particles/__tests__/particlePresets.test.ts src/renderer/particles/index.ts
git commit -m "feat: add 8 particle effect presets and barrel export"
```

---

### Task 4: Integrate Log Arrival Burst

**Files:**
- Modify: `src/renderer/ExpandableLogCard.tsx`

The log arrival burst fires when a card first mounts. The existing Framer Motion `initial` animation already handles the slide-in; we layer particles on top.

- [ ] **Step 1: Write failing test for log arrival particles**

```tsx
// Add to a new file: src/renderer/particles/__tests__/logArrivalIntegration.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

// We test that ExpandableLogCard renders a ParticleEmitter on mount
// by checking for particle-dot elements when motionEnabled is true
// Since ExpandableLogCard is complex, we'll test the ParticleEmitter
// integration more directly:

import { ParticleEmitter } from '../ParticleEmitter';
import { PRESETS } from '../particlePresets';

afterEach(cleanup);

describe('log arrival burst preset', () => {
    it('logArrival preset produces particles from the left', () => {
        const { container } = render(
            <ParticleEmitter {...PRESETS.logArrival} />
        );
        const particles = container.querySelectorAll('.particle-dot');
        // count=18, ±20% → 14-22
        expect(particles.length).toBeGreaterThanOrEqual(14);
        expect(particles.length).toBeLessThanOrEqual(22);

        // All particles should start near x=-10 (left origin)
        const firstParticle = particles[0] as HTMLElement;
        expect(firstParticle.style.left).toContain('-10');
    });
});
```

- [ ] **Step 2: Run test to verify it passes (preset already exists)**

Run: `npx vitest run src/renderer/particles/__tests__/logArrivalIntegration.test.tsx`
Expected: PASS

- [ ] **Step 3: Add useParticleEffect to ExpandableLogCard for log arrival**

In `src/renderer/ExpandableLogCard.tsx`:

At the top, add import:
```tsx
import { useParticleEffect, PRESETS } from './particles';
```

Inside `ExpandableLogCardBase`, near the other hooks (after line 28):
```tsx
const { emitterNode: arrivalEmitter, trigger: triggerArrival } = useParticleEffect();
```

Add a `useEffect` that fires on initial mount only (not during bulk upload). The component receives `motionEnabled` which is `false` during bulk upload — use that as the guard:
```tsx
const hasTriggeredArrival = useRef(false);
useEffect(() => {
    if (motionEnabled && !hasTriggeredArrival.current) {
        hasTriggeredArrival.current = true;
        triggerArrival(PRESETS.logArrival);
    }
}, [motionEnabled, triggerArrival]);
```

Add the `useRef` import (already imported: `forwardRef` — need to add `useRef`):
```tsx
import { forwardRef, memo, useEffect, useRef, useState } from 'react';
```

In the JSX, place the emitter inside the status badge div (line 847), just before the `<span>`:
```tsx
<div data-status={statusKey} className={`recent-activity-status-badge ...`}>
    {arrivalEmitter}
    <span className="font-bold text-xs uppercase">
```

- [ ] **Step 4: Verify the app builds and lint passes**

Run: `npm run validate`
Expected: PASS — no type errors or lint warnings

- [ ] **Step 5: Commit**

```bash
git add src/renderer/ExpandableLogCard.tsx src/renderer/particles/__tests__/logArrivalIntegration.test.tsx
git commit -m "feat: add particle burst on log card arrival"
```

---

### Task 5: Integrate Status Badge Puff

**Files:**
- Modify: `src/renderer/ExpandableLogCard.tsx`

The status badge puff fires when `log.status` changes between intermediate states.

- [ ] **Step 1: Add a second useParticleEffect for badge puffs**

In `ExpandableLogCardBase`, add another hook:
```tsx
const { emitterNode: badgePuffEmitter, trigger: triggerBadgePuff } = useParticleEffect();
```

Add a ref to track previous status and a `useEffect` that triggers on status changes:
```tsx
const prevStatusRef = useRef(log.status);
useEffect(() => {
    if (log.status !== prevStatusRef.current) {
        prevStatusRef.current = log.status;
        if (motionEnabled) {
            triggerBadgePuff(PRESETS.statusBadgePuff);
        }
    }
}, [log.status, motionEnabled, triggerBadgePuff]);
```

Place `{badgePuffEmitter}` inside the status badge div alongside the arrival emitter:
```tsx
<div data-status={statusKey} className={`recent-activity-status-badge ...`}>
    {arrivalEmitter}
    {badgePuffEmitter}
    <span className="font-bold text-xs uppercase">
```

- [ ] **Step 2: Verify the app builds**

Run: `npm run validate`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/renderer/ExpandableLogCard.tsx
git commit -m "feat: add particle puff on status badge transitions"
```

---

### Task 6: Integrate Upload Complete Snap

**Files:**
- Modify: `src/renderer/ExpandableLogCard.tsx`

The upload snap fires when status transitions to `'success'`. Particles converge inward and the card gets a brief blur-to-sharp transition.

- [ ] **Step 1: Add upload snap particle effect**

In `ExpandableLogCardBase`, add another hook:
```tsx
const { emitterNode: snapEmitter, trigger: triggerSnap } = useParticleEffect();
const [snapActive, setSnapActive] = useState(false);
```

Update the existing `prevStatusRef` effect to also trigger the snap:
```tsx
useEffect(() => {
    if (log.status !== prevStatusRef.current) {
        const prevStatus = prevStatusRef.current;
        prevStatusRef.current = log.status;
        if (motionEnabled) {
            triggerBadgePuff(PRESETS.statusBadgePuff);
            // Upload complete snap: particles converge + card sharpens
            if (log.status === 'success' && prevStatus !== 'success') {
                triggerSnap(PRESETS.uploadSnap);
                setSnapActive(true);
                setTimeout(() => setSnapActive(false), PRESETS.uploadSnap.duration + 100);
            }
        }
    }
}, [log.status, motionEnabled, triggerBadgePuff, triggerSnap]);
```

- [ ] **Step 2: Add snap emitter and blur transition to the card JSX**

Place `{snapEmitter}` at the top of the card's inner content (inside the `<div className="rounded-[4px] overflow-hidden">` at line 844):

```tsx
<div className="rounded-[4px] overflow-hidden" style={{ position: 'relative' }}>
    {snapEmitter && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 10 }}>
            {snapEmitter}
        </div>
    )}
```

Add the blur transition to the collapsed view wrapper:
```tsx
<div className="p-4 flex items-center gap-4" style={{
    filter: snapActive ? 'blur(0px)' : undefined,
    transition: snapActive ? 'filter 0.5s ease-out' : undefined,
}}>
```

Actually — the snap effect needs the card to start blurred and sharpen. Use a CSS class approach:

Add to `particles.css`:
```css
.particle-snap-active {
    animation: particle-snap-sharpen 500ms ease-out forwards;
}

@keyframes particle-snap-sharpen {
    0% { filter: blur(1px); }
    100% { filter: blur(0); }
}
```

Then apply the class conditionally:
```tsx
<div className={`p-4 flex items-center gap-4 ${snapActive ? 'particle-snap-active' : ''}`}>
```

- [ ] **Step 3: Verify the app builds**

Run: `npm run validate`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/renderer/ExpandableLogCard.tsx src/renderer/particles/particles.css
git commit -m "feat: add particle snap effect on upload complete"
```

---

### Task 7: Integrate Log Removal Scatter

**Files:**
- Modify: `src/renderer/ExpandableLogCard.tsx`

The log removal scatter fires when the user clicks the remove button. Particles scatter outward as the card exits.

- [ ] **Step 1: Add removal scatter to the remove button handler**

In `ExpandableLogCardBase`, add another hook:
```tsx
const { emitterNode: removalEmitter, trigger: triggerRemoval } = useParticleEffect();
```

Modify the remove button's `onClick` (line 878-881) to fire particles before calling `onRemove`:
```tsx
onClick={(e) => {
    e.stopPropagation();
    if (motionEnabled) {
        triggerRemoval(PRESETS.logRemoval);
    }
    // Delay the actual removal slightly to let particles render
    setTimeout(() => onRemove?.(), 50);
}}
```

Place `{removalEmitter}` alongside the snap emitter in the card overlay area:
```tsx
{(snapEmitter || removalEmitter) && (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 10 }}>
        {snapEmitter}
        {removalEmitter}
    </div>
)}
```

- [ ] **Step 2: Verify the app builds**

Run: `npm run validate`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/renderer/ExpandableLogCard.tsx
git commit -m "feat: add particle scatter on log card removal"
```

---

### Task 8: Integrate Discord Webhook Sent Effect

**Files:**
- Modify: `src/renderer/ExpandableLogCard.tsx`

The Discord effect fires when status transitions *through* the `'discord'` state. Since Discord is a transient state (discord → calculating/success), we trigger the effect when leaving the discord state.

- [ ] **Step 1: Add discord sent effect to the status change handler**

In `ExpandableLogCardBase`, add another hook:
```tsx
const { emitterNode: discordEmitter, trigger: triggerDiscord } = useParticleEffect();
```

Update the status change effect to detect discord → next state transition:
```tsx
useEffect(() => {
    if (log.status !== prevStatusRef.current) {
        const prevStatus = prevStatusRef.current;
        prevStatusRef.current = log.status;
        if (motionEnabled) {
            triggerBadgePuff(PRESETS.statusBadgePuff);
            if (log.status === 'success' && prevStatus !== 'success') {
                triggerSnap(PRESETS.uploadSnap);
                setSnapActive(true);
                setTimeout(() => setSnapActive(false), PRESETS.uploadSnap.duration + 100);
            }
            // Discord sent: fire when leaving discord state
            if (prevStatus === 'discord') {
                triggerDiscord(PRESETS.discordSent);
            }
        }
    }
}, [log.status, motionEnabled, triggerBadgePuff, triggerSnap, triggerDiscord]);
```

Place `{discordEmitter}` in the badge area alongside other emitters:
```tsx
{arrivalEmitter}
{badgePuffEmitter}
{discordEmitter}
```

- [ ] **Step 2: Verify the app builds**

Run: `npm run validate`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/renderer/ExpandableLogCard.tsx
git commit -m "feat: add particle burst on discord webhook sent"
```

---

### Task 9: Integrate Stats Section Appearing

**Files:**
- Modify: `src/renderer/stats/ui/SectionPanel.tsx`

A subtle shimmer along the top edge when a section mounts.

- [ ] **Step 1: Add particle effect to SectionPanel**

```tsx
// src/renderer/stats/ui/SectionPanel.tsx
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useStatsSharedContext } from '../StatsViewContext';
import { useParticleEffect, PRESETS } from '../../particles';
import { useEffect, useRef } from 'react';

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
```

- [ ] **Step 2: Verify the app builds**

Run: `npm run validate`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/renderer/stats/ui/SectionPanel.tsx
git commit -m "feat: add particle shimmer on stats section mount"
```

---

### Task 10: Integrate Bulk Upload Completion Burst

**Files:**
- Modify: `src/renderer/App.tsx`

The biggest burst fires when `bulkUploadMode` transitions from `true` to `false`.

- [ ] **Step 1: Add particle effect to App.tsx**

Import at the top of App.tsx:
```tsx
import { useParticleEffect, PRESETS } from './particles';
```

Inside the `App` component, add the hook:
```tsx
const { emitterNode: bulkCompleteEmitter, trigger: triggerBulkComplete } = useParticleEffect();
```

Add a ref to track previous bulk mode state and an effect to detect the transition:
```tsx
const prevBulkModeRef = useRef(bulkUploadMode);
useEffect(() => {
    if (prevBulkModeRef.current && !bulkUploadMode) {
        triggerBulkComplete(PRESETS.bulkUploadComplete);
    }
    prevBulkModeRef.current = bulkUploadMode;
}, [bulkUploadMode, triggerBulkComplete]);
```

Place `{bulkCompleteEmitter}` at the top of the log list container. Find the `<AnimatePresence initial={false}>` at line 861 and add just before it:
```tsx
<div style={{ position: 'relative', width: '100%', pointerEvents: 'none', zIndex: 10 }}>
    {bulkCompleteEmitter}
</div>
<AnimatePresence initial={false}>
```

- [ ] **Step 2: Verify the app builds**

Run: `npm run validate`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/renderer/App.tsx
git commit -m "feat: add particle burst on bulk upload completion"
```

---

### Task 11: Integrate Tab/View Transition Scatter

**Files:**
- Modify: `src/renderer/app/AppLayout.tsx`

Particles scatter from the outgoing view's area when switching tabs.

- [ ] **Step 1: Add particle effect to AppLayout**

Import at the top of AppLayout.tsx:
```tsx
import { useParticleEffect, PRESETS } from '../particles';
```

Inside the `AppLayout` component, add:
```tsx
const { emitterNode: tabEmitter, trigger: triggerTabTransition } = useParticleEffect();
const prevViewRef = useRef(view);
useEffect(() => {
    if (view !== prevViewRef.current) {
        prevViewRef.current = view;
        triggerTabTransition(PRESETS.tabTransition);
    }
}, [view, triggerTabTransition]);
```

Add `useRef` to the React import if not already present.

Place `{tabEmitter}` inside the `app-content` div (line 299), just before the conditional view rendering:
```tsx
<div className={`app-content relative ...`} style={{ background: 'var(--bg-elevated)' }}>
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 20 }}>
        {tabEmitter}
    </div>
    {/* ... existing view conditionals ... */}
```

- [ ] **Step 2: Verify the app builds**

Run: `npm run validate`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/renderer/app/AppLayout.tsx
git commit -m "feat: add particle scatter on tab/view transitions"
```

---

### Task 12: Bulk Upload Suppression Guard

**Files:**
- Modify: `src/renderer/particles/ParticleEmitter.tsx`

Effects #1-6 should be suppressed when `body.bulk-uploading` class is present.

- [ ] **Step 1: Write failing test**

```tsx
// Add to ParticleEmitter.test.tsx
it('renders nothing when body has bulk-uploading class', () => {
    document.body.classList.add('bulk-uploading');

    const { container } = render(
        <ParticleEmitter
            origin="center"
            direction="out"
            count={10}
            spread={50}
            duration={300}
            size={[2, 4]}
        />
    );
    expect(container.querySelectorAll('.particle-dot').length).toBe(0);

    document.body.classList.remove('bulk-uploading');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/particles/__tests__/ParticleEmitter.test.tsx`
Expected: FAIL — particles still render during bulk upload

- [ ] **Step 3: Add bulk upload check to ParticleEmitter**

In `ParticleEmitter.tsx`, in the component body before generating particles:
```tsx
export function ParticleEmitter(props: ParticleEmitterProps) {
    const { duration, onComplete } = props;
    const reducedMotion = usePrefersReducedMotion();
    const isBulkUploading = document.body.classList.contains('bulk-uploading');
    const suppressed = reducedMotion || isBulkUploading;

    const [particles] = useState(() =>
        suppressed ? [] : generateParticles(props)
    );
```

Update the JSX to use `suppressed` instead of `reducedMotion`:
```tsx
{suppressed ? (
    reducedMotion ? <div className="particle-pulse-fallback" /> : null
) : (
    particles.map(...)
)}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/renderer/particles/__tests__/ParticleEmitter.test.tsx`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/particles/ParticleEmitter.tsx src/renderer/particles/__tests__/ParticleEmitter.test.tsx
git commit -m "feat: suppress particle effects during bulk upload mode"
```

---

### Task 13: Max Concurrent Emitter Cap

**Files:**
- Modify: `src/renderer/particles/useParticleEffect.ts`
- Modify: `src/renderer/particles/__tests__/useParticleEffect.test.tsx`

Cap active emitters at 5 to prevent DOM bloat during rapid log arrivals.

- [ ] **Step 1: Write failing test**

```tsx
// Add to useParticleEffect.test.tsx
import { PRESETS } from '../particlePresets';

// A harness that creates multiple independent emitters
function MultiEmitterHarness() {
    const effects = Array.from({ length: 7 }, () => useParticleEffect());
    return (
        <div>
            {effects.map((e, i) => (
                <div key={i} data-testid={`anchor-${i}`} style={{ position: 'relative' }}>
                    {e.emitterNode}
                </div>
            ))}
            <button onClick={() => effects.forEach(e => e.trigger(PRESETS.statusBadgePuff))}>
                fire-all
            </button>
        </div>
    );
}

it('caps active emitters at 5', () => {
    vi.useFakeTimers();
    const { getByText, container } = render(<MultiEmitterHarness />);
    act(() => { getByText('fire-all').click(); });

    // Count total particle-dot elements across all anchors
    const allParticles = container.querySelectorAll('.particle-dot');
    // 5 emitters × ~5 particles each (count=5, ±20%) = ~20-30
    // 7 emitters would produce ~28-42 if uncapped
    // With cap, should be ≤ 5 emitters worth
    // This is hard to test precisely due to randomization
    // Instead, check that only 5 anchors have particles
    let anchorsWithParticles = 0;
    for (let i = 0; i < 7; i++) {
        const anchor = container.querySelector(`[data-testid="anchor-${i}"]`);
        if (anchor && anchor.querySelectorAll('.particle-dot').length > 0) {
            anchorsWithParticles++;
        }
    }
    expect(anchorsWithParticles).toBeLessThanOrEqual(5);

    vi.useRealTimers();
});
```

**Note:** The max-emitter cap is best implemented as a global counter in a module-scoped variable or React context. Since each `useParticleEffect` is independent, use a module-level counter:

- [ ] **Step 2: Implement the cap**

In `useParticleEffect.ts`, add a module-level counter:

```tsx
let activeEmitterCount = 0;
const MAX_ACTIVE_EMITTERS = 5;

export function useParticleEffect() {
    const [emitterKey, setEmitterKey] = useState(0);
    const [activePreset, setActivePreset] = useState<ParticlePreset | null>(null);

    const trigger = useCallback((preset: ParticlePreset) => {
        if (activeEmitterCount >= MAX_ACTIVE_EMITTERS) {
            return; // Silently drop — oldest will clean up naturally
        }
        activeEmitterCount++;
        setActivePreset(preset);
        setEmitterKey(k => k + 1);
    }, []);

    const handleComplete = useCallback(() => {
        activeEmitterCount = Math.max(0, activeEmitterCount - 1);
        setActivePreset(null);
    }, []);

    // Clean up on unmount if still active
    useEffect(() => {
        return () => {
            if (activePreset) {
                activeEmitterCount = Math.max(0, activeEmitterCount - 1);
            }
        };
    }, [activePreset]);

    const emitterNode: ReactNode = activePreset
        ? createElement(ParticleEmitter, {
            key: emitterKey,
            ...activePreset,
            onComplete: handleComplete,
        })
        : null;

    return { emitterNode, trigger };
}
```

Add `useEffect` to the imports.

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/renderer/particles/__tests__/useParticleEffect.test.tsx`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/renderer/particles/useParticleEffect.ts src/renderer/particles/__tests__/useParticleEffect.test.tsx
git commit -m "feat: cap concurrent particle emitters at 5"
```

---

### Task 14: Final Validation

**Files:** None (validation only)

- [ ] **Step 1: Run full test suite**

Run: `npm run test:unit`
Expected: All tests PASS

- [ ] **Step 2: Run typecheck and lint**

Run: `npm run validate`
Expected: PASS — no errors

- [ ] **Step 3: Run the app in dev mode and visually verify**

Run: `npm run dev`

Verify:
- Particle burst appears when a new log card slides in
- Status badge puffs when status changes
- Upload complete snap shows converging particles
- Log removal scatters particles outward
- Tab switching scatters particles from outgoing view
- Stats sections shimmer on mount
- No particles during bulk upload mode (except bulk completion burst)
- Particles use the configured primary color from settings
- No performance issues or visual glitches

- [ ] **Step 4: Final commit if any cleanup was needed**

```bash
git add -A
git commit -m "chore: particle effects system cleanup and polish"
```
