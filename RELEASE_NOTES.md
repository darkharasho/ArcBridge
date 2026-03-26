# Release Notes

Version v1.43.3 — March 25, 2026

## Fixes

- Fixed a crash on startup where the app couldn't find release notes to display ("ENOENT: RELEASE_NOTES.md"). The file was being packed inside the app archive instead of placed alongside it where the code actually looks.
