# Dear Sky: demo video storyboard

> Draft 1, 2026-11-13. Recording planned for Nov 26–27 (PREP.md §6). Target length **2:50** (hard limit 3:00).
> Judges may score from the video and description alone (PREP.md §1), so this video is half the entry. **Every Week 2 feature is built for a shot here.** If a feature isn't in a shot, it's the first thing to cut.

## What the video has to prove

| Judging criterion (PREP §1) | Where the video proves it |
|---|---|
| Technological implementation (hybrid AI Logic) | Beats 3, 6, 7, 8: on-device reflection with **zero** cloud requests in DevTools, the leak check in code, three inference modes each used for a reason |
| Design (complete, coherent product) | Every beat: the real app, all ritual moments, no spinners. Beat 9: the fallback states are designed too |
| Potential impact | Beats 1, 2, 7: who it's for (grief, regret, love unsaid) and the kindred-lantern payoff, "others carry this too" |
| Quality of the idea | Beat 8: the redaction finding (names leaked in 2 of 5 letters) and the redesign that came from it (D1/D2) |

Required: ≤ 3 min, English, public on YouTube, **shows the app running** (PREP §1). The app must "function as depicted", so the rules for honesty below are part of the storyboard.

## The demo letter

Fictional, warm, no risk content (it must pass the safety check cleanly). It names a person, a place and a signature, so the leak check has something real to guard against. "Nani" is on the allowlist (`leakcheck.ts`); "Riya", "Lucknow" and "Ananya" are not.

> Dear Nani,
>
> It's been a year since the hospital in Lucknow, and I still haven't deleted your number. Every Sunday at six my phone stays quiet and I keep waiting for it to ring. Riya says you'd laugh at me for that.
>
> I made your dal last week. It wasn't right. Too much salt, and not enough of you behind me saying "slowly, slowly".
>
> I never told you I chose my college because you said I'd be good at it. I was going to tell you at graduation.
>
> I'm doing okay. Mostly. I wear your shawl when it's cold and pretend it counts as a hug.
>
> Love,
> Ananya

Run it through the lab on Gemma 4 a few times before recording day. The essence, motif and reflection on screen are **whatever the model writes on the day**, never typed in by hand. If the outputs are weak, tune the prompts (PREP §6, Week 3), not the video.

## Beats

VO = voiceover. Calm pace, ~130 words a minute, so **~370 words total**. The counts in brackets are the VO budget for each beat.

### 1. Cold open (0:00–0:12) [~25 words]
- **Picture:** black, then the night sky fades up: moon, slow stars, the rooftop horizon with one warm window and a curl of chimney smoke, small lanterns far away. No UI yet.
- **VO:** "Some letters are never meant to be sent. To someone you lost. Someone you hurt. Someone you used to be."
- **On screen:** the title *Dear Sky* in the interface face, fading in near the horizon, then out.

### 2. The page (0:12–0:24) [~25 words]
- **Picture:** the empty sheet slides up. Faded prompt: "who are you writing to tonight?" The candle at the page corner goes from catching to steady (`warming` → `ready`).
- **VO:** "Dear Sky is a place to write them. Your letter stays on your device. Always. Not as a setting, as a rule in the code."
- **Proves:** design; the privacy promise stated up front.

