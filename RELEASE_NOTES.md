# Release Notes

Version v2.1.0 — March 31, 2026

## All Damage Drilldown

New "All Damage" section with a 3-level drilldown: squad overview → per-player breakdown → per-skill detail. Includes percentile filters so you can focus on top performers or outliers. Timeline charts have brush range selectors for zooming into specific fight windows.

## All Boons Section

New "All Boons" section shows boon data across the full squad with per-fight and per-player drilldown views. Like the damage section, timeline charts here also get brush selectors.

## Player Comparison

You can now compare two players head-to-head or compare any player against the squad average. Covers offense, defense, and support metrics with color-coded deltas so differences are easy to spot.

## Skill Breakdown: Casts and Hits

The player skill drill-down now shows Casts, Hits, and Hits/Cast columns pulled from rotation data. Gives you a better sense of how efficiently players are landing their skills.

## MVP Weight Changes

Downed Healing is now a Defensive MVP factor. Strips and CC moved from Offensive to General MVP category. Existing settings migrate automatically.

## Performance

Fixed an infinite worker-cycling loop that could happen on memory-constrained systems with 30+ logs. The hydration batch flush no longer restarts the stats worker on every batch — it waits until hydration completes for a single restart. Also, unused detail fields are now pruned before being structured-cloned to the worker, reducing memory overhead.
