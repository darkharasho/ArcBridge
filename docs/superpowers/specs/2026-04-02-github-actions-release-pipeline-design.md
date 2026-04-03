# GitHub Actions Release Pipeline

## Overview

Add a GitHub Actions release workflow that builds electron artifacts (Linux AppImage + Windows NSIS) on native runners when a `v*` tag is pushed. Integrate with `/release` so the default path uses CI, with `local_build` as an opt-in fallback.

## Two Release Modes

### CI mode (default): `/release patch`

1. Release-builder agent generates release notes → user approves
2. `scripts/prepare-release.mjs` runs: validate → ci:local → bump version → commit (version + release notes) → push → create tag → push tag
3. Tag push triggers `.github/workflows/release.yml`:
   - **test**: audits + unit tests + Playwright e2e (headless)
   - **build** (matrix: linux, windows): `npm run build` → `npx electron-builder --publish always`
   - **deploy-pages**: `npm run build:web` → deploy `dist-web/` to GitHub Pages via `actions/deploy-pages`
   - **publish**: `gh release edit --draft=false`

### Local mode: `/release patch local_build`

1. Release-builder agent generates release notes → user approves
2. `scripts/build-github.mjs` runs the full local pipeline (unchanged): validate → ci:local → bump → build → commit-web-dist → electron-builder → upload artifacts → tag → push

## New Files

### `.github/workflows/release.yml`

Triggered by `v*` tag push. Permissions: `contents: write`, `pages: write`, `id-token: write`.

**Jobs:**

| Job | Runs on | Depends on | Purpose |
|-----|---------|------------|---------|
| test | ubuntu-latest | — | audit:boons, audit:metrics, audit:conditions:consistency, test:unit, test:e2e:web, test:e2e:electron |
| build | matrix (ubuntu-latest, windows-latest) | test | npm run build → electron-builder --publish always |
| deploy-pages | ubuntu-latest | build | npm run build:web → actions/deploy-pages |
| publish | ubuntu-latest | build, deploy-pages | gh release edit --draft=false |

Build matrix:

| Runner | electron-builder args |
|--------|----------------------|
| ubuntu-latest | `--linux AppImage` |
| windows-latest | `--win nsis` |

Environment: Node 22, npm cache. `NODE_OPTIONS=--max-old-space-size=6144` for build steps. `GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` for electron-builder publish.

### `scripts/prepare-release.mjs`

Lightweight CI-mode prep script. Accepts: bump type (patch/minor/major/none), `--skip-release-notes`.

Steps:
1. `npm run validate`
2. `npm run ci:local`
3. Bump version in package.json (if bump type provided)
4. `npm install` (update lockfile)
5. `git add package.json package-lock.json RELEASE_NOTES.md`
6. `git commit -m "chore: release v<VERSION>"`
7. `git push`
8. `git tag v<VERSION>`
9. `git push origin v<VERSION>`

Reuses the `bumpVersion()` logic from `build-github.mjs`.

## Modified Files

### `.github/workflows/ci.yml`

- Node version: 20 → 22

### `.claude/agents/release-builder.md`

Job 2 updated to support two modes:

- **Default (CI)**: runs `node scripts/prepare-release.mjs <BUMP_TYPE> --skip-release-notes`, then informs user that CI is building and provides a link to the Actions run
- **`local_build`**: runs `node scripts/build-github.mjs <BUMP_TYPE> --skip-release-notes` (current behavior)

Agent description updated to document the `local_build` option.

## Unchanged

- `scripts/build-github.mjs` — full local pipeline, no changes
- `scripts/run-electron-builder.mjs` — used by local builds only
- `scripts/update-github-release.mjs` — used by local builds only
- electron-builder config in `package.json`
- Release notes generation (Job 1 in agent)
