export const ENTITY_TYPES = [
  "PERSON",
  "PHONE",
  "EMAIL",
  "ADDRESS",
  "BANK",
  "BVN",
  "NIN",
  "CARD",
  "SSN",
  "API_KEY",
  "SECRET",
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

export type SitePolicy = "block" | "warn" | "auto-redact";

export type CloudRoute = "PREFER_IN_CLOUD" | "ONLY_IN_CLOUD";

export type InferenceLabel = "on_device" | "in_cloud" | "unknown";

export interface Finding {
  type: EntityType;
  value: string;
  placeholder: string;
  start: number;
  end: number;
  source: "rules" | "model";
}

export interface VaultEntry {
  placeholder: string;
  type: EntityType;
  value: string;
  canonical: string;
}

export interface Vault {
  entries: VaultEntry[];
}

export interface ModelEntity {
  type: EntityType;
  text: string;
}

export interface RedactResult {
  text: string;
  findings: Finding[];
  vault: Vault;
}

export interface Stats {
  secretsCaught: number;
  byType: Record<EntityType, number>;
  lastCaughtAt: number | null;
}

export const ENTITY_LABELS: Record<EntityType, string> = {
  PERSON: "Names",
  PHONE: "Phone numbers",
  EMAIL: "Email addresses",
  ADDRESS: "Street addresses",
  BANK: "Bank accounts and IBANs",
  BVN: "BVN",
  NIN: "NIN",
  CARD: "Card numbers",
  SSN: "US Social Security numbers",
  API_KEY: "API keys",
  SECRET: "Tokens and secrets",
};

export const ENTITY_HINTS: Record<EntityType, string> = {
  PERSON: "People mentioned by name",
  PHONE: "International numbers, including E.164 and common local formats",
  EMAIL: "Email addresses",
  ADDRESS: "Street addresses in several local forms",
  BANK: "Account numbers and IBANs",
  BVN: "Labeled bank verification numbers",
  NIN: "Labeled national identification numbers",
  CARD: "Payment cards that pass the Luhn check",
  SSN: "Dashed US Social Security numbers",
  API_KEY: "Provider keys such as sk- and AIza",
  SECRET: "Labeled tokens, passwords, and private keys",
};

export function emptyEnabled(): Record<EntityType, boolean> {
  return {
    PERSON: true,
    PHONE: true,
    EMAIL: true,
    ADDRESS: true,
    BANK: true,
    BVN: true,
    NIN: true,
    CARD: true,
    SSN: true,
    API_KEY: true,
    SECRET: true,
  };
}

export function emptyVault(): Vault {
  return { entries: [] };
}

export function emptyStats(): Stats {
  const byType = {} as Record<EntityType, number>;
  for (const type of ENTITY_TYPES) byType[type] = 0;
  return { secretsCaught: 0, byType, lastCaughtAt: null };
}

export function isEntityType(value: string): value is EntityType {
  return (ENTITY_TYPES as readonly string[]).includes(value);
}

export function canonicalValue(type: EntityType, value: string): string {
  const compact = value.replace(/\s+/g, "");
  if (type === "BANK" && /^[A-Za-z]{2}\d{2}[A-Za-z0-9]{8,}$/.test(compact)) {
    return compact.toUpperCase();
  }
  if (type === "PHONE" || type === "CARD" || type === "BVN" || type === "NIN" || type === "BANK" || type === "SSN") {
    return value.replace(/\D/g, "");
  }
  if (type === "EMAIL" || type === "API_KEY" || type === "SECRET") {
    return value.trim();
  }
  return value.trim().replace(/\s+/g, " ");
}
