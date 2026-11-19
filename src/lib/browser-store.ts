import { STORAGE_KEYS } from "./messages";
import { normalizeSettings, type Settings } from "./policy";
import { emptyVault, type Vault } from "./redaction/types";
import { normalizeStats } from "./redaction/stats";
import { emptyStats, type Stats } from "./redaction/types";

export function hasChromeStorage(): boolean {
  return typeof chrome !== "undefined" && !!chrome.storage?.local && !!chrome.storage?.session;
}

export async function loadSettings(): Promise<Settings> {
  if (!hasChromeStorage()) return normalizeSettings(undefined);
  const data = await chrome.storage.local.get(STORAGE_KEYS.settings);
  return normalizeSettings(data[STORAGE_KEYS.settings]);
}

export async function saveSettings(settings: Settings): Promise<void> {
  if (!hasChromeStorage()) return;
  await chrome.storage.local.set({ [STORAGE_KEYS.settings]: settings });
}

export async function loadStats(): Promise<Stats> {
  if (!hasChromeStorage()) return emptyStats();
  const data = await chrome.storage.local.get(STORAGE_KEYS.stats);
  return normalizeStats(data[STORAGE_KEYS.stats]);
}

export async function saveStats(stats: Stats): Promise<void> {
  if (!hasChromeStorage()) return;
  await chrome.storage.local.set({ [STORAGE_KEYS.stats]: stats });
}

export async function loadVault(): Promise<Vault> {
  if (!hasChromeStorage()) return emptyVault();
  const data = await chrome.storage.session.get(STORAGE_KEYS.vault);
  const raw = data[STORAGE_KEYS.vault] as Vault | undefined;
  if (!raw || !Array.isArray(raw.entries)) return emptyVault();
  return {
    entries: raw.entries.filter((entry) => entry && typeof entry.placeholder === "string" && typeof entry.value === "string"),
  };
}

export async function saveVault(vault: Vault): Promise<void> {
  if (!hasChromeStorage()) return;
  await chrome.storage.session.set({ [STORAGE_KEYS.vault]: vault });
}

export async function loadDebugToken(): Promise<string> {
  if (!hasChromeStorage()) return "";
  const data = await chrome.storage.local.get(STORAGE_KEYS.appCheckDebugToken);
  const value = data[STORAGE_KEYS.appCheckDebugToken];
  return typeof value === "string" ? value : "";
}

export async function saveDebugToken(token: string): Promise<void> {
  if (!hasChromeStorage()) return;
  await chrome.storage.local.set({ [STORAGE_KEYS.appCheckDebugToken]: token.trim() });
}
