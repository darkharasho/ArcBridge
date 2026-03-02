/**
 * Dev dataset I/O, integrity checks, and filesystem utilities.
 *
 * No Electron APIs are used here — all filesystem access goes through Node `fs`
 * and `path`, so these functions can be unit-tested outside of Electron.
 *
 * The only exception is `getDevDatasetsDir`, which uses `process.cwd()` (safe
 * outside Electron). The `normalizeDevDatasetSnapshot` caller is responsible for
 * passing the current app version string.
 */

import fs from 'fs';
import path from 'node:path';
import { computeFileHash } from './dpsReportCache';

// ─── Constants ────────────────────────────────────────────────────────────────

export const MAX_DEV_DATASET_REPORT_BYTES = 50 * 1024 * 1024;
export const DEV_DATASET_SNAPSHOT_SCHEMA_VERSION = 1;
export const DEV_DATASET_TEMP_PREFIX = '.tmp-';
export const DEV_DATASET_STATUS_FILE = 'status.json';
export const DEV_DATASET_INTEGRITY_FILE = 'integrity.json';
export const DEV_DATASET_INTEGRITY_SCHEMA_VERSION = 1;
export const MAX_GITHUB_BLOB_BYTES = 90 * 1024 * 1024;
export const MAX_GITHUB_REPORT_JSON_BYTES = 32 * 1024 * 1024;

// ─── Module-level in-memory caches (shared across IPC handlers) ───────────────

export const devDatasetFolderCache = new Map<string, string>();
export const devDatasetFinalFolderCache = new Map<string, string>();
export const devDatasetManifestCache = new Map<string, {
    meta: { id: string; name: string; createdAt: string; folder: string };
    logs: any[];
}>();

// ─── Directory helpers ────────────────────────────────────────────────────────

export const getDevDatasetsDir = () => path.join(process.cwd(), 'dev', 'datasets');

export const ensureDevDatasetsDir = async () => {
    const dir = getDevDatasetsDir();
    await fs.promises.mkdir(dir, { recursive: true });
    return dir;
};

// ─── Name / ID sanitisation ───────────────────────────────────────────────────

export const sanitizeDevDatasetId = (id: string) => id.replace(/[^a-zA-Z0-9-_]/g, '');
export const sanitizeDevDatasetName = (name: string) => name.replace(/[^a-zA-Z0-9-_ ]/g, '').trim() || 'dataset';
export const getDevDatasetFolderName = (id: string, name: string) =>
    `${id}-${sanitizeDevDatasetName(name).replace(/\s+/g, '-').toLowerCase()}`;
export const getDevDatasetTempFolderName = (folderName: string) => `${DEV_DATASET_TEMP_PREFIX}${folderName}`;
export const isDevDatasetTempFolder = (folderName: string) => folderName.startsWith(DEV_DATASET_TEMP_PREFIX);

// ─── Snapshot normalisation ───────────────────────────────────────────────────

/**
 * Normalise a raw snapshot payload into a well-typed object.
 * `appVersion` should be the running app version (e.g. `app.getVersion()`).
 */
export const normalizeDevDatasetSnapshot = (snapshot: any, appVersion: string) => {
    const state = snapshot && typeof snapshot === 'object' && snapshot.state && typeof snapshot.state === 'object'
        ? snapshot.state
        : {};
    const parsedSchemaVersion = Number(snapshot?.schemaVersion);
    return {
        schemaVersion: Number.isFinite(parsedSchemaVersion) && parsedSchemaVersion > 0
            ? Math.floor(parsedSchemaVersion)
            : DEV_DATASET_SNAPSHOT_SCHEMA_VERSION,
        capturedAt: typeof snapshot?.capturedAt === 'string' ? snapshot.capturedAt : new Date().toISOString(),
        appVersion: typeof snapshot?.appVersion === 'string' ? snapshot.appVersion : appVersion,
        state
    };
};

// ─── Dataset status file ──────────────────────────────────────────────────────

export const writeDevDatasetStatus = async (
    datasetDir: string,
    status: { complete: boolean; createdAt?: string; completedAt?: string; totalLogs?: number }
) => {
    await fs.promises.writeFile(
        path.join(datasetDir, DEV_DATASET_STATUS_FILE),
        JSON.stringify(status, null, 2),
        'utf-8'
    );
};

