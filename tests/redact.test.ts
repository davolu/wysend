import { describe, expect, it } from "vitest";
import { redact } from "../src/lib/redaction/engine";
import { emptyEnabled, emptyVault } from "../src/lib/redaction/types";
import { SAMPLE_SECRETS, SAMPLE_TEXT } from "../src/lib/redaction/sample";

const enabled = emptyEnabled();

describe("redaction", () => {
  it("replaces the sample with stable placeholders and removes every secret", () => {
    const result = redact(SAMPLE_TEXT, { enabled }, emptyVault());
    for (const secret of SAMPLE_SECRETS) {
      expect(result.text).not.toContain(secret);
    }
    expect(result.text).toContain("[PERSON_1]");
    expect(result.text).toContain("[EMAIL_1]");
    expect(result.text).toContain("[PHONE_1]");
    expect(result.text).toContain("[SSN_1]");
    expect(result.text).toContain("[API_KEY_1]");
    expect(result.findings.length).toBeGreaterThanOrEqual(SAMPLE_SECRETS.length);
  });

  it("reuses the same placeholder for the same value", () => {
    const first = redact("Email maya.chen@example.com twice: maya.chen@example.com", { enabled }, emptyVault());
    expect(first.text.match(/\[EMAIL_1\]/g)).toHaveLength(2);
    expect(first.text).not.toContain("[EMAIL_2]");
    const second = redact("Again maya.chen@example.com", { enabled }, first.vault);
    expect(second.text).toContain("[EMAIL_1]");
    expect(second.text).not.toContain("[EMAIL_2]");
  });

  it("keeps a type when its toggle is off", () => {
    const result = redact(SAMPLE_TEXT, { enabled: { ...enabled, PHONE: false } }, emptyVault());
    expect(result.text).toContain("+1 415 555 0198");
    expect(result.text).not.toContain("maya.chen@example.com");
  });

  it("detects international numbers and labeled national IDs", () => {
    const text = [
      "+44 7700 900123",
      "+33 6 12 34 56 78",
      "08035550142",
      "BVN: 22334455667",
      "NIN: 12345678901",
      "SSN: 219-09-9999",
    ].join("\n");
    const result = redact(text, { enabled }, emptyVault());
    expect(result.text).not.toContain("+44 7700 900123");
    expect(result.text).not.toContain("+33 6 12 34 56 78");
    expect(result.text).not.toContain("08035550142");
    expect(result.text).not.toContain("22334455667");
    expect(result.text).not.toContain("12345678901");
    expect(result.text).not.toContain("219-09-9999");
    expect(result.findings.map((finding) => finding.type)).toEqual(
      expect.arrayContaining(["PHONE", "BVN", "NIN", "SSN"]),
    );
  });

  it("rejects an invalid card and accepts a Luhn-valid one", () => {
    const result = redact("bad 4242424242424243 good 4242424242424242", { enabled }, emptyVault());
    expect(result.text).toContain("4242424242424243");
    expect(result.text).not.toContain("4242424242424242");
  });

  it("adds a context entity from the on-device model when it quotes the source", () => {
    const text = "Ping Zubby about the outage.";
    const result = redact(text, {
      enabled,
      modelEntities: [{ type: "PERSON", text: "Zubby" }],
    }, emptyVault());
    expect(result.text).toBe("Ping [PERSON_1] about the outage.");
    expect(result.findings[0]?.source).toBe("model");
  });

  it("leaves an uncued name for the on-device model", () => {
    const result = redact("Ask Zubby about the outage.", { enabled }, emptyVault());
    expect(result.findings).toHaveLength(0);
  });

  it("ignores a model span that is not in the source text", () => {
    const result = redact("Nothing sensitive here.", {
      enabled,
      modelEntities: [{ type: "PERSON", text: "Invented Name" }],
    }, emptyVault());
    expect(result.text).toBe("Nothing sensitive here.");
  });
});
