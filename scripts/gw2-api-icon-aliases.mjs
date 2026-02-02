#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'fs';

const API = 'https://api.guildwars2.com/v2';

const args = process.argv.slice(2);
const getArg = (flag) => {
  const idx = args.indexOf(flag);
  if (idx === -1) return null;
  return args[idx + 1] || null;
};

const outPath = getArg('--out') || 'public/img/icon-aliases.json';
const manifestPath = getArg('--manifest') || 'public/img/game-icons/manifest.json';
const includeSkills = args.includes('--skills') || args.includes('--all');
const includeKits = args.includes('--kits') || args.includes('--all');
const includeTraits = args.includes('--traits') || args.includes('--all');
const includeSigils = args.includes('--sigils') || args.includes('--all');
const includeRelics = args.includes('--relics') || args.includes('--all');
const includeEffects = args.includes('--effects') || args.includes('--all');
const wikiKits = !args.includes('--no-wiki-kits');
const wikiBatch = Number(getArg('--wiki-batch') || 20);
const wikiDelayMs = Number(getArg('--wiki-delay-ms') || 500);
const wikiRetries = Number(getArg('--wiki-retries') || 3);
const onlyMissing = args.includes('--only-missing');
const fallbackToName = args.includes('--fallback-to-name');
const reportMissingPath = getArg('--report-missing') || 'public/img/icon-aliases.missing.json';
const limit = Number(getArg('--limit') || 0);
const delayMs = Number(getArg('--delay-ms') || 200);
const retries = Number(getArg('--retries') || 3);
const batchSize = Number(getArg('--batch') || 200);
const dryRun = args.includes('--dry-run');

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
const fetchJson = async (url) => {
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'ArcBridge/1.0 (https://github.com/darkharasho/ArcBridge)',
      'Accept': 'application/json'
    }
  });
  if (!resp.ok) {
    const err = new Error(`HTTP ${resp.status}`);
    err.status = resp.status;
    throw err;
  }
  return resp.json();
};

const fetchWikiJson = async (url) => {
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'ArcBridge/1.0 (https://github.com/darkharasho/ArcBridge)',
      'Accept': 'application/json'
    }
  });
  if (!resp.ok) {
    const err = new Error(`HTTP ${resp.status}`);
    err.status = resp.status;
    throw err;
  }
  return resp.json();
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

const loadAliases = () => {
  if (!existsSync(outPath)) {
    return { version: 1, generatedAt: new Date().toISOString(), iconAliases: {}, traitAliases: {} };
  }
  const data = JSON.parse(readFileSync(outPath, 'utf8'));
  if (!data.iconAliases) data.iconAliases = {};
  if (!data.traitAliases) data.traitAliases = {};
  return data;
};

const loadManifestKeys = () => {
  if (!existsSync(manifestPath)) return new Set();
  const data = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const entries = data?.entries || {};
  return new Set(Object.keys(entries));
};

const extractIconBase = (iconUrl) => {
  if (!iconUrl) return null;
  const filename = decodeURIComponent(iconUrl.split('/').pop() || '');
  if (!filename) return null;
  return filename.replace(/\.[^.]+$/, '');
};

const buildWikiQueryUrl = (titles) => {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    prop: 'pageimages',
    piprop: 'original|name',
    titles: titles.join('|')
  });
  return `https://wiki.guildwars2.com/api.php?${params.toString()}`;
};

const getWikiImageFile = (page) => {
  const original = page?.original?.source;
  if (original) {
    const filename = decodeURIComponent(original.split('/').pop() || '');
    if (filename) return filename;
  }
  const pageImage = page?.pageimage;
  if (pageImage) return pageImage;
  return null;
};

const fetchIds = async (endpoint, params = '') => {
  const url = `${API}/${endpoint}${params ? `?${params}` : ''}`;
  return fetchJson(url);
};

