# Widen Stats Section Sidebars

**Date:** 2026-03-29
**Origin:** Discord thread "Widen the sidebar on sections" (harasho)

## Problem

Player names and skill names in the stats dashboard are frequently truncated with "..." because the sidebar and table player columns are too narrow. GW2 account names follow the `Name.1234` format (typically 15-20 characters), and when displayed alongside numeric values in a 220px sidebar, they overflow.

## Solution

Increase two width values across all stats sections:

1. **Section sidebar**: `220px` → `280px` (+60px)
2. **DenseStatsTable player column**: `minmax(170px, max-content)` → `minmax(220px, max-content)` (+50px)

## Changes

### Centralized components (2 files)

| File | Line | Change |
|------|------|--------|
| `src/renderer/stats/ui/StatsTableLayout.tsx` | 24 | `grid-cols-[220px_1fr]` → `grid-cols-[280px_1fr]` |
| `src/renderer/stats/ui/DenseStatsTable.tsx` | 44 | `minmax(170px, max-content)` → `minmax(220px, max-content)` |

### Inline grid sections (4 files)

These sections hardcode `220px` instead of using `StatsTableLayout`:

| File | Line | Change |
|------|------|--------|
| `src/renderer/stats/sections/HealingBreakdownSection.tsx` | 164 | `grid-cols-[220px_1fr]` → `grid-cols-[280px_1fr]` |
| `src/renderer/stats/sections/DamageBreakdownSection.tsx` | 114 | `grid-cols-[220px_1fr]` → `grid-cols-[280px_1fr]` |
| `src/renderer/stats/sections/PlayerBreakdownSection.tsx` | 142 | `grid-cols-[220px_1fr]` → `grid-cols-[280px_1fr]` |
| `src/renderer/stats/sections/ApmSection.tsx` | 115 | `grid-cols-[220px_1fr]` → `grid-cols-[280px_1fr]` |

## What stays the same

- **Nav sidebar** (`StatsNavSidebar.tsx`, 72px collapsed / 248px expanded) is unrelated and unchanged.
- **Truncation CSS** (`truncate` Tailwind class) remains on player/skill name elements. It is correct as a fallback for unusually long names; the wider columns just reduce how often it triggers.
- **Mobile layout** (`grid-cols-1`) is unaffected since the sidebar stacks vertically on small screens.

## Testing

- Visual verification: load a dataset with long player names and confirm names are no longer truncated in sidebar lists and dense tables.
- Run `npm run validate` to confirm no type or lint errors.
- Run `npm run test:unit` to confirm no regressions.
