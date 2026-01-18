import { Player } from './dpsReportTypes';

export interface CCMapEntry {
    category: string[];
    skills: { id: number; coefficient: number }[];
}

export const CC_MAPPING: CCMapEntry[] = [
    {
        category: ["Relics"],
        skills: [
            { id: 70491, coefficient: 1 }, // Relic of the wizard's tower
        ]
    },
    {
        category: ["Tempest", "Weaver", "Catalyst", "Elementalist"],
        skills: [
            { id: 51662, coefficient: 1.6 }, // Transmute Lightning & Shocking Aura (4/2.5)
            { id: 5671, coefficient: 1 },
            { id: 5732, coefficient: 1 },
            { id: 40794, coefficient: 1 },
            { id: 62716, coefficient: 1 },
            { id: 5687, coefficient: 1 },
            { id: 5534, coefficient: 1 },
            { id: 35304, coefficient: 1 },
            { id: 5733, coefficient: 1 },
            { id: 5690, coefficient: 1 },
            { id: 5562, coefficient: 1 },
            { id: 46018, coefficient: 1 },
            { id: 62947, coefficient: 1 },
            { id: 30864, coefficient: 1 },
            { id: 5553, coefficient: 1 },
            { id: 5754, coefficient: 1 },
            { id: 30008, coefficient: 1 },
            { id: 5747, coefficient: 1 },
            { id: 5490, coefficient: 1 },
            { id: 5547, coefficient: 1 },
            { id: 44998, coefficient: 1 },
            { id: 42321, coefficient: 1 },
            { id: 5721, coefficient: 1 },
            { id: 71966, coefficient: 1 },
            { id: 46140, coefficient: 1 },
        ]
    },
    {
        category: ["Specter", "Daredevil", "Deadeye", "Thief"],
        skills: [
            { id: 13012, coefficient: 1 },
            { id: 63230, coefficient: 1 },
            { id: 30568, coefficient: 1 },
            { id: 29516, coefficient: 1 },
            { id: 1131, coefficient: 1 },
            { id: 63275, coefficient: 1 },
            { id: 63220, coefficient: 1 },
            { id: 1141, coefficient: 1 },
            { id: 63249, coefficient: 1 },
            { id: 13031, coefficient: 1 },
            { id: 13024, coefficient: 0.25 },
            { id: 56880, coefficient: 1 },
            { id: 30077, coefficient: 1 },
            { id: 46335, coefficient: 2 },
            { id: 13114, coefficient: 1 },
            { id: 50484, coefficient: 1 },
        ]
    },
    {
        category: ["Spellbreaker", "Berserker", "Bladesworn", "Warrior"],
        skills: [
            { id: 14359, coefficient: 1 },
            { id: 14360, coefficient: 1 },
            { id: 14502, coefficient: 1 },
            { id: 14511, coefficient: 1 },
            { id: 14415, coefficient: 1 },
            { id: 14516, coefficient: 1 },
            { id: 29941, coefficient: 1 },
            { id: 14387, coefficient: 1 },
            { id: 14512, coefficient: 1 },
            { id: 14513, coefficient: 1 },
            { id: 14514, coefficient: 1 },
            { id: 40601, coefficient: 1 },
            { id: 14361, coefficient: 1 },
            { id: 14414, coefficient: 1 },
            { id: 14425, coefficient: 1 },
            { id: 14426, coefficient: 1 },
            { id: 14427, coefficient: 1 },
            { id: 30343, coefficient: 1 },
            { id: 44165, coefficient: 1 },
            { id: 41243, coefficient: 1 },
            { id: 44937, coefficient: 1 },
            { id: 14503, coefficient: 1 },
            { id: 14405, coefficient: 1 },
            { id: 62732, coefficient: 1 },
            { id: 14388, coefficient: 1 },
            { id: 14409, coefficient: 1 },
            { id: 41919, coefficient: 1 },
            { id: 72026, coefficient: 1 },
            { id: 29679, coefficient: 1 },
        ]
    },
    {
        category: ["Scrapper", "Holosmith", "Mechanist", "Engineer"],
        skills: [
            { id: 6054, coefficient: 1 },
            { id: 21661, coefficient: 1 },
            { id: 6161, coefficient: 1 },
            { id: 30337, coefficient: 1 },
            { id: 6162, coefficient: 1 },
            { id: 31248, coefficient: 1 },
            { id: 5868, coefficient: 1 },
            { id: 63234, coefficient: 1 },
            { id: 71888, coefficient: 1 },
            { id: 30713, coefficient: 0.166666 },
            { id: 5930, coefficient: 1 },
            { id: 6126, coefficient: 1 },
            { id: 5754, coefficient: 1 },
            { id: 6154, coefficient: 1 },
            { id: 5813, coefficient: 1 },
            { id: 5811, coefficient: 1 },
            { id: 29991, coefficient: 1 },
            { id: 5889, coefficient: 1 },
            { id: 5534, coefficient: 1 },
            { id: 35304, coefficient: 1 },
            { id: 42521, coefficient: 1 },
            { id: 63345, coefficient: 1 },
            { id: 31167, coefficient: 0.25 },
            { id: 6057, coefficient: 1 },
            { id: 63121, coefficient: 1 },
            { id: 5996, coefficient: 1 },
            { id: 41843, coefficient: 1 },
            { id: 5982, coefficient: 1 },
            { id: 5825, coefficient: 1 },
            { id: 30828, coefficient: 1 },
            { id: 5913, coefficient: 1 },
            { id: 5893, coefficient: 1 },
            { id: 63253, coefficient: 1 },
        ]
    },
    {
        category: ["Firebrand", "Dragonhunter", "Willbender", "Guardian"],
        skills: [
            { id: 40624, coefficient: 0.2 },
            { id: 30628, coefficient: 0.25 },
            { id: 45402, coefficient: 1 },
            { id: 42449, coefficient: 1 },
            { id: 9226, coefficient: 1 },
            { id: 33134, coefficient: 1 },
            { id: 41968, coefficient: 1 },
            { id: 9124, coefficient: 1 },
            { id: 29630, coefficient: 1 },
            { id: 9091, coefficient: 1 },
            { id: 13688, coefficient: 1 },
            { id: 9128, coefficient: 1 },
            { id: 9093, coefficient: 1 },
            { id: 9125, coefficient: 1 },
            { id: 46170, coefficient: 1 },
            { id: 30871, coefficient: 0.1111 },
            { id: 30273, coefficient: 1 },
            { id: 62549, coefficient: 1 },
            { id: 62561, coefficient: 1 },
            { id: 71817, coefficient: 1 },
            { id: 71819, coefficient: 1 },
        ]
    },
    {
        category: ["Renegade", "Vindicator", "Herald", "Revenant"],
        skills: [
            { id: 41820, coefficient: 1 },
            { id: 28110, coefficient: 1 },
            { id: 27356, coefficient: 1 },
            { id: 29114, coefficient: 1 },
            { id: 28978, coefficient: 1 },
            { id: 26679, coefficient: 1 },
            { id: 27917, coefficient: 1 },
            { id: 62878, coefficient: 1 },
            { id: 41220, coefficient: 1 },
            { id: 28406, coefficient: 1 },
            { id: 31294, coefficient: 1 },
            { id: 28075, coefficient: 1 },
            { id: 71880, coefficient: 1 },
        ]
    },
    {
        category: ["Druid", "Untamed", "Soulbeast", "Ranger"],
        skills: [
            { id: 31318, coefficient: 1 },
            { id: 63075, coefficient: 1 },
            { id: 12598, coefficient: 1 },
            { id: 31658, coefficient: 1 },
            { id: 45743, coefficient: 1 },
            { id: 67179, coefficient: 1 },
            { id: 12476, coefficient: 1 },
            { id: 63330, coefficient: 1 },
            { id: 42894, coefficient: 1 },
            { id: 46432, coefficient: 1 },
            { id: 42907, coefficient: 1 },
            { id: 12523, coefficient: 1 },
            { id: 31321, coefficient: 1 },
            { id: 41908, coefficient: 1 },
            { id: 12511, coefficient: 1 },
            { id: 30448, coefficient: 1 },
            { id: 12475, coefficient: 2 },
            { id: 12508, coefficient: 1 },
            { id: 12638, coefficient: 1 },
            { id: 29558, coefficient: 1 },
            { id: 12621, coefficient: 1 },
            { id: 71963, coefficient: 1 },
            { id: 71002, coefficient: 1 },
            { id: 44360, coefficient: 1 },
            { id: 43375, coefficient: 1 },
            { id: 71841, coefficient: 1 },
        ]
    },
    {
        category: ["Chronomancer", "Mirage", "Virtuoso", "Mesmer"],
        skills: [
            { id: 10363, coefficient: 1 },
            { id: 56873, coefficient: 1 },
            { id: 30643, coefficient: 1 },
            { id: 10232, coefficient: 1 },
            { id: 72007, coefficient: 1 },
            { id: 30359, coefficient: 1 },
            { id: 10220, coefficient: 1 },
            { id: 62573, coefficient: 1 },
            { id: 10287, coefficient: 1 },
            { id: 45230, coefficient: 1 },
            { id: 62602, coefficient: 1 },
            { id: 10358, coefficient: 1 },
            { id: 10166, coefficient: 1 },
            { id: 10169, coefficient: 0.16666 },
            { id: 13733, coefficient: 0.16666 },
            { id: 10229, coefficient: 0.5 },
            { id: 10341, coefficient: 1 },
            { id: 30192, coefficient: 1 },
            { id: 29856, coefficient: 0.25 },
        ]
    },
    {
        category: ["Reaper", "Scourge", "Harbinger", "Necromancer"],
        skills: [
            { id: 10633, coefficient: 1 },
            { id: 29709, coefficient: 1 },
            { id: 19115, coefficient: 1 },
            { id: 10556, coefficient: 1 },
            { id: 10608, coefficient: 1 },
            { id: 44428, coefficient: 1 },
            { id: 30557, coefficient: 1 },
            { id: 10620, coefficient: 1 },
            { id: 10647, coefficient: 1 },
            { id: 30105, coefficient: 1 },
            { id: 44296, coefficient: 1 },
            { id: 62511, coefficient: 1 },
            { id: 62539, coefficient: 1 },
            { id: 62563, coefficient: 1 },
            { id: 71998, coefficient: 1 },
        ]
    }
];

