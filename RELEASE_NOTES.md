# Release Notes

Version v2.2.1 — April 2, 2026

## Player Role Classification

The stats dashboard now automatically classifies players as support or damage based on their actual performance — healing output, cleanses, boon generation, damage, and down contribution all feed into a weighted score. This classification gates MVP eligibility so healers aren't competing with DPS for the same leaderboard spots.

A new "Player Classification" tab in Developer Settings shows the full breakdown: per-player scores, confidence levels, and the factor weights that drove each classification. Hover any row to see exactly why a player was tagged as support or damage.

## Web Report Fixes

Fixed missing sections in the web report viewer and an SVG rendering issue where Lucide icons could disappear at small sizes due to Tailwind's preflight styles clipping strokes.

## GitHub Actions Releases

Releases now build on GitHub Actions instead of locally. Pushing a version tag triggers CI to run the full test suite, build Linux (AppImage) and Windows (NSIS) artifacts on native runners, deploy the web report to GitHub Pages, and publish the release. Local builds are still available via `/release patch local_build`.
