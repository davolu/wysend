import { PRODUCT_NAME } from "../brand";
import { loadSettings, loadStats, loadVault, saveStats, saveVault } from "../lib/browser-store";
import { STORAGE_KEYS, type DiffRecord, type RuntimeMessage } from "../lib/messages";
import { defaultSettings, normalizeSettings, policyForHost } from "../lib/policy";
import { redact } from "../lib/redaction/engine";
import { addFindings } from "../lib/redaction/stats";
import { emptyVault, type Finding, type Vault } from "../lib/redaction/types";
import type { Settings } from "../lib/policy";

type Editable = HTMLTextAreaElement | HTMLInputElement | HTMLElement;

let settings: Settings = defaultSettings();
let vault: Vault = emptyVault();
const bypass = new WeakSet<EventTarget>();
let host: HTMLElement | null = null;
let lastIntercept = 0;

function isEditable(node: Element | null): node is Editable {
  if (!node) return false;
  if (node instanceof HTMLTextAreaElement) return !node.disabled && !node.readOnly;
  if (node instanceof HTMLInputElement) {
    const type = (node.type || "text").toLowerCase();
    return ["text", "search", "email", "tel", "url", ""].includes(type) && !node.disabled && !node.readOnly;
  }
  return node instanceof HTMLElement && node.isContentEditable;
}

function editableFrom(target: EventTarget | null): Editable | null {
  if (!(target instanceof Element)) return null;
  if (target.closest("#lr-host")) return null;
  const found = target.closest("textarea, input, [contenteditable]");
  return isEditable(found) ? found : null;
}

function readText(el: Editable): string {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) return el.value;
  return el.innerText ?? "";
}

function setNativeValue(el: HTMLTextAreaElement | HTMLInputElement, value: string): void {
  const prototype = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  descriptor?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

function fieldId(el: Editable): string {
  if (!el.dataset.lrField) el.dataset.lrField = `f${Math.random().toString(36).slice(2, 10)}`;
  return el.dataset.lrField;
}

function replaceAll(el: Editable, text: string): void {
  bypass.add(el);
  try {
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
      setNativeValue(el, text);
      return;
    }
    el.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    selection?.removeAllRanges();
    selection?.addRange(range);
    const inserted = document.execCommand("insertText", false, text);
    if (!inserted) {
      el.textContent = text;
      el.dispatchEvent(new InputEvent("input", { bubbles: true, data: text, inputType: "insertText" }));
    }
  } finally {
    bypass.delete(el);
  }
}

function insertAtCaret(el: Editable, text: string): void {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    bypass.add(el);
    try {
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? start;
      const next = el.value.slice(0, start) + text + el.value.slice(end);
      setNativeValue(el, next);
      const pos = start + text.length;
      el.setSelectionRange(pos, pos);
    } finally {
      bypass.delete(el);
    }
    return;
  }
  replaceAll(el, `${readText(el)}${text}`);
}

function summary(findings: Finding[]): string {
  const counts = new Map<string, number>();
  for (const finding of findings) counts.set(finding.type, (counts.get(finding.type) ?? 0) + 1);
  return [...counts.entries()].map(([type, count]) => `${count} ${type.toLowerCase().replace("_", " ")}`).join(", ");
}

