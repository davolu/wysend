import { describe, expect, it } from "vitest";
import { prepareCloudAssist, CloudPayloadError } from "../src/lib/redaction/cloud";
import { redact } from "../src/lib/redaction/engine";
import { emptyEnabled, emptyVault } from "../src/lib/redaction/types";
import { SAMPLE_SECRETS, SAMPLE_TEXT } from "../src/lib/redaction/sample";

describe("cloud payload", () => {
  it("sends placeholders and no raw secrets, and records the exact byte length", () => {
    const redacted = redact(SAMPLE_TEXT, { enabled: emptyEnabled() }, emptyVault());
    const prepared = prepareCloudAssist("summarize", redacted.text, redacted.vault);
    for (const secret of SAMPLE_SECRETS) {
      expect(prepared.payload).not.toContain(secret);
    }
    expect(prepared.payload).toContain("[PERSON_1]");
    expect(prepared.payload).toContain("[API_KEY_1]");
    expect(prepared.bytes).toBe(new TextEncoder().encode(prepared.payload).length);
    expect(prepared.payload.startsWith("Summarize the message.")).toBe(true);
  });

  it("refuses the original text, including when a detector was turned off", () => {
    const vault = redact(SAMPLE_TEXT, { enabled: emptyEnabled() }, emptyVault()).vault;
    expect(() => prepareCloudAssist("reply", SAMPLE_TEXT, vault)).toThrow(CloudPayloadError);
    const partial = redact(SAMPLE_TEXT, { enabled: { ...emptyEnabled(), EMAIL: false } }, emptyVault());
    expect(partial.text).toContain("maya.chen@example.com");
    expect(() => prepareCloudAssist("analyze", partial.text, partial.vault)).toThrow(CloudPayloadError);
  });
});
