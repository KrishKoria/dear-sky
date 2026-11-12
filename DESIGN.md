# Dear Sky: design standard

> **Read this before writing or reviewing any UI.** This is the most important document in the project.

Lantern is where people write to someone they lost, someone they hurt, or someone they used to be. Users arrive carrying grief, regret or love. The interface must feel like a warm room at night: soft, kind, slow when it should be, never cold.

**There is no room for jank.** A stutter, a layout jump, a harsh error message or a generic spinner breaks the moment. In an app like this, broken moments feel like a lack of care. The bar is **endearing, cute and beautiful**, with every detail deliberate. Polish is not phase 3; it's the product. We ship fewer features, finished, rather than more features, rough.

---

## 1. Feeling

| We are | We are not |
|---|---|
| Warm, quiet, unhurried | Clinical, productive, "app-like" |
| Cute in a gentle, handmade way (soft shapes, small living details) | Childish, cartoonish, sticker-heavy |
| Intimate, like a private notebook | A social feed, a dashboard, a chatbot |
| Restrained, with one glowing accent in a dark sky | Busy, gradient-soup, neon |
| Trustworthy about privacy, visibly | Vague about where words go |

Test: if a screen could belong to a productivity SaaS, redo it.

## 2. Visual language

- **Palette.** A deep night sky as the base (indigo to near-black blue), warm lantern amber as the single accent, paper cream for the letter surface. Define every color as a token. No raw hex values in components.
- **Paper.** The letter is written on a sheet that looks like paper: a subtle texture, soft edges, a slight resting tilt (around 0.5°), and a soft shadow. Text sits on the paper, never on a plain text box.
- **Type.** A warm, readable serif or rounded face for the letter body. A gentle handwriting-style face for Nano's margin reflections, chosen for legibility first. A quiet sans for UI chrome. At most three faces, preloaded, with `font-display` set so there is no flash of fallback text.
- **Shape.** Rounded corners everywhere (no sharp rectangles). Soft, diffuse shadows. Glow instead of hard borders.
- **Living details** (this is where "cute" comes from):
  - The lantern flame flickers subtly.
  - Stars in the sky twinkle at slow, random intervals.
  - Buttons give a soft squish on press.
  - The empty sky is drawn, never blank.

  Each detail is small. Together they make the app feel alive and cared for.
- **Contrast.** Text meets WCAG AA on every surface. Beauty never costs legibility.

## 3. Motion

Motion is how this app shows emotion, so it gets the most care.

- **Animate only `transform` and `opacity`.** Never animate layout properties (`width`, `height`, `top`, `margin`). Target a steady 60 fps, and check every ritual moment in the DevTools Performance panel.
- **Easing.** Ease-out or spring curves for everything. No linear motion, except the lantern's slow drift.
- **Durations.**

  | Kind | Duration |
  |---|---|
  | UI feedback (press, hover, focus) | 120–200 ms |
  | Screen and panel transitions | 300–500 ms |
  | Ritual moments (redaction, lighting, rising, burning) | 2–6 s, never skippable by accident, always skippable on purpose |
- **`prefers-reduced-motion`.** Every animation has a calm alternative (a fade instead of a rise). This is a requirement, not optional.

## 4. The ritual moments

These are the scenes judges will remember. Each one is designed and prototyped before it's wired to real data.

1. **Writing.** The blank page invites you in: a soft prompt in faded ink ("who are you writing to tonight?"). Nothing else competes for attention.
2. **Margin reflection.** Nano's reflection streams in word by word in the handwriting face, as if someone is writing back beside you. Space is reserved ahead of time, so the letter never shifts.
3. **Choosing.** Three gentle choices: keep, burn, release. Each has a small illustration.
4. **Burning** (cannot be undone, so it asks once, kindly). The paper curls and turns to warm embers that drift up and fade. It's sad but soft, never violent.
5. **Release, part 1: condensing.** The letter's words slowly fade. A few glow and drift together into the essence, the short line that will become the lantern. This covers the 2–6 s on-device step. A small "on this device" moon badge stays visible. *(This replaced an earlier "strike-through redaction" idea. Testing showed Nano's redaction leaks names, so the UI must never show redaction as a privacy step. See PREP.md.)*
6. **Release, part 2: consent.** The user sees exactly what will leave the device: the essence and motif, and nothing else. They can edit those words. One clear button to agree, and an equally visible way to change their mind.
7. **Lighting and rising.** The cloud paints the lantern. While it does, the flame is being lit, never shown as loading. The lantern then rises slowly into the sky and joins the others.
8. **The sky.** Strangers' lanterns drift. Tap one to read its one-line essence. Nothing to like, count or reply to.

## 4b. Waiting and fallback states (designed, not afterthoughts)

**Whatever Chrome gives us (PREP.md D22).** We can't choose the on-device model or its speed. The same person may get a 0.1 s first word on one day and a minutes-long cold load after a Chrome update. These states are the product, not edge cases: design every screen for all of them.