export const readDevDatasetStatus = async (datasetDir: string) => {
    const statusPath = path.join(datasetDir, DEV_DATASET_STATUS_FILE);
    if (!fs.existsSync(statusPath)) return null;
    const raw = await fs.promises.readFile(statusPath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as { complete?: boolean; createdAt?: string; completedAt?: string; totalLogs?: number };
};

// ─── Log path resolution ──────────────────────────────────────────────────────

export const getDatasetRelativeLogPath = (index: number) => `logs/log-${index + 1}.json`;

export const normalizeDatasetRelativePath = (value: string) => value.replace(/\\/g, '/');

export const resolveDatasetLogPath = (datasetDir: string, logsDir: string, value: string): string | null => {
    if (!value || typeof value !== 'string') return null;
    const normalizedRaw = normalizeDatasetRelativePath(value);
    const candidate = path.isAbsolute(normalizedRaw)
        ? normalizedRaw
        : path.join(datasetDir, normalizedRaw);
    const normalizedCandidate = path.normalize(candidate);
    const normalizedLogsDir = path.normalize(logsDir + path.sep);
    if (!normalizedCandidate.startsWith(normalizedLogsDir)) return null;
    return normalizedCandidate;
};

export const resolveOrderedDatasetLogPaths = async (
    datasetDir: string,
    logsDir: string,
    manifest: any,
    snapshot: any
) => {
    const names = (await fs.promises.readdir(logsDir))
        .filter((name) => name.endsWith('.json'))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const fallbackPaths = names.map((name) => path.join(logsDir, name));
    const seen = new Set<string>();
    const ordered: string[] = [];
    const addPath = (candidate: string | null) => {
        if (!candidate) return;
        if (!fs.existsSync(candidate)) return;
        if (seen.has(candidate)) return;
        seen.add(candidate);
        ordered.push(candidate);
    };

    const snapshotOrderRaw = snapshot?.state?.datasetLogOrder;
    if (Array.isArray(snapshotOrderRaw)) {
        snapshotOrderRaw.forEach((entry: any) => {
            if (typeof entry !== 'string') return;
            addPath(resolveDatasetLogPath(datasetDir, logsDir, entry));
        });
    }

    const manifestOrderRaw = manifest?.logs;
    if (Array.isArray(manifestOrderRaw)) {
        manifestOrderRaw.forEach((entry: any) => {
            if (!entry || typeof entry !== 'object') return;
            if (typeof entry.filePath !== 'string') return;
            addPath(resolveDatasetLogPath(datasetDir, logsDir, entry.filePath));
        });
    }

    fallbackPaths.forEach((filePath) => addPath(filePath));
    return ordered;
};

// ─── Integrity helpers ────────────────────────────────────────────────────────

export const buildDatasetIntegrity = async (datasetDir: string) => {
    const logsDir = path.join(datasetDir, 'logs');
    const manifestPath = path.join(datasetDir, 'manifest.json');
    const reportPath = path.join(datasetDir, 'report.json');
    const snapshotPath = path.join(datasetDir, 'snapshot.json');
    const manifest = fs.existsSync(manifestPath)
        ? JSON.parse(await fs.promises.readFile(manifestPath, 'utf-8'))
        : null;
    const snapshot = fs.existsSync(snapshotPath)
        ? JSON.parse(await fs.promises.readFile(snapshotPath, 'utf-8'))
        : null;
    const logPaths = await resolveOrderedDatasetLogPaths(datasetDir, logsDir, manifest, snapshot);
    const logs = [];
    for (let i = 0; i < logPaths.length; i += 1) {
        const absolute = logPaths[i];
        const relative = path.relative(datasetDir, absolute).replace(/\\/g, '/');
        logs.push({
            path: relative,
            sha256: await computeFileHash(absolute)
        });
    }
    return {
        schemaVersion: DEV_DATASET_INTEGRITY_SCHEMA_VERSION,
        generatedAt: new Date().toISOString(),
        snapshotSchemaVersion: Number.isFinite(Number(snapshot?.schemaVersion)) ? Number(snapshot?.schemaVersion) : null,
        files: {
            manifest: { path: 'manifest.json', sha256: await computeFileHash(manifestPath) },
            report: { path: 'report.json', sha256: await computeFileHash(reportPath) },
            snapshot: { path: 'snapshot.json', sha256: await computeFileHash(snapshotPath) },
            logs
        }
    };
};

export const validateDatasetIntegrity = async (datasetDir: string) => {
    const issues: string[] = [];
    const integrityPath = path.join(datasetDir, DEV_DATASET_INTEGRITY_FILE);
    const snapshotPath = path.join(datasetDir, 'snapshot.json');
    let snapshotSchemaVersion: number | null = null;
    try {
        if (fs.existsSync(snapshotPath)) {
            const snapshot = JSON.parse(await fs.promises.readFile(snapshotPath, 'utf-8'));
            const schemaVersion = Number(snapshot?.schemaVersion);
            if (Number.isFinite(schemaVersion)) {
                snapshotSchemaVersion = Math.floor(schemaVersion);
                if (snapshotSchemaVersion > DEV_DATASET_SNAPSHOT_SCHEMA_VERSION) {
                    issues.push(`Unsupported snapshot schema version ${snapshotSchemaVersion}.`);
                }
            }
        }
    } catch (err: any) {
        issues.push(`Failed to read snapshot.json: ${err?.message || err}`);
    }

    if (!fs.existsSync(integrityPath)) {
        return { ok: issues.length === 0, issues, hasIntegrityFile: false, snapshotSchemaVersion };
    }

    let integrity: any = null;
    try {
        integrity = JSON.parse(await fs.promises.readFile(integrityPath, 'utf-8'));
    } catch (err: any) {
        issues.push(`Failed to read integrity.json: ${err?.message || err}`);
        return { ok: false, issues, hasIntegrityFile: true, snapshotSchemaVersion };
    }

    const schemaVersion = Number(integrity?.schemaVersion);
    if (!Number.isFinite(schemaVersion) || schemaVersion !== DEV_DATASET_INTEGRITY_SCHEMA_VERSION) {
        issues.push('Unsupported integrity schema version.');
    }

    const files = integrity?.files || {};
    const verifyFile = async (entry: any, label: string) => {
        if (!entry || typeof entry !== 'object' || typeof entry.path !== 'string' || typeof entry.sha256 !== 'string') {
            issues.push(`Missing checksum entry for ${label}.`);
            return;
        }
        const filePath = path.join(datasetDir, entry.path);
        if (!fs.existsSync(filePath)) {
            issues.push(`Missing file for ${label}: ${entry.path}`);
            return;
        }
        const checksum = await computeFileHash(filePath);
        if (checksum !== entry.sha256) {
            issues.push(`Checksum mismatch for ${entry.path}`);
        }
    };

    await verifyFile(files.manifest, 'manifest');
    await verifyFile(files.report, 'report');
    await verifyFile(files.snapshot, 'snapshot');

    const logEntries = Array.isArray(files.logs) ? files.logs : [];
    if (logEntries.length === 0) {
        issues.push('Missing log checksum entries.');
    } else {
        for (let i = 0; i < logEntries.length; i += 1) {
            const entry = logEntries[i];
            await verifyFile(entry, `log #${i + 1}`);
        }
    }

    return { ok: issues.length === 0, issues, hasIntegrityFile: true, snapshotSchemaVersion };
};

// ─── Concurrent file I/O helpers ──────────────────────────────────────────────

export const readJsonFilesWithLimit = async <T = any>(paths: string[], limit = 8): Promise<T[]> => {
    const results: T[] = new Array(paths.length);
    let index = 0;

    const worker = async () => {
        while (index < paths.length) {
            const current = index;
            index += 1;
            const raw = await fs.promises.readFile(paths[current], 'utf-8');
            results[current] = JSON.parse(raw) as T;
        }
    };

    const workers = Array.from({ length: Math.min(limit, paths.length) }, () => worker());
    await Promise.all(workers);
    return results;
};

export const writeJsonFilesWithLimit = async (
    entries: Array<{ path: string; data: any }>,
    limit = 8,
    onProgress?: (written: number, total: number) => void
) => {
    let index = 0;
    let written = 0;
    const total = entries.length;

    const worker = async () => {
        while (index < entries.length) {
            const current = index;
            index += 1;
            const entry = entries[current];
            await fs.promises.writeFile(entry.path, JSON.stringify(entry.data), 'utf-8');
            written += 1;
            onProgress?.(written, total);
        }
    };

    const workers = Array.from({ length: Math.min(limit, entries.length) }, () => worker());
    await Promise.all(workers);
};
