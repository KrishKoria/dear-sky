/**
 * The default on-device engine: every call goes through Firebase AI Logic with
 * `InferenceMode.ONLY_ON_DEVICE` (PREP.md D3, D21). The one exception is `paint`, which only
 * ever sees approved words and uses `PREFER_ON_DEVICE` (D13).
 *
 * Firebase AI Logic creates a fresh Chrome session per call, so each prompt carries
 * the letter. Measure this path before reaching for a session-based one.
 */
import {
  AIError,
  AIErrorCode,
  getGenerativeModel,
  InferenceMode,
  InferenceSource,
  Schema,
  type AI,
  type GenerativeModel,
  type LanguageModelMessage,
} from 'firebase/ai';
import {
  ESSENCE_INITIAL,
  ESSENCE_SCHEMA,
  FEELINGS,
  GLYPH_INITIAL,
  REFLECT_INITIAL,
  SAFETY_SCHEMA,
  SYSTEM_ONLY,
  essencePrompt,
  essenceRetryPrompt,
  reflectPrompt,
  safetyPrompt,
} from './prompts';
import { leakCheck } from '../privacy/leakcheck';
import type { ApprovedWords } from '../privacy/release';
import { CLOUD_MODEL, wordsJson, type LanternWords } from '../sky/lantern';
import { GLYPHS, GLYPH_SCHEMA, GLYPH_SYSTEM, matchGlyph, readGlyph, type Glyph } from '../sky/recipe';
import { Priority, SerialQueue } from './queue';
import { IDLE_UNLOAD_MS, initialReadiness, reduce, type Availability, type Readiness, type ReadinessEvent } from './readiness';
import { riskHit } from './riskcheck';
import { LetterPipeline, type Stage } from './pipeline';
import { writable } from './store';
import type { Essence, OnDeviceEngine, Painted, SafetyResult } from './types';

const ENGLISH = [{ type: 'text' as const, languages: ['en'] }];
const CREATE_BASE = { expectedInputs: ENGLISH, expectedOutputs: ENGLISH };

/** When a waiting writer is offered "keep waiting / write it yourself" (DESIGN.md §4b). */
const STALL_AFTER_MS = { user: 45_000, background: 90_000 } as const;
const WARM_UP_LABEL = 'warm-up';
const PAINT_LABEL = 'paint';
/**
 * The glyph is picked while the flame is lit (DESIGN.md §4.7), within the longest a ritual
 * moment may take (§3: 2–6 s); past this, the word match does. Usually it was painted ahead.
 */
const PAINT_TIMEOUT_MS = 6_000;

interface ChromeLanguageModel {
  availability(options: object): Promise<Availability>;
}

/** Thrown when a letter response did not come from the device. It should be impossible; we check anyway. */
export class BoundaryError extends Error {}

export class AILogicEngine implements OnDeviceEngine {
  private readonly state = writable<Readiness>(initialReadiness);
  readonly readiness = { subscribe: this.state.subscribe };

  private readonly queue: SerialQueue;
  private readonly safety: GenerativeModel;
  private readonly reflection: GenerativeModel;
  private readonly essence: GenerativeModel;
  /** Approved words only: on this device when Chrome has the model, in the cloud otherwise. */
  private readonly painter: GenerativeModel;
  /** The tag's words before they're approved: so this one never leaves the device. */
  private readonly sketcher: GenerativeModel;
  /** Glyphs painted ahead on this device, by the exact words they were painted from. */
  private readonly sketches = new Map<string, Promise<Glyph | null>>();
  private latestSketch = '';
  private idleTimer: ReturnType<typeof setTimeout> | undefined;
  private warmStarted = false;
  /** Works ahead while the writer pauses: safety, reflection, then essence (D24, D28). */
  private readonly pipeline = new LetterPipeline({
    safety: (letter, urgent) => this.runSafety(letter, priorityOf(urgent)),
    reflection: (letter, urgent, onDelta) => this.runReflection(letter, priorityOf(urgent), onDelta),
    essence: (letter, urgent) => this.runCondense(letter, priorityOf(urgent)),
  });
  readonly progress = this.pipeline.progress;
  private readonly idleMs: number;

  private readonly paintTimeoutMs: number;

