# Release Notes

Version v2.2.3 — April 3, 2026

## Mobile Preview Button

The Dev Mock banner now has a "Mobile" button that opens a separate window at iPhone 16 resolution (393×852). Useful for testing how web reports look on phones without leaving the app.

## Mobile Layout Fixes

Web reports no longer overflow on mobile screens. Section headers with pill toggles (Fight Breakdown, Boon Output, Offense, Defense, etc.) now wrap properly instead of pushing past the edge of the viewport. MVP cards, skill names, and sigil names all truncate correctly now too.

Top Skills (outgoing and incoming) show the value and hit count on a second line on mobile, so skill names actually have room to breathe instead of getting cut to one or two characters.

## QoL Improvements

- The pill toggle active state no longer renders a double-highlight — the animated indicator was stacking with the button's own background.
- Scrollbar gutter space is disabled on mobile so the right margin matches the left.
- Fight Breakdown table column padding is now symmetrical.

## Testing

Added Playwright e2e tests that scan web report sections at mobile resolution for overflow, viewport bleed, and sibling overlap. Nine tests covering Overview, Offense, Defense, and the mobile action bar.
