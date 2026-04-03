# GitHub Actions Release Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a GitHub Actions release workflow that builds electron artifacts on native runners (Linux + Windows) when a `v*` tag is pushed, and integrate it with `/release` so CI is the default path with local builds as an opt-in fallback.

**Architecture:** New `release.yml` workflow with test → build matrix → deploy-pages → publish jobs. New `prepare-release.mjs` script handles local prep (validate, test, bump, tag, push) for CI mode. Existing `build-github.mjs` stays untouched for local mode. Release-builder agent updated to route between the two.

**Tech Stack:** GitHub Actions, electron-builder, actions/deploy-pages, Node 22

---

### Task 1: Create `scripts/prepare-release.mjs`

**Files:**
- Create: `scripts/prepare-release.mjs`

This script handles the local prep for CI-mode releases: validate, run local CI, bump version, commit, push, tag, push tag. It reuses the same arg parsing and version bumping logic from `build-github.mjs`.

- [ ] **Step 1: Create the script**

```js
#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);

const readBumpArg = () => {
    const allowedBumps = new Set(['patch', 'minor', 'major']);
    const bumpIndex = args.findIndex((arg) => arg === '--bump');
    if (bumpIndex >= 0 && args[bumpIndex + 1]) return args[bumpIndex + 1];
    const direct = args.find((arg) => allowedBumps.has(arg));
    return direct || null;
};

const allowedBumps = new Set(['patch', 'minor', 'major']);
const bumpType = readBumpArg();
const skipReleaseNotes = args.includes('--skip-release-notes') || args.includes('--no-release-notes');

const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';
const gitCmd = isWin ? 'git.exe' : 'git';

const run = (command, commandArgs, options = {}) => {
    const result = spawnSync(command, commandArgs, { stdio: 'inherit', ...options });
    if (result.status !== 0) {
        const error = new Error(`Command failed: ${command} ${commandArgs.join(' ')}`);
        error.exitCode = result.status ?? 1;
        throw error;
    }
};

const bumpVersion = (current, type) => {
    const match = current.match(/^(\d+)\.(\d+)\.(\d+)/);
    if (!match) {
        throw new Error(`Unsupported version format: ${current}`);
    }
    let major = Number(match[1]);
    let minor = Number(match[2]);
    let patch = Number(match[3]);

    if (type === 'major') { major += 1; minor = 0; patch = 0; }
    else if (type === 'minor') { minor += 1; patch = 0; }
    else if (type === 'patch') { patch += 1; }

    return `${major}.${minor}.${patch}`;
};

const packagePath = path.resolve('package.json');
const packageRaw = fs.readFileSync(packagePath, 'utf8');
const packageJson = JSON.parse(packageRaw);
const currentVersion = String(packageJson.version || '').trim();

if (!currentVersion) {
    console.error('package.json is missing a version.');
    process.exit(1);
}

const nextVersion = bumpType ? bumpVersion(currentVersion, bumpType) : currentVersion;
const tagName = `v${nextVersion}`;

try {
    // Validate and test
    run(npmCmd, ['run', 'validate']);
    run(npmCmd, ['run', 'ci:local']);

    // Bump version
    if (bumpType) {
        if (!allowedBumps.has(bumpType)) {
            console.error(`Invalid bump type: ${bumpType}. Use patch, minor, or major.`);
            process.exit(1);
        }
        packageJson.version = nextVersion;
        fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 4)}\n`);
        run(npmCmd, ['install']);
    }

    // Generate release notes if not skipped
    if (!skipReleaseNotes) {
        run(npmCmd, ['run', 'generate:release-notes']);
    }

    // Commit
    const filesToAdd = ['package.json', 'package-lock.json'];
    if (fs.existsSync(path.resolve('RELEASE_NOTES.md'))) {
        filesToAdd.push('RELEASE_NOTES.md');
    }
    run(gitCmd, ['add', ...filesToAdd]);
    run(gitCmd, ['commit', '-m', `chore: release ${tagName}`]);
    run(gitCmd, ['push']);

    // Tag and push tag
    run(gitCmd, ['tag', tagName]);
    run(gitCmd, ['push', 'origin', tagName]);

    console.log(`\nRelease ${tagName} prepared and tag pushed.`);
    console.log('GitHub Actions will now build and publish the release.');
} catch (error) {
    const exitCode = error?.exitCode ?? 1;
    process.exit(exitCode);
}
```

- [ ] **Step 2: Verify the script is valid**

Run: `node --check scripts/prepare-release.mjs`
Expected: No output (clean syntax)

- [ ] **Step 3: Commit**

```bash
git add scripts/prepare-release.mjs
git commit -m "feat(release): add prepare-release script for CI-mode releases"
```

---

### Task 2: Create `.github/workflows/release.yml`

**Files:**
- Create: `.github/workflows/release.yml`

The workflow triggers on `v*` tag push. Four jobs: test, build (matrix), deploy-pages, publish.

- [ ] **Step 1: Create the workflow file**

```yaml
name: Build Release Artifacts

on:
  push:
    tags:
      - 'v*'

