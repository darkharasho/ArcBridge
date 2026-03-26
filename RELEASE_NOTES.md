# Release Notes

Version v2.0.0 — March 25, 2026

## ArcBridge is now AxiBridge

The app has been renamed from ArcBridge to AxiBridge. Your settings, saved logs, and all data migrate automatically on first launch — nothing to do on your end.

On Windows, the installer silently removes the old ArcBridge install so you don't end up with both. On Linux, the AppImage gets a new filename. Discord webhooks now post as "AxiBridge" with the new logo.

## Unified Theme System

The entire theme system has been rebuilt from the ground up. The old theme picker (Classic, CRT, Matte, Kinetic) is replaced with a color palette system and an optional glass surfaces toggle. Existing theme settings migrate automatically.

The web report viewer shares the same palette system — reports now match the look of the desktop app.

## New Stats Sections

- **Damage Modifiers** — Shows which damage modifiers each player is benefiting from, broken down by fight.
- **Sigil & Relic Uptime** — Tracks sigil and relic buff uptime per player.
- **Spike Damage** — Identifies burst windows and peak damage output.
- **Incoming Strike Damage** — Per-player breakdown of incoming damage taken by source.

## Redesigned Stats UI

Stats sections now use a panel-based layout with group containers and a navigation sidebar. Sections load lazily by group using a zustand store, so switching between stats groups is snappy even with 30+ sections.

Animations throughout — staggered section entrance, content fades on tab switch, sliding pill toggles, and a particle dissolve loading bar.

Dense stats tables got a visual overhaul: active column highlighting, sortable headers, muted cell colors, and proper scroll containment.

## Fight Report History

A new History tab lets you browse, search, and manage previously uploaded web reports. Each report opens in a detail panel with the full stats view embedded. You can multi-select and delete reports.

## Redesigned File Picker

The file picker is now a two-panel layout with a filter sidebar. Date range presets, commander filtering, and a Select All toggle. Much easier to pick specific fights from a large log folder.

## Performance

- Stats aggregation caching via an LRU cache — recalculations that haven't changed are instant.
- Parallel details hydration (3 concurrent fetches instead of 1) — details populate 3x faster after bulk uploads.
- Reduced animation overhead during bulk uploads — backdrop filters and Framer Motion animations are disabled automatically.

## QoL Improvements

- Favorite GitHub repositories for web report uploads.
- Stats view stays mounted when switching tabs instead of re-rendering from scratch.
- Expanded sections portal out of backdrop-filter containers so they render correctly.
- Web report respects glass surfaces mode.

## Fixes

- Fixed a compositing bug where wheel scroll broke in dense tables on certain Electron versions.
- Fixed history view scrolling when viewing precomputed stats.
- Fixed date filter preset not resetting when closing the file picker.
- Players who swapped classes mid-session no longer show up as duplicate entries.
