# Boon Sections FightMetricSection Conversion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend FightMetricSection with new slots and convert BoonTimelineSection and BoonUptimeSection to FightMetricSection wrappers, reducing ~1070 lines to ~400 lines while unifying visual style.

**Architecture:** FightMetricSection gains 4 new optional props: `renderAbovePlayerList` (boon selector slot), `renderPlayerItem` (custom player rendering), `containerClassName` (flat vs glass), `referenceLineY`/`referenceLineLabel` (chart reference line). Both boon sections are rewritten as thin wrappers that pass specialized content through these slots and the existing `renderDrilldown`/`headerExtras` extension points. The container default changes from `glass-surface` to flat for all sections.

**Tech Stack:** React, Recharts (ComposedChart, Bar, Cell, ReferenceLine, LineChart, Line), TypeScript

---

### Task 1: Extend FightMetricSection with new props

**Files:**
- Modify: `src/renderer/stats/sections/FightMetricSection.tsx`

- [ ] **Step 1: Add ReferenceLine import**

Add `ReferenceLine` to the recharts import:

```typescript
import { CartesianGrid, Line, LineChart, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts';
```

- [ ] **Step 2: Add new props to the type**

After `renderFooter?: () => ReactNode;` in `FightMetricSectionProps`, add:

```typescript
    // Content above player list (e.g., boon selector)
    renderAbovePlayerList?: () => ReactNode;

    // Custom player item renderer (replaces default icon + name + value)
    renderPlayerItem?: (player: FightMetricPlayer, isSelected: boolean) => ReactNode;

    // Container class (defaults to '' for flat style)
    containerClassName?: string;

    // Optional horizontal reference line on main chart
    referenceLineY?: number;
    referenceLineLabel?: string;
```

- [ ] **Step 3: Destructure new props**

After `renderFooter,` in the destructuring, add:

```typescript
    renderAbovePlayerList,
    renderPlayerItem,
    containerClassName = '',
    referenceLineY,
    referenceLineLabel,
```

- [ ] **Step 4: Update container className**

Change the outer `<div>` in `renderContent` from:

```typescript
className={`glass-surface rounded-xl overflow-hidden ${expanded ? 'h-full flex flex-col' : ''}`}
```

To:

```typescript
className={`rounded-xl overflow-hidden ${containerClassName} ${expanded ? 'h-full flex flex-col' : ''}`}
```

- [ ] **Step 5: Add renderAbovePlayerList slot**

After the search input `</div>` and before the `<div className="text-[10px] uppercase tracking-wider text-slate-500` list title div, add:

```typescript
                    {renderAbovePlayerList && (
                        <div className="border-b border-white/5">
                            {renderAbovePlayerList()}
                        </div>
                    )}
```

- [ ] **Step 6: Add renderPlayerItem support**

In the player list, replace the default player item content (everything inside the `<button>` for each player) with a conditional:

Find the section inside the player button that renders the icon, name, and value. Replace:

```typescript
                                            {renderProfessionIcon(player.profession, player.professionList, 'w-4 h-4 flex-shrink-0')}
                                            <span className={`text-xs truncate flex-1 ${isSelected ? 'text-slate-200' : 'text-slate-400'}`}>
                                                {player.displayName}
                                            </span>
                                            <span className={`text-xs tabular-nums ${isSelected ? 'text-indigo-300 font-semibold' : 'text-slate-500'}`}>
                                                {formatValue(player.value)}
                                            </span>
```

With:

```typescript
                                            {renderPlayerItem ? renderPlayerItem(player, isSelected) : (
                                                <>
                                                    {renderProfessionIcon(player.profession, player.professionList, 'w-4 h-4 flex-shrink-0')}
                                                    <span className={`text-xs truncate flex-1 ${isSelected ? 'text-slate-200' : 'text-slate-400'}`}>
                                                        {player.displayName}
                                                    </span>
                                                    <span className={`text-xs tabular-nums ${isSelected ? 'text-indigo-300 font-semibold' : 'text-slate-500'}`}>
                                                        {formatValue(player.value)}
                                                    </span>
                                                </>
                                            )}
```

- [ ] **Step 7: Add ReferenceLine to main chart**

In the main LineChart, after the `maxValue` Line and before the `value` Line (or after both Lines, before `</LineChart>`), add:

```typescript
                                        {referenceLineY != null && (
                                            <ReferenceLine
                                                y={referenceLineY}
                                                stroke="rgba(251,191,36,0.9)"
                                                strokeDasharray="6 4"
                                                ifOverflow="extendDomain"
                                                label={referenceLineLabel ? { value: referenceLineLabel, position: 'right', fill: '#fbbf24', fontSize: 10 } : undefined}
                                            />
                                        )}
```

- [ ] **Step 8: Verify**

Run: `npm run typecheck && npm run lint`

Expected: No errors.

