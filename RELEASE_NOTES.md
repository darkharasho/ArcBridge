# Release Notes

Version v1.35.1 — February 17, 2026

## 🌟 Highlights
- Fixed: all uploaded fights now stay visible in the dashboard coverage.
- Quick wins: dashboard aggregates are computed right after bulk uploads finish for faster insights.
- Stats flow feels more approachable with a smoother timeline and progress UI.

## 🛠️ Improvements
- More robust caching to improve performance and resilience.
- Stabilized the stats aggregation pipeline to make timeline progress more predictable.
- Slowed-heavy log processing is smoothed to keep the UI responsive during long tasks.

## 🧯 Fixes
- Fixed an issue where some uploaded fights could disappear from dashboard coverage; all fights now show up reliably.
- Deduplicated concurrent requests for the same detailed fight data to avoid extra network calls.
- Cached terminal parse failures to prevent repeated heavy retries after errors.
- Prevented empty-log hydration deadlocks during dashboard preparation.
- Hardened stats syncing with regression coverage to improve reliability.

## ⚠️ Breaking Changes
None.
