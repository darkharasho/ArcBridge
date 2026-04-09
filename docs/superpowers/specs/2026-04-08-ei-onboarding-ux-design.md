# EI Onboarding UX — Design Spec

**Date:** 2026-04-08
**Problem:** Users have no indication that local Elite Insights parsing is available or that it provides more accurate WvW metrics than dps.report. There's no onboarding flow for the feature — users must discover Parser Settings on their own.

**Solution:** Two complementary touchpoints: a 4th step in the first-time walkthrough for new users, and a one-time launch banner for existing users.

---

## 1. FTE Walkthrough Step 4

### What Changes

Add a 4th step to the existing `WalkthroughModal` STEPS array, after "Share your results":

- **Icon:** `Zap` (from lucide-react, matches Parser Settings section)
- **Title:** "Maximize accuracy"
- **Description:** "Install Elite Insights locally for precise WvW metrics. Local parsing has no file size limits and works offline."

Same card layout and styling as the existing 3 steps — no visual changes to the modal structure.

### "Learn More" Behavior

When the user clicks "Learn More" on step 4, navigate to Settings → Parser Settings section (instead of Help & Updates). This uses the same navigation mechanism as the existing "Learn More" handler but targets a different settings section.

### Walkthrough Completion

When the walkthrough completes (either "Get Started" or "Learn More"), set `eiAnnouncementDismissed: true` in addition to the existing `walkthroughSeen: true`. This prevents new users from also seeing the launch banner.

---

## 2. Launch Banner for Existing Users

### Visual Design

Full-width accent strip at the top of the app content area:

- **Background:** `rgba(var(--brand-primary-rgb), 0.08)` (brand color at 8% opacity)
- **Top border:** `2px solid var(--brand-primary)`
- **Layout:** Flex row, space-between. Left side: ✦ icon + "**New feature:** Local Elite Insights parsing for accurate WvW stats". Right side: "Set up" button + ✕ close button.
- **"Set up" button:** `bg: rgba(var(--brand-primary-rgb), 0.12)`, `border: 1px solid rgba(var(--brand-primary-rgb), 0.3)`, brand-primary text, 4px border-radius, 11px font-weight-600
- **Close button:** Gray (`#6b7280`), 16px ✕

### Placement

Rendered inside `AppLayout.tsx`, above the main content area but below the navbar. Full width of the content region.

### Trigger Logic

The banner shows when ALL of these conditions are true:
- `eiAnnouncementDismissed` is not `true` in settings
- `walkthroughSeen` is `true` (user has already completed the FTE — new users get step 4 instead)

### Dismiss Behavior

Both actions permanently hide the banner:
- **"Set up" button:** Sets `eiAnnouncementDismissed: true`, navigates to Settings → Parser Settings section
- **✕ close button:** Sets `eiAnnouncementDismissed: true`, hides the banner

The `eiAnnouncementDismissed` flag is persisted via `saveSettings()` so the banner never reappears.

### Animation

The banner should animate out when dismissed using framer-motion (consistent with other animated elements in the app). A simple height/opacity exit transition.

---

## Files to Modify

### New Files
- `src/renderer/EiAnnouncementBanner.tsx` — The banner component. Self-contained: renders the accent strip, handles dismiss and navigate actions via props.

### Modified Files
- `src/renderer/WalkthroughModal.tsx` — Add step 4 to the STEPS array
- `src/renderer/app/AppLayout.tsx` — Render `EiAnnouncementBanner` above main content
- `src/renderer/app/hooks/useAppNavigation.ts` — Set `eiAnnouncementDismissed: true` on walkthrough completion. Add handler for banner "Set up" action (navigate to settings + scroll to parser-settings section).
- `src/renderer/app/hooks/useSettings.ts` — Load `eiAnnouncementDismissed` from settings
- `src/renderer/global.d.ts` — Add `eiAnnouncementDismissed?: boolean` to the saveSettings type

### Not Modified
- `src/main/` — No main process changes needed. `eiAnnouncementDismissed` is just another settings key handled by the existing `saveSettings`/`getSettings` IPC.
- `src/renderer/SettingsView.tsx` — No changes. The banner navigates to Parser Settings using existing section scroll mechanism.
