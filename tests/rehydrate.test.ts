import { describe, expect, it } from "vitest";
import { redact, rehydrate } from "../src/lib/redaction/engine";
import { emptyEnabled, emptyVault } from "../src/lib/redaction/types";
import { SAMPLE_TEXT } from "../src/lib/redaction/sample";

describe("rehydration", () => {
  it("restores the original text from placeholders", () => {
    const result = redact(SAMPLE_TEXT, { enabled: emptyEnabled() }, emptyVault());
    expect(rehydrate(result.text, result.vault)).toBe(SAMPLE_TEXT);
  });

  it("restores a cloud-style reply without touching unknown placeholders", () => {
    const result = redact("Please update the file for Maya Chen.", { enabled: emptyEnabled() }, emptyVault());
    const reply = `Hi ${result.text.includes("[PERSON_1]") ? "[PERSON_1]" : "there"}, the key rotated. [UNKNOWN_9]`;
    const restored = rehydrate(`Hi [PERSON_1], the key rotated. [UNKNOWN_9]`, result.vault);
    expect(restored).toContain("Maya Chen");
    expect(restored).toContain("[UNKNOWN_9]");
    expect(reply).toContain("[PERSON_1]");
  });
});
