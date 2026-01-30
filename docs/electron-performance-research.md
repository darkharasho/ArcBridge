# Electron Performance & Threading Research Notes

Below is the original research content, formatted with proper Markdown for readability. No substantive wording has been changed.

---

## Summary

Below is a research‑backed implementation plan to eliminate UI freezes during uploads by pushing all heavy work off the UI threads (main + renderer), with evidence‑based reasoning and concrete steps tailored to Electron.

I’m not asking questions; this is a complete plan you can execute immediately.

---

## Evidence‑Backed Principles (Why the UI freezes)

1. **Main process is a UI thread.**  
   Electron’s main process “houses the UI thread” and must not run long CPU or blocking I/O. If it does, the entire app freezes. (electronjs.org)

2. **Renderer is also a UI thread.**  
   Anything heavy in the renderer (JSON transforms, large map/reduce, rendering big lists) will stutter or freeze; Web Workers are explicitly recommended to offload such work. (electronjs.org)

3. **CPU‑heavy work should use `worker_threads` (Node).**  
   Node docs emphasize workers for CPU‑intensive JS; they don’t help I/O‑bound work (use async I/O for that). (nodejs.org)

4. **Synchronous IPC can block renderers.**  
   Electron warns synchronous IPC blocks the renderer; use async IPC (`invoke`/`postMessage`) instead. (electronjs.org)

5. **Performance tracing is first‑class in Electron.**  
   Electron exposes Chromium’s tracing to find slow operations (evidence collection). (electronjs.org)

---

## Root Cause Hypothesis (Based on the evidence)

Even if system resources aren’t maxed, single‑threaded UI loops can be blocked by:

- CPU‑heavy parsing and aggregation
- Large structured clone IPC payloads
- Renderer reconciliation (big list updates)
- Cross‑process backpressure not managed (bursty IPC)

The plan below removes all of these from UI threads.

---

## Implementation Plan (All heavy work off UI threads)

### A) Main Process: Make it “pure orchestration”

**Goal:** Main thread only coordinates, no heavy CPU, no blocking I/O.

1) **Use a Main‑Process Worker Pool for CPU Tasks**  
Move CPU‑heavy tasks to `worker_threads`:
- File hashing  
- JSON parsing / decompression  
- Aggregations and metrics  

Why: Node docs recommend workers for CPU‑intensive JS. (nodejs.org)  
Expected outcome: no UI freeze during compute.

2) **Use async I/O everywhere in main**  
Replace any sync I/O with async versions:
- `fs.statSync` → `fs.promises.stat`
- `fs.readFileSync` → `fs.promises.readFile`
- `zlib.gunzipSync` → `zlib.gunzip` (async)

Why: Electron explicitly warns to avoid blocking I/O in main. (electronjs.org)

3) **Strict IPC budget: send only summaries to UI**  
Do not send full JSON to renderer during upload.  
Send only small summary payloads; keep full details cached in main for on‑demand fetch.

Why: IPC uses structured clone; large payloads cause expensive serialization and UI jank. (electronjs.org)

---

### B) Renderer: Offload all stats computation to Web Workers

**Goal:** Renderer only renders UI, not compute.

1) **Use Web Workers for Stats/Analytics**  
Heavy computations (scoreboards, per‑player aggregates, charts) run in a Web Worker.

Why: Web Workers are built for keeping UI smooth by moving heavy processing off the main thread. (developer.mozilla.org)

2) **Lazy load full log details**  
Renderer should request full log details only:
- when opening the Stats page
- when expanding a log card

Until then, render summary cards from the lightweight payloads.

---

### C) EI Parser Isolation: Separate OS process

**Goal:** EI parsing cannot block UI or Node’s main thread.

1) **Run EI parser in a dedicated worker/process**  
Even though EI uses external dotnet/wine, the JS orchestration can still block.  
Run EI CLI in a worker thread or child process and communicate via async IPC.

Why: Electron recommends worker threads or dedicated process for CPU‑heavy tasks. (electronjs.org)

2) **Rate‑limit and queue EI parsing**  
Use a queue with controlled concurrency (e.g., 1–2 simultaneous parses).  
This avoids system‑level spikes that still lead to UI stalls.

---

### D) IPC Design: Backpressure + batching

**Goal:** prevent message floods from overwhelming the renderer.

1) **Only send incremental progress events**  
Replace frequent “status updates” with:
- “upload started”
- “progress 25/50/75”
- “upload complete”

2) **Batch UI updates in renderer**  
Avoid re‑rendering on every IPC event. Instead, batch updates with minimal payloads.

---

### E) Verification / Evidence Capture

**Goal:** confirm no blocking work remains on main/renderer threads.

1) **Electron content tracing**  
Use `contentTracing` to capture a trace during upload and identify any blocking operations. (electronjs.org)  
Example: record during an upload and open in `chrome://tracing`.

2) **Chrome DevTools performance trace**  
Record the renderer thread and verify no long tasks during uploads. (developer.chrome.com)

---

## Expected Results

If implemented correctly:

- ✅ Main process never blocks → no app freeze
- ✅ Renderer never computes heavy stats → smooth UI
- ✅ EI parse runs isolated → no UI stalls
- ✅ IPC payloads are small → no message storm jank

---

## Concrete Action Checklist (Straight to Execution)

- Main process worker pool for hash/parse/metrics.
- Replace all sync I/O with async equivalents.
- Send summary payloads only on upload complete.
- Renderer Web Worker for stats.
- On‑demand fetch of full details for Stats/Expanded log.
- EI parser isolation (worker/child process).
- Add IPC throttling for status updates.
- Trace and verify using contentTracing + DevTools.