const fetchBatch = async (endpoint, ids) => {
  const url = `${API}/${endpoint}?ids=${ids.join(',')}`;
  let attempt = 0;
  while (attempt <= retries) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await fetchJson(url);
    } catch (err) {
      const status = err?.status;
      if (status && [403, 429, 503].includes(status) && attempt < retries) {
        const backoff = delayMs * Math.pow(2, attempt);
        console.warn(`[gw2-api-icon-aliases] API rate limit (${status}). Retrying in ${backoff}ms...`);
        // eslint-disable-next-line no-await-in-loop
        await sleep(backoff);
        attempt += 1;
        continue;
      }
      throw err;
    }
  }
  return [];
};

const collectFromEntries = (entries, results, manifestKeys, missing) => {
  entries.forEach((entry) => {
    if (!entry?.name || !entry?.icon) return;
    const base = extractIconBase(entry.icon);
    if (!base) return;
    const baseKey = normalizeKey(base);
    if (manifestKeys.size && !manifestKeys.has(baseKey)) {
      if (fallbackToName && manifestKeys.has(normalizeKey(entry.name))) {
        results[normalizeKey(entry.name)] = entry.name;
      } else {
        missing.push({ name: entry.name, iconBase: base, iconKey: baseKey });
      }
      return;
    }
    results[normalizeKey(entry.name)] = humanizeBase(base);
  });
};

const collectFromItems = (items, results, manifestKeys, missing) => {
  items.forEach((item) => {
    if (!item?.name || !item?.icon) return;
    const base = extractIconBase(item.icon);
    if (!base) return;
    const baseKey = normalizeKey(base);
    if (manifestKeys.size && !manifestKeys.has(baseKey)) {
      if (fallbackToName && manifestKeys.has(normalizeKey(item.name))) {
        results[normalizeKey(item.name)] = item.name;
      } else {
        missing.push({ name: item.name, iconBase: base, iconKey: baseKey });
      }
      return;
    }
    results[normalizeKey(item.name)] = humanizeBase(base);
  });
};

const buildIdBatches = (ids) => {
  const batches = [];
  for (let i = 0; i < ids.length; i += batchSize) {
    batches.push(ids.slice(i, i + batchSize));
  }
  return batches;
};

const resolveEndpoint = async (endpoint, label, results, manifestKeys, missing, filterFn = null, nameSink = null) => {
  const ids = await fetchIds(endpoint);
  const list = Array.isArray(ids) ? ids : [];
  const limited = limit > 0 ? list.slice(0, limit) : list;
  const batches = buildIdBatches(limited);
  let completed = 0;
  for (const batch of batches) {
    // eslint-disable-next-line no-await-in-loop
    const data = await fetchBatch(endpoint, batch);
    if (Array.isArray(data)) {
      const filtered = filterFn ? data.filter(filterFn) : data;
      if (nameSink) {
        filtered.forEach((entry) => {
          if (entry?.name) nameSink.push(entry.name);
        });
      }
      collectFromEntries(filtered, results, manifestKeys, missing);
    }
    completed += 1;
    renderProgress(`[gw2-api-icon-aliases] ${label}`, completed, batches.length);
    // eslint-disable-next-line no-await-in-loop
    await sleep(delayMs);
  }
};

const resolveItems = async (type, label, results, manifestKeys, missing) => {
  const ids = await fetchIds('items', `type=${encodeURIComponent(type)}`);
  const list = Array.isArray(ids) ? ids : [];
  const limited = limit > 0 ? list.slice(0, limit) : list;
  const batches = buildIdBatches(limited);
  let completed = 0;
  for (const batch of batches) {
    // eslint-disable-next-line no-await-in-loop
    const data = await fetchBatch('items', batch);
    if (Array.isArray(data)) {
      collectFromItems(data, results, manifestKeys, missing);
    }
    completed += 1;
    renderProgress(`[gw2-api-icon-aliases] ${label}`, completed, batches.length);
    // eslint-disable-next-line no-await-in-loop
    await sleep(delayMs);
  }
};

