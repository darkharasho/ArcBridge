# Local Elite Insights Integration — Design Spec

**Date:** 2026-04-08
**Problem:** dps.report silently downgrades `detailedwvw=true` to `false` for WvW logs whose uncompressed EVTC data exceeds 50MB. This causes EI's `downContribution` field (and other detailed metrics) to be 0 or unreliable for most large WvW fights. arcdps computes correct values from raw combat data, but EI can't reconstruct them without detailed parsing.

**Solution:** Run Elite Insights locally as the primary JSON source. dps.report is used in parallel solely for permalinks. Local EI always parses with `DetailledWvW=True` and has no file size restriction.

---

## Architecture Overview

```
Log detected by watcher
  ├─ EI Parser (local, primary) ─────→ JSON data → stats pipeline
  └─ dps.report upload (parallel) ───→ permalink only
```

New module: `src/main/eiParser.ts` — manages EI binary, .NET runtime, config generation, and child process spawning.

The existing `Uploader` class continues to handle dps.report uploads unchanged. The main process orchestrates both in parallel, with the log card blocked on EI completion (not dps.report).

---

## EI Download & .NET Runtime

### What Gets Downloaded

Two dependencies, managed in `{userData}/elite-insights/`:

1. **EI CLI** — `GW2EICLI.zip` from `https://api.github.com/repos/baaron4/GW2-Elite-Insights-Parser/releases/latest`. Extracted to `{userData}/elite-insights/eicli/`. Framework-dependent (not self-contained).

2. **.NET 8.0 Runtime (Linux only)** — Downloaded via `https://dot.net/v1/dotnet-install.sh`, installed to `{userData}/elite-insights/dotnet_native/`. Windows ships with .NET or EI's exe handles it natively.

Version tracking: `{userData}/elite-insights/versions.json`:
```json
{
  "cli": "v3.20.0.0",
  "dotnet": "8.0",
  "lastChecked": 1712600000
}
```

### Platform-Specific Execution

**Linux:**
```
{dotnetPath} {eicliDir}/GuildWars2EliteInsights-CLI.dll -c {confPath} {logPath}
```
The `.dll` is invoked via the native `dotnet` binary. Linux paths used directly. `OutLocation` set to a temp directory (not empty string — empty causes crashes on Linux per TopStatsAIO findings).

**Windows:**
```
{eicliDir}/GuildWars2EliteInsights-CLI.exe -c {confPath} {logPath}
```
Direct exe execution. .NET 8.0 Desktop Runtime is required — if not already installed, prompt the user to download it from Microsoft (link to the official installer). Unlike Linux, we don't auto-install .NET on Windows since the official installer handles dependencies and PATH registration correctly.

### First-Run Flow

When a log is detected and EI is not installed:
1. Show prompt: "AxiBridge needs Elite Insights to parse combat logs. Download now? (~100MB)"
2. Download EI CLI from GitHub releases (find asset named `GW2EICLI.zip`)
3. On Linux: download and install .NET 8.0 runtime via `dotnet-install.sh`
4. Extract EI to `{userData}/elite-insights/eicli/`
5. On Linux: `chmod +x` the dotnet binary
6. Write `versions.json`
7. Progress bar shown during download/extraction

### Update Checks

On app launch, check GitHub releases API (with ETag caching to avoid rate limits). If a newer tag exists than `versions.json.cli`, show a non-blocking notification in Settings: "EI update available: v3.20 → v3.21". User triggers update manually via button.

### Failure Handling

If download fails (no internet, GitHub API down):
- Fall back to dps.report-only mode
- Show persistent warning: "Elite Insights not installed — some metrics may be inaccurate for large WvW logs"
- Retry download available in Settings

---

## Log Processing Pipeline

### New Flow

```
Log detected
  ├─ Queue for EI parse (max 1 concurrent)
  └─ Queue for dps.report upload (max 3 concurrent, existing behavior)

EI parse:
  1. Generate .conf file from user settings
  2. Spawn EI CLI as child process
  3. Monitor stdout/stderr for progress
  4. On completion, read output .json.gz from temp dir
  5. Decompress and parse JSON
  6. Feed into existing stats pipeline (same JSON shape as dps.report getJson)
  7. Clean up temp files

dps.report upload (parallel):
  1. Upload .zevtc as before
  2. Permalink returned → attach to log entry
  3. Do NOT fetch getJson — local EI JSON is authoritative
```

