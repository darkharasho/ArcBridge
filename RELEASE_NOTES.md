# Release Notes

Version v2.0.2 — March 25, 2026

## Fixes

- The titlebar and web report logos still said "ArcBridge" — now correctly shows "AxiBridge". The styled title was split across two elements which the initial rename missed.
- Fixed auto-updates failing on Linux for users who upgraded from ArcBridge. A stale updater cache from the old install was causing electron-updater to look for a non-existent AppImage path. The old cache is now cleaned up on startup.
