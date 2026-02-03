#!/usr/bin/env node
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync } from 'child_process';

const args = process.argv.slice(2);
const getArg = (flag, fallback = null) => {
  const idx = args.indexOf(flag);
  if (idx === -1) return fallback;
  return args[idx + 1] || fallback;
};

const srcDir = getArg('--src', 'public/img/game-icons');
const outDir = getArg('--out', 'public/img/game-icons-sprite');
const tileSize = Number(getArg('--tile', '64'));
const sheetSize = Number(getArg('--sheet', '4096'));
const quality = Number(process.env.WEBP_QUALITY || 82);
const method = String(process.env.WEBP_METHOD || '6');

const magickCheck = spawnSync('magick', ['-version'], { stdio: 'ignore' });
if (magickCheck.status !== 0) {
  console.error('ImageMagick (magick) is required to generate sprite sheets.');
  process.exit(1);
}

if (!existsSync(srcDir)) {
  console.error(`Source directory not found: ${srcDir}`);
  process.exit(1);
}

const isImage = (file) => /\.(png|jpe?g|webp)$/i.test(file);
const isSprite = (file) => /^sprite-\d+\.webp$/i.test(file);

const normalizeIconKey = (name) => {
  if (!name) return '';
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’'`´"]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
};

const files = readdirSync(srcDir)
  .filter((file) => isImage(file) && !isSprite(file))
  .sort((a, b) => a.localeCompare(b, 'en'));

if (files.length === 0) {
  console.error('No icons found to pack.');
  process.exit(1);
}

const columns = Math.max(1, Math.floor(sheetSize / tileSize));
const rows = columns;
const perSheet = columns * rows;

const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'arcbridge-game-icons-'));
const tilesDir = path.join(tempRoot, 'tiles');
mkdirSync(tilesDir, { recursive: true });

const processedTiles = [];
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

for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    const srcPath = path.join(srcDir, file);
    const tilePath = path.join(tilesDir, `${String(i).padStart(6, '0')}.webp`);
  const result = spawnSync('magick', [
    srcPath,
    '-resize', `${tileSize}x${tileSize}`,
    '-background', 'none',
    '-gravity', 'center',
    '-extent', `${tileSize}x${tileSize}`,
    '-strip',
    '-define', `webp:method=${method}`,
    '-quality', `${quality}`,
    tilePath
  ], { stdio: 'ignore' });
  if (result.status !== 0) {
    console.warn(`Failed to process icon: ${file}`);
    continue;
  }
  processedTiles.push({ file, tilePath });
  renderProgress('Packing icons', processedTiles.length, files.length);
}

const sprites = {};
const entries = {};
const collisions = {};
const entryBases = {};

let globalIndex = 0;
let sheetIndex = 0;
const totalSheets = Math.ceil(processedTiles.length / perSheet);
while (globalIndex < processedTiles.length) {
  const sheetTiles = processedTiles.slice(globalIndex, globalIndex + perSheet);
  const listPath = path.join(tempRoot, `sheet-${sheetIndex}.txt`);
  writeFileSync(listPath, sheetTiles.map((tile) => tile.tilePath).join('\n'));

  const outputName = `sprite-${sheetIndex}.webp`;
  const outputPath = path.join(outDir, outputName);
  const montage = spawnSync('magick', [
    'montage',
    `@${listPath}`,
    '-tile', `${columns}x`,
    '-geometry', `${tileSize}x${tileSize}+0+0`,
    '-background', 'none',
    '-define', `webp:method=${method}`,
    '-quality', `${quality}`,
    outputPath
  ], { stdio: 'ignore' });
  if (montage.status !== 0) {
    console.error(`Failed to build sprite sheet: ${outputName}`);
    process.exit(1);
  }

  renderProgress('Building sheets', sheetIndex + 1, totalSheets);

  const rowCount = Math.ceil(sheetTiles.length / columns);
  sprites[outputName] = {
    width: columns * tileSize,
    height: rowCount * tileSize,
    tile: tileSize,
    columns,
    rows: rowCount
  };

  for (let i = 0; i < sheetTiles.length; i += 1) {
    const item = sheetTiles[i];
    const base = path.parse(item.file).name;
    const key = normalizeIconKey(base);
    if (!key) continue;
    const col = i % columns;
    const row = Math.floor(i / columns);
    const entry = {
      sheet: outputName,
      x: col * tileSize,
      y: row * tileSize,
      w: tileSize,
      h: tileSize
    };
    if (entries[key]) {
      const existingBase = entryBases[key] || base;
      collisions[key] = collisions[key] || [existingBase];
      if (!collisions[key].includes(base)) {
        collisions[key].push(base);
      }
      continue;
    }
    entries[key] = entry;
    entryBases[key] = base;
  }

  globalIndex += sheetTiles.length;
  sheetIndex += 1;
}

const manifest = {
  version: 1,
  generatedAt: new Date().toISOString(),
  entries,
  collisions: Object.keys(collisions).length > 0 ? collisions : undefined,
  sprites
};

if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true });
}

const fallbackSvg = path.join(srcDir, 'Unknown_Icon.svg');
if (existsSync(fallbackSvg)) {
  const destSvg = path.join(outDir, 'Unknown_Icon.svg');
  try {
    const data = readFileSync(fallbackSvg);
    writeFileSync(destSvg, data);
  } catch {
    // ignore copy failures
  }
}

writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

rmSync(tempRoot, { recursive: true, force: true });

console.log(`Packed ${processedTiles.length} icons into ${Object.keys(sprites).length} sprite sheet(s).`);
console.log(`Manifest written to ${path.join(outDir, 'manifest.json')}`);
