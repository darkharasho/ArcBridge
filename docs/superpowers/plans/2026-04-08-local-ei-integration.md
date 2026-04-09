# Local Elite Insights Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run Elite Insights locally as the primary JSON source for combat log parsing, with dps.report used in parallel for permalinks only.

**Architecture:** New `src/main/eiParser.ts` module manages EI binary download, .NET runtime, config generation, and child process spawning. The existing upload pipeline is modified so that local EI parse is the primary data source and dps.report upload happens in parallel for the permalink. A new `src/main/handlers/eiHandlers.ts` registers IPC handlers for the renderer.

**Tech Stack:** Node `child_process.spawn`, `adm-zip` (already in deps), `zlib` (built-in), `electron-store` for settings, GitHub Releases API for EI downloads.

**Spec:** `docs/superpowers/specs/2026-04-08-local-ei-integration-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/main/eiParser.ts` | EI binary management (download, update, version tracking), .NET runtime management, config file generation, child process spawning, output reading |
| `src/main/handlers/eiHandlers.ts` | IPC handler registration for EI status, install, update, settings, retry |
| `src/main/__tests__/eiParser.test.ts` | Unit tests for config generation, version comparison, path resolution |

### Modified Files
| File | Changes |
|------|---------|
| `src/main/index.ts` | Import and register EI handlers; modify `processLogFile` to run EI parse + dps.report upload in parallel; add EI parse orchestration |
| `src/main/uploader.ts` | Add option to skip `fetchDetailedJson` when local EI JSON is available |
| `src/preload/index.ts` | Expose EI IPC methods to renderer |
| `src/renderer/global.d.ts` | Add EI settings types, EI status type, extend `IElectronAPI`, add `'parsing'` to log status |
| `src/renderer/ExpandableLogCard.tsx` | Handle `'parsing'` status state |
| `src/renderer/SettingsView.tsx` | Add Parser Settings section |

---

## Task 1: Types and EI Config Foundation

**Files:**
- Modify: `src/renderer/global.d.ts`
- Create: `src/main/eiParser.ts` (partial — config generation only)
- Create: `src/main/__tests__/eiParser.test.ts`

- [ ] **Step 1: Add EI types to global.d.ts**

Add the following types after the existing `DetailsStatus` type definition around line 364:

```typescript
interface IEiParserSettings {
    detailledWvW: boolean;
    computeDamageModifiers: boolean;
    parsePhases: boolean;
    skipFailedTries: boolean;
    anonymous: boolean;
    customTooShort: number;
    saveOutHTML: boolean;
    parseCombatReplay: boolean;
    lightTheme: boolean;
    rawTimelineArrays: boolean;
    singleThreaded: boolean;
    memoryLimit: number;
}

interface IEiStatus {
    installed: boolean;
    version: string | null;
    updateAvailable: string | null;
    installing: boolean;
    error: string | null;
}
```

Add `'parsing'` to the `ILogData.status` union type:

```typescript
status?: 'queued' | 'pending' | 'uploading' | 'retrying' | 'discord' | 'calculating' | 'parsing' | 'success' | 'error';
```

Add EI methods to the `IElectronAPI` interface:

```typescript
getEiStatus: () => Promise<IEiStatus>;
installEi: () => Promise<void>;
updateEi: () => Promise<void>;
reinstallEi: () => Promise<void>;
checkEiUpdate: () => Promise<{ updateAvailable: string | null }>;
getEiSettings: () => Promise<IEiParserSettings>;
saveEiSettings: (settings: Partial<IEiParserSettings>) => void;
onEiDownloadProgress: (callback: (data: { percent: number; message: string }) => void) => () => void;
onEiParseProgress: (callback: (data: { logId: string; message: string }) => void) => () => void;
```

- [ ] **Step 2: Write tests for config generation**

Create `src/main/__tests__/eiParser.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { generateEiConf, DEFAULT_EI_SETTINGS } from '../eiParser';

describe('generateEiConf', () => {
    it('generates valid conf with default settings', () => {
        const conf = generateEiConf(DEFAULT_EI_SETTINGS, '/tmp/ei-output');
        expect(conf).toContain('SaveOutJSON=True');
        expect(conf).toContain('SaveOutHTML=False');
        expect(conf).toContain('DetailledWvW=True');
        expect(conf).toContain('OutLocation=/tmp/ei-output');
        expect(conf).toContain('CompressRaw=True');
        expect(conf).toContain('UploadToDPSReports=False');
        expect(conf).toContain('UploadToWingman=False');
        expect(conf).toContain('SaveAtOut=False');
    });

    it('reflects custom settings', () => {
        const settings = { ...DEFAULT_EI_SETTINGS, detailledWvW: false, saveOutHTML: true, memoryLimit: 4096 };
        const conf = generateEiConf(settings, '/tmp/out');
        expect(conf).toContain('DetailledWvW=False');
        expect(conf).toContain('SaveOutHTML=True');
        expect(conf).toContain('MemoryLimit=4096');
    });

    it('uses SaveAtOut=False and custom OutLocation', () => {
        const conf = generateEiConf(DEFAULT_EI_SETTINGS, '/my/output/dir');
        expect(conf).toContain('SaveAtOut=False');
        expect(conf).toContain('OutLocation=/my/output/dir');
    });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/main/__tests__/eiParser.test.ts`
Expected: FAIL — `generateEiConf` and `DEFAULT_EI_SETTINGS` not found.

