# Expanded Color Palettes Design

## Summary

Add 6 new color palettes to AxiBridge, bringing the total from 4 to 10. The new palettes work identically across the desktop app and web reports using the existing palette system.

## New Palettes

| ID | Label | Primary | Secondary | Gradient |
|----|-------|---------|-----------|----------|
| `rose-pink` | Rose Pink | `#f43f5e` | `#ec4899` | `135deg, #f43f5e, #ec4899` |
| `violet-purple` | Violet Purple | `#8b5cf6` | `#a855f7` | `135deg, #8b5cf6, #a855f7` |
| `crimson-red` | Crimson Red | `#ef4444` | `#f97316` | `135deg, #ef4444, #f97316` |
| `slate-silver` | Slate Silver | `#94a3b8` | `#64748b` | `135deg, #94a3b8, #64748b` |
| `teal-ocean` | Teal Ocean | `#14b8a6` | `#0891b2` | `135deg, #14b8a6, #0891b2` |
| `gold-bronze` | Gold Bronze | `#d4a017` | `#b8860b` | `135deg, #d4a017, #b8860b` |

Each palette follows the existing `PaletteDefinition` structure with derived `accentBg` (10% opacity), `accentBgStrong` (18% opacity), and `accentBorder` (35% opacity) values from the primary color.

## Changes Required

### 1. `src/shared/webThemes.ts`

- Extend the `ColorPalette` union type with 6 new string literals
- Add 6 new entries to the `PALETTES` record, each following the existing `PaletteDefinition` shape

### 2. `src/renderer/index.css`

- Add 6 new `body.palette-*` rule blocks, each overriding the same CSS custom properties as the existing palettes:
  - `--brand-primary`, `--brand-secondary`, `--brand-gradient`
  - `--accent-bg`, `--accent-bg-strong`, `--accent-border`
  - `--glow-primary`, `--glow-secondary`

### 3. No other changes needed

- **Settings UI** (`SettingsView.tsx`): Already iterates `Object.values(PALETTES)` — new palettes appear automatically
- **Settings hook** (`useSettings.ts`): Already applies `palette-${colorPalette}` class generically
- **Web report** (`reportApp.tsx`): Already reads palette from report data and applies body class
- **Palette reader** (`paletteReader.ts`): Already falls back to default for unknown values; new values are valid `ColorPalette` members
- **Tests** (`statsThemesContract.test.ts`): Contract tests are palette-agnostic

## Settings Grid Layout

The palette picker in settings currently shows a 4-item grid. With 10 palettes it becomes a 5×2 grid, which fits naturally in the existing settings panel width.

## Backward Compatibility

- Existing saved settings with old palette IDs continue to work unchanged
- Web reports generated with old palettes render correctly
- New palettes only appear when explicitly selected
- No migration needed
