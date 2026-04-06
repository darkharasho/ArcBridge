# Release Notes

Version v2.3.5 — April 6, 2026

## Fixes

Fixed the Damage Mitigation section showing broken per-second values (NaN or Infinity) when "Split Players by Class" was enabled. The per-player fight time wasn't being looked up correctly, so everything divided by zero. Also renamed the section header from "Defense Mitigation" to "Damage Mitigation" to match the navbar.