- [ ] **Step 4: Implement config generation in eiParser.ts**

Create `src/main/eiParser.ts`:

```typescript
import path from 'path';
import fs from 'fs';

export interface EiParserSettings {
    detailledWvW: boolean;
    computeDamageModifiers: boolean;
    parsePhases: boolean;
    skipFailedTries: boolean;
    anonymous: boolean;
    customTooShort: number;
    saveOutHTML: boolean;
    parseCombatReplay: boolean;
    lightTheme: boolean;
    rawTimelineArrays: boolean;
    singleThreaded: boolean;
    memoryLimit: number;
}

export const DEFAULT_EI_SETTINGS: EiParserSettings = {
    detailledWvW: true,
    computeDamageModifiers: true,
    parsePhases: true,
    skipFailedTries: false,
    anonymous: false,
    customTooShort: 2200,
    saveOutHTML: false,
    parseCombatReplay: false,
    lightTheme: false,
    rawTimelineArrays: true,
    singleThreaded: false,
    memoryLimit: 0,
};

function boolToConf(val: boolean): string {
    return val ? 'True' : 'False';
}

export function generateEiConf(settings: EiParserSettings, outLocation: string): string {
    const lines: string[] = [
        `SaveOutJSON=True`,
        `SaveOutHTML=${boolToConf(settings.saveOutHTML)}`,
        `SaveOutCSV=False`,
        `SaveOutTrace=False`,
        `CompressRaw=True`,
        `SaveAtOut=False`,
        `OutLocation=${outLocation}`,
        `DetailledWvW=${boolToConf(settings.detailledWvW)}`,
        `RawTimelineArrays=${boolToConf(settings.rawTimelineArrays)}`,
        `ComputeDamageModifiers=${boolToConf(settings.computeDamageModifiers)}`,
        `ParseCombatReplay=${boolToConf(settings.parseCombatReplay)}`,
        `ParsePhases=${boolToConf(settings.parsePhases)}`,
        `SingleThreaded=${boolToConf(settings.singleThreaded)}`,
        `SkipFailedTries=${boolToConf(settings.skipFailedTries)}`,
        `Anonymous=${boolToConf(settings.anonymous)}`,
        `ParseMultipleLogs=False`,
        `UploadToDPSReports=False`,
        `UploadToWingman=False`,
        `IndentJSON=False`,
        `MemoryLimit=${settings.memoryLimit}`,
        `CustomTooShort=${settings.customTooShort}`,
        `LightTheme=${boolToConf(settings.lightTheme)}`,
        `HtmlExternalScripts=False`,
    ];
    return lines.join('\n') + '\n';
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/main/__tests__/eiParser.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/main/eiParser.ts src/main/__tests__/eiParser.test.ts src/renderer/global.d.ts
git commit -m "feat: add EI parser types and config generation"
```

---

## Task 2: EI Download & Version Management

**Files:**
- Modify: `src/main/eiParser.ts`
- Modify: `src/main/__tests__/eiParser.test.ts`

- [ ] **Step 1: Add version comparison test**

Add to `src/main/__tests__/eiParser.test.ts`:

```typescript
import { isNewerVersion } from '../eiParser';

describe('isNewerVersion', () => {
    it('detects newer version', () => {
        expect(isNewerVersion('v3.20.0.0', 'v3.21.0.0')).toBe(true);
    });

    it('returns false for same version', () => {
        expect(isNewerVersion('v3.20.0.0', 'v3.20.0.0')).toBe(false);
    });

    it('returns false for older version', () => {
        expect(isNewerVersion('v3.21.0.0', 'v3.20.0.0')).toBe(false);
    });

    it('handles missing v prefix', () => {
        expect(isNewerVersion('3.20.0.0', '3.21.0.0')).toBe(true);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/main/__tests__/eiParser.test.ts`
Expected: FAIL — `isNewerVersion` not found.

- [ ] **Step 3: Implement version comparison**

Add to `src/main/eiParser.ts`:

```typescript
export function isNewerVersion(current: string, candidate: string): boolean {
    const parse = (v: string) => v.replace(/^v/i, '').split('.').map(Number);
    const cur = parse(current);
    const cand = parse(candidate);
    for (let i = 0; i < Math.max(cur.length, cand.length); i++) {
        const a = cur[i] || 0;
        const b = cand[i] || 0;
        if (b > a) return true;
        if (b < a) return false;
    }
    return false;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/main/__tests__/eiParser.test.ts`
Expected: PASS

- [ ] **Step 5: Implement the EiManager class**

Add to `src/main/eiParser.ts`. This is the core class that manages EI installation, updates, and parsing:

