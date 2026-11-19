/**
 * Public Firebase web config for project myfirstproject-76495.
 * A web apiKey is a client identifier, not a server secret, so it is safe to commit.
 * Environment variables override these defaults. The App Check debug token is not here.
 */
export interface FirebasePublicConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export const DEFAULT_FIREBASE_CONFIG: FirebasePublicConfig = {
  apiKey: "AIzaSyAYlQ2CIC0tYI5YQhAvyJL-MJx547JyXqM",
  authDomain: "myfirstproject-76495.firebaseapp.com",
  projectId: "myfirstproject-76495",
  storageBucket: "myfirstproject-76495.firebasestorage.app",
  messagingSenderId: "743316150934",
  appId: "1:743316150934:web:1d298ce2ca25741634c0b7",
};

export interface FirebaseEnv {
  VITE_FIREBASE_API_KEY?: string;
  VITE_FIREBASE_AUTH_DOMAIN?: string;
  VITE_FIREBASE_PROJECT_ID?: string;
  VITE_FIREBASE_STORAGE_BUCKET?: string;
  VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  VITE_FIREBASE_APP_ID?: string;
}

function override(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

export function resolveFirebaseConfig(env: FirebaseEnv = {}): FirebasePublicConfig {
  return {
    apiKey: override(env.VITE_FIREBASE_API_KEY, DEFAULT_FIREBASE_CONFIG.apiKey),
    authDomain: override(env.VITE_FIREBASE_AUTH_DOMAIN, DEFAULT_FIREBASE_CONFIG.authDomain),
    projectId: override(env.VITE_FIREBASE_PROJECT_ID, DEFAULT_FIREBASE_CONFIG.projectId),
    storageBucket: override(env.VITE_FIREBASE_STORAGE_BUCKET, DEFAULT_FIREBASE_CONFIG.storageBucket),
    messagingSenderId: override(env.VITE_FIREBASE_MESSAGING_SENDER_ID, DEFAULT_FIREBASE_CONFIG.messagingSenderId),
    appId: override(env.VITE_FIREBASE_APP_ID, DEFAULT_FIREBASE_CONFIG.appId),
  };
}
