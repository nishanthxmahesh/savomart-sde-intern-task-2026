// Firebase client init for phone-auth. Reads the web config from
// VITE_FIREBASE_* env vars (set in .env.development / .env.production
// or in Vercel's env UI).
//
// If the env vars are missing we DO NOT throw at module load — that
// would break the entire SPA. Instead, isFirebaseReady() returns false
// and the Login page surfaces a clear "not configured" state.
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const required = ['apiKey', 'authDomain', 'projectId', 'appId'];
const missing = required.filter((k) => !firebaseConfig[k]);

let app = null;
let auth = null;

if (missing.length === 0) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
} else if (import.meta.env.DEV) {
  // eslint-disable-next-line no-console
  console.warn(
    `[Firebase] disabled — missing env vars: ${missing.map((k) => `VITE_FIREBASE_${k.toUpperCase()}`).join(', ')}`,
  );
}

export { app, auth };

export function isFirebaseReady() {
  return auth !== null;
}

export function firebaseMissingVars() {
  return missing.map((k) => `VITE_FIREBASE_${k.toUpperCase()}`);
}