```typescript
import { spawn, ChildProcess } from 'child_process';
import https from 'https';
import http from 'http';
import os from 'os';
import zlib from 'zlib';
import AdmZip from 'adm-zip';

interface VersionInfo {
    cli: string | null;
    dotnet: string | null;
    lastChecked: number;
}

export class EiManager {
    private baseDir: string;
    private cliDir: string;
    private dotnetDir: string;
    private versionsFile: string;
    private confFile: string;
    private activeProcess: ChildProcess | null = null;
    private settings: EiParserSettings;
    private onProgress: ((data: { percent: number; message: string }) => void) | null = null;
    private onParseProgress: ((data: { logId: string; message: string }) => void) | null = null;

    constructor(userDataPath: string) {
        this.baseDir = path.join(userDataPath, 'elite-insights');
        this.cliDir = path.join(this.baseDir, 'eicli');
        this.dotnetDir = path.join(this.baseDir, 'dotnet_native');
        this.versionsFile = path.join(this.baseDir, 'versions.json');
        this.confFile = path.join(this.baseDir, 'settings.conf');
        this.settings = { ...DEFAULT_EI_SETTINGS };
    }

    public setProgressCallback(cb: (data: { percent: number; message: string }) => void) {
        this.onProgress = cb;
    }

    public setParseProgressCallback(cb: (data: { logId: string; message: string }) => void) {
        this.onParseProgress = cb;
    }

    public setSettings(settings: EiParserSettings) {
        this.settings = { ...settings };
    }

    public getSettings(): EiParserSettings {
        return { ...this.settings };
    }

    private ensureDir(dir: string) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    private readVersions(): VersionInfo {
        try {
            if (fs.existsSync(this.versionsFile)) {
                return JSON.parse(fs.readFileSync(this.versionsFile, 'utf-8'));
            }
        } catch { /* ignore */ }
        return { cli: null, dotnet: null, lastChecked: 0 };
    }

    private writeVersions(versions: VersionInfo) {
        this.ensureDir(this.baseDir);
        fs.writeFileSync(this.versionsFile, JSON.stringify(versions, null, 2));
    }

    public isInstalled(): boolean {
        const versions = this.readVersions();
        if (!versions.cli) return false;
        if (process.platform === 'win32') {
            return fs.existsSync(path.join(this.cliDir, 'GuildWars2EliteInsights-CLI.exe'));
        }
        return fs.existsSync(path.join(this.cliDir, 'GuildWars2EliteInsights-CLI.dll'));
    }

    public getStatus(): { installed: boolean; version: string | null; updateAvailable: string | null } {
        const versions = this.readVersions();
        return {
            installed: this.isInstalled(),
            version: versions.cli,
            updateAvailable: null, // Set by checkForUpdate
        };
    }

    // Download a file to disk with progress reporting
    private downloadFile(url: string, dest: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(dest);
            const protocol = url.startsWith('https') ? https : http;
            const request = (protocol as typeof https).get(url, { headers: { 'User-Agent': 'AxiBridge' } }, (response) => {
                // Follow redirects
                if (response.statusCode === 301 || response.statusCode === 302) {
                    file.close();
                    fs.unlinkSync(dest);
                    return this.downloadFile(response.headers.location!, dest).then(resolve, reject);
                }
                if (response.statusCode !== 200) {
                    file.close();
                    fs.unlinkSync(dest);
                    return reject(new Error(`HTTP ${response.statusCode}`));
                }
                const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
                let downloaded = 0;
                response.on('data', (chunk: Buffer) => {
                    downloaded += chunk.length;
                    if (totalBytes > 0) {
                        this.onProgress?.({ percent: Math.round((downloaded / totalBytes) * 100), message: 'Downloading...' });
                    }
                });
                response.pipe(file);
                file.on('finish', () => { file.close(); resolve(); });
            });
            request.on('error', (err) => { file.close(); fs.unlinkSync(dest); reject(err); });
        });
    }

    // Fetch latest release info from GitHub
    public async checkForUpdate(): Promise<string | null> {
        const versions = this.readVersions();
        return new Promise((resolve, reject) => {
            https.get('https://api.github.com/repos/baaron4/GW2-Elite-Insights-Parser/releases/latest', {
                headers: { 'User-Agent': 'AxiBridge', 'Accept': 'application/vnd.github.v3+json' }
            }, (res) => {
                let data = '';
                res.on('data', (chunk: string) => { data += chunk; });
                res.on('end', () => {
                    try {
                        const release = JSON.parse(data);
                        const latestTag = release.tag_name || release.name || '';
                        versions.lastChecked = Date.now();
                        this.writeVersions(versions);
                        if (versions.cli && isNewerVersion(versions.cli, latestTag)) {
                            resolve(latestTag);
                        } else {
                            resolve(null);
                        }
                    } catch (e) { reject(e); }
                });
            }).on('error', reject);
        });
    }

    // Download and extract EI CLI
    public async installCli(): Promise<void> {
        this.ensureDir(this.baseDir);
        this.onProgress?.({ percent: 0, message: 'Fetching release info...' });

        // Get latest release
        const release: any = await new Promise((resolve, reject) => {
            https.get('https://api.github.com/repos/baaron4/GW2-Elite-Insights-Parser/releases/latest', {
                headers: { 'User-Agent': 'AxiBridge', 'Accept': 'application/vnd.github.v3+json' }
            }, (res) => {
                let data = '';
                res.on('data', (chunk: string) => { data += chunk; });
                res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
            }).on('error', reject);
        });

        const asset = release.assets?.find((a: any) => a.name === 'GW2EICLI.zip');
        if (!asset) throw new Error('GW2EICLI.zip asset not found in latest release');

        // Download zip
        const zipPath = path.join(this.baseDir, 'GW2EICLI.zip');
        this.onProgress?.({ percent: 5, message: 'Downloading Elite Insights CLI...' });
        await this.downloadFile(asset.browser_download_url, zipPath);

        // Extract
        this.onProgress?.({ percent: 80, message: 'Extracting...' });
        if (fs.existsSync(this.cliDir)) {
            fs.rmSync(this.cliDir, { recursive: true, force: true });
        }
        const zip = new AdmZip(zipPath);
        zip.extractAllTo(this.cliDir, true);
        fs.unlinkSync(zipPath);

        // Update versions
        const versions = this.readVersions();
        versions.cli = release.tag_name || release.name || 'unknown';
        versions.lastChecked = Date.now();
        this.writeVersions(versions);

        this.onProgress?.({ percent: 100, message: 'Elite Insights installed.' });
    }

    // Install .NET runtime on Linux
    public async installDotnetLinux(): Promise<void> {
        if (process.platform === 'win32') return;

        this.ensureDir(this.dotnetDir);
        this.onProgress?.({ percent: 0, message: 'Downloading .NET runtime installer...' });

        // Download dotnet-install.sh
        const scriptPath = path.join(this.baseDir, 'dotnet-install.sh');
        await this.downloadFile('https://dot.net/v1/dotnet-install.sh', scriptPath);
        fs.chmodSync(scriptPath, 0o755);

        // Run installer
        this.onProgress?.({ percent: 30, message: 'Installing .NET 8.0 runtime...' });
        await new Promise<void>((resolve, reject) => {
            const proc = spawn('bash', [
                scriptPath,
                '--channel', '8.0',
                '--runtime', 'dotnet',
                '--install-dir', this.dotnetDir,
            ], { stdio: 'pipe' });

            let stderr = '';
            proc.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
            proc.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`dotnet-install.sh exited with code ${code}: ${stderr}`));
                }
            });
            proc.on('error', reject);
        });

        // Cleanup installer script
        try { fs.unlinkSync(scriptPath); } catch { /* ignore */ }

        // Update versions
        const versions = this.readVersions();
        versions.dotnet = '8.0';
        this.writeVersions(versions);

        this.onProgress?.({ percent: 100, message: '.NET runtime installed.' });
    }

    // Full install: EI CLI + .NET (if Linux)
    public async install(): Promise<void> {
        await this.installCli();
        if (process.platform !== 'win32') {
            await this.installDotnetLinux();
        }
    }

    // Re-download everything
    public async reinstall(): Promise<void> {
        if (fs.existsSync(this.baseDir)) {
            fs.rmSync(this.baseDir, { recursive: true, force: true });
        }
        await this.install();
    }

    // Get the command and args to run EI
    private getCommand(confPath: string, logPath: string): { cmd: string; args: string[] } {
        if (process.platform === 'win32') {
            const exe = path.join(this.cliDir, 'GuildWars2EliteInsights-CLI.exe');
            return { cmd: exe, args: ['-c', confPath, logPath] };
        }
        // Linux: run .dll via native dotnet
        const dotnet = path.join(this.dotnetDir, 'dotnet');
        const dll = path.join(this.cliDir, 'GuildWars2EliteInsights-CLI.dll');
        return { cmd: dotnet, args: [dll, '-c', confPath, logPath] };
    }

    // Parse a single log file, returns the parsed EI JSON
    public async parseLog(logPath: string, logId: string): Promise<any> {
        if (!this.isInstalled()) {
            throw new Error('Elite Insights is not installed');
        }

        // Create temp output dir
        const tempDir = path.join(os.tmpdir(), `axibridge-ei-${Date.now()}`);
        this.ensureDir(tempDir);

        // Write config
        const confPath = path.join(tempDir, 'settings.conf');
        const confContent = generateEiConf(this.settings, tempDir);
        fs.writeFileSync(confPath, confContent);

        try {
            const { cmd, args } = this.getCommand(confPath, logPath);
            console.log(`[EiParser] Running: ${cmd} ${args.join(' ')}`);

            const exitCode = await new Promise<number>((resolve, reject) => {
                const proc = spawn(cmd, args, { cwd: tempDir, stdio: 'pipe' });
                this.activeProcess = proc;

                const timeout = setTimeout(() => {
                    proc.kill();
                    reject(new Error('EI parse timed out after 10 minutes'));
                }, 10 * 60 * 1000);

                proc.stdout?.on('data', (chunk: Buffer) => {
                    const msg = chunk.toString().trim();
                    if (msg) {
                        console.log(`[EiParser] ${msg}`);
                        this.onParseProgress?.({ logId, message: msg });
                    }
                });

                let stderr = '';
                proc.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

                proc.on('close', (code) => {
                    clearTimeout(timeout);
                    this.activeProcess = null;
                    if (code === 0) {
                        resolve(0);
                    } else {
                        reject(new Error(`EI exited with code ${code}: ${stderr.slice(0, 500)}`));
                    }
                });

                proc.on('error', (err) => {
                    clearTimeout(timeout);
                    this.activeProcess = null;
                    reject(err);
                });
            });

            // Find and read the output .json.gz file
            const files = fs.readdirSync(tempDir);
            const jsonGz = files.find(f => f.endsWith('.json.gz'));
            const jsonFile = files.find(f => f.endsWith('.json') && !f.endsWith('.json.gz'));

            let parsed: any = null;

            if (jsonGz) {
                const compressed = fs.readFileSync(path.join(tempDir, jsonGz));
                const decompressed = await new Promise<Buffer>((resolve, reject) => {
                    zlib.gunzip(compressed, (err, result) => {
                        if (err) reject(err);
                        else resolve(result);
                    });
                });
                parsed = JSON.parse(decompressed.toString('utf-8'));
            } else if (jsonFile) {
                const raw = fs.readFileSync(path.join(tempDir, jsonFile), 'utf-8');
                parsed = JSON.parse(raw);
            }

            if (!parsed) {
                throw new Error('EI produced no JSON output');
            }

            return parsed;

        } finally {
            // Cleanup temp dir
            try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
        }
    }

    // Kill any running EI process (for app shutdown)
    public killActiveProcess() {
        if (this.activeProcess) {
            console.log('[EiParser] Killing active process on shutdown');
            this.activeProcess.kill();
            this.activeProcess = null;
        }
    }
}
```

