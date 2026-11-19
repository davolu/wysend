type DebugHost = {
  FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean;
  self?: DebugHost;
};

/**
 * Firebase reads the debug token from getGlobal(), which returns `self` when
 * that binding exists and otherwise `global` / `globalThis`. Set both before
 * initializeAppCheck. Node does not define `self`, so publish the same object
 * under that name before the SDK looks it up.
 */
export function installAppCheckDebugToken(token: string): void {
  const host = globalThis as DebugHost;
  host.FIREBASE_APPCHECK_DEBUG_TOKEN = token;
  if (typeof self !== "undefined") {
    (self as unknown as DebugHost).FIREBASE_APPCHECK_DEBUG_TOKEN = token;
    return;
  }
  host.self = host;
}
