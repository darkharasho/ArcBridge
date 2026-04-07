# Release Notes

Version v2.3.8 — April 7, 2026

## Fixes

Fixed the top stats leaderboards showing all 0.00 values when using "Per Second" or "Per Minute" mode with "Split by Class" enabled. The per-second/per-minute recalculation couldn't find player data because it was looking up accounts by name alone, but split-by-class stores them under a different key. Now matches correctly regardless of the split setting.
