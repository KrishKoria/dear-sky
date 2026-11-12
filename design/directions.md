# Lantern: visual directions (Stitch exploration, 2026-11-12)

> These are design references made with Stitch, not production code. The source of truth is still `DESIGN.md`. Stitch project: **Lantern** (`projects/740738088051492647`). Design system: **Lantern Night** (`assets/9943776359274660961`).
>
> **How this was made.** I used the `impeccable` process, with three deviations:
> - **No `PRODUCT.md`.** The impeccable "teach" step needs the user, so this run treated `DESIGN.md` together with PREP.md §2 and §4 as the confirmed brief. Run `$impeccable teach` later to create a proper `PRODUCT.md`.
> - **The shape interview was skipped.** This ran as a background task with no way to ask questions.
> - **Stitch did the visual probes.** It stood in for native image generation.

## 1. The scene sentence (it forces the theme)

Someone alone at 11 pm, with the lights off, writing to a mother who died. The only light is the laptop or phone, and they don't want to be watched. That makes the theme **dark**, with **Restrained** colour: a night-indigo base, warm cream paper only where the letter lives, and lantern amber as the single accent. Moonlight lavender is reserved for privacy and secondary text.

**Type picks.** Stitch only offers its own font list, and every pick below avoids impeccable's banned-font list.
- **Letter:** Vollkorn, a warm book serif.
- **Reflection:** Caveat, loaded from Google Fonts; Stitch can't set it as a token.
- **Interface:** Nunito Sans.

Re-evaluate in code: the letter face could become Literata, and the handwriting face Kalam. See §6.

## 2. The three directions

| | Direction | Screenshot | What works | What fails |
|---|---|---|---|---|
| A | **The quiet sheet.** One tall paper sheet on a night sky. The reflection sits in a ruled right margin *on the paper*. A candle at the page corner. | `stitch/dirA-writing.png` | Calmest and most legible. The margin space is reserved, so streaming text never moves the letter (DESIGN §5). The reflection reads as "someone writing back beside you" (§4.2) | The sky was almost empty and the candle tiny. Too little of the "cute, living" quality |
| B | **A pool of lantern light.** A hanging paper lantern lights the page from the upper left. The reflection floats *off* the paper in the dark, in glowing amber | `stitch/dirB-writing.png` | The most cinematic. The hanging lantern is the strongest brand object of all three | Stitch invented **false privacy copy** ("encrypted in local memory", "no drafts are synced"). Chrome in all four corners, a chatbot-like "companion · just now" label, and an amber button that competes with the letter. A reflection floating in the sky can't be space-reserved on narrow screens |
| C | **A picture-book rooftop.** Flat gouache-style town and sky, five pastel lanterns, a landscape note card with a wax-seal "stays on this device" badge | `stitch/dirC-writing.png` | The most endearing. Shows lanterns before you've released one. The rooftop window is a lovely detail | **The dotted-grid paper reads as a bullet journal or productivity notebook** (it fails the §1 SaaS test). Too much colour around the letter. A landscape card instead of a letter sheet. Rough shapes (a floating chimney) |

### Recommendation: **"The quiet sheet by the window"** (A as the base, with C's world and B's lantern)

- **From A:** the tall paper with the reflection in an on-paper margin. It's the zero-jank choice, since the reflection's space exists before a word streams in, and it keeps the intimacy of a private notebook.
- **From C:** a low picture-book horizon of *rounded* rooftops and one warm attic window, plus 2–3 tiny distant lanterns. The world feels alive, and nothing competes with the page.
- **From B:** the hanging lantern as the hero object of the **consent** moment, where the slip of exact words hangs from it by a thread. It turns consent into a physical act ("this tag goes on this lantern").
- **Readiness:** the candle at the page corner stays the readiness signal (DESIGN §4b): unlit, then catching, then steady, then drowsy. It must be larger and more lovable than Stitch drew it.

### Decision (2026-11-12): the recommendation above, pushed further toward C's sky

