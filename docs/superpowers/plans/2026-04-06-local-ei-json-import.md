# Local EI JSON Import — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow developers to import local Elite Insights JSON files directly, bypassing dps.report upload, via a hidden Developer Settings toggle.

**Architecture:** A new `allowLocalJson` boolean setting controls whether `.json` files are accepted by drag-and-drop, file picker, and file listing. In the main process, `processLogFile()` branches on file extension — `.json` files are read from disk and skip the upload, going straight through details processing. The renderer receives the same IPC events regardless of source.

**Tech Stack:** Electron, React, TypeScript, electron-store, vitest

---

### Task 1: Add `allowLocalJson` to settings persistence and IPC

**Files:**
- Modify: `src/main/handlers/settingsHandlers.ts:139-169` (getSettings return object)
- Modify: `src/main/index.ts:1267-1269` (applySettings, add new block after walkthroughSeen)
- Modify: `src/renderer/global.d.ts:248-275` (getSettings return type)
- Modify: `src/renderer/global.d.ts:284-309` (saveSettings parameter type)

- [ ] **Step 1: Add `allowLocalJson` to `getSettings()` response**

In `src/main/handlers/settingsHandlers.ts`, add to the return object at line ~168 (after `walkthroughSeen`):

```typescript
allowLocalJson: store.get('allowLocalJson', false),
```

- [ ] **Step 2: Add `allowLocalJson` to `applySettings()` in main process**

In `src/main/index.ts`, add a new block after the `walkthroughSeen` block (after line ~1269):

```typescript
if (settings.allowLocalJson !== undefined) {
    store.set('allowLocalJson', settings.allowLocalJson);
}
```

- [ ] **Step 3: Add `allowLocalJson` to TypeScript types**

In `src/renderer/global.d.ts`, add to the `getSettings` return type (after `walkthroughSeen?: boolean;`):

```typescript
allowLocalJson?: boolean;
```

Add to the `saveSettings` parameter type (after `walkthroughSeen?: boolean;`):

```typescript
allowLocalJson?: boolean;
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS — no type errors

- [ ] **Step 5: Commit**

```bash
git add src/main/handlers/settingsHandlers.ts src/main/index.ts src/renderer/global.d.ts
git commit -m "feat: add allowLocalJson setting to store and IPC"
```

---

### Task 2: Add toggle to Developer Settings UI

**Files:**
- Modify: `src/renderer/SettingsView.tsx:2650-2704` (tools tab content)

- [ ] **Step 1: Add state and persistence for the toggle**

In `SettingsView.tsx`, find the existing state declarations near the top of the component. Add:

```typescript
const [allowLocalJson, setAllowLocalJson] = useState(false);
```

In the `applySettingsToState` function (which reads from `getSettings()`), add:

```typescript
if (typeof settings.allowLocalJson === 'boolean') {
    setAllowLocalJson(settings.allowLocalJson);
}
```

In the `handleSaveSettings` call (the `saveSettings` invocation around line ~777), add `allowLocalJson` to the object:

```typescript
allowLocalJson,
```

- [ ] **Step 2: Add Toggle to the tools tab UI**

In `SettingsView.tsx`, inside the `devSettingsTab === 'tools'` block (after the description paragraph at line ~2654, before the "Ensure GitHub Template" button), add:

```tsx
<Toggle
    enabled={allowLocalJson}
    onChange={(value) => {
        setAllowLocalJson(value);
        window.electronAPI?.saveSettings?.({ allowLocalJson: value });
    }}
    label="Allow local EI JSON import"
    description="Accept .json files via drag-and-drop and Add Logs, bypassing dps.report upload."
/>
<div className="border-b border-white/5" />
```

- [ ] **Step 3: Run typecheck and lint**

Run: `npm run validate`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/renderer/SettingsView.tsx
git commit -m "feat: add allowLocalJson toggle to Developer Settings"
```

---

### Task 3: Update `extractDroppedLogFiles` to accept `.json`

**Files:**
- Modify: `src/renderer/app/utils/droppedFiles.ts:16-20`
- Test: `src/renderer/__tests__/droppedFiles.test.ts`

- [ ] **Step 1: Write failing tests**

Add these tests to `src/renderer/__tests__/droppedFiles.test.ts`:

