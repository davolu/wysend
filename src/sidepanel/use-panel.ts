import { useCallback, useEffect, useMemo, useState } from "react";
import { hasChromeStorage, loadDebugToken, loadSettings, loadStats, loadVault, saveDebugToken, saveSettings, saveStats, saveVault } from "../lib/browser-store";
import { watchAccount, signInAnonymous, signInWithGoogle, signOutAccount, type AccountSnapshot } from "../lib/firebase/auth";
import { initializeOnDeviceModel, runCloudAssist, runOnDeviceExtraction } from "../lib/firebase/ai";
import { currentAppCheckStatus, ensureAppCheck, type AppCheckStatus } from "../lib/firebase/init";
import { builtinRemoteSnapshot, loadRemoteSnapshot, type RemoteSnapshot } from "../lib/firebase/remote";
import { publishAggregateStats, publishTeamPolicy, readTeamPolicy } from "../lib/firebase/store";
import { STORAGE_KEYS, type DiffRecord, type RuntimeMessage, type SelectionCapture } from "../lib/messages";
import { describeAvailability, probeOnDeviceAvailability } from "../lib/nano";
import { applyRemotePolicy, applyTeamPolicy, defaultSettings, hostnameFromUrl, teamPolicyFromSettings, type Settings } from "../lib/policy";
import { BUILTIN_PROMPTS, prepareCloudAssist, type AssistTask, type PromptSet } from "../lib/redaction/cloud";
import { guardModelPlaceholders, modelOutputWarning, redact, rehydrate } from "../lib/redaction/engine";
import { SAMPLE_TEXT } from "../lib/redaction/sample";
import { addFindings, newFindings } from "../lib/redaction/stats";
import { emptyStats, emptyVault, type EntityType, type InferenceLabel, type ModelEntity, type RedactResult, type Stats, type Vault } from "../lib/redaction/types";
import type { NanoStatus } from "../lib/messages";

export interface PanelModel {
  extension: boolean;
  settings: Settings;
  stats: Stats;
  selection: SelectionCapture | null;
  diff: DiffRecord | null;
  redacted: RedactResult | null;
  task: AssistTask;
  setTask: (task: AssistTask) => void;
  audit: { ok: true; payload: string; bytes: number } | { ok: false; message: string } | null;
  approved: boolean;
  digest: string;
  assist: { text: string; inferenceSource: InferenceLabel; mode: Settings["cloudMode"] } | null;
  guardedText: string;
  unknownPlaceholders: string[];
  outputWarning: string;
  showRestored: boolean;
  setShowRestored: (value: boolean) => void;
  restored: string;
  detectSource: "rules" | "on_device";
  detectInference: InferenceLabel | null;
  nano: NanoStatus;
  remote: RemoteSnapshot;
  appCheck: AppCheckStatus;
  account: AccountSnapshot;
  host: string;
  busy: string;
  error: string;
  notice: string;
  debugToken: string;
  setDebugToken: (value: string) => void;
  captureSelection: () => Promise<void>;
  useSample: () => Promise<void>;
  usePaste: () => Promise<void>;
  refine: () => Promise<void>;
  prepareNano: () => Promise<void>;
  approve: () => void;
  runTask: () => Promise<void>;
  copyResult: () => Promise<void>;
  insertResult: () => Promise<void>;
  toggleType: (type: EntityType) => Promise<void>;
  setPolicy: (policy: Settings["defaultPolicy"]) => Promise<void>;
  setCloudMode: (mode: Settings["cloudMode"]) => Promise<void>;
  setFollowRemote: (value: boolean) => Promise<void>;
  refreshRemote: () => Promise<void>;
  saveToken: () => Promise<void>;
  signIn: () => Promise<void>;
  signInGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  shareStats: () => Promise<void>;
  publishTeam: () => Promise<void>;
  applyTeam: () => Promise<void>;
  setTeamId: (value: string) => Promise<void>;
  clearSession: () => Promise<void>;
}

