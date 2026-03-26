# Release Notes

Version v2.0.3 — March 25, 2026

## Crash Recovery

If the app hits an unrecoverable error during startup, you now get a proper error screen with the message, stack trace, and a Reload button — instead of a blank white window.

## Report Viewer Fixes

Fixed a layout issue where opening a saved fight report in the History tab could render incorrectly or lose scroll position. The report detail view now mounts outside the list container, so the sidebar and stats panel fill the available space properly.

## Fixes

- Fixed release notes not loading in packaged builds when checking "What's New".
- Details cache no longer triggers network requests during bulk aggregation streaming, which could stall the pipeline.
