# Lantern: stack recommendation

> Researched 2026-11-12 with Context7 and the web. Versions are from the npm registry on the same day.

## Recommendation

**Svelte 5 + Vite 8 + TypeScript (no SvelteKit), plain CSS custom-property tokens (no Tailwind), Canvas 2D for the sky, `idb` for storage, `vite-plugin-pwa` for offline, and Firebase JS SDK 13. Use Bun as the package manager, script runner and test runner.**

Why this stack:
1. **Motion is built in, and it's the right kind.**
   - Svelte's `transition:`/`in:`/`out:`/`animate:flip` produce **Web Animations API keyframes**, and when a transition returns `css` (not `tick`) "web animations can run off the main thread, preventing jank on slower devices" [S1].
   - `Spring`, `Tween` and `prefersReducedMotion` all ship in `svelte/motion` (since 5.7/5.8) [S2].
   - That covers DESIGN.md §3 without an animation library.
2. **The smallest runtime:** a ~2–3 KB baseline for Svelte 5, vs ~7 KB for Solid and ~45 KB for React + ReactDOM [S3][S4]. That gives us more budget for fonts, paper texture and the sky.
3. **The Firebase SDK is framework-agnostic.** `firebase/ai` is plain TS (`getGenerativeModel(ai, HybridParams)`, `InferenceMode.ONLY_ON_DEVICE | ONLY_IN_CLOUD`, `initializeDeviceModel()`) [S5].
   - The Nano engine lives in a plain `.ts` module.
   - Its readiness state is exposed through a `.svelte.ts` class with `$state` fields [S6], so the UI reacts with no store boilerplate and the engine stays testable with `bun test`.
4. **The official template works with Bun.** `bun create vite` ships a `svelte-ts` template already pinned to `svelte ^5.57.3`, `@sveltejs/vite-plugin-svelte ^7.3.1` and `vite ^8.3.6` (verified in the `create-vite@9.3.4` tarball). Bun documents this flow [S7].
5. **There's a first-party PWA path.** `vite-plugin-pwa` documents a plain-Svelte integration (`virtual:pwa-register/svelte`) [S8], and its peer range covers Vite 8.

## Comparison

Scores run from 1 (bad) to 5 (good) for **this** project.

