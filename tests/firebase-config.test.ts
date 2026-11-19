import { describe, expect, it } from "vitest";
import { DEFAULT_FIREBASE_CONFIG, resolveFirebaseConfig } from "../src/firebaseConfig";
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
