import {
  emptyEnabled,
  ENTITY_TYPES,
  isEntityType,
  type CloudRoute,
  type EntityType,
  type SitePolicy,
} from "./redaction/types";

export interface Settings {
  enabled: Record<EntityType, boolean>;
  sitePolicies: Record<string, SitePolicy>;
  defaultPolicy: SitePolicy;
  cloudMode: CloudRoute;
  teamId: string;
  followRemote: boolean;
  shareAnonymousStats: boolean;
}

export const DEFAULT_SITE_POLICIES: Record<string, SitePolicy> = {
  "chatgpt.com": "auto-redact",
  "chat.openai.com": "auto-redact",
  "gemini.google.com": "auto-redact",
  "claude.ai": "auto-redact",
  "slack.com": "warn",
  "mail.google.com": "warn",
  "localhost": "auto-redact",
  "127.0.0.1": "auto-redact",
};

export function defaultSettings(): Settings {
  return {
    enabled: emptyEnabled(),
    sitePolicies: { ...DEFAULT_SITE_POLICIES },
    defaultPolicy: "warn",
    cloudMode: "PREFER_IN_CLOUD",
    teamId: "",
    followRemote: true,
    shareAnonymousStats: false,
  };
}

const POLICIES = new Set<SitePolicy>(["block", "warn", "auto-redact"]);

export function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
}

export function policyForHost(hostname: string, settings: Pick<Settings, "sitePolicies" | "defaultPolicy">): SitePolicy {
  const host = normalizeHost(hostname);
  if (!host) return settings.defaultPolicy;
  if (settings.sitePolicies[host]) return settings.sitePolicies[host];
  const match = Object.entries(settings.sitePolicies)
    .map(([domain, policy]) => [normalizeHost(domain), policy] as const)
    .filter(([domain]) => domain && (host === domain || host.endsWith(`.${domain}`)))
    .sort((a, b) => b[0].length - a[0].length)[0];
  return match ? match[1] : settings.defaultPolicy;
}

export function normalizeSettings(raw: unknown): Settings {
  const base = defaultSettings();
  if (!raw || typeof raw !== "object") return base;
  const record = raw as Partial<Settings>;
  const enabled = { ...base.enabled };
  if (record.enabled && typeof record.enabled === "object") {
    for (const type of ENTITY_TYPES) {
      const value = (record.enabled as Record<string, unknown>)[type];
      if (typeof value === "boolean") enabled[type] = value;
    }
  }
  const sitePolicies: Record<string, SitePolicy> = {};
  const source = record.sitePolicies && typeof record.sitePolicies === "object" ? record.sitePolicies : base.sitePolicies;
  for (const [host, policy] of Object.entries(source)) {
    const normalized = normalizeHost(host);
    if (!normalized || !/^[a-z0-9.-]+$/.test(normalized)) continue;
    if (typeof policy === "string" && POLICIES.has(policy as SitePolicy)) {
      sitePolicies[normalized] = policy as SitePolicy;
    }
  }
  if (Object.keys(sitePolicies).length === 0) {
    Object.assign(sitePolicies, base.sitePolicies);
  }
  const defaultPolicy = typeof record.defaultPolicy === "string" && POLICIES.has(record.defaultPolicy as SitePolicy)
    ? record.defaultPolicy as SitePolicy
    : base.defaultPolicy;
  const cloudMode: CloudRoute = record.cloudMode === "ONLY_IN_CLOUD" ? "ONLY_IN_CLOUD" : "PREFER_IN_CLOUD";
  const teamId = typeof record.teamId === "string" && /^[A-Za-z0-9_-]{0,40}$/.test(record.teamId) ? record.teamId : "";
  return {
    enabled,
    sitePolicies,
    defaultPolicy,
    cloudMode,
    teamId,
    followRemote: record.followRemote !== false,
    shareAnonymousStats: record.shareAnonymousStats === true,
  };
}

export interface TeamPolicy {
  name: string;
  defaultPolicy: SitePolicy;
  sitePolicies: Record<string, SitePolicy>;
  enabledTypes: EntityType[];
}

export function teamPolicyFromSettings(name: string, settings: Settings): TeamPolicy {
  return {
    name: name.trim(),
    defaultPolicy: settings.defaultPolicy,
    sitePolicies: { ...settings.sitePolicies },
    enabledTypes: ENTITY_TYPES.filter((type) => settings.enabled[type]),
  };
}

export function assertTeamPolicySafe(policy: TeamPolicy): void {
  if (!/^[A-Za-z0-9 ._-]{1,60}$/.test(policy.name)) {
    throw new Error("Team name must be 1–60 letters, numbers, spaces, dots, or dashes.");
  }
  if (!POLICIES.has(policy.defaultPolicy)) throw new Error("Unknown default policy.");
  const hosts = Object.entries(policy.sitePolicies);
  if (hosts.length > 80) throw new Error("Too many site policies.");
  for (const [host, sitePolicy] of hosts) {
    if (!/^[a-z0-9.-]{1,200}$/.test(host) || !POLICIES.has(sitePolicy)) {
      throw new Error("A site policy is not a hostname plus block, warn, or auto-redact.");
    }
  }
  for (const type of policy.enabledTypes) {
    if (!isEntityType(type)) throw new Error("Unknown entity type on the team policy.");
  }
  if (JSON.stringify(policy).length > 8000) throw new Error("Team policy is too large.");
}

export function applyTeamPolicy(settings: Settings, policy: TeamPolicy): Settings {
  assertTeamPolicySafe(policy);
  const enabled = emptyEnabled();
  for (const type of ENTITY_TYPES) enabled[type] = false;
  for (const type of policy.enabledTypes) enabled[type] = true;
  return {
    ...settings,
    enabled,
    defaultPolicy: policy.defaultPolicy,
    sitePolicies: { ...policy.sitePolicies },
    followRemote: false,
  };
}

export interface RemotePolicyShape {
  defaultPolicy?: SitePolicy;
  enabled?: Partial<Record<EntityType, boolean>>;
}

export function applyRemotePolicy(settings: Settings, remote: RemotePolicyShape): Settings {
  if (!settings.followRemote) return settings;
  const enabled = { ...settings.enabled };
  if (remote.enabled) {
    for (const type of ENTITY_TYPES) {
      const value = remote.enabled[type];
      if (typeof value === "boolean") enabled[type] = value;
    }
  }
  const defaultPolicy = remote.defaultPolicy && POLICIES.has(remote.defaultPolicy)
    ? remote.defaultPolicy
    : settings.defaultPolicy;
  return { ...settings, enabled, defaultPolicy };
}

export function hostnameFromUrl(url: string | undefined): string {
  if (!url) return "";
  try {
    return normalizeHost(new URL(url).hostname);
  } catch {
    return "";
  }
}
