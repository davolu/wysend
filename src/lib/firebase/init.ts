import { initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider, type AppCheck } from "firebase/app-check";

export interface FirebasePublicConfig extends FirebaseOptions {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export type AppCheckMethod = "debug" | "recaptcha-enterprise" | "missing-config" | "missing-app-check";

export interface AppCheckStatus {
  ready: boolean;
  method: AppCheckMethod;
  projectId: string | null;
  detail: string;
}

type DebugGlobal = typeof globalThis & {
  FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean;
};

let app: FirebaseApp | null = null;
let appCheck: AppCheck | null = null;
let status: AppCheckStatus = {
  ready: false,
  method: "missing-config",
  projectId: null,
  detail: "Firebase has not been initialized.",
};

export function readFirebaseConfig(): FirebasePublicConfig | null {
  const config: FirebasePublicConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "",
  };
  if (!config.apiKey || !config.authDomain || !config.projectId || !config.appId) return null;
  return config;
}

export function isFirebaseConfigured(): boolean {
  return readFirebaseConfig() !== null;
}

export function getFirebaseApp(): FirebaseApp {
  const config = readFirebaseConfig();
  if (!config) {
    throw new Error("Firebase config is missing. Copy .env.example to .env and rebuild.");
  }
  if (!app) app = initializeApp(config);
  return app;
}

/**
 * App Check has to be initialized before AI Logic, Auth, Firestore, or Remote Config.
 * A debug token is the path that works in a Manifest V3 extension: the SDK exchanges
 * it over HTTPS and does not load the remote reCAPTCHA script. Register the same
 * token under Security → App Check → Apps → Manage debug tokens.
 */
export function ensureAppCheck(debugToken?: string): AppCheckStatus {
  if (appCheck) return status;
  const config = readFirebaseConfig();
  if (!config) {
    status = {
      ready: false,
      method: "missing-config",
      projectId: null,
      detail: "Add the web app config to .env and rebuild. Local redaction still works.",
    };
    return status;
  }
  const token = (debugToken || import.meta.env.VITE_APPCHECK_DEBUG_TOKEN || "").trim();
  const siteKey = (import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY || "").trim();
  if (!token && !siteKey) {
    status = {
      ready: false,
      method: "missing-app-check",
      projectId: config.projectId,
      detail: "Add an App Check debug token in this panel, or a reCAPTCHA Enterprise site key at build time.",
    };
    return status;
  }
  if (token) {
    (globalThis as DebugGlobal).FIREBASE_APPCHECK_DEBUG_TOKEN = token;
  }
  appCheck = initializeAppCheck(getFirebaseApp(), {
    provider: new ReCaptchaEnterpriseProvider(siteKey || "extension-debug-placeholder"),
    isTokenAutoRefreshEnabled: true,
  });
  status = {
    ready: true,
    method: token ? "debug" : "recaptcha-enterprise",
    projectId: config.projectId,
    detail: token
      ? "App Check debug token is set. Register that exact token in the Firebase console before cloud calls will succeed."
      : "App Check is using reCAPTCHA Enterprise. Extension pages usually cannot load that script; use a debug token if cloud calls fail.",
  };
  return status;
}

export function currentAppCheckStatus(): AppCheckStatus {
  return status;
}
