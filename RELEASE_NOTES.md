# Release Notes

Version v1.29.1 — February 13, 2026

## 🌟 Highlights
- Compatibility patch to fix legacy custom icon URLs when hosting under subpaths (e.g., GitHub Pages).
- Icon components refactored to load assets from dynamic paths for more robust rendering.
- Class icons are shown by default in the UI for clearer visuals.
- Subtle visual/style polish across the app.

## 🛠️ Improvements
- Icons now resolve via dynamic asset paths, improving reliability across hosting setups.
- Rendering logic updated to show icons and detailed class info in more views.
- Styling tweaks to the CRT-themed visuals for a smoother look.

## 🧯 Fixes
- Build/upload patch rewrites legacy icon URLs from /svg/custom-icons/ to ./svg/custom-icons/ so icons render when reports are hosted under subpaths.
- General asset path resolution updates to prevent broken icons in older templates.

## ⚠️ Breaking Changes
- None.
