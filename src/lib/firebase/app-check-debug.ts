type DebugHost = {
  FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean;
  self?: DebugHost;
};

const DEBUG_TOKEN_LOG = "Firebase App Check debug token:";
const LOG_FILTER = Symbol.for("wysend.appCheckDebugLogFilter");

type LogFn = (...data: unknown[]) => void;

function isNodeRuntime(): boolean {
  const proc = (globalThis as { process?: { release?: { name?: string } } }).process;
  return proc?.release?.name === "node";
}

/**
 * initializeAppCheck prints `Firebase App Check debug token: <token>` on console.log.
 * Drop that line for the rest of this process. Other logs are unchanged.
 */
export function suppressAppCheckDebugTokenConsole(): void {
  const current = console.log as LogFn & { [LOG_FILTER]?: true };
  if (current[LOG_FILTER]) return;
  const wrapped: LogFn & { [LOG_FILTER]?: true } = (...args) => {
    if (args.some((arg) => typeof arg === "string" && arg.includes(DEBUG_TOKEN_LOG))) return;
    current.apply(console, args);
  };
  wrapped[LOG_FILTER] = true;
  console.log = wrapped as typeof console.log;
}

/**
 * Firebase reads the debug token from getGlobal(), which returns `self` when
 * that binding exists and otherwise `global` / `globalThis`. Set both before
 * initializeAppCheck. Node does not define `self`, so publish the same object
 * under that name before the SDK looks it up.
 */
export function installAppCheckDebugToken(token: string): void {
  if (isNodeRuntime()) suppressAppCheckDebugTokenConsole();
  const host = globalThis as DebugHost;
  host.FIREBASE_APPCHECK_DEBUG_TOKEN = token;
  if (typeof self !== "undefined") {
    (self as unknown as DebugHost).FIREBASE_APPCHECK_DEBUG_TOKEN = token;
    return;
  }
  host.self = host;
}