```typescript
import { extractDroppedLogFiles } from '../app/utils/droppedFiles';

// Add after the existing tests:

describe('extractDroppedLogFiles with allowJson', () => {
    it('accepts .json files when allowJson is true', () => {
        const transfer = {
            files: [
                { name: 'fight.json', path: '/logs/fight.json' },
                { name: 'FightA.zevtc', path: '/logs/FightA.zevtc' }
            ]
        };

        expect(extractDroppedLogFiles(transfer, { allowJson: true })).toEqual([
            { filePath: '/logs/fight.json', fileName: 'fight.json' },
            { filePath: '/logs/FightA.zevtc', fileName: 'FightA.zevtc' }
        ]);
    });

    it('rejects .json files when allowJson is false', () => {
        const transfer = {
            files: [
                { name: 'fight.json', path: '/logs/fight.json' },
                { name: 'FightA.zevtc', path: '/logs/FightA.zevtc' }
            ]
        };

        expect(extractDroppedLogFiles(transfer, { allowJson: false })).toEqual([
            { filePath: '/logs/FightA.zevtc', fileName: 'FightA.zevtc' }
        ]);
    });

    it('rejects .json files by default (no options)', () => {
        const transfer = {
            files: [
                { name: 'fight.json', path: '/logs/fight.json' }
            ]
        };

        expect(extractDroppedLogFiles(transfer)).toEqual([]);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/renderer/__tests__/droppedFiles.test.ts`
Expected: FAIL — `extractDroppedLogFiles` doesn't accept a second argument yet

- [ ] **Step 3: Implement the change**

In `src/renderer/app/utils/droppedFiles.ts`, update `isSupportedLogFile` to accept an options parameter, and update `extractDroppedLogFiles` to pass it through:

```typescript
interface DropOptions {
    allowJson?: boolean;
}

const isSupportedLogFile = (candidate: DroppedFileLike | null | undefined, options?: DropOptions) => {
    if (!candidate) return false;
    const name = String(candidate.name || candidate.path || '').toLowerCase();
    if (name.endsWith('.evtc') || name.endsWith('.zevtc')) return true;
    if (options?.allowJson && name.endsWith('.json')) return true;
    return false;
};
```

Update `pushIfValid` to accept and forward options:

```typescript
const pushIfValid = (
    bucket: Array<{ filePath: string; fileName: string }>,
    seenPaths: Set<string>,
    candidate: DroppedFileLike | null | undefined,
    options?: DropOptions
) => {
    if (!candidate || !isSupportedLogFile(candidate, options)) return;
    const filePath = resolveDroppedFilePath(candidate);
    if (!filePath || seenPaths.has(filePath)) return;
    seenPaths.add(filePath);
    const fileName = String(candidate.name || filePath.split(/[\\/]/).pop() || filePath);
    bucket.push({ filePath, fileName });
};
```

Update `extractDroppedLogFiles` signature:

```typescript
export const extractDroppedLogFiles = (transfer: TransferLike | null | undefined, options?: DropOptions) => {
    const resolved: Array<{ filePath: string; fileName: string }> = [];
    const seenPaths = new Set<string>();

    const items = transfer?.items;
    if (items) {
        for (const item of Array.from(items)) {
            if (!item || item.kind !== 'file' || typeof item.getAsFile !== 'function') continue;
            pushIfValid(resolved, seenPaths, item.getAsFile(), options);
        }
    }

    const files = transfer?.files;
    if (files) {
        for (const file of Array.from(files)) {
            pushIfValid(resolved, seenPaths, file, options);
        }
    }

    return resolved;
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/renderer/__tests__/droppedFiles.test.ts`
Expected: PASS — all tests including new ones

- [ ] **Step 5: Commit**

```bash
git add src/renderer/app/utils/droppedFiles.ts src/renderer/__tests__/droppedFiles.test.ts
git commit -m "feat: support .json files in extractDroppedLogFiles when allowJson is set"
```

---

### Task 4: Wire `allowLocalJson` into renderer drag-and-drop and file picker

**Files:**
- Modify: `src/renderer/app/hooks/useSettings.ts` (expose `allowLocalJson` state)
- Modify: `src/renderer/App.tsx:~727` (pass `allowJson` to `extractDroppedLogFiles`)
- Modify: `src/main/handlers/fileHandlers.ts:20-32` (expand `select-files` filter)
- Modify: `src/main/handlers/fileHandlers.ts:47-64` (expand `list-log-files` filter)
- Modify: `src/preload/index.ts` (if `select-files` needs allowJson param — check)

