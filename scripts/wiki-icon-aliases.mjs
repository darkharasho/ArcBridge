#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

const API = 'https://wiki.guildwars2.com/api.php';

const args = process.argv.slice(2);
const getArg = (flag) => {
  const idx = args.indexOf(flag);
  if (idx === -1) return null;
  return args[idx + 1] || null;
};

const namesPath = getArg('--names') || 'public/img/skill-id-names.json';
const outPath = getArg('--out') || 'public/img/icon-aliases.json';
const overridesPath = getArg('--overrides') || 'public/img/icon-aliases.overrides.json';
const onlyMissing = args.includes('--only-missing');
const limit = Number(getArg('--limit') || 0);
const dryRun = args.includes('--dry-run');
const allSkills = args.includes('--all-skills');
const infoboxFallback = !args.includes('--no-infobox');
const wikiDelayMs = Number(getArg('--wiki-delay-ms') || 250);
const wikiRetries = Number(getArg('--wiki-retries') || 3);
const gw2Retries = Number(getArg('--gw2-retries') || 3);
const gw2DelayMs = Number(getArg('--gw2-delay-ms') || 250);
const gw2Api = 'https://api.guildwars2.com/v2/skills';

const toArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'object') return Object.values(value);
  return [];
};

const normalizeKey = (name) => name
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[’'`´"]/g, '')
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/_+/g, '_')
  .replace(/^_+|_+$/g, '');

const humanizeBase = (base) => base.replace(/_/g, ' ').trim();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const renderProgress = (label, completed, total) => {
  const width = 24;
  const safeTotal = Math.max(1, total);
  const ratio = Math.min(1, completed / safeTotal);
  const filled = Math.round(width * ratio);
  const bar = `${'█'.repeat(filled)}${'░'.repeat(width - filled)}`;
  const pct = (ratio * 100).toFixed(1).padStart(5, ' ');
  process.stdout.write(`\r${label} [${bar}] ${pct}% (${completed}/${total})`);
  if (completed >= total) process.stdout.write('\n');
};

const fetchJson = async (url, opts = {}) => {
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'ArcBridge/1.0 (https://github.com/darkharasho/ArcBridge)',
      'Accept': 'application/json'
    },
    ...opts
  });
  if (!resp.ok) {
    const err = new Error(`HTTP ${resp.status}`);
    err.status = resp.status;
    throw err;
  }
  return resp.json();
};

const getPageImageFile = (page) => {
  const original = page?.original?.source;
  if (original) {
    const filename = decodeURIComponent(original.split('/').pop() || '');
    if (filename) return filename;
  }
  const thumb = page?.thumbnail?.source;
  if (thumb) {
    const filename = decodeURIComponent(thumb.split('/').pop() || '');
    if (filename) return filename;
  }
  const pageImage = page?.pageimage;
  if (pageImage) return pageImage;
  return null;
};

const buildWikitextUrl = (title) => {
  const params = new URLSearchParams({
    action: 'parse',
    format: 'json',
    redirects: '1',
    prop: 'wikitext',
    page: title
  });
  return `${API}?${params.toString()}`;
};