### 3. Writing, and someone writing back (0:24–0:55) [~60 words]
- **Picture:**
  1. The letter being typed, jump-cut to a few lines (see the honesty rules).
  2. On a pause, the candle flame leans toward the letter (it's reading in the background, D28/D29) and nib dots appear in the margin.
  3. A folded note waits in the margin. Click "i'm done for now". The note opens and the reflection writes itself in the handwriting face.
  4. **Insert, about 6 s:** DevTools docked at the bottom, Network tab filtered to `firebasevertexai`, cleared just before "done". **It stays empty** while the reflection streams.
- **VO:** "As you pause, a small model running on your own computer reads along. Gemini Nano, through Firebase AI Logic, on-device only. When you're done, it writes back in the margin. No advice, no fixing. Just the sense that someone heard you. And look: nothing went out."
- **Caption** (over the insert): `ONLY_ON_DEVICE` · 0 requests to the cloud
- **Proves:** technology (on-device inference you can verify), design.

### 4. Choosing (0:55–1:06) [~20 words]
- **Picture:** three choices with their small illustrations: keep, burn, release. **Cutaway, about 3 s:** a *different* letter burning: the paper curls into warm embers that drift up and fade.
- **VO:** "Then you choose. Keep it. Burn it. Or let a little of it go."
- **Proves:** design (a complete product, not only the AI path).

### 5. Condensing (1:06–1:20) [~30 words]
- **Picture:** choose release. The letter's words fade; a few glow and drift together into one line, plus a feeling and an object (the motif). The moon badge "on this device" stays visible the whole time.
- **VO:** "If you release it, the letter still doesn't leave. Nano condenses it here, on your device, into one anonymous line, a feeling, and a small object."
- **Note:** the essence was precomputed during the pauses (D28), so this ritual is pure animation (~3 s); no waiting is hidden in it.

### 6. Consent (1:20–1:46) [~50 words]
- **Picture:**
  1. The hanging lantern with a paper tag: exactly the words that will leave (essence, feeling, motif). Nothing else.
  2. The writer edits the essence and adds "in Lucknow". The word gently highlights: "this might point back to someone, want to change it?" They delete it; the highlight melts away.
  3. "Let it go" (or the final button copy).
  4. **Insert, about 4 s:** the Network tab now shows **one** request; click it, and the payload shows only the approved words. *(Needs the client-side moderation pre-check, D15; see open question 2.)*
- **VO:** "Before anything leaves, code checks these words. Not a model, code: names, places, numbers, anything copied straight from the letter. Then you read exactly what will go, and you decide. These words, and only these words."
- **Caption:** Deterministic leak check · `src/lib/privacy/leakcheck.ts`
- **Proves:** technology, quality of the idea (consent as a visible moment).

### 7. Lighting, rising, kindred (1:46–2:12) [~55 words]
- **Picture:**
  1. The lantern is drawn (its recipe of palette, pattern and glyph) while the flame is lit. Never shown as loading.
  2. It hovers just above the horizon (cloud moderation in the Cloud Function), then rises slowly.
  3. It settles beside two or three others. Tap one: its one-line essence, e.g. "I still set out two cups in the morning."
  4. Slow pull-back to the whole sky.
- **VO:** "Only those words reach the cloud. They're moderated before the shared sky sees them, and Gemini finds the lanterns that carry something close. Yours rises beside them. No likes. No replies. No names. Just a quiet note: others carry this too."
- **Captions:** the lantern recipe: `PREFER_ON_DEVICE` (approved words, so on-device when it can be) · moderation and kindred: `ONLY_IN_CLOUD`, Cloud Function
- **Proves:** impact (grief is lonely; this answers it), technology (the cloud does what only the cloud can: shared data).

### 8. Why it's built this way (2:12–2:35) [~60 words]
- **Picture:** a simple animated diagram in the app's own style. **Left, the device:** letter → safety → reflection → essence → leak check. **Middle:** the consent tag. **Right, the cloud:** moderation → kindred → sky. A dotted line marks the boundary; the letter icon bumps against it and stays put.
- **VO:** "Our first design asked Nano to redact names, then sent the letter to the cloud. In our tests, names leaked in two of five letters. Its one-line essences were clean in ten of ten. So we rebuilt it: the letter never leaves, and the boundary lives in code, with one model instance that can only run on the device, and one that can only run in the cloud."
- **On screen:** "redaction: names leaked in 2 / 5" · "essences: clean in 10 / 10"
- **Proves:** quality of the idea (real understanding of the problem), technology.

### 9. Every device (2:35–2:50) [~40 words]
- **Picture, a quick montage of real states:**
  1. **Brave (no Nano):** "what would your lantern say?" with the 15-dot meter filling as they type. Same consent tag after it.
  2. **Warming:** the candle slowly catching while writing carries on.
  3. **Care card** (still frame, no at-risk letter text on screen): a soft card with helplines.
- **VO:** "No on-device model? You write the lantern's words yourself, and the same checks keep them safe. Nothing is ever sent to the cloud in the model's place. And if a letter suggests you're in danger, a care card appears, here, on your device."
- **Proves:** design (the fallbacks are designed), impact (duty of care), technology (hybrid without a silent fallback).

### 10. Close (2:50–2:58)
- **Picture:** the full sky, your lantern among the others. Title, the hosted URL, the GitHub repo.
- **On screen:** *Dear Sky* · built with Firebase AI Logic and Gemini Nano in Chrome
- No VO; music only. Stop before 3:00.

## Shot → feature map (what Week 2 has to build)

| Beat | Needs | Status |
|---|---|---|
| 1, 10 | Night sky, horizon, distant lanterns | **Built** (`Sky`, `Horizon`, `Lantern`) |
| 2, 3 | Writing screen, candle states, lean cue, nib dots, margin note streaming | **Built** (`WritingScreen`, `Candle`, `MarginNote`) |
| 3 | Nothing extra: the zero-request insert is true today | **Built** |
| 4 | Choose screen + its three illustrations; burn ritual | **v1 built** (keep / release under the sheet); burn and the illustrations still to do |
| 5 | Condensing ritual; moon badge | **v1 built** (on the same sheet: words fade, a few glow and drift up) |
| 6 | Consent screen with the hanging lantern and tag; live leak-check highlight on edit | **v1 built**; lighting it saves to the shared sky (D32), hovers while the server moderates, then rises with its kindred count (D34) |
| 6 | Client-side `ONLY_IN_CLOUD` moderation pre-check (for the payload insert) | **Built** (D30), wired into the consent screen |
| 7 | Lantern recipe (`PREFER_ON_DEVICE`) and the drawn lantern; lighting and rising rituals | Lighting and rising **built** (D34); the recipe is still to do |
| 7 | Firestore sky, pending queue, moderation Cloud Function, Anonymous Auth | **Built** on the emulators (D32–D34); not deployed yet |
| 7 | Kindred ranking + "others carry this too" | **Built**: ranking in the Function (D32); the sky view gathers yours and its kindred with threads, tap to read (D36) |
| 7 | **Seed lanterns:** ~40 essences written by us, put through the same moderation | **Built** (40, `functions/scripts/seeds.ts`) |
| 8 | Boundary diagram animation | New task, Week 3 (an SVG page in the app's own style) |
| 9 | Own-words card with the 15-dot meter (no Nano, stalled) | **Built** (the consent tag starts empty, with the dots) |
| 9 | Warming state, care card | **Built** |

**What this means for Week 2's order:** the release path (beats 5 → 6 → 7) is the spine of the video, so build it end to end first, roughly at first and then polished. Choose + burn (beat 4) and the own-words card (beat 9) come after. If time runs short, the burn cutaway is the cheapest shot to drop. The kindred lanterns aren't.

## Honesty rules (the app must "function as depicted")

- **Never speed up model output.** The reflection streams at its real speed. Jump-cuts *between* scenes are fine.
- **Typing** may be jump-cut (a few lines, then a cut to the finished letter). Don't speed it up so that it looks like the model.
- **The model is warm when recording** (one throwaway letter first). The warming state is shown honestly in beat 9, not hidden.
- **Seed lanterns are disclosed** in the write-up, and they pass the same moderation as everyone else's.
- **The outputs on screen are the model's real outputs** from that take. Re-record rather than edit text.
- **Record the hosted production build**, not `bun run dev` (the dev state switcher must not appear).

## Recording setup (Nov 26–27)

- **Chrome stable, Gemma 4:** `#gemma4-for-built-in-ai` on, `#decisions-api` off (D27). Check `chrome://on-device-internals` before the take: `gemma4_gpu_high_tier_model` loaded.
- **Brave** for beat 9, same hosted URL.
- A clean Chrome profile: no extensions, bookmarks bar hidden, notifications off, browser zoom 100%.
- Capture at 1920×1080, 60 fps (OBS). The window fills the screen; the cursor is visible only where it clicks.
- **DevTools inserts:** docked at the bottom, Network filter `firebasevertexai`, "Preserve log" on, cleared just before "done". Large font (Ctrl + in DevTools) so it reads at 1080p.
- Reduced motion **off** for the main take. Record one short reduced-motion clip as a backup for the write-up.
- **Audio:** VO recorded separately in a quiet room; soft piano under it, royalty-free (YouTube Audio Library), ducked under the voice. Burned-in captions plus a YouTube caption file.
- **Fallback plan:** if Gemma 4 misbehaves on the day, record on default Chrome (nano_v3) and drop the "Gemma 4" mention. Nothing in the VO names a model version except "Gemini Nano".

## Open questions

1. **Voice:** your own voice, or captions over music? *Recommended: your own voice.* Calm and imperfect suits the app better than a polished narrator.
2. ~~The payload insert in beat 6 needs a client-side moderation pre-check.~~ **Decided: yes** (PREP.md D30, 2026-11-13). Built and tested in `src/lib/cloud/moderation.ts`; it gets wired in with the consent screen.
3. **The care card in beat 9:** a still frame with VO, no at-risk letter on screen. OK, or leave it for the write-up only? *Recommended: keep the still.* It shows duty of care in 3 seconds without dramatising risk.
4. **Seed sky size:** ~40 lanterns is enough for kindred to find real matches on camera. Should the public sky also launch with them, or start empty and use the seeds only for the demo project?