const emptyAccount: AccountSnapshot = { uid: null, anonymous: false, email: null };

function sampleSelection(): SelectionCapture {
  return {
    text: SAMPLE_TEXT,
    hostname: "sample",
    url: "",
    fieldId: "",
    at: Date.now(),
  };
}

export function usePanel(): PanelModel {
  const extension = hasChromeStorage();
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [stats, setStats] = useState<Stats>(emptyStats);
  const [vault, setVault] = useState<Vault>(emptyVault);
  const [selection, setSelection] = useState<SelectionCapture | null>(extension ? null : sampleSelection());
  const [diff, setDiff] = useState<DiffRecord | null>(null);
  const [task, setTaskState] = useState<AssistTask>("reply");
  const [approvedPayload, setApprovedPayload] = useState<string | null>(null);
  const [assist, setAssist] = useState<PanelModel["assist"]>(null);
  const [showRestored, setShowRestored] = useState(true);
  const [detectSource, setDetectSource] = useState<"rules" | "on_device">("rules");
  const [detectInference, setDetectInference] = useState<InferenceLabel | null>(null);
  const [modelEntities, setModelEntities] = useState<ModelEntity[]>([]);
  const [nano, setNano] = useState<NanoStatus>(extension
    ? { state: "unknown", progress: 0, message: "Checking the on-device model." }
    : { state: "unsupported", progress: 0, message: "Rules are running in this preview. Prepare Nano after you load the extension." });
  const [remote, setRemote] = useState<RemoteSnapshot>(builtinRemoteSnapshot());
  const [appCheck, setAppCheck] = useState<AppCheckStatus>(currentAppCheckStatus());
  const [account, setAccount] = useState<AccountSnapshot>(emptyAccount);
  const [host, setHost] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(extension ? "" : "This tab is a layout preview. Load the unpacked extension to run Firebase AI Logic.");
  const [debugToken, setDebugToken] = useState("");
  const [digest, setDigest] = useState("");

  const prompts: PromptSet = remote.prompts || BUILTIN_PROMPTS;

  const redacted = useMemo(() => {
    if (!selection?.text) return null;
    return redact(selection.text, { enabled: settings.enabled, modelEntities }, vault);
  }, [selection, settings.enabled, vault, modelEntities]);

  const audit = useMemo(() => {
    if (!redacted) return null;
    try {
      const prepared = prepareCloudAssist(task, redacted.text, redacted.vault, prompts);
      return { ok: true as const, payload: prepared.payload, bytes: prepared.bytes };
    } catch (caught) {
      return { ok: false as const, message: caught instanceof Error ? caught.message : "The payload is not safe to send." };
    }
  }, [redacted, task, prompts]);

  const guarded = useMemo(() => {
    if (!assist) return { text: "", unknown: [] as string[], removedSignature: false };
    return guardModelPlaceholders(assist.text, redacted?.vault ?? vault);
  }, [assist, redacted, vault]);
  const restored = assist ? rehydrate(guarded.text, redacted?.vault ?? vault) : "";

  useEffect(() => {
    if (!audit?.ok) {
      setDigest("");
      return;
    }
    let cancelled = false;
    void crypto.subtle.digest("SHA-256", new TextEncoder().encode(audit.payload)).then((buffer) => {
      if (cancelled) return;
      setDigest([...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join(""));
    });
    return () => {
      cancelled = true;
    };
  }, [audit]);

  useEffect(() => {
    if (!extension) return;
    let stopAccount: () => void = () => undefined;
    void (async () => {
      const [nextSettings, nextStats, nextVault, token] = await Promise.all([
        loadSettings(),
        loadStats(),
        loadVault(),
        loadDebugToken(),
      ]);
      setSettings(nextSettings);
      setStats(nextStats);
      setVault(nextVault);
      setDebugToken(token);
      const status = ensureAppCheck(token);
      setAppCheck(status);
      if (status.ready) {
        const snapshot = await loadRemoteSnapshot();
        setRemote(snapshot);
        if (nextSettings.followRemote) {
          const applied = applyRemotePolicy(nextSettings, snapshot.policy);
          setSettings(applied);
          await saveSettings(applied);
        }
        stopAccount = watchAccount(setAccount);
      }
      const stored = await chrome.storage.session.get([STORAGE_KEYS.pendingSelection, STORAGE_KEYS.lastDiff]);
      if (stored[STORAGE_KEYS.pendingSelection]) setSelection(stored[STORAGE_KEYS.pendingSelection] as SelectionCapture);
      if (stored[STORAGE_KEYS.lastDiff]) setDiff(stored[STORAGE_KEYS.lastDiff] as DiffRecord);
      const availability = await probeOnDeviceAvailability();
      setNano({
        state: availability === "available" ? "downloadable" : availability === "unknown" ? "unknown" : availability,
        progress: availability === "downloading" ? 0.2 : 0,
        message: describeAvailability(availability),
      });
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      setHost(hostnameFromUrl(tab?.url));
    })();
    const onChanged = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area === "session" && changes[STORAGE_KEYS.pendingSelection]) {
        setSelection((changes[STORAGE_KEYS.pendingSelection].newValue as SelectionCapture | undefined) ?? null);
        setApprovedPayload(null);
        setAssist(null);
        setDetectSource("rules");
        setDetectInference(null);
        setModelEntities([]);
      }
      if (area === "session" && changes[STORAGE_KEYS.lastDiff]) {
        setDiff((changes[STORAGE_KEYS.lastDiff].newValue as DiffRecord | undefined) ?? null);
      }
      if (area === "local" && changes[STORAGE_KEYS.settings]) setSettings(changes[STORAGE_KEYS.settings].newValue as Settings);
      if (area === "local" && changes[STORAGE_KEYS.stats]) setStats(changes[STORAGE_KEYS.stats].newValue as Stats);
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => {
      stopAccount();
      chrome.storage.onChanged.removeListener(onChanged);
    };
  }, [extension]);

  const rememberVault = useCallback(async (next: Vault, findings = redacted?.findings ?? []) => {
    setVault(next);
    if (!extension) return;
    await saveVault(next);
    if (findings.length === 0) return;
    const current = await loadStats();
    const updated = addFindings(current, findings);
    setStats(updated);
    await saveStats(updated);
    chrome.runtime.sendMessage({ type: "BADGE", total: updated.secretsCaught } satisfies RuntimeMessage).catch(() => undefined);
  }, [extension, redacted?.findings]);

  const captureSelection = useCallback(async () => {
    setError("");
    if (!extension) {
      setSelection(sampleSelection());
      return;
    }
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id === undefined) {
      setError("Open a page, select the text, then try again.");
      return;
    }
    const response = await chrome.tabs.sendMessage(tab.id, { type: "CAPTURE_SELECTION" } satisfies RuntimeMessage) as {
      ok?: boolean;
      text?: string;
      hostname?: string;
      url?: string;
      fieldId?: string;
    };
    if (!response?.ok || !response.text) {
      setError("Select text on the page first. You can also right-click the selection.");
      return;
    }
    const capture: SelectionCapture = {
      text: response.text,
      hostname: response.hostname ?? "",
      url: response.url ?? "",
      fieldId: response.fieldId ?? "",
      at: Date.now(),
    };
    await chrome.storage.session.set({ [STORAGE_KEYS.pendingSelection]: capture });
    setSelection(capture);
    setApprovedPayload(null);
    setAssist(null);
    setModelEntities([]);
    setDetectSource("rules");
    setDetectInference(null);
  }, [extension]);

  const useSample = useCallback(async () => {
    const capture = sampleSelection();
    setSelection(capture);
    setApprovedPayload(null);
    setAssist(null);
    setDetectSource("rules");
    setDetectInference(null);
    setModelEntities([]);
    if (extension) await chrome.storage.session.set({ [STORAGE_KEYS.pendingSelection]: capture });
  }, [extension]);

  const usePaste = useCallback(async () => {
    if (!diff?.before) return;
    const capture: SelectionCapture = {
      text: diff.before,
      hostname: diff.hostname,
      url: diff.url,
      fieldId: diff.fieldId,
      at: Date.now(),
    };
    setSelection(capture);
    setApprovedPayload(null);
    setAssist(null);
    setModelEntities([]);
    setDetectSource("rules");
    setDetectInference(null);
    if (extension) await chrome.storage.session.set({ [STORAGE_KEYS.pendingSelection]: capture });
  }, [diff, extension]);

  const prepareNano = useCallback(async () => {
    setError("");
    setNano({ state: "downloading", progress: 0, message: "Starting the on-device model." });
    try {
      await initializeOnDeviceModel(prompts.onDevice, (fraction) => {
        setNano({
          state: "downloading",
          progress: fraction,
          message: `Downloading Gemini Nano ${Math.round(fraction * 100)}%`,
        });
      });
      setNano({ state: "ready", progress: 1, message: "Gemini Nano is ready on this device." });
    } catch (caught) {
      setNano({
        state: "unavailable",
        progress: 0,
        message: caught instanceof Error ? caught.message : "Gemini Nano is unavailable. Rules still redact, and raw text is not sent to the cloud.",
      });
    }
  }, [prompts.onDevice]);

  const refine = useCallback(async () => {
    if (!selection) return;
    setBusy("Reading on this device…");
    setError("");
    try {
      const extraction = await runOnDeviceExtraction(selection.text, prompts.onDevice);
      const result = redact(selection.text, { enabled: settings.enabled, modelEntities: extraction.entities }, vault);
      const added = newFindings(redacted?.findings ?? [], result.findings);
      setModelEntities(extraction.entities);
      setDetectSource("on_device");
      setDetectInference(extraction.inferenceSource);
      setApprovedPayload(null);
      setAssist(null);
      await rememberVault(result.vault, added);
      setNotice(extraction.entities.length ? "On-device model added context the rules did not catch." : "On-device model found nothing further.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "On-device refinement failed. The rules result is unchanged.");
    } finally {
      setBusy("");
    }
  }, [selection, prompts.onDevice, settings.enabled, vault, redacted?.findings, rememberVault]);

  const approve = useCallback(() => {
    if (!audit?.ok) {
      setError(audit?.message ?? "Nothing to approve.");
      return;
    }
    setApprovedPayload(audit.payload);
    setError("");
    setNotice("Approved. The cloud call will send this text and nothing else from the selection.");
  }, [audit]);

  const runTask = useCallback(async () => {
    if (!audit?.ok || !redacted || approvedPayload !== audit.payload) {
      setError("Approve the outbound payload before running the task.");
      return;
    }
    setBusy("Running the task…");
    setError("");
    try {
      const result = await runCloudAssist({
        task,
        approvedPayload,
        vault: redacted.vault,
        mode: settings.cloudMode,
        modelName: remote.model,
      });
      if (result.payload !== approvedPayload) {
        throw new Error("The sent payload did not match the approved bytes.");
      }
      setAssist({ text: result.text, inferenceSource: result.inferenceSource, mode: settings.cloudMode });
      setVault(redacted.vault);
      if (extension) await saveVault(redacted.vault);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The task failed.");
    } finally {
      setBusy("");
    }
  }, [audit, redacted, approvedPayload, task, settings.cloudMode, remote.model, extension]);

  const reviewedText = !assist ? "" : showRestored ? restored : guarded.text;

  const copyResult = useCallback(async () => {
    if (!reviewedText) return;
    await navigator.clipboard.writeText(reviewedText);
    setNotice(showRestored ? "Copied with restored values. They are on this device's clipboard." : "Copied with placeholders.");
  }, [reviewedText, showRestored]);

  const insertResult = useCallback(async () => {
    if (!reviewedText || !extension) return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id === undefined) return;
    const response = await chrome.tabs.sendMessage(tab.id, { type: "INSERT_TEXT", text: reviewedText } satisfies RuntimeMessage) as { ok?: boolean };
    setNotice(response?.ok ? "Inserted into the page." : "Click a text field on the page, then insert again.");
  }, [reviewedText, extension]);

  const updateSettings = useCallback(async (next: Settings) => {
    setSettings(next);
    setApprovedPayload(null);
    if (extension) await saveSettings(next);
  }, [extension]);

  return {
    extension,
    settings,
    stats,
    selection,
    diff,
    redacted,
    task,
    setTask: (next) => {
      setTaskState(next);
      setApprovedPayload(null);
      setAssist(null);
    },
    audit,
    approved: Boolean(audit?.ok && approvedPayload === audit.payload),
    digest,
    assist,
    guardedText: guarded.text,
    unknownPlaceholders: guarded.unknown,
    outputWarning: modelOutputWarning(guarded),
    showRestored,
    setShowRestored,
    restored,
    nano,
    remote,
    appCheck,
    account,
    host,
    busy,
    error,
    notice,
    debugToken,
    setDebugToken,
    captureSelection,
    useSample,
    usePaste,
    refine,
    prepareNano,
    approve,
    runTask,
    copyResult,
    insertResult,
    toggleType: async (type) => updateSettings({ ...settings, enabled: { ...settings.enabled, [type]: !settings.enabled[type] }, followRemote: false }),
    setPolicy: async (policy) => {
      const site = host || selection?.hostname || "";
      const sitePolicies = { ...settings.sitePolicies };
      if (site) sitePolicies[site] = policy;
      await updateSettings({ ...settings, defaultPolicy: site ? settings.defaultPolicy : policy, sitePolicies });
    },
    setCloudMode: async (mode) => updateSettings({ ...settings, cloudMode: mode }),
    setFollowRemote: async (value) => {
      const next = { ...settings, followRemote: value };
      await updateSettings(value ? applyRemotePolicy(next, remote.policy) : next);
    },
    refreshRemote: async () => {
      const snapshot = await loadRemoteSnapshot(true);
      setRemote(snapshot);
      setNotice(snapshot.detail);
    },
    saveToken: async () => {
      await saveDebugToken(debugToken);
      location.reload();
    },
    signIn: async () => {
      try {
        setError("");
        setAccount(await signInAnonymous());
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Sign-in failed.");
      }
    },
    signInGoogle: async () => {
      try {
        setError("");
        setAccount(await signInWithGoogle(import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID ?? ""));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Google sign-in failed.");
      }
    },
    signOut: async () => {
      try {
        await signOutAccount();
        setAccount(emptyAccount);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Sign-out failed.");
      }
    },
    shareStats: async () => {
      try {
        if (!account.uid) throw new Error("Sign in before sharing counts.");
        await publishAggregateStats(account.uid, stats);
        setNotice("Shared counts only. The text of the selection was not uploaded.");
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not share counts.");
      }
    },
    publishTeam: async () => {
      try {
        await publishTeamPolicy(settings.teamId, teamPolicyFromSettings(settings.teamId, settings));
        setNotice("Published the policy. No selection text was included.");
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not publish the policy.");
      }
    },
    applyTeam: async () => {
      try {
        const policy = await readTeamPolicy(settings.teamId);
        const next = applyTeamPolicy(settings, policy);
        await updateSettings(next);
        setNotice(`Applied team policy “${policy.name}”.`);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not apply the policy.");
      }
    },
    setTeamId: async (value) => updateSettings({ ...settings, teamId: value }),
    detectSource,
    detectInference,
    clearSession: async () => {
      setSelection(extension ? null : sampleSelection());
      setVault(emptyVault());
      setModelEntities([]);
      setAssist(null);
      setApprovedPayload(null);
      setDiff(null);
      if (extension) {
        await chrome.storage.session.remove([STORAGE_KEYS.pendingSelection, STORAGE_KEYS.vault, STORAGE_KEYS.lastDiff, STORAGE_KEYS.lastAssist]);
      }
    },
  };
}
