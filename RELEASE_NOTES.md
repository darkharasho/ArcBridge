# Release Notes

Version v2.2.4 — April 3, 2026

## Memory Fix for Windows Users

Fixed an out-of-memory crash that hit Windows users with longer sessions. The renderer was holding strong references to full log detail objects in an internal cache, preventing garbage collection even after they were evicted from the main LRU. With 20+ WvW logs loaded, this could pin hundreds of megabytes of dead data in memory.

The fix uses weak references so the GC can actually reclaim evicted details, and drops the in-memory detail cache cap from 50 to 15 (IndexedDB still has everything — this only affects what's kept hot in RAM). The aggregation result cache was also trimmed from 5 slots to 2.

## Stats Dashboard Responsiveness

The stats batching timer was too conservative (1200ms) — you'd sometimes wait over a second for the dashboard to reflect a newly uploaded log. Now batches at 400ms with a retry if details are still loading, instead of silently dropping the update. Also added a follow-up publish after log count changes so completed uploads show up without waiting for the next debounce cycle.
