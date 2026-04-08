# Release Notes

Version v2.3.9 — April 8, 2026

## Motion System

The whole app now has a unified animation system. Stats sections cascade in with staggered timing when you navigate between views. Log cards slide in smoothly (even during bulk uploads, where a CSS fallback kicks in). Expanding a log card, opening modals, and switching tabs all feel snappier with consistent easing curves. There's also a sliding indicator under the active nav tab.

## Particle Effects on Destructive Buttons

Clear Logs, Delete Selected, and Delete Reports buttons now have red particle hover effects that match the button's color instead of using the default brand blue.

## View Transitions

Switching between Dashboard, Stats, History, and Settings now cross-fades with a subtle vertical shift instead of instantly swapping content.

## Dense Table Polish

Hovering a row in stats tables now shows a subtle inset rail highlight. Sticky headers gain a shadow when the table is scrolled. Loading states use a shimmer skeleton instead of a blank space.

## Accessibility

Users with `prefers-reduced-motion` enabled at the OS level now get all animations and transitions disabled globally — particles, spinners, and framer-motion included.

## Design Token Migration

All hardcoded hex colors across the UI (status indicators, tooltips, badges, table highlights, dropdown panels) now reference CSS custom properties. This means color palette switching is more consistent — status greens, reds, and warnings all update correctly across every component. No visual change by default, but themes and future palette work benefit from it.

## QoL Improvements

- Glass mode surfaces now transition smoothly instead of snapping when toggled.
- Tooltips and dropdowns have a quick scale-in entrance animation.
- Modal open/close uses the new easing tokens for a more polished feel.
