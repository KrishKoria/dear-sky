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
