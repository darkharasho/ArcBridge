/**
 * Strips common WvW prefix noise from a map/fight label.
 * e.g. "Detailed WvW - Eternal Battlegrounds" → "Eternal Battlegrounds"
 */
export const sanitizeWvwLabel = (value: any): string =>
    String(value || '')
        .replace(/^Detailed\s*WvW\s*-\s*/i, '')
        .replace(/^World\s*vs\s*World\s*-\s*/i, '')
        .replace(/^WvW\s*-\s*/i, '')
        .trim();

/**
 * Normalizes a map label for display: strips WvW prefixes and
 * normalizes borderlands names to "X Borderlands".
 */
export const normalizeMapLabel = (value: any): string => {
    if (!value) return 'Unknown';
    const cleaned = sanitizeWvwLabel(value);
    const borderlandsMatch = cleaned.match(/^(Red|Blue|Green)\s+(?:Alpine|Desert)?\s*Borderlands$/i);
    if (borderlandsMatch) {
        return `${borderlandsMatch[1]} Borderlands`;
    }
    return cleaned || 'Unknown';
};

/**
 * Splits a label into lowercase word tokens, removing short plurals.
 * Used to detect when fight name and map name are redundant.
 */
export const tokenizeLabel = (value: string): string[] =>
    sanitizeWvwLabel(value)
        .toLowerCase()
        .split(/[^a-z0-9]+/i)
        .map((token) => token.trim())
        .filter(Boolean)
        .map((token) => (token.length > 3 && token.endsWith('s') ? token.slice(0, -1) : token));

/**
 * Builds a combined fight label from a fight name and map name,
 * deduplicating when the two names are semantically redundant.
 * e.g. ("Eternal Battlegrounds", "Eternal Battlegrounds") → "Eternal Battlegrounds"
 * e.g. ("Skirmish", "Eternal Battlegrounds") → "Skirmish - Eternal Battlegrounds"
 */
export const buildFightLabel = (fightNameRaw: string, mapNameRaw: string): string => {
    const fightName = sanitizeWvwLabel(fightNameRaw);
    const mapName = sanitizeWvwLabel(mapNameRaw);
    if (!mapName) return fightName;
    if (!fightName) return mapName;
    const fightTokens = tokenizeLabel(fightName);
    const mapTokens = tokenizeLabel(mapName);
    const fightSet = new Set(fightTokens);
    const mapSet = new Set(mapTokens);
    const mapCovered = mapTokens.length > 0 && mapTokens.every((token) => fightSet.has(token));
    const fightCovered = fightTokens.length > 0 && fightTokens.every((token) => mapSet.has(token));
    if (mapCovered || fightCovered) return fightName;
    return `${fightName} - ${mapName}`;
};

/**
 * Resolves the map name from EI details, falling back through common fields.
 */
export const resolveMapName = (details: any, log: any): string =>
    normalizeMapLabel(
        details?.zone
        || details?.mapName
        || details?.map
        || details?.location
        || details?.fightName
        || log?.fightName
        || log?.encounterName
        || 'Unknown'
    );
