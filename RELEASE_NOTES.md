# Release Notes

Version v2.0.6 — March 30, 2026

## Minimum Fight Participation Filter

You can now set a minimum fight participation percentage in stats settings. Players who were only in a handful of fights get filtered out of leaderboards and MVP scoring, so your rankings actually reflect consistent contributors instead of someone who showed up for one good fight. The dense table still shows everyone — only leaderboards and MVP are filtered.

## Strips Moved to General MVP

Boon strips used to count as an offensive stat for MVP scoring. That never really made sense — stripping is more of a general contribution than pure offense. Strips now live under the General MVP category with their own weight slider, so you can tune how much they matter independently.

## Wider Stats Sidebars

The inline sidebar grids in breakdown and APM sections are wider now (220→280px), and the dense table player column grew from 170→220px. Names were getting clipped, especially for longer account names.

## Fixes

- Boon strip metrics now respect the disruption method setting consistently. Previously some strip calculations ignored it.
- Stats no longer publish before detail hydration finishes, which could cause incomplete data in reports.
- The LRU cache for log details holds more entries now, preventing thrashing when working with large log sets. Hydrated details also get written to IndexedDB as a fallback when entries do get evicted.
