import { ENTITY_TYPES, emptyStats, isEntityType, type EntityType, type Finding, type Stats } from "./types";

export function addFindings(stats: Stats, findings: Finding[], at = Date.now()): Stats {
  const byType = { ...stats.byType };
  for (const type of ENTITY_TYPES) {
    if (typeof byType[type] !== "number") byType[type] = 0;
  }
  let added = 0;
  for (const finding of findings) {
    byType[finding.type] += 1;
    added += 1;
  }
  return {
    secretsCaught: stats.secretsCaught + added,
    byType,
    lastCaughtAt: added > 0 ? at : stats.lastCaughtAt,
  };
}

export function normalizeStats(raw: unknown): Stats {
  const base = emptyStats();
  if (!raw || typeof raw !== "object") return base;
  const record = raw as Partial<Stats>;
  const byType = { ...base.byType };
  if (record.byType && typeof record.byType === "object") {
    for (const type of ENTITY_TYPES) {
      const value = record.byType[type];
      if (typeof value === "number" && Number.isFinite(value) && value >= 0) byType[type] = Math.floor(value);
    }
  }
  const secretsCaught = typeof record.secretsCaught === "number" && record.secretsCaught >= 0
    ? Math.floor(record.secretsCaught)
    : Object.values(byType).reduce((sum, n) => sum + n, 0);
  return {
    secretsCaught,
    byType,
    lastCaughtAt: typeof record.lastCaughtAt === "number" ? record.lastCaughtAt : null,
  };
}

/** Numbers only. This is the object that may be written to Firestore. */
export function buildStatsWrite(stats: Stats): { secretsCaught: number; byType: Record<EntityType, number> } {
  const normalized = normalizeStats(stats);
  const byType = {} as Record<EntityType, number>;
  for (const type of ENTITY_TYPES) byType[type] = normalized.byType[type];
  return { secretsCaught: normalized.secretsCaught, byType };
}

export function findingsOfTypes(findings: Finding[], types: EntityType[]): Finding[] {
  const allow = new Set(types);
  return findings.filter((finding) => allow.has(finding.type));
}

export function newFindings(previous: Finding[], next: Finding[]): Finding[] {
  const seen = new Set(previous.map((finding) => `${finding.type}:${finding.value}`));
  return next.filter((finding) => !seen.has(`${finding.type}:${finding.value}`));
}

export function assertAggregateOnly(value: unknown): void {
  const json = JSON.stringify(value);
  if (!json) return;
  const record = value as { secretsCaught?: unknown; byType?: unknown };
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    throw new Error("Stats payload must be an object.");
  }
  const keys = Object.keys(record as object);
  for (const key of keys) {
    if (key !== "secretsCaught" && key !== "byType") {
      throw new Error(`Stats payload has an unexpected field: ${key}`);
    }
  }
  if (typeof record.secretsCaught !== "number") throw new Error("secretsCaught must be a number.");
  if (!record.byType || typeof record.byType !== "object") throw new Error("byType must be a map of numbers.");
  for (const [key, count] of Object.entries(record.byType as Record<string, unknown>)) {
    if (!isEntityType(key) || typeof count !== "number") {
      throw new Error("byType has a non-numeric or unknown entry.");
    }
  }
}