Benchmarks (PREP.md §3b) show warm Nano is fast, but a cold start can take **minutes**. Many users and most judges won't have Nano at all. These states are where many people will meet Lantern first, so they get the same design care as the ritual moments.

| State | What the user sees | Never |
|---|---|---|
| **warming** (cold start) | Writing works fully. A tiny living detail shows the ink is warming, for example a candle at the page corner slowly catching. No text unless they hover or tap it ("your private helper is waking up") | A spinner, a blocking overlay, a percentage bar in the writing space |
| **ready** | The candle burns steadily. The reflection streams in the margin like handwriting the moment they pause or finish | Making a ready user wait for animations |
| **slow** (warm but slow device) | Same as ready. The handwriting simply writes more slowly. The essence is precomputed while they read, so release still feels instant | Apologising for the hardware |
| **downloading** (model not on this device yet, PREP D17) | Writing works fully. The same candle detail, with gentle real progress on hover or tap ("your private helper is on its way") | A percentage bar in the writing space, asking them to wait before writing |
| **stalled** (timeout) | A gentle note: "your helper is taking its time tonight." Two soft choices: keep waiting · write the lantern's words yourself | Error language, red colors, losing the letter, offering to send the letter to the cloud (PREP D14) |
| **unavailable** (no Nano: Brave, Safari, phones, older hardware) | The full experience, minus the private reflection. A first-class "write your lantern's words yourself" step, framed as a gift, not a downgrade ("in your own words, the way only you can"). The letter never leaves the device (PREP D14) | Implying the user's device is "bad", or sending the letter anywhere |
| **offline** | Writing, keeping, burning and (with Nano) the reflection all work. Releases wait as a lantern "waiting for the wind", then rise when back online | Blocking the user |

**The words-you-write-yourself screen** is shared by the no-Nano and stalled paths. It's a small card ("what would your lantern say?") with a 15-word limit shown as softly filling dots. Choosing a feeling is a row of small illustrated icons. The deterministic leak check then runs, and the consent step is identical to the Nano path.

**Leak-check feedback** (when the code blocks a word): gently highlight the word in the consent card, with "this might point back to someone, want to change it?" Never "blocked" or "invalid".

**The shared sky is moderated** by the cloud before a lantern appears. While that happens, the lantern hovers just above the horizon. If moderation declines it, the user gets a kind note and their lantern stays in their *own* sky, private and never lost.

## 5. Zero-jank rules (checklist for every screen)

- [ ] No layout shift. Streaming text, images and late data have reserved space.
- [ ] No spinners. Every wait has a designed state (glow, ink drying, flame being lit).
- [ ] No flash of unstyled or fallback-font content.
- [ ] No browser defaults left unstyled (inputs, scrollbars, focus rings, selection color). Focus rings are restyled to be beautiful and still visible.
- [ ] Every interaction gives feedback within 100 ms.
- [ ] Images load behind a soft placeholder that fades into the real image. They never pop in.
- [ ] Works at phone width and desktop width. No horizontal scrolling.
- [ ] Reduced-motion version checked.
- [ ] Keyboard-only path works for the whole flow.
- [ ] Every readiness state in §4b looks right on this screen: warming, ready, slow, stalled, unavailable, offline.
- [ ] Tested in Brave, which has no Nano, as well as in Chrome with Nano warm.

## 6. Words

The UI's voice is part of the design.
- Gentle, plain, second person. Lowercase-leaning for the soft moments, normal case for anything about privacy, so it reads as serious.
- **Never** say "error", "failed", "invalid", "submit" or "user".
- Every failure state is written kindly and reassures the user their words are safe. Example: "the lantern couldn't light right now. your letter is safe on this device, and we can try again whenever you like."
- Privacy copy is exact, never vague. "This stays on your device" only appears when it's true in code, decided by which model instance runs (`ONLY_ON_DEVICE`).

## 7. Emotional safety

- An on-device check flags letters that suggest the writer may be in danger. The response is a soft, local card with helpline resources. It never blocks the user, and the letter is never sent anywhere because of it.
- Lantern is a reflection space, not therapy, and never claims to be.
- The sky has no social mechanics (no likes, comments or follower counts) and no way to identify a writer.

## 8. Process

- **Explore before building.** Before Nov 9, collect visual references (night skies, paper, lanterns, handwriting, warm illustration styles) and sketch the ritual moments on paper or in Figma. This is planning, not code.
- **Prototype the ritual moments first** (from Nov 9). For the moments that matter most (redaction, rising, burning), build 2–3 throwaway variants and pick by feel, side by side.
- **Use the `impeccable` skill** for design critique and polish passes on every screen.
- **Definition of done for any screen.** It passes the §5 checklist, it's been checked in the Performance panel, and it would look at home in the demo video.
- **When scope and polish conflict, cut scope.**