Chosen by the user. It overrides the recommendation where they differ.
- **Paper and margin: A, exactly.** A tall cream sheet with a slight tilt. Letter in a serif, reflection in a reserved on-paper right margin in amber handwriting. Plain paper with a subtle grain. **No dot grid** (it reads as a bullet journal).
- **Sky: C's world, not A's empty sky.**
  - A soft moon with a drifting cloud or two.
  - Sparse twinkling stars.
  - The rounded-rooftop horizon with one warm lit window and a chimney curl of smoke.
  - A few small lanterns drifting far away.
- **One accent family, not a rainbow.** Lanterns use warm, muted tones only (honey, apricot, peach, rose-gold, ember), all glowing amber from inside. This supersedes the six-colour palette in §4 rule 3. The variety comes from shape, ribs and glyph, not hue.
- **B's hanging lantern** appears only on the consent screen (the tag of exact words hangs from it).
- **Candle** at the page corner is the readiness meter, larger and more lovable (§4 rule 2).

## 3. Screens produced (recommended direction)

All paths are relative to `design/`. Stitch's HTML is in `stitch/html/` (Tailwind CDN plus Google Fonts; for reference only).

| # | Screen | Screenshot | HTML | Stitch screen ID | Verdict |
|---|---|---|---|---|---|
| 01 | Writing, mid-letter, reflection streaming (ready) | `stitch/01-writing-midletter.png` | `html/01-writing-midletter.html` | `a2eaf0275dfb4c22b8f314b6b38995e7` | **Hero.** Keep |
| 02 | Writing, empty, **warming** (candle catching, hover tooltip) | `stitch/02-writing-empty-warming.png` | `html/02-writing-empty-warming.html` | `239e98770d70476c876c6d05f13d9e3e` | Good. Candle too small |
| 03 | Choose: keep / let it go / release | `stitch/03-choose.png` (v1: `03-choose-v1.png`) | `html/03-choose.html` | `906756497bce4ce4ac2eb05aa1380516` (v1 `faa5d74e36084172be9f0c455ac230bd`) | OK. The illustrations need hand-drawing |
| 04 | Condensing ritual (frozen frame) | `stitch/04-condensing.png` | `html/04-condensing.html` | `00d361bc7d3f41f3b3cd9ca6bb069df3` | The concept is strong: words glow and drift into the essence line. Chrome needs fixing |
| 05 | **Consent** (exact words, editable, leak-check note) | `stitch/05-consent.png` (v1: `05-consent-v1.png`) | `html/05-consent.html` | `5d0fd3414d1b4e4295284ed67f39120b` (v1 `56142c3c8f334dbebeed22b0d1a1802c`) | **Best screen.** Keep |
| 06 | Write your own words (no Nano, or stalled) | `stitch/06-own-words.png` | `html/06-own-words.html` | `fddd5d4c8abc4b948b405b1d32efd183` | Good. The 15-dot meter works |
| 07 | **Stalled** (choices written as marginalia) | `stitch/07-stalled.png` | `html/07-stalled.html` | `7f3ed343c78046efbe56665dbdbe6a91` | Good. See the open question on cloud consent |
| 08 | The sky (few lanterns, one tapped, "yours") | `stitch/08-sky.png` | `html/08-sky.html` | `3278fd693069425bb8c9d115c7292f40` | **The lantern shapes are the best of the run** (bell/teardrop, ribbed, glowing). The chrome around them is wrong (§5) |
| 10 | Phone, writing with the reflection inline | `stitch/10-phone-writing.png` | `html/10-phone-writing.html` | `8e979a213d2b49969380cfcc82bd8ca9` | Good layout. The bottom area needs work |

**Not produced** (Stitch timed out three times; generate these in the Stitch UI or design them in code):
- the full sky with hundreds of lanterns
- the phone sky with the tag sheet
- a cleaned-up version of 08

**Not attempted** (they need motion, not stills): burning, lighting and rising, the "keep" confirmation, the letters list, and the offline "waiting for the wind" state.

## 4. Design rules that emerged (fold into DESIGN.md if agreed)

1. **The reflection lives on the paper.** On desktop it sits in a ruled right margin about 170 px wide, reserved from the start. On phones it sits under the letter after a pencil squiggle, with its height reserved. It is never a floating bubble.
2. **The candle is the readiness meter**, at 28–32 px and lovable:
   - unlit with a curl of smoke: `warming`
   - steady with a warm glow on the page corner: `ready`
   - a low, drowsy flame: `slow` and `stalled`
   - no candle, just the moon badge: `unavailable`

   Text appears only on hover or tap.
