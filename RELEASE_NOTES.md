# Release Notes

Version v2.3.6 — April 6, 2026

## Local EI JSON Import (Developer Feature)

You can now import Elite Insights JSON files directly, skipping the dps.report upload entirely. Useful if you run EI locally and just want to see stats without the round-trip. Enable "Allow local EI JSON import" in Developer Settings (click the version number 5 times), then drag-and-drop `.json` files or pick them from Add Logs. The files go straight through the stats pipeline — no upload, no waiting.

NOTE: This is a hidden developer/power-user feature. The folder watcher still only picks up `.evtc`/`.zevtc` files.

## Fixes

Fixed a React duplicate-key warning that fired when multiple particle effects triggered at the same time on a log card. Each emitter now gets a unique key prefix so they don't collide when sharing the same parent element.
