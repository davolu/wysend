/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_FIREBASE_APPCHECK_DEBUG_TOKEN?: string;
  /** @deprecated Use VITE_FIREBASE_APPCHECK_DEBUG_TOKEN. */
  readonly VITE_APPCHECK_DEBUG_TOKEN?: string;
  readonly VITE_RECAPTCHA_ENTERPRISE_SITE_KEY?: string;
  readonly VITE_GOOGLE_OAUTH_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