function ensureHost(): ShadowRoot {
  if (host?.isConnected) return host.shadowRoot as ShadowRoot;
  host = document.createElement("div");
  host.id = "lr-host";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>
    :host { all: initial; }
    .wrap { position: fixed; z-index: 2147483646; right: 16px; bottom: 16px; width: min(360px, calc(100vw - 24px)); font-family: "Iowan Old Style", Palatino, Georgia, serif; color: #1a1814; }
    .card { background: #fffdf8; border: 1px solid #d9d1c3; border-radius: 18px; box-shadow: 0 18px 50px rgba(40, 28, 12, 0.18); padding: 14px 14px 12px; }
    .kicker { font-family: "Avenir Next", "Segoe UI", sans-serif; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: #0f5c44; margin: 0 0 4px; }
    h2 { font-size: 22px; line-height: 1.1; margin: 0 0 8px; font-weight: 600; }
    p { font-family: "Avenir Next", "Segoe UI", sans-serif; font-size: 13.5px; line-height: 1.45; margin: 0 0 12px; color: #3f3a33; }
    .row { display: flex; flex-wrap: wrap; gap: 8px; }
    button { font-family: "Avenir Next", "Segoe UI", sans-serif; border-radius: 999px; border: 1px solid transparent; padding: 8px 12px; font-size: 13px; cursor: pointer; }
    button:focus-visible { outline: 2px solid #0f5c44; outline-offset: 2px; }
    .primary { background: #0f5c44; color: #f4f1ea; }
    .ghost { background: transparent; border-color: #d9d1c3; color: #1a1814; }
    .danger { background: #9a3412; color: white; }
    .toast { font-family: "Avenir Next", "Segoe UI", sans-serif; background: #14352c; color: #f4f1ea; border-radius: 999px; padding: 10px 14px; display: flex; gap: 10px; align-items: center; justify-content: space-between; }
    .toast button { background: #e7efe9; color: #14352c; }
  </style><div class="wrap"></div>`;
  (document.body ?? document.documentElement).appendChild(host);
  return root;
}

function showToast(text: string): void {
  const root = ensureHost();
  const wrap = root.querySelector(".wrap");
  if (!wrap) return;
  wrap.innerHTML = `<div class="toast" role="status"><span>${text}</span><button type="button">Review</button></div>`;
  wrap.querySelector("button")?.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "OPEN_PANEL" } satisfies RuntimeMessage).catch(() => undefined);
  });
  window.setTimeout(() => {
    if (wrap.querySelector(".toast")) wrap.innerHTML = "";
  }, 7000);
}

function showDialog(options: {
  title: string;
  body: string;
  actions: Array<{ label: string; kind: "primary" | "ghost" | "danger"; onClick: () => void }>;
}): void {
  const root = ensureHost();
  const wrap = root.querySelector(".wrap");
  if (!wrap) return;
  wrap.innerHTML = `<div class="card" role="dialog" aria-modal="true" aria-label="${options.title}">
    <p class="kicker">${PRODUCT_NAME}</p>
    <h2>${options.title}</h2>
    <p>${options.body}</p>
    <div class="row"></div>
  </div>`;
  const row = wrap.querySelector(".row");
  for (const action of options.actions) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = action.kind;
    button.textContent = action.label;
    button.addEventListener("click", () => {
      wrap.innerHTML = "";
      action.onClick();
    });
    row?.appendChild(button);
  }
  (row?.querySelector("button") as HTMLButtonElement | null)?.focus();
}

async function publish(before: string, after: string, findings: Finding[], nextVault: Vault, field: Editable): Promise<void> {
  vault = nextVault;
  await saveVault(nextVault);
  const stats = addFindings(await loadStats(), findings);
  await saveStats(stats);
  const diff: DiffRecord = {
    id: `d${Date.now().toString(36)}`,
    hostname: location.hostname,
    url: location.href.slice(0, 300),
    fieldId: fieldId(field),
    before: before.slice(0, 50000),
    after: after.slice(0, 50000),
    findings,
    source: "rules",
    inferenceSource: null,
    createdAt: Date.now(),
  };
  await chrome.storage.session.set({ [STORAGE_KEYS.lastDiff]: diff });
  chrome.runtime.sendMessage({ type: "BADGE", total: stats.secretsCaught } satisfies RuntimeMessage).catch(() => undefined);
}

function handleText(text: string, field: Editable, mode: "paste" | "send", event: Event): void {
  if (!text.trim() || bypass.has(field)) return;
  const result = redact(text, { enabled: settings.enabled }, vault);
  if (result.findings.length === 0) return;
  const now = Date.now();
  if (now - lastIntercept < 350) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  lastIntercept = now;
  const policy = policyForHost(location.hostname, settings);
  const detail = summary(result.findings);
  event.preventDefault();
  event.stopPropagation();

  const commit = (output: string, raw: string) => {
    if (mode === "paste") insertAtCaret(field, output);
    else replaceAll(field, output);
    void publish(raw, output, result.findings, result.vault, field);
    showToast(`Redacted ${result.findings.length} item${result.findings.length === 1 ? "" : "s"} on this device.`);
  };

  if (policy === "auto-redact") {
    commit(result.text, text);
    return;
  }
  if (policy === "block") {
    showDialog({
      title: "Blocked before it left the page",
      body: `This draft includes ${detail}. It was not inserted. Change this site's policy in the side panel if that is too strict.`,
      actions: [{ label: "Dismiss", kind: "ghost", onClick: () => undefined }],
    });
    return;
  }
  showDialog({
    title: mode === "paste" ? "Paste contains secrets" : "This draft contains secrets",
    body: `Found ${detail}. Redaction stays on this device. Sending anyway puts the original text into the website.`,
    actions: [
      { label: "Redact", kind: "primary", onClick: () => commit(result.text, text) },
      {
        label: "Keep original",
        kind: "danger",
        onClick: () => {
          bypass.add(field);
          if (mode === "paste") insertAtCaret(field, text);
          window.setTimeout(() => bypass.delete(field), 0);
        },
      },
      { label: "Dismiss", kind: "ghost", onClick: () => undefined },
    ],
  });
}

function onPaste(event: ClipboardEvent): void {
  const field = editableFrom(event.target);
  if (!field || bypass.has(field)) return;
  const text = event.clipboardData?.getData("text") ?? "";
  handleText(text, field, "paste", event);
}

function enterSends(event: KeyboardEvent, field: Editable): boolean {
  if (event.key !== "Enter" || event.shiftKey || event.altKey || event.isComposing) return false;
  if (event.metaKey || event.ctrlKey) return true;
  if (field instanceof HTMLTextAreaElement) return field.rows <= 1 || field.enterKeyHint === "send";
  return true;
}

function onKeyDown(event: KeyboardEvent): void {
  const field = editableFrom(event.target);
  if (!field || !enterSends(event, field)) return;
  handleText(readText(field), field, "send", event);
}

function sendControl(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const button = target.closest("button, [role='button'], input[type='submit']");
  if (!(button instanceof HTMLElement)) return null;
  const label = `${button.getAttribute("aria-label") ?? ""} ${button.textContent ?? ""}`.replace(/\s+/g, " ").trim().toLowerCase();
  if (/\b(send|reply|post|submit)\b/.test(label)) return button;
  return null;
}

function composerNear(control: HTMLElement): Editable | null {
  const form = control.closest("form");
  const scoped = form?.querySelector("textarea, input[type='text'], [contenteditable='true']");
  if (isEditable(scoped ?? null)) return scoped as Editable;
  const region = control.closest("section, main, [role='main'], div");
  const candidate = region?.querySelector("textarea, [contenteditable='true']");
  return isEditable(candidate ?? null) ? candidate as Editable : null;
}

function onClick(event: MouseEvent): void {
  const control = sendControl(event.target);
  if (!control) return;
  const field = composerNear(control);
  if (!field) return;
  handleText(readText(field), field, "send", event);
}

function onSubmit(event: SubmitEvent): void {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  const field = form.querySelector("textarea, input[type='text'], [contenteditable='true']");
  if (!isEditable(field)) return;
  handleText(readText(field), field, "send", event);
}

function selectionField(): Editable | null {
  const active = document.activeElement;
  if (isEditable(active)) return active;
  const node = window.getSelection()?.anchorNode;
  if (node instanceof Element) return editableFrom(node);
  if (node?.parentElement) return editableFrom(node.parentElement);
  return null;
}

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (!message || typeof message !== "object") return undefined;
  if (message.type === "APPLY_REDACTION") {
    const el = document.querySelector(`[data-lr-field="${CSS.escape(message.fieldId)}"]`);
    if (!isEditable(el)) return undefined;
    const current = readText(el);
    if (current !== message.expected && !current.includes(message.expected)) return undefined;
    const next = current === message.expected ? message.next : current.split(message.expected).join(message.next);
    replaceAll(el, next);
    return undefined;
  }
  if (message.type === "CAPTURE_SELECTION") {
    const text = window.getSelection()?.toString() ?? "";
    const field = selectionField();
    sendResponse({
      ok: text.trim().length > 0,
      text,
      hostname: location.hostname,
      url: location.href.slice(0, 300),
      fieldId: field ? fieldId(field) : "",
    });
    return true;
  }
  if (message.type === "INSERT_TEXT") {
    const field = selectionField()
      ?? document.querySelector("textarea, [contenteditable='true']");
    if (!isEditable(field)) {
      sendResponse({ ok: false });
      return true;
    }
    replaceAll(field, message.text);
    sendResponse({ ok: true });
    return true;
  }
  return undefined;
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[STORAGE_KEYS.settings]) {
    settings = normalizeSettings(changes[STORAGE_KEYS.settings].newValue);
  }
  if (area === "session" && changes[STORAGE_KEYS.vault]?.newValue) {
    const next = changes[STORAGE_KEYS.vault].newValue as Vault;
    if (Array.isArray(next.entries)) vault = next;
  }
});

void (async () => {
  settings = normalizeSettings(await loadSettings());
  vault = await loadVault();
})();

document.addEventListener("paste", onPaste, true);
document.addEventListener("keydown", onKeyDown, true);
document.addEventListener("click", onClick, true);
document.addEventListener("submit", onSubmit, true);
