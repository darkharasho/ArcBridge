# Elite Insights Auto-Manage Design

## Summary

Add an `autoManageEi` toggle (default: `true`) that automatically installs Elite Insights on first launch and checks for updates on every subsequent startup. This removes the need for users to manually install or update EI.

## Setting

- **Store key:** `autoManageEi` (boolean, default `true`)
- Top-level app setting, not part of `IEiParserSettings`
- Persisted in Electron Store alongside existing keys like `forceDpsReportOnly`

## IPC Surface

Two new channels registered in `eiHandlers.ts`:

| Channel | Type | Behavior |
|---------|------|----------|
| `ei:get-auto-manage` | invoke | Returns current `autoManageEi` boolean |
| `ei:set-auto-manage` | send | Persists new value to store |

Preload additions to `electronAPI`:
- `getEiAutoManage(): Promise<boolean>`
- `setEiAutoManage(enabled: boolean): void`

Type additions to `ElectronAPI` in `global.d.ts`.

## Main Process Startup Logic

Location: `src/main/index.ts`, after `EiManager` initialization and window creation (so IPC events reach renderer).

```
if (autoManageEi) {
  if (!eiManager.isInstalled()) {
    // Auto-install: full install (CLI + dotnet on Linux)
    // Sends ei:status-changed and ei:download-progress events
    await eiManager.install()
  } else {
    // Check for update
    const update = await eiManager.checkForUpdate()
    if (update) {
      // Auto-update: CLI only
      // Sends ei:status-changed and ei:download-progress events
      await eiManager.installCli()
    }
  }
}
```

Error handling: catch all errors, surface via `ei:status-changed` with `error` field set. No crash, silent degradation — user can still use dps.report fallback.

Timing: startup-only, no periodic re-check while app is running.

## UI: Settings Toggle

Location: top of the Parser Settings section in `SettingsView.tsx`, above the existing install/update buttons.

Uses the existing memoized `Toggle` component:
- **Label:** "Automatically install and update"
- **Description:** "Checks for updates on startup and installs automatically"

When toggled, calls `window.electronAPI.setEiAutoManage(value)`. State loaded on mount via `window.electronAPI.getEiAutoManage()`.

Manual install/update/uninstall buttons remain available regardless of toggle state.

## UI: Nav Bar Status Feedback

When auto-manage is actively installing or updating on startup, show a status indicator in the top nav bar area (mirroring the existing app auto-updater pattern in `AppLayout.tsx`):

- "Installing Elite Insights..." with download progress percentage
- "Updating Elite Insights..." with download progress percentage
- Disappears when complete
- Error state shown briefly if install/update fails

Uses existing `ei:download-progress` and `ei:status-changed` IPC events — no new channels needed for this.

## Banner Suppression

When `autoManageEi` is `true` (default), the EI announcement banner (`EiAnnouncementBanner.tsx`) is not shown. EI will be auto-installed, so there's nothing to announce.

Banner only shows when:
- `autoManageEi` is `false`
- AND EI is not installed
- AND walkthrough is completed
- AND announcement not dismissed

## Toggle-Off Behavior

When `autoManageEi` is turned off after EI was auto-installed:
- EI stays installed
- User manages updates manually using existing buttons (current behavior)
- No uninstall triggered

## Files Modified

| File | Change |
|------|--------|
| `src/main/index.ts` | Startup auto-manage logic |
| `src/main/handlers/eiHandlers.ts` | Two new IPC handlers |
| `src/preload/index.ts` | Two new API methods |
| `src/renderer/global.d.ts` | ElectronAPI type additions |
| `src/renderer/SettingsView.tsx` | Auto-manage toggle at top of Parser Settings |
| `src/renderer/app/AppLayout.tsx` | EI install/update status in nav bar |
| `src/renderer/app/hooks/useAppNavigation.ts` | Banner suppression when auto-manage enabled |
| `src/renderer/EiAnnouncementBanner.tsx` | Accept autoManageEi prop for suppression |
