import { beforeEach, describe, expect, it, vi } from "vitest";

const generateContent = vi.hoisted(() => vi.fn());
const initializeDeviceModel = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("firebase/app", () => ({
  initializeApp: vi.fn(() => ({ name: "test-app" })),
}));

vi.mock("firebase/app-check", () => ({
  initializeAppCheck: vi.fn(() => ({})),
  ReCaptchaEnterpriseProvider: class ReCaptchaEnterpriseProvider {},
}));

vi.mock("firebase/ai", () => ({
  InferenceMode: {
    PREFER_ON_DEVICE: "prefer_on_device",
    ONLY_ON_DEVICE: "only_on_device",
    ONLY_IN_CLOUD: "only_in_cloud",
    PREFER_IN_CLOUD: "prefer_in_cloud",
  },
  InferenceSource: {
    ON_DEVICE: "on_device",
    IN_CLOUD: "in_cloud",
  },
  GoogleAIBackend: class GoogleAIBackend {},
  getAI: vi.fn(() => ({})),
  getGenerativeModel: vi.fn(() => ({ generateContent, initializeDeviceModel })),
}));

import { getGenerativeModel } from "firebase/ai";
import { resetAiCacheForTests, runCloudAssist, runOnDeviceExtraction } from "../src/lib/firebase/ai";
import { prepareCloudAssist } from "../src/lib/redaction/cloud";
import { redact } from "../src/lib/redaction/engine";
import { emptyEnabled, emptyVault } from "../src/lib/redaction/types";
import { SAMPLE_SECRETS, SAMPLE_TEXT } from "../src/lib/redaction/sample";

describe("Firebase AI Logic routing", () => {
  beforeEach(() => {
    generateContent.mockReset();
    initializeDeviceModel.mockClear();
    vi.mocked(getGenerativeModel).mockClear();
    resetAiCacheForTests();
  });

  it("reads raw text only with ONLY_ON_DEVICE and discards a cloud result", async () => {
    generateContent.mockResolvedValue({
      response: {
        text: () => "{\"entities\":[]}",
        inferenceSource: "in_cloud",
      },
    });
    await expect(runOnDeviceExtraction("Maya Chen", "extract")).rejects.toThrow(/in-cloud/);
    expect(getGenerativeModel).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ mode: "only_on_device" }),
    );
  });

  it("sends the approved payload and never the raw sample", async () => {
    const redacted = redact(SAMPLE_TEXT, { enabled: emptyEnabled() }, emptyVault());
    const approved = prepareCloudAssist("explain", redacted.text, redacted.vault);
    generateContent.mockResolvedValue({
      response: {
        text: () => "Explain [PERSON_1].",
        inferenceSource: "in_cloud",
      },
    });
    const result = await runCloudAssist({
      task: "explain",
      approvedPayload: approved.payload,
      vault: redacted.vault,
      mode: "ONLY_IN_CLOUD",
      modelName: "gemini-3.5-flash-lite",
    });
    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(generateContent).toHaveBeenCalledWith(approved.payload);
    const sent = generateContent.mock.calls[0][0] as string;
    for (const secret of SAMPLE_SECRETS) expect(sent).not.toContain(secret);
    expect(result.payload).toBe(approved.payload);
    expect(result.inferenceSource).toBe("in_cloud");
    expect(getGenerativeModel).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ mode: "only_in_cloud" }),
    );
    const options = vi.mocked(getGenerativeModel).mock.calls.at(-1)?.[1] as {
      onDeviceParams?: { createOptions?: { initialPrompts?: { content?: { value?: string }[] }[] } };
    };
    const system = options.onDeviceParams?.createOptions?.initialPrompts?.[0]?.content?.[0]?.value ?? "";
    expect(system).toContain("Do not invent placeholders, names, or signatures.");
  });

  it("does not call the model when the approved payload still has raw PII", async () => {
    const vault = redact(SAMPLE_TEXT, { enabled: emptyEnabled() }, emptyVault()).vault;
    await expect(runCloudAssist({
      task: "summarize",
      approvedPayload: SAMPLE_TEXT,
      vault,
      mode: "PREFER_IN_CLOUD",
      modelName: "gemini-3.5-flash-lite",
    })).rejects.toThrow(/raw personal data/);
    expect(generateContent).not.toHaveBeenCalled();
  });
});
