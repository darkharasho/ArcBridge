# Release Notes

Version v1.37.9 — February 27, 2026

## 🌟 Highlights
- Theme memory now more reliable: theme IDs are normalized and legacy kinetic reports are recognized, so your chosen look sticks across sessions.
- CRT and Classic themes get a sidebar settings layout for easier customization.
- Accessibility: onboarding flow and tests now use role-based headings to better support assistive tech.

## 🛠️ Improvements
- Settings area now treats Classic and CRT as part of the modern layout for a consistent appearance.
- Theme ID handling trims and validates values before applying to the UI.
- If a report from an older kinetic setup is detected, ArcBridge will automatically apply the kinetic dark theme for the best experience.

## 🧯 Fixes
- Improved handling of stored theme IDs to avoid misapplied themes.
- Legacy kinetic reports are wired to select the correct kinetic theme automatically.
- When loading a report, the app won’t fetch theme data if it’s a legacy kinetic case.

## ⚠️ Breaking Changes
None.
