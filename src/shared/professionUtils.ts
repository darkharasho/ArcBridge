export const PROFESSION_COLORS: Record<string, string> = {
    'Guardian': '#72C1D9',
    'Dragonhunter': '#72C1D9',
    'Firebrand': '#72C1D9',
    'Willbender': '#72C1D9',

    'Revenant': '#D16E5A',
    'Herald': '#D16E5A',
    'Renegade': '#D16E5A',
    'Vindicator': '#D16E5A',

    'Warrior': '#FFD166',
    'Berserker': '#FFD166',
    'Spellbreaker': '#FFD166',
    'Bladesworn': '#FFD166',

    'Engineer': '#D09C59',
    'Scrapper': '#D09C59',
    'Holosmith': '#D09C59',
    'Mechanist': '#D09C59',

    'Ranger': '#8CDC82',
    'Druid': '#8CDC82',
    'Soulbeast': '#8CDC82',
    'Untamed': '#8CDC82',

    'Thief': '#C08F95',
    'Daredevil': '#C08F95',
    'Deadeye': '#C08F95',
    'Specter': '#C08F95',

    'Elementalist': '#F68A87',
    'Tempest': '#F68A87',
    'Weaver': '#F68A87',
    'Catalyst': '#F68A87',

    'Mesmer': '#B679D5',
    'Chronomancer': '#B679D5',
    'Mirage': '#B679D5',
    'Virtuoso': '#B679D5',

    'Necromancer': '#52A76F',
    'Reaper': '#52A76F',
    'Scourge': '#52A76F',
    'Harbinger': '#52A76F',
    'Ritualist': '#52A76F',

    'Luminary': '#72C1D9',
    'Conduit': '#D16E5A',
    'Paragon': '#FFD166',
    'Amalgam': '#D09C59',
    'Galeshot': '#8CDC82',
    'Antiquary': '#C08F95',
    'Evoker': '#F68A87',
    'Troubadour': '#B679D5',

    'Unknown': '#64748B'
};

export function getProfessionColor(profession: string): string {
    return PROFESSION_COLORS[profession] || PROFESSION_COLORS['Unknown'];
}
