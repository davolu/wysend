import { fetchAndActivate, getRemoteConfig, getValue, type RemoteConfig } from "firebase/remote-config";
import { BUILTIN_PROMPTS, type PromptSet } from "../redaction/cloud";
import { ENTITY_TYPES, emptyEnabled, type EntityType, type SitePolicy } from "../redaction/types";
import type { RemotePolicyShape } from "../policy";
import { ensureAppCheck, getFirebaseApp, isFirebaseConfigured } from "./init";

export interface RemoteSnapshot {
  prompts: PromptSet;
  model: string;
  policy: RemotePolicyShape;
  source: "remote" | "defaults";
  detail: string;
}

const DEFAULT_MODEL = "gemini-3.5-flash-lite";

export function builtinRemoteSnapshot(): RemoteSnapshot {
  return {
    prompts: { ...BUILTIN_PROMPTS },
    model: DEFAULT_MODEL,
    policy: { defaultPolicy: "warn", enabled: emptyEnabled() },
    source: "defaults",
    detail: "Using built-in prompts. Publish Remote Config to change them without shipping a new extension.",
  };
}

function defaultConfig(): Record<string, string> {
  return {
    redaction_policy: JSON.stringify({ defaultPolicy: "warn", enabled: emptyEnabled() }),
    on_device_prompt: BUILTIN_PROMPTS.onDevice,
    cloud_summarize_prompt: BUILTIN_PROMPTS.summarize,
    cloud_reply_prompt: BUILTIN_PROMPTS.reply,
    cloud_analyze_prompt: BUILTIN_PROMPTS.analyze,
    cloud_explain_prompt: BUILTIN_PROMPTS.explain,
    cloud_model: DEFAULT_MODEL,
  };
}

function readString(rc: RemoteConfig, key: string, fallback: string): string {
  const value = getValue(rc, key).asString().trim();
  return value || fallback;
}

function readPolicy(raw: string): RemotePolicyShape {
  try {
    const parsed = JSON.parse(raw) as { defaultPolicy?: string; enabled?: Record<string, unknown> };
    const enabled: Partial<Record<EntityType, boolean>> = {};
    if (parsed.enabled && typeof parsed.enabled === "object") {
      for (const type of ENTITY_TYPES) {
        const value = parsed.enabled[type];
        if (typeof value === "boolean") enabled[type] = value;
      }
    }
    const defaultPolicy = parsed.defaultPolicy === "block" || parsed.defaultPolicy === "warn" || parsed.defaultPolicy === "auto-redact"
      ? parsed.defaultPolicy as SitePolicy
      : undefined;
    return { defaultPolicy, enabled };
  } catch {
    return {};
  }
}

export async function loadRemoteSnapshot(force = false): Promise<RemoteSnapshot> {
  const fallback = builtinRemoteSnapshot();
  if (!isFirebaseConfigured()) {
    return { ...fallback, detail: "Firebase config is missing, so Remote Config cannot be fetched." };
  }
  const appCheck = ensureAppCheck();
  if (!appCheck.ready) {
    return { ...fallback, detail: appCheck.detail };
  }
  try {
    const rc = getRemoteConfig(getFirebaseApp());
    rc.settings.minimumFetchIntervalMillis = force ? 0 : 60_000;
    rc.defaultConfig = defaultConfig();
    await fetchAndActivate(rc);
    return {
      prompts: {
        onDevice: readString(rc, "on_device_prompt", BUILTIN_PROMPTS.onDevice),
        summarize: readString(rc, "cloud_summarize_prompt", BUILTIN_PROMPTS.summarize),
        reply: readString(rc, "cloud_reply_prompt", BUILTIN_PROMPTS.reply),
        analyze: readString(rc, "cloud_analyze_prompt", BUILTIN_PROMPTS.analyze),
        explain: readString(rc, "cloud_explain_prompt", BUILTIN_PROMPTS.explain),
      },
      model: readString(rc, "cloud_model", DEFAULT_MODEL),
      policy: readPolicy(readString(rc, "redaction_policy", defaultConfig().redaction_policy)),
      source: "remote",
      detail: "Prompts and the redaction policy were fetched from Remote Config.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Remote Config fetch failed.";
    return { ...fallback, detail: `Using built-in prompts. ${message}` };
  }
}
