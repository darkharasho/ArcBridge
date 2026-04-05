# Release Notes

Version v2.3.0 — April 4, 2026

## Real-Time Stats Loading Progress

The stats dashboard now shows per-fight progress as logs are processed. Instead of a vague spinner, you'll see "3 of 17 fights loaded" counting up in real time. Each log on the dashboard also transitions from "calculating" to "done" individually as the worker ingests it, rather than all flipping at once after the entire batch finishes.

## Incremental Stats Engine

Stats computation was rewritten to process logs one at a time and discard each log's raw data after extracting what it needs. The old approach held every log in memory simultaneously while computing, which got expensive with 30+ WvW logs. Now each log is ingested, its stats are folded into running totals, and the raw data is released for garbage collection immediately.

Both the Web Worker path (>8 logs) and the inline fallback path use the same incremental engine, so behavior is consistent regardless of log count.

## Fewer Redundant Worker Restarts

Previously, bulk uploads could trigger multiple worker restarts as hydration batches trickled in — each restart reprocessing all logs from scratch. The worker now starts once after bulk upload ends, and hydration no longer force-restarts it. Worker progress messages are also throttled to every 250ms to avoid flooding the renderer during large sessions.

## Fixes

- Logs no longer get stuck showing "calculating" forever. The promotion path from calculating to done is now tied directly to the worker's per-log ingestion progress instead of relying on several independent status flags that could disagree.
- Hydration no longer silently overwrites log status to "success" before the worker has processed the log. This was the root cause of the dashboard saying "done" while stats showed nothing computed.