### Log Card States

- **"Parsing..."** — EI is running or queued. Log card is blocked.
- **"Uploading..."** — dps.report upload in progress (shown alongside, non-blocking).
- **Complete** — EI JSON loaded, stats available. Permalink may still be pending.
- **Error** — EI parse failed. Show error + "Retry" button. Option to fall back to dps.report JSON.

### Concurrency

- Max 1 concurrent EI parse (CPU-intensive, can consume significant memory)
- EI parse queue is FIFO
- dps.report uploads continue with existing max 3 concurrent, independent of EI

### EI Process Management

- Spawn via Node `child_process.spawn()`
- Working directory: temp dir for this parse
- Timeout: 10 minutes per log (kill process if exceeded)
- On `app.on('before-quit')`: kill any active EI child process
- Capture stdout for progress reporting to renderer
- Capture stderr for error reporting

### Config File Generation

Before each parse, write `{userData}/elite-insights/settings.conf` from current user settings. Key defaults:

```conf
SaveOutJSON=True
SaveOutHTML=False
SaveOutCSV=False
SaveOutTrace=False
CompressRaw=True
SaveAtOut=False
OutLocation={tempDir}
DetailledWvW=True
RawTimelineArrays=True
ComputeDamageModifiers=True
ParseCombatReplay=False
ParsePhases=True
SingleThreaded=False
SkipFailedTries=False
Anonymous=False
ParseMultipleLogs=False
UploadToDPSReports=False
UploadToWingman=False
IndentJSON=False
MemoryLimit=0
CustomTooShort=2200
```

Note: `UploadToDPSReports=False` and `UploadToWingman=False` — we handle uploads separately.

### Output Handling

EI writes `.json.gz` files to `OutLocation`. After process exits:
1. Scan temp dir for `.json.gz` files
2. Decompress with zlib
3. Parse JSON
4. Cache the parsed JSON (same caching mechanism as current dps.report JSON)
5. Delete temp files

### Cache & Existing Logs

- Locally-parsed JSON is cached the same way dps.report JSON currently is
- Logs already processed via dps.report (before this feature) keep their existing cached JSON — no forced re-parse
- If cached JSON exists for a log, skip both EI parse and dps.report getJson fetch

### dps.report Becomes Optional

If dps.report upload fails, the log is still fully functional with local EI data. Only the permalink is missing. This means the app works offline for local stat analysis.

---

## EI Configuration UI

New "Parser Settings" section in SettingsView, placed after the existing sections.

### Layout

Same styling as existing Settings sections — grouped categories with toggle switches, dropdowns, and text inputs.

### EI Management Header

Top of the section:
- **Status line:** "Elite Insights v3.20.0 installed" or "Not installed"
- **"Check for Updates" button** — checks GitHub releases, shows result inline
- **"Update" button** — appears when update is available, triggers download
- **"Reinstall" button** — re-downloads everything from scratch
- **Install path display** (read-only)

### Parser Options

**Analysis:**
| Setting | UI Control | Conf Key | Default |
|---|---|---|---|
| Detailed WvW Parse | Toggle | `DetailledWvW` | ON |
| Compute Damage Modifiers | Toggle | `ComputeDamageModifiers` | ON |
| Parse Phases | Toggle | `ParsePhases` | ON |
| Skip Failed Tries | Toggle | `SkipFailedTries` | OFF |
| Anonymize Players | Toggle | `Anonymous` | OFF |
| Min Combat Duration (ms) | Number input | `CustomTooShort` | 2200 |

**Output:**
| Setting | UI Control | Conf Key | Default |
|---|---|---|---|
| Generate HTML Report | Toggle | `SaveOutHTML` | OFF |
| Combat Replay (in HTML) | Toggle | `ParseCombatReplay` | OFF |
| Light Theme (HTML) | Toggle | `LightTheme` | OFF |
| Include Timeline Arrays | Toggle | `RawTimelineArrays` | ON |

