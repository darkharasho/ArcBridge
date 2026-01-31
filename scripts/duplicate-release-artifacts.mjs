import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const outputDir = path.join(rootDir, 'dist_out');

const LEGACY_PREFIX = 'gw2_arc_log_uploader';
const NEW_PREFIX = 'ArcBridge';
const DUPLICATE_EXTS = new Set(['.AppImage', '.deb', '.exe', '.blockmap']);

const exists = (p) => {
    try {
        fs.accessSync(p, fs.constants.F_OK);
        return true;
    } catch {
        return false;
    }
};

const copyIfMissing = (fromPath, toPath) => {
    if (exists(toPath)) return false;
    fs.copyFileSync(fromPath, toPath);
    return true;
};

const listFiles = (dir) => {
    if (!fs.existsSync(dir)) return [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const absPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...listFiles(absPath));
        } else if (entry.isFile()) {
            files.push(absPath);
        }
    }
    return files;
};

if (!fs.existsSync(outputDir)) {
    console.log('duplicate-release-artifacts: dist_out not found, skipping.');
    process.exit(0);
}

let created = 0;
const files = listFiles(outputDir);
for (const filePath of files) {
    const ext = path.extname(filePath);
    if (!DUPLICATE_EXTS.has(ext)) continue;
    const base = path.basename(filePath);
    const dir = path.dirname(filePath);

    if (base.startsWith(`${LEGACY_PREFIX}-`)) {
        const swapped = base.replace(LEGACY_PREFIX, NEW_PREFIX);
        const target = path.join(dir, swapped);
        if (copyIfMissing(filePath, target)) {
            created += 1;
        }
    } else if (base.startsWith(`${NEW_PREFIX}-`)) {
        const swapped = base.replace(NEW_PREFIX, LEGACY_PREFIX);
        const target = path.join(dir, swapped);
        if (copyIfMissing(filePath, target)) {
            created += 1;
        }
    }
}

if (created > 0) {
    console.log(`duplicate-release-artifacts: created ${created} bridge artifacts.`);
} else {
    console.log('duplicate-release-artifacts: no bridge artifacts needed.');
}
