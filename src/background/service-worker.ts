import { PRODUCT_NAME } from "../brand";
import { STORAGE_KEYS, type RuntimeMessage, type SelectionCapture } from "../lib/messages";

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined);
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "finish-privately",
      title: `${PRODUCT_NAME}: finish this privately`,
      contexts: ["selection"],
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "finish-privately" || tab?.id === undefined) return;
  const tabId = tab.id;
  const frameId = "frameId" in info && typeof info.frameId === "number" ? info.frameId : undefined;
  chrome.tabs.sendMessage(tabId, { type: "CAPTURE_SELECTION" } satisfies RuntimeMessage, frameId === undefined ? undefined : { frameId }, (response: {
    ok?: boolean;
    text?: string;
    hostname?: string;
    url?: string;
    fieldId?: string;
  }) => {
    if (!response?.ok || !response.text) return;
    const capture: SelectionCapture = {
      text: response.text,
      hostname: response.hostname ?? "",
      url: response.url ?? "",
      fieldId: response.fieldId ?? "",
      at: Date.now(),
    };
    void chrome.storage.session.set({ [STORAGE_KEYS.pendingSelection]: capture });
  });
  chrome.sidePanel.open({ tabId }).catch(() => undefined);
});

chrome.runtime.onMessage.addListener((message: RuntimeMessage, sender, sendResponse) => {
  if (!message || typeof message !== "object") return undefined;
  if (message.type === "OPEN_PANEL" && sender.tab?.id !== undefined) {
    chrome.sidePanel.open({ tabId: sender.tab.id })
      .then(() => sendResponse({ ok: true }))
      .catch((error: unknown) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }
  if (message.type === "BADGE") {
    const total = message.total;
    chrome.action.setBadgeBackgroundColor({ color: "#0f5c44" });
    chrome.action.setBadgeText({ text: total > 0 ? String(Math.min(total, 999)) : "" });
  }
  return undefined;
});
