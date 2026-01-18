export interface DPSReportJSON {
    evtc: {
        type: string;
        version: string;
        bossId: number;
    };
    encounterDuration: string;
    recordedBy: string;
    uploadTime: number;
    players: Player[];
}

export interface Player {
    display_name: string;
    character_name: string;
    profession: number;
    elite_spec: number;
    group: number;
    statsAll: StatsAll[];
    defenses: Defenses[];
    support: Support[];
}

export interface StatsAll {
    dps: number;
    dmg: number;
    downed: number;
    downContribution: number;
}

export interface Defenses {
    downCount: number;
    deadCount: number;
    missed: number; // Missed attacks
    blocked: number; // Blocked attacks
    dodgeCount: number; // Dodged attacks
}

export interface Support {
    condiCleanse: number;
    condiCleanseSelf: number;
    boonStrips: number;
    resurrects: number;
}
