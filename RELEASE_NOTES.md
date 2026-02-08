# Release Notes

Version v1.25.5 — February 7, 2026

## 🌟 Highlights
- Added crash diagnostics for RangeError maximum call stack size exceeded, now monitored in both main and renderer processes.
- Diagnostics capture memory usage and environment details to help pinpoint where things go wrong.

## 🛠️ Improvements
- Main process now detects the RangeError and logs a structured crash report with memory usage and environment info.
- Renderer now reports RangeError events to the main process with context like the page URL and user agent; reports are throttled to avoid log floods.

## 🧯 Fixes
- Ensure that RangeError stack overflow crashes trigger crash diagnostics rather than failing silently.

## ⚠️ Breaking Changes
- None.
