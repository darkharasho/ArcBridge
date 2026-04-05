# Particle Effects System Design Specification

**Date:** 2026-04-05
**Status:** Draft
**Scope:** A unified, lightweight particle effects system for event-driven micro-animations across the AxiBridge desktop app.

## Problem

The app currently has a single particle animation (the stats spinner) but no cohesive system for particle effects elsewhere. Small UI moments — log arrivals, upload completions, view transitions — lack tactile feedback. The goal is a unified particle system that makes the app feel alive and polished without being distracting.

## Solution

A `<ParticleEmitter>` React component that dynamically spawns short-lived particle `<span>` elements with randomized inline styles. One component drives all effects via configurable presets. Particles use CSS `transform` + `opacity` (GPU-composited) and are removed from the DOM after animation completes.

## Design Decisions

- **Digital aesthetic:** Crisp, precise dots with soft glow halos. Not organic/ember, not ethereal/dust — purposeful and data-like.
- **Colors from settings:** All particles use `var(--brand-primary)` / `var(--brand-secondary)` — no hardcoded colors. Automatically adapts to the user's configured primary color.
- **Event-driven only:** No ambient/always-on particles. Every effect is triggered by a specific user action or state change.
- **Approach B (JS component):** Chosen over pure CSS (no randomness, too repetitive) and Canvas (overkill, outside React DOM). The JS component creates DOM spans with randomized styles — lightweight, flexible, matches existing patterns.

## Core Component: ParticleEmitter

### Props API

| Prop | Type | Description |
|------|------|-------------|
| `origin` | `"center"` \| `"left"` \| `"top"` \| `"edges"` \| `{x, y}` | Where particles spawn relative to the wrapper |
| `direction` | `"out"` \| `"in"` | Burst outward or converge inward |
| `count` | `number` | Base particle count (randomized ±20%) |
| `spread` | `number` | Max px distance particles travel |
| `duration` | `number` | Animation duration in ms |
| `size` | `[number, number]` | [min, max] particle diameter in px |
| `glow` | `boolean` | Whether particles get a box-shadow halo |
| `onComplete` | `() => void` | Callback when animation finishes and DOM is cleaned up |

### Behavior

- On mount, generates `count` particle `<span>` elements with randomized inline styles (angle, velocity, size, delay within a small stagger window)
- Each particle animates via CSS `transform` + `opacity` transitions (GPU-composited only)
- Colors read from `var(--brand-primary)` with random opacity variation (0.5–1.0) per particle for depth
- Larger particles get a `box-shadow` glow using `var(--brand-primary)` at 30-40% opacity
- After `duration` + small buffer, removes all particles from DOM and calls `onComplete`
- Renders as a zero-size `position: relative` wrapper — no layout impact

## Effect Catalog

### 1. Log Arrival Burst

- **Trigger:** New `ILogData` entry added to the log list
- **Placement:** Left edge of `ExpandableLogCard`
- **Config:** `origin="left" direction="out" count={18} spread={130} duration={600} size={[2, 5]} glow`
- **Character:** Dramatic radial scatter. 15-20 particles explode outward. The "something just happened" moment.

### 2. Upload Complete Snap

- **Trigger:** `log.status` transitions to `'success'`
- **Placement:** Overlay on full card area
- **Config:** `origin="edges" direction="in" count={14} spread={80} duration={500} size={[2, 4]} glow`
- **Character:** Particles start scattered across the card, converge to center as card content sharpens from `blur(1px)` → `blur(0)`. Chaos → order.

### 3. Status Badge Puff

- **Trigger:** `log.status` changes between intermediate states (queued→uploading, uploading→calculating, etc.)
- **Placement:** Anchored to the status badge element
- **Config:** `origin="center" direction="out" count={5} spread={20} duration={350} size={[1.5, 3]}`
- **Character:** Tiny, quick, understated. Micro-acknowledgement of state change.

### 4. Discord Webhook Sent

- **Trigger:** Successful Discord webhook post (callback from main process)
- **Placement:** Anchored to the Discord button/icon
- **Config:** `origin="center" direction="out" count={10} spread={50} duration={450} size={[2, 4]} glow`
- **Character:** Medium burst — more than a puff, less than the arrival. Celebratory but brief.

### 5. Stats Section Appearing

- **Trigger:** Stats section mounts/becomes visible in StatsView
- **Placement:** Top edge of each section card
- **Config:** `origin="top" direction="out" count={6} spread={25} duration={400} size={[1.5, 3]}`
- **Character:** Subtle shimmer along the top edge as the section fades in. Atmospheric, not attention-grabbing.

### 6. Log Removal

- **Trigger:** User clicks remove on a log card
- **Placement:** Full card area
- **Config:** `origin="center" direction="out" count={12} spread={100} duration={500} size={[2, 4]} glow`
- **Character:** Inverse of the snap — content dissolves outward into particles as the card exits. Paired with existing Framer Motion exit animation.

### 7. Bulk Upload Completion

- **Trigger:** `bulkUploadMode` transitions from active → complete
- **Placement:** Top of the log list area
- **Config:** `origin="top" direction="out" count={24} spread={150} duration={700} size={[2, 5]} glow`
- **Character:** Biggest burst in the system. Collective "we're done" payoff after a long batch (individual card effects are suppressed during bulk mode).

### 8. Tab/View Transitions

- **Trigger:** Switching between Logs / Stats / Settings views
- **Placement:** Outgoing view's area
- **Config:** `origin="edges" direction="out" count={8} spread={40} duration={350} size={[1.5, 3]}`
- **Character:** Quick, subtle scatter as old view exits. New view arrives clean.

## Performance & Accessibility

### Performance Guards

- `prefers-reduced-motion: reduce` → all effects fall back to a single soft opacity pulse (no transform animations)
- `body.bulk-uploading` → card-level effects (#1–6) suppressed. Only #7 (bulk completion) fires.
- Max 5 simultaneous active emitters — oldest cleaned up early if exceeded. Prevents DOM bloat during rapid log arrivals.
- Particles removed from DOM immediately after animation completes.

### Timing & Overlap

- Effects on the same element don't stack — new effect cleans up any active one instantly.
- Upload snap (#2) waits 1 frame after status change to sync with Framer Motion layout animation.
- Tab transitions (#8) fire on exit, not entry — particles scatter from what you're leaving, new view arrives clean.

## File Structure

```
src/renderer/
  particles/
    ParticleEmitter.tsx    # Core component (props API above)
    useParticleEffect.ts   # Hook for imperative triggering (returns ref + trigger())
    particlePresets.ts     # Named effect configs (PRESETS.logArrival, etc.)
    particles.css          # Shared keyframes, reduced-motion fallbacks
```

### Integration Points

- `ExpandableLogCard.tsx` — log arrival (#1), status badge puff (#3), upload snap (#2), log removal (#6), discord sent (#4)
- `StatsView.tsx` — stats section appearing (#5)
- `App.tsx` — bulk upload completion (#7), tab/view transitions (#8)

## Out of Scope

- Ambient/always-on particle backgrounds
- Canvas/WebGL rendering
- Section dissolve loading (the March 2026 spec — deferred)
- Web report particle effects (desktop app only)
- Particle settings/configuration UI for the user
