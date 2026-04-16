export interface SquadMemberMovement {
    name: string;
    account: string;
    profession: string;
    eliteSpec: string | number;
    group: number;
    isCommander: boolean;
    isLocal: boolean;
    isEnemy: boolean;
    inSquad: boolean;
    positions: [number, number][];
    downRanges: [number, number][];
    deadRanges: [number, number][];
    boonStates?: Record<number, [number, number][]>;
    healthPercents?: [number, number][];
    skillCasts?: { id: number; time: number; duration: number }[];
}

export interface MovementData {
    pollingRate: number;
    durationMs: number;
    inchToPixel: number;
    members: SquadMemberMovement[];
    boonIcons: Record<number, { name: string; icon: string }>;
    skillIcons: Record<number, { name: string; icon: string }>;
}

export interface BuildMovementDataOptions {
    trackedBuffIds: Set<number>;
    localAccount?: string;
    localName?: string;
}

export function buildMovementData(details: any, options: BuildMovementDataOptions): MovementData | null {
    const { trackedBuffIds, localAccount, localName } = options;
    const pollingRate = details?.combatReplayMetaData?.pollingRate ?? 300;
    const durationMs = details?.durationMS ?? 0;
    const inchToPixel = details?.combatReplayMetaData?.inchToPixel ?? 1;

    const skillIcons: Record<number, { name: string; icon: string }> = {};
    for (const [key, val] of Object.entries(details?.skillMap ?? {})) {
        const id = Number(String(key).replace(/^s/, ''));
        const info = val as any;
        if (info?.icon && !info.autoAttack) {
            skillIcons[id] = { name: info.name, icon: info.icon };
        }
    }

    const members: SquadMemberMovement[] = [];
    const allyNames = new Set<string>();

    const players = Array.isArray(details?.players) ? details.players : [];
    for (const p of players) {
        if (p?.isFake) continue;
        const positions = p?.combatReplayData?.positions;
        if (!positions?.length) continue;
        allyNames.add(p.name);

        let boonStates: Record<number, [number, number][]> | undefined;
        if (Array.isArray(p.buffUptimes)) {
            boonStates = {};
            for (const buff of p.buffUptimes) {
                if (!trackedBuffIds.has(buff.id) || !buff.states?.length) continue;
                boonStates[buff.id] = buff.states;
            }
        }

        let skillCasts: { id: number; time: number; duration: number }[] | undefined;
        if (Array.isArray(p.rotation) && p.rotation.length) {
            skillCasts = [];
            for (const entry of p.rotation) {
                if (!skillIcons[entry.id]) continue;
                const casts = Array.isArray(entry.skills) ? entry.skills : [];
                for (const cast of casts) {
                    // Trait procs are instant (duration 0). Keep user-pressed casts and negative IDs (dodge, weapon swap).
                    if (entry.id > 0 && cast.duration <= 0) continue;
                    skillCasts.push({ id: entry.id, time: cast.castTime, duration: cast.duration });
                }
            }
            skillCasts.sort((a, b) => a.time - b.time);
        }

        const isLocal = (!!localAccount && p.account === localAccount)
            || (!!localName && p.name === localName);

        members.push({
            name: p.name,
            account: p.account ?? '',
            profession: p.profession ?? '',
            eliteSpec: p.elite_spec ?? '',
            group: p.group ?? 0,
            isCommander: !!p.hasCommanderTag,
            isLocal,
            isEnemy: false,
            inSquad: !p.notInSquad,
            positions,
            downRanges: p.combatReplayData?.down ?? [],
            deadRanges: p.combatReplayData?.dead ?? [],
            boonStates,
            healthPercents: p.healthPercents,
            skillCasts,
        });
    }

    const targets = Array.isArray(details?.targets) ? details.targets : [];
    for (const t of targets) {
        if (!t?.enemyPlayer || t?.isFake) continue;
        const positions = t?.combatReplayData?.positions;
        if (!positions?.length) continue;
        if (allyNames.has(t.name)) continue;

        const specMatch = typeof t.name === 'string' ? t.name.match(/^(.+?) pl-\d+$/) : null;
        const specName = specMatch?.[1] ?? '';
        members.push({
            name: t.name,
            account: '',
            profession: t.profession ?? specName,
            eliteSpec: specName,
            group: 0,
            isCommander: false,
            isLocal: false,
            isEnemy: true,
            inSquad: false,
            positions,
            downRanges: t.combatReplayData?.down ?? [],
            deadRanges: t.combatReplayData?.dead ?? [],
        });
    }

    if (!members.length) return null;

    const boonIcons: Record<number, { name: string; icon: string }> = {};
    for (const [key, val] of Object.entries(details?.buffMap ?? {})) {
        const id = Number(String(key).replace(/^b/, ''));
        const info = val as any;
        if (trackedBuffIds.has(id) && info?.icon) {
            boonIcons[id] = { name: info.name, icon: info.icon };
        }
    }

    return { pollingRate, durationMs, inchToPixel, members, boonIcons, skillIcons };
}
