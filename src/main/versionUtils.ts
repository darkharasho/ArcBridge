/**
 * Semver parsing / comparison utilities and release-notes extraction.
 * Pure — no I/O, no Electron APIs.
 */

// ─── Version parsing ──────────────────────────────────────────────────────────

/**
 * Parse a version string like "1.2.3" or "v1.2.3" into a numeric tuple.
 * Returns `null` for any non-parseable input.
 */
export const parseVersion = (value: string | null | undefined): number[] | null => {
    if (!value) return null;
    const cleaned = value.trim().replace(/^v/i, '');
    const parts = cleaned.split('.').map((part) => Number.parseInt(part, 10));
    if (parts.some((num) => Number.isNaN(num))) return null;
    return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
};

/**
 * Compare two version tuples produced by `parseVersion`.
 * Returns negative / zero / positive (like `Array.sort` comparator).
 */
export const compareVersion = (a: number[], b: number[]): number => {
    for (let i = 0; i < 3; i += 1) {
        if (a[i] !== b[i]) return a[i] - b[i];
    }
    return 0;
};

// ─── Release notes extraction ─────────────────────────────────────────────────

/**
 * Extract the release-notes sections that fall between `lastSeenVersion`
 * (exclusive) and `currentVersion` (inclusive) from the bundled RELEASE_NOTES.md
 * text.  Returns `null` when no matching sections are found.
 * Pure — no I/O.
 */
export const extractReleaseNotesRangeFromFile = (
    rawNotes: string,
    currentVersion: string,
    lastSeenVersion: string | null
): string | null => {
    const current = parseVersion(currentVersion);
    if (!current) return null;
    const lastSeen = parseVersion(lastSeenVersion);
    const body = rawNotes.replace(/^# Release Notes\s*/i, '').trim();
    if (!body) return null;
    const sections = body.split(/\n(?=Version v)/).map((s) => s.trim()).filter(Boolean);
    const selected = sections.filter((section) => {
        const match = section.match(/^Version v?([0-9]+\.[0-9]+\.[0-9]+)\b/);
        if (!match) return false;
        const version = parseVersion(match[1]);
        if (!version) return false;
        if (compareVersion(version, current) > 0) return false;
        if (lastSeen && compareVersion(version, lastSeen) <= 0) return false;
        return true;
    });
    if (selected.length === 0) return null;
    const sorted = selected.sort((a, b) => {
        const aMatch = a.match(/^Version v?([0-9]+\.[0-9]+\.[0-9]+)\b/);
        const bMatch = b.match(/^Version v?([0-9]+\.[0-9]+\.[0-9]+)\b/);
        const aVer = parseVersion(aMatch?.[1] || '');
        const bVer = parseVersion(bMatch?.[1] || '');
        if (!aVer || !bVer) return 0;
        return compareVersion(bVer, aVer);
    });
    return `# Release Notes\n\n${sorted.join('\n\n')}`.trim();
};
