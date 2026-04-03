# Release Notes

Version v2.2.2 — April 3, 2026

## More Color Palettes

Six new color palettes in the settings: Rose Pink, Violet Purple, Crimson Red, Slate Silver, Teal Ocean, and Gold Bronze. These work everywhere the original four did — desktop app and web reports.

## Fixes

Fixed palette colors sometimes not applying or reverting to default blue when switching tabs. The old code only knew about the original four palettes, so new ones would get stuck on the page or silently rejected when loading settings.

Fixed the CI release pipeline failing on Windows builds due to leftover signing config from an Azure Trusted Signing experiment.
