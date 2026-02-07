# Release Notes

Version v1.25.0 — February 7, 2026

## 🌟 Highlights
- Skill search feature enabled with expand/collapse for player and class breakdown sections.
- New ScreenshotContainer and WebUploadOverlay components to streamline screenshots and web uploads.
- Uploads are faster and more reliable thanks to bounded concurrency and improved timestamp handling.

## 🛠️ Improvements
- Upload processing now uses bounded concurrency and improved timestamp handling for faster, more reliable uploads.
- Stats calculations are faster and smoother thanks to memoization and callbacks.
- Stats layout is improved with StatsTableLayout and StatsTableShell; newer StatsTableCard and StatsTableCardTable components enhance stats display.
- New components for stats and visuals: StatsTableCard and StatsTableCardTable to enhance how stats are shown.

## 🧯 Fixes
- Sidebar styling enhanced for better visibility and overflow handling.
- Ensure fresh data for stats-dependent sections when navigating.
- Fix table and sidebar height mismatch for a more consistent layout.

## ⚠️ Breaking Changes
None.
