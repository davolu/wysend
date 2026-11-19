import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from "firebase/firestore";
import { assertTeamPolicySafe, type TeamPolicy } from "../policy";
import { assertAggregateOnly, buildStatsWrite } from "../redaction/stats";
import { isEntityType, type EntityType, type SitePolicy, type Stats } from "../redaction/types";
import { ensureAppCheck, getFirebaseApp } from "./init";

function database() {
  const status = ensureAppCheck();
  if (!status.ready) throw new Error(status.detail);
  return getFirestore(getFirebaseApp());
}

export async function publishAggregateStats(uid: string, stats: Stats): Promise<void> {
  const body = buildStatsWrite(stats);
  assertAggregateOnly(body);
  await setDoc(doc(database(), "stats", uid), {
    secretsCaught: body.secretsCaught,
    byType: body.byType,
    updatedAt: serverTimestamp(),
  });
}

function asPolicy(value: unknown): SitePolicy | null {
  if (value === "block" || value === "warn" || value === "auto-redact") return value;
  return null;
}

export function parseStoredTeamPolicy(raw: unknown): TeamPolicy {
  if (!raw || typeof raw !== "object") throw new Error("Team policy was empty.");
  const record = raw as Record<string, unknown>;
  const name = typeof record.name === "string" ? record.name : "";
  const defaultPolicy = asPolicy(record.defaultPolicy);
  if (!defaultPolicy) throw new Error("Team policy is missing a default.");
  const sitePolicies: Record<string, SitePolicy> = {};
  if (record.sitePolicies && typeof record.sitePolicies === "object") {
    for (const [host, policy] of Object.entries(record.sitePolicies as Record<string, unknown>)) {
      const parsed = asPolicy(policy);
      if (parsed) sitePolicies[host] = parsed;
    }
  }
  const enabledTypes: EntityType[] = [];
  if (Array.isArray(record.enabledTypes)) {
    for (const type of record.enabledTypes) {
      if (typeof type === "string" && isEntityType(type)) enabledTypes.push(type);
    }
  }
  const policy = { name, defaultPolicy, sitePolicies, enabledTypes };
  assertTeamPolicySafe(policy);
  return policy;
}

export async function publishTeamPolicy(teamId: string, policy: TeamPolicy): Promise<void> {
  if (!/^[A-Za-z0-9_-]{4,40}$/.test(teamId)) {
    throw new Error("Team id must be 4–40 letters, numbers, dashes, or underscores.");
  }
  assertTeamPolicySafe(policy);
  await setDoc(doc(database(), "teams", teamId), {
    name: policy.name,
    defaultPolicy: policy.defaultPolicy,
    sitePolicies: policy.sitePolicies,
    enabledTypes: policy.enabledTypes,
    updatedAt: serverTimestamp(),
  });
}

export async function readTeamPolicy(teamId: string): Promise<TeamPolicy> {
  if (!/^[A-Za-z0-9_-]{4,40}$/.test(teamId)) {
    throw new Error("Team id must be 4–40 letters, numbers, dashes, or underscores.");
  }
  const snap = await getDoc(doc(database(), "teams", teamId));
  if (!snap.exists()) throw new Error("No team policy exists for that id yet.");
  return parseStoredTeamPolicy(snap.data());
}
