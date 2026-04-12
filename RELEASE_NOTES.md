# Release Notes

Version v2.4.4 — April 11, 2026

## Fixes

- **Windows taskbar icon now shows correctly on light themes.** The v2.4.3 change worked for the tray icon but the main app icon in the taskbar stayed white. Now builds a proper multi-size icon that Windows actually picks up for the taskbar.
- **Chart and hover tooltips are no longer see-through.** All tooltips on graphs and stat tables were slightly transparent, which looked bad on glass mode and wasn't great on standard mode either. They're fully opaque now.
