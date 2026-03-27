# Release Notes

Version v2.0.4 — March 27, 2026

## Stats View Performance

Eliminated a re-render cascade that caused the stats dashboard to feel sluggish, especially with larger log sets. Context objects, callbacks, and inline styles are now properly memoized so React doesn't re-render the entire tree on every state change. The old workaround that disabled chart animations is gone — charts animate normally again without the jank.

## Details Hydration Fix

Fixed a race condition where some fights would stay stuck in a shimmer/loading state and never show stats, even though the data had already been fetched. The details cache now stores entries under both the log ID and file path, so logs that were added before their permanent ID was assigned can still find their cached details.

## Zero Deaths in Death Distance Chart

Fights where nobody in the squad died now display correctly in the death distance chart instead of showing an empty bar. They get a distinct gray color and a "0 deaths" label in the legend, and clicking one shows a "No squad deaths in this fight" message instead of a blank scatter plot.

## Fixes

- Stats deduplication settings no longer get silently reset when switching views.
