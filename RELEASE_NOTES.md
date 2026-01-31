# Release Notes

Version v1.12.1 — January 31, 2026

## 🌟 Highlights
- Added an artifact duplication script to support both legacy and new ArcBridge release assets.
- Implemented a migration that renames legacy install components to the ArcBridge naming on startup.

## 🛠️ Improvements
- Release builds now run the new duplication script to ensure assets are available under both old and new names.
- On Linux, ArcBridge will copy a legacy AppImage to a new ArcBridge-named file when appropriate.
- On Windows, ArcBridge will copy a legacy portable executable to a new ArcBridge-named file when appropriate.

## 🧯 Fixes
- None.

## ⚠️ Breaking Changes
- None.