- [ ] **Step 9: Commit**

```bash
git add src/renderer/stats/sections/FightMetricSection.tsx
git commit -m "feat: extend FightMetricSection with renderAbovePlayerList, renderPlayerItem, containerClassName, referenceLineY"
```

---

### Task 2: Rewrite BoonTimelineSection as FightMetricSection wrapper

**Files:**
- Modify: `src/renderer/stats/sections/BoonTimelineSection.tsx`

- [ ] **Step 1: Read the current file and FightMetricSection**

Read both files to understand the current implementation:
- `src/renderer/stats/sections/BoonTimelineSection.tsx`
- `src/renderer/stats/sections/FightMetricSection.tsx`

- [ ] **Step 2: Replace the entire file**

Replace the entire contents of `src/renderer/stats/sections/BoonTimelineSection.tsx` with a wrapper that:

1. Keeps the exact same exported component name and props interface (`BoonTimelineSectionProps`)
2. Maps `BoonTimelinePlayer` to `FightMetricPlayer` (value = `player.total / 1000` for display)
3. Maps `BoonTimelineFightPoint` to `FightMetricPoint` (value = `total`, maxValue = `maxTotal`)
4. Uses `renderAbovePlayerList` for the boon selector: scope PillToggleGroup (Self/Squad/Group/All), boon search input with count, scrollable pill buttons
5. Uses `headerExtras` for the "Squad Damage Heatmap" toggle button (only when fight selected and heatmap data exists)
6. Uses `renderDrilldown` for the ComposedChart with:
   - Primary Line (`dataKey="value"`, generation data)
   - Conditional Bar layer for heatmap (`dataKey="incomingHeatBand"` with per-Cell opacity based on `incomingIntensity`)
   - Secondary hidden Y-axis (`yAxisId="incomingHeat"`, domain [0,1])
   - Y-axis formatter divides by 1000 for display
7. Sets `modes` to empty array (scope is in boon selector, not mode toggles)
8. Sets `formatValue` to `(v) => formatWithCommas(v / 1000, 0)` for the /1000 display
9. Uses fight selection props (`selectedFightIndex`, `setSelectedFightIndex`)