  constructor(
    ai: AI,
    { idleMs = IDLE_UNLOAD_MS, paintTimeoutMs = PAINT_TIMEOUT_MS }: { idleMs?: number; paintTimeoutMs?: number } = {},
  ) {
    this.idleMs = idleMs;
    this.paintTimeoutMs = paintTimeoutMs;
    const onDevice = (initialPrompts: LanguageModelMessage[], responseConstraint?: object) =>
      getGenerativeModel(ai, {
        mode: InferenceMode.ONLY_ON_DEVICE,
        onDeviceParams: {
          createOptions: { ...CREATE_BASE, initialPrompts },
          ...(responseConstraint ? { promptOptions: { responseConstraint } } : {}),
        },
      });

    // Firebase AI Logic keeps one live session per model instance, and Chrome advises against
    // keeping many (Chrome's built-in AI guidance, PREP.md D23). The warm-up reuses one instance.
    this.safety = onDevice(SYSTEM_ONLY, SAFETY_SCHEMA);
    this.reflection = onDevice(REFLECT_INITIAL);
    this.essence = onDevice(ESSENCE_INITIAL, ESSENCE_SCHEMA);
    this.sketcher = onDevice(GLYPH_INITIAL, GLYPH_SCHEMA);
    this.painter = getGenerativeModel(ai, {
      mode: InferenceMode.PREFER_ON_DEVICE,
      onDeviceParams: {
        createOptions: { ...CREATE_BASE, initialPrompts: GLYPH_INITIAL },
        promptOptions: { responseConstraint: GLYPH_SCHEMA },
      },
      inCloudParams: {
        model: CLOUD_MODEL,
        systemInstruction: GLYPH_SYSTEM,
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
          responseSchema: Schema.object({ properties: { glyph: Schema.enumString({ enum: GLYPHS }) } }),
        },
      },
    });

    this.queue = new SerialQueue({
      onStall: (label) => {
        // A cold load is "warming", not a stall.
        if (label !== WARM_UP_LABEL) this.dispatch({ type: 'stalled' });
      },
      onSettle: (label, ms, ok) => {
        // A one-word glyph pick says nothing about how fast the margin note will write.
        if (label !== PAINT_LABEL) this.dispatch({ type: 'settled', ms, ok });
        this.restartIdleTimer();
      },
    });

