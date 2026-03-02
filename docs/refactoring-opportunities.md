# Refactoring Opportunities

Review conducted 2026-03-01. Ranked by impact.

---

## High Impact

### 1. Modularize `src/main/index.ts` (~4871 lines)

The entire Electron main process lives in one file: app lifecycle, console logging, electron-store persistence, 50+ IPC handlers, GitHub OAuth, upload retry queue, DPS report cache, dev dataset management, and image fetching.

**Proposed split:**

| New file | Responsibility | Key exports |
|---|---|---|
| `src/main/uploadRetryQueue.ts` | Retry queue types, pure logic, store I/O | `inferUploadRetryFailureCategory`, `trimUploadRetryQueue`, `loadUploadRetryQueue`, `markUploadRetryFailure` |
| `src/main/detailsProcessing.ts` | Pure EI JSON processing, pruning, summaries | `pruneDetailsForStats`, `buildDashboardSummaryFromDetails`, `resolveTimestampSeconds`, `buildManifestEntry` |
| `src/main/dpsReportCache.ts` | Cache index CRUD, TTL expiry | `loadDpsReportCacheEntry`, `saveDpsReportCacheEntry`, `clearDpsReportCache` |
| `src/main/devDatasets.ts` | Dev dataset I/O, integrity checks | `buildDatasetIntegrity`, `validateDatasetIntegrity`, `resolveOrderedDatasetLogPaths` |
| `src/main/imageFetcher.ts` | HTTPS image download with redirect + size limit | `fetchImageBuffer` |
| `src/main/consoleLogger.ts` | Console override, history, renderer forwarding | `setupConsoleLogger`, `formatLogArg` |
| `src/main/handlers/` | IPC handler registration grouped by domain | settings, upload, github, datasets, cache |

**Design constraint:** store-dependent functions should accept a minimal `StoreAdapter` interface (see `uploadRetryQueue.ts`) so they can be tested without Electron.

**Status:** `uploadRetryQueue.ts`, `detailsProcessing.ts`, and `versionUtils.ts` extracted. Within the renderer, `parseTimestamp`/`resolveFightTimestamp` extracted to `stats/utils/timestampUtils.ts` and `computeSkillUsageData` extracted to `stats/computeSkillUsageData.ts`; `enrichPrecomputedStats` lifted to module level in `computeStatsAggregation.ts`.

---

### 2. Decompose `src/renderer/stats/computeStatsAggregation.ts` (~4734 lines)

A single monolithic function handles player aggregation, damage, conditions, boons, skill breakdowns, and fight diff mode — with 3–4 levels of nested loops and 15+ helpers defined inline.

Each concern should become its own named function:
- `aggregatePlayerStats()`
- `calculateDamageMetrics()`
- `aggregateConditions()`
- `buildPlayerSkillBreakdowns()`
- `calculateFightDiffMode()`

---

### 3. Extract shared hooks from section components (`src/renderer/stats/sections/`)

13+ section files (OffenseSection, DefenseSection, SupportSection, …) independently duplicate:
- `[sortState, setSortState]` + toggle logic
- Column / player selection state
- Search filtering
- `Array.from(new Map(…))` deduplication pattern

A `useMetricSectionState.ts` hook eliminates ~2000 lines of duplication.

---

### 4. Split `src/renderer/App.tsx` (~2313 lines)

Root component manages all log state, settings, upload state, navigation, dashboard summary caching, and all render logic. Suggested extractions:
- `useAppState.ts`
- `useSettings.ts`
- `useDashboardSummaryCache.ts`
- `useAppNavigation.ts`

---

### 5. Reduce prop drilling in `src/renderer/StatsView.tsx` (~4543 lines)

~40+ `useState` calls for search terms, active metrics, view modes, and sort state. A `useStatsViewState` hook + React Context would eliminate the drilling.

---

## Medium Impact

### 6. Remove passthrough wrappers in `src/shared/dashboardMetrics.ts`

Functions like `getPlayerDownContribution()` are single-line wrappers around `combatMetrics.ts` with no added semantics.

### 7. Extract magic numbers to `src/shared/constants.ts`

`1e12` (timestamp threshold), `10 * 1024 * 1024` (max image bytes), stability boon ID `1122`, etc. are scattered across files.

### 8. Add error boundaries around stats aggregation in `StatsView.tsx`

No fallback UI if the worker fails or log data is malformed.

---

## Low Impact / Quick Wins

- **`src/shared/boonGeneration.ts`**: Repeated `category === 'selfBuffs' ? 1 : …` ternary chain → lookup map.
- **`src/shared/conditionsMetrics.ts`**: `NON_DAMAGING_CONDITIONS` partially duplicated in `statsMetrics.ts` — consolidate.
- **Dead props in sections**: Several section components receive props they don't use; some internal state is never read.

---

## Recommended Order

1. `src/main/` modularization (already started) — highest isolated testability
2. Shared section hooks — high duplication, contained scope
3. `computeStatsAggregation.ts` decomposition — most complex, but highest long-term payoff
