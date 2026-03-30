# Widen Stats Section Sidebars Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Widen stats section sidebars and dense table player columns so player/skill names are less frequently truncated.

**Architecture:** Two width constants are increased: sidebar grid columns from 220px to 280px, and DenseStatsTable's pinned player column from 170px to 220px. No logic changes.

**Tech Stack:** React, Tailwind CSS, CSS Grid

---

### Task 1: Widen centralized layout components

**Files:**
- Modify: `src/renderer/stats/ui/StatsTableLayout.tsx:24`
- Modify: `src/renderer/stats/ui/DenseStatsTable.tsx:44`

- [ ] **Step 1: Update StatsTableLayout sidebar width**

In `src/renderer/stats/ui/StatsTableLayout.tsx` line 24, change:

```tsx
// Before:
<div className={`stats-table-layout grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-0 ${expanded ? 'flex-1 min-h-0 h-full' : ''} ${className}`}>

// After:
<div className={`stats-table-layout grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-0 ${expanded ? 'flex-1 min-h-0 h-full' : ''} ${className}`}>
```

- [ ] **Step 2: Update DenseStatsTable player column minimum width**

In `src/renderer/stats/ui/DenseStatsTable.tsx` line 44, change:

```tsx
// Before:
'minmax(170px, max-content)',

// After:
'minmax(220px, max-content)',
```

- [ ] **Step 3: Commit centralized changes**

```bash
git add src/renderer/stats/ui/StatsTableLayout.tsx src/renderer/stats/ui/DenseStatsTable.tsx
git commit -m "feat: widen stats sidebar (220→280px) and dense table player column (170→220px)"
```

### Task 2: Widen inline grid sections

**Files:**
- Modify: `src/renderer/stats/sections/HealingBreakdownSection.tsx:164`
- Modify: `src/renderer/stats/sections/DamageBreakdownSection.tsx:114`
- Modify: `src/renderer/stats/sections/PlayerBreakdownSection.tsx:142`
- Modify: `src/renderer/stats/sections/ApmSection.tsx:115`

- [ ] **Step 1: Update HealingBreakdownSection**

In `src/renderer/stats/sections/HealingBreakdownSection.tsx` line 164, change:

```tsx
// Before:
<div className="grid lg:grid-cols-[220px_1fr] gap-0 h-[500px]">

// After:
<div className="grid lg:grid-cols-[280px_1fr] gap-0 h-[500px]">
```

- [ ] **Step 2: Update DamageBreakdownSection**

In `src/renderer/stats/sections/DamageBreakdownSection.tsx` line 114, change:

```tsx
// Before:
<div className="grid lg:grid-cols-[220px_1fr] gap-0 h-[480px]">

// After:
<div className="grid lg:grid-cols-[280px_1fr] gap-0 h-[480px]">
```

- [ ] **Step 3: Update PlayerBreakdownSection**

In `src/renderer/stats/sections/PlayerBreakdownSection.tsx` line 142, change:

```tsx
// Before:
<div className={`grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-0 ${expandedSection === 'player-breakdown' ? 'flex-1 min-h-0 h-full' : ''}`}>

// After:
<div className={`grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-0 ${expandedSection === 'player-breakdown' ? 'flex-1 min-h-0 h-full' : ''}`}>
```

- [ ] **Step 4: Update ApmSection**

In `src/renderer/stats/sections/ApmSection.tsx` line 115, change:

```tsx
// Before:
<div className={`grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-0 ${expandedSection === 'apm-stats' ? 'flex-1 min-h-0 h-full' : ''}`}>

// After:
<div className={`grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-0 ${expandedSection === 'apm-stats' ? 'flex-1 min-h-0 h-full' : ''}`}>
```

- [ ] **Step 5: Commit inline grid changes**

```bash
git add src/renderer/stats/sections/HealingBreakdownSection.tsx src/renderer/stats/sections/DamageBreakdownSection.tsx src/renderer/stats/sections/PlayerBreakdownSection.tsx src/renderer/stats/sections/ApmSection.tsx
git commit -m "feat: widen inline sidebar grids (220→280px) in breakdown and APM sections"
```

### Task 3: Validate

- [ ] **Step 1: Run typecheck and lint**

```bash
npm run validate
```

Expected: passes with no errors.

- [ ] **Step 2: Run unit tests**

```bash
npm run test:unit
```

Expected: all tests pass. No test changes needed — these are CSS-only width changes.
