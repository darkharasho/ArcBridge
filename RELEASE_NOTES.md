# Release Notes

Version v2.2.2 — April 3, 2026

## Fixes

Fixed the CI release pipeline failing on Windows builds. The electron-builder config had signing options (`signingHashAlgorithms`, `sign`) that aren't valid in v26 — leftover from an Azure Trusted Signing experiment that didn't pan out. Removed them along with the related Azure OIDC steps in the GitHub Actions workflow.
