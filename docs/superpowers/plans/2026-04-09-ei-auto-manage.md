# EI Auto-Manage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `autoManageEi` toggle (default `true`) that auto-installs EI on first launch and auto-updates it on every subsequent startup, with nav bar status feedback.

**Architecture:** Main process runs auto-manage logic after window creation using existing `EiManager` methods. Renderer receives progress/status via existing IPC events and shows a nav bar indicator mirroring the app updater pattern. A toggle in Parser Settings controls the behavior.

**Tech Stack:** Electron IPC, React state, existing `EiManager` class, existing `Toggle` component.

---

### Task 1: Add IPC handlers for autoManageEi setting

**Files:**
- Modify: `src/main/handlers/eiHandlers.ts:10-99`
- Modify: `src/preload/index.ts:128-148`
- Modify: `src/renderer/global.d.ts:367-378`

- [ ] **Step 1: Add IPC handlers in eiHandlers.ts**

Add two new handlers at the end of `registerEiHandlers`, before the closing `}`:

```typescript
    ipcMain.handle('ei:get-auto-manage', () => {
        return store.get('autoManageEi', true);
    });

    ipcMain.on('ei:set-auto-manage', (_event, enabled: boolean) => {
        store.set('autoManageEi', enabled);
    });
```

- [ ] **Step 2: Add preload API methods**

In `src/preload/index.ts`, after the `saveEiSettings` line (line 136), add:

```typescript
    getEiAutoManage: () => ipcRenderer.invoke('ei:get-auto-manage'),
    setEiAutoManage: (enabled: boolean) => ipcRenderer.send('ei:set-auto-manage', enabled),
```

- [ ] **Step 3: Add types to ElectronAPI interface**

In `src/renderer/global.d.ts`, after the `saveEiSettings` line (line 375), add:

```typescript
    getEiAutoManage: () => Promise<boolean>;
    setEiAutoManage: (enabled: boolean) => void;
```

- [ ] **Step 4: Verify typecheck passes**

Run: `npm run typecheck`
Expected: PASS with no errors

- [ ] **Step 5: Commit**

```bash
git add src/main/handlers/eiHandlers.ts src/preload/index.ts src/renderer/global.d.ts
git commit -m "feat(ei): add IPC handlers for autoManageEi setting"
```

---

### Task 2: Add startup auto-manage logic in main process

**Files:**
- Modify: `src/main/index.ts:1130-1134` (after eiManager init)

- [ ] **Step 1: Add auto-manage startup function**

In `src/main/index.ts`, after line 1134 (`eiManager.setSettings(...)` block), add:

```typescript
    // Auto-manage EI: install if missing, update if outdated
    const autoManageEi = store.get('autoManageEi', true);
    if (autoManageEi) {
        // Run after window loads so IPC events reach the renderer
        const runAutoManage = async () => {
            try {
                eiManager!.setProgressCallback((progress) => {
                    win?.webContents.send('ei:download-progress', progress);
                });
                if (!eiManager!.isInstalled()) {
                    win?.webContents.send('ei:status-changed', { installed: false, version: null, updateAvailable: null, installing: true, error: null });
                    await eiManager!.install();
                    const status = { ...eiManager!.getStatus(), installing: false, error: null };
                    win?.webContents.send('ei:status-changed', status);
                } else {
                    const updateVersion = await eiManager!.checkForUpdate();
                    if (updateVersion) {
                        win?.webContents.send('ei:status-changed', { ...eiManager!.getStatus(), updateAvailable: updateVersion, installing: true, error: null });
                        await eiManager!.installCli();
                        const status = { ...eiManager!.getStatus(), installing: false, error: null };
                        win?.webContents.send('ei:status-changed', status);
                    }
                }
            } catch (err: any) {
                const status = { ...eiManager!.getStatus(), installing: false, error: err?.message || 'Auto-manage failed' };
                win?.webContents.send('ei:status-changed', status);
            }
        };
        // Delay slightly to ensure renderer has mounted and listeners are attached
        win.webContents.on('did-finish-load', () => {
            setTimeout(runAutoManage, 2000);
        });
    }
```

