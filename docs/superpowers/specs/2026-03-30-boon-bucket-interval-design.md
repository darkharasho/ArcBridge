# Configurable Boon Uptime Bucket Interval

**Date:** 2026-03-30
**Origin:** Discord thread "Change boon uptime interval from 5s to 1-2s"

## Problem

Boon uptime timeline charts use a hardcoded 5-second bucket interval. For single-stack (non-stacking) boons like Resistance and Protection, 5s buckets hide important coverage gaps — a boon that drops for 1-2 seconds appears as full uptime. Stacking boons (Might, Stability) fluctuate constantly and benefit less from finer resolution.

## Design

### Settings

Two new fields on `IStatsViewSettings`:

```typescript
boonBucketIntervalMs: number;          // non-stacking, default 2000
stackingBoonBucketIntervalMs: number;  // stacking, default 5000
```

Allowed values: 1000, 2000, 3000, 5000 (presented as 1s/2s/3s/5s dropdowns).

Defaults preserve current behavior for stacking boons (5s) and improve resolution for non-stacking boons (2s).

Missing fields in existing user configs fall back to defaults — no migration needed.

### Computation

**`computeBoonUptimeTimeline.ts`:**

- Function signature gains a settings parameter: `{ boonBucketIntervalMs: number; stackingBoonBucketIntervalMs: number }`
- Per-boon interval selection: `const intervalMs = meta.stacking ? settings.stackingBoonBucketIntervalMs : settings.boonBucketIntervalMs`
- `bucketCount = Math.ceil(durationMs / intervalMs)` (was `/ 5000`)
- `sampleStackTimeline` receives `intervalMs` parameter; `sampleTime = bucketIndex * intervalMs` (was `* 5000`)
- `buckets5s` field renamed to `buckets` in `UptimeFightValue`

**`computeTimelineAndMapData.ts`:** Passes interval settings through to `computeBoonUptimeTimeline()`.

**`StatsView.tsx`:** Dynamic bucket size in display references and drilldown title (was hardcoded "5s Stack Buckets").

### Settings UI

Two dropdowns grouped under a "Boon Uptime Resolution" heading, placed near existing stats settings:

- "Non-stacking boons" — 1s, 2s, 3s, 5s (default: 2s)
- "Stacking boons" — 1s, 2s, 3s, 5s (default: 5s)

### Performance

At 2s intervals a 5-minute fight produces ~150 buckets vs current 60. Negligible computation overhead. Web report payload grows proportionally for non-stacking boons only.

## Affected Files

| File | Change |
|------|--------|
| `src/renderer/global.d.ts` | Add two fields to `IStatsViewSettings` + defaults |
| `src/renderer/stats/computeBoonUptimeTimeline.ts` | Parameterize interval, rename `buckets5s` to `buckets` |
| `src/renderer/stats/computeTimelineAndMapData.ts` | Pass settings through |
| `src/renderer/StatsView.tsx` | Dynamic bucket size references and drilldown title |
| `src/renderer/stats/sections/BoonUptimeSection.tsx` | Use `buckets` field name |
| Settings UI file | Add two dropdowns |
| Tests referencing `buckets5s` | Update field name |

## Not Changed

- `boonGeneration.ts` (aggregate metrics, not per-fight bucketed timelines)
- `metricsSettings.ts`
- `statsWorker.ts`
- Main process files