permissions:
  contents: write
  pages: write
  id-token: write

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Audit boon generation
        run: npm run audit:boons

      - name: Audit combat metrics
        run: npm run audit:metrics

      - name: Audit conditions consistency
        run: npm run audit:conditions:consistency

      - name: Unit tests
        run: npm run test:unit

      - name: Install Playwright browsers
        run: npx playwright install --with-deps

      - name: Web E2E tests
        run: npm run test:e2e:web

      - name: Electron E2E tests
        run: xvfb-run -a npm run test:e2e:electron

  build:
    needs: [test]
    strategy:
      matrix:
        include:
          - os: ubuntu-latest
            platform: linux
            args: --linux AppImage
          - os: windows-latest
            platform: win
            args: --win nsis
    runs-on: ${{ matrix.os }}

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Build app
        run: npm run build
        env:
          NODE_OPTIONS: --max-old-space-size=6144

      - name: Build and publish Electron distributables
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: npx electron-builder ${{ matrix.args }} --publish always

  deploy-pages:
    needs: [build]
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Build web report
        run: npm run build:web
        env:
          NODE_OPTIONS: --max-old-space-size=6144

      - name: Setup Pages
        uses: actions/configure-pages@v5

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: dist-web

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4

  publish:
    needs: [build, deploy-pages]
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Publish release
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          tag="${GITHUB_REF#refs/tags/}"
          gh release edit "$tag" --draft=false
```

- [ ] **Step 2: Validate YAML syntax**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/release.yml'))"`
Expected: No output (valid YAML). If `pyyaml` isn't installed, use: `node -e "const fs=require('fs'); console.log('OK')"`

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "feat(ci): add release workflow for Linux and Windows builds"
```

---

### Task 3: Update `.github/workflows/ci.yml` — Node 20 → 22

**Files:**
- Modify: `.github/workflows/ci.yml` (lines 19, 31, 55 — `node-version: 20` → `node-version: 22`)

- [ ] **Step 1: Update all three Node version references**

Change every occurrence of `node-version: 20` to `node-version: 22` in `.github/workflows/ci.yml`. There are three instances (audit-boons job line 19, audit-metrics job line 31, tests job line 55).

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "chore(ci): bump Node version from 20 to 22"
```

---

### Task 4: Update release-builder agent

**Files:**
- Modify: `.claude/agents/release-builder.md`

Update the agent to support both CI (default) and local_build modes.

- [ ] **Step 1: Update the agent description**

Replace the current `description` field in the frontmatter to include the `local_build` option:

```
description: "Use this agent when the user invokes the /release command with an argument of major, minor, patch, or none. This agent handles the full release flow: bumping the version (unless 'none'), generating release notes by analyzing recent changes, and running the build process.\n\nBy default, releases use GitHub Actions (CI mode): the agent prepares the release locally (validate, test, bump, tag) then pushes a tag to trigger CI builds. Pass 'local_build' as an additional argument to build artifacts locally instead.\n\nExamples:\n\n<example>\nContext: The user wants a CI-built minor release.\nuser: \"/release minor\"\nassistant: \"I'll use the release-builder agent to bump the minor version, generate release notes, and trigger a CI build.\"\n</example>\n\n<example>\nContext: The user wants a local build.\nuser: \"/release patch local_build\"\nassistant: \"I'll use the release-builder agent to bump the patch version, generate release notes, and run a full local build.\"\n</example>\n\n<example>\nContext: The user wants to rebuild without a version bump.\nuser: \"/release none\"\nassistant: \"I'll use the release-builder agent to generate release notes and trigger a CI build without changing the version.\"\n</example>"
```

- [ ] **Step 2: Update Job 2 to support both modes**

Replace the existing Job 2 section (starting at `## Job 2: Run the Build Pipeline`) with:

```markdown
## Job 2: Run the Build Pipeline

Once notes are approved, determine the build mode from the user's arguments.

### CI mode (default — no `local_build` argument)

Run **exactly one command**:

\`\`\`bash
# If bump type is none:
node scripts/prepare-release.mjs --skip-release-notes

# If bump type is major, minor, or patch:
node scripts/prepare-release.mjs <BUMP_TYPE> --skip-release-notes
\`\`\`

This script handles: validate → ci:local → version bump + commit + push → git tag + push tag.

After the tag is pushed, GitHub Actions will automatically build the release artifacts and deploy. Tell the user:
- The tag has been pushed and CI is building
- Link to the Actions run: `https://github.com/darkharasho/axibridge/actions`
- The release will appear at `https://github.com/darkharasho/axibridge/releases` once CI completes

### Local mode (`local_build` argument present)

Run **exactly one command**:

\`\`\`bash
# If bump type is none:
node scripts/build-github.mjs --skip-release-notes

# If bump type is major, minor, or patch:
node scripts/build-github.mjs <BUMP_TYPE> --skip-release-notes
\`\`\`

This script handles: validate → ci:local → version bump + commit + push → build → commit-web-dist → electron-builder (linux + win) → git tag + push → GitHub Release upload.

Report the script's output. If it fails, show the error and suggest fixes. Do not attempt to manually run the steps it would have run.
```

- [ ] **Step 3: Update the FORBIDDEN list**

Add `node scripts/prepare-release.mjs` individual steps to the forbidden list. The existing forbidden commands remain. No new commands need to be forbidden since `prepare-release.mjs` is the single entry point for CI mode (same pattern as `build-github.mjs` for local mode).

- [ ] **Step 4: Commit**

```bash
git add .claude/agents/release-builder.md
git commit -m "feat(release): update release-builder agent to support CI and local_build modes"
```

---

### Task 5: Add `prepare:release` npm script

**Files:**
- Modify: `package.json` (scripts section, around line 26)

- [ ] **Step 1: Add the script**

Add after the `build:github` script entry in `package.json`:

```json
"prepare:release": "node scripts/prepare-release.mjs",
```

- [ ] **Step 2: Commit**

```bash
git add package.json
git commit -m "chore: add prepare:release npm script"
```
