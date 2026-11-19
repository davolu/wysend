import { detectRules, locateModelSpans, resolveOverlaps, type RawSpan } from "./detectors";
import {
  canonicalValue,
  emptyVault,
  type EntityType,
  type Finding,
  type ModelEntity,
  type RedactResult,
  type Vault,
  type VaultEntry,
} from "./types";

export interface RedactOptions {
  enabled: Record<EntityType, boolean>;
  modelEntities?: ModelEntity[];
}

export function placeholderFor(type: EntityType, canonical: string, entries: VaultEntry[]): string {
  const existing = entries.find((entry) => entry.type === type && entry.canonical === canonical);
  if (existing) return existing.placeholder;
  const next = entries.filter((entry) => entry.type === type).length + 1;
  return `[${type}_${next}]`;
}

export function redact(input: string, options: RedactOptions, vault: Vault = emptyVault()): RedactResult {
  const entries = vault.entries.map((entry) => ({ ...entry }));
  const ruleSpans = detectRules(input, options.enabled);
  const modelSpans = locateModelSpans(input, options.modelEntities ?? [], options.enabled);
  const spans = resolveOverlaps([...ruleSpans, ...modelSpans]);
  const findings: Finding[] = [];
  let cursor = 0;
  let text = "";

  for (const span of spans) {
    if (span.start < cursor || span.end > input.length) continue;
    const canonical = canonicalValue(span.type, span.value);
    if (!canonical) continue;
    const placeholder = placeholderFor(span.type, canonical, entries);
    if (!entries.some((entry) => entry.placeholder === placeholder)) {
      entries.push({
        placeholder,
        type: span.type,
        value: span.value,
        canonical,
      });
    }
    text += input.slice(cursor, span.start) + placeholder;
    findings.push({
      type: span.type,
      value: span.value,
      placeholder,
      start: span.start,
      end: span.end,
      source: span.source,
    });
    cursor = span.end;
  }

  text += input.slice(cursor);
  return { text, findings, vault: { entries } };
}

export function rehydrate(text: string, vault: Vault): string {
  const ordered = [...vault.entries].sort((a, b) => b.placeholder.length - a.placeholder.length);
  let out = text;
  for (const entry of ordered) {
    if (!entry.placeholder) continue;
    out = out.split(entry.placeholder).join(entry.value);
  }
  return out;
}

const PLACEHOLDER_PATTERN = /\[[A-Z][A-Z0-9]*_\d+\]/g;

export function placeholdersIn(text: string): string[] {
  return [...new Set(text.match(new RegExp(PLACEHOLDER_PATTERN.source, "g")) ?? [])];
}

export function unknownPlaceholders(text: string, vault: Vault): string[] {
  const known = new Set(vault.entries.map((entry) => entry.placeholder));
  return placeholdersIn(text).filter((token) => !known.has(token));
}

/**
 * Drops placeholders the model invented. Known placeholders stay so restore can fill them.
 * A line that was only an invented placeholder is removed with it.
 */
export function stripUnknownPlaceholders(text: string, unknown: readonly string[]): string {
  if (unknown.length === 0) return text;
  const tokens = [...unknown].sort((a, b) => b.length - a.length);
  const lines = text.split("\n").flatMap((line) => {
    const hadUnknown = tokens.some((token) => line.includes(token));
    let next = line;
    for (const token of tokens) next = next.split(token).join("");
    next = next.replace(/[ \t]{2,}/g, " ").replace(/[ \t]+([,.;:!?])/g, "$1").replace(/^[ \t]+|[ \t]+$/g, "");
    if (hadUnknown && (next === "" || /^[-–—]+$/.test(next))) return [];
    return [next];
  });
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function stripRawSignatureLines(text: string, vault: Vault): { text: string; removed: boolean } {
  const names = vault.entries
    .filter((entry) => entry.type === "PERSON" && entry.value.trim())
    .map((entry) => entry.value.trim());
  if (names.length === 0) return { text, removed: false };
  let removed = false;
  const lines = text.split("\n").filter((line) => {
    const trimmed = line.trim().replace(/[,.]$/, "");
    const invented = names.some((name) => trimmed === name);
    if (invented) removed = true;
    return !invented;
  });
  return {
    text: lines.join("\n").replace(/\n{3,}/g, "\n\n").trim(),
    removed,
  };
}

export function guardModelPlaceholders(text: string, vault: Vault): { text: string; unknown: string[]; removedSignature: boolean } {
  const unknown = unknownPlaceholders(text, vault);
  const stripped = stripUnknownPlaceholders(text, unknown);
  const signatures = stripRawSignatureLines(stripped, vault);
  return { unknown, text: signatures.text, removedSignature: signatures.removed };
}

export function unknownPlaceholderWarning(unknown: readonly string[]): string {
  if (unknown.length === 0) return "";
  const list = unknown.join(", ");
  if (unknown.length === 1) {
    return `Removed ${list} before restore. It was not in the approved payload, so it cannot be filled in.`;
  }
  return `Removed ${list} before restore. They were not in the approved payload, so they cannot be filled in.`;
}

export function modelOutputWarning(result: { unknown: readonly string[]; removedSignature: boolean }): string {
  const parts = [unknownPlaceholderWarning(result.unknown)];
  if (result.removedSignature) {
    parts.push("Removed a signature that was not a placeholder from the payload.");
  }
  return parts.filter(Boolean).join(" ");
}

export function parseModelEntities(raw: string): ModelEntity[] {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return [];
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as { entities?: unknown };
    if (!parsed || !Array.isArray(parsed.entities)) return [];
    const entities: ModelEntity[] = [];
    for (const item of parsed.entities) {
      if (!item || typeof item !== "object") continue;
      const record = item as { type?: unknown; text?: unknown };
      if (typeof record.type !== "string" || typeof record.text !== "string") continue;
      entities.push({ type: record.type as EntityType, text: record.text });
    }
    return entities;
  } catch {
    return [];
  }
}

export function splitByFindings(text: string, findings: { start: number; end: number }[]): Array<{ text: string; marked: boolean }> {
  if (findings.length === 0) return [{ text, marked: false }];
  const parts: Array<{ text: string; marked: boolean }> = [];
  let cursor = 0;
  const ordered = [...findings].sort((a, b) => a.start - b.start);
  for (const finding of ordered) {
    if (finding.start < cursor || finding.end > text.length) continue;
    if (finding.start > cursor) parts.push({ text: text.slice(cursor, finding.start), marked: false });
    parts.push({ text: text.slice(finding.start, finding.end), marked: true });
    cursor = finding.end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), marked: false });
  return parts;
}

export type { RawSpan };
