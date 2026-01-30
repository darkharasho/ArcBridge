# Electron Performance & Threading Plan

This document captures the research-backed plan to eliminate UI freezes during uploads by moving heavy processing off the main and renderer threads.

## Why the UI freezes (evidence-based)

- **Main process is a UI thread** and must not perform long CPU or blocking I/O work. Electron explicitly warns against blocking the main process because it freezes the UI.  
  Source: https://www.electronjs.org/docs/latest/tutorial/performance
- **Renderer is also a UI thread.** Heavy computation in the renderer will stutter or freeze the UI; Electron recommends Web Workers for CPU-heavy work.  
  Source: https://www.electronjs.org/docs/latest/tutorial/performance
- **`worker_threads` are intended for CPU-heavy work**, not I/O-bound work.  
  Source: https://nodejs.org/api/worker_threads.html
- **Synchronous IPC blocks the renderer**; Electron recommends async IPC only.  
  Source: https://www.electronjs.org/docs/api/ipc-renderer/
- **Tracing is supported** for performance profiling during uploads.  
  Source: https://www.electronjs.org/docs/latest/api/content-tracing

## Goal

Make the main process “pure orchestration” and ensure all CPU-heavy tasks run in background workers. Renderer should only render UI and use Web Workers for expensive computations.

---

## Step-by-step implementation plan

### Phase 1: Main process worker pool (CPU heavy work)

**Goal:** All CPU-intensive tasks run in Node worker threads.

1. **Define worker message types**  
   - File: `src/workers/main/types.ts`  
   - Include `HASH`, `JSON_PARSE`, `METRICS`, `SHUTDOWN`.

2. **Create processing worker**  
   - File: `src/workers/main/processingWorker.ts`  
   - Implement handlers for:
     - `HASH`: compute file hash using streams
     - `JSON_PARSE`: async gzip inflate + JSON.parse
     - `METRICS`: compute condition metrics
   - Respond via `WorkerResponse` with success or error.

3. **Create a worker pool**  
   - File: `src/workers/main/workerPool.ts`  
   - Dynamically scale up to `CPU-1` workers.
   - Provide a simple API:
     - `hash(filePath)`
     - `parseJson(filePath, isGzipped)`
     - `computeMetrics(payload)`
   - Include timeouts and fallbacks (fallbacks can run on main, but should be considered emergency only).

4. **Initialize the pool in main**  
   - File: `src/main/index.ts`  
   - Call `initWorkerPool()` in `app.whenReady()`.

5. **Route heavy operations through the pool**
   - `computeFileHash()` → `getWorkerPool().hash`
   - JSON parse → `getWorkerPool().parseJson`
   - condition metrics → `getWorkerPool().computeMetrics`


### Phase 2: Main process async I/O sweep

**Goal:** Remove any synchronous disk/network operations on the main thread.

1. Replace all `fs.*Sync` with async equivalents:
   - `fs.statSync` → `fs.promises.stat`
   - `fs.readFileSync` → `fs.promises.readFile`
   - `fs.mkdirSync` → `fs.promises.mkdir`

2. Replace `zlib.gunzipSync` with async `zlib.gunzip`.

3. Audit for `spawnSync`:
   - Replace with `spawn` + `await` for async process handling.


### Phase 3: Reduce IPC payload size (main → renderer)

**Goal:** prevent UI jank from huge IPC transfers.

1. **Send only summary data** on upload completion:
   - `fightName`, `encounterDuration`, `uploadTime`, `durationMS`, `dashboardSummary` (if available)
   - Do **not** send full EI JSON to the renderer immediately.

2. **Cache full details in main** (in-memory cache):
   - Map by `filePath` or hash.
   - Expose IPC to fetch full details only when needed.


### Phase 4: Web Worker for renderer stats

**Goal:** renderer only renders UI; heavy stats computed in a Web Worker.

1. **Create Web Worker**
   - File: `src/workers/renderer/statsWorker.ts`
   - Accept logs + settings, return computed stats object.

2. **Create hook for worker management**
   - File: `src/workers/renderer/useStatsWorker.ts`
   - Manage worker lifecycle, loading/error state, and message passing.

3. **Integrate into StatsView**
   - File: `src/renderer/StatsView.tsx`
   - For large log batches, use worker results instead of local `useMemo` compute.


### Phase 5: EI parser isolation

**Goal:** EI parsing cannot block UI.

1. **Move EI parsing to its own worker or child process**  
   - `worker_threads` or `child_process` is acceptable.
   - Only send “EI ready” event to renderer.

2. **On-demand EI data fetch**  
   - Renderer asks for EI JSON when StatsView opens or log is expanded.
   - Avoid sending EI JSON automatically on upload completion.

3. **Queue and rate-limit EI parsing**  
   - Keep concurrency low (1–2).


### Phase 6: Renderer update batching

**Goal:** prevent frequent state updates from freezing UI.

1. Batch upload status updates:
   - Buffer incoming events, flush on a timer or animation frame.

2. Avoid large lists re-rendering frequently:
   - Consider virtualization if log lists get large.


### Phase 7: Performance verification

**Goal:** confirm no blocking work remains.

1. Use `contentTracing` in Electron to identify blocking spans.  
2. Use Chrome DevTools performance trace to validate renderer thread is free during uploads.


---

## Deliverables checklist (for implementation)

- [ ] Worker pool for main process heavy tasks
- [ ] Async I/O only (no `Sync` fs/zlib/spawn)
- [ ] Summary-only IPC payloads
- [ ] Web Worker for stats computations
- [ ] EI parser isolated in worker or child process
- [ ] IPC throttling/batching
- [ ] Tracing verification

---

## Notes

If UI freezes persist after these changes, likely causes are:
- Excessive IPC traffic causing renderer event-loop saturation
- Large list re-renders without virtualization
- Third‑party parsing processes consuming CPU without priority limits

All of these are mitigated in the plan above.