- [ ] **Step 6: Run all tests**

Run: `npx vitest run src/main/__tests__/eiParser.test.ts`
Expected: PASS

- [ ] **Step 7: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/main/eiParser.ts src/main/__tests__/eiParser.test.ts
git commit -m "feat: implement EiManager class with download, install, and parse support"
```

---

## Task 3: IPC Handlers for EI

**Files:**
- Create: `src/main/handlers/eiHandlers.ts`
- Modify: `src/main/index.ts`

- [ ] **Step 1: Create EI handler registration**

Create `src/main/handlers/eiHandlers.ts`:

```typescript
import { ipcMain, BrowserWindow } from 'electron';
import { EiManager, EiParserSettings } from '../eiParser';

interface EiHandlerOptions {
    store: any;
    getWindow: () => BrowserWindow | null;
    getEiManager: () => EiManager;
}

export function registerEiHandlers(opts: EiHandlerOptions) {
    const { store, getWindow, getEiManager } = opts;

    ipcMain.handle('ei:get-status', () => {
        const mgr = getEiManager();
        return {
            ...mgr.getStatus(),
            installing: false,
            error: null,
        };
    });

    ipcMain.handle('ei:install', async () => {
        const mgr = getEiManager();
        const win = getWindow();
        mgr.setProgressCallback((data) => {
            win?.webContents.send('ei:download-progress', data);
        });
        try {
            await mgr.install();
            win?.webContents.send('ei:status-changed', {
                ...mgr.getStatus(),
                installing: false,
                error: null,
            });
        } catch (err: any) {
            win?.webContents.send('ei:status-changed', {
                ...mgr.getStatus(),
                installing: false,
                error: err?.message || 'Install failed',
            });
            throw err;
        }
    });

    ipcMain.handle('ei:update', async () => {
        const mgr = getEiManager();
        const win = getWindow();
        mgr.setProgressCallback((data) => {
            win?.webContents.send('ei:download-progress', data);
        });
        await mgr.installCli();
        win?.webContents.send('ei:status-changed', {
            ...mgr.getStatus(),
            installing: false,
            error: null,
        });
    });

    ipcMain.handle('ei:reinstall', async () => {
        const mgr = getEiManager();
        const win = getWindow();
        mgr.setProgressCallback((data) => {
            win?.webContents.send('ei:download-progress', data);
        });
        await mgr.reinstall();
        win?.webContents.send('ei:status-changed', {
            ...mgr.getStatus(),
            installing: false,
            error: null,
        });
    });

    ipcMain.handle('ei:check-update', async () => {
        const mgr = getEiManager();
        const updateAvailable = await mgr.checkForUpdate();
        return { updateAvailable };
    });

    ipcMain.handle('ei:get-settings', () => {
        const mgr = getEiManager();
        return mgr.getSettings();
    });

    ipcMain.on('ei:save-settings', (_event, settings: Partial<EiParserSettings>) => {
        const mgr = getEiManager();
        const current = mgr.getSettings();
        const merged = { ...current, ...settings };
        mgr.setSettings(merged);
        store.set('eiParserSettings', merged);
    });
}
```

- [ ] **Step 2: Register handlers and create EiManager in index.ts**

In `src/main/index.ts`, add the import near the top with the other handler imports:

```typescript
import { registerEiHandlers } from './handlers/eiHandlers';
import { EiManager, DEFAULT_EI_SETTINGS, EiParserSettings } from './eiParser';
```

After the `uploader` initialization (around line 180), add:

```typescript
const eiManager = new EiManager(app.getPath('userData'));
// Restore saved EI parser settings
const savedEiSettings = store.get('eiParserSettings') as EiParserSettings | undefined;
if (savedEiSettings) {
    eiManager.setSettings({ ...DEFAULT_EI_SETTINGS, ...savedEiSettings });
}
```

In the handler registration block (around line 1370), add:

```typescript
registerEiHandlers({
    store,
    getWindow: () => win,
    getEiManager: () => eiManager,
});
```

Add cleanup on quit — find the existing `app.on('before-quit'` or `app.on('window-all-closed'` handler and add:

```typescript
eiManager.killActiveProcess();
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/main/handlers/eiHandlers.ts src/main/index.ts
git commit -m "feat: register EI IPC handlers and initialize EiManager"
```

---

## Task 4: Expose EI IPC in Preload

**Files:**
- Modify: `src/preload/index.ts`

- [ ] **Step 1: Add EI methods to preload**

In `src/preload/index.ts`, add the following methods to the `electronAPI` object exposed via `contextBridge.exposeInMainWorld`:

```typescript
getEiStatus: () => ipcRenderer.invoke('ei:get-status'),
installEi: () => ipcRenderer.invoke('ei:install'),
updateEi: () => ipcRenderer.invoke('ei:update'),
reinstallEi: () => ipcRenderer.invoke('ei:reinstall'),
checkEiUpdate: () => ipcRenderer.invoke('ei:check-update'),
getEiSettings: () => ipcRenderer.invoke('ei:get-settings'),
saveEiSettings: (settings: any) => ipcRenderer.send('ei:save-settings', settings),
onEiDownloadProgress: (callback: (data: any) => void) => {
    ipcRenderer.on('ei:download-progress', (_event, value) => callback(value));
    return () => { ipcRenderer.removeAllListeners('ei:download-progress'); };
},
onEiParseProgress: (callback: (data: any) => void) => {
    ipcRenderer.on('ei:parse-progress', (_event, value) => callback(value));
    return () => { ipcRenderer.removeAllListeners('ei:parse-progress'); };
},
onEiStatusChanged: (callback: (data: any) => void) => {
    ipcRenderer.on('ei:status-changed', (_event, value) => callback(value));
    return () => { ipcRenderer.removeAllListeners('ei:status-changed'); };
},
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/preload/index.ts
git commit -m "feat: expose EI IPC methods in preload"
```

---

## Task 5: Integrate EI Parsing into Log Processing Pipeline

**Files:**
- Modify: `src/main/index.ts`

This is the core change — modify `processLogFile` to run local EI parse as the primary data source with dps.report upload in parallel.

- [ ] **Step 1: Add EI parse queue**

In `src/main/index.ts`, after the `eiManager` initialization, add a parse queue:

```typescript
let eiParseQueue: { logPath: string; logId: string; resolve: (json: any) => void; reject: (err: any) => void }[] = [];
let eiParseActive = false;

async function processEiQueue() {
    if (eiParseActive || eiParseQueue.length === 0) return;
    eiParseActive = true;
    const task = eiParseQueue.shift()!;
    try {
        const json = await eiManager.parseLog(task.logPath, task.logId);
        task.resolve(json);
    } catch (err) {
        task.reject(err);
    } finally {
        eiParseActive = false;
        processEiQueue();
    }
}

function queueEiParse(logPath: string, logId: string): Promise<any> {
    return new Promise((resolve, reject) => {
        eiParseQueue.push({ logPath, logId, resolve, reject });
        processEiQueue();
    });
}
```

- [ ] **Step 2: Modify processLogFile for parallel EI + dps.report**

Find the section in `processLogFile` where `.zevtc`/`.evtc` files are uploaded to dps.report (after the `.json` local file handling). The current flow is roughly:

1. Send `upload-status` with `status: 'uploading'`
2. Upload to dps.report
3. Fetch detailed JSON from dps.report
4. Process details
5. Send `upload-complete`

Modify this to:

```typescript
// When EI is installed, use local parsing as primary
if (eiManager.isInstalled()) {
    // Send parsing status
    win?.webContents.send('upload-status', {
        id: fileId,
        filePath,
        status: 'parsing',
    });

    // Start both in parallel
    const eiParsePromise = queueEiParse(filePath, fileId);
    const dpsUploadPromise = uploader.upload(filePath);

    // Forward EI parse progress to renderer
    eiManager.setParseProgressCallback((data) => {
        win?.webContents.send('ei:parse-progress', data);
    });

    let eiJson: any = null;
    let dpsResult: UploadResult | null = null;

    try {
        // Wait for EI parse (primary data source)
        eiJson = await eiParsePromise;
    } catch (eiError: any) {
        console.error(`[EiParser] Parse failed for ${fileId}:`, eiError.message);
        // Fall back to dps.report
        win?.webContents.send('upload-status', {
            id: fileId,
            filePath,
            status: 'uploading',
        });
    }

    // Get dps.report result (for permalink) — don't block on it if EI succeeded
    try {
        dpsResult = await dpsUploadPromise;
    } catch (dpsError: any) {
        console.warn(`[Uploader] dps.report upload failed for ${fileId}:`, dpsError.message);
    }

    if (eiJson) {
        // Use local EI JSON
        attachConditionMetrics(eiJson);
        const prunedDetails = pruneDetailsForStats(eiJson);
        const dashboardSummary = buildDashboardSummaryFromDetails(prunedDetails);

        // Continue with existing flow: send upload-complete, handle discord, etc.
        // Use dpsResult?.permalink if available
        win?.webContents.send('upload-complete', {
            id: fileId,
            permalink: dpsResult?.permalink || '',
            filePath,
            fightName: prunedDetails?.fightName || fileId,
            encounterDuration: prunedDetails?.encounterDuration,
            uploadTime: prunedDetails?.uploadTime || Date.now() / 1000,
            status: 'success',
            detailsStatus: 'available',
            dashboardSummary,
        });

        // Send pre-warmed details
        win?.webContents.send('details-prewarm', {
            logId: fileId,
            filePath,
            details: prunedDetails,
        });

        // ... continue with existing discord/cache logic using prunedDetails
    } else if (dpsResult && !dpsResult.error) {
        // EI failed, fall back to dps.report flow
        // ... existing dps.report fetch + processing logic
    } else {
        // Both failed
        win?.webContents.send('upload-complete', {
            id: fileId,
            permalink: '',
            filePath,
            status: 'error',
            error: 'Both local parsing and dps.report upload failed',
            detailsStatus: 'unavailable',
        });
    }
} else {
    // EI not installed — use existing dps.report-only flow unchanged
    // ... existing code
}
```

**Important:** This step requires careful integration with the existing `processLogFile` function. The actual code will need to interleave with the existing caching logic, discord handling, and retry logic. The pattern above shows the core structure — the implementer should wrap the existing dps.report flow in the `else` branch and mirror its post-processing (caching, discord, etc.) in the EI success branch.

- [ ] **Step 3: Skip fetchDetailedJson when local JSON is available**

In `src/main/uploader.ts`, the `fetchDetailedJson` method doesn't need changes — the caller in `index.ts` simply won't call it when EI JSON is available. The only change needed is that the dps.report upload flow in the EI-installed branch should NOT call `fetchDetailedJson`.

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 5: Run existing tests**

Run: `npm run test:unit`
Expected: All existing tests PASS (no behavioral changes to existing code paths)

- [ ] **Step 6: Commit**

```bash
git add src/main/index.ts
git commit -m "feat: integrate local EI parsing into log processing pipeline"
```

---

## Task 6: Log Card Parsing State

**Files:**
- Modify: `src/renderer/ExpandableLogCard.tsx`

- [ ] **Step 1: Add parsing status to ExpandableLogCard**

In `src/renderer/ExpandableLogCard.tsx`, around line 71 where statuses are extracted, add:

```typescript
const isParsing = log.status === 'parsing';
```

Update the `statusLabel` chain (around line 79) to include parsing before uploading:

```typescript
const statusLabel = isQueued ? 'Queued'
    : isPending ? 'Pending'
        : isParsing ? 'Parsing log locally'
            : isUploading ? 'Parsing with dps.report'
                : isRetrying ? 'Retrying upload'
                    : isCalculating ? 'Calculating statistics'
                        : isDiscord ? 'Preparing Discord preview'
                            : null;
```

Update the `statusKey` chain similarly:

```typescript
const statusKey = isQueued ? 'queued'
    : isPending ? 'pending'
        : isParsing ? 'parsing'
            : isUploading ? 'uploading'
                : isRetrying ? 'retrying'
                    : isCalculating ? 'calculating'
                        : isDiscord ? 'discord'
                            : hasError ? 'error'
                                : 'success';
```

Update the `isCancellable` check to include `isParsing`:

```typescript
const isCancellable = Boolean(detailsNotReady && !isExpanded && onCancel && (isQueued || isPending || isUploading || isParsing || isRetrying));
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Run existing ExpandableLogCard tests**

Run: `npx vitest run src/renderer/__tests__/ExpandableLogCard`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/renderer/ExpandableLogCard.tsx
git commit -m "feat: add 'Parsing log locally' status to log cards"
```

---

## Task 7: Parser Settings UI

**Files:**
- Modify: `src/renderer/SettingsView.tsx`

- [ ] **Step 1: Add EI settings state and load/save logic**

In `SettingsView.tsx`, add state for EI settings near the other state declarations:

```typescript
const [eiStatus, setEiStatus] = useState<IEiStatus>({ installed: false, version: null, updateAvailable: null, installing: false, error: null });
const [eiSettings, setEiSettings] = useState<IEiParserSettings | null>(null);
const [eiDownloadProgress, setEiDownloadProgress] = useState<{ percent: number; message: string } | null>(null);
```

In the existing `useEffect` that loads settings on mount, add:

```typescript
window.electronAPI.getEiStatus().then(setEiStatus);
window.electronAPI.getEiSettings().then(setEiSettings);

const unsubProgress = window.electronAPI.onEiDownloadProgress(setEiDownloadProgress);
const unsubStatus = window.electronAPI.onEiStatusChanged((status) => {
    setEiStatus(status);
    setEiDownloadProgress(null);
});

// In cleanup return:
return () => {
    unsubProgress();
    unsubStatus();
    // ... existing cleanup
};
```

Add a save helper:

```typescript
const saveEiSetting = (key: keyof IEiParserSettings, value: any) => {
    if (!eiSettings) return;
    const updated = { ...eiSettings, [key]: value };
    setEiSettings(updated);
    window.electronAPI.saveEiSettings({ [key]: value });
};
```

- [ ] **Step 2: Add Parser Settings section JSX**

Add the following section to the SettingsView render, after the existing sections. Follow the existing section pattern used in the file (headings, toggle rows, etc.):

```tsx
{/* Parser Settings */}
<h2 className="text-lg font-semibold mt-6 mb-3">Parser Settings</h2>

{/* EI Status Header */}
<div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-white/5">
    <div className="flex-1">
        <div className="text-sm font-medium">
            {eiStatus.installed
                ? `Elite Insights ${eiStatus.version || ''} installed`
                : 'Elite Insights not installed'}
        </div>
        {eiStatus.updateAvailable && (
            <div className="text-xs text-yellow-400 mt-1">
                Update available: {eiStatus.updateAvailable}
            </div>
        )}
        {eiStatus.error && (
            <div className="text-xs text-red-400 mt-1">{eiStatus.error}</div>
        )}
        {eiDownloadProgress && (
            <div className="text-xs text-blue-400 mt-1">
                {eiDownloadProgress.message} ({eiDownloadProgress.percent}%)
            </div>
        )}
    </div>
    <div className="flex gap-2">
        {!eiStatus.installed && (
            <button
                className="px-3 py-1 text-xs rounded bg-blue-600 hover:bg-blue-500"
                onClick={() => window.electronAPI.installEi()}
                disabled={eiStatus.installing}
            >
                Install
            </button>
        )}
        {eiStatus.installed && eiStatus.updateAvailable && (
            <button
                className="px-3 py-1 text-xs rounded bg-blue-600 hover:bg-blue-500"
                onClick={() => window.electronAPI.updateEi()}
            >
                Update
            </button>
        )}
        {eiStatus.installed && (
            <>
                <button
                    className="px-3 py-1 text-xs rounded bg-white/10 hover:bg-white/20"
                    onClick={async () => {
                        const result = await window.electronAPI.checkEiUpdate();
                        if (result.updateAvailable) {
                            setEiStatus(prev => ({ ...prev, updateAvailable: result.updateAvailable }));
                        }
                    }}
                >
                    Check for Updates
                </button>
                <button
                    className="px-3 py-1 text-xs rounded bg-white/10 hover:bg-white/20"
                    onClick={() => window.electronAPI.reinstallEi()}
                >
                    Reinstall
                </button>
            </>
        )}
    </div>
</div>

{/* Parser Options — only show when EI settings are loaded */}
{eiSettings && (
    <>
        <h3 className="text-sm font-medium mt-4 mb-2 text-white/60">Analysis</h3>
        <div className="space-y-2">
            <ToggleRow label="Detailed WvW Parse" checked={eiSettings.detailledWvW} onChange={(v) => saveEiSetting('detailledWvW', v)} />
            <ToggleRow label="Compute Damage Modifiers" checked={eiSettings.computeDamageModifiers} onChange={(v) => saveEiSetting('computeDamageModifiers', v)} />
            <ToggleRow label="Parse Phases" checked={eiSettings.parsePhases} onChange={(v) => saveEiSetting('parsePhases', v)} />
            <ToggleRow label="Skip Failed Tries" checked={eiSettings.skipFailedTries} onChange={(v) => saveEiSetting('skipFailedTries', v)} />
            <ToggleRow label="Anonymize Players" checked={eiSettings.anonymous} onChange={(v) => saveEiSetting('anonymous', v)} />
            <NumberRow label="Min Combat Duration (ms)" value={eiSettings.customTooShort} onChange={(v) => saveEiSetting('customTooShort', v)} />
        </div>

        <h3 className="text-sm font-medium mt-4 mb-2 text-white/60">Output</h3>
        <div className="space-y-2">
            <ToggleRow label="Generate HTML Report" checked={eiSettings.saveOutHTML} onChange={(v) => saveEiSetting('saveOutHTML', v)} />
            <ToggleRow label="Combat Replay (in HTML)" checked={eiSettings.parseCombatReplay} onChange={(v) => saveEiSetting('parseCombatReplay', v)} />
            <ToggleRow label="Light Theme (HTML)" checked={eiSettings.lightTheme} onChange={(v) => saveEiSetting('lightTheme', v)} />
            <ToggleRow label="Include Timeline Arrays" checked={eiSettings.rawTimelineArrays} onChange={(v) => saveEiSetting('rawTimelineArrays', v)} />
        </div>

        <h3 className="text-sm font-medium mt-4 mb-2 text-white/60">Performance</h3>
        <div className="space-y-2">
            <ToggleRow label="Single Threaded" checked={eiSettings.singleThreaded} onChange={(v) => saveEiSetting('singleThreaded', v)} />
            <NumberRow label="Memory Limit (MB, 0 = auto)" value={eiSettings.memoryLimit} onChange={(v) => saveEiSetting('memoryLimit', v)} />
        </div>
    </>
)}
```

**Note:** `ToggleRow` and `NumberRow` should follow whatever toggle/input component pattern already exists in SettingsView. The implementer should check the existing components used (they may be inline styled divs with input elements) and match that pattern. If no `NumberRow` component exists, create a simple inline one following the toggle pattern.

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/renderer/SettingsView.tsx
git commit -m "feat: add Parser Settings section with EI management and config UI"
```

---

## Task 8: Sync Metrics Spec & Final Validation

**Files:**
- Modify: `src/shared/metrics-spec.md` (already updated earlier in the session)

- [ ] **Step 1: Sync metrics spec**

Run: `npm run sync:metrics-spec`

- [ ] **Step 2: Run full typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Run full test suite**

Run: `npm run test:unit`
Expected: All tests PASS

- [ ] **Step 4: Run lint**

Run: `npm run lint`
Expected: PASS (or fix any issues)

- [ ] **Step 5: Commit any remaining changes**

```bash
git add -A
git commit -m "chore: sync metrics spec and validate build"
```

---

## Task 9: Manual Integration Test

This task validates the full flow end-to-end.

- [ ] **Step 1: Start dev environment**

Run: `npm run dev`

- [ ] **Step 2: Navigate to Settings, install EI**

Go to Settings → Parser Settings. Click "Install". Verify:
- Progress bar shows during download
- Status changes to "Elite Insights vX.X.X installed" when done
- On Linux: confirm .NET runtime also installed

- [ ] **Step 3: Process a WvW log**

Trigger a log upload (either via watcher or manual upload). Verify:
- Log card shows "Parsing log locally" status
- After completion, stats are available
- dps.report permalink appears (may arrive slightly after stats)
- `downContribution` values are non-zero for most players

- [ ] **Step 4: Verify detailed WvW**

In the browser console or by checking the cached details, verify that `detailedWvW` is `true` in the parsed JSON. Check that the targets array contains individual enemy players (not just "Enemy Players").

- [ ] **Step 5: Test error cases**

- Kill the app while EI is parsing — verify clean shutdown
- Temporarily rename the EI binary — verify fallback to dps.report with appropriate error message
- Toggle EI settings and verify the `.conf` file is regenerated on next parse