const extractInfoboxIcon = (wikitext) => {
  if (!wikitext) return null;
  const patterns = [
    /\|\s*icon\s*=\s*(?:\[\[File:)?([^\]\|\n]+)\]?/i,
    /\|\s*image\s*=\s*(?:\[\[File:)?([^\]\|\n]+)\]?/i
  ];
  for (const pattern of patterns) {
    const match = wikitext.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  return null;
};

const loadNames = () => {
  if (!existsSync(namesPath)) {
    throw new Error(`Names file not found: ${namesPath}`);
  }
  const raw = JSON.parse(readFileSync(namesPath, 'utf8'));
  const names = toArray(raw)
    .flatMap((entry) => {
      if (!entry) return [];
      if (typeof entry === 'string') return [entry];
      if (typeof entry === 'object') {
        if (entry.name) return [entry.name];
        if (entry.title) return [entry.title];
      }
      return [];
    })
    .map((name) => String(name || '').trim())
    .filter(Boolean);
  return Array.from(new Set(names));
};

const loadAliases = () => {
  if (!existsSync(outPath)) {
    return { version: 1, generatedAt: new Date().toISOString(), iconAliases: {}, traitAliases: {} };
  }
  const data = JSON.parse(readFileSync(outPath, 'utf8'));
  if (!data.iconAliases) data.iconAliases = {};
  if (!data.traitAliases) data.traitAliases = {};
  return data;
};

const loadOverrides = () => {
  if (!existsSync(overridesPath)) return {};
  const data = JSON.parse(readFileSync(overridesPath, 'utf8'));
  return data?.iconAliases || {};
};

const buildQueryUrl = (titles) => {
    const params = new URLSearchParams({
        action: 'query',
        format: 'json',
        redirects: '1',
        prop: 'pageimages',
        piprop: 'original|name|thumbnail',
        pithumbsize: '256',
        titles: titles.join('|')
    });
    return `${API}?${params.toString()}`;
};

const fetchAllSkillNames = async () => {
  const idsResp = await fetchJson(gw2Api);
  const ids = Array.isArray(idsResp) ? idsResp : [];
  const batches = [];
  const batchSize = 200;
  for (let i = 0; i < ids.length; i += batchSize) {
    batches.push(ids.slice(i, i + batchSize));
  }
  const names = [];
  let completed = 0;
  const totalBatches = batches.length;
  for (const batch of batches) {
    const url = `${gw2Api}?ids=${batch.join(',')}`;
    let data = null;
    let attempt = 0;
    while (attempt <= gw2Retries) {
      try {
        // eslint-disable-next-line no-await-in-loop
        data = await fetchJson(url);
        break;
      } catch (err) {
        const status = err?.status;
        if (status && [429, 502, 503].includes(status) && attempt < gw2Retries) {
          const backoff = gw2DelayMs * Math.pow(2, attempt);
          console.warn(`[wiki-icon-aliases] GW2 API rate limit (${status}). Retrying in ${backoff}ms...`);
          // eslint-disable-next-line no-await-in-loop
          await sleep(backoff);
          attempt += 1;
          continue;
        }
        throw err;
      }
    }
    if (!data) continue;
    if (Array.isArray(data)) {
      data.forEach((entry) => {
        if (entry?.name) names.push(entry.name);
      });
    }
    completed += 1;
    renderProgress('[wiki-icon-aliases] GW2 API', completed, totalBatches);
  }
  return Array.from(new Set(names));
};

const main = async () => {
  let names = allSkills ? await fetchAllSkillNames() : loadNames();
  if (names.length === 0 && !allSkills) {
    console.warn('No names found in --names file; falling back to --all-skills.');
    names = await fetchAllSkillNames();
  }
  if (names.length === 0) {
    console.error('No skill names found. Provide --names or use --all-skills.');
    process.exit(1);
  }
  const aliases = loadAliases();
  const existing = aliases.iconAliases || {};
  const list = limit > 0 ? names.slice(0, limit) : names;

  const toResolve = onlyMissing
    ? list.filter((name) => !existing[normalizeKey(name)])
    : list;

  const results = {};
  const batchSize = Number(getArg('--wiki-batch')) || 20;
  let completed = 0;
  const totalBatches = Math.ceil(toResolve.length / batchSize) || 1;
  for (let i = 0; i < toResolve.length; i += batchSize) {
    const batch = toResolve.slice(i, i + batchSize);
    if (batch.some((name) => normalizeKey(name) === 'flame_jet')) {
      console.log('[wiki-icon-aliases] Flame Jet present in batch.');
    }
    const url = buildQueryUrl(batch);
    let data = null;
    let attempt = 0;
    while (attempt <= wikiRetries) {
      try {
        // eslint-disable-next-line no-await-in-loop
        data = await fetchJson(url);
        break;
      } catch (err) {
        const status = err?.status;
        if (status && [403, 404, 429, 502, 503].includes(status) && attempt < wikiRetries) {
          const backoff = wikiDelayMs * Math.pow(2, attempt);
          console.warn(`[wiki-icon-aliases] Wiki error (${status}). Retrying in ${backoff}ms...`);
          // eslint-disable-next-line no-await-in-loop
          await sleep(backoff);
          attempt += 1;
          continue;
        }
        if (status === 404) {
          data = null;
          break;
        }
        throw err;
      }
    }
    if (!data) continue;
    const pages = data?.query?.pages || {};
    if (batch.some((name) => normalizeKey(name) === 'flame_jet')) {
      const hasFlameJet = Object.values(pages).some((page) => normalizeKey(page?.title || '') === 'flame_jet');
      console.log('[wiki-icon-aliases] Flame Jet page returned:', hasFlameJet);
      if (!hasFlameJet) {
        const titles = Object.values(pages).map((page) => page?.title).filter(Boolean).slice(0, 5);
        console.log('[wiki-icon-aliases] Sample returned titles:', titles);
      }
    }
    const infoboxQueue = [];
    const missingImageQueue = [];
    for (const page of Object.values(pages)) {
      const title = page?.title;
      const file = getPageImageFile(page);
      if (title && !file) {
        missingImageQueue.push(title);
      }
      if (!title || !file) continue;
      const base = file.replace(/\.[^.]+$/, '');
      results[normalizeKey(title)] = humanizeBase(base);
      if (infoboxFallback) {
        const titleKey = normalizeKey(title);
        const baseKey = normalizeKey(base);
        if (titleKey && baseKey && titleKey === baseKey) {
          infoboxQueue.push(title);
        }
      }
    }
    if (infoboxFallback && missingImageQueue.length > 0) {
      const variants = (baseTitle) => ([
        baseTitle,
        `${baseTitle} (skill)`,
        `${baseTitle} (effect)`,
        `${baseTitle} (siege)`,
        `${baseTitle} (kit)`,
        `${baseTitle} (weapon)`,
        `${baseTitle} (utility)`,
        `${baseTitle} (elite)`
      ]);
      for (const title of missingImageQueue) {
        let foundIcon = null;
        for (const variant of variants(title)) {
          const altUrl = buildWikitextUrl(variant);
          let altText = null;
          let attempt = 0;
          while (attempt <= wikiRetries) {
            try {
              const altData = await fetchJson(altUrl);
              altText = altData?.parse?.wikitext?.['*'] || '';
              break;
            } catch (err) {
              const status = err?.status;
              if (status && [403, 429, 503].includes(status) && attempt < wikiRetries) {
                const backoff = wikiDelayMs * Math.pow(2, attempt);
                console.warn(`[wiki-icon-aliases] Wiki rate limit (${status}). Retrying in ${backoff}ms...`);
                await sleep(backoff);
                attempt += 1;
                continue;
              }
              altText = null;
              break;
            }
          }
          if (!altText) continue;
          const altIcon = extractInfoboxIcon(altText);
          if (altIcon) {
            foundIcon = altIcon;
            break;
          }
          await sleep(wikiDelayMs);
        }
        if (foundIcon) {
          const base = foundIcon.replace(/\.[^.]+$/, '');
          results[normalizeKey(title)] = humanizeBase(base);
        }
      }
    }
    if (infoboxFallback && infoboxQueue.length > 0) {
      for (const title of infoboxQueue) {
        const titleVariants = [
          title,
          `${title} (skill)`,
          `${title} (effect)`
        ];
        let iconFile = null;
        for (const variant of titleVariants) {
          const url = buildWikitextUrl(variant);
          let wikiText = null;
          let attempt = 0;
          while (attempt <= wikiRetries) {
            try {
              // eslint-disable-next-line no-await-in-loop
              const wikitextData = await fetchJson(url);
              wikiText = wikitextData?.parse?.wikitext?.['*'] || '';
              break;
            } catch (err) {
              const status = err?.status;
              if (status && [403, 429, 503].includes(status) && attempt < wikiRetries) {
                const backoff = wikiDelayMs * Math.pow(2, attempt);
                console.warn(`[wiki-icon-aliases] Wiki rate limit (${status}). Retrying in ${backoff}ms...`);
                // eslint-disable-next-line no-await-in-loop
                await sleep(backoff);
                attempt += 1;
                continue;
              }
              wikiText = null;
              break;
            }
          }
          if (!wikiText) continue;
          const found = extractInfoboxIcon(wikiText);
          if (found) {
            iconFile = found;
            break;
          }
          // eslint-disable-next-line no-await-in-loop
          await sleep(wikiDelayMs);
        }
        if (!iconFile) continue;
        const base = iconFile.replace(/\.[^.]+$/, '');
        results[normalizeKey(title)] = humanizeBase(base);
        // eslint-disable-next-line no-await-in-loop
        await sleep(wikiDelayMs);
      }
    }
    completed += 1;
    renderProgress('[wiki-icon-aliases] Wiki', completed, totalBatches);
    // eslint-disable-next-line no-await-in-loop
    await sleep(wikiDelayMs);
  }

  const overrides = loadOverrides();
  const merged = {
    ...aliases,
    generatedAt: new Date().toISOString(),
    iconAliases: {
      ...existing,
      ...results,
      ...overrides
    }
  };

  if (dryRun) {
    console.log(`Resolved ${Object.keys(results).length} aliases.`);
    return;
  }

  writeFileSync(outPath, `${JSON.stringify(merged, null, 2)}\n`);
  console.log(`Wrote ${Object.keys(results).length} aliases to ${outPath}`);
};

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
