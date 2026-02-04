import { copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const srcPath = resolve('src/shared/metrics-spec.md');
const docsPath = resolve('docs/metrics-spec.md');

try {
    await copyFile(srcPath, docsPath);
    // eslint-disable-next-line no-console
    console.log(`[sync-metrics-spec] Copied ${srcPath} -> ${docsPath}`);
} catch (err) {
    // eslint-disable-next-line no-console
    console.error('[sync-metrics-spec] Failed to copy metrics spec:', err);
    process.exitCode = 1;
}