**Styling notes for the wrapper:**
- Boon selector search uses `bg-white/5 rounded px-2 py-1 text-xs text-slate-300 placeholder-slate-500` (matching FightMetricSection's search input style)
- Boon pill buttons use the existing `border rounded-full px-2.5 py-1 text-xs` pattern
- Scope toggles use PillToggleGroup with the standard activeClassName/inactiveClassName
- Drilldown tooltip uses `bg-slate-900/95 border border-white/10 rounded-lg px-3 py-2 text-xs shadow-xl`
- Heatmap toggle button in headerExtras uses `text-[10px] uppercase tracking-wider`

**Key imports needed:**
```typescript
import { Bar, CartesianGrid, Cell, ComposedChart, Line, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartContainer } from '../ui/ChartContainer';
import { Gw2BoonIcon } from '../../ui/Gw2BoonIcon';
import { Gw2AegisIcon } from '../../ui/Gw2AegisIcon';
import { getProfessionColor } from '../../../shared/professionUtils';
import { PillToggleGroup } from '../ui/PillToggleGroup';
import { useStatsSharedContext } from '../StatsViewContext';
import { FightMetricSection } from './FightMetricSection';
import type { FightMetricPlayer, FightMetricPoint } from './FightMetricSection';
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm run lint`

Expected: No errors. Props interface unchanged so all StatsView.tsx render sites still work.

- [ ] **Step 4: Run tests**

Run: `npm run test:unit`

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/stats/sections/BoonTimelineSection.tsx
git commit -m "refactor: rewrite BoonTimelineSection as FightMetricSection wrapper"
```

---

### Task 3: Rewrite BoonUptimeSection as FightMetricSection wrapper

**Files:**
- Modify: `src/renderer/stats/sections/BoonUptimeSection.tsx`

- [ ] **Step 1: Read the current file**

Read `src/renderer/stats/sections/BoonUptimeSection.tsx` to understand the full implementation, paying special attention to:
- `SubgroupMembersTooltip` component (lines 72-139) — must be preserved
- `renderEntryIcon` function (lines 215-225) — subgroup vs player icon
- `showStackCapLine` conditional logic (lines 189-201) — affects chart domain, series key, formatting
- Drilldown with heatmap + reference line (lines 498-587)

- [ ] **Step 2: Replace the BoonUptimeSection export (keep SubgroupMembersTooltip)**

Replace the file, keeping `SubgroupMembersTooltip` as a local component. The wrapper:

1. Keeps exact same exported component name and props interface (`BoonUptimeSectionProps`)
2. Keeps `SubgroupMembersTooltip` component at the top of the file (it uses `useFixedTooltipPosition`, `createPortal`, refs — leave unchanged)
3. Maps `BoonUptimePlayer` to `FightMetricPlayer`:
   - `value` = `showStackCapLine ? (player.total / player.logs) : (player.uptimePercent || 0)` (avg stacks vs uptime%)
4. Maps `BoonUptimeFightPoint` to `FightMetricPoint`:
   - `value` = `showStackCapLine ? (point.average || 0) : point.uptimePercent`
   - `maxValue` = `showStackCapLine ? point.maxTotal : point.maxUptimePercent`
5. Uses `renderAbovePlayerList` for boon selector (search + pill buttons, no scope toggles)
6. Uses `renderPlayerItem` for custom player/subgroup rendering:
   - Regular players: profession icon + name + uptime% value
   - Subgroup entries: cyan "SG" badge, "Aggregate" label, SubgroupMembersTooltip on hover
7. Uses `referenceLineY={25}` and `referenceLineLabel="25"` when `showStackCapLine` is true
8. Uses `headerExtras` for heatmap toggle
9. Uses `renderDrilldown` for ComposedChart with heatmap + its own ReferenceLine at y=25
10. Sets `formatValue` based on `showStackCapLine`: stacks → `formatWithCommas(v, 1)`, uptime → `formatWithCommas(v, 1) + '%'`
11. Chart max Y adjustment: when `showStackCapLine`, passes `Math.ceil(Math.max(1, chartMaxY) + 3)` as `chartMaxY`

**Key imports needed (in addition to BoonTimeline's):**
```typescript
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bar, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts';
import { Gw2FuryIcon } from '../../ui/Gw2FuryIcon';
import { useFixedTooltipPosition } from '../ui/StatsViewShared';
```

**Styling notes:**
- Subgroup buttons in `renderPlayerItem`: cyan borders/backgrounds (`border-cyan-300/70 bg-cyan-400/12` when selected, `border-cyan-400/25 bg-cyan-400/[0.06]` default)
- "SG" badge: `inline-flex shrink-0 items-center justify-center rounded-full border border-cyan-300/50 bg-cyan-400/15 font-bold text-cyan-100`
- "Aggregate" label: `rounded-full border border-cyan-300/30 bg-cyan-400/10 px-1.5 py-0.5 text-[8px] font-semibold uppercase text-cyan-200`

**NOTE:** The `renderPlayerItem` render prop only replaces the INNER content of the player button (icon + name + value). The button container, click handler, and base selection styling (`bg-indigo-500/15 ring-1 ring-indigo-500/30`) are managed by FightMetricSection. However, subgroup entries need different selection styling (cyan vs indigo). To handle this, you have two options:
- Option A: Pass the subgroup styling through `renderPlayerItem` by having it return the full button content including custom background/border classes via a wrapper div
- Option B: Add a `playerClassName` callback prop to FightMetricSection

**Recommended: Option A** — have `renderPlayerItem` return content that includes any additional styling cues. The base button already has `transition-colors` and the selection ring; the render prop can add its own color adjustments via inner container styling.

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm run lint`

Expected: No errors.

- [ ] **Step 4: Run tests**

Run: `npm run test:unit`

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/stats/sections/BoonUptimeSection.tsx
git commit -m "refactor: rewrite BoonUptimeSection as FightMetricSection wrapper"
```

---

### Task 4: Full verification

**Files:** None — verification only

- [ ] **Step 1: Run full validate**

Run: `npm run validate`

Expected: Typecheck and lint both pass.

- [ ] **Step 2: Run all unit tests**

Run: `npm run test:unit`

Expected: All tests pass.

- [ ] **Step 3: Visual verification**

Run: `npm run dev`

Verify in the app:
1. **Boon Timeline** renders with flat FightMetricSection style
2. Boon selector (search + scope toggles + pill buttons) appears above the player list
3. Selecting a boon populates the player list
4. Selecting a player shows per-fight trend chart with animated lines
5. Clicking a chart dot selects a fight — drilldown appears with animation
6. "Squad Damage Heatmap" toggle works — heatmap Bar overlay appears
7. Drilldown shows generation Line + heatmap Bars with intensity coloring
8. Clear button dismisses drilldown
9. Expand button works
10. Player sort toggle (group vs flat) works
11. **Boon Uptime** renders with flat FightMetricSection style
12. Boon selector (search + pill buttons, no scope toggles) works
13. Subgroup entries show cyan "SG" badge and "Aggregate" label
14. Hovering subgroup member count shows tooltip with member details
15. Stack cap reference line appears at y=25 when a stacking boon is selected
16. Y-axis switches between uptime% and average stacks
17. Drilldown shows uptime line + heatmap + reference line
18. **Strip Spikes** and **Spike Damage** sections are unaffected
19. **Incoming Strike Damage** section is unaffected

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: visual adjustments for boon section FightMetricSection conversion"
```

(Skip if no fixes needed.)
