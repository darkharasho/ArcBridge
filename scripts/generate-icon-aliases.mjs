#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';

const REPORT_PATH = 'web/report.json';
const OUTPUT_ALIAS_PATH = 'public/img/icon-aliases.json';
const OUTPUT_SKILL_NAME_PATH = 'public/img/skill-id-names.json';

const fetchJson = async (url) => {
    const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!resp.ok) {
        throw new Error(`Request failed: ${resp.status} ${resp.statusText} for ${url}`);
    }
    return resp.json();
};

const chunk = (arr, size) => {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
};

const normalizeKey = (name) => {
    if (!name) return '';
    return name
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');
};

const loadReport = () => {
    if (!existsSync(REPORT_PATH)) return null;
    return JSON.parse(readFileSync(REPORT_PATH, 'utf-8'));
};

const collectMissingSkillIds = (report) => {
    const skillIds = new Set();

    const walk = (obj) => {
        if (Array.isArray(obj)) {
            obj.forEach(walk);
            return;
        }
        if (!obj || typeof obj !== 'object') return;
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'string') {
                const match = value.match(/^Skill\s+(\d+)$/i);
                if (match) skillIds.add(Number(match[1]));
            }
            walk(value);
        }
    };

    walk(report);
    return [...skillIds];
};

const fetchSkillNames = async (ids) => {
    if (ids.length === 0) return {};
    const out = {};
    for (const id of ids) {
        const url = `https://api.guildwars2.com/v2/skills?ids=${id}`;
        try {
            const data = await fetchJson(url);
            for (const skill of data) {
                if (!skill || !skill.id || !skill.name) continue;
                out[`Skill ${skill.id}`] = skill.name;
            }
        } catch {
            continue;
        }
    }
    return out;
};

const fetchTraits = async () => {
    return fetchJson('https://api.guildwars2.com/v2/traits?ids=all');
};

const buildTraitAliases = (traits) => {
    const aliases = {};
    for (const trait of traits) {
        if (!trait || !trait.name || !Array.isArray(trait.skills)) continue;
        for (const skill of trait.skills) {
            const skillName = skill?.name || skill?.description || '';
            if (!skillName) continue;
            const key = normalizeKey(skillName);
            const target = normalizeKey(trait.name);
            if (!key || !target) continue;
            if (!aliases[key]) aliases[key] = trait.name;
        }
    }
    return aliases;
};

const arrowCartAliases = () => ({
    'Fire': 'Fire Arrow Cart',
    'Fire Improved Arrows': 'Fire Arrow Cart',
    'Fire Distant Volley': 'Fire Arrow Cart',
    'Fire Devastating Arrows': 'Fire Arrow Cart',
    'Fire Crippling Arrows': 'Fire Crippling Arrows',
    'Fire Improved Crippling Arrows': 'Fire Crippling Arrows',
    'Fire Reaping Arrows': 'Fire Crippling Arrows',
    'Fire Staggering Arrows': 'Fire Crippling Arrows',
    'Fire Suffering Arrows': 'Fire Crippling Arrows',
    'Fire Barbed Arrows': 'Fire Barbed Arrows',
    'Fire Improved Barbed Arrows': 'Fire Barbed Arrows',
    'Fire Penetrating Sniper Arrows': 'Fire Barbed Arrows',
    'Fire Exsanguinating Arrows': 'Fire Barbed Arrows',
    'Fire Merciless Arrows': 'Fire Barbed Arrows',
    'Toxic Unveiling Volley': 'Toxic Unveiling Volley'
});

const mortarAliases = () => ({
    'Fire Explosive Shells': 'Explosive Shell',
    'Fire Exploding Shells': 'Explosive Shell',
    'Explosive Shells': 'Explosive Shell',
    'Explosive Shell': 'Explosive Shell',
    'Fire Incendiary Shells': 'Fire Incendiary Shells',
    'Fire Incendiary Shell': 'Fire Incendiary Shells',
    'Poison Gas Shells': 'Poison Gas Shell',
    'Poison Gas Shell': 'Poison Gas Shell',
    'Endothermic Shells': 'Endothermic Shell',
    'Endothermic Shell': 'Endothermic Shell',
    'Elixir Shells': 'Elixir Shell',
    'Elixir Shell': 'Elixir Shell',
    'Flash Shells': 'Flash Shell',
    'Flash Shell': 'Flash Shell',
    'Mortar Shot': 'Mortar Shot',
    'Load Mortar Shell': 'Load Mortar Shell'
});

