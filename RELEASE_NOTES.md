# Release Notes

Version v1.40.15 — March 14, 2026

## Boon Generation Metrics

- Boon outputs now include detailed generation data and new display calculations per player, boon, fight, and category.
- You’ll see a Generation Milliseconds (Raw Accumulation) metric that sums generation time across recipients.
- Display options show Total (boon-seconds), Average (generation rate), and Uptime (per-recipient rate) for each boon, with distinctions for stacking vs non-stacking and self/group/squad contexts.

## Fixes

- Fixed down contribution calculation when EI uses an aggregate target. The value is now derived from totalDamageDist for more accurate results.

## QoL Improvements

- Refactor class icon handling and remove an unused SVG file, tidying up the icon assets used by the UI.
