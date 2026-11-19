import { ENTITY_TYPES, type EntityType } from "./types";

export interface RawSpan {
  type: EntityType;
  value: string;
  start: number;
  end: number;
  source: "rules" | "model";
  rank?: number;
}

const PRIORITY: Record<EntityType, number> = {
  API_KEY: 100,
  SECRET: 90,
  EMAIL: 80,
  CARD: 70,
  SSN: 72,
  BVN: 65,
  NIN: 64,
  PHONE: 50,
  BANK: 40,
  ADDRESS: 30,
  PERSON: 10,
};

interface Pattern {
  type: EntityType;
  re: RegExp;
  group: number;
  rank?: number;
  accept?: (value: string) => boolean;
}

function ibanOk(value: string): boolean {
  const compact = value.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{8,30}$/.test(compact)) return false;
  const rearranged = compact.slice(4) + compact.slice(0, 4);
  let remainder = 0;
  for (const char of rearranged) {
    const chunk = char >= "A" && char <= "Z" ? String(char.charCodeAt(0) - 55) : char;
    for (const digit of chunk) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

function ssnOk(value: string): boolean {
  const match = /^(\d{3})-(\d{2})-(\d{4})$/.exec(value);
  if (!match) return false;
  const area = Number(match[1]);
  const group = Number(match[2]);
  const serial = Number(match[3]);
  if (area === 0 || area === 666 || area >= 900) return false;
  if (group === 0 || serial === 0) return false;
  return true;
}

function luhnOk(digits: string): boolean {
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let n = digits.charCodeAt(i) - 48;
    if (n < 0 || n > 9) return false;
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function patterns(): Pattern[] {
  return [
    {
      type: "API_KEY",
      re: /\b(?:sk-(?:live|test|ant)-[A-Za-z0-9_-]{16,}|sk-[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{20,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|ya29\.[0-9A-Za-z_-]{10,})\b/g,
      group: 0,
    },
    {
      type: "SECRET",
      re: /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/g,
      group: 0,
    },
    {
      type: "SECRET",
      re: /\b(?:api[_-]?key|secret|token|password|passwd)\b\s*[:=]\s*["']?([A-Za-z0-9+/_.=-]{8,})/gi,
      group: 1,
    },
    {
      type: "SECRET",
      re: /\bbearer\s+([A-Za-z0-9\-._~+/]{20,})/gi,
      group: 1,
    },
    {
      type: "EMAIL",
      re: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
      group: 0,
    },
    {
      type: "BANK",
      rank: 85,
      re: /\b[A-Z]{2}\d{2}(?:\s*[A-Z0-9]){8,30}\b/g,
      group: 0,
      accept: ibanOk,
    },
    {
      type: "SSN",
      re: /\b\d{3}-\d{2}-\d{4}\b/g,
      group: 0,
      accept: ssnOk,
    },
    {
      type: "CARD",
      re: /(?<!\d)(?:\d[ -]?){13,19}(?!\d)/g,
      group: 0,
      accept: (value) => luhnOk(value.replace(/\D/g, "")),
    },
    {
      type: "BVN",
      re: /\bBVN\b[^0-9]{0,16}((?:\d[ -]?){11})(?!\d)/gi,
      group: 1,
      accept: (value) => value.replace(/\D/g, "").length === 11,
    },
    {
      type: "NIN",
      re: /\bNIN\b[^0-9]{0,16}((?:\d[ -]?){11})(?!\d)/gi,
      group: 1,
      accept: (value) => value.replace(/\D/g, "").length === 11,
    },
    {
      type: "PHONE",
      re: /(?<!\d)(?:(?:\+234|234)[\s.-]?[789][01]\d[\s.-]?\d{3}[\s.-]?\d{4}|0[789][01]\d[\s.-]?\d{3}[\s.-]?\d{4})(?!\d)/g,
      group: 0,
    },
    {
      type: "PHONE",
      re: /(?<!\d)(?:\+44[\s.-]?7\d{3}[\s.-]?\d{6}|07\d{3}[\s.-]?\d{6})(?!\d)/g,
      group: 0,
    },
    {
      type: "PHONE",
      re: /(?<!\d)(?:\+1[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]\d{3}[\s.-]\d{4}(?!\d)/g,
      group: 0,
    },
    {
      type: "PHONE",
      re: /(?<!\d)\+\d{1,3}(?:[ \t().-]*\d){8,14}(?!\d)/g,
      group: 0,
      accept: (value) => {
        const digits = value.replace(/\D/g, "").length;
        return digits >= 10 && digits <= 15;
      },
    },
    {
      type: "BANK",
      re: /\b(?:account(?:\s+number)?|acct(?:\s*(?:no\.?|number))?|nuban)\b[^0-9]{0,16}((?:\d[ -]?){10})(?!\d)/gi,
      group: 1,
      accept: (value) => value.replace(/\D/g, "").length === 10,
    },
    {
      type: "ADDRESS",
      re: /\b\d{1,5}\s+(?:[A-Z][\p{L}'-]+\s+){1,5}(?:Street|St\.|Road|Rd\.|Avenue|Ave\.|Close|Crescent|Cres\.|Boulevard|Blvd\.|Lane|Ln\.|Drive|Dr\.|Way|Court|Terrace)\b(?:,\s*[A-Z][\p{L}'-]+(?:\s+[A-Z][\p{L}'-]+)*){0,3}/gu,
      group: 0,
    },
    {
      type: "ADDRESS",
      re: /\b\d{1,5}\s+Rue\s+(?:de\s+|d['’])?[A-Z][\p{L}'-]+(?:\s+[A-Z][\p{L}'-]+){0,3}/gu,
      group: 0,
    },
    {
      type: "ADDRESS",
      re: /\b[A-Z][\p{L}'-]*(?:straße|strasse)\s+\d{1,4}\b/gu,
      group: 0,
    },
    {
      type: "ADDRESS",
      re: /\b(?:Calle|Avenida)\s+[A-Z0-9][\p{L}0-9'-]*(?:\s+[A-Z0-9][\p{L}0-9'-]*){0,4}\b/gu,
      group: 0,
    },
    {
      type: "ADDRESS",
      re: /\b(?:lives at|address(?:\s+is|:))\s+([^\n.]{8,90})/gi,
      group: 1,
    },
    {
      type: "PERSON",
      re: /(?:[Tt]hanks|[Tt]hank [Yy]ou|[Rr]egards|[Ss]incerely|[Bb]est [Rr]egards|[Cc]heers|[Aa]tentamente|[Cc]ordialement|[Aa]tenciosamente|[Mm]it freundlichen Grüßen|[Mm]it freundlichen Grussen),?[ \t]*\r?\n+[ \t]*(\p{Lu}\p{Ll}+(?:[ \t]+\p{Lu}\p{Ll}+){1,2})/gu,
      group: 1,
    },
    {
      type: "PERSON",
      re: /\b(?:[Mm]y name is|[Ii] am|[Ii]'m|[Tt]his is|[Dd]ear|[Aa]ttn|[Aa]ttention|[Mm]e llamo|[Mm]i nombre es|[Jj]e m'appelle|[Mm]ein [Nn]ame ist|[Mm]eu nome é|[Mm]eu nome e)[:\s,]+(\p{Lu}\p{Ll}+(?:[ \t]+\p{Lu}\p{Ll}+){0,2})/gu,
      group: 1,
    },
    {
      type: "PERSON",
      re: /\b[Ff]or[ \t]+(\p{Lu}\p{Ll}+(?:[ \t]+\p{Lu}\p{Ll}+){1,2})\b/gu,
      group: 1,
    },
    {
      type: "PERSON",
      re: /\b(?:[Ff]rom|[Cc]ustomer|[Cc]lient)\b[:\s]+(\p{Lu}\p{Ll}+(?:[ \t]+\p{Lu}\p{Ll}+){1,2})\b/gu,
      group: 1,
    },
  ];
}

function spanFromMatch(match: RegExpMatchArray, group: number): { start: number; end: number; value: string } | null {
  const value = match[group];
  if (!value) return null;
  const indices = match.indices;
  if (indices && indices[group]) {
    const [start, end] = indices[group];
    return { start, end, value };
  }
  const full = match[0] ?? "";
  const index = match.index ?? 0;
  const local = full.indexOf(value);
  if (local < 0) return null;
  return { start: index + local, end: index + local + value.length, value };
}

export function detectRules(text: string, enabled: Record<EntityType, boolean>): RawSpan[] {
  const spans: RawSpan[] = [];
  for (const pattern of patterns()) {
    if (!enabled[pattern.type]) continue;
    pattern.re.lastIndex = 0;
    for (const match of text.matchAll(pattern.re)) {
      const located = spanFromMatch(match, pattern.group);
      if (!located) continue;
      if (pattern.accept && !pattern.accept(located.value)) continue;
      if (located.end <= located.start) continue;
      spans.push({
        type: pattern.type,
        value: located.value,
        start: located.start,
        end: located.end,
        source: "rules",
        rank: pattern.rank,
      });
    }
  }
  return spans;
}

export function locateModelSpans(
  text: string,
  entities: { type: EntityType; text: string }[],
  enabled: Record<EntityType, boolean>,
): RawSpan[] {
  const spans: RawSpan[] = [];
  const limit = Math.max(40, Math.floor(text.length * 0.8));
  for (const entity of entities) {
    if (!isKnown(entity.type) || !enabled[entity.type]) continue;
    const needle = entity.text?.trim();
    if (!needle || needle.length < 2 || needle.length > 180) continue;
    if (needle.length > limit) continue;
    if (/^\[[A-Z]+_\d+\]$/.test(needle)) continue;
    if (!text.includes(needle)) continue;
    let from = 0;
    while (from < text.length) {
      const at = text.indexOf(needle, from);
      if (at < 0) break;
      spans.push({
        type: entity.type,
        value: needle,
        start: at,
        end: at + needle.length,
        source: "model",
      });
      from = at + needle.length;
    }
  }
  return spans;
}

function isKnown(value: string): value is EntityType {
  return (ENTITY_TYPES as readonly string[]).includes(value);
}

function overlaps(a: RawSpan, b: RawSpan): boolean {
  return a.start < b.end && b.start < a.end;
}

export function resolveOverlaps(spans: RawSpan[]): RawSpan[] {
  const rankOf = (span: RawSpan) => span.rank ?? PRIORITY[span.type];
  const ranked = [...spans].sort((a, b) => {
    const priority = rankOf(b) - rankOf(a);
    if (priority !== 0) return priority;
    const rulesFirst = Number(b.source === "rules") - Number(a.source === "rules");
    if (rulesFirst !== 0) return rulesFirst;
    return b.end - b.start - (a.end - a.start);
  });
  const kept: RawSpan[] = [];
  for (const span of ranked) {
    if (kept.some((other) => overlaps(other, span))) continue;
    kept.push(span);
  }
  kept.sort((a, b) => a.start - b.start || a.end - b.end);
  return kept;
}

export function luhnValid(digits: string): boolean {
  return luhnOk(digits);
}
