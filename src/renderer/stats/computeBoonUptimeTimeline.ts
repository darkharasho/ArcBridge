import { resolveFightTimestamp } from './utils/timestampUtils';
import { sanitizeWvwLabel, buildFightLabel, resolveMapName } from './utils/labelUtils';

export function computeBoonUptimeTimeline(validLogs: any[]) {
type UptimePlayer = {
    key: string;
    account: string;
    displayName: string;
    profession: string;
    professionList: string[];
    logs: number;
    total: number;
    peak: number;
};
type UptimeFightValue = {
    total: number;
    peak: number;
    buckets5s: number[];
};
type UptimeFight = {
    id: string;
    shortLabel: string;
    fullLabel: string;
    timestamp: number;
    durationMs: number;
    values: Record<string, UptimeFightValue>;
    maxTotal: number;
};
type UptimeBucket = {
    id: string;
    name: string;
    icon?: string;
    stacking: boolean;
    players: Map<string, UptimePlayer>;
    fights: UptimeFight[];
};
const boonBuckets = new Map<string, UptimeBucket>();
const ensureBoonBucket = (boonId: string, meta?: any) => {
    if (!boonBuckets.has(boonId)) {
        boonBuckets.set(boonId, {
            id: boonId,
            name: String(meta?.name || boonId),
            icon: meta?.icon,
            stacking: Boolean(meta?.stacking),
            players: new Map<string, UptimePlayer>(),
            fights: []
        });
    } else if (meta) {
        const existing = boonBuckets.get(boonId)!;
        if ((!existing.name || existing.name === boonId) && meta?.name) existing.name = String(meta.name);
        if (!existing.icon && meta?.icon) existing.icon = String(meta.icon);
        if (!existing.stacking && Boolean(meta?.stacking)) existing.stacking = true;
    }
    return boonBuckets.get(boonId)!;
};
const normalizeStatePairs = (states: any): Array<[number, number]> => {
    if (!Array.isArray(states)) return [];
    return states
        .map((entry: any) => {
            if (Array.isArray(entry)) return [Number(entry[0]), Number(entry[1])] as [number, number];
            if (entry && typeof entry === 'object') return [Number(entry.time), Number(entry.value)] as [number, number];
            return null;
        })
        .filter((entry: any): entry is [number, number] =>
            !!entry
            && Number.isFinite(entry[0])
            && Number.isFinite(entry[1])
            && entry[0] >= 0
        )
        .sort((a, b) => a[0] - b[0]);
};
const resolveBoonStackCap = (boonName: string, stacking: boolean) => {
    if (!stacking) return 1;
    const normalized = String(boonName || '').trim().toLowerCase();
    if (normalized === 'might' || normalized === 'stability') return 25;
    return 25;
};
const normalizeBucketStackValue = (rawValue: number, stacking: boolean, stackCap: number) => {
    const safe = Number.isFinite(rawValue) ? Math.max(0, rawValue) : 0;
    if (!stacking) return safe > 0 ? 1 : 0;
    return Math.max(0, Math.min(stackCap, Math.round(safe)));
};
const sampleStackTimeline = (
    statesPerSource: Record<string, any>,
    bucketCount: number,
    stacking: boolean,
    boonName: string
) => {
    const buckets = Array.from({ length: bucketCount }, () => 0);
    if (!statesPerSource || typeof statesPerSource !== 'object' || bucketCount <= 0) return buckets;
    Object.values(statesPerSource).forEach((states: any) => {
        const normalized = normalizeStatePairs(states);
        if (normalized.length === 0) return;
        let stateIndex = 0;
        let currentValue = 0;
        for (let bucketIndex = 0; bucketIndex < bucketCount; bucketIndex += 1) {
            const sampleTime = bucketIndex * 5000;
            while (stateIndex < normalized.length && normalized[stateIndex][0] <= sampleTime) {
                currentValue = Math.max(0, Number(normalized[stateIndex][1] || 0));
                stateIndex += 1;
            }
            buckets[bucketIndex] += Math.max(0, Number(currentValue || 0));
        }
    });
    const stackCap = resolveBoonStackCap(boonName, stacking);
    return buckets.map((value) => normalizeBucketStackValue(value, stacking, stackCap));
};
const createFightValue = (buckets5s: number[]): UptimeFightValue => {
    const total = buckets5s.reduce((sum, value) => sum + Math.max(0, Number(value || 0)), 0);
    const peak = buckets5s.reduce((best, value) => Math.max(best, Math.max(0, Number(value || 0))), 0);
    return { total, peak, buckets5s };
};

validLogs
    .map((log) => ({ log, ts: resolveFightTimestamp(log?.details, log) }))
    .sort((a, b) => a.ts - b.ts)
    .forEach(({ log }, index) => {
        const details = log?.details;
        if (!details) return;
        const players = Array.isArray(details.players) ? details.players : [];
        const squadPlayers = players.filter((p: any) => !p?.notInSquad);
        if (squadPlayers.length <= 0) return;
        const durationMs = Math.max(0, Number(details?.durationMS || 0));
        const bucketCount = Math.max(1, Math.ceil(Math.max(1, durationMs) / 5000));
        const buffMap = (details?.buffMap && typeof details.buffMap === 'object')
            ? details.buffMap
            : {};
        const fightName = sanitizeWvwLabel(details.fightName || log.fightName || `Fight ${index + 1}`);
        const mapName = resolveMapName(details, log);
        const fullLabel = buildFightLabel(fightName, String(mapName || ''));
        const fightValuesByBoon = new Map<string, Map<string, UptimeFightValue>>();
        const fightPlayerSeenByBoon = new Map<string, Set<string>>();

        squadPlayers.forEach((player: any) => {
            const account = String(player?.account || player?.name || 'Unknown');
            const key = account;
            const profession = String(player?.profession || 'Unknown');
            const buffUptimes = Array.isArray(player?.buffUptimes) ? player.buffUptimes : [];
            buffUptimes.forEach((buff: any) => {
                const boonIdNum = Number(buff?.id);
                if (!Number.isFinite(boonIdNum)) return;
                const boonId = `b${boonIdNum}`;
                const meta = buffMap[boonId] || {};
                const classification = String(meta?.classification || '');
                if (classification && classification !== 'Boon') return;
                const statesPerSource = (buff?.statesPerSource && typeof buff.statesPerSource === 'object')
                    ? buff.statesPerSource
                    : null;
                if (!statesPerSource) return;
                const buckets5s = sampleStackTimeline(
                    statesPerSource as Record<string, any>,
                    bucketCount,
                    Boolean(meta?.stacking),
                    String(meta?.name || '')
                );
                const fightValue = createFightValue(buckets5s);
                if (fightValue.total <= 0 && fightValue.peak <= 0) return;

                const boonBucket = ensureBoonBucket(boonId, meta);
                const playerEntry = boonBucket.players.get(key) || {
                    key,
                    account,
                    displayName: account,
                    profession,
                    professionList: profession && profession !== 'Unknown' ? [profession] : [],
                    logs: 0,
                    total: 0,
                    peak: 0
                };
                if (profession && profession !== 'Unknown' && !playerEntry.professionList.includes(profession)) {
                    playerEntry.professionList.push(profession);
                }
                if ((!playerEntry.profession || playerEntry.profession === 'Unknown') && profession && profession !== 'Unknown') {
                    playerEntry.profession = profession;
                }
                const seen = fightPlayerSeenByBoon.get(boonId) || new Set<string>();
                if (!seen.has(key)) {
                    seen.add(key);
                    playerEntry.logs += 1;
                    fightPlayerSeenByBoon.set(boonId, seen);
                }
                playerEntry.total += fightValue.total;
                playerEntry.peak = Math.max(playerEntry.peak, fightValue.peak);
                boonBucket.players.set(key, playerEntry);
                const fightValues = fightValuesByBoon.get(boonId) || new Map<string, UptimeFightValue>();
                fightValues.set(key, fightValue);
                fightValuesByBoon.set(boonId, fightValues);
            });
        });

        fightValuesByBoon.forEach((playerValues, boonId) => {
            const boonBucket = boonBuckets.get(boonId);
            if (!boonBucket) return;
            const values: Record<string, UptimeFightValue> = {};
            let maxTotal = 0;
            playerValues.forEach((fightValue, playerKey) => {
                values[playerKey] = {
                    total: Number(fightValue.total || 0),
                    peak: Number(fightValue.peak || 0),
                    buckets5s: Array.isArray(fightValue.buckets5s)
                        ? fightValue.buckets5s.map((entry: any) => Number(entry || 0))
                        : []
                };
                maxTotal = Math.max(maxTotal, Number(fightValue.peak || 0));
            });
            if (Object.keys(values).length === 0) return;
            boonBucket.fights.push({
                id: log.filePath || log.id || `fight-${index + 1}`,
                shortLabel: `F${index + 1}`,
                fullLabel,
                timestamp: resolveFightTimestamp(details, log),
                durationMs,
                values,
                maxTotal
            });
        });
    });

return Array.from(boonBuckets.values())
    .map((bucket) => ({
        id: bucket.id,
        name: bucket.name || bucket.id,
        icon: bucket.icon,
        stacking: bucket.stacking,
        players: Array.from(bucket.players.values()).sort((a, b) => {
            const peakDiff = Number(b.peak || 0) - Number(a.peak || 0);
            if (peakDiff !== 0) return peakDiff;
            const totalDiff = Number(b.total || 0) - Number(a.total || 0);
            if (totalDiff !== 0) return totalDiff;
            return String(a.displayName || '').localeCompare(String(b.displayName || ''));
        }),
        fights: [...bucket.fights].sort((a, b) => {
            if (a.timestamp > 0 && b.timestamp > 0 && a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
            return a.shortLabel.localeCompare(b.shortLabel, undefined, { numeric: true });
        })
    }))
    .filter((boon) => boon.players.length > 0 && boon.fights.length > 0)
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));

}
