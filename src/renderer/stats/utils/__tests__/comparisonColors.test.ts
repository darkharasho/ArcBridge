import { describe, it, expect } from 'vitest';
import { getComparisonColor, getDiffPercent } from '../comparisonColors';

describe('getComparisonColor', () => {
    describe('higher is better (default)', () => {
        it('returns green when value is better than reference', () => {
            const result = getComparisonColor(110, 100);
            expect(result.text).toBe('#22c55e');
            expect(result.bg).toBe('rgba(34,197,94,0.15)');
        });

        it('returns green when value is within 10% worse', () => {
            const result = getComparisonColor(95, 100);
            expect(result.text).toBe('#22c55e');
            expect(result.bg).toBe('rgba(34,197,94,0.15)');
        });

        it('returns orange when value is 10-30% worse', () => {
            const result = getComparisonColor(80, 100);
            expect(result.text).toBe('#f59e0b');
            expect(result.bg).toBe('rgba(245,158,11,0.12)');
        });

        it('returns red when value is 30%+ worse', () => {
            const result = getComparisonColor(60, 100);
            expect(result.text).toBe('#ef4444');
            expect(result.bg).toBe('rgba(239,68,68,0.15)');
        });

        it('returns neutral when reference is 0', () => {
            const result = getComparisonColor(50, 0);
            expect(result.text).toBe(null);
            expect(result.bg).toBe(null);
        });
    });

    describe('lower is better', () => {
        it('returns green when value is lower than reference', () => {
            const result = getComparisonColor(80, 100, true);
            expect(result.text).toBe('#22c55e');
        });

        it('returns red when value is 30%+ higher', () => {
            const result = getComparisonColor(140, 100, true);
            expect(result.text).toBe('#ef4444');
        });

        it('returns orange when value is 10-30% higher', () => {
            const result = getComparisonColor(120, 100, true);
            expect(result.text).toBe('#f59e0b');
        });
    });
});

describe('getDiffPercent', () => {
    it('returns positive percentage when value exceeds reference', () => {
        expect(getDiffPercent(150, 100)).toBe(50);
    });

    it('returns negative percentage when value is below reference', () => {
        expect(getDiffPercent(75, 100)).toBe(-25);
    });

    it('returns 0 when values are equal', () => {
        expect(getDiffPercent(100, 100)).toBe(0);
    });

    it('returns null when reference is 0', () => {
        expect(getDiffPercent(50, 0)).toBe(null);
    });

    it('handles lowerIsBetter by flipping sign', () => {
        expect(getDiffPercent(80, 100, true)).toBe(20);
        expect(getDiffPercent(120, 100, true)).toBe(-20);
    });
});
