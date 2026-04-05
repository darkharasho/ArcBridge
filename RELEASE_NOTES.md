# Release Notes

Version v2.3.2 — April 5, 2026

## Cleaner Stats Internals

The stats pipeline got a significant cleanup under the hood. The old code used 7 overlapping timers to decide when to publish log data to the stats worker — a 400ms debounce, a 600ms retry, a 300ms follow-up, plus four more for edge cases. All of that is now a single 400ms debounce. Snapshot key deduplication prevents unnecessary recomputes when the data hasn't actually changed.

The `statsSyncRecovery` mechanism (a polling loop that detected when stats got stuck and force-resynced) is gone entirely — the simplified pipeline makes it unnecessary.

## Details Status Cleanup

Log detail-fetching state used to be tracked by five separate boolean flags (`detailsAvailable`, `detailsLoading`, `statsDetailsLoaded`, `detailsFetchExhausted`, `detailsKnownUnavailable`). These are now a single `detailsStatus` field with clear states: `idle`, `available`, `loading`, `loaded`, `exhausted`, `unavailable`. Less state to get out of sync, fewer impossible combinations to guard against.

## Single Stats Codepath

The old batch `computeStatsAggregation` function (870 lines) is deleted. All stats computation now goes through the incremental aggregator, whether you have 1 log or 100. The worker and inline paths share the same code.
