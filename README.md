# Dear Sky

Write a letter you'll never send. A private AI on your own device reflects on it gently. If you choose, a few anonymous words from it become a lantern rising into a shared night sky, beside strangers' lanterns that carry the same feeling.

Built for [#BuildHybridAI 2026](https://firebasehybridaihackathon.devpost.com/) with **Firebase AI Logic hybrid inference**.

> Work in progress. The contest runs Nov 11–30, 2026.

## How it uses hybrid inference

| Where | Model mode | What runs there |
|---|---|---|
| On your device (Gemini Nano in Chrome) | `ONLY_ON_DEVICE` | Everything that touches the letter: a safety check, the reflection, and condensing it into a feeling, a short line and an image |
| Your code, on your device | none (deterministic) | A leak check that blocks names, numbers, emails, links and handles before anything can leave |
| You | none | You see and approve the exact words that leave. Nothing else ever does |
| Either | `PREFER_ON_DEVICE` | Designing the lantern from the approved words (already allowed to leave) |
| Cloud (Gemini) | `ONLY_IN_CLOUD` | Moderating the words before they reach the shared sky, and finding kindred lanterns |

**The letter itself never leaves the device, for anyone**, including browsers without an on-device model. The boundary is enforced by which model instance the code calls, not by a promise.

## Run it locally

Requires [Bun](https://bun.sh). The on-device model needs desktop Google Chrome 148 or later, where the Prompt API is stable for web pages. Other browsers get the write-your-own-words path.

```sh
bun install
bun run dev
```

## Docs

- `PREP.md`: plan, measured findings and decisions (D1–D20)
- `DESIGN.md`: the UI standard
- `research/`: stack choice, prompt tests, visual references
- `design/`: visual directions and reference screens

## Built before the contest (disclosure)

Before Nov 11, 2026 we wrote planning documents only: `PREP.md`, `DESIGN.md` and a benchmark of Gemini Nano's speed and redaction quality (no project code), and a personal Claude Code skill with Firebase AI Logic notes, used as a development aid and not included here. All application code in this repository was written during the contest period.

## Licence

[Apache-2.0](LICENSE)
