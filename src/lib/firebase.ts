import { initializeApp } from 'firebase/app';
import { CustomProvider, ReCaptchaEnterpriseProvider, initializeAppCheck } from 'firebase/app-check';
import { GoogleAIBackend, getAI } from 'firebase/ai';

const env = import.meta.env;

export const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
});

// App Check is required for Firebase AI Logic's cloud calls. On-device calls never reach Firebase.
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

// Limited-use tokens: a captured token can't be replayed (replay protection).
export const ai = getAI(app, { backend: new GoogleAIBackend(), useLimitedUseAppCheckTokens: true });
