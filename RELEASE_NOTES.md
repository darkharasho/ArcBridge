# Release Notes

Version v2.0.7 — March 30, 2026

## Fixes

- Fixed excessive worker restarts during hydration that could accumulate memory and crash the renderer. The stats worker now restarts once after hydration completes instead of on every batch.