3. **Lanterns are recipes.** Each is a bell or teardrop paper body with 3–5 ribs, a dark cap and base, an inner glow, one muted palette colour (honey, rose, sky, sage, lilac, apricot) and one tiny glyph. Sky lantern 08 is the reference shape. Everything is vector, so a cloud-side "lantern recipe" (palette, glyph, size) is enough. No image model needed.
4. **Consent is a tag on a lantern.** The exact words sit on a paper slip with an eyelet, hanging from the lantern. Its labels are "feeling", "the words" and "the image". Each line has an inline pencil to edit. Leak-check hits get a soft amber wash under the word plus a handwritten note with a small arrow. The two buttons are equal in size.
5. **Stalled choices are marginalia, not a dialog.** They are written in the margin in the handwriting face, and the letter is never covered.
6. **The horizon is always rounded rooftops**: three dim indigo layers and one or a few warm windows, in the bottom ~14% of the screen. Never jagged mountains.
7. **The "on this device" moon badge appears only on private surfaces.** It never appears in the sky or anywhere on the cloud path (DESIGN §6: privacy copy must be true in code).

## 5. What Stitch got wrong (fix by hand when building)

**Truthfulness (most important)**
- **False privacy claims Stitch invented on its own:**
  - "encrypted in local memory" and "no drafts are synced or saved to any cloud" (dir B)
  - "on this device" and "kept quietly on this device" in the **shared sky** (08)

  None of these may ship unless they are true in code. Write privacy copy by hand.
- **Invented features and navigation:**
  - "whispers", "letters in flight", "about" (08)
  - "154 words resting" and "late night · 2:14 am" (B)
  - "october 24 · quiet room" (04)
  - "i'm done for now" in the nav during the condensing ritual (04, 06)
  - a left-over "your letters" active underline on the writing screen

  Remove all of them.

**Banned patterns** (impeccable and DESIGN.md)
- **A side-stripe border** on the leak-check note (05 v1). Fixed in v2.
- **An all-caps tracked label**, "CONDENSING TO STARLIGHT" (04). Use lowercase.
- **Icons inside circles** (03 v1, 06 feelings). They read as an app template. Hand-draw them.
- **Dotted-grid paper** (dir C). Use a fibre texture only.

**Shape and polish**
- **The horizon** was drawn as **sharp triangles or mountains** in most screens, even when asked for rounded rooftops. Draw it once as an SVG component.
- **Stray artefacts:**
  - a floating amber dash at the top centre (03)
  - a "window" button floating at the bottom (03)
  - a window glyph floating in the sky (05 v2)
  - a blurred amber blob for the attic window
  - the moon overlapping the wordmark (01, 02)
- **The candle is ~20 px and reads as a rectangle.** It needs a real drawing at 28–32 px: rounded wax, a drip, a teardrop flame.
- **Greyed-out paper:** in 03 and 06 the "dimmed" letter turned grey. Dim with opacity over cream, never grey.
- **Phone (10):** the button floats in a black void below the horizon, and the moon collides with the menu button. Pin the horizon to the bottom and put the button above it with safe-area padding.

**Code-level (the HTML is not usable as-is)**
- It uses the **Tailwind CDN**, `transition-all`, and `blur()` filters on large layers. The blur costs performance on the sky.
- It uses **Material Symbols** icons (for example `soup_kitchen`), which clash with the hand-drawn style.
- The em dash in sample letters is user content, but UI copy must not use one.
- Rebuild from tokens. Animate only transform and opacity (DESIGN §3).

## 6. Open design questions

1. **Stalled → "ask the cloud instead" sends the letter to the cloud.** PREP D10 and DESIGN §4b allow it with explicit consent. CLAUDE.md says letter text "never leaves the device" and "only an `ONLY_ON_DEVICE` model instance processes it". These conflict. Decide before building screen 07. My suggestion: drop the cloud reflection, and offer "keep waiting" and "write the lantern's words yourself" only. It keeps the privacy story absolute, which is also the strongest pitch to judges.
2. **Fonts.**
   - Caveat is charming, but thin at 15–17 px on cream (check WCAG AA at the amber-brown `#A36A38`; it may need darkening to about `#8A5428`). Kalam is the more legible alternative.
   - Vollkorn vs Literata for long letters: test both at 18–19 px.
