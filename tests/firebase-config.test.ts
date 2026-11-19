import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_FIREBASE_CONFIG, DEFAULT_RECAPTCHA_ENTERPRISE_SITE_KEY, resolveFirebaseConfig, resolveRecaptchaEnterpriseSiteKey } from "../src/firebaseConfig";
import { installAppCheckDebugToken } from "../src/lib/firebase/app-check-debug";
import { prepareCloudAssist } from "../src/lib/redaction/cloud";
import { redact, rehydrate } from "../src/lib/redaction/engine";
import { SMOKE_SAMPLES } from "../src/lib/redaction/smoke-samples";
import { emptyEnabled, emptyVault } from "../src/lib/redaction/types";

describe("firebase config", () => {
  it("uses the committed web config and lets env vars override one field", () => {
    expect(resolveFirebaseConfig().projectId).toBe("myfirstproject-76495");
    expect(resolveFirebaseConfig().apiKey).toBe(DEFAULT_FIREBASE_CONFIG.apiKey);
    expect(resolveFirebaseConfig({ VITE_FIREBASE_PROJECT_ID: "other-project" }).projectId).toBe("other-project");
    expect(resolveFirebaseConfig({ VITE_FIREBASE_API_KEY: "  " }).apiKey).toBe(DEFAULT_FIREBASE_CONFIG.apiKey);
    expect(resolveRecaptchaEnterpriseSiteKey()).toBe(DEFAULT_RECAPTCHA_ENTERPRISE_SITE_KEY);
    expect(resolveRecaptchaEnterpriseSiteKey({
      VITE_FIREBASE_RECAPTCHA_ENTERPRISE_SITE_KEY: "override-key",
    })).toBe("override-key");
  });

  afterEach(() => {
    const host = globalThis as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string; self?: unknown };
    delete host.FIREBASE_APPCHECK_DEBUG_TOKEN;
    delete host.self;
  });

  it("publishes the App Check debug token on globalThis and self before initialization", () => {
    installAppCheckDebugToken("debug-token-value");
    const host = globalThis as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string; self?: { FIREBASE_APPCHECK_DEBUG_TOKEN?: string } };
    expect(host.FIREBASE_APPCHECK_DEBUG_TOKEN).toBe("debug-token-value");
    expect((self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string }).FIREBASE_APPCHECK_DEBUG_TOKEN).toBe("debug-token-value");
  });
});

describe("smoke samples", () => {
  it("redacts every listed secret before a payload is built", () => {
    expect(SMOKE_SAMPLES).toHaveLength(3);
    for (const sample of SMOKE_SAMPLES) {
      const redacted = redact(sample.text, { enabled: emptyEnabled() }, emptyVault());
      expect(rehydrate(redacted.text, redacted.vault)).toBe(sample.text);
      const prepared = prepareCloudAssist(sample.task, redacted.text, redacted.vault);
      for (const secret of sample.secrets) {
        expect(prepared.payload, `${sample.id} leaked ${secret}`).not.toContain(secret);
      }
    }
  });
});