const resolveWikiForTitles = async (titles, results, manifestKeys, missing) => {
  const unique = Array.from(new Set(titles)).filter(Boolean);
  const batches = buildIdBatches(unique).map((batch) => batch.slice(0, wikiBatch));
  let completed = 0;
  for (let i = 0; i < unique.length; i += wikiBatch) {
    const batch = unique.slice(i, i + wikiBatch);
    const url = buildWikiQueryUrl(batch);
    let data = null;
    let attempt = 0;
    while (attempt <= wikiRetries) {
      try {
        // eslint-disable-next-line no-await-in-loop
        data = await fetchWikiJson(url);
        break;
      } catch (err) {
        const status = err?.status;
        if (status && [403, 429, 503].includes(status) && attempt < wikiRetries) {
          const backoff = wikiDelayMs * Math.pow(2, attempt);
          console.warn(`[gw2-api-icon-aliases] Wiki rate limit (${status}). Retrying in ${backoff}ms...`);
          // eslint-disable-next-line no-await-in-loop
          await sleep(backoff);
          attempt += 1;
          continue;
        }
        throw err;
      }
    }
    if (!data) continue;
    const pages = data?.query?.pages || {};
    Object.values(pages).forEach((page) => {
      const title = page?.title;
      const file = getWikiImageFile(page);
      if (!title || !file) return;
      const base = file.replace(/\.[^.]+$/, '');
      const baseKey = normalizeKey(base);
      if (manifestKeys.size && !manifestKeys.has(baseKey)) {
        if (fallbackToName && manifestKeys.has(normalizeKey(title))) {
          results[normalizeKey(title)] = title;
        } else {
          missing.push({ name: title, iconBase: base, iconKey: baseKey });
        }
        return;
      }
      results[normalizeKey(title)] = humanizeBase(base);
    });
    completed += 1;
    renderProgress('[gw2-api-icon-aliases] Wiki kits', completed, Math.ceil(unique.length / wikiBatch));
    // eslint-disable-next-line no-await-in-loop
    await sleep(wikiDelayMs);
  }
};

const main = async () => {
  if (!includeSkills && !includeTraits && !includeSigils && !includeRelics && !includeEffects && !includeKits) {
    console.error('Pick a category: --skills --traits --sigils --relics --effects --kits or --all');
    process.exit(1);
  }

  const aliases = loadAliases();
  const existing = aliases.iconAliases || {};
  const results = {};
  const manifestKeys = loadManifestKeys();
  const missing = [];
  const kitNames = [];

  if (includeSkills) await resolveEndpoint('skills', 'skills', results, manifestKeys, missing);
  if (includeKits) {
    await resolveEndpoint(
      'skills',
      'kits',
      results,
      manifestKeys,
      missing,
      (entry) => Array.isArray(entry?.categories) && entry.categories.some((c) => String(c).toLowerCase() === 'kit'),
      kitNames
    );
    if (wikiKits && kitNames.length > 0) {
      await resolveWikiForTitles(kitNames, results, manifestKeys, missing);
    }
  }
  if (includeTraits) await resolveEndpoint('traits', 'traits', results, manifestKeys, missing);
  if (includeEffects) await resolveEndpoint('effects', 'effects', results, manifestKeys, missing);
  if (includeSigils) await resolveItems('UpgradeComponent', 'sigils', results, manifestKeys, missing);
  if (includeRelics) await resolveItems('Relic', 'relics', results, manifestKeys, missing);

  const mergedAliases = onlyMissing
    ? Object.fromEntries(Object.entries(results).filter(([key]) => !existing[key]))
    : results;

  const merged = {
    ...aliases,
    generatedAt: new Date().toISOString(),
    iconAliases: {
      ...existing,
      ...mergedAliases
    }
  };

  if (dryRun) {
    console.log(`Resolved ${Object.keys(mergedAliases).length} aliases.`);
    if (missing.length > 0) {
      console.log(`Missing icon matches: ${missing.length}`);
    }
    return;
  }

  writeFileSync(outPath, `${JSON.stringify(merged, null, 2)}\n`);
  console.log(`Wrote ${Object.keys(mergedAliases).length} aliases to ${outPath}`);
  if (missing.length > 0) {
    writeFileSync(reportMissingPath, `${JSON.stringify(missing, null, 2)}\n`);
    console.log(`Wrote ${missing.length} missing entries to ${reportMissingPath}`);
  }
};

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
