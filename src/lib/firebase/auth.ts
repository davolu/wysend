import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCredential,
  signOut,
  type User,
} from "firebase/auth";
import { ensureAppCheck, getFirebaseApp } from "./init";

export interface AccountSnapshot {
  uid: string | null;
  anonymous: boolean;
  email: string | null;
}

export function accountFromUser(user: User | null): AccountSnapshot {
  if (!user) return { uid: null, anonymous: false, email: null };
  return { uid: user.uid, anonymous: user.isAnonymous, email: user.email };
}

function authOrThrow() {
  const status = ensureAppCheck();
  if (!status.ready) throw new Error(status.detail);
  return getAuth(getFirebaseApp());
}

export function watchAccount(onChange: (account: AccountSnapshot) => void): () => void {
  const status = ensureAppCheck();
  if (!status.ready) {
    onChange({ uid: null, anonymous: false, email: null });
    return () => undefined;
  }
  return onAuthStateChanged(getAuth(getFirebaseApp()), (user) => {
    onChange(accountFromUser(user));
  });
}

export async function signInAnonymous(): Promise<AccountSnapshot> {
  const credential = await signInAnonymously(authOrThrow());
  return accountFromUser(credential.user);
}

export async function signInWithGoogle(clientId: string): Promise<AccountSnapshot> {
  if (!clientId) throw new Error("Set VITE_GOOGLE_OAUTH_CLIENT_ID and rebuild to use Google sign-in.");
  if (typeof chrome === "undefined" || !chrome.identity?.launchWebAuthFlow) {
    throw new Error("Google sign-in is only available inside the extension.");
  }
  const redirectUri = chrome.identity.getRedirectURL();
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("response_type", "token");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", "openid email profile");
  const responseUrl = await chrome.identity.launchWebAuthFlow({
    url: authUrl.toString(),
    interactive: true,
  });
  if (!responseUrl) throw new Error("Google sign-in was closed.");
  const accessToken = new URLSearchParams(new URL(responseUrl).hash.slice(1)).get("access_token");
  if (!accessToken) throw new Error("Google did not return an access token.");
  const credential = GoogleAuthProvider.credential(null, accessToken);
  const signed = await signInWithCredential(authOrThrow(), credential);
  return accountFromUser(signed.user);
}

export async function signOutAccount(): Promise<void> {
  await signOut(authOrThrow());
}
