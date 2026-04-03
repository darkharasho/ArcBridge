# Expanded Color Palettes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 6 new color palettes (Rose Pink, Violet Purple, Crimson Red, Slate Silver, Teal Ocean, Gold Bronze) to the existing 4, working across desktop app and web reports.

**Architecture:** Extend the `ColorPalette` union type and `PALETTES` record in `webThemes.ts`, then add matching CSS custom property blocks in `index.css`. The settings UI, web report, and palette reader all consume `PALETTES` generically — no changes needed there.

**Tech Stack:** TypeScript, CSS custom properties

**Spec:** `docs/superpowers/specs/2026-04-03-expanded-color-palettes-design.md`

---

### Task 1: Add palette definitions to webThemes.ts

**Files:**
- Modify: `src/shared/webThemes.ts:1` (type union)
- Modify: `src/shared/webThemes.ts:14-55` (PALETTES record)

- [ ] **Step 1: Extend the ColorPalette type union**

In `src/shared/webThemes.ts`, change line 1 from:

```typescript
export type ColorPalette = 'electric-blue' | 'refined-cyan' | 'amber-warm' | 'emerald-mint';
```

to:

```typescript
export type ColorPalette = 'electric-blue' | 'refined-cyan' | 'amber-warm' | 'emerald-mint' | 'rose-pink' | 'violet-purple' | 'crimson-red' | 'slate-silver' | 'teal-ocean' | 'gold-bronze';
```

- [ ] **Step 2: Add the 6 new palette entries to the PALETTES record**

Insert after the `'emerald-mint'` entry (after line 54, before the closing `};` of PALETTES):