    void this.checkAvailability();
  }

  /** Cheap to call on every gesture: it only does something when the model isn't loaded or loading. */
  warmUp(): void {
    if (this.warmStarted || this.state.get().state === 'unavailable') return;
    this.warmStarted = true;
    // Must run inside the user gesture: Chrome only downloads or creates with user activation.
    void this.reflection.initializeDeviceModel((loaded) => this.dispatch({ type: 'progress', loaded }));
    void this.queue
      .enqueue({
        label: WARM_UP_LABEL,
        priority: Priority.user,
        stallAfterMs: Number.POSITIVE_INFINITY,
        // Any prompt loads the model into memory; the reply is thrown away.
        run: () => this.reflection.generateContent('Reply with the single word: ok').then(assertOnDevice),
      })
      .catch((e) => this.handleFailure(e));
  }

  preload(letter: string, depth: Stage = 'essence'): void {
    // Firebase AI Logic has no session to pre-load into (D21), so pauses are used to do the
    // work itself ahead of time (D24, D28). Only on a warm model: while downloading or
    // warming, a background prompt would wait for minutes and report a false stall.
    const { state } = this.state.get();
    if (!letter.trim() || (state !== 'ready' && state !== 'slow')) return;
    this.pipeline.prepare(letter, depth);
  }

  checkSafety(letter: string): Promise<SafetyResult> {
    return this.pipeline.checkSafety(letter);
  }

  private async runSafety(letter: string, priority: Priority): Promise<SafetyResult> {
    const codeRisk = riskHit(letter);
    try {
      const raw = await this.prompt('safety', priority, () =>
        this.safety.generateContent(safetyPrompt(letter)).then(assertOnDevice),
      );
      const parsed = JSON.parse(raw) as { risk?: unknown };
      // `signal` quotes the letter: read nothing else from the reply, and never keep it.
      return { risk: codeRisk || parsed.risk === true, modelChecked: true };
    } catch {
      // prompt() already re-checked availability; the code check still decides.
      return { risk: codeRisk, modelChecked: false };
    }
  }

  async reflect(letter: string, onText: (delta: string, soFar: string) => void): Promise<string> {
    let soFar = '';
    const text = await this.pipeline.reflect(letter, (delta) => {
      soFar += delta;
      onText(delta, soFar);
    });
    return text.trim();
  }

  condense(letter: string): Promise<Essence> {
    return this.pipeline.condense(letter);
  }

  private runReflection(letter: string, priority: Priority, onDelta: (delta: string) => void): Promise<string> {
    return this.prompt('reflection', priority, async () => {
      const result = await this.reflection.generateContentStream(reflectPrompt(letter));
      let text = '';
      for await (const chunk of result.stream) {
        const delta = onDeviceText(chunk); // chunks are deltas; each is checked before it is shown
        text += delta;
        onDelta(delta);
      }
      return text;
    });
  }

  private async runCondense(letter: string, priority: Priority): Promise<Essence> {
    const first = await this.condenseOnce(letter, essencePrompt(letter), priority);
    const firstCheck = leakCheck(letter, first);
    if (firstCheck.ok) return first;
    // One retry with a stricter instruction (D25). Whatever comes back, the consent screen
    // runs the leak check again on the exact words, after any edits.
    try {
      const second = await this.condenseOnce(letter, essenceRetryPrompt(letter), priority);
      return leakCheck(letter, second).problems.length <= firstCheck.problems.length ? second : first;
    } catch {
      return first;
    }
  }

  private async condenseOnce(letter: string, prompt: string, priority: Priority): Promise<Essence> {
    const raw = await this.prompt('essence', priority, () =>
      this.essence.generateContent(prompt).then(assertOnDevice),
    );
    const parsed = JSON.parse(raw) as Partial<Essence>;
    if (
      !parsed.feeling || !FEELINGS.includes(parsed.feeling) ||
      typeof parsed.essence !== 'string' || typeof parsed.motif !== 'string'
    ) {
      throw new Error('essence reply did not match the schema');
    }
    return { feeling: parsed.feeling, essence: parsed.essence.trim(), motif: parsed.motif.trim() };
  }

  sketch(words: LanternWords): void {
    const { state } = this.state.get();
    if (state !== 'ready' && state !== 'slow') return;
    const key = wordsJson(words);
    this.latestSketch = key;
    if (this.sketches.has(key)) return;
    const sketched = this.queue
      .enqueue({
        label: PAINT_LABEL,
        priority: Priority.background,
        stallAfterMs: Number.POSITIVE_INFINITY,
        run: async () => {
          // The writer changed the words since: paint only the newest ones.
          if (this.latestSketch !== key) return null;
          return readGlyph(assertOnDevice(await this.sketcher.generateContent(key)));
        },
      })
      .catch(() => null)
      .then((glyph) => {
        if (!glyph) this.sketches.delete(key); // paint() will ask again
        return glyph;
      });
    this.sketches.set(key, sketched);
    // A few are plenty: the tag's words, and the last edits before them.
    if (this.sketches.size > 4) this.sketches.delete(this.sketches.keys().next().value!);
  }

  async paint(words: ApprovedWords): Promise<Painted> {
    const key = wordsJson(words);
    const fallback: Painted = { glyph: matchGlyph(words), by: 'words' };
    const deadline = performance.now() + this.paintTimeoutMs;

    // Painted ahead on this device while the writer read the tag (the usual case with a model).
    const ahead = this.sketches.get(key);
    if (ahead) {
      const glyph = await within(ahead, this.paintTimeoutMs);
      if (glyph) return { glyph, by: 'device' };
      if (glyph === undefined) return fallback; // still on the device at the deadline
    }

    let gaveUp = false;
    const ask = async (): Promise<Painted | null> => {
      // Timed out while it waited its turn: the lantern is already drawn, so don't prompt at all.
      if (gaveUp) return null;
      const timeout = Math.max(1, deadline - performance.now());
      const { response } = await this.painter.generateContent(key, { timeout });
      const glyph = readGlyph(response.text());
      return glyph && { glyph, by: response.inferenceSource === InferenceSource.ON_DEVICE ? 'device' : 'cloud' };
    };
    // PREFER_ON_DEVICE uses the device only when Chrome reports the model "available". Without one,
    // or while it downloads, this goes to the cloud and needn't queue behind on-device prompts.
    const { state } = this.state.get();
    const answer =
      state === 'unavailable' || state === 'downloading'
        ? ask()
        : this.queue.enqueue({ label: PAINT_LABEL, priority: Priority.user, stallAfterMs: Number.POSITIVE_INFINITY, run: ask });
    try {
      return (await within(answer, Math.max(0, deadline - performance.now()))) ?? fallback;
    } catch {
      return fallback;
    } finally {
      gaveUp = true;
    }
  }

  forget(): void {
    this.pipeline.clear();
  }

  /** Queues a prompt and retries once on an empty reply or Chrome's UnknownError (PREP.md D20). */
  private async prompt(label: string, priority: Priority, run: () => Promise<string>): Promise<string> {
    const stallAfterMs = priority === Priority.user ? STALL_AFTER_MS.user : STALL_AFTER_MS.background;
    const attempt = () => this.queue.enqueue({ label, priority, stallAfterMs, run });
    try {
      try {
        const text = await attempt();
        if (text.trim()) return text;
      } catch (e) {
        if (!isUnknownError(e)) throw e;
      }
      const text = await attempt();
      if (!text.trim()) throw new Error(`${label}: empty reply twice`);
      return text;
    } catch (e) {
      this.handleFailure(e);
      throw e;
    }
  }

  private async checkAvailability(): Promise<void> {
    const lm = (globalThis as { LanguageModel?: ChromeLanguageModel }).LanguageModel;
    if (!lm) return this.dispatch({ type: 'availability', value: 'unavailable' });
    let value: Availability;
    try {
      // Same options as create().
      value = await lm.availability(CREATE_BASE);
    } catch {
      value = 'unavailable';
    }
    // Chrome may have deleted the model (low disk space, even mid-session). It only comes back
    // when someone calls create() again, so the next gesture must be allowed to warm up again.
    if (value === 'downloadable') this.warmStarted = false;
    this.dispatch({ type: 'availability', value });
  }

  private handleFailure(e: unknown): void {
    if (e instanceof AIError && (e.code === AIErrorCode.API_NOT_ENABLED || e.code === AIErrorCode.UNSUPPORTED)) {
      this.dispatch({ type: 'availability', value: 'unavailable' });
      return;
    }
    // Any other failure: the model may have been deleted or updated under us. Ask Chrome again.
    void this.checkAvailability();
  }

  private restartIdleTimer(): void {
    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      // Chrome has unloaded the model by now (PREP.md §3b). Let the writer's next gesture load it
      // again, so the work-ahead resumes instead of waiting for "done" to pay the cold load (D35).
      const { state } = this.state.get();
      if (state === 'ready' || state === 'slow') this.warmStarted = false;
      this.dispatch({ type: 'idle' });
    }, this.idleMs);
  }

  private dispatch(event: ReadinessEvent): void {
    this.state.set(reduce(this.state.get(), event));
  }
}

interface ResponseLike {
  inferenceSource?: string;
  text(): string;
}

/** ONLY_ON_DEVICE can't reach the cloud. This makes the guarantee visible, and checked, in code. */
function onDeviceText(response: ResponseLike): string {
  if (response.inferenceSource !== InferenceSource.ON_DEVICE) {
    throw new BoundaryError('a letter response did not come from the device');
  }
  return response.text();
}

/** The promise's value, or undefined if it isn't there in time. */
function within<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<undefined>((resolve) => (timer = setTimeout(() => resolve(undefined), ms)));
  return Promise.race([promise, late]).finally(() => clearTimeout(timer));
}

const priorityOf = (urgent: boolean) => (urgent ? Priority.user : Priority.background);

const assertOnDevice = (result: { response: ResponseLike }) => onDeviceText(result.response);

function isUnknownError(e: unknown): boolean {
  return e instanceof Error && /UnknownError|kErrorUnknown/.test(`${e.name} ${e.message}`);
}
