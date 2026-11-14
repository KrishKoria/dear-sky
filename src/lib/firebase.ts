import { initializeApp } from 'firebase/app';
import { CustomProvider, ReCaptchaEnterpriseProvider, initializeAppCheck } from 'firebase/app-check';
import { AgentPlatformBackend, getAI, type AI } from 'firebase/ai';

const env = import.meta.env;

export const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
});

let appCheckStarted = false;

/**
 * Starts App Check, once. Its reCAPTCHA scripts are the heaviest thing on the page and only cloud
 * calls need a token, so this runs after the page has settled, and again (a no-op by then) at the
 * start of every cloud path. On-device calls never reach Firebase.
 */
export function ensureAppCheck(): void {
  if (appCheckStarted) return;
  appCheckStarted = true;
  if (env.DEV) {
    // Prints "Firebase App Check debug token: …" in the console on first run. Register it in the
    // console: Security → App Check → Apps → ⋮ → Manage debug tokens. Never enabled in production.
    (self as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    initializeAppCheck(app, {
      // Debug mode never calls this provider; it just avoids loading reCAPTCHA on localhost.
      provider: new CustomProvider({ getToken: () => Promise.reject(new Error('debug mode uses the debug token')) }),
      isTokenAutoRefreshEnabled: true,
    });
  } else if (env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY) {
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    });
  } else {
    console.warn('App Check is not configured: cloud features will be refused.');
  }
}

let instance: AI | undefined;

/**
 * Cloud calls go through the Agent Platform Gemini API (formerly Vertex AI), billed to the
 * project's Blaze plan. The Gemini Developer API needs its own AI Studio prepay balance (PREP.md D31).
 * On-device calls never reach either backend.
 * Limited-use tokens: a captured token can't be replayed (replay protection).
 *
 * The instance reads App Check once, when it is made, and so do the models built from it. So
 * App Check starts first, here, and nothing makes a model without going through this.
 */
export function getAi(): AI {
  ensureAppCheck();
  return (instance ??= getAI(app, { backend: new AgentPlatformBackend(), useLimitedUseAppCheckTokens: true }));
}
