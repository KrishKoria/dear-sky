# Chrome built-in AI docs: what applies to Dear Sky

Read 2026-11-12 from developer.chrome.com/docs/ai (our notes, with links; the pages are the source of truth).

## Which model, and can we choose it? (confirms PREP.md D22)
- Chrome downloads the model **on demand** and picks a variant for the hardware: a larger Gemini Nano (~4B), a smaller one (~2B), or CPU inference. The page has no say. ([model management](https://developer.chrome.com/docs/ai/understand-built-in-model-management))
- The first `*.create()` of any Nano-backed API triggers the download. `availability()` can also trigger it shortly after a fresh profile starts, if scam detection is on.
- **Gemma is not mentioned in the official docs.** Gemma 4 in `chrome://on-device-internals` is a flag experiment.

## Updates and deletion (engine must handle)
- Chrome checks for model updates at browser start-up; updates are **full downloads**, then **hot-swapped with no downtime**. The model behind a page can change between visits.
- The model is **deleted automatically** when free disk space drops below a threshold, when policy disables it, or after 30 days without meeting eligibility. **It can be deleted mid-session, without regard for running prompts**, and is **not** re-downloaded until something calls `create()` again.
  → Engine: after any failed prompt, re-check `availability()` (PREP.md D23).

## Download progress UX ([inform users](https://developer.chrome.com/docs/ai/inform-users-of-model-download))
- Progress reflects **the still-missing data**, so a page that arrives mid-download starts at 0 (matches our lab finding, PREP.md §3b-2).
- After a fresh download reaches `loaded === 1`, the model still has to be **extracted and loaded into memory**: show an **indeterminate** state. That's our `warming` (the reducer already switches at `loaded >= 1`).
- Pass **the same options to `availability()` as to `create()`/`prompt()`** (languages, modalities). ✅ `CREATE_BASE` is shared.
- Hybrid tip: let people use the feature while the model downloads. For us, writing works fully during `downloading` (DESIGN.md §4b).

## Dos and don'ts ([page](https://developer.chrome.com/docs/ai/built-in-ai-dos-donts)) vs our engine
| Guidance | Us |
|---|---|
| Pre-warm as soon as intent is clear; don't wait for "Generate" | ✅ `warmUp()` on the first gesture (first keystroke in the letter) |
| Start the next likely task while rendering the current one | ✅ Essence precomputed in the background |
| System instructions in `initialPrompts` | ✅ |
| Base session + `clone()`; don't call `create()` repeatedly with the same instructions | ⚠️ Firebase AI Logic calls `create()` per request (D21). Measured on nano_v3: still ~2.5 s from "done" to the first word, so we accept it |
| `destroy()` what you don't need; don't keep several large sessions | ⚠️ AI Logic keeps one session per model instance. Reduced to 3 instances (D23) |
| Treat output as untrusted; don't set `innerHTML` per chunk | ✅ Plain text only. Render by **appending deltas** (`reflect` now passes the delta) |
| Keep inputs minimal; latency grows with input size | ✅ Only the letter and short instructions |
| `responseConstraint` for structure; don't enforce `maxLength` in the schema | ✅ Length is checked in code (leak check / consent card) |
| Consider a 1–2 s artificial delay when a reply is near-instant | ✅ Fits our ritual durations (DESIGN.md §3); never make a `ready` writer wait longer than that |
| The user is the final editor | ✅ Consent card is editable |
| Cache results for repeated identical inputs (IndexedDB) | ➕ To do: cache reflection + essence per letter-text hash (week 2) |

## Sessions ([session management](https://developer.chrome.com/docs/ai/session-management))
- `prompt()`/`promptStreaming()` accept `{ signal }` to abort. Firebase AI Logic doesn't pass one on-device, so our stalls stay a state, not a cancel (see `queue.ts`).
- `contextWindow` / `contextUsage` describe the window; overflow drops the oldest messages. Not an issue: every call is a fresh session with one letter.

## Rendering streamed text ([render responses](https://developer.chrome.com/docs/ai/render-llm-responses))
- Append each chunk (`append()`, `insertAdjacentText('beforeend', …)` or a text node); don't re-set the whole text per chunk. Markdown needs a sanitiser and a streaming parser; our margin note is plain text, so we only append text nodes.

## Versions ([API status](https://developer.chrome.com/docs/ai/built-in-apis))
- **Prompt API on web pages: stable from Chrome 148** (extensions: 138). A sampling-parameters origin trial also starts in 148.
- Summarizer, Translator, Language Detector: 138. Writer, Rewriter, Proofreader: developer trial.
- Note: the [overview page](https://developer.chrome.com/docs/ai/built-in/overview) still says the Prompt API is extension-only; it's stale (last updated May 2025).

## Second pass (2026-11-12): what else we could use
Read in full: overview, prompt-api (updated Oct 21, 2026), structured-output, session-compacting, streaming, built-in-apis, get-started, summarizer-api, language-detection, translator-api, firebase-ai-logic, debug-built-in-model, proofreader-api. Saved but **not yet read**: writer-api, rewriter-api, prompt-api-polyfill, task-api-polyfill, cache-models. **Not yet fetched**: translate-on-device, evals, webmcp (+ build-tools, declarative, imperative), agents, client-side, glossary, platform, scale-summarization, product-reviews-on-device, evaluate-reviews, join-epp.

**Outcome (2026-11-12):** adopted D24 (safety check on pause), D25 (copied-text leak check), D26 (English-only release guard, first with the Language Detector, then made deterministic); `samplingMode` and `omitResponseConstraintInput` go to the lab first; the rest is dropped. **Contest rule (re-read 2026-11-12): "All of your app's AI inference must go through Firebase AI Logic, so don't call other model APIs directly."** That excludes calling the Language Detector, Translator, Summarizer etc. directly; only Firebase AI Logic (which uses the Prompt API underneath) may run inference. Firebase AI Logic forwards `createOptions` and `promptOptions` unchanged and supports image parts, but not audio parts or `prefix: true` (PREP.md §3b-2).

Candidates as first listed:
- **Prompt API multimodal input (image, audio).** Image: `HTMLImageElement`, canvas, `Blob`, `ImageBitmap`, etc. Audio: `AudioBuffer`, `Blob`, etc. **Audio input requires a GPU.** Possible features: a spoken letter transcribed on-device (audio never leaves), or a photo of a handwritten letter read on-device. Declare `{type:'audio'}`/`{type:'image'}` in `expectedInputs` for both `availability()` and `create()`. AI Logic's docs show multimodal via `inlineData` parts.
- **`samplingMode` (web, origin trial from Chrome 148).** Enum `most-predictable` … `most-creative`, passed to `create()`/`availability()`. Use cases: predictable for the safety check and essence, slightly-creative for the reflection. An origin trial token works without flags (fits D22). Raw `topK`/`temperature` are extensions-only.
- **Assistant prefix (`prefix: true`)** on a trailing assistant message prefills the reply. Could steer the reflection's opening and fix the style breaks (e.g., "It's interesting that…").
- **`responseConstraint` details.** The schema costs context tokens; `omitResponseConstraintInput: true` avoids that (then describe the shape in the prompt). `session.measureContextUsage()` measures it.
- **Language Detector API (stable, 138, desktop only, tiny model).** Detect the letter's language locally to set `expectedInputs` languages (Prompt API supports en, ja, es, de, fr from Chrome 149) and to choose the leak-check behaviour. A 0.7 confidence threshold, falling back to `navigator.language`, is the documented pattern.
- **Translator API (stable, 138, desktop only, expert model, ~38 languages).** Translate kindred lanterns' essences into the viewer's language **on-device**, so the shared sky reads in your own language. Translations run sequentially; language packs download on demand (user activation needed).
- **Summarizer API (stable, 138).** Types `tldr`/`teaser`/`key-points`/`headline`, `preference: 'speed'|'capability'|'auto'`, `sharedContext`, `context`. Probably not better than our essence prompt, but a fallback candidate.
- **Proofreader API.** Dev/origin trial (OT ran Chrome 141–145). Not for us: correcting a grieving letter is the wrong tone.
- **Writer/Rewriter.** Developer trial only on web, so they fail D22 (no flags).
- **Not in Web Workers**: Prompt, Summarizer, Translator, LanguageDetector, Proofreader are all main-thread only (top-level + same-origin iframes).
- **Abort:** `create({signal})`, `clone({signal})` and `prompt(…, {signal})` all accept an `AbortSignal`.
- **Context overflow:** `contextoverflow` event; `QuotaExceededError` has `requested` and `contextWindow`.
- **Debugging:** `chrome://on-device-internals` → Event Logs shows the exact prompt the model received (Dump → JSON). Use it to check what AI Logic actually sends.
- **Firebase AI Logic page:** App Check is enforced automatically for new AI Logic setups from July 2026 (we already have it). Their demo shows that on-device makes no request to `firebasevertexai.googleapis.com`, a good thing to show in the demo video (DevTools Network tab).
- **Overview page:** still says the Prompt API is extension-only (last updated 2025-05-20); stale. The Prompt API page says web is stable from 148.

## Third pass (2026-11-12): the remaining pages
Every page linked from `/docs/ai` is now read: writer-api, rewriter-api, prompt-api-polyfill, task-api-polyfill (concept part), cache-models (skimmed), client-side, translate-on-device, scale-summarization, evaluate-reviews, product-reviews-on-device, evals (course index + rule-based + judge part 1), webmcp, agents, join-epp, platform, glossary. The ~15 blog posts linked from `/docs/ai/built-in` (incl. the 2025 AI Challenge winners) are not read.

- **Writer/Rewriter:** the origin trial ran Chrome 137–148 and is over; on 157 they need flags. Out (D22).
- **Task APIs are prompts:** Chrome implements the Summarizer, Proofreader etc. as fixed system prompts on the same Nano (visible in `chrome://on-device-internals` Event Logs). Our own essence prompt is the same mechanism with more control, so no reason to use the Summarizer. EPP says smaller expert models will replace some of them later.
- **Prompt API polyfill** (npm `prompt-api-polyfill`): a spec-compliant `LanguageModel` on cloud backends or locally on Transformers.js (WebGPU/Wasm, e.g. Gemma 3 1B, downloaded per origin). Cloud backends are out (D14). The local backend could in theory give Brave/Safari a private reflection, but it bypasses Firebase AI Logic and needs a large per-site download; out for v1 (D22).
- **`navigator.storage.persist()`** (cache-models page): asks the browser not to evict the origin's storage under pressure. Use it for kept letters in IndexedDB; Chrome may grant it silently or refuse, so design for both.
- **Evals course:** rule-based evals give binary PASS/FAIL from code and are unit-testable; an LLM judge (cloud, strict persona, PASS/FAIL + rationale, low temperature or high thinking) grades subjective qualities, aligned against a small hand-labelled set. Fits our open prompt-tuning work: a rule-based reflection-style check in the lab (banned words, questions, praise, sentence count) on fictional letters only; a cloud judge only ever sees fictional lab letters, never a user's.
- **Product reviews case study:** client-side checks can be bypassed, so re-check on the server (matches D15); let a flagged item through to the server check rather than hard-blocking on a possibly false client flag; the user has the final word (matches the consent gate).
- **WebMCP:** origin trial from Chrome 149 (no flags with a token), lets a page expose tools to browser agents. Not for Dear Sky: an agent writing or reading letters defeats the point, and agent pipelines are often cloud models, which would carry letter text off the device. Out.
- **Coming (EPP only, not usable now):** an Embeddings API (local vectors: on-device semantic search), Gemma 4 integration, expert models for Summarizer/Proofreader, tool calling (`chrome://flags/#prompt-api-tool-use`). An on-device embeddings API would suit kindred lanterns one day; today D16 stays in the cloud.
- **Summary of summaries / long input:** split at paragraphs, summarize parts, then the summaries. Not needed: letters are short. If a very long letter ever exceeds the context (`QuotaExceededError`), cap letter length in the UI instead.
