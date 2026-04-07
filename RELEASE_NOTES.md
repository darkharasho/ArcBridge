# Release Notes

Version v2.3.7 — April 7, 2026

## Fixes

The "Allow local EI JSON import" toggle now takes effect immediately for drag-and-drop without needing to restart the app. Previously the setting was saved but the drag-and-drop handler kept using the old value until next launch.

Fixed a race condition where bulk-dropping multiple JSON files could leave the last file without full details — showing `--:--` duration, 0 allies, missing team columns, and not counting toward the win/loss record. The details hydration pass now forces a retry whenever new logs appear, so all files get picked up regardless of timing.