const siegeAliases = () => ({
    // Ballista
    'Fire Shattering Bolt': 'Fire Shattering Bolt',
    'Fire Reinforced Shot': 'Fire Reinforced Shot',
    'Improved Reinforced Shot': 'Fire Reinforced Shot',
    'Greater Reinforced Shot': 'Fire Reinforced Shot',
    'Improved Ballista Shot': 'Fire Ballista',
    'Swift Bolt': 'Fire Ballista',
    'Sniper Bolt': 'Fire Ballista',
    'Spread Shot': 'Fire Ballista',
    'Antiair Bolt': 'Fire Ballista',
    'Swift Antiair Bolt': 'Fire Ballista',

    // Catapult
    'Fire Boulder': 'Fire Boulder',
    'Fire Gravel': 'Fire Gravel',
    'Rending Gravel': 'Fire Gravel',
    'Fire Large Rending Gravel': 'Fire Gravel',
    'Fire Hollowed Gravel': 'Fire Gravel',
    'Load Gravel': 'Load Boulder',
    'Load Boulder': 'Load Boulder',
    'Siege Bubble': 'Siege Bubble',

    // Trebuchet
    'Fire Mega Explosive Shot': 'Fire Trebuchet',
    'Fire Colossal Explosive Shot': 'Fire Trebuchet',
    'Fire Corrosive Shot': 'Fire Trebuchet',

    // Flame Ram
    'Ram': 'Impact Slam',
    'Accelerated Ram': 'Impact Slam',
    'Flame Blast': 'Flame Blast',
    'Weakening Flame Blast': 'Flame Blast',
    'Intense Flame Blast': 'Flame Blast',
    'Impact Slam': 'Impact Slam',
    'Iron Will': 'Iron Will',

    // Shield Generator
    'Force Ball': 'Force Ball',
    'Force Wall': 'Force Wall',
    'Force Dome': 'Force Dome'
});

const run = async () => {
    const report = loadReport();
    if (!report) {
        console.error(`Missing ${REPORT_PATH}`);
        process.exit(1);
    }

    const missingSkillIds = collectMissingSkillIds(report);
    console.log(`Missing skill ids: ${missingSkillIds.length}`);
    const skillNameMap = await fetchSkillNames(missingSkillIds);
    console.log(`Resolved skill ids: ${Object.keys(skillNameMap).length}`);

    const traits = await fetchTraits();
    console.log(`Fetched traits: ${traits.length}`);
    const traitAliases = buildTraitAliases(traits);
    console.log(`Trait aliases: ${Object.keys(traitAliases).length}`);

    let existing = null;
    if (existsSync(OUTPUT_ALIAS_PATH)) {
        try {
            existing = JSON.parse(readFileSync(OUTPUT_ALIAS_PATH, 'utf-8'));
        } catch {
            existing = null;
        }
    }

    const iconAliases = { ...(existing?.iconAliases || {}) };
    for (const [key, value] of Object.entries(arrowCartAliases())) {
        iconAliases[normalizeKey(key)] = value;
    }
    for (const [key, value] of Object.entries(mortarAliases())) {
        iconAliases[normalizeKey(key)] = value;
    }
    for (const [key, value] of Object.entries(siegeAliases())) {
        iconAliases[normalizeKey(key)] = value;
    }

    const aliasPayload = {
        version: 1,
        generatedAt: new Date().toISOString(),
        traitAliases,
        iconAliases
    };

    writeFileSync(OUTPUT_ALIAS_PATH, `${JSON.stringify(aliasPayload, null, 2)}\n`);
    writeFileSync(OUTPUT_SKILL_NAME_PATH, `${JSON.stringify(skillNameMap, null, 2)}\n`);

    console.log(`Wrote ${OUTPUT_ALIAS_PATH}`);
    console.log(`Wrote ${OUTPUT_SKILL_NAME_PATH}`);
};

run().catch((err) => {
    console.error(err?.stack || err);
    process.exit(1);
});