| | Svelte 5 + Vite | SolidJS + Vite | React 19 + Motion | Vite + TS + web components |
|---|---|---|---|---|
| Built-in transitions / springs / FLIP | **5** (built in; WAAPI keyframes) [S1][S2] | 2 (needs `solid-transition-group` 0.3.0 + a library) | 4 (Motion is excellent, but it's another dependency) | 2 (write it all by hand) |
| Reduced-motion support | 4 (`prefersReducedMotion`, but see gotcha G1) | 3 (`@solid-primitives/media`) | 4 (`useReducedMotion`) | 3 (`matchMedia`) |
| Runtime + animation cost (gz) | ~2–3 KB + 0 [S3] | ~7 KB + library [S3] | ~45 KB + Motion 5–43 KB [S4][S9] | 0 + whatever we write |
| Firebase SDK fit | 5 (plain TS) | 5 | 5 | 5 |
| Bun + Vite 8 | 5 (official template) | 4 | 4 (`@vitejs/plugin-react` 6.3.0 pins narrow `oxc-transform-react` peers) | 5 |
| Solo dev, 2.5 weeks | 5 | 3 (**Solid 2.0 is at RC.21**; 1.x docs and ecosystem are in flux) | 4 | 2 (we'd rebuild reactivity) |
| **Total** | **29** | 20 | 26 | 19 |

React would be the safe runner-up: Motion for React is the best animation tool here, but it costs ~45 KB of runtime plus 5–43 KB for Motion [S9]. If we ever need a JS-driven spring sequence that Svelte can't express, use Motion's **vanilla** `animate()` inside Svelte (mini 3.2 KB WAAPI build, hybrid 22 KB) [S10]. There's no need to switch frameworks.

## Decisions on the sub-questions

### Animation library: none by default; vanilla Motion as an escape hatch
- Svelte transitions + `Spring`/`Tween` + CSS `@keyframes` (flame flicker, star twinkle) cover every ritual moment.
- Add `motion@14.12.0` (MIT) only for one complex sequence that needs it (for example the burn: curl, embers, fade). Import the mini `animate` to stay at ~3 KB [S10].
- **Avoid GSAP.** It's free, but under Webflow's "Standard No Charge" licence, not an OSI licence [S11]. An open-source repository is a submission requirement, and an MIT dependency tree keeps that clean. It's also ~27 KB gz.

### Night sky: layered Canvas 2D, plus a DOM overlay for the lantern you're interacting with
- **Evidence:**
  - 1,000 animated elements run at 60 fps in both SVG and Canvas, but SVG drops to 35 fps at 5,000 and 12 fps at 10,000, while Canvas holds 60 fps at 10,000 (2024 MacBook Pro) [S12].
  - Weaker judge laptops and phones will hit those cliffs sooner.
- **Canvas technique, per MDN** [S13]:
  - Pre-render each lantern variant once to an offscreen canvas, then `drawImage` it every frame.
  - Use layered canvases (a star layer at a low update rate, a lantern layer at 60 fps).
  - Put the sky gradient in CSS, avoid `shadowBlur` (bake the glow into the sprite), use integer coordinates, and drive it with `requestAnimationFrame`.
- **The DOM/SVG layer** holds *your* lantern while it's lit and rises (animated with `transform`/`opacity` on the compositor), then hands it off to the canvas. The tapped lantern's essence card is also DOM.
- **Accessibility:** a visually hidden list of `<button>`s (one per *visible* lantern) mirrors the canvas for keyboard and screen readers.
- **Cap the visible count** at ~300 with density by recency, and pause the loop when `document.hidden`.

### IndexedDB: `idb`
| | min / gz | Notes |
|---|---|---|
| `idb-keyval` 6.3.0 | 2.1 / 0.8 KB | Key–value only. No indexes, so listing letters by date means a manual scan |
| **`idb` 8.0.4** | 3.7 / **1.5 KB** | Typed promise wrapper. Object stores + indexes (`letters` by `updatedAt`; `pendingLanterns` for the offline "waiting for the wind" queue) |
| `dexie` 4.4.7 | 98 / 31 KB | Powerful, but 20× the size for 2–3 stores |

Sizes are from the Bundlephobia API, 2026-11-12.

### Tailwind: leave it out
- Tailwind v4 is CSS-first: `@theme` tokens become CSS variables, and `--*: initial` can wipe the default palette [S14].
- But arbitrary values like `bg-[#bada55]` are first-class [S15], which is exactly what DESIGN.md §2 forbids ("no raw hex in components").
- Svelte already scopes component `<style>` blocks, so `src/styles/tokens.css` (custom properties) plus scoped CSS gives us tokens without a build plugin.
- **One caveat:** Stitch exports Tailwind HTML. Treat those exports as visual references and translate them into tokens. Don't paste them in.

### Offline: `vite-plugin-pwa` with `generateSW`
- Use `generateSW`, `registerType: 'autoUpdate'`, and `globPatterns` that include fonts and the paper texture [S8].
- The app shell, fonts and the writing screen work offline. Letters are already local in IndexedDB.
- **Self-host the fonts** (Fontsource, OFL) so they precache and there's no fallback-font flash.

## Packages (npm `latest`, 2026-11-12)

| Package | Version | Licence |
|---|---|---|
| `svelte` | 5.57.3 | MIT |
| `@sveltejs/vite-plugin-svelte` | 7.3.1 (peer `vite ^8`, `svelte ^5.46.4`) | MIT |
| `vite` | 8.3.8 (Rolldown-based) | MIT |
| `typescript` | template pins `~6.0.3` (latest is 7.0.2) | Apache-2.0 |
| `svelte-check` | 4.7.8 | MIT |
| `firebase` | 13.3.0 (released 2026-11-11) | Apache-2.0 |
| `idb` | 8.0.4 | ISC |
| `vite-plugin-pwa` (+ `workbox-window`) | 2.0.0 (+ 7.4.1) | MIT |
| `motion` (only if needed) | 14.12.0 | MIT |
| `@fontsource-variable/*` | e.g. `fraunces` 5.3.0 | OFL-1.1 |
| `@happy-dom/global-registrator` (only for DOM tests) | 21.0.4 | MIT |

On this machine: Bun 1.4.4 (PREP.md still says 1.3.12) and Node 26.13.0 (via nvm4w).

## Setup (Bun)

```sh
bun create vite lantern --template svelte-ts     # official template, Svelte 5 + Vite 8
cd lantern
bun install
bun add firebase idb
bun add -d vite-plugin-pwa workbox-window
bun add @fontsource-variable/<letter-face> @fontsource/<hand-face> @fontsource-variable/<ui-sans>
bun run dev          # runs the "vite" script
bun test             # leak-check + queue/state-machine unit tests (pure TS; no DOM needed)
bun run build && bunx firebase deploy --only hosting
```

- **Dev script:** keep `"dev": "vite"`. `bun run dev` runs Vite on the installed Node 26, which is Vite's supported runtime (engines `^20.19 || >=22.12`). `bunx --bun vite` runs it on Bun's runtime instead [S7]. Older Windows reports show `bunx --bun vite build` misbehaving [S16], so only switch if it works here. The rule is "Bun for package management and scripts", and both options satisfy it.
- **Hosting:** in `firebase.json`, set `"public": "dist"` with an SPA rewrite to `/index.html`.

## Gotchas found

- **G1. Svelte transitions ignore a global reduced-motion CSS rule.** They're WAAPI, not CSS, so `@media (prefers-reduced-motion) { * { animation-duration: 0 } }` does nothing to them. Every transition must read `prefersReducedMotion.current` [S1][S2]. Do it in one `motion.ts` helper that every ritual uses.
- **G2. Firebase JS 13.0.0 (2026-10-07) had breaking changes that affect us** [S17]:
  - `LanguageModelCreateCoreOptions.topK` and `.temperature` are **removed** (on-device sampling options).
  - `temperature`/`topP`/`topK` are deprecated in `GenerationConfig` (unsupported on Gemini 3.x+).
  - `Part` is now a discriminated union.
  - The default hybrid cloud model is `gemini-3.5-flash-lite`.
  - The Nano engine and the prompt drafts must not rely on temperature/topK.
- **G3. Pin versions with `bun.lock`.** `vite@8.3.8` and `firebase@13.3.0` are each about a day old, so commit the lockfile and upgrade on purpose.
- **G4. SolidJS is between majors** (`latest` 1.9.19, `next` 2.0.0-rc.21). That was another reason to pass on it for a 2.5-week build.
- **G5. GSAP's licence isn't OSI** [S11]. Keep the dependency tree MIT/Apache/ISC/OFL.

## Sources

- **S1** Svelte docs, transition (custom transitions, accessibility). Context7 `/sveltejs/svelte/svelte_5.57.3`, `documentation/docs/03-template-syntax/14-transition.md`
- **S2** Svelte docs, `svelte/motion` (`Spring`, `Tween`, `prefersReducedMotion`). Context7 `/llmstxt/svelte_dev_llms_txt`; https://svelte.dev/docs/svelte/svelte-motion
- **S3** arc.dev, "Svelte vs Vue vs SolidJS: Bundle Size & DX (2026)": https://arc.dev/employer-blog/svelte-vs-vue-vs-solidjs/
- **S4** ztabs, "Svelte vs React (2026)" (Bundlephobia figures): https://ztabs.co/compare/svelte-vs-react
- **S5** Firebase JS SDK API reference (`InferenceMode`, `HybridParams`, `initializeDeviceModel`). Context7 `/firebase/firebase-js-sdk`, `docs-devsite/ai.md`, `ai.generativemodel.md`, `ai.hybridparams.md`
- **S6** Svelte docs, `$state` in class fields. Context7 `/sveltejs/svelte/svelte_5.57.3`, `02-runes/02-$state.md`
- **S7** Bun guide, Vite. Context7 `/oven-sh/bun`, `docs/guides/ecosystem/vite.mdx`
- **S8** Vite PWA docs, Svelte framework guide and precache. Context7 `/vite-pwa/docs`, `frameworks/svelte.md`, `guide/service-worker-precache.md`
- **S9** Motion, "Reduce bundle size" (motion component 43 KB; `m` + LazyMotion ~5 KB): https://motion.dev/docs/react-reduce-bundle-size
- **S10** Motion, `animate()` (mini 3.2 KB, hybrid 22 KB): https://motion.dev/docs/animate
- **S11** GSAP Standard "No Charge" License: https://gsap.com/community/standard-license/
- **S12** SVG Genie, "SVG vs Canvas vs WebGL (2026)": https://www.svggenie.com/blog/svg-vs-canvas-vs-webgl-performance-2025
- **S13** MDN, "Optimizing canvas": https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas
- **S14** Tailwind, Theme variables: https://tailwindcss.com/docs/theme
- **S15** Tailwind, Adding custom styles (arbitrary values): https://tailwindcss.com/docs/adding-custom-styles
- **S16** oven-sh/bun#9486, `bunx --bun vite build` on Windows: https://github.com/oven-sh/bun/issues/9486
- **S17** Firebase JS SDK release notes (13.0.0–13.2.0): https://firebase.google.com/support/release-notes/js
