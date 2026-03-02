import { describe, it, expect } from 'vitest';
import { parseVersion, compareVersion, extractReleaseNotesRangeFromFile } from '../versionUtils';

// ─── parseVersion ─────────────────────────────────────────────────────────────

describe('parseVersion', () => {
    it('parses a plain semver string', () => {
        expect(parseVersion('1.2.3')).toEqual([1, 2, 3]);
    });

    it('strips leading "v"', () => {
        expect(parseVersion('v2.0.0')).toEqual([2, 0, 0]);
        expect(parseVersion('V1.2.3')).toEqual([1, 2, 3]);
    });

    it('trims whitespace', () => {
        expect(parseVersion('  1.2.3  ')).toEqual([1, 2, 3]);
    });

    it('handles single-digit parts', () => {
        expect(parseVersion('0.0.1')).toEqual([0, 0, 1]);
    });

    it('returns null for null / undefined', () => {
        expect(parseVersion(null)).toBeNull();
        expect(parseVersion(undefined)).toBeNull();
    });

    it('returns null for empty string', () => {
        expect(parseVersion('')).toBeNull();
    });

    it('returns null when any part is not a number', () => {
        expect(parseVersion('1.x.3')).toBeNull();
        expect(parseVersion('1.2.a')).toBeNull();
    });

    it('fills missing parts with 0', () => {
        // e.g. "1.2" → [1, 2, 0]
        const result = parseVersion('1.2');
        expect(result).not.toBeNull();
        expect(result![2]).toBe(0);
    });
});

// ─── compareVersion ───────────────────────────────────────────────────────────

describe('compareVersion', () => {
    it('returns 0 for equal versions', () => {
        expect(compareVersion([1, 2, 3], [1, 2, 3])).toBe(0);
    });

    it('returns positive when a > b (major)', () => {
        expect(compareVersion([2, 0, 0], [1, 9, 9])).toBeGreaterThan(0);
    });

    it('returns negative when a < b (major)', () => {
        expect(compareVersion([1, 0, 0], [2, 0, 0])).toBeLessThan(0);
    });

    it('compares minor when major is equal', () => {
        expect(compareVersion([1, 3, 0], [1, 2, 0])).toBeGreaterThan(0);
        expect(compareVersion([1, 1, 0], [1, 2, 0])).toBeLessThan(0);
    });

    it('compares patch when major and minor are equal', () => {
        expect(compareVersion([1, 2, 5], [1, 2, 3])).toBeGreaterThan(0);
        expect(compareVersion([1, 2, 1], [1, 2, 3])).toBeLessThan(0);
    });
});

// ─── extractReleaseNotesRangeFromFile ─────────────────────────────────────────

const makeNotes = (...versions: string[]) =>
    `# Release Notes\n\n${versions.map((v) => `Version v${v}\n\nChanges for ${v}.`).join('\n\n')}`;

describe('extractReleaseNotesRangeFromFile', () => {
    it('returns null for empty / whitespace-only notes', () => {
        expect(extractReleaseNotesRangeFromFile('', '1.0.0', null)).toBeNull();
        expect(extractReleaseNotesRangeFromFile('   ', '1.0.0', null)).toBeNull();
    });

    it('returns null for unparseable currentVersion', () => {
        expect(extractReleaseNotesRangeFromFile(makeNotes('1.0.0'), 'not-a-version', null)).toBeNull();
    });

    it('returns all sections up to currentVersion when lastSeen is null', () => {
        const notes = makeNotes('1.0.0', '1.1.0', '1.2.0');
        const result = extractReleaseNotesRangeFromFile(notes, '1.2.0', null);
        expect(result).toContain('Version v1.2.0');
        expect(result).toContain('Version v1.1.0');
        expect(result).toContain('Version v1.0.0');
    });

    it('excludes sections at or before lastSeenVersion', () => {
        const notes = makeNotes('1.0.0', '1.1.0', '1.2.0');
        const result = extractReleaseNotesRangeFromFile(notes, '1.2.0', '1.1.0');
        expect(result).toContain('Version v1.2.0');
        expect(result).not.toContain('Version v1.1.0');
        expect(result).not.toContain('Version v1.0.0');
    });

    it('excludes sections newer than currentVersion', () => {
        const notes = makeNotes('1.0.0', '1.1.0', '1.2.0', '2.0.0');
        const result = extractReleaseNotesRangeFromFile(notes, '1.2.0', null);
        expect(result).not.toContain('Version v2.0.0');
        expect(result).toContain('Version v1.2.0');
    });

    it('returns null when no sections fall in the range', () => {
        const notes = makeNotes('1.0.0', '1.1.0');
        // lastSeen is same as current — nothing new
        const result = extractReleaseNotesRangeFromFile(notes, '1.1.0', '1.1.0');
        expect(result).toBeNull();
    });

    it('sorts sections newest-first', () => {
        const notes = makeNotes('1.0.0', '1.1.0', '1.2.0');
        const result = extractReleaseNotesRangeFromFile(notes, '1.2.0', null)!;
        const idx120 = result.indexOf('Version v1.2.0');
        const idx110 = result.indexOf('Version v1.1.0');
        const idx100 = result.indexOf('Version v1.0.0');
        expect(idx120).toBeLessThan(idx110);
        expect(idx110).toBeLessThan(idx100);
    });

    it('wraps result in a "# Release Notes" header', () => {
        const notes = makeNotes('1.0.0');
        const result = extractReleaseNotesRangeFromFile(notes, '1.0.0', null)!;
        expect(result.startsWith('# Release Notes')).toBe(true);
    });

    it('handles notes without the header prefix', () => {
        const notes = 'Version v1.0.0\n\nInitial release.';
        const result = extractReleaseNotesRangeFromFile(notes, '1.0.0', null);
        expect(result).toContain('Version v1.0.0');
    });

    it('handles unparseable lastSeenVersion gracefully (treats as no lastSeen)', () => {
        const notes = makeNotes('1.0.0', '1.1.0');
        const result = extractReleaseNotesRangeFromFile(notes, '1.1.0', 'not-a-version');
        // lastSeen is null-treated, so all sections up to current should appear
        expect(result).toContain('Version v1.1.0');
        expect(result).toContain('Version v1.0.0');
    });

    it('includes currentVersion itself in output', () => {
        const notes = makeNotes('1.5.0');
        const result = extractReleaseNotesRangeFromFile(notes, '1.5.0', '1.4.0');
        expect(result).toContain('Version v1.5.0');
    });
});
