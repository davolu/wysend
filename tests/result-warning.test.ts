import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultSettings } from "../src/lib/policy";
import { emptyStats } from "../src/lib/redaction/types";
import type { PanelModel } from "../src/sidepanel/use-panel";

const panel = vi.hoisted(() => ({ current: null as PanelModel | null }));

vi.mock("../src/sidepanel/use-panel", () => ({
  usePanel: () => panel.current,
}));

import { App } from "../src/sidepanel/App";

function model(overrides: Partial<PanelModel> = {}): PanelModel {
  const noop = async () => undefined;
  return {
    extension: false,
    settings: defaultSettings(),
    stats: emptyStats(),
    selection: null,
    diff: null,
    redacted: null,
    task: "reply",
    setTask: () => undefined,
    audit: { ok: true, payload: "Draft a reply.\n\nMessage:\n\"\"\"\nHi [PERSON_1]\n\"\"\"", bytes: 12 },
    approved: true,
    digest: "",
    assist: {
      text: "Hi [PERSON_1],\n\nBest,\n[PERSON_3]",
      inferenceSource: "in_cloud",
      mode: "ONLY_IN_CLOUD",
    },
    guardedText: "Hi [PERSON_1],\n\nBest,",
    unknownPlaceholders: ["[PERSON_3]"],
    outputWarning: "Removed [PERSON_3] before restore. It was not in the approved payload, so it cannot be filled in.",
    showRestored: true,
    setShowRestored: () => undefined,
    restored: "Hi Maya Chen,\n\nBest,",
    detectSource: "rules",
    detectInference: null,
    nano: { state: "ready", progress: 1, message: "Gemini Nano is ready on this device." },
    remote: { prompts: { reply: "", summarize: "", analyze: "", explain: "", onDevice: "" }, model: "gemini-3.5-flash-lite", policy: {}, source: "defaults", detail: "Using built-in prompts." },
    appCheck: { ready: true, method: "debug", projectId: "myfirstproject-76495", detail: "App Check debug token is set." },
    account: { uid: null, anonymous: false, email: null },
    host: "",
    busy: "",
    error: "",
    notice: "",
    debugToken: "",
    setDebugToken: () => undefined,
    captureSelection: noop,
    useSample: noop,
    usePaste: noop,
    refine: noop,
    prepareNano: noop,
    approve: () => undefined,
    runTask: noop,
    copyResult: noop,
    insertResult: noop,
    toggleType: noop,
    setPolicy: noop,
    setCloudMode: noop,
    setFollowRemote: noop,
    refreshRemote: noop,
    saveToken: noop,
    signIn: noop,
    signInGoogle: noop,
    signOut: noop,
    shareStats: noop,
    publishTeam: noop,
    applyTeam: noop,
    setTeamId: noop,
    clearSession: noop,
    ...overrides,
  };
}

describe("result warning", () => {
  beforeEach(() => {
    panel.current = model();
  });

  it("shows the restored reply and a warning when the model invented a placeholder", () => {
    const html = renderToStaticMarkup(createElement(App));
    expect(html).toContain("Hi Maya Chen,");
    expect(html).toContain("Removed [PERSON_3] before restore.");
    expect(html).toContain("class=\"warn\"");
  });

  it("hides the warning when every placeholder was in the payload", () => {
    panel.current = model({
      guardedText: "Hi [PERSON_1],",
      restored: "Hi Maya Chen,",
      unknownPlaceholders: [],
      outputWarning: "",
      assist: { text: "Hi [PERSON_1],", inferenceSource: "in_cloud", mode: "ONLY_IN_CLOUD" },
    });
    const html = renderToStaticMarkup(createElement(App));
    expect(html).toContain("Hi Maya Chen,");
    expect(html).not.toContain("Removed");
  });
});
