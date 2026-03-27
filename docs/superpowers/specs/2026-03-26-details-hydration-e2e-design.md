# E2E Test: Details Hydration & Dissolve Overlay

## Problem

When logs are loaded, the stats worker computes immediately with metadata-only logs (details stripped). The dissolve overlay disappears as soon as fight count matches (16 >= 16) even though player data is zero. Details then hydrate from dps.report over time, eventually populating stats. Users see a blank stats page with no loading indicator.

## What We're Testing

1. Dissolve overlay persists through the details hydration phase (not just the aggregation phase)
2. Progress bar transitions from "Loading fight data" to "Loading fight details"
3. Stats populate with non-zero player data once details arrive
4. The overlay clears only after all details are hydrated

## Approach

Use the existing **app-mode** Playwright infrastructure (`playwright.app.config.ts`) — served React build with mocked `electronAPI`. No real Electron needed.

### Fixture Data

Use 7 of the 8 EI JSON fixtures from `test-fixtures/boon/` (the `20260117-*` series, excluding the 12MB `20260128-*` file). These are real parsed GW2 WvW fights with 34-43 players each.

Fixtures are too large to inject via `addInitScript` (~70MB total). Instead:
- The mock's `getLogDetails` calls `fetch('/__test-fixtures__/' + id + '.json')`
- Playwright intercepts `/__test-fixtures__/*` routes and serves the JSON files from disk
- This keeps the init script small and fixture loading async

### Mock Enhancement

Extend `ElectronAPIMockOverrides` with:
- `detailsFixtureIds: string[]` — list of fixture IDs the mock can resolve
- `detailsDelayMs: number` — per-log delay in `getLogDetails` (default 200ms)

The mock's `getLogDetails` implementation:
1. Wait `detailsDelayMs` milliseconds
2. Fetch the fixture from the intercepted route
3. Return `{ success: true, details }`

Logs are emitted via `onUploadComplete` immediately (metadata-only, no `details` field). The hydration flow in the app then calls `getLogDetails` for each log, populating the cache and triggering recomputation.

### Test Cases

| ID | Description |
|----|-------------|
| HYDR-001 | Dissolve overlay visible while details are pending |
| HYDR-002 | Progress bar shows "Loading fight details" text |
| HYDR-003 | Stats overview shows non-zero values after hydration completes |
| HYDR-004 | Dissolve overlay clears after all details arrive |
| HYDR-005 | Fight breakdown shows non-zero Allies column after hydration |

### File Layout

```
tests/e2e/app/
  fixtures/
    electronAPIMock.ts         # Enhanced with detailsFixtureIds + detailsDelayMs
  stats-hydration.spec.ts      # New test file
```

### Test Flow

```
1. setupAppPage(page, { logs: 7 metadata-only logs, detailsFixtureIds: [...], detailsDelayMs: 200 })
2. page.route('/__test-fixtures__/*') → serve JSON from test-fixtures/boon/
3. navigateTo(page, 'Stats')
4. Assert dissolve overlay visible (HYDR-001)
5. Assert "Loading fight details" text visible (HYDR-002)
6. Wait for overlay to clear (HYDR-004)
7. Assert overview metrics non-zero (HYDR-003)
8. Assert fight breakdown Allies non-zero (HYDR-005)
```
