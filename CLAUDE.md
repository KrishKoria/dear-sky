# Dear Sky, for the #BuildHybridAI 2026 hackathon

A web app for writing unsent letters. Gemini Nano reflects on the letter **on-device** (Firebase AI Logic hybrid inference) and condenses it into an anonymous `feeling` + `essence` + `motif`. After a code leak check and the user's approval, only those words go to the cloud. There they are moderated and become a lantern, drawn in the browser, rising into a shared night sky next to "kindred" lanterns.

Read first: `PREP.md` (plan, measured findings, decisions D1–D20, to-dos), then `DESIGN.md` (UI standard).

## Rules

- **UI quality is the top priority.** Read `DESIGN.md` before writing or reviewing any UI. The UI must be endearing, cute and beautiful, with zero jank. This is an emotional app, and rough details read as carelessness. When scope and polish conflict, cut scope.
- **Use Bun for everything** (`bun add`, `bun run`, `bunx`). Never use npm, yarn or pnpm.
- **The privacy boundary lives in code.**
  - Letter text, raw or redacted, never leaves the device. Only an `ONLY_ON_DEVICE` model instance processes it.
  - Only `feeling` + `essence` + `motif` may go to the `ONLY_IN_CLOUD` instance, and only after (1) a deterministic leak check that blocks phone numbers, emails, URLs, @handles and any capitalised word from the letter that isn't on an allowlist, and (2) the user approving the exact words.
  - Never use a silent cloud fallback for letter text.
  - Why: on 2026-11-04, Nano's redaction leaked names in 2 of 5 test letters, while its essences were clean in 10 of 10.
- **Nano engine rules** (from the 2026-11-04 benchmark, PREP.md §3b):
  - One module owns all Nano access: one base session **with the system instructions in `initialPrompts`** (Chrome's official guidance; it makes the first prompt faster), **one `clone()` per letter** (1 ms vs 8 s for a cold `create()`): the reflection is its first prompt, the essence a follow-up on the same clone without re-sending the letter (follow-ups skip ~2.5–3 s of per-session setup; PREP.md D7). Destroy the clone afterwards. Keep prompts' inputs minimal.
  - **All prompts go through one serial priority queue.** Chrome runs prompts one at a time anyway, so parallel calls only queue, and a stalled prompt blocks everything behind it.
  - Warm up on the first user gesture (`initializeDeviceModel` needs one). Cold starts can take minutes.
  - Every Nano call has a timeout and streams when the user is waiting.
  - Precompute the essence in the background after the reflection.
  - **Safety check runs first** (code check + a separate Nano safety prompt), before the reflection. On risk, show the care card instead of the model's reflection (PREP.md D19).
  - Pre-load the letter into the clone with `append()` on pause; retry once on empty output or `UnknownError` (PREP.md D20).
  - Expose readiness as an explicit state (`ready | warming | slow | stalled | unavailable`), and design every state (`DESIGN.md` §4b).
  - Always pass `expectedInputs`/`expectedOutputs` languages.
- **Moderate in the cloud** before any essence appears in the shared sky.
- **Hackathon timing.** The building window runs from Nov 11, 2026, 1:30 PM PT to Nov 30, 2026, 2:00 PM PT (official rules). Code written before Nov 11 doesn't count. Target submission: Nov 29.
- Use the `firebase-hybrid-ai` skill for any Firebase AI Logic work. Firebase project: `hybridai-785bb`. Test in Google Chrome (Nano) **and** Brave (no Nano).