// Mapping for Incoming Strips
export const INCOMING_STRIPS_SKILLS: { [id: number]: number } = {
    // 3x multiplier
    10672: 3, 30670: 3, 72068: 3, 73047: 3, 73107: 3, 13906: 3, 45252: 3,
    // 2x multiplier (Strips)
    10701: 2, 29560: 2, 10529: 2, 73007: 2,
    44004: 2, 63129: 2, 69223: 2, 72079: 2, 63336: 2,
    63225: 2, 63326: 2, 72932: 2, 13007: 2, 72904: 2,
    29666: 2, 51667: 2, 69290: 2, 10602: 2, 62514: 2,
    72843: 2, 54870: 2,
    // 4x multiplier
    63350: 4,
    // Special: hits / 5 * 2 = 0.4
    63438: 0.4,
    // Special: hits / 3 = 0.33
    69175: 0.3333,
    // Special: hits / 2 = 0.5
    10221: 0.5,
    // 1x multiplier (default for others in the case block)
    29855: 1,
    10172: 1, 43123: 1, 10203: 1, 10267: 1, 10612: 1, 45333: 1, 51647: 1, 10709: 1, 71871: 1, 71799: 1, 43148: 1, 10545: 1, 10671: 1, 42935: 1, 42917: 1, 41615: 1, 40274: 1, 42355: 1, 100074: 1
};

