import { describe, expect, it } from "vitest";
import { prepareCloudAssist } from "../src/lib/redaction/cloud";
import {
  guardModelPlaceholders,
  modelOutputWarning,
  placeholdersIn,
  rehydrate,
  redact,
} from "../src/lib/redaction/engine";
import { SAMPLE_SECRETS, SAMPLE_TEXT } from "../src/lib/redaction/sample";
import { emptyEnabled, emptyVault } from "../src/lib/redaction/types";

describe("draft reply prompt", () => {
  it("allows only placeholders from the message and forbids invented names", () => {
    const redacted = redact(SAMPLE_TEXT, { enabled: emptyEnabled() }, emptyVault());
    const allowed = placeholdersIn(redacted.text);
    const prepared = prepareCloudAssist("reply", redacted.text, redacted.vault);
    expect(prepared.payload).toContain("Do not sign with a made-up name");
    expect(prepared.payload).toContain("or do not sign at all");
    expect(prepared.payload).toContain(`Allowed placeholders: ${allowed.join(", ")}.`);
    expect(prepared.payload).toContain("If you sign, use a placeholder from this list that is the sender, or do not sign.");
    expect(placeholdersIn(prepared.payload).sort()).toEqual([...allowed].sort());
    expect(prepared.payload).not.toContain("[PERSON_3]");
    for (const secret of SAMPLE_SECRETS) expect(prepared.payload).not.toContain(secret);
  });

  it("tells a reply with no placeholders not to invent one", () => {
    const prepared = prepareCloudAssist("reply", "Please confirm the invoice was received.", emptyVault());
    expect(prepared.payload).toContain("Allowed placeholders: none.");
    expect(placeholdersIn(prepared.payload)).toEqual([]);
  });
});

describe("model output guard", () => {
  it("strips unknown placeholders and a raw invented signature before restore", () => {
    const result = redact(SAMPLE_TEXT, { enabled: emptyEnabled() }, emptyVault());
    const sender = result.vault.entries.find((entry) => entry.value === "Luis Ortega");
    const customer = result.vault.entries.find((entry) => entry.value === "Maya Chen");
    expect(sender?.placeholder).toBeTruthy();
    expect(customer?.placeholder).toBeTruthy();
    const reply = [
      `Hi ${customer?.placeholder},`,
      "",
      "The file is updated and the old key is retired.",
      "",
      "Best,",
      "[PERSON_3]",
      "Maya Chen",
    ].join("\n");

    const guarded = guardModelPlaceholders(reply, result.vault);
    expect(guarded.unknown).toEqual(["[PERSON_3]"]);
    expect(guarded.removedSignature).toBe(true);
    expect(guarded.text).not.toContain("[PERSON_3]");
    expect(guarded.text).not.toContain("Maya Chen");
    expect(guarded.text).toContain(customer?.placeholder ?? "");

    const restored = rehydrate(guarded.text, result.vault);
    expect(restored).toContain("Hi Maya Chen,");
    expect(restored).not.toContain("[PERSON_3]");
    expect(restored).not.toMatch(/^Maya Chen$/m);
    expect(modelOutputWarning(guarded)).toContain("Removed [PERSON_3] before restore.");
    expect(modelOutputWarning(guarded)).toContain("Removed a signature that was not a placeholder from the payload.");
  });

  it("keeps a signature that is the sender placeholder and restores it", () => {
    const result = redact(SAMPLE_TEXT, { enabled: emptyEnabled() }, emptyVault());
    const sender = result.vault.entries.find((entry) => entry.value === "Luis Ortega");
    expect(sender).toBeTruthy();
    const reply = `Hi there,\n\nThe invoice is updated.\n\nThanks,\n${sender?.placeholder}`;
    const guarded = guardModelPlaceholders(reply, result.vault);
    expect(guarded.unknown).toEqual([]);
    expect(guarded.removedSignature).toBe(false);
    expect(guarded.text).toBe(reply);
    expect(rehydrate(guarded.text, result.vault)).toContain("Luis Ortega");
    expect(modelOutputWarning(guarded)).toBe("");
  });

  it("flags every invented placeholder and leaves known ones untouched", () => {
    const result = redact("Please update the file for Maya Chen.", { enabled: emptyEnabled() }, emptyVault());
    const reply = "Hello [PERSON_1], copying [EMAIL_4] and [PERSON_3].";
    const guarded = guardModelPlaceholders(reply, result.vault);
    expect(guarded.unknown).toEqual(["[EMAIL_4]", "[PERSON_3]"]);
    expect(guarded.text).toBe("Hello [PERSON_1], copying and.");
    expect(rehydrate(guarded.text, result.vault)).toBe("Hello Maya Chen, copying and.");
    expect(modelOutputWarning(guarded)).toBe(
      "Removed [EMAIL_4], [PERSON_3] before restore. They were not in the approved payload, so they cannot be filled in.",
    );
  });
});
