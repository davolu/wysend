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