- [ ] **Step 1: Add `allowLocalJson` to `useSettings` hook**

In `src/renderer/app/hooks/useSettings.ts`, add state:

```typescript
const [allowLocalJson, setAllowLocalJson] = useState(false);
```

In the `loadSettings` effect, add after the `disruptionMethod` block:

```typescript
if (typeof settings.allowLocalJson === 'boolean') {
    setAllowLocalJson(settings.allowLocalJson);
}
```

Add to the return `useMemo`:

```typescript
allowLocalJson, setAllowLocalJson,
```

Add to the deps array:

```typescript
allowLocalJson,
```

- [ ] **Step 2: Pass `allowJson` to `extractDroppedLogFiles` in App.tsx**

In `src/renderer/App.tsx`, destructure `allowLocalJson` from the `useSettings` return (around line ~72 where other settings are destructured).

Then update the drop handler (around line ~727):

```typescript
const droppedLogs = extractDroppedLogFiles(e.dataTransfer, { allowJson: allowLocalJson });
```

- [ ] **Step 3: Update `select-files` IPC handler to accept `allowJson` param**

In `src/main/handlers/fileHandlers.ts`, update the `select-files` handler:

```typescript
ipcMain.handle('select-files', async (_event, payload?: { defaultPath?: string; allowJson?: boolean }) => {
    const win = getWindow();
    if (!win) return null;
    const filters = payload?.allowJson
        ? [{ name: 'Arc Logs & EI JSON', extensions: ['evtc', 'zevtc', 'json'] }]
        : [{ name: 'Arc Logs', extensions: ['evtc', 'zevtc'] }];
    const result = await dialog.showOpenDialog(win, {
        properties: ['openFile', 'multiSelections'],
        defaultPath: payload?.defaultPath,
        filters
    });
    if (!result.canceled && result.filePaths.length > 0) return result.filePaths;
    return null;
});
```

- [ ] **Step 4: Update `list-log-files` IPC handler to accept `allowJson` param**

In `src/main/handlers/fileHandlers.ts`, update the `list-log-files` handler:

```typescript
ipcMain.handle('list-log-files', async (_event, payload?: { dir?: string; allowJson?: boolean }) => {
    try {
        const dir = payload?.dir;
        if (!dir) return { success: false, error: 'Missing directory.' };
        if (!fs.existsSync(dir)) return { success: false, error: 'Directory not found.' };
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        const files = await Promise.all(entries
            .filter((entry) => {
                if (!entry.isFile()) return false;
                const name = entry.name.toLowerCase();
                if (name.endsWith('.evtc') || name.endsWith('.zevtc')) return true;
                if (payload?.allowJson && name.endsWith('.json')) return true;
                return false;
            })
            .map(async (entry) => {
                const fullPath = path.join(dir, entry.name);
                const stat = await fs.promises.stat(fullPath);
                return {
                    path: fullPath,
                    name: entry.name,
                    mtimeMs: stat.mtimeMs,
                    size: stat.size
                };
            }));
        files.sort((a, b) => b.mtimeMs - a.mtimeMs);
        return { success: true, files };
    } catch (err: any) {
        return { success: false, error: err?.message || 'Failed to list log files.' };
    }
});
```

- [ ] **Step 5: Pass `allowJson` from the file picker hook**

In `src/renderer/app/hooks/useFilePicker.ts`, add `allowLocalJson` to the options interface:

```typescript
interface UseFilePickerOptions {
    logDirectory: string | null;
    setLogs: Dispatch<SetStateAction<ILogData[]>>;
    setBulkUploadMode: Dispatch<SetStateAction<boolean>>;
    bulkUploadExpectedRef: MutableRefObject<number | null>;
    bulkUploadCompletedRef: MutableRefObject<number>;
    allowLocalJson?: boolean;
}
```

Update the destructuring in the function signature to include `allowLocalJson`.

Update the `loadLogFiles` call to pass it:

```typescript
const result = await window.electronAPI.listLogFiles({ dir, allowJson: allowLocalJson });
```

Then in `src/renderer/App.tsx`, pass `allowLocalJson` to `useFilePicker`:

```typescript
const filePickerState = useFilePicker({
    logDirectory,
    setLogs,
    setBulkUploadMode,
    bulkUploadExpectedRef,
    bulkUploadCompletedRef,
    allowLocalJson,
});
```

