# #BuildHybridAI 2026: plan and findings

> Last updated 2026-11-13. Final rules read on 2026-11-12 (§1). Decisions D13–D18 added after reading them.
> UI standard: `DESIGN.md`. Rules for anyone coding: `CLAUDE.md`.

**Contents**
1. Dates and judging
2. The product: Dear Sky
3. Findings (what we measured)
4. Decisions (and why)
5. To-do before Nov 9
6. Build plan, Nov 11–30
7. Open questions
8. Reference: tech cheat sheet and machine setup

---

## 1. Dates and judging

| When | What |
|---|---|
| **Wed Nov 11, 1:30 PM PT** (Nov 12, 3:00 AM IST) | Contest and submission period open (the official rules moved this from Nov 9). **Code from before this doesn't count.** |
| **Wed Nov 18, 10:00 AM PT** | Sprint 2 deadline to request paid model quota (image generation etc.). Not needed after D13. |
| **Mon Nov 30, 2:00 PM PT** (Dec 1, 3:30 AM IST) | Hard deadline. **Our target: submit by Nov 29.** No commits after this are evaluated. |
| Dec 10–16 | Judging. Winners around Dec 21. The hosted app must keep working through Dec 16. |

Rules: https://firebasehybridaihackathon.devpost.com/rules (read 2026-11-12).

**Prizes:** Grand $10k, 1st runner-up $7k, 2nd runner-up $4k; "Best of" $3k each for iOS, Android, **Web/Chrome** (our category). One entry can win one grand prize plus one "Best of" prize.

**Stage 1 (pass/fail), all required:**
- [x] Public GitHub repo with an **open-source licence file** visible in the About section (Apache-2.0 preferred). *(Checked 2026-11-13.)*
- [ ] The repo imports and **actually calls Firebase AI Logic at runtime**, contains everything needed to run, and states the value proposition.
- [ ] **Demo video ≤ 3 min, public on YouTube**, in English, showing the app running.
- [ ] Text description: how we used Firebase AI Logic, the features, the value proposition.
- [ ] Summary of what was built during the contest, plus disclosure of any pre-existing work (the Nov 4 benchmarks, the `firebase-hybrid-ai` Claude skill).
- [ ] **No production API keys, project secrets or PII** in the repo, form or testing instructions. App Check debug tokens are accepted.
- Strongly encouraged: a hosted URL. Encouraged: Firebase agent skills, App Check, Remote Config, Firestore, Auth.

**Stage 2 (each scored 1–5, equal weight; ties broken in this order):**
1. **Technological implementation:** how well it's built, and how effectively it uses Firebase AI Logic hybrid inference.
2. **Design:** a complete, coherent product, not a proof of concept.
3. **Potential impact:** a credible, specific case for a real problem and audience, shown in what's demonstrated.
4. **Quality of the idea:** creative, non-obvious, and showing **genuine understanding of the problem space** (our redaction finding and redesign, D1/D2, belong here).

**Judges may score from the video and description alone, without opening the app.** The video is as important as the app. Hybrid has to be the reason the app works.

---

## 2. The product: Dear Sky

*Named 2026-11-12. "Dear Sky" is the app; a **lantern** is the object inside it (what a released letter becomes). Checked: no app uses the name ("Night Letter" was rejected because an iOS app "write to someone you miss" exists). Avoid any overlap with "The Unsent Project".*

> **UI is the top priority.** It must be endearing, cute and beautiful, with zero jank. This is an emotional app. See `DESIGN.md`.

**One sentence.** You write a letter you'll never send. A private on-device AI reflects on it gently. If you choose, an anonymous line distilled from it becomes a painted lantern rising into a shared night sky.

**The flow.**
1. **Write.** A letter to anyone (a parent who died, an old friend, your younger self). It's stored only on this device.
2. **Reflect.** Gemini Nano reads the letter **on-device** and streams a 2–3 sentence reflection into the margin, with no advice.
3. **Choose.** Keep it (local only), burn it (a deletion ritual), or release it.
4. **Release.**
   1. On-device, Nano condenses the letter into `{feeling, essence, motif}`. It's precomputed in the background, so this step feels instant.
   2. A deterministic leak check runs in code.
   3. The user sees, can edit, and approves the exact words that will leave the device.
   4. Only those words go to the cloud, where an image model paints a lantern.
   5. The lantern rises into a shared sky stored in Firestore.
5. **The sky.** Strangers' lanterns drift. Tap one to read its anonymous essence. No likes, comments or profiles.

**Why it's hybrid, and why judges should care.**
- **On-device** handles everything private: the raw letter, the reflection, the condensing.
- **Cloud** handles everything shared or heavy: painting the lantern, the shared sky, and moderation.
- The boundary between them is a moment the user sees and consents to, and it's **enforced in code**. One model instance can only run on-device and the other only in the cloud. Letter text never reaches the cloud instance.

**Audience.** Anyone carrying something unsaid. Unsent-letter writing is a known expressive-writing exercise in grief work. We present Lantern as a reflection space, never as therapy.

---

## 3. Findings (what we measured)

All measurements were taken on 2026-11-04 on the dev laptop (RTX 3070 8 GB + Intel UHD, Chrome 156, Gemini Nano `2025.8.8.1141`, 3.98 GB).

