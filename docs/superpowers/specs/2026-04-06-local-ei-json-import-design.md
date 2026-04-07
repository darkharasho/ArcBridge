# Local EI JSON Import — Design Spec

**Date:** 2026-04-06
**Status:** Approved

## Summary

Add a Developer Settings toggle that allows users to import local Elite Insights JSON files directly, bypassing the dps.report upload pipeline. When enabled, the file picker and drag-and-drop accept `.json` files alongside `.evtc`/`.zevtc`, and the main process reads the JSON from disk instead of uploading to dps.report.

## Motivation

Developer/power-user feature for testing and debugging. Users who already have parsed EI JSON (e.g., from running Elite Insights locally) can import it directly without round-tripping through dps.report.

## Design

### 1. Setting

- **Key:** `allowLocalJson` (boolean, default `false`)
- **Location:** Persisted in `electron-store` alongside existing settings
- **UI:** Toggle in the Developer Settings "tools" tab, labeled "Allow local EI JSON import"
- **Exposure:** Included in `getSettings()` / `saveSettings()` so the renderer knows the current state

### 2. File Input Layer

- **Drag-and-drop:** When `allowLocalJson` is enabled, the drop zone accepts `.json` files in addition to `.evtc`/`.zevtc`. When disabled, `.json` files are filtered out (current behavior).
- **Add Logs file picker:** The file dialog filter expands to include `*.json` when the setting is enabled.
- **IPC:** Both paths continue to use the existing `manualUpload` / `manualUploadBatch` IPC channels. No new IPC channels needed.

### 3. Main Process Handling

When `processLogFile()` receives a file path:

- **If `.json` extension:**
  1. Read file from disk and `JSON.parse()` it
  2. Skip dps.report upload entirely
  3. Run through existing details processing pipeline:
     - `attachConditionMetrics()`
     - `pruneDetailsForStats()`
     - `buildDashboardSummaryFromDetails()`
  4. Build `ILogData` entry:
     - `permalink: ''` (no dps.report link)
     - `id`: derived from filename (e.g., filename without extension)
     - `fightName`, `encounterDuration`: pulled from the parsed JSON
     - `filePath`: the original `.json` file path
  5. Emit same `upload-complete` and `upload-status` events
  6. Status progression: `queued` -> `calculating` -> `success` (skips `uploading` phase)

- **If `.evtc`/`.zevtc` extension:** Existing flow, unchanged.

### 4. What Does NOT Change

- **Renderer:** No changes beyond file filter logic. The renderer already handles `ILogData` entries generically — an entry with `permalink: ''` simply won't render a dps.report link.
- **Stats pipeline:** `computeStatsAggregation` operates on parsed JSON details regardless of source.
- **Discord:** Discord notifications would still work if configured (the details data is the same shape).
- **Validation:** None. This is a hidden developer feature; the JSON is trusted as-is.
- **Watcher:** The folder watcher is not affected. It continues to watch only for `.evtc`/`.zevtc`. Local JSON import is manual-only (drag-and-drop or file picker).

## Non-Goals

- No JSON schema validation
- No automatic detection of EI JSON in the watched folder
- No UI indication that a log was imported vs uploaded (beyond missing permalink)
