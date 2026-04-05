import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useParticleEffect } from '../useParticleEffect';
import type { ParticlePreset } from '../particlePresets';

// ─── Mock matchMedia (no reduced motion by default) ───────────────────────────

function mockMatchMedia(prefersReducedMotion: boolean) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)' ? prefersReducedMotion : false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(() => false),
    }));
}

// ─── Test preset ──────────────────────────────────────────────────────────────

const testPreset: ParticlePreset = {
    origin: 'center',
    direction: 'out',
    count: 5,
    spread: 30,
    duration: 200,
    size: [2, 4] as [number, number],
};

// ─── Test Harness ─────────────────────────────────────────────────────────────

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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useParticleEffect', () => {
    beforeEach(() => {
        mockMatchMedia(false);
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('returns null emitterNode before trigger is called (no .particle-dot in anchor)', () => {
        render(<TestHarness preset={testPreset} />);

        const anchor = screen.getByTestId('anchor');
        const dots = anchor.querySelectorAll('.particle-dot');
        expect(dots.length).toBe(0);
    });

    it('renders particles after trigger is called (.particle-dot elements appear)', async () => {
        render(<TestHarness preset={testPreset} />);

        const anchor = screen.getByTestId('anchor');
        expect(anchor.querySelectorAll('.particle-dot').length).toBe(0);

        act(() => {
            screen.getByRole('button', { name: 'fire' }).click();
        });

        const dots = anchor.querySelectorAll('.particle-dot');
        expect(dots.length).toBeGreaterThan(0);
    });

    it('cleans up previous emitter when triggered again (not doubled)', async () => {
        render(<TestHarness preset={testPreset} />);

        const anchor = screen.getByTestId('anchor');
        const btn = screen.getByRole('button', { name: 'fire' });

        // First trigger
        act(() => { btn.click(); });
        const countAfterFirst = anchor.querySelectorAll('.particle-dot').length;
        expect(countAfterFirst).toBeGreaterThan(0);

        // Second trigger before first completes
        act(() => { btn.click(); });
        const countAfterSecond = anchor.querySelectorAll('.particle-dot').length;

        // Should not be doubled — only one emitter active at a time
        expect(countAfterSecond).toBeLessThanOrEqual(countAfterFirst * 2);

        // More precisely: React key change unmounts the old and mounts a new one
        // so the count should be roughly the same, not doubled
        // (within ±20% variance of count)
        const maxExpected = Math.ceil(testPreset.count * 1.2);
        expect(countAfterSecond).toBeLessThanOrEqual(maxExpected * 2); // at most 2 emitters worth
        // Verify there's only a single wrapper (one emitter rendered)
        const wrappers = anchor.querySelectorAll('div[style*="overflow: visible"]');
        expect(wrappers.length).toBe(1);
    });

    it('removes particles after onComplete fires (duration + 150ms)', async () => {
        render(<TestHarness preset={testPreset} />);

        const anchor = screen.getByTestId('anchor');

        act(() => {
            screen.getByRole('button', { name: 'fire' }).click();
        });

        expect(anchor.querySelectorAll('.particle-dot').length).toBeGreaterThan(0);

        // Advance past duration + 150ms so onComplete fires
        act(() => {
            vi.advanceTimersByTime(testPreset.duration + 150 + 10);
        });

        // emitterNode should now be null → no particle-dot elements
        expect(anchor.querySelectorAll('.particle-dot').length).toBe(0);
    });
});