3. **What is "home"?** The writing sheet, or the sky? The nav currently says "your letters" and "the sky". For first-time visitors, opening on the sky (with a "write a letter" pill) may explain the product faster; for returning writers, the sheet is better.
4. **Phone reflection placement.** Should the reflection sit under the letter (it may scroll out of view while they write), or on a fold-up margin tab?
5. **Choose screen:** keep the letter preview at the top, or let the paper itself shrink into place as a transition? The latter is less layout and more ritual.
6. **The sky with 0 lanterns.** Draw it with a single "yours could be the first tonight" lantern and the town still lit (not designed yet).
7. **Name.** Every screen uses "lantern" as the wordmark. It's a working title, so screens will need a pass once the name is final.

## 7. Top risks

1. **Copy truthfulness drift.** Generators keep inventing reassuring privacy lines. Every privacy sentence must be hand-written and tied to which model instance runs.
2. **The ritual moments** (condensing, burning, rising) **can't be judged from stills.** They need 2–3 coded motion prototypes each (DESIGN §8), and that is where the remaining "endearing" factor lives.
3. **Sky performance at scale.** Hundreds of glowing lanterns with blur and glow will jank on integrated GPUs. Plan it from day one as a single canvas or WebGL layer with pre-rendered glow sprites and level-of-detail by depth.

## 8. Final references (2026-11-12)

These follow the Decision in §2. The Stitch design system "Lantern Night" was updated with warm-only lantern tones, plain grained paper and the rounded-rooftop world. Stitch rejected the `VOLLKORN` font value, so the system now uses **Literata** for headings and body.

| Screen | Screenshot | HTML | Stitch screen ID | Status | Fix by hand when building |
|---|---|---|---|---|---|
| 01 Writing, mid-letter (ready) | `stitch/final-01-writing.png` | `stitch/html/final-01-writing.html` | `6086dcaccdfe47fea9d89f54bb6f062e` | Done | The cloud renders as a dark blob *inside* the moon; it should be a pale wisp across it. The rooftops read as round hills, so give them roof shapes. The paper still has a faint dot texture; use plain grain. The candle could be a little bigger. |
| 02 Writing, empty (warming) | none | none | n/a | **Not done.** Tried twice: one edit timed out, and one returned DOM edits on 6086 that never saved to the stored file | Build from final-01 with: the faded-ink placeholder "who are you writing to tonight?", an empty margin (space still reserved), an unlit candle with a curl of smoke, and a pale cloud wisp. Stitch's proposed SVGs for the smoke and the wisp are in that edit's response (session `6343214604998324033`). |
| 05 Consent | `stitch/final-05-consent.png` | `stitch/html/final-05-consent.html` | `cb45c693959b4c93b371db68e49d2f0c` | Done. The copy is exactly as given and checked against D1/D13/D14/D16 | The crescent moon still crowds the logo; use final-01's full moon placement. The "lit window" reads as a tiny lantern; draw a real attic window on a roof. |
| 08 The sky | `stitch/final-08-sky.png` | `stitch/html/final-08-sky.html` | `373650d605724cbf82564335f51407fa` | **Partial.** The warm-recolour edit timed out and never applied | **Recolour every lantern to the warm family** (pink becomes rose-gold, blue becomes honey, teal and lilac become pale peach). Remove the lit windows floating mid-sky and the coloured bars along the bottom edge. Use rounded rooftops instead of waves. The HTML has a comment-only footer "kept quietly on this device" plus links ("whispers" and others); don't carry any of it over (no badge in the public sky). Keep: the tag "i still set two cups out, out of habit" / longing, the "yours" lantern, and "every lantern here is a few words someone chose to let go". |

**Privacy copy check.** Every *visible* privacy sentence on final-01, 05 and 08 is true under PREP D1/D13/D14/D16:
- final-01: the "on this device" badge on the private writing surface.
- final-05: the consent paragraph.
- final-08: no privacy claim is visible.
