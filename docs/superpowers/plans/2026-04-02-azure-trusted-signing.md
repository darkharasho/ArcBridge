# Azure Trusted Signing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sign Windows release builds with Azure Trusted Signing via electron-builder's custom sign hook.

**Architecture:** A custom `build/sign.js` script is called by electron-builder for each binary. It shells out to `trusted-signing-cli`. GitHub Actions authenticates via OIDC federated credentials. When signing env vars are absent (local builds), the script no-ops.

**Tech Stack:** Node.js (child_process), electron-builder custom sign, trusted-signing-cli, GitHub Actions OIDC, azure/login action

---

### Task 1: Create the custom sign script

**Files:**
- Create: `build/sign.js`

- [ ] **Step 1: Create `build/sign.js`**

```js
const { execFileSync } = require("child_process");

exports.default = async function sign(configuration) {
  const endpoint = process.env.AZURE_CODE_SIGNING_ENDPOINT;
  const account = process.env.AZURE_CODE_SIGNING_ACCOUNT;
  const profile = process.env.AZURE_CODE_SIGNING_PROFILE;

  if (!endpoint || !account || !profile) {
    console.log(`Skipping signing (env vars not set): ${configuration.path}`);
    return;
  }

  console.log(`Signing: ${configuration.path}`);

  execFileSync("trusted-signing-cli", [
    "-e", endpoint,
    "-a", account,
    "-c", profile,
    "-r", "http://timestamp.acs.microsoft.com",
    "-d", "sha256",
    configuration.path,
  ], { stdio: "inherit" });
};
```

This script:
- Exports a `default` async function (electron-builder's expected signature for custom sign scripts)
- Reads signing config from environment variables
- Exits early with a log message when env vars are absent (local dev builds)
- Calls `trusted-signing-cli` with the file path, endpoint, account, profile, timestamp server, and digest algorithm
- Uses `execFileSync` so electron-builder waits for signing to complete and a non-zero exit code throws automatically

- [ ] **Step 2: Verify the script is syntactically valid**

Run: `node -c build/sign.js`
Expected: No output (success)

- [ ] **Step 3: Commit**

```bash
git add build/sign.js
git commit -m "feat(signing): add Azure Trusted Signing script for electron-builder"
```

---

### Task 2: Update electron-builder win config

**Files:**
- Modify: `package.json:139-145` (the `win` section)

- [ ] **Step 1: Add `sign` and `signingHashAlgorithms` to the `win` config**

In `package.json`, change the `win` block from:

```json
"win": {
    "artifactName": "AxiBridge-${version}-Setup.${ext}",
    "target": [
        "nsis"
    ],
    "icon": "public/img/AxiBridge-white.png"
},
```

to:

```json
"win": {
    "artifactName": "AxiBridge-${version}-Setup.${ext}",
    "target": [
        "nsis"
    ],
    "icon": "public/img/AxiBridge-white.png",
    "signingHashAlgorithms": [
        "sha256"
    ],
    "sign": "./build/sign.js"
},
```

- [ ] **Step 2: Verify package.json is valid JSON**

Run: `node -e "require('./package.json')"`
Expected: No output (success)

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "feat(signing): configure electron-builder to use custom sign script"
```

---

### Task 3: Update release workflow for Azure Trusted Signing

**Files:**
- Modify: `.github/workflows/release.yml:54-75` (the `build` job steps)

- [ ] **Step 1: Add Azure login and CLI install steps, and signing env vars**

In `.github/workflows/release.yml`, replace the `build` job's `steps` section (lines 54-75) with:

```yaml
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

      - name: Azure login (OIDC)
        if: matrix.platform == 'win'
        uses: azure/login@v2
        with:
          client-id: ${{ vars.AZURE_CLIENT_ID }}
          tenant-id: ${{ vars.AZURE_TENANT_ID }}
          subscription-id: ${{ vars.AZURE_SUBSCRIPTION_ID }}

      - name: Install Trusted Signing CLI
        if: matrix.platform == 'win'
        run: npm install -g trusted-signing-cli

      - name: Build app
        run: npm run build
        env:
          NODE_OPTIONS: --max-old-space-size=6144

      - name: Build and publish Electron distributables
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          AZURE_CODE_SIGNING_ENDPOINT: ${{ vars.AZURE_CODE_SIGNING_ENDPOINT }}
          AZURE_CODE_SIGNING_ACCOUNT: ${{ vars.AZURE_CODE_SIGNING_ACCOUNT }}
          AZURE_CODE_SIGNING_PROFILE: ${{ vars.AZURE_CODE_SIGNING_PROFILE }}
        run: npx electron-builder ${{ matrix.args }} --publish always
```

The two new steps (`Azure login` and `Install Trusted Signing CLI`) are conditioned on `matrix.platform == 'win'` so they skip on the Linux runner. The three `AZURE_CODE_SIGNING_*` env vars are passed to the build step for both platforms — the sign script will no-op on Linux since `trusted-signing-cli` isn't installed and the script early-returns when env vars are absent.

- [ ] **Step 2: Validate the YAML syntax**

Run: `npx yaml-lint .github/workflows/release.yml || node -e "const fs=require('fs');const yaml=require('yaml');yaml.parse(fs.readFileSync('.github/workflows/release.yml','utf8'));console.log('Valid YAML')"`

If `yaml-lint` isn't available, verify manually that the indentation is correct (2-space indent under `steps`, 4-space under properties).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "feat(signing): add Azure OIDC login and Trusted Signing to release workflow"
```

---

### Task 4: Manual verification checklist

This task is not code — it documents the Azure portal and GitHub setup steps the user must complete before signing works.

- [ ] **Step 1: Verify Azure resources are created**

In the Azure portal, confirm:
1. Trusted Signing Account exists and is in a supported region
2. Certificate Profile of type "Public Trust" exists and identity validation is complete
3. App Registration exists with a federated credential for `repo:darkharasho/axibridge:ref:refs/tags/*`
4. The app registration has the "Trusted Signing Certificate Profile Signer" role on the Trusted Signing Account

- [ ] **Step 2: Set GitHub Actions variables**

In the repo settings (Settings > Secrets and variables > Actions > Variables), create:
- `AZURE_CLIENT_ID` — from the app registration
- `AZURE_TENANT_ID` — from Azure AD
- `AZURE_SUBSCRIPTION_ID` — from the Azure subscription
- `AZURE_CODE_SIGNING_ENDPOINT` — the Trusted Signing account endpoint URL (e.g., `https://eus.codesigning.azure.net`)
- `AZURE_CODE_SIGNING_ACCOUNT` — the Trusted Signing account name
- `AZURE_CODE_SIGNING_PROFILE` — the certificate profile name

- [ ] **Step 3: Test with a release build**

Push a `v*` tag to trigger the release workflow. After the build completes:
1. Download the Windows installer from the GitHub release
2. Right-click the `.exe` > Properties > Digital Signatures tab
3. Verify a valid signature is present with your identity
