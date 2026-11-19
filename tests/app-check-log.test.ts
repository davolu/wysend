import { afterEach, describe, expect, it } from "vitest";
import { installAppCheckDebugToken, suppressAppCheckDebugTokenConsole } from "../src/lib/firebase/app-check-debug";

describe("App Check debug token logs", () => {
  const original = console.log;

  afterEach(() => {
    console.log = original;
    const host = globalThis as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string; self?: unknown };
    delete host.FIREBASE_APPCHECK_DEBUG_TOKEN;
    delete host.self;
  });

  function captureLogs(): string[] {
    const seen: string[] = [];
    console.log = ((...args: unknown[]) => {
      seen.push(args.map((arg) => String(arg)).join(" "));
    }) as typeof console.log;
    return seen;
  }

  it("drops the SDK debug token line and keeps other logs", () => {
    const seen = captureLogs();
    suppressAppCheckDebugTokenConsole();
    console.log("Firebase App Check debug token: super-secret-token");
    console.log("To use this token for app debugging, register it with your project.\n\nFirebase App Check debug token: super-secret-token\n");
    console.log("App Check: debug token was set. The token value is not printed.");
    expect(seen).toEqual(["App Check: debug token was set. The token value is not printed."]);
    expect(seen.join("\n")).not.toContain("super-secret-token");
  });

  it("installs the filter on Node before the token is published", () => {
    const seen = captureLogs();
    installAppCheckDebugToken("super-secret-token");
    console.log("Firebase App Check debug token: super-secret-token");
    console.log("Cloud model: gemini-3.5-flash-lite");
    expect(seen).toEqual(["Cloud model: gemini-3.5-flash-lite"]);
    expect(seen.join("\n")).not.toContain("super-secret-token");
  });
});
