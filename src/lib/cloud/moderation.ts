/**
 * The cloud moderation pre-check (PREP.md D15, D30).
 *
 * Before a lantern is written to the pending queue, the approved words go to cloud Gemini
 * through Firebase AI Logic (`ONLY_IN_CLOUD`) for instant, kind feedback. It is also the
 * one readable request in DevTools that shows exactly what leaves the device (demo beat 6).
 *
 * Advisory only: the Cloud Function moderates again before anything reaches the shared
 * sky, so a held or unchecked result here never decides on its own, and a client that
 * skips this check gains nothing.
 */
import { AIError, AIErrorCode, getGenerativeModel, InferenceMode, Schema, type AI } from 'firebase/ai';
import type { ApprovedWords } from '../privacy/release';
import { CLOUD_MODEL, MODERATION_SYSTEM, readModeration, wordsJson, type Moderation } from '../sky/lantern';

/**
 * - `clear`: fine for the shared sky (the Function still checks)
 * - `held`: the model, or Gemini's own safety filters, declined it: show the kind note
 * - `unchecked`: offline, slow or refused; write it to the queue and let the Function decide
 */
export type { Moderation };

export const MODERATION_MODEL = CLOUD_MODEL;
const TIMEOUT_MS = 8_000;

const SCHEMA = Schema.object({ properties: { allowed: Schema.boolean() } });

/** Exactly what leaves the device: the three approved fields and nothing else. */
export function moderationRequest(words: ApprovedWords): string {
  return wordsJson(words);
}

export interface CloudModel {
  generateContent(request: string, options?: { timeout?: number }): Promise<{ response: { text(): string } }>;
}

export function cloudModerationModel(ai: AI): CloudModel {
  return getGenerativeModel(ai, {
    mode: InferenceMode.ONLY_IN_CLOUD,
    inCloudParams: {
      model: MODERATION_MODEL,
      systemInstruction: MODERATION_SYSTEM,
      generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: SCHEMA },
    },
  });
}

export async function moderate(model: CloudModel, words: ApprovedWords, timeoutMs = TIMEOUT_MS): Promise<Moderation> {
  try {
    const result = await model.generateContent(moderationRequest(words), { timeout: timeoutMs });
    return readModeration(result.response.text());
  } catch (e) {
    // A blocked prompt or reply (Gemini's safety filters) surfaces as RESPONSE_ERROR.
    if (e instanceof AIError && e.code === AIErrorCode.RESPONSE_ERROR) return 'held';
    return 'unchecked';
  }
}
