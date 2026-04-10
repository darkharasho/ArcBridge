# Release Notes

Version v2.4.2 — April 10, 2026

## Auto-Manage Elite Insights

AxiBridge now installs and updates Elite Insights automatically on startup. If EI isn't installed, it'll grab it for you. If there's a newer version, it'll update silently. You can see download progress in the nav bar. There's a toggle in Parser Settings if you'd rather manage it yourself.

## Cache Cleanup

The details cache in IndexedDB was never evicting old entries, so it could grow to 10+ GB over time. Now there's a 7-day TTL — stale entries are swept on startup. If you've been running AxiBridge for a while, the first launch after this update will clean up all the accumulated data.
