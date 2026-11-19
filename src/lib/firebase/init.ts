import { initializeApp, type FirebaseApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider, type AppCheck } from "firebase/app-check";
import { resolveFirebaseConfig, resolveRecaptchaEnterpriseSiteKey, type FirebasePublicConfig } from "../../firebaseConfig";
import { installAppCheckDebugToken } from "./app-check-debug";

export type { FirebasePublicConfig };

export type AppCheckMethod = "debug" | "recaptcha-enterprise" | "missing-config" | "missing-app-check";

export interface AppCheckStatus {
  ready: boolean;
  method: AppCheckMethod;
  projectId: string | null;
  detail: string;
}

let app: FirebaseApp | null = null;
let appCheck: AppCheck | null = null;
let status: AppCheckStatus = {
  ready: false,
  method: "missing-config",
  projectId: null,
  detail: "Firebase has not been initialized.",
};

export function readFirebaseConfig(): FirebasePublicConfig {
  return resolveFirebaseConfig({
    VITE_FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY,
    VITE_FIREBASE_AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    VITE_FIREBASE_STORAGE_BUCKET: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    VITE_FIREBASE_MESSAGING_SENDER_ID: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    VITE_FIREBASE_APP_ID: import.meta.env.VITE_FIREBASE_APP_ID,
  });
}

export function isFirebaseConfigured(): boolean {
  return Boolean(readFirebaseConfig().apiKey && readFirebaseConfig().projectId);
}

export function getFirebaseApp(): FirebaseApp {
  if (!app) app = initializeApp(readFirebaseConfig());
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
  const token = (
    debugToken
    || import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN
    || import.meta.env.VITE_APPCHECK_DEBUG_TOKEN
    || ""
  ).trim();
  const siteKey = resolveRecaptchaEnterpriseSiteKey({
    VITE_FIREBASE_RECAPTCHA_ENTERPRISE_SITE_KEY: import.meta.env.VITE_FIREBASE_RECAPTCHA_ENTERPRISE_SITE_KEY,
    VITE_RECAPTCHA_ENTERPRISE_SITE_KEY: import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY,
  });
  if (!token && !siteKey) {
    status = {
      ready: false,
      method: "missing-app-check",
      projectId: config.projectId,
      detail: "Add an App Check debug token in this panel, or a reCAPTCHA Enterprise site key at build time.",
    };
    return status;
  }
  if (token) installAppCheckDebugToken(token);
  appCheck = initializeAppCheck(getFirebaseApp(), {
    provider: new ReCaptchaEnterpriseProvider(siteKey),
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
