import { afterEach, describe, expect, it } from 'vitest';
import { formatTopStatValue } from '../stats/utils/dashboardUtils';

const originalMatchMedia = window.matchMedia;

const setMobileViewport = (matches: boolean) => {
    window.matchMedia = ((query: string) => ({
        matches: query === '(max-width: 640px)' ? matches : false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false
    })) as any;
};

describe('dashboardUtils formatTopStatValue', () => {
    afterEach(() => {
        window.matchMedia = originalMatchMedia;
    });

    it('keeps significant trailing zeros for compact thousands on mobile', () => {
        setMobileViewport(true);
        expect(formatTopStatValue(399999)).toBe('400k');
    });

    it('formats non-round compact thousands on mobile', () => {
        setMobileViewport(true);
        expect(formatTopStatValue(374302)).toBe('374k');
    });
});
