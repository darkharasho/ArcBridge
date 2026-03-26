# Release Notes

Version v2.0.1 — March 25, 2026

## Fixes

- Fixed the Windows installer not removing the old ArcBridge install. The NSIS uninstall script was looking for a registry key that didn't exist — now checks for the uninstaller directly at the known install path. If you updated from ArcBridge, this release will clean up the old install automatically.
- All GitHub links (settings page, web report, Discord avatar, release notes API) now point directly to the new `darkharasho/axibridge` repo instead of relying on redirects.
