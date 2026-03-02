import { describe, it, expect } from 'vitest';
import { parseTimestamp, resolveFightTimestamp } from '../stats/utils/timestampUtils';

// ─── parseTimestamp ────────────────────────────────────────────────────────────

describe('parseTimestamp', () => {
    it('returns 0 for null', () => expect(parseTimestamp(null)).toBe(0));
    it('returns 0 for undefined', () => expect(parseTimestamp(undefined)).toBe(0));
    it('returns 0 for empty string', () => expect(parseTimestamp('')).toBe(0));

    it('returns 0 for non-finite numbers', () => {
        expect(parseTimestamp(NaN)).toBe(0);
        expect(parseTimestamp(Infinity)).toBe(0);
        expect(parseTimestamp(-Infinity)).toBe(0);
    });

    it('returns 0 for zero or negative numbers', () => {
        expect(parseTimestamp(0)).toBe(0);
        expect(parseTimestamp(-1)).toBe(0);
    });

    it('treats numbers > 1e12 as milliseconds (returns them unchanged)', () => {
        const ms = 1700000000000;
        expect(parseTimestamp(ms)).toBe(ms);
    });

    it('treats numbers <= 1e12 as seconds (converts to ms)', () => {
        const sec = 1700000000;
        expect(parseTimestamp(sec)).toBe(sec * 1000);
    });

    it('parses numeric string milliseconds', () => {
        const ms = 1700000000000;
        expect(parseTimestamp(String(ms))).toBe(ms);
    });

    it('parses numeric string seconds', () => {
        expect(parseTimestamp('1700000000')).toBe(1700000000 * 1000);
    });

    it('parses ISO 8601 date string', () => {
        const iso = '2023-11-14T22:13:20.000Z';
        expect(parseTimestamp(iso)).toBe(Date.parse(iso));
    });

    it('parses ISO 8601 string with short timezone offset (no colon)', () => {
        const iso = '2023-11-14T23:13:20+0100';
        const result = parseTimestamp(iso);
        expect(result).toBeGreaterThan(0);
    });

    it('returns 0 for unparseable strings', () => {
        expect(parseTimestamp('not-a-date')).toBe(0);
        expect(parseTimestamp('abc')).toBe(0);
    });

    it('handles Date objects', () => {
        const d = new Date('2023-11-14T22:13:20.000Z');
        expect(parseTimestamp(d)).toBe(d.getTime());
    });

    it('returns 0 for invalid Date objects', () => {
        expect(parseTimestamp(new Date('invalid'))).toBe(0);
    });
});

// ─── resolveFightTimestamp ─────────────────────────────────────────────────────

describe('resolveFightTimestamp', () => {
    it('prefers timeStartStd', () => {
        const details = { timeStartStd: 1700000000, timeStart: 1600000000 };
        expect(resolveFightTimestamp(details, {})).toBe(1700000000 * 1000);
    });

    it('falls back to timeStart when timeStartStd is absent', () => {
        const details = { timeStart: 1700000001 };
        expect(resolveFightTimestamp(details, {})).toBe(1700000001 * 1000);
    });

    it('falls back to timeEndStd', () => {
        expect(resolveFightTimestamp({ timeEndStd: 1700000002 }, {})).toBe(1700000002 * 1000);
    });

    it('falls back to timeEnd', () => {
        expect(resolveFightTimestamp({ timeEnd: 1700000003 }, {})).toBe(1700000003 * 1000);
    });

    it('falls back to timeStartText', () => {
        expect(resolveFightTimestamp({ timeStartText: 1700000004 }, {})).toBe(1700000004 * 1000);
    });

    it('falls back to timeEndText', () => {
        expect(resolveFightTimestamp({ timeEndText: 1700000005 }, {})).toBe(1700000005 * 1000);
    });

    it('falls back to details.uploadTime', () => {
        expect(resolveFightTimestamp({ uploadTime: 1700000006 }, {})).toBe(1700000006 * 1000);
    });

    it('falls back to log.uploadTime', () => {
        expect(resolveFightTimestamp({}, { uploadTime: 1700000007 })).toBe(1700000007 * 1000);
    });

    it('returns 0 when all fields are absent', () => {
        expect(resolveFightTimestamp({}, {})).toBe(0);
        expect(resolveFightTimestamp(null, null)).toBe(0);
    });

    it('returns 0 when details is null', () => {
        expect(resolveFightTimestamp(null, { uploadTime: 0 })).toBe(0);
    });

    it('handles ISO date strings in the fields', () => {
        const iso = '2023-11-14T22:13:20.000Z';
        const result = resolveFightTimestamp({ timeStartStd: iso }, {});
        expect(result).toBe(Date.parse(iso));
    });
});