### 3a. Nano's output quality
- **Reflection: good.** Example: *"This letter feels like a quiet holding of grief and a longing for connection. It speaks of a lingering presence, the voicemail…"* It's kind, it follows instructions, and it gives no advice. It's a bit generic, which a better prompt can fix.
- **Redaction: unreliable.** 5 tricky letters, 2 runs each:

  | Letter | Result |
  |---|---|
  | "Amma"/rasam (Meena, MG Road) | **Leaked both runs** |
  | Old manager (Infosys, Rakesh) | **Leaked both runs** |
  | @priya.draws (handle, dates) | Clean |
  | Younger self (St. Xavier's) | Clean (over-redacted) |
  | Kabir/Toronto (name, phone) | **Whole letter replaced by placeholders** |

  The same letter gave **different** redactions on different runs.
- **Essence and motif: clean in 10 of 10.** No identifiers, even when the redaction in the same response leaked. Strong motifs: "a simmering pot", "a forgotten sketchbook", "a blue notebook", "an empty room echoing with memories". The essences are a bit generic (e.g. "Deep sorrow stemming from loss…"), so the motif should drive the art.
- **Feeling enum:** mostly sensible. It sometimes alternated between runs (e.g. hope vs regret on the manager letter).

### 3b. Nano's performance

| Task (warm) | First token | Total |
|---|---|---|
| Short reply | 83–86 ms | ~0.3 s |
| Reflection, 2–3 sentences | 315–475 ms | ~2.2 s (streams in 61–71 chunks, ~150 chars/s) |
| Essence + motif (JSON) | 0.55–1.6 s | 1.4–2.8 s |
| `LanguageModel.create()` | | **8.2 s cold, 1 ms warm** |
| `session.clone()` | | **1 ms** |
| **Cold start** (Chrome reloads the model) | **up to ~13 min** | CPU-bound, GPU idle. Observed: "a few minutes" once, ~13 min once |

- **Streaming works.** Console tests only *looked* frozen because they hit cold starts.
- **No parallelism.** 3 concurrent prompts got first tokens at 0.55 s, 2.37 s and 3.95 s. Chrome **serializes** all prompts, across sessions and tabs. A stalled or aborted prompt blocks everything queued behind it.
- **Chrome unloads Nano about 5 minutes after the last prompt, even while a session is held open.** Keep-warm test: last prompt 14:20:23, model process (4.8 GB) gone by 14:25:32, still gone at 14:36:35, while `window.__keep` held a live session the whole time. The next request starts a fresh `OnDeviceModelService` process and pays the cold start again (seen 4 times).
- **GPU:** Nano runs on the **NVIDIA** dGPU (3,115 MB of dedicated VRAM, all inference there). Chrome *renders pages* on the Intel iGPU (WebGPU reports `intel gen-12lp` even for `high-performance`). **A web page cannot choose Nano's GPU.**
- **Why cold starts are so slow here (investigated 14:36–14:40):**
  - The reloading model process loads Direct3D 12 plus Chrome's bundled `dxcompiler.dll`, and both the NVIDIA and Intel drivers. One thread runs at ~65% of a core for minutes, with the GPU idle.
  - Windows Defender is **not** involved (it wasn't among the top CPU users).
  - No shader cache grows during the reload (Chrome's GrShaderCache/GraphiteDawnCache/ShaderCache, NVIDIA DXCache and the Windows D3DSCache all stayed flat).
  - **Inference:** Chrome recompiles Nano's GPU kernels from scratch on every model reload, and this machine compiles them very slowly. Another published benchmark reports an ~11 s cold start, so ours is unusually slow, possibly because of the driver or the dual-GPU setup (a guess).
- **Chrome's model process picks the fastest GPU itself and ignores the Windows per-app GPU preference** (matches openai/codex issue #40409 on Windows multi-GPU). So a "Power saving" setting won't push Nano onto the iGPU; that test is dropped.
- **Chrome picks the model variant itself** (larger ~4B vs smaller ~2B, or the CPU path) by benchmarking the GPU with a shader at first download (developer.chrome.com, "Understand built-in model management"). Weaker GPUs get a smaller, faster model automatically.
- **The reload after an idle unload is just as slow:** a prompt sent at 14:36:50 to a held session was still waiting at 14:48:09 (11+ min), with the model process spawned at 14:37:02. Every idle unload costs 10+ minutes on this laptop.
- **`chrome://on-device-internals` (14:45):**
  - Performance class **VeryHigh**. VRAM 8,018 MiB (3,000 required).
  - Installed model: `nano_v3_gpu_component` **2025.8.8.1141** (over a year old), backend "GPU (highest quality)", 4,072 MiB.
  - **Listed but not installed ("Pending Usage"):** `gemma4_component`, `gemma4_4b_component`, `gemma4_12b_component`, with use cases `prompt_api_gemma4`, `prompt_api_gemma4_4b`, `prompt_api_gemma4_12b`. Chrome seems to have newer Gemma 4-based Prompt API models it would download on demand. **We haven't found how a page or flag requests them.** Next: search `chrome://flags` for "gemma".
  - The Event Logs tab was empty (it only logs while open).
- **Official guidance** ("Built-in AI APIs: Do and don't", updated 2026-10-30) confirms D5 (pre-warm on intent) and D7 (base session + `clone()` + `destroy()`). It adds: **put the system instructions in the base session's `initialPrompts` at creation** (faster first prompt), don't keep several large sessions alive, and keep inputs minimal (latency grows with input size).
- **Flag experiment (started 14:49, 2026-11-04).**
  - Enabled `gemma4-for-built-in-ai`, `on-device-model-speculative-decoding`, `prompt-api-sampling-mode`, `prompt-api-tool-use`, `decisions-api`, `prompt-api-multimodal-input`, and `prompt-api` (option 2).
  - **Chrome deleted nano_v3** (the `OptGuideOnDeviceModel` folder is gone), and `availability()` became `'downloadable'` for Gemma 4.
  - **Caveat:** judges and users run default Chrome, so **design numbers must hold for the default model.** Gemma 4 results only describe our dev/demo machine. Several flags were changed at once, so speed changes can't be credited to Gemma 4 alone (speculative decoding affects speed too).
  - To revert: disable the flags, relaunch, and nano_v3 (~4 GB) re-downloads on the next `create()`.
- **Gemma 4 vs nano_v3 on the same laptop (15:01–15:05):**

  | | **nano_v3** (default Chrome) | **Gemma 4** (with the flags above) |
  |---|---|---|
  | Where it runs | **NVIDIA GPU** | **CPU** (~9 cores busy, GPU idle, 4.2 GB RAM) |
  | Files | 4,072 MB weights | 2,361 MB weights + **752 MB `cache.bin`** (persistent) |
  | Click to ready, including download | n/a | 3 min 39 s (create 213 s, first prompt 6 s) |
  | **Reload after idle unload** | **11–13 min** | **~12 s** |
  | `create()` | 8.2 s cold / 1 ms warm | 1.9 s |
  | Short reply, first token | **85 ms** | 8.4–11.5 s |
  | Reflection total | **~2.2 s** | 14.5–18.7 s |
  | Essence total | **1.4–2.8 s** | 13.7–15.9 s |
  | Streaming speed | ~150 chars/s | ~15 chars/s |
  | Parallel prompts | Serialized | Serialized (first tokens at 14.9 s, 25.6 s) |
  | Quality | Kind, a bit generic | Similar reflections (overuses "quiet", "palpable"). **More concrete motifs:** "Tamarind", "The left side of the bed", "Echoing voice". No identifiers in essences. Same output for the same input across runs |

  **Read:** nano_v3 on the GPU is ~10x faster warm but has a catastrophic cold start here. Gemma 4 on the CPU has a fast cold start (its compiled cache persists) but every prompt is slow.
  **Cause found (15:10):** the **`#decisions-api` flag** forces Gemma 4 onto the CPU. Its description says it uses "Gemma 4 on the CPU as a temporary workaround for GPU backend scoring issues" and "also switches the other built-in AI APIs to Gemma 4 on the CPU". on-device-internals then listed only CPU models: `gemma4_cpu_model` (3,113 MiB) and `nano_v3_cpu_model` (2,730 MiB, the extra `2025.8.21.1028` folder). **Keep `#decisions-api` off.**
  **Design impact:** none to the plan. Both profiles map onto the readiness tiers (§4): Gemma-on-CPU behaves like `slow`, nano_v3 when cold behaves like `warming`. It confirms users will see a wide range of on-device speeds, so streaming, precompute and "write it yourself" are essential.
- **Gemma 4 on the GPU (`#decisions-api` off, 15:11–15:20):**
  - Runs on the **NVIDIA GPU** (2,023 MB of dedicated VRAM).
  - Same component (`gemma4_component` 2026.8.7.929, 2,361 MB weights), plus `program_cache.bin` with a `.dawn_version` sidecar. That suggests a persistent **Dawn/WebGPU compiled-program cache**, still 0 MB right after the first load.
  - Click → `create()` resolved in 328 s (mostly the download). First prompt 15 s.
  - **Warm:** reflection ~4.3 s, essence ~4.4 s, generation ~50 chars/s. **But every request waits 3–8 s before its first token**, even "Say hi.", and later prompts on the same session get slightly faster (3.6 → 3.1 → 2.8 s). nano_v3 on the same GPU had 85 ms first tokens.
  - The model process also burns CPU (120 s by 15:20) while running on the GPU.
  - **Hypothesis:** the per-request overhead comes from another experimental flag (`on-device-model-speculative-decoding` or `prompt-api-sampling-mode`). Test by turning them off one at a time.
  - **Quality:** similar to before. Motifs again concrete: "Rasam", "An echo", "Left side of the bed". No identifiers in essences.
  - **Reload after idle unload: ~10 s** (`create()` 5.3 s + first answer 4.3 s, measured 15:28:24 after Chrome unloaded the model at ~15:24:48, ~5 min idle). `program_cache.bin` had grown to **13.9 MB**: the Dawn compiled-program cache persists. **This fixes the 11–13 min nano_v3 cold start.** (The scheduled in-page test was lost because Chrome reset the tab's page state, so it was measured directly.)

  **Speculative decoding test (15:31, `#on-device-model-speculative-decoding` off):** it is **not** the cause of the first-token wait.
  - First token: 5.6–6.9 s (vs 3.7–4.4 s, later 7.8 s, with it on). Generation after the first token: ~380–400 chars/s, so a reflection streams in 0.4–0.8 s. Total reflection ~6.5 s, essence ~7 s.
  - The wait is a **fixed 3–7 s cost per request, independent of prompt length** ("Say hello" waits as long as a letter), slightly lower for later prompts on the same session (3.3 s).
  - Speculative decoding neither helped nor hurt measurably on our short outputs, so it can go back on.
  - Remaining suspects (untested): `#prompt-api-sampling-mode`, `#prompt-api-tool-use`, or a pre-answer check inside Chrome.
  - Motifs stay concrete ("Tamarind", "A voice", "The side of a bed"), and the essences contain no identifiers.

  **Sampling-mode test (15:35, `#prompt-api-sampling-mode` off, speculative decoding back on):** also **not** the cause.
  - New clone, first prompt: 4.5–5.4 s first token. Reflection ~5.2 s, essence 5.4–5.9 s. Generation ~350 chars/s.
  - **But follow-up prompts on the same session: 2.4 s, then 2.3 s.** About half the wait is **per-session setup** (~2.5–3 s on a fresh clone's first prompt). The remaining ~2.3 s per request looks inherent to Gemma 4 on this setup.
  - **Tuning stopped here** (diminishing returns; judges use default Chrome).
  - **Final demo-laptop flags:** `gemma4-for-built-in-ai`, `on-device-model-speculative-decoding`, `prompt-api-multimodal-input`, `prompt-api-tool-use`, `prompt-api` (option 2). `decisions-api` and `prompt-api-sampling-mode` are off.

  **Current best setup for the dev/demo laptop: Gemma 4 on the GPU** (`#gemma4-for-built-in-ai` on, `#decisions-api` off). Reload ~10 s, reflection ~4.3 s, essence ~4.4 s, better motifs. Remaining issue: the 3–8 s wait before every first token. Next: test with `#on-device-model-speculative-decoding` off.

  | Setup | Reload after idle | Reflection | Essence | First token |
  |---|---|---|---|---|
  | nano_v3 on the GPU (default Chrome) | 11–13 min | 2.2 s | ~2 s | 0.1–0.5 s |
  | Gemma 4 on the CPU (`decisions-api` on) | ~12 s | 15–19 s | 14–16 s | 7–11 s |
  | **Gemma 4 on the GPU** | **~10 s** | **~4.3 s** | **~4.4 s** | 3–8 s |
- **There's no documented API or setting for the idle-unload time.** The official model-management page covers download, update and deletion only.
- **Not yet measured:** integrated-GPU-only performance, CPU-only performance, the reload time after an idle unload (test running, see §7), and whether a periodic tiny prompt keeps the model loaded.

### 3b-2. Nano lab, 2026-11-12 (Chrome 157, Gemma 4 on the GPU; details in `research/prompts.md`, `research/heartbeat.md`)
- **Chrome 157 API changes:** `LanguageModel.params()` is gone; read usage from `contextUsage`/`contextWindow` (9,216 tokens). The flag `prompt-api-sampling-mode` is actually **on** (§3b said off). Firebase 13 also dropped the on-device `temperature`/`topK` options (`research/stack.md`).
- **D7 confirmed:** a fresh clone's first prompt reaches its first token in 5.9–8.9 s; a follow-up on the same clone in 2.2–2.9 s. Sending the letter again on a fresh clone: 7.1–8.9 s.
- **`append()` pre-loading works:** appending the letter to the clone takes 5.4–6.2 s, and afterwards the first token comes in ~2.2–2.4 s. Appending while the user is still writing (or on pause) cuts the wait for the first reflection words from ~10 s to ~4.5 s.
- **Safety:**
  - A risk flag inside the essence JSON caught the at-risk letter in only 2 of 6 runs. A separate safety prompt sent first caught it 3 of 3 times, with 0 false alarms in 12 runs. Small sample.
  - **On the at-risk letter, the model's reflection validated the ideation.**
  - The code-based check (`research/riskcheck-draft.ts`) caught 10 of 10 test cases.
- **Quality:** 0 of 48 essences and 0 of 48 motifs contained an identifier. Essences are specific now ("I loved you more loudly than you could hear."). Reflections are gentle but still a bit generic.
- **Failures the engine must handle:**
  - ~7% of reflections came back empty with no error: retry on empty.
  - A hung `create()` blocks everything after it in that page until a reload.
  - The first prompt sent while the model was loading threw `UnknownError`: retry once.
- **Cold load is slow again on Chrome 157** (~3.5 min CPU). The compiled-program cache is still dated Nov 4, so the Chrome update probably made it unusable (unverified).
- **Which model judges get (checked 2026-11-12, all flags reset):** `chrome://on-device-internals` maps the standard `prompt_api` use case to **nano_v3** (`nano_v3_gpu_high_tier_model`, GPU), and a plain `LanguageModel.create()`, which is what Firebase AI Logic calls, triggered its download. Gemma 4 is a separate use case (`prompt_api_gemma4`) used only with `#gemma4-for-built-in-ai` on; 4B and 12B Gemma 4 variants are also listed. So **default Chrome 157 = nano_v3**: fast when warm, with a cold load of minutes on some machines. The rules' "Gemini Nano 4" is not the default yet.
- **Download progress restarts at 0 for each page (lab page, 2026-11-12):** with 1.7 of 4.0 GB already downloaded, Chrome's `downloadprogress` events (raw, and through AI Logic's `initializeDeviceModel`) began at `loaded: 0` and reached `0.012` after ~7 s. Our `downloading` state matched Chrome exactly. So progress means "since this page started watching", not "share of the model on disk". **Design:** show it as a soft, moving fill (DESIGN.md §4b), never as an exact "N% of the model" claim.
- **D21 measured on default Chrome 157, nano_v3, pure Firebase AI Logic (lab page, 2026-11-12):** warm, from "done" to the first reflection word **2.4–2.6 s** (safety 1.4–1.7 s, reflection first word ~1.0 s, reflection total 1.7–2.0 s, essence 1.9–2.1 s). The cold load before the first prompt took **~4.3 min** (258.8 s). The risk letter stopped after its safety check; no false alarms on the other 5; no empty-reply retries. **Verdict: keep pure AI Logic** (faster than our best Gemma 4 path, ~4.5 s with `append()`). Quality to tune on nano_v3: 3 of 5 essences copied a whole sentence from the letter ("I loved you more loudly than you could hear."), and reflections broke style rules ("a quiet echo", "It's interesting that…", "is a good thing").
- **Lab re-run after the D23 changes (default Chrome 157, nano_v3, 2026-11-12):** the reflection's first word now arrives **~1.0 s** after it starts (0.97–1.03 s, all 5 letters), so warming up through the reflection instance works. "Done → first word" was **2.4–3.8 s**, and the safety prompt is most of it: **1.4–2.8 s** (slowest on the first two letters). Reflection total 1.8–2.5 s, essence 1.95–2.5 s. The risk letter stopped after safety; no false alarms. Two problems remain:
  - **All 5 essences copied letter text** (4 near-verbatim sentences, 1 close paraphrase), e.g. "I miss your voice saying my name from the kitchen." → "Your voice saying my name from the kitchen." The name rule can't catch this: no names. → D25.
  - Reflections still break style rules: "quiet" twice, "It's powerful that…", "It's good that you recognize…" (praise), a "didn't it?" question. **Style eval baseline: 1/5 PASS** (`src/lab/style-eval.ts`, a rule-based PASS/FAIL check of every rule in the system prompt; the lab now shows it per reflection). Prompt changes should raise this number.
- **Lab run with D24 + D25 (nano_v3, default Chrome 157, 2026-11-12):** "done → first word" **0.94–0.99 s** on all 5 letters (pre-check 1.3–2.2 s, done while writing; cached safety 0 ms). Leak check **5/5 ok**; 3 of 5 essences needed the retry (essence 3.8–4.0 s instead of 1.7–1.9 s), and the retried ones read more generic ("A kind word during a moment of difficulty made a lasting impact."). Style eval **1/5 PASS**: "quiet" in 4 of 5 reflections even though the prompt bans it (possibly primed by the ban list itself), plus "It's powerful that…" and two "You…" openings. Risk letter caught in the pre-check.
- **Same lab on Gemma 4 (`#gemma4-for-built-in-ai`, `gemma4_gpu_high_tier_model` on the GPU, Chrome sampling `top_k=64, temperature=1.0`, 2026-11-12, 15:21):** the first pre-check took **122 s** (cold load; Chrome's log: "model cache files [do not exist]"), then 1.5–1.6 s. Warm "done → first word" **1.35–1.41 s** (nano_v3: 0.94–0.99 s), essence 3.6–4.1 s, leak check 5/5, style 2/5 after fixing an eval false positive ("you still try to…" is not advice). So through AI Logic, Gemma 4 is **not** the 6–9 s first token feared from the raw-API tests. Quality is **not better than nano_v3**: hedgy and generic ("It seems like…" twice, "You seem really missing…" ungrammatical), fewer letter details, and it **misread the manager letter** in both the reflection ("your part… was overlooked") and the essence ("how much my presence meant to you"), a gratitude letter. Essences didn't copy sentences. **Reload after an idle unload (same day, second run): first pre-check 2.1 s**, then 1.5–1.7 s; first word 1.39–1.57 s. Gemma 4 keeps its compiled GPU program cache, so on this laptop it reloads in ~2 s where nano_v3 took minutes. Quality unchanged: style 0/5 ("It seems like…" or "You…" openings every time), the manager letter misread a third time ("a sense of missing recognition"), one two-sentence essence, one essence giving advice ("Embrace the quiet surviving years…"). → D27.
- **What Firebase AI Logic forwards to Chrome (read from `@firebase/ai` in `node_modules`, 2026-11-12):** `onDeviceParams.createOptions` is passed unchanged to `create()`/`availability()` (so `samplingMode` would reach Chrome), and `promptOptions` unchanged to `prompt()` (`responseConstraint`, `omitResponseConstraintInput`). Image parts are supported; **audio parts are not**. Messages are rebuilt from Firebase `Content` with only `role` and `content`, so an assistant **`prefix: true` prefill is not possible** through AI Logic.
- **Root cause of the minutes-long cold loads, found and fixed on the dev laptop (2026-11-13).** Gemma 4 on the GPU, model already on disk: `create()` 6.7 s, then **first token at 276 s** (a second run failed with `UnknownError` at 290 s). During the wait the GPU sat at 0% and the model process at ~6% of one core. A WPR trace showed NVIDIA's driver threads spinning (`SwitchToThread`) while `D3DSCache.dll` (Windows' shader cache) slept in a retry loop. A file-I/O trace showed why: the model process runs in its own AppContainer (`%LOCALAPPDATA%\Packages\cr.sb.odm3E4D…\AC`) **plus** Chrome's restricted token (Low integrity; restricting SIDs Users, Everyone, RESTRICTED, logon SID). Its NVIDIA cache file `…VEN_10DE&DEV_249D….dxcache` was opened 2 times successfully (before the lockdown) and then **refused 1,942 times in 69 s**, because the folder's ACL grants none of the restricting SIDs. Since KB5065789 (Sept 2025) `D3DSCache.dll` embeds SQLite 3.46, whose Windows VFS retries a refused open in nested loops with sleeps (up to ~15 s per open; fixed upstream in SQLite 3.50). Every shader the driver builds pays that, which is also why nano_v3 (more shaders) took 11–13 min and why "no cache grows" (§3b). Matches Chromium issue 40266176 (sandboxed D3D12 shader caches get "access denied", still open) and WebView2 feedback #5693 (same stack on AMD).
  - **Fix (machine-level, run by the user, not app code):** `icacls "%LOCALAPPDATA%\Packages\cr.sb.odm3E4D1A088C1F6D498C84F3C86DE73CE49F82A104\AC" /grant "*S-1-5-12:(OI)(CI)M" /T`. It grants the RESTRICTED SID modify rights on that sandbox's own folder; any other process would still have to pass the AppContainer check. Undo: the same with `/remove "*S-1-5-12"`. A Chrome update that creates a new `cr.sb.odm…` folder brings the problem back: re-run it there.
  - **After the fix:** first token **15.7 s** on the first cold load (the cache filled, 12.3 MB), then **7.7 s** (create 5.2 s + 2.5 s); warm follow-ups 67–80 ms; a fresh session on a warm model ~1.4 s.
  - **For judges:** Windows machines with a recent cumulative update will likely hit the same multi-minute first load (we can't fix their ACLs). The `warming` state, work-ahead and "write it yourself" carry them. The README should say the first load can take a few minutes.
  - **Testing note:** force-ending the model process counts as a model crash (`model_crash_count`); right after, `create()` threw "The device is unable to create a session" while `availability()` still said `available`. It recovered on the next try. Prefer waiting out the ~5 min idle unload for cold-load tests.
- **Heartbeat (D5): inconclusive**, stopped at ~10 min. Confirmed again: the model unloads ~5 min after the last prompt even with a session open. One heartbeat was skipped because the tab was hidden, leaving a gap over 5 min. So use a shorter interval, or re-warm as soon as the tab becomes visible again.

### 3c. Browsers
- **Brave has no Nano.** `LanguageModel` exists but returns `'unavailable'` / "service is not running". It's a free way to test the no-Nano experience.
- Always pass `expectedInputs`/`expectedOutputs` languages, or Chrome warns.

---

## 4. Decisions (and why)

| # | Decision | Why |
|---|---|---|
| D1 | **Letter text (raw or redacted) never leaves the device.** Only `feeling`, `essence` and `motif` may go to the cloud. | Redaction leaked names in 2 of 5 letters (§3a). |
| D2 | **Three gates before anything leaves:** (1) Nano condenses on-device, (2) a deterministic leak check in code blocks phone numbers, emails, URLs, @handles and any capitalised word from the letter that isn't on an allowlist (Mom, Dad, Amma…), (3) the user reads, can edit, and approves the exact words. | A model can't be the privacy guarantee; code and consent can. |
| D3 | **Two model instances:** `ONLY_ON_DEVICE` for letter text, `ONLY_IN_CLOUD` for the lantern painting and moderation. **Never a silent cloud fallback for letter text.** | The privacy boundary is enforced in code, not just intended. |
| D4 | **The ritual shows "condensing", never redaction.** | Showing an unreliable redaction would be a false privacy promise. |
| D5 | **Warm up early, and keep it warm while the user is writing:** start the model on the first user gesture. Then, *if testing shows it works*, send a tiny "heartbeat" prompt (~85 ms warm) every ~4 minutes, only while the tab is visible and the user is active, so Chrome's ~5-minute idle unload never triggers mid-letter. If the heartbeat doesn't prevent the unload, re-warm when the user starts typing again. | Cold starts take minutes. Chrome unloads ~5 min after the last prompt even with a session open (§3b). People pause while writing letters. |
| D6 | **One prompt at a time, in priority order:** reflection first (the user is waiting), then **precompute the essence in the background** so "release" is instant. | Chrome serializes prompts; parallelism gives nothing (§3b). |
| D7 | **One base session (system instructions in `initialPrompts`), and one clone per *letter*, not per task.** The reflection is the clone's first prompt (it sends the letter). The essence is a **follow-up prompt on the same clone** ("now condense the letter above…") with `responseConstraint`, without re-sending the letter. Destroy the clone when the letter is done. *(Verified 2026-11-12, §3b-2.)* | Cloning takes 1 ms vs 8 s for a cold `create()`. On Gemma 4 GPU, a fresh clone's first prompt pays ~2.5–3 s of setup, while follow-ups on the same session reach their first token in ~2.3 s (§3b). Expected essence time: ~2.5 s instead of ~5.5 s, with less input. Both prompts are about the same letter, so Chrome's "don't reuse sessions for unrelated tasks" rule still holds. |
| D8 | **Every Nano call has a timeout**, plus a designed waiting state and a kind fallback. | Stalls are real (§3b). |
| D9 | **Adapt to measured readiness, not to hardware.** | The page can't choose the GPU or know Nano's speed in advance (§3b). |
| D10 | **The no-Nano path is first-class:** "write your lantern's words yourself" (fully private; the leak check still applies). There is **no cloud reflection** (see D14). | Most judges, Brave/Safari/phone users and weak machines won't have warm Nano. |
| D11 | **The cloud moderates every essence before it appears in the shared sky.** | The sky is public; strangers' text needs a safety pass. |
| D12 | **On-device emotional-safety check.** A risk flag shows a gentle local card with helpline resources, never blocks, and sends nothing. | Emotional app; duty of care. |
| D13 | **Lanterns are drawn in the browser (SVG), not painted by an image model.** A model turns the approved `essence` + `motif` + `feeling` into a small JSON "lantern recipe" (palette, pattern, glyph), using `PREFER_ON_DEVICE`: those words are already approved to leave, so on-device when available, cloud otherwise. *(2026-11-12)* | Image generation needs paid quota that lasts only 4 days and runs out before judging (Dec 10–16). Vector lanterns are free, never expire and are fully animatable. It also gives the hybrid mode a legitimate, explainable use. |
| D14 | **Letter text never leaves the device, for anyone. No cloud reflection, even with consent.** *(2026-11-12)* | One absolute promise is stronger than "unless you choose", and it matches CLAUDE.md. Less code. |
| D15 | **Blaze plan + Cloud Functions for moderation.** The client writes a lantern to a pending collection; a Function moderates it with Gemini and only then publishes it to the sky. The client may also call `ONLY_IN_CLOUD` moderation first for instant, kind feedback. *(2026-11-12)* | Moderation run from the app can be bypassed by writing to Firestore directly. The rule for the shared sky must be enforced server-side. Uses the free monthly allowance. |
| D16 | **Kindred lanterns (core feature).** When a lantern rises, cloud Gemini ranks candidate lanterns from the public sky (their essences only) and yours drifts beside the 2–3 that resonate most: "others carry this too." *(2026-11-12)* | The impact payoff: grief is lonely. It's a cloud AI task that genuinely needs the shared data, which deepens the hybrid story. |
| D17 | **A sixth readiness state, `downloading`,** with real progress from the `downloadprogress` monitor, designed like `warming`. *(2026-11-12)* | Judges on default Chrome will often have no model downloaded yet (several GB). Many will meet Lantern in this state. |
| D18 | **Anonymous Auth + App Check enforced on AI Logic, Firestore and Functions; Remote Config for prompt versions and a sky kill-switch.** *(2026-11-12)* | Anonymous uid gives "my lanterns" and taking a lantern back; the rules list these Firebase products as encouraged. |
| D19 | **Safety first, in this order on each letter's clone: code check + Nano safety prompt → reflection → essence.** If either flags risk, the reflection is not shown, the care card appears, and release isn't offered for that letter. The risk flag is never part of the essence JSON. *(2026-11-12)* | The flag inside the essence JSON missed 4 of 6 runs, and the model's reflection validated ideation on the at-risk letter (§3b-2). |
| D20 | **Pre-load the letter with `append()`** while the user pauses or finishes writing. Retry once on an empty reply or `UnknownError`. If a `create()` hangs, report `stalled`; don't wait forever. *(2026-11-12)* | ~10 s → ~4.5 s to the first reflection words; failures seen in the lab (§3b-2). |
| D21 | **The on-device engine sits behind one interface; the first implementation is pure Firebase AI Logic (`ONLY_ON_DEVICE`).** Measure it on the default model; add a faster path (a session shim feeding AI Logic pre-warmed clones, or raw Prompt API) only if the waits are actually bad. *(2026-11-12)* **Resolved the same day: keep pure AI Logic** (2.4–2.6 s from "done" to the first word on nano_v3, §3b-2). | Firebase AI Logic 3.1 (firebase 13.3) creates a new `LanguageModel` session per call and destroys the previous one (`ChromeAdapterImpl.createSession`). It never uses `clone()`/`append()`, so D7/D20 speed-ups are unavailable through it: ~15 s vs ~4.5 s to the first reflection words on Gemma 4 (estimated from §3b-2). Judging rewards using AI Logic, so it stays the default path. |
| D22 | **Design for whatever Chrome gives us.** The app never assumes a model, a version or a speed: it behaves only on measured readiness (D9) and must work well on nano_v3 (the default), Gemma 4 ("Nano 4") and no model at all. We build, test and **record the demo video on default Chrome** with no flags, so judges see exactly what they will get. *(2026-11-12)* | A website can't choose the on-device model: `LanguageModel.create()` has no model option, there's no origin trial for Gemma 4, and Firebase AI Logic only calls `create()` (§3b-2, checked 2026-11-12). Running our own model in WebGPU would bypass Firebase AI Logic. The rules require the app to "function as depicted in the video". |
| D23 | **Follow Chrome's built-in AI guidance** (`research/chrome-ai-docs.md`): re-check `availability()` after any failed prompt, because Chrome can delete the model mid-session and only re-downloads on the next `create()`; keep live sessions few (3 model instances, warm-up reuses one); stream by appending deltas; after `loaded === 1` show the indeterminate `warming` state; cache results per letter in IndexedDB (week 2). *(2026-11-12)* | Official docs read 2026-11-12. |
| D24 | **Run the safety check while the writer pauses, not after "done".** The writing screen calls `engine.preload(letter)` on every pause; the engine runs the safety check in the background for the newest text (one at a time, latest wins, `src/lib/engine/speculative.ts`) and keeps the result in memory. On "done", an unchanged letter reuses it and the reflection starts at once; a changed letter is checked again first (D19 order is unchanged). Only on a `ready`/`slow` model, and only results the model completed are reused. *(2026-11-12)* | The safety prompt is most of the 2.4–3.8 s wait (§3b-2). Expected: ~1 s from "done" to the first word. Side effect, unmeasured: prompts during pauses may also keep the model loaded (D5). |
| D25 | **The leak check also blocks copied letter text:** any run of **5 or more words** shared with the letter, in the essence (not the motif: motifs are objects from the letter by design). It also blocks capitalised words mid-sentence in the lantern words, and words in scripts without capital letters. `condense()` retries once with a stricter instruction when the first essence fails; the consent screen re-checks the exact words after any edit. Module: `src/lib/privacy/leakcheck.ts`, 30+ `bun test` cases including the 5 lab essences. *(2026-11-12)* | All 5 lab essences copied the letter (§3b-2): copied sentences are letter text (D1), even without names. 5 words catches every copy seen while allowing paraphrase ("Calls became messages, then just birthday reactions"). |
| D26 | **v1 releases English letters only, decided in code.** `releaseLanguage()` (`src/lib/privacy/language.ts`) holds back a letter when > 5% of its letters come from a script without capitals, or when a letter of 12+ words has < 20% English function words ("the", "and", "I", "you"…; English lab letters score 0.42–0.52, German/Spanish/French/Hinglish samples 0.00–0.06). Shorter letters aren't judged; the leak check still runs. Held-back letters still get their reflection, with a gentle note on why the lantern stays on the device. *(2026-11-12; first version used Chrome's Language Detector, replaced the same day.)* | The leak check finds names by their capital letter: German capitalises every noun (everything would be blocked), caseless scripts hide names (leaks). Deterministic so it works without Nano (Brave, Safari), and because the rules say **all AI inference must go through Firebase AI Logic** ("don't call other model APIs directly"), which rules out the Language Detector and Translator APIs. |
| D27 | **Demo and testing target: Gemma 4 ("Gemini Nano 4") via `chrome://flags/#gemma4-for-built-in-ai`, with `#decisions-api` off.** The README gets testing instructions (enable the flag, relaunch, open the app, wait for the first load) and says what happens without them. The demo video is recorded with the flag on. The app code stays model-agnostic and must still work well on default Chrome (nano_v3) and with no model (D22 otherwise unchanged). *(2026-11-12)* | The rules define the Web platform as "Gemini Nano 4 via Firebase AI Logic" and expect testing instructions (§1). On the dev laptop Gemma 4 reloads in ~2 s after an idle unload vs minutes for nano_v3; warm speed is close (first word ~1.4 s vs ~1.0 s). Quality is no better yet (§3b-2), so the prompts get tuned on Gemma 4. Risks: judges may skip the instructions (rules: they may judge on the video alone), and the flag could change before judging (Dec 10–16); re-check it on Chrome stable in early December. |
| D28 | **Work ahead on every pause, through the whole pipeline.** `engine.preload(letter, depth)` runs safety → reflection → essence in the background for the newest text (`src/lib/engine/pipeline.ts`): one background prompt at a time, latest text wins (stale steps and in-between versions are skipped), nothing past safety for a flagged letter (D19), only on a `ready`/`slow` model. On "done", finished steps return at once (the reflection replays and the UI paces the handwriting), running steps are joined (a reflection mid-way replays its earlier words, then streams live), and failed background steps re-run at user priority. `engine.progress` exposes per-step status (never text) for subtle UI cues. Replaces D24's safety-only version. *(2026-11-12)* | "Be ready for whatever Chrome throws at us" (user, 2026-11-12): whatever the model and its speed, most of the work is done before the writer asks for it, and slow or stalling devices have the most time to catch up. Costs GPU time on pauses; latest-wins keeps it to one prompt at a time. |
| D29 | **The writing screen never interrupts the writer.** A finished reflection waits as a folded note in the margin and only opens when the writer taps it or presses "i'm done for now". Cues come from `engine.progress` only: the candle flame leans toward the letter while the helper reads in the background, nib dots show while a note is being written, and stars come out one by one with real download progress. The care card belongs to the letter that raised it: a clean model check of new text retires it, and "done" on a flagged letter always shows it again. Spellcheck and grammar extensions are switched off on the letter field. Type: Literata (letter), Shantell Sans with INFM 55 (margin), Nunito (interface). *(2026-11-12)* | A note that opens by itself mid-sentence breaks the moment. Chrome's enhanced spell check sends text to Google, and grammar extensions read the page, which would break "the letter never leaves the device". The design skill flags Fraunces as an overused default, and the approved Stitch screen used Literata. |
| D30 | **The client runs the cloud moderation pre-check before every Firestore write** (`ONLY_IN_CLOUD`, `gemini-3.5-flash-lite`, `src/lib/cloud/moderation.ts`). It only accepts `ApprovedWords`, which only `approveRelease()` makes (`src/lib/privacy/release.ts`: language guard + leak check on the exact words when the consent button is pressed), so letter text can't reach cloud code without a type error. The result is advisory (`clear`, `held` or `unchecked`); the Cloud Function stays the authority (D15). *(User, 2026-11-13.)* | Instant, kind feedback, and the one readable request in DevTools: the demo's payload shot shows only the three approved fields leaving (`design/storyboard.md` beat 6). Firestore's own writes aren't readable in the Network tab. |
| D31 | **Cloud calls use the Agent Platform Gemini API (formerly Vertex AI), not the Gemini Developer API:** `getAI(app, { backend: new AgentPlatformBackend() })`, location `global`. Vertex AI API enabled by the user 2026-11-13. *(2026-11-13)* | The Gemini Developer API now bills from its own AI Studio **prepay** balance, separate from Blaze and Cloud credit; with that balance at $0 every cloud call failed with 429 "Your prepayment credits are depleted". Agent Platform bills to the project's Blaze account. Verified the same day from the app: App Check 200, `gemini-3.5-flash-lite` 200, a gentle lantern `clear` (2.8 s), a hateful one `held` (1.8 s). The request host is still `firebasevertexai.googleapis.com`, so the demo's DevTools filter is unchanged. On-device calls don't touch either backend. |
| D32 | **The shared sky (user, 2026-11-13).** (1) The client writes only the approved words to `pending/{id}` (with its anonymous uid, readable only by its owner). (2) A Cloud Function (`us-central1`, next to Firestore `nam5`) moderates them again with Gemini on Agent Platform via `@google/genai`, picks up to 3 kindred lanterns from recent sky lanterns, and publishes `sky/{id}` with **no uid**; the client never writes to `sky`. (3) The client remembers its own lantern ids on the device (IndexedDB), not in the cloud. (4) **The sky shows yours + their kindred + the newest others, up to ~60.** (5) **~40 seed lanterns written by us**, marked `seed: true`, sent through the same moderation, and disclosed in the write-up. (6) Built and tested on the Firebase emulators first; nothing is deployed without asking. | Server-side moderation can't be skipped by a modified client (D15). No public field links a lantern to a person. Kindred lanterns need other lanterns from the first visit, and the first visitors are judges. |
| D33 | **The server's Gemini calls go through Firebase AI Logic too**, not `@google/genai`: the Function uses `firebase/ai`'s Node build (`ONLY_IN_CLOUD`, Agent Platform), with App Check tokens issued by the Admin SDK (`getAppCheck().createToken`) through a `CustomProvider`. Config: `functions/.env.hybridai-785bb` (the web app's public key and app id, not committed). Emulators use a fake judge (`DEAR_SKY_FAKE_AI=1`). *(User, 2026-11-13.)* | Our notes (D26, `research/chrome-ai-docs.md`) record the contest rule "All of your app's AI inference must go through Firebase AI Logic, so don't call other model APIs directly." **Source unconfirmed:** on 2026-11-13 that sentence was not on the live rules, overview or resources pages (the rules only require AI Logic to be "imported and actually called", including via "an app/backend entry point"). Following it is cheap and removes the risk. Verified in plain Node: AI Logic asks the custom provider for a token and sends it (a fake token gets 401 "App Check token is invalid"). The real path is verified on first deploy. |
| D34 | **Lanterns wait on the device until the sky has them (2026-11-13).** `release()` puts the approved words in an IndexedDB `outbox` under an id made on the device, then sends them. Each lantern has one delivery loop: it waits for the connection, retries network failures with backoff, and leaves the outbox only when the server confirms it or refuses it for good. `sendWaiting()` sends anything left over on each visit. A resend the rules refuse is checked against `pending/{id}`, since it may have arrived before the tab closed. Opening local storage gives up after 2.5 s, and each tab lets go of the database when another asks to upgrade, so storage can never hold a lantern back. The consent screen hovers while the server moderates; after 12 s it says it is waiting for the wind. | Firestore keeps unsent writes only in the open tab's memory, and an offline first visit can't sign in, so "you don't need to stay" and "never lost" (DESIGN §4b) weren't true. Found in testing: a version-2 connection in another tab blocked the version-3 upgrade and froze the release. Verified on the emulators: a lantern stuck that way was sent on the next visit and rose with 3 kindred. Only approved words are stored, never the letter. |
| D35 | **Re-warm after an idle unload, on the writer's next gesture (2026-11-13).** When the engine's 5-minute idle timer fires on a `ready`/`slow` model, it allows `warmUp()` again, and the writing screen offers a warm-up on every keydown and pointerdown (a no-op while warm or loading). Test: `tests/engine.test.ts`. | Before, `warmUp()` ran once per page and `preload()` skips a `warming` model, so after any 5-minute break the work-ahead stopped and the next "done" paid the whole cold load inside the writer's wait. |
| D36 | **The sky view (2026-11-13).** `src/lib/ui/SkyView.svelte` draws `loadSky()`. Each lantern's place comes from a hash of its id (`src/lib/sky/layout.ts`), so the sky is the same on every visit and no position is stored. Yours sits low in the middle, its kindred on an arc above it joined by faint dotted threads, and the rest are nudged apart, kept clear of the moon and of the "yours" label. Tap or Enter opens a paper tag with the words, feeling and object; Esc or a tap elsewhere puts it away. There are 60 lanterns at most (36 under 600px), in three depths. Ways in: "find it in the sky" after the rise (yours comes up from the rooftops to its place), and a quiet "the sky" link in the writing masthead (gathers around your newest lantern). Offline or unreachable: a kind note and "try again", never an empty sky. Test: `tests/layout.test.ts`. Measured on the emulators with 47 lanterns: worst frame 12 ms, no long tasks. | DESIGN §4.8 and storyboard shot 7: kindred has to be visible, not just a sentence. Places from ids keep the cloud from learning which lantern is yours (D32), and fractions laid out with CSS percentages mean nothing is measured, so nothing jumps. |
| D37 | **Kindred are always someone else's (2026-11-13).** Before ranking, `lightLantern` looks up the ids of every `pending` lantern with the writer's uid (ids only, `select()`) and drops them from the candidates. It fetches that many extra sky lanterns, up to `KINDRED_POOL` more, so the pool stays full. Seeds are exempt: they share the `seed` uid but are different voices. Test: `tests/sky.emu.ts` ("a writer's own earlier lanterns are never their kindred"); it failed on the old Function and passes on the new one. | Seen in testing: a lantern's kindred included the same browser's earlier lantern, so "others carry this too" pointed back at the writer. This uses only the uid `pending` already keeps privately. Nothing new is stored, and `sky` still has no owner field (D32). A writer who clears their browser data gets a new uid, so their older lanterns can match again; that's rare and harmless. |
| D38 | **The lantern recipe (2026-11-13).** A recipe is `glyph` + `tone` + `shape` + `ribs` (`src/lib/sky/recipe.ts`). Only the glyph is chosen by a model: one of 16 small pictures (heart, star, moon, bird, leaf, flower, key, house, cup, letter, boat, wave, note, umbrella, flame, paw), picked from the approved words. Tone comes from the feeling (honey, apricot, peach, rose, ember), and shape (bell, round, tall) plus 3–5 ribs come from a hash of the essence. So nothing but the glyph is stored, and a lantern looks the same on the consent screen as in the sky. The glyph is **painted ahead on the device** (`engine.sketch`, `ONLY_ON_DEVICE`) while the writer reads the tag. On "light my lantern", `engine.paint` (`PREFER_ON_DEVICE`) reuses that result, otherwise asks on the device or in the cloud, within 6 s (the top of the ritual range). Past that, a deterministic word match picks it, and so does the Function for lanterns sent without one. The rules allow only the 16 names. Each pick logs `[dear sky] lantern painted: <glyph>, by the device / the cloud / the word match`. Checked in Chrome 157 with the real model: painted "by the device" within 1 s of the click. | D13 called for a model-made recipe; this is the app's one real hybrid call. A one-word enum is the right size for an on-device model, and the word match means the ritual never waits on it. Painting ahead keeps the cloud out of it until the writer approves (D2), while making the device path instant. Variety comes from shape, ribs and glyph, not hue (design/directions.md §2). |
| D39 | **No writer waits without a way on (2026-11-13).** Walking the fallback paths found two dead ends: during a download or a long cold load, "i'm done" showed nib dots with no choices for as long as the model took (the warm-up holds the queue, and a job's stall timer only starts when it runs, so nothing ever reported a stall), and `stalled` offered only "keep waiting". Now: (1) while `downloading` or `unavailable`, "done" goes straight to the choices and "let it become a lantern" to the own-words tag; a margin line says the helper will leave a note when it arrives, and the work-ahead brings it as a folded note once the model is ready. (2) After 20 s of waiting for a note's first word, whatever the cause, the margin offers "keep waiting" and "write the lantern's words myself" (`PATIENCE_MS` in `WritingScreen.svelte`; not offered for a care-card or non-English letter). (3) A code-check risk shows the care card at once, without waiting for the model. (4) The own-words field holds two lines from the start, so the buttons never move while the writer types. Dev: `?nano=unavailable` (Brave) and `?nano=none` (Safari, Firefox) fake the no-model paths on the real engine (`src/lib/dev/fake-nano.ts`). Verified live: the cloud `paint` and moderation calls carry only `{feeling, essence, motif}`. | The person a cold load or download most often meets is a judge on default Chrome. A wait with no way out reads as broken; DESIGN.md §4b promises "keep waiting · write the lantern's words yourself". |
| D40 | **The burn ritual (2026-11-13).** After "done", three pills under the sheet, each with a small drawn icon: keep it here (an envelope with a heart seal), let it go (a singed page), let it become a lantern. "let it go" asks once, kindly ("burn it gently? once it's gone, it can't come back.", focus on "not yet"; Escape also says not yet). Burning (`src/lib/ui/Burn.svelte`, 5.5 s): the candle's corner warms, a glowing scalloped edge climbs from the bottom right with scorch ahead and char behind, embers lift where it passes, and the sheet curls back and fades while the top still burns. A breath of empty sky, then a fresh sheet, with "it's gone now. only you remember what it said." until the writer types. Reduced motion: the page darkens in place and fades (1.9 s). Escape skips on purpose. Only transform and opacity move. **What burning deletes, at once:** the IndexedDB draft (`burnDraft`), the engine's held text, note and essence (`engine.forget()` → `LetterPipeline.clear()`), and the textarea itself, remounted, because setting its value from code keeps the undo history and Ctrl+Z brought deleted words back (found in testing). | DESIGN.md §4.3–4.4. Pills, not the Stitch mock's large illustrations: the page stays one screen with no jumps (chosen 2026-11-13). Burned must mean burned: nothing on the device, in memory or in undo can bring the words back. |
| D41 | **The boundary diagram (2026-11-13).** Its own page, `/boundary.html` (a second Vite entry: no Firebase, no engine, no letter), for storyboard beat 8. Two acts on one 1600×900 stage scaled to the window, over the app's own sky. Act 1, "our first design": a letter card has two names inked out by the model, drifts across a faint line to the cloud, and the name it missed glows ("a name slipped through"); then "what we found": 5 small letters, 2 with a glowing word (names leaked in 2 / 5), and 10 paper slips (clean in 10 / 10). Act 2, "so we rebuilt it": a warm device side and a cool cloud side either side of a firm dotted boundary ("the boundary lives in code"). A light walks the letter through safety → reflection → essence → leak check; the letter glides to the line, presses against it and settles home ("the letter never leaves"); the tag (feeling, the words, the object) is all that crosses, into moderation → kindred → sky, where it rises as a lantern with dotted threads to three kindred. `ONLY_ON_DEVICE` and `ONLY_IN_CLOUD` label each side. One cue table times it to the beat-8 VO, which was trimmed from 68 to 53 words so it fits its slot (~24 s); space pauses, ← → step, R replays, `?step=<cue>` opens on one. Transform and opacity only; reduced motion swaps every journey for a fade. | The VO describes the old design first, so the picture acts it out instead of only labelling it. A separate page keeps the app's bundle and start-up untouched. |
| D42 | **A visual upgrade and sound, before the deploy (user, 2026-11-13).** The app is functionally complete, but a walk through every screen found it flat and low on character: a plain-text wordmark, one small grey interface size, the consent tag reading like a web form, a sky of 40 same-size lanterns with no depth, and real jank (a scrollbar appearing with the choice pills shifts the page 5 px; pills sit on the rooftops; fold creases read as hard bands). Order: (1) identity: wordmark and type pairing, picked by eye on the dev-only `identity.html`; (2) the sky as a wide canvas you drag or swipe, with momentum and parallax depth (stars, moon, far and near lanterns at different speeds and sizes), lanterns drifting and bobbing, more loading as you explore, tap to read as now; (3) **sound is core**: real open-licence clips (Freesound CC0 or Pixabay, never BBC: non-commercial only), an ambient night bed plus moment sounds (paper, pencil for the margin note, burn, lighting, rising), on after the first click or key (Chrome blocks audio before a gesture) with a visible, remembered mute; the user picks clips by ear; never synthesised in code; (4) the consent tag redesigned and the jank fixed. Also fix: a rejected anonymous sign-in (`auth/invalid-refresh-token`, e.g. a deleted account) leaves the sky "hard to reach" forever; sign out and sign in again instead. | The user: without sound there is no emotional connection, and the polish bar is the product (DESIGN.md). Feature work is done, so design work now won't be redone. |
| D43 | **Identity: the storybook type and the salutation wordmark (user, 2026-11-13).** Picked by eye on the dev-only `identity.html` (a type mixer and four logo concepts). Type: **Alegreya** for the letter (21 px, up from 19, for its smaller x-height), **Kalam** for the margin note (17 px), **Alegreya Sans** for the interface: one family for the letter and the interface, so the app reads as designed rather than assembled; Nunito read as childish and Shantell Sans as a marker. Self-hosted through `src/fonts.ts`, shared by every page entry. Wordmark (`Wordmark.svelte`): "Dear Sky" in Alegreya italic, the way a letter opens, with the comma drawn as a small lantern just lifting off. It animates: on the first screen of a visit the letters settle in like ink, one by one, and the comma swells into its lantern and lifts; after that it bobs, its glow breathes, two sparks rise under it, and hovering lifts it higher. Reduced motion keeps the fades only. The favicon replaces Vite's default: the same lantern glowing on a square of night. Rejected: a handwritten signature (hard to read small, a fourth face), the lantern-above-name lockup (generic as a logo, but its lantern became the icon), a wax seal (reads as a wine label; its red fights the single amber accent). | The user: static reads as low effort for this kind of site, so the identity moves too. |

### Readiness levels (D9 in practice)

| State (measured at runtime) | What Lantern does |
|---|---|
| `downloading`: model not on this device yet (D17) | Writing works normally. A designed "the ink is on its way" detail with real progress. The reflection appears once it lands |
| `ready`: warm and fast | Everything on-device; streaming reflection; release is instant |
| `warming`: cold start in progress | Writing works normally. A quiet "ink is warming" detail. The reflection appears when ready |
| `slow`: warm but slow (iGPU/CPU) | Same flow, longer but still beautiful waits; precompute hides most of it |
| `stalled`: a timeout hit | Kind message: offer to keep waiting or write the lantern's words yourself |
| `unavailable`: no Nano (Brave, Safari, phones, unsupported hardware) | Write → write your own lantern words → leak check → consent → release |

---

## 5. To-do before Nov 9 (no project code)

- [x] **Keep-warm test:** an open session does **not** stop the unload (~5 min idle). Recorded in §3b; D5 updated.
- [ ] **Reload-after-idle test** (running): how long is a cold start after an idle unload, the common case for real users?
- [ ] **Heartbeat test:** does a tiny prompt every ~4 min keep Nano loaded for 20+ min? Run it in the console (learning, not project code).
- [x] ~~Integrated-GPU test via Windows "Power saving"~~ dropped: Chrome's model process ignores that setting (§3b).
- [ ] **Speed up cold starts on the demo laptop:**
  1. Update the NVIDIA driver.
  2. Try Chrome Beta/Canary and compare cold-start time (a newer runtime may cache compiled kernels).
  3. Search `chrome://flags` for **"gemma"**, "on device", "optimization guide" and "prompt api", and record the options. **Top priority:** find out whether the Gemma 4 Prompt API models (listed as "Pending Usage" in on-device-internals) can be enabled, then benchmark them against nano_v3: cold start, speed and output quality.
  4. Check `chrome://on-device-internals` for the backend and performance class.
- [ ] **Get Gemma 4 onto the GPU** (the best of both: a persistent cache *and* GPU speed). **Disable `#decisions-api`** (the cause of the CPU switch), relaunch, re-trigger the download with a click, and check the internals Models table for `gemma4_gpu_high_tier_model`. Then benchmark: does the GPU variant also write a persistent `cache.bin` (fast reload) *and* run at GPU speed? Change only one flag at a time.
- [ ] **Optional:** file a Chromium bug with our evidence (minutes-long cold start, `dxcompiler` single-thread, no cache growth, dual GPU).
- [ ] **Define the idea fully**, screen by screen:
  - every state from §4's readiness table
  - what the sky looks like with 0, 10 and 1,000 lanterns
  - the phone-width layout
  - offline behaviour
  - what happens to kept letters
- [x] **Name the product:** Dear Sky (2026-11-12, §2).
- [ ] **Visual references** for `DESIGN.md` §8: night skies, paper, lanterns, handwriting fonts, warm illustration styles. Sketch the ritual moments on paper or in Figma.
- [ ] **Prompt drafts** (in the console only, as learning): a less generic reflection, a stronger motif, and the emotional-safety classifier. Test each on 5+ letters, 2 runs each.
- [x] **Leak check spec:** rules, allowlist and 30+ test cases in `src/lib/privacy/leakcheck.ts` and `tests/leakcheck.test.ts` (D25).
- [x] **Decide the stack:** Svelte 5 + Vite, TypeScript, Bun (`research/stack.md`).
- [x] **Read the final rules**, judging and bonus challenges; §1 updated (2026-11-12; the window moved to Nov 11).
- [x] Firebase project `hybridai-785bb`, web app registered, AI Logic enabled; Firebase CLI logged in; Bun 1.3.12.
- [x] Nano downloaded in Google Chrome (3.98 GB) and benchmarked.
- [x] `firebase-hybrid-ai` Claude skill built (~/.claude/skills/firebase-hybrid-ai).

---

## 6. Build plan, Nov 11–30

*Polish outranks features. If a week slips, cut scope from the end of the list, never polish. Cut order if late: Remote Config → extra ritual variants (keep one of each) → sky at 1,000 lanterns. Kindred lanterns (D16) is protected.*

**Week 1 (Nov 12–15): decisions, foundation, the core loop**
- [x] Research in (`research/stack.md`, `research/prompts.md`, `research/heartbeat.md`, `research/visual-references.md`, `design/directions.md`); lock the stack and the visual direction; name the product. *(Svelte 5 + Vite; "quiet sheet by the window" chosen 2026-11-12, `design/directions.md` §2; Dear Sky.)*
- [x] Public GitHub repo with an Apache-2.0 licence from the first commit; scaffold with Bun; Firebase init (Blaze); App Check debug token. *(`KrishKoria/dear-sky`, public, Apache-2.0; checked 2026-11-13.)*
- [x] **Nano engine module:** ~~base session + clones~~ (superseded by D21: pure Firebase AI Logic), serial priority queue, warm-up on first gesture, timeouts (stall reports, 45 s user / 90 s background; AI Logic can't cancel), readiness state machine including `downloading` (D17).
- [x] Writing screen with local persistence (IndexedDB); streaming margin reflection (D29). Dev state switcher at the bottom left in `bun run dev`, never in the build. Measured 2026-11-12 (Chrome 157, dev probe `src/lib/dev/probe.ts`): the cold load took ~5.5 min after the first gesture (`ready` at ~6 min); a raw `LanguageModel.create()` from the lab tab joined the same in-flight load and returned at the same moment, so the wait is Chrome's model load, not our code. Zero main-thread long tasks ≥200 ms during it. The earlier "45 s freeze" was most likely the automation tool's own 45 s CDP timeout, which prints "renderer may be frozen". The sky-paused comparison (`?still`) was not run: accepted as is. The `warming` candle is the answer; nothing to fix.
- [x] **Storyboard the demo video now**, so every feature is built for a shot in it. *(Draft 1: `design/storyboard.md`, 2026-11-13. Four open questions at the end; its shot → feature map sets Week 2's order: the release path first.)*

**Week 2 (Nov 16–22): release, sky, kindred**
- [x] Essence precompute; consent screen (the leak check, D25, and the language guard, D26, are built and tested). *(Precompute: `engine.preload()`, D28. Consent: the hanging tag, D2/D30.)*
- [ ] Lab-test, adopt only if measured better: `samplingMode: 'most-predictable'` for safety and essence (origin trial token; forwarded by AI Logic, §3b-2), and `omitResponseConstraintInput` on the safety prompt.
- [x] ~~Stretch: kindred lanterns in the viewer's language with the Translator API~~ dropped: the rules require all AI inference to go through Firebase AI Logic (D26).
- [x] Lantern recipe (D13, D38) and the SVG lantern; lighting and rising rituals (D34).
- [x] Firestore sky, security rules, Anonymous Auth; Cloud Function moderation from a pending queue (D15). *(D32–D34, on the emulators. Anonymous sign-in still has to be turned on in the console before deploy.)*
- [x] Kindred lanterns (D16). *(Ranking in the Function, D32; drawn in the sky view, D36; never the writer's own, D37.)*
- [x] Seed lanterns: ~40 essences written by us, through the same moderation; disclosed in the write-up (`design/storyboard.md` beat 7). *(40 in `functions/scripts/seeds.ts`; `bun run seed:emu`. The disclosure goes in with the write-up.)*
- [x] Keep and burn; the no-Nano, downloading and stalled paths; emotional-safety card. *(Done: keep, the care card, the own-words tag; the no-Nano, downloading and stalled paths walked in Chrome with the sim engine and `?nano=` fakes, two dead ends fixed (D39). Burn ritual built (D40). The real-Brave walk moved to the polish pass.)*

**Week 3 (Nov 23–29): polish, ship, tell the story**
- [ ] **Prompt tuning, at the very end (user, 2026-11-12):** reflection style (style eval: 0–2/5 on both models), the manager-letter misread on Gemma 4, essence quality after the D25 retry. Measure with the lab's style and leak columns, on Gemma 4 (D27).
- [ ] **Visual upgrade + sound (D42), before the deploy:** identity (wordmark + type) → the draggable sky with depth → sound (ambient bed + moments, real CC0/Pixabay clips) → consent tag redesign + jank fixes (scrollbar shift, pills on the rooftops, fold creases) → the rejected-sign-in recovery.
- [ ] Full `DESIGN.md` polish pass on every screen (checklist §5, Performance panel, reduced motion, keyboard, phone width, Brave). **Only once everything is built (user, 2026-11-13).** Known items: walk every path in real Brave (needs its own App Check debug token); the three choice pills at phone width; the burn's reduced-motion version and its feel at full speed (D40).
  - **Vetted ideas (2026-11-13, an outside research pass checked against the code and docs).** Already built, so not needed: press-squish on every button, the swaying tag, the readiness candle, the self-writing margin note, the curved rise. Worth doing:
    - Small living details, CSS only: stars near your lantern brighten as it arrives in the sky; its kindred stir slightly when it settles; the paper warms a touch when the page has focus.
    - **Sound, maybe (decide here):** three moments only (burn, lighting, rising), off by default behind a visible on/off control, since Chrome blocks audio until a user gesture (developer.chrome.com/blog/autoplay). Plain Web Audio, sounds synthesised in code (filtered noise for embers and air, a soft sine chime), so no files or licences. Never needed to understand anything, and it must not fight the video's VO and piano.
    - `svelte/motion` `Spring` only where a motion must be interruptible (e.g. tapping a lantern twice). Built in, no new dependency. Svelte transitions ignore CSS reduced-motion rules: any new `fly`/`scale` must check `prefersReducedMotion` like SkyView's `calm()`.
    - Skip: GSAP, Rive, Three.js/PixiJS (CSS already carries every ritual at 60 fps; Rive adds a runtime and an outside tool), "Motion for Svelte" (no official port, only community ones), lantern dragging and scroll parallax (they push toward "game").
- [ ] Deploy (Firebase Hosting + Functions) with production App Check (reCAPTCHA Enterprise). Keep it running through Dec 16.
- [x] Boundary diagram animation for the video (`design/storyboard.md` beat 8): `/boundary.html` (D41). Check it in the Performance panel and at full speed in the polish pass.
- [ ] Record the demo video (≤ 3 min, YouTube, public) around Nov 26–27 with warm Nano, following `design/storyboard.md`. Show the boundary moment, kindred lanterns and the no-Nano path. Show DevTools' Network tab during the reflection: no request to Firebase's AI endpoint while Nano runs.
- [ ] Write-up: the redaction finding and redesign (D1/D2), why letter text never gets `PREFER_ON_DEVICE` (D14), the pre-existing-work disclosure, and the build summary.
- [ ] Go through the §1 Stage 1 checklist. **Submit by Nov 29.**
- [ ] After judging ends (Dec 16): delete the App Check debug tokens (Security → App Check → Apps → Manage debug tokens). One was registered 2026-11-12 for local development ("CLI Debug Token").

---

## 7. Open questions

- ~~Keep-warm: does an open session prevent the unload?~~ **No** (§3b).
- **Reload after idle:** how long? (Test started 14:36:50 IST.)
- **Heartbeat:** does a periodic tiny prompt prevent the unload? Is it acceptable for battery? It's ~85 ms of GPU work every 4 min, and it should only run while the tab is visible.
- **Integrated GPU:** does Nano follow Windows' per-app GPU setting, and how fast is it on an iGPU?
- **Cold-start variance:** why did one cold start take minutes and another ~13 min? Was it queueing behind a stalled prompt, or a cache? Watch it during development.
- ~~**Stack:** plain Vite + TypeScript, or a framework?~~ **Svelte 5 + Vite** (`research/stack.md`).
- ~~**Image model** for lantern painting~~ resolved by D13 (drawn in the browser).
- ~~Does default Chrome ship "Gemini Nano 4"?~~ **No:** default Chrome 157 maps the Prompt API to nano_v3 (§3b-2). Flags apply to every profile, so this needed a flag reset, not a fresh profile.
- ~~Blaze upgrade blocked~~ **resolved 2026-11-12:** the `OR_BACR2_32` error ("unusual sign-in activity") came from doing it in Brave; it worked in Chrome. The project is on Blaze, so D15 stands. ~~Blaze also puts the Gemini Developer API on its paid tier~~ **Wrong (2026-11-13):** the Gemini Developer API bills from a separate AI Studio prepay balance, so cloud calls now go through Agent Platform, billed to Blaze (D31). Keep cloud calls few and small, and keep the $5 budget alert.
- ~~**Server-side Gemini in Cloud Functions** (D15): which SDK?~~ **`@google/genai` on Agent Platform** (D32). The client-side AI Logic calls stay the visible core: on-device reflection, safety and essence, plus the cloud pre-check (D30).
- ~~Name collision~~ resolved: "Dear Sky" (§2).
- ~~**Sky at scale:** how many lanterns, in what order?~~ Yours + kindred + newest, up to ~60 (D32).
- ~~**Name.**~~ Dear Sky.

---

## 8. Reference

### Tech cheat sheet: Firebase AI Logic hybrid inference
The full details are in the `firebase-hybrid-ai` skill (`references/web.md`).

| Mode | Behaviour |
|---|---|
| `PREFER_ON_DEVICE` | On-device if available, else cloud |
| `ONLY_ON_DEVICE` | On-device or throw |
| `PREFER_IN_CLOUD` | Cloud if available, else on-device |
| `ONLY_IN_CLOUD` | Cloud or throw |

- On the web, on-device means the **Chrome Prompt API (Gemini Nano)**, desktop Google Chrome only: the Prompt API is stable for web pages from **Chrome 148** (extensions 138). See `research/chrome-ai-docs.md`.
- `model.initializeDeviceModel()` must run inside a user gesture.
- On-device supports single-turn text, JPEG/PNG images, streaming and structured output. **No** chat, tools, audio/video/PDF or image generation.
- Structured output needs **both** `inCloudParams.generationConfig.responseSchema` *and* `onDeviceParams.promptOptions.responseConstraint`.
- `response.inferenceSource` tells you which model answered (`ON_DEVICE` / `IN_CLOUD`).
- **App Check is required for AI Logic since Nov 2, 2026.** Use the debug token for localhost and reCAPTCHA Enterprise in production.
- Provider: Gemini Developer API (free tier). Cloud models include `gemini-4-argon` and `gemini-3.8-flash` (default fallback `gemini-3.5-flash-lite`). Don't use Gemini 2.5.

### Machine setup (dev laptop)

| Requirement | This laptop | |
|---|---|---|
| Windows 10/11 | Windows 11 Pro | ✅ |
| Chrome 148+ | 157 | ✅ |
| GPU > 4 GB VRAM, *or* 16 GB RAM + 4 cores | RTX 3070 8 GB (RAM 15.7 GB, so the GPU path only) | ✅ |
| ≥ 22 GB free | 488 GB | ✅ |
| Bun / Firebase CLI | 1.3.12 / 15.34.2 | ✅ |
| Gemini Nano | Downloaded, 3.98 GB | ✅ |

**Gotchas:** use Google Chrome, not Brave. Close stuck console sessions (or restart Chrome) before benchmarking. Chrome's model process is `chrome.exe --utility-sub-type=on_device_model.mojom.OnDeviceModelService`; the live one holds about 4.7 GB of private memory.

### Archived
Ideas considered and rejected on 2026-11-04: Dusk (a bedtime story from a child's drawing; kept as the backup), Quiet Hours (a doomscroll-softening extension), plus the earlier generic list (journaling, field inspection, accessibility reader, PII drafter, study companion).