- [ ] **Step 6: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/renderer/app/hooks/useSettings.ts src/renderer/App.tsx src/main/handlers/fileHandlers.ts src/renderer/app/hooks/useFilePicker.ts
git commit -m "feat: wire allowLocalJson into drag-and-drop and file picker"
```

---

### Task 5: Handle `.json` files in `processLogFile()`

**Files:**
- Modify: `src/main/index.ts:406-639` (processLogFile function)

- [ ] **Step 1: Add JSON file handling branch at the top of processLogFile**

In `src/main/index.ts`, inside `processLogFile`, after the `activeUploads.add(filePath)` line (~412) and the initial status send (~419), add a branch that detects `.json` extension and handles it separately. Insert this block right after line 420 (after the initial `upload-status` sends), replacing the status send for JSON files:

```typescript
const ext = path.extname(filePath).toLowerCase();
if (ext === '.json') {
    // Local EI JSON import — skip dps.report entirely
    win?.webContents.send('upload-status', { id: fileId, filePath, status: 'calculating' });
    try {
        const raw = await fs.promises.readFile(filePath, 'utf-8');
        let jsonDetails = JSON.parse(raw);

        if (jsonDetails && !jsonDetails.error) {
            jsonDetails = attachConditionMetrics(jsonDetails);
        }

        const hasUsableDetails = Boolean(jsonDetails && !jsonDetails.error && hasUsableFightDetails(jsonDetails));
        const prunedDetails = hasUsableDetails ? pruneDetailsForStats(jsonDetails) : null;
        jsonDetails = null; // Release full JSON for GC

        const playerCount = Array.isArray(prunedDetails?.players) ? prunedDetails.players.length : undefined;
        const dashboardSummary = prunedDetails ? buildDashboardSummaryFromDetails(prunedDetails) : undefined;

        if (prunedDetails) {
            setBulkLogDetails(filePath, prunedDetails);
        }
        if (prunedDetails && win?.webContents && !bulkUploadMode) {
            win.webContents.send('details-prewarm', {
                logId: fileId,
                filePath,
                details: prunedDetails,
            });
        }

        win?.webContents.send('upload-complete', {
            id: fileId,
            permalink: '',
            filePath,
            fightName: prunedDetails?.fightName || fileId,
            encounterDuration: prunedDetails?.encounterDuration,
            uploadTime: prunedDetails?.uploadTime || Date.now() / 1000,
            status: hasUsableDetails ? 'calculating' : 'success',
            detailsStatus: hasUsableDetails ? 'available' as const : 'idle' as const,
            playerCount,
            dashboardSummary
        });
        console.log(`[Main] Local JSON import complete: ${filePath} players=${playerCount ?? 'n/a'}`);
        return;
    } catch (jsonError: any) {
        console.error('[Main] Local JSON import failed:', jsonError?.message || jsonError);
        win?.webContents.send('upload-complete', {
            id: fileId,
            filePath,
            status: 'error',
            error: jsonError?.message || 'Failed to read local JSON file'
        });
        return;
    } finally {
        activeUploads.delete(filePath);
    }
}
```

Also, update the initial status send to skip the `uploading` status for JSON files. Modify lines ~414-420 so the `uploading` status is only sent for non-JSON files. The simplest approach: move the initial `upload-status` sends to after the extension check, or guard them:

Replace lines 414-420 with:

```typescript
if (options?.retry) {
    markUploadRetrying(filePath);
}
const ext = path.extname(filePath).toLowerCase();
if (ext !== '.json') {
    win?.webContents.send('upload-status', { id: fileId, filePath, status: 'uploading' });
}
```

Then place the JSON branch immediately after.

- [ ] **Step 2: Ensure `fs` is imported**

Verify that `fs` (specifically `fs.promises.readFile`) is already imported in `src/main/index.ts`. It should be — the file uses `fs` elsewhere. If not:

```typescript
import fs from 'fs';
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/main/index.ts
git commit -m "feat: handle local .json files in processLogFile, bypassing dps.report"
```

---

### Task 6: Validate end-to-end and run full test suite

**Files:** None (verification only)

- [ ] **Step 1: Run unit tests**

Run: `npm run test:unit`
Expected: PASS — all existing tests still pass

- [ ] **Step 2: Run typecheck and lint**

Run: `npm run validate`
Expected: PASS

- [ ] **Step 3: Commit any fixes if needed**

If any tests or lint issues were found, fix and commit:

```bash
git add -A
git commit -m "fix: address test/lint issues from local JSON import feature"
```
