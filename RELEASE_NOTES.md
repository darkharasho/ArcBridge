# Release Notes

Version v2.3.1 — April 4, 2026

## New Loading Spinner

Replaced the full-width progress bar with a compact particle spinner, right-aligned next to the witty loading remarks. The stats page no longer locks scrolling or disables actions while logs are processing — you can browse whatever's already computed while the rest loads in.

All the dissolve overlay effects (shimmer, floating particles, section gating) are gone. Sections render freely as data arrives.

## Stats Pipeline Fix

Fixed the core issue where the stats page showed all zeros after uploading logs, even though the dashboard said everything was done.

What was happening: the worker would process all your logs before fight details had actually been fetched from dps.report, compute stats from empty data, then never reprocess once the real data arrived. On top of that, the dashboard was using a different status check than the log list — the dashboard would say "17 success" while the log list still showed "CAL" for everything.

Now logs stay in "calculating" until their fight details are actually in the cache and the worker has used them. Dashboard and log list always agree on status, and the worker re-streams with real data once details arrive.