Note: The `did-finish-load` listener on line 1160 already exists for other purposes. This adds a second one specifically for auto-manage — Electron supports multiple listeners on the same event. The 2-second delay ensures the renderer's `useEffect` hooks have set up their IPC listeners.

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/main/index.ts
git commit -m "feat(ei): auto-install and auto-update EI on startup"
```

---

### Task 3: Add auto-manage toggle to Parser Settings UI

**Files:**
- Modify: `src/renderer/SettingsView.tsx:200-210` (state), `~509` (settings load), `~865` (settings save), `2405-2420` (UI)

- [ ] **Step 1: Add state for autoManageEi**

In `src/renderer/SettingsView.tsx`, after the `forceDpsReportOnly` state declaration (line 210), add:

```typescript
    const [autoManageEi, setAutoManageEi] = useState(true);
```

- [ ] **Step 2: Load autoManageEi from IPC on mount**

In the settings loading `useEffect` (around line 509, after `forceDpsReportOnly` is loaded), add:

```typescript
        window.electronAPI.getEiAutoManage().then(setAutoManageEi);
```

- [ ] **Step 3: Persist autoManageEi on settings save**

In the `handleSave` function, the `forceDpsReportOnly` field is already included in the save payload (line 868). This setting is saved independently via its own IPC channel, so no change needed to `handleSave`. Instead, wire the toggle's `onChange` to call `setEiAutoManage` directly (done in Step 4).

- [ ] **Step 4: Add the toggle UI**

In `src/renderer/SettingsView.tsx`, replace the "Force dps.report Only" toggle block (lines 2412-2420) with the auto-manage toggle first, then the force toggle:

```tsx
                        {/* Auto-manage toggle */}
                        <div className="bg-black/30 border border-white/10 rounded-[4px] p-4 mb-4">
                            <Toggle
                                label="Automatically install and update"
                                description="Checks for updates on startup and installs automatically"
                                enabled={autoManageEi}
                                onChange={(v) => { setAutoManageEi(v); window.electronAPI.setEiAutoManage(v); }}
                            />
                        </div>

                        {/* Force dps.report only toggle */}
                        <div className="bg-black/30 border border-white/10 rounded-[4px] p-4 mb-4">
                            <Toggle
                                label="Force dps.report Only"
                                description="Bypass local EI parsing and use dps.report for all log processing"
                                enabled={forceDpsReportOnly}
                                onChange={(v) => setForceDpsReportOnly(v)}
                            />
                        </div>
```

- [ ] **Step 5: Verify typecheck passes**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/renderer/SettingsView.tsx
git commit -m "feat(ei): add auto-manage toggle to Parser Settings"
```

---

### Task 4: Add EI status indicator to nav bar

**Files:**
- Modify: `src/renderer/app/AppLayout.tsx:23-99` (ctx destructuring), `~224-271` (nav bar status area)
- Modify: `src/renderer/App.tsx` (pass EI status through ctx)
- Modify: `src/renderer/app/hooks/useAppNavigation.ts` (track EI auto-manage status)

- [ ] **Step 1: Add EI status state to useAppNavigation**

In `src/renderer/app/hooks/useAppNavigation.ts`, add state for EI auto-manage progress. After the `eiInstalled` state (line 171), add:

```typescript
    const [eiAutoManageStatus, setEiAutoManageStatus] = useState<string | null>(null);
    const [eiAutoManageProgress, setEiAutoManageProgress] = useState<{ percent: number; message: string } | null>(null);
```

Add a `useEffect` to listen for EI status changes and download progress (after the existing `getEiStatus` effect, around line 179):

```typescript
    useEffect(() => {
        const cleanupStatus = window.electronAPI.onEiStatusChanged((status) => {
            setEiInstalled(status.installed);
            if (status.installing) {
                setEiAutoManageStatus(status.installed ? 'Updating Elite Insights...' : 'Installing Elite Insights...');
            } else if (status.error) {
                setEiAutoManageStatus(`EI: ${status.error}`);
                setTimeout(() => setEiAutoManageStatus(null), 8000);
                setEiAutoManageProgress(null);
            } else {
                setEiAutoManageStatus(null);
                setEiAutoManageProgress(null);
            }
        });
        const cleanupProgress = window.electronAPI.onEiDownloadProgress((data) => {
            setEiAutoManageProgress(data);
        });
        return () => { cleanupStatus(); cleanupProgress(); };
    }, []);
```

Add `eiAutoManageStatus` and `eiAutoManageProgress` to the return object (after `showEiBanner`, around line 215):

```typescript
        eiAutoManageStatus,
        eiAutoManageProgress,
```

- [ ] **Step 2: Pass EI status through App.tsx ctx**

In `src/renderer/App.tsx`, destructure `eiAutoManageStatus` and `eiAutoManageProgress` from `useAppNavigation` (around line 123), and add them to `appLayoutCtx` (around line 936).

