# Azure Trusted Signing for Windows Builds

**Date:** 2026-04-02
**Status:** Proposed

## Goal

Sign AxiBridge Windows builds (all `.exe` and `.dll` binaries + the NSIS installer) using Azure Trusted Signing so users don't see SmartScreen warnings. Signing happens only on release builds triggered by `v*` tags.

## Context

- AxiBridge is an Electron desktop app built with electron-builder
- Release builds run in GitHub Actions (`release.yml`) on `windows-latest`
- Currently no code signing is configured
- The user is an individual (not an organization)

## Approach

**Custom sign script with Azure CLI + OIDC federated credentials.** electron-builder calls a custom `sign` function for every binary it packages, which shells out to the `trusted-signing-cli` tool. Authentication uses OIDC (no stored secrets).

### Why this approach over alternatives

- **vs. post-build signing**: electron-builder's sign hook signs every `.exe`/`.dll` inside the app, not just the installer. SmartScreen checks individual binaries, so this gives full coverage.
- **vs. PFX-based signing**: OIDC federated credentials mean zero long-lived secrets in GitHub. More secure and easier to maintain.
- **vs. EV certificate + hardware token**: Azure Trusted Signing is cloud-native, works in CI without hardware tokens, and provides immediate SmartScreen trust at lower cost (~$10/month).

## Azure Resources (Manual Setup)

These must be created in the Azure portal before the CI changes work:

1. **Trusted Signing Account** — container resource in a supported region (East US, West US, West Europe, etc.)
2. **Certificate Profile** — type "Public Trust", individual identity. Triggers Microsoft identity validation.
3. **App Registration (Service Principal)** — used by GitHub Actions to authenticate via OIDC.
4. **Federated Credential** on the app registration — scoped to repo `darkharasho/axibridge`, subject filter for tag-based triggers so only release workflows can sign.
5. **Role Assignment** — grant the service principal the "Trusted Signing Certificate Profile Signer" role on the Trusted Signing Account.

### GitHub Actions Variables (not secrets — these are non-sensitive)

| Variable | Description |
|----------|-------------|
| `AZURE_CLIENT_ID` | App registration (service principal) client ID |
| `AZURE_TENANT_ID` | Azure AD tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription ID |
| `AZURE_CODE_SIGNING_ENDPOINT` | Trusted Signing account endpoint URL |
| `AZURE_CODE_SIGNING_ACCOUNT` | Trusted Signing account name |
| `AZURE_CODE_SIGNING_PROFILE` | Certificate profile name |

## Implementation

### 1. Sign Script: `build/sign.js`

A ~20-line Node.js script that:

1. Receives the file path from electron-builder's sign hook
2. Shells out to `trusted-signing-cli` with the file path and signing parameters from environment variables
3. Throws on non-zero exit code so electron-builder fails the build if signing fails

Environment variables consumed:
- `AZURE_CODE_SIGNING_ENDPOINT`
- `AZURE_CODE_SIGNING_ACCOUNT`
- `AZURE_CODE_SIGNING_PROFILE`

When these env vars are absent (local dev builds), the script exits early without signing — local builds continue to work unsigned.

### 2. `package.json` Changes

Add `sign` and `signingHashAlgorithms` to the `win` config:

```json
"win": {
    "artifactName": "AxiBridge-${version}-Setup.${ext}",
    "target": ["nsis"],
    "icon": "public/img/AxiBridge-white.png",
    "signingHashAlgorithms": ["sha256"],
    "sign": "./build/sign.js"
}
```

### 3. `release.yml` Workflow Changes

Changes to the Windows build matrix entry only. Linux build is untouched.

#### New steps (before the electron-builder step):

1. **Azure login** — `azure/login@v2` with OIDC:
   ```yaml
   - name: Azure login (OIDC)
     if: matrix.platform == 'win'
     uses: azure/login@v2
     with:
       client-id: ${{ vars.AZURE_CLIENT_ID }}
       tenant-id: ${{ vars.AZURE_TENANT_ID }}
       subscription-id: ${{ vars.AZURE_SUBSCRIPTION_ID }}
   ```

2. **Install trusted-signing-cli**:
   ```yaml
   - name: Install Trusted Signing CLI
     if: matrix.platform == 'win'
     run: npm install -g trusted-signing-cli
   ```

#### Modified step:

3. **Build and publish** — add signing env vars:
   ```yaml
   - name: Build and publish Electron distributables
     env:
       GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
       AZURE_CODE_SIGNING_ENDPOINT: ${{ vars.AZURE_CODE_SIGNING_ENDPOINT }}
       AZURE_CODE_SIGNING_ACCOUNT: ${{ vars.AZURE_CODE_SIGNING_ACCOUNT }}
       AZURE_CODE_SIGNING_PROFILE: ${{ vars.AZURE_CODE_SIGNING_PROFILE }}
     run: npx electron-builder ${{ matrix.args }} --publish always
   ```

### 4. Files Changed

| File | Change |
|------|--------|
| `build/sign.js` | New — custom signing script |
| `package.json` | Add `sign` + `signingHashAlgorithms` to `win` config |
| `.github/workflows/release.yml` | Add Azure login, CLI install, and env vars to Windows build |

## Security

- **No stored secrets**: OIDC federated credentials mean GitHub Actions gets a short-lived token directly from Azure. No client secrets, no PFX files.
- **Scoped access**: The federated credential is scoped to `darkharasho/axibridge` with a tag-based subject filter. Only release workflows can authenticate.
- **Role-based**: The service principal only has the "Trusted Signing Certificate Profile Signer" role — minimal permissions.

## Cost

- Azure Trusted Signing Basic tier: ~$9.99/month
- Includes up to 5,000 signatures/month (more than enough for release builds)

## Testing

- Local builds: run `npm run build:win` (if on Windows) — signing is skipped when env vars are absent, build succeeds unsigned.
- CI: push a `v*` tag after Azure resources and GitHub variables are configured. Verify the release artifacts are signed by checking the installer's digital signature properties in Windows.
