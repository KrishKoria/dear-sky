# Lantern: visual reference board

> For `DESIGN.md` §8. Collected 2026-11-12. Every link below came from a live search or scrape that day. Games and apps are listed **for mood and tone only**. We don't recreate any of them.

## Suggested direction

**A handmade paper night.** The sky is a deep indigo-to-ink gradient with very slow grain, drawn rather than photographed. A small number of stars twinkle on their own timers. The letter is warm cream paper with real fibre grain and a soft, imperfect edge.

**The lantern is our own simple shape.** A rounded paper lantern drawn in SVG, lit from inside in amber. It isn't any festival's lantern and carries no religious or cultural marks. Each lantern varies by colour, pattern and the motif glyph from its recipe.

**Type.** The letter body is a soft serif with "ink". The margin is a legible, informal hand. UI text is a quiet rounded sans.

**Motion is slow and physical.** Embers drift up, words loosen and float, lanterns sway and rise. Everything moves with `transform` and `opacity`, and heavy effects (grain, burn) are pre-baked or run on a single canvas.

**Mood.** The closest matches are *Kind Words* (anonymous kindness, cozy at night), *Florence* (emotion carried through tiny interactions) and *Alto's Odyssey* (gradient skies, calm).

---

## 1. Night skies and stars

| Link | What to take |
|---|---|
| https://unsplash.com/s/photos/starry-sky | Real night-sky photography for sampling palette stops (ink → indigo → violet haze near the horizon). Free licence. |
| https://unsplash.com/s/photos/desert-night-sky | Horizon glow and warm-to-cold gradients. A good model for the sky's lower edge where lanterns hover during moderation. |
| https://coolors.co/palette/caa8f5-9984d4-592e83-230c33 | "Magical Night Sky": a midnight-purple base with lavender highlights. Use it as a starting point, then shift it bluer to fit our indigo base. |
| https://www.media.io/color-palette/starry-sky-color-palette.html | 20 starry-sky palettes with hex values: an inky base, luminous mid-tones and small starlight accents. |
| https://coolors.co/palettes/popular/sky | A broader browse of sky palettes. |
| https://altosodyssey.com/press/ | Alto's Odyssey press kit (Snowman): the best reference for **flat gradient skies with layered silhouettes**. |
| https://discussions.unity.com/t/2d-day-night-cycle-and-weather-system-a-la-altos-adventure/611522 | How Alto-style skies work: a gradient driven by a curve. Idea: the sky's hue drifts very slightly with the user's local time. |
| https://codepen.io/brandonhaslegs/pen/rQJaaN | A classic CSS-only "stars + twinkling layer" night sky. Take the layering idea. If it animates `background-position`, port it to `transform` on a layer. |
| https://codepen.io/ck/pen/BECfa | A minimal three-star twinkle: how little is needed for "alive". |
| https://codepen.io/tag/night%20sky | Pen tag for browsing more night skies (moons, galaxy stars). |
| https://gsap.com/community/forums/topic/17181-twinkling-stars/ | Generating stars dynamically in JS with random timing. |

