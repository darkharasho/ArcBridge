# Release Notes

Version v2.0.8 — March 31, 2026

## Configurable Boon Uptime Resolution

You can now choose the time resolution for boon uptime timelines in Settings. Non-stacking boons (like Quickness) default to 2-second buckets and stacking boons (like Might) default to 5-second buckets, but you can adjust each independently. The drilldown charts and damage overlays respect whatever interval you pick.

## Fixes

- Fixed a memory issue where the main process could run out of heap space on large datasets. Details are now pruned earlier and evicted when the heap budget is tight.
- Fixed boon uptime drilldown not respecting the configured interval, and the damage overlay now renders the full fight duration instead of cutting off early.
