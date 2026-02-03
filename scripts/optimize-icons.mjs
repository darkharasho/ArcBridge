#!/usr/bin/env node
import { existsSync, readdirSync, statSync, writeFileSync, unlinkSync } from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const iconDirs = [
    'public/img/game-icons',
    'public/img/skill-icons',
    'public/img/buff-icons',
    'public/img/relic-icons',
    'public/img/sigil-icons',
    'public/img/trait-icons'
];

const dryRun = process.argv.includes('--dry-run');
const quality = Number(process.env.WEBP_QUALITY || 82);
const alphaQuality = Number(process.env.WEBP_ALPHA_QUALITY || 90);
const method = String(process.env.WEBP_METHOD || '6');

const magickCheck = spawnSync('magick', ['-version'], { stdio: 'ignore' });
if (magickCheck.status !== 0) {
    console.error('ImageMagick (magick) is required to generate WebP icons.');
    process.exit(1);
}

const isImage = (file) => /\.(png|jpe?g)$/i.test(file);
const isImageOrWebp = (file) => /\.(png|jpe?g|webp|svg)$/i.test(file);

const formatBytes = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

let totalSourceBytes = 0;
let totalWebpBytes = 0;
let converted = 0;
let skipped = 0;

const normalizeIconKey = (name) => {
    if (!name) return '';
    const normalized = name
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');
    return normalized;
};

const buildManifest = (dir) => {
    const files = readdirSync(dir).filter(isImageOrWebp);
    const bestByBase = new Map();
    const rankExt = (ext) => {
        if (ext === '.webp') return 0;
        if (ext === '.png') return 1;
        if (ext === '.jpg' || ext === '.jpeg') return 2;
        return 3;
    };
    for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        const base = path.parse(file).name;
        const existing = bestByBase.get(base);
        if (!existing || rankExt(ext) < rankExt(existing.ext)) {
            bestByBase.set(base, { file, ext });
        }
    }

    const entries = {};
    const collisions = {};
    for (const [base, info] of bestByBase.entries()) {
        const key = normalizeIconKey(base);
        if (!key) continue;
        if (entries[key] && entries[key] !== info.file) {
            collisions[key] = collisions[key] || [entries[key]];
            if (!collisions[key].includes(info.file)) {
                collisions[key].push(info.file);
            }
            continue;
        }
        entries[key] = info.file;
    }

    return {
        version: 1,
        generatedAt: new Date().toISOString(),
        entries,
        collisions: Object.keys(collisions).length > 0 ? collisions : undefined
    };
};

for (const dir of iconDirs) {
    if (!existsSync(dir)) {
        console.warn(`Skipping missing directory: ${dir}`);
        continue;
    }

    const files = readdirSync(dir).filter(isImage);
    for (const file of files) {
        const sourcePath = path.join(dir, file);
        const sourceStat = statSync(sourcePath);
        totalSourceBytes += sourceStat.size;

        const targetPath = path.join(dir, `${path.parse(file).name}.webp`);
        if (existsSync(targetPath)) {
            const targetStat = statSync(targetPath);
            totalWebpBytes += targetStat.size;
            if (targetStat.mtimeMs >= sourceStat.mtimeMs) {
                if (!dryRun) {
                    try {
                        unlinkSync(sourcePath);
                    } catch {
                        // ignore delete failures
                    }
                }
                skipped += 1;
                continue;
            }
        }

        if (dryRun) {
            converted += 1;
            continue;
        }

        const result = spawnSync('magick', [
            sourcePath,
            '-strip',
            '-define', `webp:method=${method}`,
            '-define', `webp:alpha-quality=${alphaQuality}`,
            '-quality', `${quality}`,
            targetPath
        ], { stdio: 'ignore' });

        if (result.status !== 0) {
            console.warn(`Failed to convert: ${sourcePath}`);
            continue;
        }

        converted += 1;
        if (existsSync(targetPath)) {
            totalWebpBytes += statSync(targetPath).size;
        }
        if (!dryRun) {
            try {
                unlinkSync(sourcePath);
            } catch {
                // ignore delete failures
            }
        }
    }

    if (!dryRun) {
        const manifestPath = path.join(dir, 'manifest.json');
        if (dir.endsWith('public/img/game-icons') && existsSync('public/img/game-icons-sprite/manifest.json')) {
            try {
                console.log('Skipping game-icons manifest write (sprite manifest detected).');
                continue;
            } catch {
                // ignore parse errors
            }
        }
        const manifest = buildManifest(dir);
        writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    }
}

console.log(`Converted: ${converted}`);
console.log(`Skipped (up-to-date): ${skipped}`);
console.log(`Source total: ${formatBytes(totalSourceBytes)}`);
console.log(`WebP total: ${formatBytes(totalWebpBytes)}`);
