import { describe, it, expect } from 'vitest';
import { PRESETS, type ParticlePreset } from '../particlePresets';

const PRESET_NAMES = [
    'logArrival',
    'uploadSuccess',
    'statusBadgePuff',
    'discordSent',
    'statsSectionAppear',
    'logRemoval',
    'bulkUploadComplete',
    'tabTransition',
] as const;

describe('PRESETS', () => {
    it('exports all 8 named presets', () => {
        for (const name of PRESET_NAMES) {
            expect(PRESETS).toHaveProperty(name);
        }
        expect(Object.keys(PRESETS)).toHaveLength(8);
    });

    describe.each(PRESET_NAMES)('%s has required fields with valid values', (name) => {
        it('has a valid origin', () => {
            const preset = PRESETS[name] as ParticlePreset;
            const validOrigins = ['center', 'left', 'right', 'top', 'edges', 'surface'];
            const origin = preset.origin;
            const isValid =
                validOrigins.includes(origin as string) ||
                (typeof origin === 'object' &&
                    typeof (origin as { x: number; y: number }).x === 'number' &&
                    typeof (origin as { x: number; y: number }).y === 'number');
            expect(isValid).toBe(true);
        });

        it('has direction matching /^(out|in)$/', () => {
            const preset = PRESETS[name] as ParticlePreset;
            expect(preset.direction).toMatch(/^(out|in)$/);
        });

        it('has count > 0', () => {
            const preset = PRESETS[name] as ParticlePreset;
            expect(preset.count).toBeGreaterThan(0);
        });

        it('has spread > 0', () => {
            const preset = PRESETS[name] as ParticlePreset;
            expect(preset.spread).toBeGreaterThan(0);
        });

        it('has duration > 0', () => {
            const preset = PRESETS[name] as ParticlePreset;
            expect(preset.duration).toBeGreaterThan(0);
        });

        it('has size as [number, number] with min <= max', () => {
            const preset = PRESETS[name] as ParticlePreset;
            expect(Array.isArray(preset.size)).toBe(true);
            expect(preset.size).toHaveLength(2);
            expect(typeof preset.size[0]).toBe('number');
            expect(typeof preset.size[1]).toBe('number');
            expect(preset.size[0]).toBeLessThanOrEqual(preset.size[1]);
        });
    });

    it('no presets use direction "in"', () => {
        const inPresets = Object.entries(PRESETS).filter(
            ([, preset]) => (preset as ParticlePreset).direction === 'in'
        );
        expect(inPresets).toHaveLength(0);
    });

    it('logRemoval has the highest count of all presets', () => {
        const counts = Object.entries(PRESETS).map(([name, preset]) => ({
            name,
            count: (preset as ParticlePreset).count,
        }));
        const maxCount = Math.max(...counts.map((p) => p.count));
        expect((PRESETS.logRemoval as ParticlePreset).count).toBe(maxCount);
    });
});
