# Release Notes

Version v2.4.0 — April 8, 2026

## Local Elite Insights Parsing

You can now install Elite Insights directly inside AxiBridge and parse logs locally instead of relying on dps.report. This gives you more accurate WvW metrics — especially down contribution — plus no file size limits and offline support. When EI is installed, logs are parsed locally first, with a dps.report permalink fetched in the background so your Discord links still work.

Head to Settings → Parser Settings to install. AxiBridge handles the download, extraction, and .NET runtime setup automatically.

## EI Onboarding

New users see a 4th walkthrough step pointing them to local parsing. Existing users get a one-time banner at the top of the app with a quick "Set up" button that takes you straight to Parser Settings. Both dismiss permanently once acknowledged.

## Parser Settings

New settings section for managing your local EI installation:

- Install, update, reinstall, or uninstall Elite Insights
- Check for updates with animated feedback
- "Force dps.report Only" toggle to bypass local parsing when you want to
- Tune parse settings like memory limits, fight duration thresholds, and WvW detail level

All buttons have particle hover effects that match their action color (blue for install, green for update, red for uninstall).

## Log Card Status

Log cards now show a "Parsing log locally..." status while EI is running, with a progress indicator. You can cancel an in-progress parse the same way you cancel uploads.

## Fixes

- Log cards no longer flip from "done" back to "discord" status during the EI upload path. The discord notification now fires before the upload-complete event, matching the dps.report path ordering.
- Download progress no longer flashes "NaN%" during the initial phase of an EI install.
- Uninstalling EI now immediately updates the UI state instead of waiting for an IPC event.
