# Release Notes

Version v2.3.3 — April 5, 2026

## Particle Effects

The app now has particle animations on key events. Log cards burst from the status badge when they arrive, green particles shoot right when an upload completes, purple ones fire when a Discord webhook sends. Removing a log dissolves the card into scattered particles. Switching tabs throws a scatter across the view, and bulk upload completion gets a celebratory burst from the top.

Hovering primary buttons emits slow ambient particles from the edges — small, square-ish, drifting outward.

All of it respects `prefers-reduced-motion` (falls back to a subtle pulse) and is suppressed during bulk uploads so it doesn't tank performance. There's a toggle in Settings > Appearance to turn it all off.

## Settings Search

The settings page now has a search bar at the top. Filters sections as you type — useful now that the page has grown.

## Outgoing Interrupts Leaderboard

New metric in the stats leaderboard: outgoing interrupts (stuns, dazes, knockdowns, etc.). Counts how often each player interrupted enemies.