// Mapping for Incoming CC
export const INCOMING_CC_SKILLS: number[] = [
    10633, 29709, 19115, 10556, 10608, 44428, 40071, 71998,
    30557, 10620, 10647, 30105, 44296, 62511, 62539, 62563, 73013
];


export function calculateOutCC(player: Player): number {
    if (!player.totalDamageDist || player.totalDamageDist.length === 0) return 0;

    let total = 0;

    // Flatten the array of arrays (usually one phase for total stats)
    for (const damageDistList of player.totalDamageDist) {
        if (!damageDistList) continue;
        for (const skill of damageDistList) {
            // Find a mapping that matches the player's profession (or Relics) AND contains the skill ID
            const mapEntry = CC_MAPPING.find(m =>
                (m.category.includes(player.profession) || m.category.includes("Relics")) &&
                m.skills.some(s => s.id === skill.id)
            );

            if (mapEntry) {
                const mappedSkill = mapEntry.skills.find(s => s.id === skill.id);
                if (mappedSkill) {
                    total += skill.connectedHits * mappedSkill.coefficient;
                }
            }
        }
    }
    return Math.round(total);
}

// Global pass function
export function calculateAllStability(players: Player[]) {
    const generationValid: { [name: string]: number } = {};

    players.forEach(p => {
        if (!p.buffUptimes) return;
        const stabBoons = p.buffUptimes.filter(b => b.id === 1122);
        for (const boon of stabBoons) {
            for (const [sourceName, states] of Object.entries(boon.statesPerSource)) {
                let lastState = 0;
                let gen = 0;
                for (const state of states) {
                    if (state[1] > lastState) {
                        gen += (state[1] - lastState);
                    }
                    lastState = state[1];
                }
                if (!generationValid[sourceName]) generationValid[sourceName] = 0;
                generationValid[sourceName] += gen;
            }
        }
    });

    // Assign to players
    players.forEach(p => {
        // dps.report 'name' in Player is the character name usually keying the source.
        // We check p.name primarily.
        const key = p.name || p.character_name;
        if (generationValid[key]) {
            p.stabGeneration = generationValid[key];
        }
    });
}