In the `useAppNavigation` destructuring (around line 123), add:

```typescript
        eiAutoManageStatus,
        eiAutoManageProgress,
```

In the `appLayoutCtx` useMemo (around line 936), add these to the object and the dependency array.

- [ ] **Step 3: Render EI status in AppLayout nav bar**

In `src/renderer/app/AppLayout.tsx`, destructure `eiAutoManageStatus` and `eiAutoManageProgress` from `ctx` (around line 24).

In the nav bar status area (after the app updater `AnimatePresence` block, around line 271, before the `!autoUpdateSupported` block), add:

```tsx
                    {eiAutoManageStatus && !updateAvailable && !updateDownloaded && (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="flex items-center gap-2 text-[10px] font-medium px-2 py-0.5 rounded-[4px] border"
                            style={eiAutoManageStatus.includes('EI:')
                                ? { background: 'var(--status-error-bg)', color: 'var(--status-error)', borderColor: 'var(--status-error-border)' }
                                : { background: 'var(--accent-bg)', color: 'var(--brand-primary)', borderColor: 'var(--accent-border)' }
                            }
                        >
                            <RefreshCw className={`w-3 h-3 ${!eiAutoManageStatus.includes('EI:') ? 'animate-spin' : ''}`} />
                            <span>
                                {eiAutoManageProgress && !isNaN(eiAutoManageProgress.percent)
                                    ? `${eiAutoManageStatus} ${Math.round(eiAutoManageProgress.percent)}%`
                                    : eiAutoManageStatus}
                            </span>
                        </motion.div>
                    )}
```

- [ ] **Step 4: Verify typecheck passes**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/app/hooks/useAppNavigation.ts src/renderer/App.tsx src/renderer/app/AppLayout.tsx
git commit -m "feat(ei): show EI install/update progress in nav bar"
```

---

### Task 5: Suppress EI announcement banner when auto-manage is enabled

**Files:**
- Modify: `src/renderer/app/hooks/useAppNavigation.ts:181` (showEiBanner logic)

- [ ] **Step 1: Add autoManageEi state and load it**

In `src/renderer/app/hooks/useAppNavigation.ts`, add state after `eiInstalled` (line 171):

```typescript
    const [autoManageEiEnabled, setAutoManageEiEnabled] = useState<boolean | null>(null);
```

In the existing `getEiStatus` effect (line 173-179), add the auto-manage check:

```typescript
    useEffect(() => {
        window.electronAPI?.getEiStatus?.().then((status) => {
            setEiInstalled(status.installed);
        }).catch(() => {
            setEiInstalled(false);
        });
        window.electronAPI?.getEiAutoManage?.().then(setAutoManageEiEnabled).catch(() => setAutoManageEiEnabled(true));
    }, []);
```

- [ ] **Step 2: Update showEiBanner condition**

Change line 181 from:

```typescript
    const showEiBanner = walkthroughSeen === true && !eiAnnouncementDismissed && eiInstalled === false;
```

To:

```typescript
    const showEiBanner = walkthroughSeen === true && !eiAnnouncementDismissed && eiInstalled === false && autoManageEiEnabled === false;
```

This means the banner only shows when auto-manage is off, EI is not installed, walkthrough is done, and the banner hasn't been dismissed.

- [ ] **Step 3: Verify typecheck passes**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Run existing tests**

Run: `npm run test:unit`
Expected: All tests pass. If any EI banner tests fail due to the new condition, update them to mock `getEiAutoManage` returning `false` so the banner is visible in test scenarios.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/app/hooks/useAppNavigation.ts
git commit -m "feat(ei): suppress announcement banner when auto-manage is enabled"
```

---

### Task 6: Final validation

- [ ] **Step 1: Run full typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 2: Run full lint**

Run: `npm run lint`
Expected: PASS (0 warnings)

- [ ] **Step 3: Run unit tests**

Run: `npm run test:unit`
Expected: All tests pass

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`

Verify:
1. Parser Settings shows "Automatically install and update" toggle at the top, enabled by default
2. If EI is not installed, nav bar shows "Installing Elite Insights..." with progress
3. If EI is already installed, startup silently checks for updates
4. EI announcement banner does NOT appear (auto-manage is on)
5. Toggling auto-manage off shows the banner (if EI not installed and not dismissed)
6. Manual install/update/uninstall buttons still work

- [ ] **Step 5: Commit any remaining fixes**

```bash
git add -A
git commit -m "feat(ei): finalize auto-manage feature"
```