```typescript
    'rose-pink': {
        id: 'rose-pink',
        label: 'Rose Pink',
        primary: '#f43f5e',
        secondary: '#ec4899',
        gradient: 'linear-gradient(135deg, #f43f5e, #ec4899)',
        accentBg: 'rgba(244, 63, 94, 0.10)',
        accentBgStrong: 'rgba(244, 63, 94, 0.18)',
        accentBorder: 'rgba(244, 63, 94, 0.35)',
    },
    'violet-purple': {
        id: 'violet-purple',
        label: 'Violet Purple',
        primary: '#8b5cf6',
        secondary: '#a855f7',
        gradient: 'linear-gradient(135deg, #8b5cf6, #a855f7)',
        accentBg: 'rgba(139, 92, 246, 0.10)',
        accentBgStrong: 'rgba(139, 92, 246, 0.18)',
        accentBorder: 'rgba(139, 92, 246, 0.35)',
    },
    'crimson-red': {
        id: 'crimson-red',
        label: 'Crimson Red',
        primary: '#ef4444',
        secondary: '#f97316',
        gradient: 'linear-gradient(135deg, #ef4444, #f97316)',
        accentBg: 'rgba(239, 68, 68, 0.10)',
        accentBgStrong: 'rgba(239, 68, 68, 0.18)',
        accentBorder: 'rgba(239, 68, 68, 0.35)',
    },
    'slate-silver': {
        id: 'slate-silver',
        label: 'Slate Silver',
        primary: '#94a3b8',
        secondary: '#64748b',
        gradient: 'linear-gradient(135deg, #94a3b8, #64748b)',
        accentBg: 'rgba(148, 163, 184, 0.10)',
        accentBgStrong: 'rgba(148, 163, 184, 0.18)',
        accentBorder: 'rgba(148, 163, 184, 0.35)',
    },
    'teal-ocean': {
        id: 'teal-ocean',
        label: 'Teal Ocean',
        primary: '#14b8a6',
        secondary: '#0891b2',
        gradient: 'linear-gradient(135deg, #14b8a6, #0891b2)',
        accentBg: 'rgba(20, 184, 166, 0.10)',
        accentBgStrong: 'rgba(20, 184, 166, 0.18)',
        accentBorder: 'rgba(20, 184, 166, 0.35)',
    },
    'gold-bronze': {
        id: 'gold-bronze',
        label: 'Gold Bronze',
        primary: '#d4a017',
        secondary: '#b8860b',
        gradient: 'linear-gradient(135deg, #d4a017, #b8860b)',
        accentBg: 'rgba(212, 160, 23, 0.10)',
        accentBgStrong: 'rgba(212, 160, 23, 0.18)',
        accentBorder: 'rgba(212, 160, 23, 0.35)',
    },
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS — the new union members are used in the PALETTES record, and the record satisfies `Record<ColorPalette, PaletteDefinition>`.

- [ ] **Step 4: Commit**

```bash
git add src/shared/webThemes.ts
git commit -m "feat(themes): add 6 new color palette definitions"
```

---

### Task 2: Add CSS custom property blocks for new palettes

**Files:**
- Modify: `src/renderer/index.css:105` (insert after `body.palette-emerald-mint` block, before the `/* Glass surface mode */` comment)

- [ ] **Step 1: Add the 6 new palette CSS blocks**

Insert after the closing `}` of `body.palette-emerald-mint` (line 105) and before `/* Glass surface mode */` (line 107):

```css
body.palette-rose-pink {
  --brand-primary: #f43f5e;
  --brand-secondary: #ec4899;
  --brand-gradient: linear-gradient(135deg, #f43f5e, #ec4899);
  --accent-bg: rgba(244, 63, 94, 0.10);
  --accent-bg-strong: rgba(244, 63, 94, 0.18);
  --accent-border: rgba(244, 63, 94, 0.35);
  --glow-primary: rgba(244, 63, 94, 0.35);
  --glow-secondary: rgba(236, 72, 153, 0.35);
}

body.palette-violet-purple {
  --brand-primary: #8b5cf6;
  --brand-secondary: #a855f7;
  --brand-gradient: linear-gradient(135deg, #8b5cf6, #a855f7);
  --accent-bg: rgba(139, 92, 246, 0.10);
  --accent-bg-strong: rgba(139, 92, 246, 0.18);
  --accent-border: rgba(139, 92, 246, 0.35);
  --glow-primary: rgba(139, 92, 246, 0.35);
  --glow-secondary: rgba(168, 85, 247, 0.35);
}

body.palette-crimson-red {
  --brand-primary: #ef4444;
  --brand-secondary: #f97316;
  --brand-gradient: linear-gradient(135deg, #ef4444, #f97316);
  --accent-bg: rgba(239, 68, 68, 0.10);
  --accent-bg-strong: rgba(239, 68, 68, 0.18);
  --accent-border: rgba(239, 68, 68, 0.35);
  --glow-primary: rgba(239, 68, 68, 0.35);
  --glow-secondary: rgba(249, 115, 22, 0.35);
}

body.palette-slate-silver {
  --brand-primary: #94a3b8;
  --brand-secondary: #64748b;
  --brand-gradient: linear-gradient(135deg, #94a3b8, #64748b);
  --accent-bg: rgba(148, 163, 184, 0.10);
  --accent-bg-strong: rgba(148, 163, 184, 0.18);
  --accent-border: rgba(148, 163, 184, 0.35);
  --glow-primary: rgba(148, 163, 184, 0.35);
  --glow-secondary: rgba(100, 116, 139, 0.35);
}

body.palette-teal-ocean {
  --brand-primary: #14b8a6;
  --brand-secondary: #0891b2;
  --brand-gradient: linear-gradient(135deg, #14b8a6, #0891b2);
  --accent-bg: rgba(20, 184, 166, 0.10);
  --accent-bg-strong: rgba(20, 184, 166, 0.18);
  --accent-border: rgba(20, 184, 166, 0.35);
  --glow-primary: rgba(20, 184, 166, 0.35);
  --glow-secondary: rgba(8, 145, 178, 0.35);
}

body.palette-gold-bronze {
  --brand-primary: #d4a017;
  --brand-secondary: #b8860b;
  --brand-gradient: linear-gradient(135deg, #d4a017, #b8860b);
  --accent-bg: rgba(212, 160, 23, 0.10);
  --accent-bg-strong: rgba(212, 160, 23, 0.18);
  --accent-border: rgba(212, 160, 23, 0.35);
  --glow-primary: rgba(212, 160, 23, 0.35);
  --glow-secondary: rgba(184, 134, 11, 0.35);
}
```

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: PASS — no CSS lint violations.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/index.css
git commit -m "feat(themes): add CSS custom properties for 6 new palettes"
```

---

### Task 3: Validate everything works end-to-end

- [ ] **Step 1: Run full validation**

Run: `npm run validate`
Expected: PASS — typecheck and lint both succeed.

- [ ] **Step 2: Run unit tests**

Run: `npm run test:unit`
Expected: PASS — all existing tests pass, including `statsThemesContract.test.ts`.

- [ ] **Step 3: Verify dev app loads with a new palette**

Run: `npm run dev`
In the app, go to Settings → Appearance → Color Palette. Verify all 10 palette swatches are visible. Click each new palette and confirm the UI colors change.

- [ ] **Step 4: Final commit (if any adjustments were needed)**

```bash
git add -A
git commit -m "fix(themes): address any issues found during validation"
```

Only create this commit if changes were required. Skip if everything passed cleanly.
