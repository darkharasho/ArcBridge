# Release Notes

Version v2.3.4 — April 5, 2026

## Down Contribution Fix

Down contribution numbers were under-reported for some players — in some cases by up to 42%. The old code read from a per-target breakdown that didn't include damage to aggregated/unnamed enemy targets. Now reads from the authoritative total that EI provides, so the values in the MVP rankings, leaderboards, and Discord embeds should match what you'd expect from the fight.
