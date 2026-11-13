/**
 * The server's Gemini calls (PREP.md D15, D16, D32, D33): moderation and kindred ranking.
 *
 * Like every AI call in Dear Sky, they go through **Firebase AI Logic** (`firebase/ai`, its
 * Node build), `ONLY_IN_CLOUD`, on the Agent Platform backend: the contest asks for all AI
 * inference to go through Firebase AI Logic (D33). AI Logic requires App Check; a server
 * can't pass a browser attestation, so the Admin SDK issues the App Check token itself
 * (`createToken`), handed over through a custom provider.
 *
 * Needs DEAR_SKY_WEB_API_KEY and DEAR_SKY_WEB_APP_ID (the web app's config; functions/.env.<project>).
 * On the emulators, set DEAR_SKY_FAKE_AI=1 (functions/.env.local) for a small, predictable
 * stand-in: tests need certainty, and only deployed code can mint App Check tokens.
 */
import { getAppCheck } from 'firebase-admin/app-check';
import {
  AIError,
  AIErrorCode,
  AgentPlatformBackend,
  getAI,
  getGenerativeModel,
  InferenceMode,
  Schema,
  type GenerativeModel,
} from 'firebase/ai';
import { initializeApp } from 'firebase/app';
import { CustomProvider, initializeAppCheck } from 'firebase/app-check';
import {
  CLOUD_MODEL,
  KINDRED_MAX,
  KINDRED_SYSTEM,
  MODERATION_SYSTEM,
  kindredRequest,
  readKindred,
  readModeration,
  wordsJson,
  type LanternWords,
  type Moderation,
  type SkyLantern,
} from '../../src/lib/sky/lantern';

export interface Judge {
  moderate(words: LanternWords): Promise<Moderation>;
  /** Never throws: a lantern without kindred still rises. */
  kindred(words: LanternWords, candidates: SkyLantern[]): Promise<string[]>;
}

const TIMEOUT_MS = 20_000;
let judge: Judge | undefined;

/** One judge per instance: the AI Logic app and its models are reused across events. */
export function getJudge(): Judge {
  judge ??= process.env.DEAR_SKY_FAKE_AI === '1' ? fakeJudge : aiLogicJudge();
  return judge;
}

function setting(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set (functions/.env.<project>)`);
  return value;
}

function projectId(): string {
  const fromConfig = (JSON.parse(process.env.FIREBASE_CONFIG ?? '{}') as { projectId?: string }).projectId;
  return fromConfig ?? setting('GCLOUD_PROJECT');
}

function aiLogicJudge(): Judge {
  const appId = setting('DEAR_SKY_WEB_APP_ID');
  const app = initializeApp({ apiKey: setting('DEAR_SKY_WEB_API_KEY'), appId, projectId: projectId() }, 'judge');

  initializeAppCheck(app, {
    provider: new CustomProvider({
      getToken: async () => {
        const { token, ttlMillis } = await getAppCheck().createToken(appId, { ttlMillis: 30 * 60_000 });
        return { token, expireTimeMillis: Date.now() + ttlMillis };
      },
    }),
    isTokenAutoRefreshEnabled: false,
  });

  const ai = getAI(app, { backend: new AgentPlatformBackend() });
  const cloud = (systemInstruction: string, responseSchema: Parameters<typeof Schema.object>[0]): GenerativeModel =>
    getGenerativeModel(ai, {
      mode: InferenceMode.ONLY_IN_CLOUD,
      inCloudParams: {
        model: CLOUD_MODEL,
        systemInstruction,
        generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: Schema.object(responseSchema) },
      },
    });

  const moderator = cloud(MODERATION_SYSTEM, { properties: { allowed: Schema.boolean() } });
  const matcher = cloud(KINDRED_SYSTEM, { properties: { ids: Schema.array({ items: Schema.string() }) } });

  return {
    async moderate(words) {
      try {
        const result = await moderator.generateContent(wordsJson(words), { timeout: TIMEOUT_MS });
        return readModeration(result.response.text());
      } catch (e) {
        // Gemini's own safety filters declining the words count as held, not as an outage.
        if (e instanceof AIError && e.code === AIErrorCode.RESPONSE_ERROR) return 'held';
        console.warn('moderation call failed', e instanceof Error ? e.message : e);
        return 'unchecked';
      }
    },

    async kindred(words, candidates) {
      if (candidates.length === 0) return [];
      try {
        const result = await matcher.generateContent(kindredRequest(words, candidates), { timeout: TIMEOUT_MS });
        return readKindred(result.response.text(), candidates.map((c) => c.id));
      } catch (e) {
        console.warn('kindred call failed', e instanceof Error ? e.message : e);
        return [];
      }
    },
  };
}

/** Emulator stand-in: holds obvious test words, and matches kindred by feeling. */
export const fakeJudge: Judge = {
  async moderate(words) {
    const text = `${words.essence} ${words.motif}`.toLowerCase();
    if (/vermin|kill|https?:|@|\btest-hold\b/.test(text)) return 'held';
    if (/\btest-outage\b/.test(text)) return 'unchecked';
    return 'clear';
  },
  async kindred(words, candidates) {
    return candidates
      .filter((c) => c.feeling === words.feeling)
      .slice(0, KINDRED_MAX)
      .map((c) => c.id);
  },
};
