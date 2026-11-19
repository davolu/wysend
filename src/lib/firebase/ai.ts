import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  InferenceMode,
  InferenceSource,
  type GenerativeModel,
} from "firebase/ai";
import { ENTITY_TYPES, type InferenceLabel } from "../redaction/types";
import { parseModelEntities } from "../redaction/engine";
import type { ModelEntity } from "../redaction/types";
import {
  assertCloudPayloadSafe,
  type AssistTask,
} from "../redaction/cloud";
import type { Vault } from "../redaction/types";
import { ensureAppCheck, getFirebaseApp } from "./init";

export const DEFAULT_CLOUD_MODEL = "gemini-3.5-flash-lite";

function entitySchema(): Record<string, unknown> {
  return {
    type: "object",
    properties: {
      entities: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: { type: "string", enum: [...ENTITY_TYPES] },
            text: { type: "string" },
          },
          required: ["type", "text"],
        },
      },
    },
    required: ["entities"],
  };
}

function requireReady(): void {
  const status = ensureAppCheck();
  if (!status.ready) throw new Error(status.detail);
}

function ai() {
  return getAI(getFirebaseApp(), { backend: new GoogleAIBackend() });
}

let deviceModel: GenerativeModel | null = null;
let devicePrompt = "";

export function resetAiCacheForTests(): void {
  deviceModel = null;
  devicePrompt = "";
}

/**
 * Raw text is pinned to ONLY_ON_DEVICE. PREFER_ON_DEVICE is intentionally not
 * used here: that mode uploads the prompt when Nano is missing.
 */
export function onDeviceModel(systemPrompt: string): GenerativeModel {
  if (deviceModel && devicePrompt === systemPrompt) return deviceModel;
  devicePrompt = systemPrompt;
  deviceModel = getGenerativeModel(ai(), {
    mode: InferenceMode.ONLY_ON_DEVICE,
    onDeviceParams: {
      createOptions: {
        expectedInputs: [{ type: "text", languages: ["en"] }],
        expectedOutputs: [{ type: "text", languages: ["en"] }],
        initialPrompts: [
          { role: "system", content: [{ type: "text", value: systemPrompt }] },
        ],
      },
      promptOptions: {
        responseConstraint: entitySchema(),
      },
    },
  });
  return deviceModel;
}

export function cloudModel(mode: "PREFER_IN_CLOUD" | "ONLY_IN_CLOUD", modelName: string): GenerativeModel {
  const inferenceMode = mode === "ONLY_IN_CLOUD" ? InferenceMode.ONLY_IN_CLOUD : InferenceMode.PREFER_IN_CLOUD;
  return getGenerativeModel(ai(), {
    mode: inferenceMode,
    inCloudParams: {
      model: modelName || DEFAULT_CLOUD_MODEL,
      generationConfig: {
        maxOutputTokens: 1024,
      },
    },
    onDeviceParams: {
      createOptions: {
        expectedInputs: [{ type: "text", languages: ["en"] }],
        expectedOutputs: [{ type: "text", languages: ["en"] }],
        initialPrompts: [
          {
            role: "system",
            content: [{
              type: "text",
              value: "The message is already redacted. Preserve every placeholder exactly. Do not invent personal data.",
            }],
          },
        ],
      },
    },
  });
}

export function readInferenceSource(value: unknown): InferenceLabel {
  if (value === InferenceSource.ON_DEVICE) return "on_device";
  if (value === InferenceSource.IN_CLOUD) return "in_cloud";
  return "unknown";
}

export async function initializeOnDeviceModel(
  systemPrompt: string,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  requireReady();
  const model = onDeviceModel(systemPrompt);
  await model.initializeDeviceModel((fraction) => {
    if (onProgress) onProgress(fraction);
  });
}

export async function runOnDeviceExtraction(
  rawText: string,
  systemPrompt: string,
): Promise<{ entities: ModelEntity[]; inferenceSource: InferenceLabel }> {
  requireReady();
  const clipped = rawText.slice(0, 12000);
  const model = onDeviceModel(systemPrompt);
  const result = await model.generateContent(
    `${systemPrompt}\n\nText:\n"""\n${clipped}\n"""`,
  );
  const inferenceSource = readInferenceSource(result.response.inferenceSource);
  if (inferenceSource === "in_cloud") {
    throw new Error("Stopped an on-device extraction because the SDK reported in-cloud inference.");
  }
  return {
    entities: parseModelEntities(result.response.text()),
    inferenceSource,
  };
}

export async function runCloudAssist(input: {
  task: AssistTask;
  approvedPayload: string;
  vault: Vault;
  mode: "PREFER_IN_CLOUD" | "ONLY_IN_CLOUD";
  modelName: string;
}): Promise<{ text: string; inferenceSource: InferenceLabel; payload: string }> {
  assertCloudPayloadSafe(input.approvedPayload, input.vault);
  requireReady();
  const model = cloudModel(input.mode, input.modelName);
  const result = await model.generateContent(input.approvedPayload);
  return {
    text: result.response.text(),
    inferenceSource: readInferenceSource(result.response.inferenceSource),
    payload: input.approvedPayload,
  };
}