export function calculateIncomingStats(player: Player): { strips: { total: number, missed: number, blocked: number }, cc: { total: number, missed: number, blocked: number } } {
    const strips = { total: 0, missed: 0, blocked: 0 };
    const cc = { total: 0, missed: 0, blocked: 0 };

    if (!player.totalDamageTaken || player.totalDamageTaken.length === 0) return { strips, cc };

    for (const damageTakenList of player.totalDamageTaken) {
        if (!damageTakenList) continue;
        for (const hit of damageTakenList) {
            // Strips
            const stripMult = INCOMING_STRIPS_SKILLS[hit.id];
            if (stripMult) {
                strips.total += hit.hits * stripMult;
                strips.missed += hit.missed * stripMult;
                strips.blocked += hit.blocked * stripMult;
            }

            // CC
            if (INCOMING_CC_SKILLS.includes(hit.id)) {
                cc.total += hit.hits;
                cc.missed += hit.missed; // PlenBot: missed
                cc.blocked += hit.blocked;
            }
        }
    }
    return { strips, cc };
}

export function calculateDownContribution(player: Player): number {
    if (!player.statsTargets) return 0;
    let total = 0;
    // PlenBot: x.StatsTargets.Sum(y => y[0].DownContribution)
    // Means iterating over target arrays.
    for (const targetStats of player.statsTargets) {
        if (targetStats && targetStats.length > 0) {
            total += targetStats[0].downContribution || 0;
        }
    }
    return total;
}

export function calculateSquadBarrier(player: Player): number {
    if (!player.extBarrierStats || !player.extBarrierStats.outgoingBarrierAllies) return 0;

    let total = 0;
    // outgoingBarrierAllies is OutgoingBarrier[SquadMembers][Phases]
    for (const squadMember of player.extBarrierStats.outgoingBarrierAllies) {
        if (!squadMember) continue;
        for (const phaseData of squadMember) {
            // phaseData is an object { barrier: number }
            if (phaseData) {
                total += phaseData.barrier || 0;
            }
        }
    }
    return total;
}

export function calculateSquadHealing(player: Player): number {
    if (!player.extHealingStats || !player.extHealingStats.outgoingHealingAllies) return 0;

    let total = 0;
    // outgoingHealingAllies is OutgoingHealing[SquadMembers][Phases]
    for (const squadMember of player.extHealingStats.outgoingHealingAllies) {
        if (!squadMember) continue;
        for (const phaseData of squadMember) {
            // phaseData is an object { healing: number }
            if (phaseData) {
                total += phaseData.healing || 0;
            }
        }
    }
    return total;
}
