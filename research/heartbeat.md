# Heartbeat test (D5): PARTIAL, stopped early

> 2026-11-12, Chrome 157, Gemma 4 on the NVIDIA GPU (demo-laptop flags; see prompts.md).
> **Verdict: inconclusive.** The test was stopped at ~10 min on request (11:11:47), before a single heartbeat cycle ran on a loaded model. It did confirm the idle unload on Chrome 157.

## Method (as run)

- **Process monitor:** a background PowerShell loop every 30 s logged each `chrome.exe` whose command line contains `on_device_model` (PID, CreationDate, private MB, CPU s) to `scratchpad/hb-procs.log`. PID 23416 (115 MB, created 10:34:25) is a small helper process, not the model, and is ignored below.
- **In the page** (`https://example.com`), one dedicated clone of the v4 base session received a tiny prompt, `"ok"`, every 4 min. Each heartbeat logged the send time, `document.visibilityState`, first-token and total latency to `window.__hb`, and a `[HB]` console line.
- **First run (11:01:47):** heartbeats were sent only while the tab was visible, as D5 proposes. **The 11:05:55 heartbeat was skipped because the tab was hidden** (the user was presumably on another tab or window). That left a 9.5-min gap, which invalidated the run.
- **Second run (restarted 11:07:14):** heartbeats were sent regardless of visibility, with visibility still logged. The first heartbeat was due at 11:11:14.

## Timeline

| Time | Event |
|---|---|
| 10:53:12 | Model process PID 23920 created (it replaced 22476 during the prompt tests; see prompts.md) |
| 11:01:47 | Heartbeat #1 sent (visible): first token 6,936 ms, total 7,356 ms (fresh clone's first prompt, so it pays the per-session setup) |
| 11:01:47–11:06:47 | PID 23920 present every 30 s, ~6.2–6.5 GB private, CPU flat at ~300–307 s (idle) |
| 11:05:55 | Heartbeat #2 **skipped**: tab hidden |
| **11:07:17** | **PID 23920 gone.** Only the helper process remains (samples 11:07:17–11:10:48) |
| 11:07:14 | Heartbeat restarted (sent regardless of visibility) |
| 11:11:14 | Heartbeat #3 sent → **new model process PID 24396 created 11:11:14** (2.5 GB at 11:11:18, 5.0 GB and 16 s CPU at 11:11:48, still loading) |
| 11:11:47 | Test stopped: interval cleared, clone and bases destroyed, monitors stopped, tab closed. Heartbeat #3 never completed, so its reload latency is unknown |

## What it shows

1. **Chrome 157 still unloads the model ~5 min after the last prompt**, even while sessions are held open. The last prompt finished at ~11:01:55, and the process was gone between 11:06:47 and 11:07:17 (5:00–5:30 idle). Same behaviour as Chrome 156 (PREP.md §3b).
2. **The next prompt after an unload starts a fresh process and pays a reload.** Its length wasn't captured this time. Earlier today on Chrome 157, loads took ~3.5 min of CPU (10:35→10:39 and 10:42→10:45), and once only ~13 s (10:53). See prompts.md, engine finding 3.
3. **Visibility-gated heartbeats can fail in practice.** A single hidden tick at a 4-min interval leaves an 8-min gap, which is longer than the ~5-min unload. If D5 keeps the "only while visible" rule, the interval has to be shorter (e.g. 2 min, so one skipped tick still fits inside 5 min), or the engine must re-warm on `visibilitychange → visible` (as soon as the user comes back, before they type).

## Still unanswered (the D5 question)

Does a tiny prompt every ≤4 min keep the model process loaded for 20+ minutes on Chrome 157?

## Protocol for the full run later

1. Fresh page, one click to create the base (user gesture). Warm it with one prompt and wait for that prompt to complete.
2. Start the 30 s process logger (as above) for 35 min.
3. Send `"ok"` on a dedicated clone every **3 min** (a safety margin under 5 min), **regardless of visibility**, logging visibility. Keep the window in front if possible, and don't use the browser for other prompts.
4. **Pass:** one PID and CreationDate for 25+ min, and every heartbeat's first token ≤ ~3 s (warm follow-up). **Fail:** any new PID, or any heartbeat ≥ 10 s.
5. **Control:** afterwards, stay idle for 7 min, then send one prompt. That measures the reload-after-unload time on Chrome 157, the number that sizes the `warming` state.
6. Repeat once on default Chrome (no flags) in a separate profile, since judges run default Chrome.
7. Also try a **cheaper heartbeat**: a clone's first prompt pays ~7 s of setup (heartbeat #1 took 6.9 s). Use a long-lived heartbeat clone so every heartbeat after the first is a ~2.3 s follow-up. Or test whether `append()` alone counts as activity for the idle timer.