**Performance notes for the star field.** Draw the static stars **once**, to a canvas or a single SVG. Only a small subset (~20–40) should be live elements, and they animate only `opacity` (plus a slight `scale`) with random `animation-duration` and `animation-delay`. Never animate `box-shadow` glows: put the glow on a pseudo-element and fade its opacity (Tobias Ahlin's technique, §6).

## 2. Paper

**Free textures:**

| Link | What to take |
|---|---|
| https://www.publicdomainpictures.net/en/view-image.php?image=510930&picture=public-domain-image | "Texture paper background", **CC0** (stated on the page). A clean base fibre texture. |
| https://www.photos-public-domain.com/category/textures-other/paper-cardboard/ | A category of public-domain paper textures. |
| https://unsplash.com/s/photos/paper-texture | Unsplash licence (free, no attribution). Good for cream, laid and deckled papers. |
| https://www.rawpixel.com/search/paper%20texture | Many are marked "public domain CC0", but **filter by licence**, since some are premium. |

**Techniques:**

| Link | What to take |
|---|---|
| https://css-tricks.com/grainy-gradients/ | **SVG `feTurbulence` noise over CSS gradients.** The core grain technique, for both the paper and the sky. |
| https://tympanus.net/codrops/2019/02/19/svg-filter-effects-creating-texture-with-feturbulence/ | Codrops deep dive. Its `roughpaper` filter uses `feTurbulence` with `feDiffuseLighting` for real paper relief. |
| https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feTurbulence | Reference for `baseFrequency`, `numOctaves`, `stitchTiles`. |
| https://www.freecodecamp.org/news/grainy-css-backgrounds-using-svg-filters/ | Inlining the grain SVG straight into CSS. |
| https://we.inc/tools/noise-texture-generator | A grain generator to tune frequency, octaves and opacity visually, then export. |
| https://perfectvector.com/blog/svg-feturbulence-grain | Grain clipped inside a shape (`feComposite in2="SourceAlpha"`). Useful for grain *on the lantern* only. |
| https://stackoverflow.com/questions/29349151/is-it-possible-to-make-a-torn-paper-effect-on-edges-of-a-picture | A torn or deckled edge with an SVG mask (linked CodePen). Turn it down to a soft deckle, not a rip. |
| https://www.vecteezy.com/free-svg/torn-paper-edge | Ready-made torn-edge SVGs for masks. Check the licence for each file. |

**Performance notes for paper.** `feTurbulence` is expensive when it re-renders.
- **Pre-bake** the grain into a small tiling image (~256 px webp) and use it as a `background-image`.
- Never apply a live SVG filter to the letter while it is scrolling or animating.
- Do the resting tilt (~0.5°) with `transform: rotate()`.
- Fake the paper's shadow with a blurred pseudo-element whose `opacity` you animate.

## 3. Lanterns

**Photography (for light, glow and density):**

| Link | What to take |
|---|---|
| https://unsplash.com/photos/many-sky-lanterns-floating-in-the-dark-night-IKUkv1T6iGQ | "Many sky lanterns floating in the dark night" (sayan Nath). The best single reference for **how a crowded sky reads**: size falloff with distance, warm cores, almost no visible structure. |
| https://unsplash.com/s/photos/yi-peng | Yi Peng sky lanterns at Wat Phra That Doi Suthep, Chiang Mai. |
| https://unsplash.com/s/photos/lantern-festival | A broader set of lantern-festival photos. |
| https://iso.500px.com/21-incredibly-beautiful-photos-of-the-yi-peng-lantern-festival/ | 21 curated Yi Peng photos. Study the rising motion and the glow halos. View only; not freely licensed. |

**Illustration styles (to draw our own in SVG):**

| Link | What to take |
|---|---|
| https://www.vecteezy.com/free-vector/night-sky-lantern | Hundreds of flat sky-lantern vectors. Study the simple shapes (rounded trapezoid, inner flame, soft halo). Don't copy them. |
| https://www.magnific.com/vectors/sky-lantern | More flat and hand-drawn lantern vectors. |
| https://www.dreamstime.com/illustration/floating-sky-lanterns.html | Floating-lantern compositions. Useful for how the sky looks with 10 vs 1,000 lanterns. |
| https://stock.adobe.com/search?k=akash+kandil | Akash kandil (Diwali hanging lanterns) in paper-art style: star shapes, cut-outs, tassels. For pattern vocabulary. |
| https://codepen.io/tag/lantern | Pen tag: lantern glow, revolving lanterns, sky lanterns. |

**Respectful use.** Sky lanterns belong to living traditions:
- **Yi Peng** (Lanna, northern Thailand) is a Theravada Buddhist merit-making festival. Releasing a *khom loi* is believed to release misfortune: https://en.wikipedia.org/wiki/Yi_Peng_festival
- It is celebrated alongside **Loy Krathong**.
- The **Chinese Lantern Festival** (Yuanxiao): https://en.wikipedia.org/wiki/Lantern_Festival
- In Maharashtra, Diwali's **akash kandil** is a hanging lamp. One popular belief holds that it lights the way for ancestors (a podcast source, so treat it as folklore, not fact).

Guidelines that follow:
1. Draw an **original, generic paper lantern**. No religious symbols (Buddha, deities, Om, temple shapes), no script characters, and no "festival" naming.
2. Don't present Lantern *as* any of these festivals, and don't borrow sacred patterns as decoration.
3. If we cite the inspiration (in the write-up, not the UI), describe it accurately: "the shared human gesture of sending a light upward for what we can't say".
4. Also avoid the iconic look of Disney's *Tangled* lantern scene (no recreation).

**A framing gift.** Real sky lanterns cause fires and leave litter, and many places have banned them (RSPCA: https://www.rspca.org.uk/adviceandwelfare/litter/skylanterns ; the International Fire Code bans untethered release: https://www.northcountyfireems.com/divisions/community-risk-reduction-fire-marshal-fire-prevention/sky-lantern-safety ; list of bans: https://waste4change.com/blog/rethinking-the-celebration-the-not-so-beautiful-aftermath-of-sky-lanterns-and-balloons/). Lantern's lanterns are "the ritual without the fire". That's one line for the write-up, not a lecture in the UI.

## 4. Type

Licences and variable-font axes were checked against the Fontsource API (`api.fontsource.org/v1/fonts/<id>` and `/v1/variable/<id>`). **All are OFL-1.1.**

| Font | Role | Variable? | Axes / weights | Specimen |
|---|---|---|---|---|
| **Caveat** | margin hand | yes | wght 400–700 | https://fonts.google.com/specimen/Caveat |
| **Shantell Sans** | margin hand (more legible) | yes | wght 300–800, ital, **INFM** (informality 0–100), BNCE (bounce), SPAC | https://fonts.google.com/specimen/Shantell+Sans · story: https://m3.material.io/blog/shantell-martin-variable-font |
| Patrick Hand | margin hand (very plain) | no | 400 | https://fonts.google.com/specimen/Patrick+Hand |
| Kalam | margin hand (Devanagari support) | no | 300/400/700 | (Fontsource id `kalam`) |
| **Fraunces** | letter body | yes | wght 100–900, opsz 9–144, **SOFT 0–100** ("inkiness"), WONK 0–1, ital | https://fonts.google.com/specimen/Fraunces · https://design.google/library/a-new-take-on-old-style-typeface |
| **Literata** | letter body | yes | wght 200–900, opsz 7–72, ital | https://fonts.google.com/specimen/Literata |
| Newsreader | letter body | yes | wght 200–800, opsz 6–72, ital | (Fontsource id `newsreader`) |
| Lora | letter body | yes | wght 400–700, ital | (Fontsource id `lora`) |
| **Nunito** | UI (rounded) | yes | wght 200–1000, ital | https://fonts.google.com/specimen/Nunito |
| Nunito Sans | UI | yes | wght, opsz, wdth, YTLC | https://fonts.google.com/specimen/Nunito+Sans |
| Figtree | UI | yes | wght 300–900, ital | (Fontsource id `figtree`) |
| Quicksand | UI (very rounded) | yes | wght 300–700 | (Fontsource id `quicksand`) |

**Three candidate pairings (body / margin / UI):**
1. **Fraunces (SOFT 100, WONK 0, opsz auto) / Shantell Sans (INFM ~60) / Nunito.** The warmest and most distinctive. Soft, inky serifs plus a hand that stays legible at 16–18 px. *My pick.*
2. **Literata / Caveat / Nunito Sans.** The safest for reading long letters (Literata was the Google Play Books face). Caveat needs ≥ 20 px to stay legible.
3. **Newsreader / Patrick Hand / Figtree.** Quieter and more editorial. Patrick Hand is the plainest "handwriting", which is the most legible, but the least charming.

**Loading notes.**
- Self-host (Fontsource npm packages), subset to Latin, preload only the body and UI faces, and use `font-display: optional` or a metric-matched fallback (`size-adjust`) so nothing reflows.
- Load the margin face after first paint, since the reflection never appears in the first second.
- **Don't animate font-variation axes** (for example, INFM while "writing"). They re-shape the text every frame.

## 5. Warm illustration and mood (tone only, never recreated)

| Link | What to take |
|---|---|
| https://en.wikipedia.org/wiki/Kind_Words_(video_game) · https://www.gamesindustry.biz/kind-words-a-game-of-lofi-beats-letters-to-strangers-and-feeling-less-alone | **Closest in spirit:** anonymous letters to strangers, cozy at night, no social metrics. Take the *safety* of anonymous kindness. Lantern's twist: the letter itself never leaves the device. |
| https://en.wikipedia.org/wiki/Florence_(video_game) · http://mountains.studio/ | Emotion through **tiny interactions** (Mountains, Annapurna). Model for our ritual micro-interactions. |
| https://thunderlotusgames.com/press-releases/thunder-lotus-announces-spiritfarer/ | "A cozy management game about dying." Proof that grief can be held with warmth and hand-drawn softness. |
| https://en.wikipedia.org/wiki/Gris | Watercolour grief journey (Nomada Studio). Colour as emotional state. An idea: a lantern's palette follows its `feeling`. |
| https://altosodyssey.com/press/ | Gradient skies and calm pacing ("zen mode"). |
| https://en.wikipedia.org/wiki/Monument_Valley_(video_game) | Restraint: minimal shapes, Japanese-print influence, one clear focal point per screen. |
| https://thatgamecompany.helpshift.com/hc/en/17-sky-children-of-the-light/faq/764-how-do-i-obtain-candles-and-hearts-how-do-i-send-a-heart-or-gift-of-light-to-my-friend/ | *Sky: Children of the Light*: candles and "gifts of light" between strangers. Light as the only social currency. |
| https://dribbble.com/tags/dark-ui · https://dribbble.com/search/journal-app · https://dribbble.com/search/sleep-journal · https://dribbble.com/search/write-diary | Browse for cozy dark journal UIs (search pages; pick shots by hand). Watch for the SaaS look we want to avoid. |

**Avoid overlap:** *The Unsent Project* (Rora Blue) is an archive of 36,000+ anonymous unsent texts to first loves (https://www.rorablue.com/abouttheunsentproject). Lantern differs: the letter itself is never published, only an anonymous line distilled on-device. Don't use "unsent" in the product name, and don't build a browsable archive of messages.

## 6. Ritual motion

| Link | What to take |
|---|---|
| https://web.dev/articles/animations-guide · https://web.dev/articles/stick-to-compositor-only-properties-and-manage-layer-count | The canonical rules: `transform`/`opacity` only, promote layers deliberately, avoid layer explosions. |
| https://tobiasahlin.com/blog/how-to-animate-box-shadow/ | **Glow without jank:** put the shadow on a pseudo-element and animate its opacity. Use for the lantern glow, the flame flicker and button squish. |
| https://www.joshwcomeau.com/react/prefers-reduced-motion/ · https://www.tatianamac.com/posts/prefers-reduced-motion | Reduced motion in JS-driven animations (springs, canvas) via `matchMedia`, and a **no-motion-first** approach. |
| https://css-tricks.com/nailing-that-cool-dissolve-transition/ | **Burning:** a noise "dissolve map" thresholded over time, for a paper burn edge. Best done on one canvas/WebGL quad, not with CSS filters. |
| https://medium.com/@leimapapa/lets-make-fire-from-an-svg-bca1c47f0f27 | Fire from SVG turbulence plus a moving shape: the flame inside the lantern. Pre-render frames or keep the area tiny. |
| https://codepen.io/CheneyLin/embed/ZmaxNG/?theme-id=modal | Canvas fire embers: the particle behaviour for ember drift after burning. |
| https://codepen.io/orange_code/pen/qBXLPPz | A flame with embers. |
| https://speckyboy.com/flame-effects-code-snippets/ | A roundup of CSS/JS/SVG flame snippets to compare. |
| https://gsap.com/community/forums/topic/14541-particle-dissolving-from-text/ | **Condensing:** text dissolving into particles. |
| https://codepen.io/syohei-yamaki/pen/MWjqaEw | Particle text in vanilla JS. Start from this for "a few words glow and drift together". |
| https://codepen.io/thewizardjs/embed/NWWgzPm?default-tab=result&editable=true&theme-id=dark | "Sky Lanterns" pen with no libraries: a rising-lantern baseline. |
| https://www.freecodecamp.org/news/how-to-create-beautiful-lanterns-that-arrange-themselves-into-words-da01ae98238/ | Lanterns that arrange themselves into words. Inspiration for a moment where the essence briefly forms in lanterns. |

**Motion notes.**
- **Burn and condense:** run them on **one full-screen canvas** during the ritual (a single compositor layer), then remove it. The DOM text fades by opacity underneath.
- **Rise:** a `transform: translate3d` path with a slow sine sway, plus a separate opacity layer for the glow.
- **Reduced motion:** cross-fade every ritual (the paper fades to warm, the lantern fades in place in the sky).

## 7. Research: expressive writing and unsent letters (for "potential impact")

| Source | Use in the write-up |
|---|---|
| Pennebaker, J. W. (1997). *Writing about emotional experiences as a therapeutic process.* Psychological Science 8(3), 162–166. doi:10.1111/j.1467-9280.1997.tb00403.x. https://journals.sagepub.com/doi/10.1111/j.1467-9280.1997.tb00403.x · https://psycnet.apa.org/record/1997-06306-006 | The foundational paper (~5,000 citations): putting emotional upheavals into words improves health. |
| Baikie, K. A. & Wilhelm, K. (2005). *Emotional and physical health benefits of expressive writing.* https://sparq.stanford.edu/sites/g/files/sbiybj19021/files/media/file/baikie_wilhelm_2005_-_emotional_and_physical_health_benefits_of_expressive_writing.pdf | A readable review with effect sizes (for example, a meta-analysis with overall d = 0.47). Also explains *why* it works: making a coherent narrative. |
| Pennebaker, J. W. & Chung, C. K. *Expressive writing: connections to physical and mental health.* https://c3po.media.mit.edu/wp-content/uploads/sites/45/2016/01/PennebakerChung_FriedmanChapter.pdf | A balanced summary that includes the modest effects in healthy samples. Cite it to show we aren't overclaiming. |
| Larsen, L. H. *Letter writing as a clinical tool in grief psychotherapy.* OMEGA. doi:10.1177/00302228211070155. https://pubmed.ncbi.nlm.nih.gov/35156445/ | **Directly on point:** current protocols for prolonged grief include letter-writing assignments. |
| Wojtkowiak, J., Lind, J. & Smid, G. E. (2021). *Ritual in therapy for prolonged grief: a scoping review.* Frontiers in Psychiatry. doi:10.3389/fpsyt.2020.623835. PMC7887294 | 22 studies. Writing assignments, dialogue with the deceased and **farewell rituals** appear across evidence-informed grief treatments. Supports burn and release as ritual, not decoration. |
| Lichtenthal, W. G. & Cruess, D. G. (2010). *Effects of directed written disclosure on grief and distress symptoms among bereaved individuals.* Death Studies. doi:10.1080/07481187.2010.483332. PMC3909885 | **An honest caveat that strengthens the design:** undirected bereavement writing has generally shown *null* effects, while **directed** writing (sense-making, benefit-finding) helped. This justifies a gentle, non-advice reflection that invites meaning without giving advice. |
| Mackrill, T. (2025). *Writing letters to my dead parent in group therapy for parental bereavement: young adult experiences.* Death Studies. doi:10.1080/07481187.2025.2583157 | Recent qualitative support from young adults (a likely user group). |
| https://www.apa.org/news/podcasts/speaking-of-psychology/expressive-writing · https://www.bps.org.uk/psychologist/how-unsent-letters-helped-me-find-words | Accessible quotes from the APA (Pennebaker) and the BPS on unsent letters. Good for the video script. |

**Framing reminder:** Lantern is a *reflection space, not therapy* (`DESIGN.md` §7). Cite the research to explain why the ritual makes sense, never to make clinical claims.