**Performance:**
| Setting | UI Control | Conf Key | Default |
|---|---|---|---|
| Single Threaded | Toggle | `SingleThreaded` | OFF |
| Memory Limit (MB) | Number input (0 = auto) | `MemoryLimit` | 0 |

Settings are persisted in the app's settings store (same as other AxiBridge settings) and written to the `.conf` file before each parse. Changes take effect on the next log.

---

## Error Handling & Edge Cases

### EI Crashes Mid-Parse
Log card shows error state with message from stderr. "Retry" button re-queues the parse. If retry also fails, offer to fall back to dps.report JSON with a warning badge.

### EI Not Installed + No Internet
App runs in degraded mode. Logs can't be parsed locally. Persistent banner shown. dps.report uploads still work when internet is available.

### Disk Space
- .NET runtime: ~30MB (Linux only)
- EI CLI: ~70MB
- Temp JSON per log: 5-50MB (cleaned up after caching)
- No long-term disk bloat beyond the cached JSON (same as current behavior)

### Platform-Specific
- **Linux:** `chmod +x` on dotnet binary after extraction. `OutLocation` must be a real path (not empty). Paths passed directly (no Wine/path conversion needed since we use native .NET).
- **Windows:** Direct exe execution. No special handling.

### Process Cleanup
On `app.on('before-quit')` and `app.on('window-all-closed')`: kill any active EI child process via `child.kill()`. Clean up temp directories.

### .NET Runtime Missing/Corrupt
If the dotnet binary exists but fails to run (exit code indicating runtime error), show a specific error: "The .NET runtime may be corrupt. Try reinstalling from Parser Settings." Link to the reinstall button.

### Backwards Compatibility
- Existing cached dps.report JSON continues to work
- The `detailedWvW` field in cached JSON can be checked to determine if a log would benefit from local re-parsing (future enhancement)
- No breaking changes to the stats pipeline — EI JSON from local parse has the same schema as dps.report getJson

---

## Files to Create/Modify

### New Files
- `src/main/eiParser.ts` — EI download, version management, config generation, process spawning, output reading
- `src/main/eiConfig.ts` — EI settings types, defaults, conf file serialization

### Modified Files
- `src/main/index.ts` — orchestrate EI parse + dps.report upload in parallel, new IPC handlers for EI status/settings
- `src/main/uploader.ts` — skip `fetchDetailedJson` when local EI JSON is available
- `src/preload/index.ts` — expose new EI-related IPC methods
- `src/renderer/SettingsView.tsx` — new Parser Settings section
- `src/renderer/global.d.ts` — new types for EI settings, EI status
- `src/renderer/ExpandableLogCard.tsx` — "Parsing..." state
- `package.json` — add `adm-zip` dependency for extraction (or use built-in zlib for .zip)

### IPC Events (main → renderer)

- `ei:status` — EI install state: `{ installed: bool, version: string, updateAvailable?: string }`
- `ei:parse-started` — `{ logPath: string }` — log card transitions to "Parsing..."
- `ei:parse-progress` — `{ logPath: string, message: string }` — stdout lines from EI for progress
- `ei:parse-complete` — `{ logPath: string, json: object }` — parsed EI JSON
- `ei:parse-error` — `{ logPath: string, error: string }` — parse failed
- `ei:download-progress` — `{ percent: number, message: string }` — during first-run install

### IPC Handlers (renderer → main)

- `ei:get-status` — returns current EI install status
- `ei:install` — trigger EI download
- `ei:update` — trigger EI update
- `ei:reinstall` — wipe and re-download
- `ei:check-update` — check GitHub for newer version
- `ei:get-settings` — returns current EI parser settings
- `ei:save-settings` — persist EI parser settings
- `ei:retry-parse` — re-queue a failed log for parsing

### Zip Extraction

Use `adm-zip` npm package for extracting `GW2EICLI.zip` (cross-platform, no system dependency). Already proven in TopStatsAIO. For `.json.gz` output, use Node's built-in `zlib.gunzip()`.

### Not Modified
- `src/shared/combatMetrics.ts` — `computeDownContribution` stays using `downContribution` field, which will now be correctly populated
- Stats pipeline — no changes needed, same JSON schema
