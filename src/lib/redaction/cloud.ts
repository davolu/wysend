import { detectRules } from "./detectors";
import { placeholdersIn, redact } from "./engine";
import { emptyEnabled, emptyVault, type EntityType, type Vault } from "./types";

export type AssistTask = "reply" | "summarize" | "analyze" | "explain";

export interface PromptSet {
  reply: string;
  summarize: string;
  analyze: string;
  explain: string;
  onDevice: string;
}

export const TASKS: { id: AssistTask; label: string; hint: string }[] = [
  { id: "reply", label: "Draft reply", hint: "A response you can review before sending" },
  { id: "summarize", label: "Summarize", hint: "A short brief of the selection" },
  { id: "analyze", label: "Analyze", hint: "What matters and what to do next" },
  { id: "explain", label: "Explain", hint: "Plain language, still without raw details" },
];

export class CloudPayloadError extends Error {
  readonly leaks: string[];

  constructor(leaks: string[]) {
    super("Refusing to send raw personal data to the cloud.");
    this.name = "CloudPayloadError";
    this.leaks = leaks;
  }
}

export const BUILTIN_PROMPTS: PromptSet = {
  onDevice:
    "Find sensitive spans in the user text. Reply with JSON only: {\"entities\":[{\"type\":\"PERSON\",\"text\":\"exact substring\"}]}. Allowed types are PERSON, PHONE, EMAIL, ADDRESS, BANK, BVN, NIN, CARD, SSN, API_KEY, SECRET. Copy each text value exactly from the input. Include people, phone numbers, emails, postal addresses, bank account numbers, IBANs, national IDs such as SSN, NIN, or BVN when they appear, payment card numbers, and API keys or tokens. Skip anything that is already a placeholder such as [PERSON_1]. If there is nothing to add, return {\"entities\":[]}.",
  summarize:
    "Summarize the message. It is already redacted. Keep every placeholder such as [PERSON_1] or [EMAIL_1] exactly as written. Do not guess what a placeholder stands for. Do not add personal data.",
  reply:
    "Draft a short, polite reply to the message. It is already redacted. Use only placeholders that already appear in the message, copied exactly. Do not invent placeholders, names, email addresses, phone numbers, or signatures. Do not sign with a made-up name. If you sign, use the sender's own placeholder from the message, or do not sign at all.",
  analyze:
    "Analyze the message for the reader. Keep every placeholder such as [PERSON_1] exactly as written. Point out decisions and risks without guessing real names, numbers, or secrets.",
  explain:
    "Explain the message in plain language. Keep every placeholder such as [PERSON_1] exactly as written. Do not invent personal data.",
};

const TASK_KEY: Record<AssistTask, keyof Pick<PromptSet, "reply" | "summarize" | "analyze" | "explain">> = {
  reply: "reply",
  summarize: "summarize",
  analyze: "analyze",
  explain: "explain",
};

function replyPlaceholderRule(redactedText: string): string {
  const allowed = placeholdersIn(redactedText);
  const list = allowed.length > 0 ? allowed.join(", ") : "none";
  return `Allowed placeholders: ${list}. These are the only placeholders you may write. Do not invent a name or a signature. If you sign, use a placeholder from this list that is the sender, or do not sign.`;
}

export function buildCloudPrompt(task: AssistTask, redactedText: string, prompts: PromptSet): string {
  const instruction = prompts[TASK_KEY[task]] || BUILTIN_PROMPTS[task];
  const constraint = task === "reply" ? `\n\n${replyPlaceholderRule(redactedText)}` : "";
  return `${instruction}${constraint}\n\nMessage:\n"""\n${redactedText}\n"""`;
}

function boundaryHit(payload: string, value: string): boolean {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (value.length < 8) {
    return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "u").test(payload);
  }
  return payload.includes(value);
}

export function findCloudLeaks(payload: string, vault: Vault): string[] {
  const leaks = new Set<string>();
  for (const entry of vault.entries) {
    if (!entry.value) continue;
    if (boundaryHit(payload, entry.value) || (entry.canonical.length >= 8 && payload.includes(entry.canonical))) {
      leaks.add(entry.placeholder || entry.type);
    }
  }
  const residual = detectRules(payload, emptyEnabled());
  for (const span of residual) {
    if (/^\[[A-Z]+_\d+\]$/.test(span.value)) continue;
    leaks.add(span.type);
  }
  return [...leaks];
}

export function assertCloudPayloadSafe(payload: string, vault: Vault): void {
  const leaks = findCloudLeaks(payload, vault);
  if (leaks.length > 0) throw new CloudPayloadError(leaks);
}

export interface PreparedCloudRequest {
  task: AssistTask;
  payload: string;
  bytes: number;
}

export function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/**
 * Builds the only string a cloud model is allowed to see.
 * Throws before any network call when raw values or detector hits remain.
 */
export function prepareCloudAssist(
  task: AssistTask,
  redactedText: string,
  vault: Vault,
  prompts: PromptSet = BUILTIN_PROMPTS,
): PreparedCloudRequest {
  const payload = buildCloudPrompt(task, redactedText, prompts);
  assertCloudPayloadSafe(payload, vault);
  return { task, payload, bytes: utf8ByteLength(payload) };
}

export function redactForCloud(input: string, enabled: Record<EntityType, boolean>, vault: Vault = emptyVault()) {
  return redact(input, { enabled }, vault);
}
